const form = document.querySelector("#connect-form");
const input = document.querySelector("#server");
const button = document.querySelector("#connect");
const checkButton = document.querySelector("#check-server");
const status = document.querySelector("#status");
const appVersion = document.querySelector("#app-version");
const serverVersion = document.querySelector("#server-version");

window.naigi.appVersion().then((version) => { appVersion.textContent = `v${version}`; }).catch(() => {
  appVersion.textContent = "Unavailable";
});

async function inspectServer(announce = true) {
  checkButton.disabled = true;
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
    checkButton.disabled = false;
  }
}

window.naigi.savedServer().then((server) => {
  input.value = server;
  if (server) void inspectServer(false);
}).catch(() => {
  status.textContent = "Could not read your saved server address.";
});

checkButton.addEventListener("click", () => { void inspectServer(); });
input.addEventListener("change", () => {
  serverVersion.textContent = "Not checked";
  status.textContent = "";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  checkButton.disabled = true;
  status.textContent = "Connecting…";
  try {
    const result = await window.naigi.connect(input.value);
    status.textContent = result.ok ? "Connected." : result.error;
  } catch {
    status.textContent = "Could not connect. Please try again.";
  } finally {
    button.disabled = false;
    checkButton.disabled = false;
  }
});
