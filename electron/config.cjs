const fs = require("node:fs");
const path = require("node:path");
const { app, safeStorage, shell } = require("electron");

const SECRET_KEYS = ["GITHUB_TOKEN", "VERCEL_TOKEN", "RENDER_API_KEY", "SUPABASE_SECRET_KEY", "KERN_PASSWORD"];
const VALUE_KEYS = [
  "GITHUB_OWNER",
  "VERCEL_TEAM_ID",
  "VERCEL_PROJECT_ID",
  "RENDER_SERVICE_ID",
  "SUPABASE_URL",
  "KERN_MONITORS",
];

function getConfigPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function readRaw() {
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), "utf8"));
  } catch {
    return { values: {}, secrets: {} };
  }
}

function encryptSecret(value) {
  if (safeStorage.isEncryptionAvailable()) {
    return "enc:" + safeStorage.encryptString(value).toString("base64");
  }
  return "plain:" + Buffer.from(value, "utf8").toString("base64");
}

function decryptSecret(value) {
  if (typeof value !== "string" || !value) return "";

  if (value.startsWith("enc:")) {
    try {
      if (!safeStorage.isEncryptionAvailable()) return "";
      return safeStorage.decryptString(Buffer.from(value.slice(4), "base64"));
    } catch {
      return "";
    }
  }

  if (value.startsWith("plain:")) {
    try {
      return Buffer.from(value.slice(6), "base64").toString("utf8");
    } catch {
      return "";
    }
  }

  return "";
}

function storageBackend() {
  if (!safeStorage.isEncryptionAvailable()) return "file-permissions-only";
  if (process.platform === "linux" && typeof safeStorage.getSelectedStorageBackend === "function") {
    return safeStorage.getSelectedStorageBackend();
  }
  return "os-encrypted";
}

function getServerConfig() {
  const raw = readRaw();
  const output = {};

  for (const key of VALUE_KEYS) {
    const value = raw.values?.[key];
    if (typeof value === "string" && value.trim()) output[key] = value.trim();
  }

  for (const key of SECRET_KEYS) {
    const value = decryptSecret(raw.secrets?.[key]);
    if (value) output[key] = value;
  }

  return output;
}

function getRendererConfig() {
  const raw = readRaw();
  const values = {};

  for (const key of VALUE_KEYS) {
    values[key] = typeof raw.values?.[key] === "string" ? raw.values[key] : "";
  }

  const hasSecrets = {};
  for (const key of SECRET_KEYS) {
    hasSecrets[key] = Boolean(decryptSecret(raw.secrets?.[key]) || process.env[key]);
  }

  return {
    values,
    hasSecrets,
    secureStorage: safeStorage.isEncryptionAvailable(),
    storageBackend: storageBackend(),
    configPath: getConfigPath(),
  };
}

function saveRendererConfig(input = {}) {
  const raw = readRaw();
  raw.values = raw.values || {};
  raw.secrets = raw.secrets || {};

  for (const key of VALUE_KEYS) {
    const incoming = input.values?.[key];
    if (typeof incoming !== "string") continue;
    const value = incoming.trim();
    if (value) raw.values[key] = value;
    else delete raw.values[key];
  }

  for (const key of SECRET_KEYS) {
    const incoming = input.secrets?.[key];
    if (typeof incoming === "string" && incoming.length > 0) {
      raw.secrets[key] = encryptSecret(incoming);
    }
  }

  for (const key of input.clearSecrets || []) {
    if (SECRET_KEYS.includes(key)) delete raw.secrets[key];
  }

  const file = getConfigPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(raw, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });

  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows ACLs are managed by the OS; chmod can be a no-op there.
  }

  return getRendererConfig();
}

async function openConfigLocation() {
  const file = getConfigPath();
  if (fs.existsSync(file)) {
    shell.showItemInFolder(file);
    return;
  }
  await shell.openPath(app.getPath("userData"));
}

module.exports = {
  getRendererConfig,
  getServerConfig,
  openConfigLocation,
  saveRendererConfig,
};
