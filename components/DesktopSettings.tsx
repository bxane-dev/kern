"use client";

import { CheckCircle2, Download, FolderOpen, KeyRound, Loader2, MonitorCog, PackageCheck, RefreshCw, RotateCw, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const secretFields: Array<{ key: KernDesktopSecret; label: string; placeholder: string }> = [
  { key: "GITHUB_TOKEN", label: "GitHub token", placeholder: "github_pat_…" },
  { key: "VERCEL_TOKEN", label: "Vercel token", placeholder: "Vercel access token" },
  { key: "RENDER_API_KEY", label: "Render API key", placeholder: "Render API key" },
  { key: "KERN_PASSWORD", label: "KERN password", placeholder: "Local dashboard password" },
];

const initialValues: Record<KernDesktopValue, string> = {
  GITHUB_OWNER: "bxane-dev",
  VERCEL_TEAM_ID: "",
  VERCEL_PROJECT_ID: "",
  RENDER_SERVICE_ID: "",
  KERN_MONITORS: "",
};

export function DesktopSettings() {
  const bridge = typeof window !== "undefined" ? window.kernDesktop : undefined;
  const [config, setConfig] = useState<KernDesktopConfig | null>(null);
  const [values, setValues] = useState(initialValues);
  const [secrets, setSecrets] = useState<Partial<Record<KernDesktopSecret, string>>>({});
  const [clearSecrets, setClearSecrets] = useState<KernDesktopSecret[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [update, setUpdate] = useState<KernUpdateState | null>(null);
  const [updateBusy, setUpdateBusy] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    void bridge.getConfig().then((loaded) => {
      setConfig(loaded);
      setValues({ ...initialValues, ...loaded.values });
    });
    void bridge.getUpdateState().then(setUpdate);
    return bridge.onUpdateStatus(setUpdate);
  }, [bridge]);

  const changedSecretCount = useMemo(
    () => Object.values(secrets).filter((value) => Boolean(value)).length,
    [secrets],
  );

  if (!bridge) return null;
  const desktopBridge = bridge;

  async function saveAndRestart() {
    setSaving(true);
    setMessage("");

    try {
      const updated = await desktopBridge.saveConfig({ values, secrets, clearSecrets });
      setConfig(updated);
      setSecrets({});
      setClearSecrets([]);
      setMessage("Saved. Restarting KERN local services…");
      await desktopBridge.restartServer();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save desktop settings.");
      setSaving(false);
    }
  }

  async function updateAction(action: "check" | "download" | "install") {
    setUpdateBusy(true);
    try {
      if (action === "check") setUpdate(await desktopBridge.checkForUpdates());
      if (action === "download") setUpdate(await desktopBridge.downloadUpdate());
      if (action === "install") await desktopBridge.installUpdate();
    } finally {
      if (action !== "install") setUpdateBusy(false);
    }
  }

  function toggleClear(key: KernDesktopSecret) {
    setClearSecrets((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
    setSecrets((current) => ({ ...current, [key]: "" }));
  }

  return (
    <section className="panel desktop-config-panel">
      <div className="panel-head">
        <div>
          <h2>Desktop configuration</h2>
          <p>Stored locally for the installed KERN application</p>
        </div>
        <span className="desktop-badge"><MonitorCog size={13} /> DESKTOP</span>
      </div>

      <div className="desktop-update-card">
        <div className="desktop-update-main">
          <div className="desktop-update-icon">
            {update?.status === "downloaded" ? <PackageCheck size={18} /> : <RefreshCw size={18} />}
          </div>
          <div>
            <strong>KERN updates</strong>
            <p>{update?.message || "Loading updater status…"}</p>
            <span>
              Installed {update?.currentVersion || "—"}
              {update?.availableVersion ? ` · Available ${update.availableVersion}` : ""}
            </span>
          </div>
        </div>
        {update?.status === "downloading" && update.progress !== null ? (
          <div className="desktop-update-progress">
            <span style={{ width: `${update.progress}%` }} />
          </div>
        ) : null}
        <div className="desktop-update-actions">
          {update?.status === "available" ? (
            <button className="button primary" type="button" disabled={updateBusy} onClick={() => void updateAction("download")}>
              {updateBusy ? <Loader2 className="spin" size={14} /> : <Download size={14} />}Download
            </button>
          ) : update?.status === "downloaded" ? (
            <button className="button primary" type="button" onClick={() => void updateAction("install")}>
              <RotateCw size={14} />Restart & install
            </button>
          ) : (
            <button className="button" type="button" disabled={updateBusy || update?.status === "checking" || update?.status === "downloading" || update?.supported === false} onClick={() => void updateAction("check")}>
              {updateBusy || update?.status === "checking" ? <Loader2 className="spin" size={14} /> : <RefreshCw size={14} />}Check now
            </button>
          )}
        </div>
      </div>

      <div className="desktop-config-status">
        {config?.secureStorage ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
        <div>
          <strong>{config?.secureStorage ? "OS secret storage available" : "Secret-store encryption unavailable"}</strong>
          <p>
            {config?.secureStorage
              ? `Sensitive values use Electron safeStorage (${config.storageBackend}).`
              : "Sensitive values are protected by the local config file permissions only on this system."}
          </p>
        </div>
      </div>

      <div className="desktop-form-grid">
        <label>
          <span>GitHub owner</span>
          <input value={values.GITHUB_OWNER} onChange={(event) => setValues((current) => ({ ...current, GITHUB_OWNER: event.target.value }))} placeholder="bxane-dev" />
        </label>
        <label>
          <span>Vercel team ID</span>
          <input value={values.VERCEL_TEAM_ID} onChange={(event) => setValues((current) => ({ ...current, VERCEL_TEAM_ID: event.target.value }))} placeholder="team_…" />
        </label>
        <label>
          <span>Vercel project ID</span>
          <input value={values.VERCEL_PROJECT_ID} onChange={(event) => setValues((current) => ({ ...current, VERCEL_PROJECT_ID: event.target.value }))} placeholder="prj_…" />
        </label>
        <label>
          <span>Render service ID</span>
          <input value={values.RENDER_SERVICE_ID} onChange={(event) => setValues((current) => ({ ...current, RENDER_SERVICE_ID: event.target.value }))} placeholder="srv-…" />
        </label>
      </div>

      <div className="desktop-secret-grid">
        {secretFields.map((field) => {
          const hasSecret = Boolean(config?.hasSecrets[field.key]);
          const clearing = clearSecrets.includes(field.key);

          return (
            <div className="desktop-secret-field" key={field.key}>
              <label>
                <span><KeyRound size={12} />{field.label}</span>
                <input
                  type="password"
                  value={secrets[field.key] ?? ""}
                  disabled={clearing}
                  onChange={(event) => setSecrets((current) => ({ ...current, [field.key]: event.target.value }))}
                  placeholder={clearing ? "Will be removed" : hasSecret ? "Saved — leave blank to keep" : field.placeholder}
                />
              </label>
              {hasSecret ? (
                <button type="button" className={`secret-clear ${clearing ? "active" : ""}`} onClick={() => toggleClear(field.key)}>
                  {clearing ? "Keep saved value" : "Clear saved value"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <label className="desktop-monitor-field">
        <span>Uptime monitors</span>
        <textarea
          rows={3}
          value={values.KERN_MONITORS}
          onChange={(event) => setValues((current) => ({ ...current, KERN_MONITORS: event.target.value }))}
          placeholder="XAN|https://example.com;API|https://api.example.com/health"
        />
      </label>

      <div className="desktop-config-footer">
        <div>
          <button className="button" type="button" onClick={() => void desktopBridge.openConfigLocation()}>
            <FolderOpen size={15} />Config location
          </button>
          <span>{changedSecretCount ? `${changedSecretCount} secret change(s)` : config?.configPath}</span>
        </div>
        <button className="button primary" type="button" disabled={saving} onClick={() => void saveAndRestart()}>
          {saving ? <Loader2 className="spin" size={15} /> : <RotateCw size={15} />}
          Save & restart
        </button>
      </div>

      {message ? <p className="desktop-config-message">{message}</p> : null}
    </section>
  );
}
