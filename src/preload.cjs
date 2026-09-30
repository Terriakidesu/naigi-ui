const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("naigi", {
  savedServer: () => ipcRenderer.invoke("naigi:saved-server"),
  connect: (server) => ipcRenderer.invoke("naigi:connect", server)
});
