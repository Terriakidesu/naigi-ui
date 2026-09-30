const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("naigiDesktop", Object.freeze({
  getInfo: () => ipcRenderer.invoke("naigi:desktop-info"),
  getRealtimeUrl: () => ipcRenderer.invoke("naigi:realtime-url"),
}));
