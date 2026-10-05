const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kernDesktop", {
  isDesktop: true,
  getConfig: () => ipcRenderer.invoke("kern:config:get"),
  saveConfig: (config) => ipcRenderer.invoke("kern:config:save", config),
  restartServer: () => ipcRenderer.invoke("kern:server:restart"),
  openConfigLocation: () => ipcRenderer.invoke("kern:config:open"),
  notify: (notification) => ipcRenderer.invoke("kern:notify", notification),
});
