"use client";

import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  Clock3,
  Database,
  ServerCrash,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AlertRecord, DashboardData, IncidentRecord } from "@/lib/types";

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const seconds = Math.max(0, Math.floor(diff / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function sendNotification(alert: AlertRecord) {
  const desktop = typeof window !== "undefined" ? window.kernDesktop : undefined;
  if (desktop?.notify) {
    await desktop.notify({ title: alert.title, body: alert.body || "KERN alert" });
    return;
  }

  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(alert.title, {
    body: alert.body || "KERN alert",
    tag: alert.fingerprint || String(alert.id),
  });
}

export function AlertsCenter({
  data,
  onRefresh,
}: {
  data: DashboardData;
  onRefresh: () => void;
}) {
  const [historyAlerts, setHistoryAlerts] = useState<AlertRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [historyConfigured, setHistoryConfigured] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "desktop" | "unsupported"
  >("unsupported");
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not load alert history.");
      setHistoryConfigured(Boolean(body.configured));
      setHistoryAlerts(Array.isArray(body.alerts) ? body.alerts : []);
      setIncidents(Array.isArray(body.incidents) ? body.incidents : []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load alert history.");
    }
  }, []);

  useEffect(() => {
    void loadHistory();

    const desktop = window.kernDesktop;
    if (desktop?.notify) {
      setNotificationPermission("desktop");
    } else if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [loadHistory]);

  useEffect(() => {
    if (!data.alerts.length) return;

    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem("kern.notified-alerts") || "[]");
    } catch {
      seen = [];
    }

    const seenSet = new Set(seen);
    const newAlerts = data.alerts.filter(
      (alert) => alert.severity !== "info" && !seenSet.has(alert.fingerprint || String(alert.id)),
    );

    if (!newAlerts.length) return;

    const canNotify =
      window.kernDesktop?.notify ||
      ("Notification" in window && Notification.permission === "granted");

    if (!canNotify) return;

    void Promise.all(newAlerts.slice(0, 3).map((alert) => sendNotification(alert)));

    for (const alert of newAlerts) seenSet.add(alert.fingerprint || String(alert.id));
    localStorage.setItem("kern.notified-alerts", JSON.stringify([...seenSet].slice(-200)));
  }, [data.alerts]);

  const visibleAlerts = useMemo(() => {
    if (historyConfigured && historyAlerts.length) return historyAlerts;
    return data.alerts;
  }, [data.alerts, historyAlerts, historyConfigured]);

  async function enableNotifications() {
    if (window.kernDesktop?.notify) {
      setNotificationPermission("desktop");
      return;
    }

    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  async function acknowledge(id: string | number) {
    try {
      const response = await fetch("/api/operations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not acknowledge alert.");
      await loadHistory();
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not acknowledge alert.");
    }
  }

  const openCount = visibleAlerts.filter((alert) => alert.status === "open").length;
  const criticalCount = visibleAlerts.filter(
    (alert) => alert.status === "open" && alert.severity === "critical",
  ).length;

  return (
    <>
      <div className="alert-summary-grid">
        <div className="alert-summary-card">
          <AlertTriangle size={18} />
          <div><strong>{openCount}</strong><span>Open alerts</span></div>
        </div>
        <div className="alert-summary-card critical">
          <ServerCrash size={18} />
          <div><strong>{criticalCount}</strong><span>Critical</span></div>
        </div>
        <div className="alert-summary-card">
          <Clock3 size={18} />
          <div><strong>{incidents.filter((item) => item.status === "open").length}</strong><span>Open incidents</span></div>
        </div>
        <div className="alert-summary-card">
          <Database size={18} />
          <div><strong>{historyConfigured ? "ON" : "LIVE"}</strong><span>{historyConfigured ? "History saved" : "Live detection"}</span></div>
        </div>
      </div>

      <div className="notification-strip">
        <div>
          {notificationPermission === "granted" || notificationPermission === "desktop"
            ? <BellRing size={17} />
            : <Bell size={17} />}
          <div>
            <strong>System notifications</strong>
            <p>
              {notificationPermission === "desktop"
                ? "Native KERN desktop notifications are enabled."
                : notificationPermission === "granted"
                  ? "Browser notifications are enabled."
                  : "Enable notifications for new critical and warning alerts."}
            </p>
          </div>
        </div>
        {notificationPermission !== "desktop" && notificationPermission !== "granted" ? (
          <button className="button" onClick={() => void enableNotifications()}>
            <Bell size={14} />Enable
          </button>
        ) : <span className="notification-enabled"><Check size={13} />ENABLED</span>}
      </div>

      {error ? <div className="alert warn"><AlertTriangle size={16} />{error}</div> : null}

      <div className="alerts-layout">
        <section className="panel">
          <div className="panel-head">
            <div><h2>Alerts</h2><p>Detected from real monitor and deployment state</p></div>
          </div>
          <div className="ops-list">
            {visibleAlerts.length ? visibleAlerts.map((alert) => (
              <div className={`ops-alert ${alert.severity} ${alert.status}`} key={alert.id}>
                <div className="ops-alert-icon">
                  {alert.status === "resolved" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                </div>
                <div className="ops-alert-copy">
                  <div>
                    <strong>{alert.title}</strong>
                    <span className={`severity-badge ${alert.severity}`}>{alert.severity}</span>
                    {alert.status !== "open" ? <span className="severity-badge neutral">{alert.status}</span> : null}
                  </div>
                  <p>{alert.body || "No additional details."}</p>
                  <em>{alert.kind} · {timeAgo(alert.createdAt)}</em>
                </div>
                {historyConfigured && alert.status === "open" ? (
                  <button className="button" onClick={() => void acknowledge(alert.id)}>
                    <Check size={13} />Ack
                  </button>
                ) : null}
              </div>
            )) : <div className="empty">No active operational alerts.</div>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><h2>Incident history</h2><p>{historyConfigured ? "Persistent Supabase timeline" : "Connect Supabase to retain history"}</p></div>
          </div>
          <div className="incident-list">
            {incidents.length ? incidents.map((incident) => (
              <div className="incident-row" key={incident.id}>
                <span className={`incident-state ${incident.status}`} />
                <div>
                  <strong>{incident.summary}</strong>
                  <p>{incident.source} · {incident.resource}</p>
                </div>
                <div>
                  <span>{incident.status}</span>
                  <em>{timeAgo(incident.startedAt)}</em>
                </div>
              </div>
            )) : <div className="empty">{historyConfigured ? "No incidents recorded." : "Persistent incident history is not configured."}</div>}
          </div>
        </section>
      </div>
    </>
  );
}
