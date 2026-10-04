import type {
  Activity,
  DashboardData,
  Deployment,
  GitHubItem,
  LogLine,
  Monitor,
  Project,
} from "@/lib/types";

const owner = process.env.GITHUB_OWNER || "bxane-dev";

const githubHeaders: HeadersInit = {
  Accept: "application/vnd.github+json",
  "User-Agent": "KERN-Command-Center",
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};

async function jsonFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

function repoName(url?: string) {
  if (!url) return "unknown";
  const match = url.match(/repos\/([^/]+\/[^/]+)/);
  return match?.[1] ?? "unknown";
}

async function getGitHub() {
  const warnings: string[] = [];

  try {
    const [repos, issueSearch, prSearch, events] = await Promise.all([
      jsonFetch<any[]>(
        `https://api.github.com/users/${encodeURIComponent(owner)}/repos?per_page=50&sort=updated`,
        { headers: githubHeaders },
      ),
      jsonFetch<any>(
        `https://api.github.com/search/issues?q=${encodeURIComponent(`user:${owner} is:issue is:open`)}&per_page=30&sort=updated`,
        { headers: githubHeaders },
      ),
      jsonFetch<any>(
        `https://api.github.com/search/issues?q=${encodeURIComponent(`user:${owner} is:pr is:open`)}&per_page=30&sort=updated`,
        { headers: githubHeaders },
      ),
      jsonFetch<any[]>(
        `https://api.github.com/users/${encodeURIComponent(owner)}/events/public?per_page=30`,
        { headers: githubHeaders },
      ),
    ]);

    const projects: Project[] = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count ?? 0,
      forks: repo.forks_count ?? 0,
      openIssues: repo.open_issues_count ?? 0,
      branch: repo.default_branch ?? "main",
      updatedAt: repo.updated_at,
      private: Boolean(repo.private),
    }));

    const normalizeSearch = (items: any[]): GitHubItem[] =>
      items.map((item) => ({
        id: item.id,
        number: item.number,
        title: item.title,
        url: item.html_url,
        repo: repoName(item.repository_url),
        state: item.state,
        createdAt: item.updated_at ?? item.created_at,
        author: item.user?.login,
        labels: (item.labels ?? []).map((label: any) => label.name),
      }));

    const activity: Activity[] = events.slice(0, 20).map((event) => {
      const repo = event.repo?.name ?? "GitHub";
      const type = String(event.type ?? "Event").replace(/Event$/, "");
      const branch = event.payload?.ref?.replace("refs/heads/", "");
      const count = event.payload?.commits?.length;
      const detail =
        type === "Push"
          ? `${count ?? 0} commit${count === 1 ? "" : "s"}${branch ? ` → ${branch}` : ""}`
          : event.payload?.action ?? "activity";
      return {
        id: `gh-${event.id}`,
        type: "github" as const,
        title: `${type} · ${repo}`,
        meta: detail,
        createdAt: event.created_at,
      };
    });

    return {
      projects,
      issues: normalizeSearch(issueSearch.items ?? []),
      pullRequests: normalizeSearch(prSearch.items ?? []),
      activity,
      warnings,
    };
  } catch (error) {
    warnings.push(`GitHub: ${error instanceof Error ? error.message : "request failed"}`);
    return {
      projects: [] as Project[],
      issues: [] as GitHubItem[],
      pullRequests: [] as GitHubItem[],
      activity: [] as Activity[],
      warnings,
    };
  }
}

async function getVercel() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) return { deployments: [] as Deployment[], logs: [] as LogLine[], warning: null };

  try {
    const params = new URLSearchParams({ limit: "10" });
    if (process.env.VERCEL_PROJECT_ID) params.set("projectId", process.env.VERCEL_PROJECT_ID);
    if (process.env.VERCEL_TEAM_ID) params.set("teamId", process.env.VERCEL_TEAM_ID);

    const data = await jsonFetch<any>(
      `https://api.vercel.com/v6/deployments?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const deployments: Deployment[] = (data.deployments ?? []).map((item: any) => ({
      id: String(item.uid ?? item.id),
      provider: "Vercel" as const,
      name: item.name ?? item.projectId ?? "Vercel deployment",
      state: item.state ?? item.readyState ?? "UNKNOWN",
      url: item.url ? `https://${item.url}` : undefined,
      branch: item.meta?.githubCommitRef,
      commit: item.meta?.githubCommitSha,
      createdAt: new Date(item.createdAt ?? item.created ?? Date.now()).toISOString(),
    }));

    const latest = deployments[0];
    let logs: LogLine[] = [];
    if (latest?.id) {
      try {
        const events = await jsonFetch<any[]>(
          `https://api.vercel.com/v3/deployments/${encodeURIComponent(latest.id)}/events?direction=backward&limit=60`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        logs = (events ?? [])
          .filter((event) => event?.payload?.text || event?.payload?.info?.name)
          .slice(0, 50)
          .map((event, index) => {
            const type = String(event.type ?? "stdout");
            return {
              id: `vercel-${index}-${event.created ?? Date.now()}`,
              level: type === "fatal" || type === "stderr" ? "error" : "info",
              message: event.payload?.text ?? event.payload?.info?.name ?? type,
              source: "Vercel",
              createdAt: new Date(event.created ?? Date.now()).toISOString(),
            } satisfies LogLine;
          });
      } catch {
        // Deployment listing still works even when build-event access is unavailable.
      }
    }

    return { deployments, logs, warning: null };
  } catch (error) {
    return {
      deployments: [] as Deployment[],
      logs: [] as LogLine[],
      warning: `Vercel: ${error instanceof Error ? error.message : "request failed"}`,
    };
  }
}

async function getRender() {
  const token = process.env.RENDER_API_KEY;
  const serviceId = process.env.RENDER_SERVICE_ID;
  if (!token || !serviceId) return { deployments: [] as Deployment[], warning: null };

  try {
    const data = await jsonFetch<any[]>(
      `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys?limit=10`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const deployments: Deployment[] = (data ?? []).map((entry: any) => {
      const item = entry.deploy ?? entry;
      return {
        id: String(item.id),
        provider: "Render" as const,
        name: item.serviceId ?? serviceId,
        state: item.status ?? "unknown",
        commit: item.commit?.id,
        createdAt: item.createdAt ?? item.updatedAt ?? new Date().toISOString(),
      };
    });

    return { deployments, warning: null };
  } catch (error) {
    return {
      deployments: [] as Deployment[],
      warning: `Render: ${error instanceof Error ? error.message : "request failed"}`,
    };
  }
}

function configuredMonitors() {
  const raw = process.env.KERN_MONITORS?.trim();
  if (!raw) return [];
  return raw
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const separator = item.indexOf("|");
      if (separator < 1) return null;
      const name = item.slice(0, separator).trim();
      const url = item.slice(separator + 1).trim();
      try {
        new URL(url);
        return { id: `monitor-${index}`, name, url };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { id: string; name: string; url: string }[];
}

async function checkMonitors(): Promise<Monitor[]> {
  return Promise.all(
    configuredMonitors().map(async (monitor) => {
      const started = performance.now();
      try {
        const response = await fetch(monitor.url, {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
          redirect: "follow",
        });
        return {
          ...monitor,
          status: response.ok ? ("up" as const) : ("down" as const),
          code: response.status,
          latencyMs: Math.round(performance.now() - started),
          checkedAt: new Date().toISOString(),
        };
      } catch {
        return {
          ...monitor,
          status: "down" as const,
          latencyMs: Math.round(performance.now() - started),
          checkedAt: new Date().toISOString(),
        };
      }
    }),
  );
}

export async function getDashboardData(): Promise<DashboardData> {
  const [github, vercel, render, monitors] = await Promise.all([
    getGitHub(),
    getVercel(),
    getRender(),
    checkMonitors(),
  ]);

  const deployments = [...vercel.deployments, ...render.deployments].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );

  const deploymentActivity: Activity[] = deployments.slice(0, 15).map((deploy) => ({
    id: `deploy-${deploy.provider}-${deploy.id}`,
    type: "deployment",
    title: `${deploy.provider} · ${deploy.name}`,
    meta: deploy.branch ? `${deploy.state} · ${deploy.branch}` : deploy.state,
    createdAt: deploy.createdAt,
    status: deploy.state,
  }));

  const activity = [...github.activity, ...deploymentActivity]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 30);

  const warnings = [
    ...github.warnings,
    vercel.warning,
    render.warning,
  ].filter(Boolean) as string[];

  return {
    generatedAt: new Date().toISOString(),
    owner,
    projects: github.projects,
    issues: github.issues,
    pullRequests: github.pullRequests,
    deployments,
    logs: vercel.logs,
    monitors,
    activity,
    integrations: {
      github: true,
      vercel: Boolean(process.env.VERCEL_TOKEN),
      render: Boolean(process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID),
      uptime: monitors.length > 0,
    },
    writeActions: {
      locked: !Boolean(process.env.KERN_PASSWORD),
      github: Boolean(process.env.GITHUB_TOKEN),
      vercel: Boolean(process.env.VERCEL_TOKEN),
      render: Boolean(process.env.RENDER_API_KEY && process.env.RENDER_SERVICE_ID),
    },
    warnings,
  };
}
