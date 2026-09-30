const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { normalizeServerUrl } = require("./server-url.cjs");

let launcher;
let chat;
let serverOrigin;
const launcherPath = path.join(__dirname, "launcher.html");
const launcherUrl = pathToFileURL(launcherPath).href;
const configPath = () => path.join(app.getPath("userData"), "server.json");

async function savedServer() {
  try {
    return normalizeServerUrl(JSON.parse(await fs.readFile(configPath(), "utf8")).server);
  } catch {
    return "";
  }
}

function isServerUrl(value) {
  try { return new URL(value).origin === serverOrigin; } catch { return false; }
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
    width: 520, height: 460, minWidth: 420, minHeight: 400,
    title: "Connect to Naigi", autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  launcher.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  launcher.webContents.on("will-navigate", (event) => event.preventDefault());
  launcher.on("closed", () => { launcher = null; });
  await launcher.loadFile(launcherPath);
}

async function connect(origin) {
  if (chat && !chat.isDestroyed()) chat.close();
  serverOrigin = origin;
  const window = new BrowserWindow({
    width: 1280, height: 850, minWidth: 800, minHeight: 600,
    title: "Naigi", show: false,
    webPreferences: { partition: `persist:naigi-${Buffer.from(origin).toString("hex")}`, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  });
  chat = window;
  const session = window.webContents.session;
  const allowedPermissions = new Set(["media", "notifications", "clipboard-sanitized-write"]);
  session.setPermissionCheckHandler((contents, permission, requestingOrigin) =>
    contents === window.webContents && allowedPermissions.has(permission) && isServerUrl(requestingOrigin));
  session.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    if (contents !== window.webContents || !allowedPermissions.has(permission) || !details.isMainFrame || !isServerUrl(details.requestingUrl)) {
      callback(false); return;
    }
    try {
      const { response } = await dialog.showMessageBox(window, {
        type: "question", title: "Naigi permission", message: `${origin} requests ${permission === "media" ? "microphone/camera access" : permission}.`,
        buttons: ["Deny", "Allow"], defaultId: 0, cancelId: 0
      });
      callback(response === 1);
    } catch { callback(false); }
  });
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.on("will-navigate", (event, url) => {
    if (!isServerUrl(url)) { event.preventDefault(); openExternal(url); }
  });
  window.webContents.on("will-redirect", (event, url) => {
    if (!isServerUrl(url)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  window.on("closed", () => { if (chat === window) chat = null; });
  try {
    await window.loadURL(origin);
    window.show();
    if (launcher && !launcher.isDestroyed()) launcher.close();
  } catch (error) {
    window.destroy();
    throw new Error(`Could not connect to ${origin}. Check that the server is running.`);
  }
}

function trustedLauncher(event) {
  return launcher && event.sender === launcher.webContents && event.senderFrame?.url === launcherUrl;
}

app.whenReady().then(async () => {
  ipcMain.handle("naigi:saved-server", (event) => {
    if (!trustedLauncher(event)) throw new Error("Untrusted sender.");
    return savedServer();
  });
  ipcMain.handle("naigi:connect", async (event, input) => {
    if (!trustedLauncher(event) || typeof input !== "string") throw new Error("Untrusted request.");
    try {
      const origin = normalizeServerUrl(input.trim());
      await fs.mkdir(app.getPath("userData"), { recursive: true });
      await fs.writeFile(configPath(), JSON.stringify({ server: origin }), { mode: 0o600 });
      await connect(origin);
      return { ok: true };
    } catch (error) { return { ok: false, error: error.message }; }
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === "darwin" ? [{ role: "appMenu" }] : []),
    { label: "File", submenu: [{ label: "Change server…", click: () => { void showLauncher(); } }, { role: "quit" }] },
    { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" }
  ]));
  await showLauncher();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void showLauncher(); });
