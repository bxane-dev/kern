import type { AlertRecord, DashboardData, Deployment, Monitor } from "@/lib/types";

function failedState(state: string) {
  const value = state.toLowerCase();
  return ["failed", "error", "canceled", "cancelled"].some((item) => value.includes(item));
}

function pendingState(state: string) {
  const value = state.toLowerCase();
  return ["building", "queued", "created", "progress", "pending"].some((item) => value.includes(item));
}

export function deriveOperationalAlerts(input: {
  monitors: Monitor[];
  deployments: Deployment[];
}): AlertRecord[] {
  const now = new Date().toISOString();
  const alerts: AlertRecord[] = [];

  const latencyThreshold = Math.max(
    100,
    Number.parseInt(process.env.KERN_LATENCY_WARN_MS || "1500", 10) || 1500,
  );

  for (const monitor of input.monitors) {
    if (monitor.status === "down") {
      alerts.push({
        id: `live-monitor-down-${monitor.id}`,
        kind: "uptime",
        severity: "critical",
        title: `${monitor.name} is down`,
        body: monitor.code
          ? `${monitor.url} returned HTTP ${monitor.code} in ${monitor.latencyMs} ms.`
          : `${monitor.url} could not be reached after ${monitor.latencyMs} ms.`,
        status: "open",
        fingerprint: `monitor:down:${monitor.url}`,
        metadata: {
          monitorId: monitor.id,
          url: monitor.url,
          code: monitor.code ?? null,
          latencyMs: monitor.latencyMs,
        },
        createdAt: monitor.checkedAt || now,
        resolvedAt: null,
      });
    } else if (monitor.latencyMs >= latencyThreshold) {
      alerts.push({
        id: `live-monitor-latency-${monitor.id}`,
        kind: "latency",
        severity: "warning",
        title: `${monitor.name} is responding slowly`,
        body: `${monitor.latencyMs} ms response time exceeds the ${latencyThreshold} ms threshold.`,
        status: "open",
        fingerprint: `monitor:latency:${monitor.url}`,
        metadata: {
          monitorId: monitor.id,
          url: monitor.url,
          latencyMs: monitor.latencyMs,
          thresholdMs: latencyThreshold,
        },
        createdAt: monitor.checkedAt || now,
        resolvedAt: null,
      });
    }
  }

  const latest = new Map<string, Deployment>();
  for (const deployment of input.deployments) {
    const key = `${deployment.provider}:${deployment.name}`;
    if (!latest.has(key)) latest.set(key, deployment);
  }

  for (const deployment of latest.values()) {
    if (!failedState(deployment.state)) continue;

    alerts.push({
      id: `live-deploy-${deployment.provider}-${deployment.id}`,
      kind: "deployment",
      severity: "critical",
      title: `${deployment.name} deployment failed`,
      body: `${deployment.provider} reported “${deployment.state}”${deployment.branch ? ` on ${deployment.branch}` : ""}.`,
      status: "open",
      fingerprint: `deployment:failed:${deployment.provider}:${deployment.name}`,
      metadata: {
        provider: deployment.provider,
        deploymentId: deployment.id,
        branch: deployment.branch ?? null,
        commit: deployment.commit ?? null,
        url: deployment.url ?? null,
      },
      createdAt: deployment.createdAt,
      resolvedAt: null,
    });
  }

  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 } as const;
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return +new Date(b.createdAt) - +new Date(a.createdAt);
  });
}

export function deploymentStillPending(deployment: Deployment) {
  return pendingState(deployment.state);
}
