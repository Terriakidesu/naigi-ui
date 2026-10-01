const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("naigi", {
  appVersion: () => ipcRenderer.invoke("naigi:app-version"),
  savedServers: () => ipcRenderer.invoke("naigi:saved-servers"),
  removeSavedServer: (server) => ipcRenderer.invoke("naigi:remove-saved-server", server),
  inspectServer: (server) => ipcRenderer.invoke("naigi:inspect-server", server),
  connect: (server) => ipcRenderer.invoke("naigi:connect", server)
});
