const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kernDesktop", {
  isDesktop: true,
  getConfig: () => ipcRenderer.invoke("kern:config:get"),
  saveConfig: (config) => ipcRenderer.invoke("kern:config:save", config),
  restartServer: () => ipcRenderer.invoke("kern:server:restart"),
  openConfigLocation: () => ipcRenderer.invoke("kern:config:open"),
  notify: (notification) => ipcRenderer.invoke("kern:notify", notification),
  getUpdateState: () => ipcRenderer.invoke("kern:update:get"),
  checkForUpdates: () => ipcRenderer.invoke("kern:update:check"),
  downloadUpdate: () => ipcRenderer.invoke("kern:update:download"),
  installUpdate: () => ipcRenderer.invoke("kern:update:install"),
  onUpdateStatus: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("kern:update:status", listener);
    return () => ipcRenderer.removeListener("kern:update:status", listener);
  },
});
