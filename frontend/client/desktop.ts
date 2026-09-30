import { desktopInfo } from "./desktop-context";

async function showDesktopVersions() {
  const panel = document.getElementById("desktop-version");
  const appVersion = document.getElementById("desktop-app-version");
  const serverVersion = document.getElementById("desktop-server-version");
  if (!panel || !appVersion || !serverVersion || !window.naigiDesktop) return;

  try {
    const info = await desktopInfo;
    if (!info) throw new Error("desktop_info_unavailable");
    appVersion.textContent = `v${info.appVersion}`;
    serverVersion.textContent = info.serverVersion ? `v${info.serverVersion}` : "Unavailable";
    panel.hidden = false;
  } catch {
    appVersion.textContent = "Unavailable";
    serverVersion.textContent = "Unavailable";
    panel.hidden = false;
  }
}

void showDesktopVersions();
