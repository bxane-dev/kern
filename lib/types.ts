export type Project = {
  id: number | string;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  branch: string;
  updatedAt: string;
  private: boolean;
};

export type Todo = {
  id: string;
  title: string;
  project: string;
  priority: "low" | "medium" | "high" | "critical";
  done: boolean;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AlertRecord = {
  id: string | number;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string | null;
  status: "open" | "acknowledged" | "resolved";
  fingerprint: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  resolvedAt: string | null;
};

export type IncidentRecord = {
  id: string;
  source: string;
  resource: string;
  status: "open" | "resolved";
  summary: string;
  metadata: Record<string, unknown>;
  startedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GitHubItem = {
  id: number | string;
  number?: number;
  title: string;
  url: string;
  repo: string;
  state: string;
  createdAt: string;
  author?: string;
  labels?: string[];
};

export type Deployment = {
  id: string;
  provider: "Vercel" | "Render";
  name: string;
  state: string;
  url?: string;
  branch?: string;
  commit?: string;
  createdAt: string;
};

export type LogLine = {
  id: string;
  level: "info" | "warn" | "error";
  message: string;
  source: string;
  createdAt: string;
};

export type Monitor = {
  id: string;
  name: string;
  url: string;
  status: "up" | "down";
  code?: number;
  latencyMs: number;
  checkedAt: string;
};

export type Activity = {
  id: string;
  type: "github" | "deployment" | "system";
  title: string;
  meta: string;
  createdAt: string;
  status?: string;
};

export type DashboardData = {
  generatedAt: string;
  owner: string;
  projects: Project[];
  issues: GitHubItem[];
  pullRequests: GitHubItem[];
  deployments: Deployment[];
  logs: LogLine[];
  monitors: Monitor[];
  activity: Activity[];
  alerts: AlertRecord[];
  integrations: {
    github: boolean;
    vercel: boolean;
    render: boolean;
    uptime: boolean;
    database: boolean;
  };
  writeActions: {
    locked: boolean;
    github: boolean;
    vercel: boolean;
    render: boolean;
  };
  warnings: string[];
};
