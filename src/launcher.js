const form = document.querySelector("#connect-form");
const input = document.querySelector("#server");
const checkButton = document.querySelector("#check-server");
const status = document.querySelector("#status");
const appVersion = document.querySelector("#app-version");
const serverVersion = document.querySelector("#server-version");
const savedServersSection = document.querySelector("#saved-servers");
const savedServerList = document.querySelector("#saved-server-list");
let busy = false;

function setBusy(value) {
  busy = value;
  input.disabled = value;
  for (const control of document.querySelectorAll("button")) control.disabled = value;
}

function renderSavedServers({ servers }) {
  savedServerList.replaceChildren();
  savedServersSection.hidden = servers.length === 0;
  for (const server of servers) {
    const row = document.createElement("li");
    row.className = "saved-server-row";
    const connectButton = document.createElement("button");
    connectButton.type = "button";
    connectButton.className = "secondary saved-server-connect";
    connectButton.textContent = server;
    connectButton.setAttribute("aria-label", `Connect to ${server}`);
    connectButton.addEventListener("click", () => {
      if (busy) return;
      input.value = server;
      serverVersion.textContent = "Not checked";
      void connectToServer();
    });
    const forgetButton = document.createElement("button");
    forgetButton.type = "button";
    forgetButton.className = "secondary saved-server-forget";
    forgetButton.textContent = "Forget";
    forgetButton.setAttribute("aria-label", `Forget ${server}`);
    forgetButton.addEventListener("click", async () => {
      if (busy) return;
      setBusy(true);
      try {
        const saved = await window.naigi.removeSavedServer(server);
        renderSavedServers(saved);
        if (input.value === server) {
          input.value = saved.server;
          serverVersion.textContent = "Not checked";
        }
        status.textContent = "Server shortcut removed. Its login and encrypted storage were not erased.";
      } catch {
        status.textContent = "Could not remove the saved server. Please try again.";
      } finally { setBusy(false); input.focus(); }
    });
    row.append(connectButton, forgetButton);
    savedServerList.append(row);
  }
  setBusy(busy);
}

window.naigi.appVersion().then((version) => { appVersion.textContent = `v${version}`; }).catch(() => {
  appVersion.textContent = "Unavailable";
});

async function inspectServer(announce = true) {
  if (busy) return;
  setBusy(true);
  serverVersion.textContent = "Checking…";
  if (announce) status.textContent = "Checking your Naigi server…";
  try {
    const result = await window.naigi.inspectServer(input.value);
    if (!result.ok) throw new Error(result.error || "Could not reach this server.");
    serverVersion.textContent = result.serverVersion ? `v${result.serverVersion}` : "Unavailable";
    if (announce) status.textContent = result.serverVersion
      ? "Server reached. Its version is shown below."
      : "Server reached, but it did not report a version.";
  } catch (error) {
    serverVersion.textContent = "Not available";
    if (announce) status.textContent = error instanceof Error ? error.message : "Could not reach this server.";
  } finally {
    setBusy(false);
  }
}

window.naigi.savedServers().then((saved) => {
  renderSavedServers(saved);
  input.value = saved.server;
  if (saved.server) void inspectServer(false);
}).catch(() => {
  status.textContent = "Could not read your saved servers.";
});

checkButton.addEventListener("click", () => { void inspectServer(); });
input.addEventListener("change", () => {
  serverVersion.textContent = "Not checked";
  status.textContent = "";
});

async function connectToServer() {
  if (busy) return;
  setBusy(true);
  status.textContent = "Connecting…";
  try {
    const result = await window.naigi.connect(input.value);
    status.textContent = result.ok ? "Connected." : result.error;
  } catch {
    status.textContent = "Could not connect. Please try again.";
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void connectToServer();
});
