const { app, BrowserWindow, Menu, ipcMain, session, shell } = require("electron");
const { spawn } = require("node:child_process");
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
    await startServer();
    await createWindow();
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
