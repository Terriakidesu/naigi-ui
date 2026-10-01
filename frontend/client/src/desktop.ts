import { desktopInfo } from "./desktop-context";

async function showDesktopTitleBar() {
  const info = await desktopInfo;
  if (!info?.customTitleBar) return;
  document.body.classList.add("desktop-window");
  const bar = document.createElement("header");
  bar.className = "desktop-titlebar";
  const navigation = document.createElement("nav");
  navigation.className = "desktop-titlebar-navigation";
  navigation.setAttribute("aria-label", "Page history");
  for (const [label, glyph, action] of [
    ["Go back", "←", () => window.history.back()],
    ["Go forward", "→", () => window.history.forward()],
  ] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.textContent = glyph;
    button.addEventListener("click", action);
    navigation.append(button);
  }
  const title = document.createElement("span");
  title.className = "desktop-titlebar-title";
  const updateTitle = () => { title.textContent = document.title || "Naigi"; };
  updateTitle();
  const titleElement = document.querySelector("title");
  if (titleElement) new MutationObserver(updateTitle).observe(titleElement, { childList: true, subtree: true, characterData: true });
  bar.append(navigation, title);
  document.body.prepend(bar);
}

async function showDesktopVersions() {
  const aboutTab = document.getElementById("desktop-about-tab");
  if (aboutTab && window.naigiDesktop) aboutTab.hidden = false;
  if (window.naigiDesktop) {
    for (const notice of document.querySelectorAll<HTMLElement>("[data-license-path]")) {
      const details = notice.closest("details");
      let loaded = false;
      details?.addEventListener("toggle", () => {
        if (!details.open || loaded) return;
        loaded = true;
        void fetch(notice.dataset.licensePath!).then(async (response) => {
          if (!response.ok) throw new Error("license_unavailable");
          notice.textContent = await response.text();
        }).catch(() => { notice.textContent = "Could not load this license notice. Close and reopen to retry."; loaded = false; });
      });
    }
  }
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
void showDesktopTitleBar();
