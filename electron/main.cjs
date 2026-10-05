const { app, BrowserWindow, Menu, Notification, ipcMain, session, shell } = require("electron");
const { spawn } = require("node:child_process");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const {
  getRendererConfig,
  getServerConfig,
  openConfigLocation,
  saveRendererConfig,
} = require("./config.cjs");

const APP_ID = "dev.bxane.kern";
const HOST = "127.0.0.1";

let mainWindow = null;
let serverProcess = null;
let serverUrl = null;

const updateState = {
  supported: false,
  status: "idle",
  currentVersion: app.getVersion(),
  availableVersion: null,
  progress: null,
  message: "Updater not initialized.",
};

function publishUpdateState(patch = {}) {
  Object.assign(updateState, patch);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("kern:update:status", { ...updateState });
  }
  return { ...updateState };
}

function updaterSupported() {
  return app.isPackaged && (process.platform === "win32" || process.platform === "linux");
}

function configureUpdater() {
  const supported = updaterSupported();
  publishUpdateState({
    supported,
    currentVersion: app.getVersion(),
    status: supported ? "idle" : "unsupported",
    message: supported
      ? "Ready to check GitHub Releases."
      : "Auto-update checks are available in packaged Windows/Linux builds.",
  });

  if (!supported) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on("checking-for-update", () => {
    publishUpdateState({
      status: "checking",
      progress: null,
      message: "Checking GitHub Releases…",
    });
  });

  autoUpdater.on("update-available", (info) => {
    publishUpdateState({
      status: "available",
      availableVersion: info.version,
      progress: null,
      message: `KERN ${info.version} is available.`,
    });
  });

  autoUpdater.on("update-not-available", () => {
    publishUpdateState({
      status: "current",
      availableVersion: null,
      progress: null,
      message: "KERN is up to date.",
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    publishUpdateState({
      status: "downloading",
      progress: Math.max(0, Math.min(100, Math.round(progress.percent || 0))),
      message: `Downloading update… ${Math.round(progress.percent || 0)}%`,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    publishUpdateState({
      status: "downloaded",
      availableVersion: info.version,
      progress: 100,
      message: `KERN ${info.version} is ready to install.`,
    });
  });

  autoUpdater.on("error", (error) => {
    publishUpdateState({
      status: "error",
      progress: null,
      message: String(error?.message || "Update check failed.").slice(0, 500),
    });
  });
}

async function checkForDesktopUpdate() {
  if (!updaterSupported()) return publishUpdateState();
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    publishUpdateState({
      status: "error",
      progress: null,
      message: String(error?.message || "Update check failed.").slice(0, 500),
    });
  }
  return { ...updateState };
}

async function downloadDesktopUpdate() {
  if (!updaterSupported()) return publishUpdateState();
  if (updateState.status !== "available" && updateState.status !== "error") {
    return publishUpdateState();
  }
  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    publishUpdateState({
      status: "error",
      progress: null,
      message: String(error?.message || "Update download failed.").slice(0, 500),
    });
  }
  return { ...updateState };
}

function installDesktopUpdate() {
  if (!updaterSupported() || updateState.status !== "downloaded") {
    return { ok: false };
  }

  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return { ok: true };
}

app.setName("KERN");
app.setAppUserModelId(APP_ID);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function serverRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, "server");
  return path.join(app.getAppPath(), ".next", "standalone");
}

function appendServerLog(chunk) {
  if (!app.isPackaged) return;
  try {
    fs.appendFileSync(path.join(app.getPath("userData"), "server.log"), chunk);
  } catch {
    // Logging must never crash the desktop shell.
  }
}

async function waitForServer(url) {
  let lastError = null;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(`KERN server exited with code ${serverProcess.exitCode}.`);
    }

    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw lastError || new Error("KERN local server did not start.");
}

async function startServer() {
  const port = await findPort();
  const root = serverRoot();
  const entry = path.join(root, "server.js");

  if (!fs.existsSync(entry)) {
    throw new Error(`Desktop server bundle is missing: ${entry}`);
  }

  serverProcess = spawn(process.execPath, [entry], {
    cwd: root,
    env: {
      ...process.env,
      ...getServerConfig(),
      HOSTNAME: HOST,
      PORT: String(port),
      NODE_ENV: "production",
      KERN_DESKTOP: "1",
      ELECTRON_RUN_AS_NODE: "1",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout?.on("data", (data) => {
    if (!app.isPackaged) process.stdout.write(data);
    appendServerLog(data);
  });
  serverProcess.stderr?.on("data", (data) => {
    if (!app.isPackaged) process.stderr.write(data);
    appendServerLog(data);
  });

  serverUrl = `http://${HOST}:${port}`;
  await waitForServer(serverUrl);
  return serverUrl;
}

async function stopServer() {
  const processToStop = serverProcess;
  serverProcess = null;
  serverUrl = null;

  if (!processToStop || processToStop.killed) return;

  processToStop.kill();
  for (let i = 0; i < 20 && processToStop.exitCode === null; i += 1) {
    await delay(50);
  }

  if (processToStop.exitCode === null) processToStop.kill("SIGKILL");
}

function protectNavigation(window, localUrl) {
  const localOrigin = new URL(localUrl).origin;

  window.webContents.setWindowOpenHandler(({ url }) => {
    if ((url.startsWith("https://") || url.startsWith("http://")) && !url.startsWith(localOrigin)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).origin !== localOrigin) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });
}

async function createWindow() {
  const url = serverUrl || await startServer();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 620,
    show: false,
    backgroundColor: "#070707",
    autoHideMenuBar: true,
    title: "KERN",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });

  protectNavigation(mainWindow, url);
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(url);
}

async function restartServer() {
  await stopServer();
  const url = await startServer();

  if (mainWindow && !mainWindow.isDestroyed()) {
    protectNavigation(mainWindow, url);
    await mainWindow.loadURL(url);
  }

  return { ok: true };
}

ipcMain.handle("kern:update:get", () => ({ ...updateState }));
ipcMain.handle("kern:update:check", () => checkForDesktopUpdate());
ipcMain.handle("kern:update:download", () => downloadDesktopUpdate());
ipcMain.handle("kern:update:install", () => installDesktopUpdate());

ipcMain.handle("kern:notify", (_event, input = {}) => {
  if (!Notification.isSupported()) return { ok: false };
  const title = String(input.title || "KERN").slice(0, 160);
  const body = String(input.body || "").slice(0, 500);
  new Notification({ title, body }).show();
  return { ok: true };
});

ipcMain.handle("kern:config:get", () => getRendererConfig());
ipcMain.handle("kern:config:save", (_event, config) => saveRendererConfig(config));
ipcMain.handle("kern:config:open", async () => {
  await openConfigLocation();
  return { ok: true };
});
ipcMain.handle("kern:server:restart", () => restartServer());

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));

  try {
    configureUpdater();
    await startServer();
    await createWindow();

    if (updaterSupported()) {
      const firstCheck = setTimeout(() => void checkForDesktopUpdate(), 12_000);
      firstCheck.unref?.();

      const interval = setInterval(() => void checkForDesktopUpdate(), 6 * 60 * 60 * 1000);
      interval.unref?.();
    }
  } catch (error) {
    console.error(error);
    app.quit();
  }
});

app.on("window-all-closed", async () => {
  await stopServer();
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
