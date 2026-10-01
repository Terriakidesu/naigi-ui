const { app, BrowserWindow, ipcMain, Menu, dialog, shell, protocol, session } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { normalizeServerUrl } = require("./server-url.cjs");
const { createSavedServerStore } = require("./saved-servers.cjs");
const { APP_ORIGIN, createProtocolHandler } = require("./desktop-protocol.cjs");
const { createRealtimeProxy } = require("./realtime-proxy.cjs");
const { cookieHeader, storeResponseCookies } = require("./session-cookies.cjs");

protocol.registerSchemesAsPrivileged([{
  scheme: "naigi",
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, allowServiceWorkers: true }
}]);

let launcher;
let chat;
let chatSession;
let realtimeProxy;
let serverOrigin;
let serverVersion;
const launcherPath = path.join(__dirname, "launcher.html");
const launcherUrl = pathToFileURL(launcherPath).href;
const appUrl = `${APP_ORIGIN}/`;
const frontendRoot = path.join(__dirname, "..", ".build", "frontend");
const configPath = () => path.join(app.getPath("userData"), "server.json");
let savedServers;

function isAppUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "naigi:" && url.hostname === "app" && !url.port && !url.username && !url.password;
  } catch { return false; }
}

function openExternal(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:") {
      void shell.openExternal(url.href);
    }
  } catch { /* Invalid links are ignored. */ }
}

async function showLauncher() {
  if (launcher && !launcher.isDestroyed()) { launcher.focus(); return; }
  launcher = new BrowserWindow({
    width: 520, height: 700, minWidth: 420, minHeight: 510,
    title: "Connect to Naigi", autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  launcher.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  launcher.webContents.on("will-navigate", (event) => event.preventDefault());
  launcher.on("closed", () => { launcher = null; });
  await launcher.loadFile(launcherPath);
}

function versionFromPayload(payload) {
  if (!payload || payload.name !== "Naigi" || typeof payload.version !== "string") return null;
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(payload.version) ? payload.version : null;
}

async function probeServer(origin) {
  let versionResponse;
  try {
    versionResponse = await fetch(new URL("/v1/version", origin), {
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    throw new Error(`Could not reach ${origin}. Check the address, connection, and TLS certificate.`);
  }

  let version = null;
  if (versionResponse.ok) {
    try { version = versionFromPayload(await versionResponse.json()); } catch { /* Older servers may not provide version metadata. */ }
  } else if (versionResponse.status >= 500 || (versionResponse.status >= 300 && versionResponse.status < 400)) {
    throw new Error(`The server at ${origin} could not provide its version.`);
  }

  if (versionResponse.status === 404 || versionResponse.status === 405) {
    try {
      const health = await fetch(new URL("/health/live", origin), {
        headers: { accept: "application/json" },
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
      });
      if (!health.ok) throw new Error("health_check_failed");
    } catch {
      throw new Error(`Could not reach ${origin}. Check that the Naigi server is running.`);
    }
  }

  return version;
}

async function proxyApiRequest(request, appSession, origin) {
  const target = require("./desktop-protocol.cjs").apiTarget(origin, request.url);
  const headers = new Headers();
  const blockedHeaders = new Set(["connection", "content-encoding", "content-length", "cookie", "host", "origin", "referer", "transfer-encoding"]);
  for (const [name, value] of request.headers) {
    if (!blockedHeaders.has(name.toLowerCase()) && !name.toLowerCase().startsWith("sec-")) headers.set(name, value);
  }
  const cookies = await appSession.cookies.get({ url: target.href });
  if (cookies.length) headers.set("cookie", cookieHeader(cookies));

  const options = { method: request.method, headers, redirect: "manual", signal: request.signal };
  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    options.body = request.body;
    options.duplex = "half";
  }
  const response = await fetch(target, options);
  await storeResponseCookies(appSession, response, target.href);
  if (response.status >= 300 && response.status < 400) {
    return Response.json({ error: "unexpected_server_redirect" }, { status: 502, headers: { "cache-control": "no-store" } });
  }

  const responseHeaders = new Headers();
  const strippedResponseHeaders = new Set(["connection", "content-encoding", "content-length", "transfer-encoding"]);
  for (const [name, value] of response.headers) {
    if (name.toLowerCase() !== "set-cookie" && !strippedResponseHeaders.has(name.toLowerCase())) responseHeaders.append(name, value);
  }
  const body = request.method === "HEAD" || response.status === 204 || response.status === 304 ? null : response.body;
  return new Response(body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
}

function trustedLauncher(event) {
  return launcher && event.sender === launcher.webContents
    && event.senderFrame === event.sender.mainFrame
    && event.senderFrame?.url === launcherUrl;
}

function trustedChat(event) {
  return chat && event.sender === chat.webContents
    && event.senderFrame === event.sender.mainFrame
    && isAppUrl(event.senderFrame?.url);
}

async function closeChat() {
  realtimeProxy?.close();
  realtimeProxy = null;
  if (chatSession) {
    try { chatSession.protocol.unhandle("naigi"); } catch { /* The session may not have been initialized. */ }
  }
  chatSession = null;
  const previousChat = chat;
  chat = null;
  if (previousChat && !previousChat.isDestroyed()) previousChat.close();
}

async function connect(origin, nextServerVersion) {
  await closeChat();
  serverOrigin = origin;
  serverVersion = nextServerVersion;
  const partition = `persist:naigi-${require("node:crypto").createHash("sha256").update(origin).digest("hex")}`;
  const appSession = session.fromPartition(partition, { cache: true });
  try { appSession.protocol.unhandle("naigi"); } catch { /* First connection for this server. */ }
  appSession.protocol.handle("naigi", await createProtocolHandler({
    frontendRoot,
    serverOrigin: origin,
    session: appSession,
    fetchApi: proxyApiRequest,
  }));

  const window = new BrowserWindow({
    width: 1280, height: 850, minWidth: 800, minHeight: 600,
    title: "Naigi", show: false, autoHideMenuBar: true,
    ...(process.platform !== "darwin" ? {
      titleBarStyle: "hidden",
      titleBarOverlay: { color: "#11151b", symbolColor: "#b9c1cc", height: 32 },
    } : {}),
    webPreferences: {
      preload: path.join(__dirname, "chat-preload.cjs"),
      session: appSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    }
  });
  chat = window;
  chatSession = appSession;
  const allowedPermissions = new Set(["media", "notifications", "clipboard-sanitized-write"]);
  appSession.setPermissionCheckHandler((contents, permission, requestingOrigin) =>
    contents === window.webContents && allowedPermissions.has(permission) && requestingOrigin === APP_ORIGIN);
  appSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    if (contents !== window.webContents || !allowedPermissions.has(permission) || !details.isMainFrame || !isAppUrl(details.requestingUrl)) {
      callback(false); return;
    }
    try {
      const { response } = await dialog.showMessageBox(window, {
        type: "question", title: "Naigi permission", message: `${permission === "media" ? "Naigi requests microphone/camera access." : `Naigi requests ${permission}.`}`,
        buttons: ["Deny", "Allow"], defaultId: 0, cancelId: 0
      });
      callback(response === 1);
    } catch { callback(false); }
  });
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) { event.preventDefault(); openExternal(url); }
  });
  window.webContents.on("will-redirect", (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  window.on("closed", () => {
    if (chat === window) {
      chat = null;
      chatSession = null;
      realtimeProxy?.close();
      realtimeProxy = null;
    }
  });

  try {
    realtimeProxy = await createRealtimeProxy({ serverOrigin: origin, session: appSession });
    await window.loadURL(appUrl);
    window.show();
    if (launcher && !launcher.isDestroyed()) launcher.close();
  } catch {
    try { appSession.protocol.unhandle("naigi"); } catch { /* The session may already be disposed. */ }
    if (!window.isDestroyed()) window.destroy();
    realtimeProxy?.close();
    realtimeProxy = null;
    if (chat === window) { chat = null; chatSession = null; }
    throw new Error("Could not open the bundled Naigi frontend. Rebuild the app and try again.");
  }
}

async function showAbout() {
  const detail = [
    `Desktop app version: v${app.getVersion()}`,
    `Naigi server version: ${serverVersion ? `v${serverVersion}` : "Unavailable"}`,
    `Server address: ${serverOrigin ?? "Not connected"}`,
  ].join("\n");
  const options = { type: "info", title: "About Naigi", message: "Naigi desktop", detail, buttons: ["Close"] };
  if (chat && !chat.isDestroyed()) await dialog.showMessageBox(chat, options);
  else if (launcher && !launcher.isDestroyed()) await dialog.showMessageBox(launcher, options);
  else await dialog.showMessageBox(options);
}

app.whenReady().then(async () => {
  savedServers = createSavedServerStore(configPath());
  app.setAboutPanelOptions({ applicationName: "Naigi", applicationVersion: `v${app.getVersion()}` });
  ipcMain.handle("naigi:saved-servers", (event) => {
    if (!trustedLauncher(event)) throw new Error("Untrusted sender.");
    return savedServers.list();
  });
  ipcMain.handle("naigi:remove-saved-server", (event, input) => {
    if (!trustedLauncher(event) || typeof input !== "string") throw new Error("Untrusted request.");
    return savedServers.remove(input.trim());
  });
  ipcMain.handle("naigi:app-version", (event) => {
    if (!trustedLauncher(event)) throw new Error("Untrusted sender.");
    return app.getVersion();
  });
  ipcMain.handle("naigi:inspect-server", async (event, input) => {
    if (!trustedLauncher(event) || typeof input !== "string") throw new Error("Untrusted request.");
    try {
      const origin = normalizeServerUrl(input.trim());
      return { ok: true, serverVersion: await probeServer(origin) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
  ipcMain.handle("naigi:connect", async (event, input) => {
    if (!trustedLauncher(event) || typeof input !== "string") throw new Error("Untrusted request.");
    try {
      const origin = normalizeServerUrl(input.trim());
      const nextServerVersion = await probeServer(origin);
      await savedServers.remember(origin);
      await connect(origin, nextServerVersion);
      return { ok: true };
    } catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.handle("naigi:desktop-info", (event) => {
    if (!trustedChat(event)) throw new Error("Untrusted sender.");
    return { appVersion: app.getVersion(), serverVersion: serverVersion ?? null, serverOrigin, customTitleBar: process.platform !== "darwin" };
  });
  ipcMain.handle("naigi:realtime-url", (event) => {
    if (!trustedChat(event) || !realtimeProxy) throw new Error("Untrusted request.");
    return realtimeProxy.url;
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    { label: "File", submenu: [{ label: "Change server…", click: () => { void showLauncher(); } }, { role: "quit" }] },
    { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" },
    { label: "Help", submenu: [{ label: "About Naigi…", click: () => { void showAbout(); } }] },
  ]));
  await showLauncher();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void showLauncher(); });
