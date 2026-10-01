export type DesktopInfo = {
  appVersion: string;
  serverVersion: string | null;
  serverOrigin: string;
  customTitleBar?: boolean;
};

declare global {
  interface Window {
    naigiDesktop?: {
      getInfo: () => Promise<DesktopInfo>;
      getRealtimeUrl: () => Promise<string>;
    };
  }
}

export const desktopInfo = typeof window === "undefined"
  ? Promise.resolve(undefined)
  : window.naigiDesktop?.getInfo().catch(() => undefined) ?? Promise.resolve(undefined);

export async function connectedServerOrigin() {
  const info = await desktopInfo;
  return info?.serverOrigin ?? window.location.origin;
}
