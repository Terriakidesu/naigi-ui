const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("naigi", {
  appVersion: () => ipcRenderer.invoke("naigi:app-version"),
  savedServer: () => ipcRenderer.invoke("naigi:saved-server"),
  inspectServer: (server) => ipcRenderer.invoke("naigi:inspect-server", server),
  connect: (server) => ipcRenderer.invoke("naigi:connect", server)
});
