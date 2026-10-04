"use client";

import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Cloud,
  Code2,
  Command,
  ExternalLink,
  Gauge,
  GitBranch,
  GitPullRequest,
  LayoutDashboard,
  ListTodo,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  Server,
  Settings,
  Star,
  Terminal,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { DashboardData, Deployment, GitHubItem, Monitor, Project } from "@/lib/types";

type Tab =
  | "overview"
  | "projects"
  | "github"
  | "deployments"
  | "logs"
  | "uptime"
  | "issues"
  | "tasks"
  | "settings";

type Todo = {
  id: string;
  title: string;
  project: string;
  priority: "low" | "medium" | "high" | "critical";
  done: boolean;
};

const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "projects", label: "Projects", icon: Code2 },
  { id: "github", label: "GitHub", icon: GitBranch },
  { id: "deployments", label: "Deployments", icon: Rocket },
  { id: "logs", label: "Logs", icon: Terminal },
  { id: "uptime", label: "Uptime", icon: Gauge },
  { id: "issues", label: "Issues", icon: CircleDot },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return "—";
  const seconds = Math.max(0, Math.floor(diff / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function stateTone(state: string) {
  const value = state.toLowerCase();
  if (["ready", "live", "succeeded", "success", "deployed", "up"].some((x) => value.includes(x))) return "ok";
  if (["failed", "error", "canceled", "cancelled", "down"].some((x) => value.includes(x))) return "bad";
  if (["building", "queued", "created", "progress", "pending"].some((x) => value.includes(x))) return "warn";
  return "neutral";
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

function StatusDot({ tone }: { tone: "ok" | "bad" | "warn" | "neutral" }) {
  return <span className={`status-dot ${tone}`} />;
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <a className="project-card" href={project.url} target="_blank" rel="noreferrer">
      <div className="project-top">
        <div className="project-avatar">{project.name.slice(0, 2).toUpperCase()}</div>
        <ExternalLink size={15} className="muted-icon" />
      </div>
      <h3>{project.name}</h3>
      <p>{project.description || "No repository description."}</p>
      <div className="project-tags">
        <span><GitBranch size={13} />{project.branch}</span>
        {project.language ? <span>{project.language}</span> : null}
      </div>
      <div className="project-meta">
        <span><Star size={13} />{project.stars}</span>
        <span><CircleDot size={13} />{project.openIssues}</span>
        <span>{timeAgo(project.updatedAt)}</span>
      </div>
    </a>
  );
}

function DeploymentRow({ deployment }: { deployment: Deployment }) {
  const tone = stateTone(deployment.state);
  return (
    <div className="row deployment-row">
      <div className="row-leading">
        <div className={`provider-icon ${deployment.provider.toLowerCase()}`}>
          {deployment.provider === "Vercel" ? <Zap size={15} /> : <Cloud size={15} />}
        </div>
        <div>
          <strong>{deployment.name}</strong>
          <p>{deployment.provider}{deployment.branch ? ` · ${deployment.branch}` : ""}</p>
        </div>
      </div>
      <div className="row-end">
        <span className={`status-pill ${tone}`}><StatusDot tone={tone} />{deployment.state}</span>
        <span className="row-time">{timeAgo(deployment.createdAt)}</span>
        {deployment.url ? (
          <a className="icon-button" href={deployment.url} target="_blank" rel="noreferrer" aria-label="Open deployment">
            <ExternalLink size={15} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function IssueRow({ item, kind = "issue" }: { item: GitHubItem; kind?: "issue" | "pr" }) {
  return (
    <a className="row issue-row" href={item.url} target="_blank" rel="noreferrer">
      <div className="row-leading">
        <div className="small-icon">{kind === "pr" ? <GitPullRequest size={15} /> : <CircleDot size={15} />}</div>
        <div>
          <strong>{item.title}</strong>
          <p>{item.repo}{item.number ? ` #${item.number}` : ""} · {item.author ?? "unknown"}</p>
        </div>
      </div>
      <div className="issue-labels">
        {(item.labels ?? []).slice(0, 2).map((label) => <span key={label}>{label}</span>)}
        <span className="row-time">{timeAgo(item.createdAt)}</span>
        <ChevronRight size={15} />
      </div>
    </a>
  );
}

function MonitorCard({ monitor }: { monitor: Monitor }) {
  return (
    <div className="monitor-card">
      <div className="monitor-head">
        <div className="row-leading">
          {monitor.status === "up" ? <CheckCircle2 className="success-text" size={18} /> : <XCircle className="danger-text" size={18} />}
          <div>
            <strong>{monitor.name}</strong>
            <p>{monitor.url}</p>
          </div>
        </div>
        <span className={`status-pill ${monitor.status === "up" ? "ok" : "bad"}`}>
          {monitor.status === "up" ? "Operational" : "Down"}
        </span>
      </div>
      <div className="monitor-stats">
        <div><span>Latency</span><strong>{monitor.latencyMs} ms</strong></div>
        <div><span>HTTP</span><strong>{monitor.code ?? "—"}</strong></div>
        <div><span>Checked</span><strong>{timeAgo(monitor.checkedAt)}</strong></div>
      </div>
    </div>
  );
}

export function KernDashboard() {
  const [active, setActive] = useState<Tab>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [palette, setPalette] = useState(false);
  const [search, setSearch] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      if (response.status === 401) {
        window.location.reload();
        return;
      }
      if (!response.ok) throw new Error("Dashboard API request failed");
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load KERN");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("kern.todos");
      if (stored) setTodos(JSON.parse(stored));
    } catch {
      // Local TODO storage is optional.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("kern.todos", JSON.stringify(todos));
  }, [todos]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((value) => !value);
      }
      if (event.key === "Escape") setPalette(false);
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  const filteredCommands = useMemo(() => {
    const q = search.toLowerCase().trim();
    return nav.filter((item) => !q || item.label.toLowerCase().includes(q));
  }, [search]);

  const failedDeployments = data?.deployments.filter((item) => stateTone(item.state) === "bad").length ?? 0;
  const downMonitors = data?.monitors.filter((item) => item.status === "down").length ?? 0;
  const activeTodos = todos.filter((item) => !item.done).length;

  function addTodo() {
    const title = newTodo.trim();
    if (!title) return;
    setTodos((current) => [
      {
        id: crypto.randomUUID(),
        title,
        project: "KERN",
        priority: "medium",
        done: false,
      },
      ...current,
    ]);
    setNewTodo("");
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.reload();
  }

  if (loading) {
    return (
      <main className="boot-screen">
        <div className="brand-mark large"><Command size={23} /></div>
        <div>
          <h1>KERN</h1>
          <p><Loader2 className="spin" size={15} /> Initializing command center</p>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Command size={17} /></div>
          <div>
            <strong>KERN</strong>
            <span>COMMAND CENTER</span>
          </div>
        </div>
        <nav>
          <span className="nav-section">WORKSPACE</span>
          {nav.slice(0, 8).map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}>
                <Icon size={16} />
                {item.label}
                {item.id === "issues" && data?.issues.length ? <em>{data.issues.length}</em> : null}
                {item.id === "tasks" && activeTodos ? <em>{activeTodos}</em> : null}
              </button>
            );
          })}
          <span className="nav-section lower">SYSTEM</span>
          {nav.slice(8).map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}>
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className="command-key" onClick={() => setPalette(true)}>
            <Command size={14} /><span>Quick command</span><kbd>Ctrl K</kbd>
          </button>
          <div className="account">
            <div className="account-avatar">{(data?.owner ?? "B").slice(0, 1).toUpperCase()}</div>
            <div><strong>{data?.owner ?? "developer"}</strong><span>GitHub workspace</span></div>
            <button onClick={logout} aria-label="Log out"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="breadcrumbs">KERN <ChevronRight size={13} /> <span>{nav.find((item) => item.id === active)?.label}</span></p>
            <h1>{nav.find((item) => item.id === active)?.label}</h1>
          </div>
          <div className="top-actions">
            <div className="live-state"><span className="pulse" />LIVE</div>
            <button className="button" onClick={() => void load(true)} disabled={refreshing}>
              <RefreshCw className={refreshing ? "spin" : ""} size={15} />
              Refresh
            </button>
            <button className="button command-button" onClick={() => setPalette(true)}><Command size={15} />K</button>
          </div>
        </header>

        <div className="content">
          {error ? <div className="alert bad"><AlertTriangle size={16} />{error}</div> : null}
          {data?.warnings.map((warning) => <div className="alert warn" key={warning}><AlertTriangle size={16} />{warning}</div>)}

          {active === "overview" && data ? (
            <>
              <div className="hero-line">
                <div>
                  <p className="eyebrow">SYSTEM OVERVIEW</p>
                  <h2>Good evening, {data.owner}.</h2>
                  <p>Here is the current state of your development stack.</p>
                </div>
                <span>Updated {timeAgo(data.generatedAt)}</span>
              </div>

              <div className="stats-grid">
                <Stat label="PROJECTS" value={data.projects.length} detail="GitHub repositories" icon={<Code2 size={18} />} />
                <Stat label="DEPLOYMENTS" value={data.deployments.length} detail={failedDeployments ? `${failedDeployments} need attention` : "No failures loaded"} icon={<Rocket size={18} />} />
                <Stat label="OPEN ISSUES" value={data.issues.length} detail={`${data.pullRequests.length} open pull requests`} icon={<CircleDot size={18} />} />
                <Stat label="UPTIME" value={data.monitors.length ? `${data.monitors.length - downMonitors}/${data.monitors.length}` : "—"} detail={data.monitors.length ? (downMonitors ? "Service degraded" : "All monitors healthy") : "Configure monitors"} icon={<Gauge size={18} />} />
              </div>

              <div className="dashboard-grid">
                <Panel title="Recent activity" subtitle="GitHub and deployment events" className="span-2">
                  <div className="feed">
                    {data.activity.length ? data.activity.slice(0, 10).map((event) => (
                      <div className="feed-item" key={event.id}>
                        <div className={`feed-dot ${event.type}`} />
                        <div className="feed-copy">
                          <strong>{event.title}</strong>
                          <p>{event.meta}</p>
                        </div>
                        <span>{timeAgo(event.createdAt)}</span>
                      </div>
                    )) : <Empty>No recent activity available.</Empty>}
                  </div>
                </Panel>
                <Panel title="System status" subtitle="Connected providers">
                  <div className="integration-list">
                    {[
                      ["GitHub", data.integrations.github],
                      ["Vercel", data.integrations.vercel],
                      ["Render", data.integrations.render],
                      ["Uptime monitors", data.integrations.uptime],
                    ].map(([name, connected]) => (
                      <div key={String(name)}>
                        <span><StatusDot tone={connected ? "ok" : "neutral"} />{String(name)}</span>
                        <em>{connected ? "Connected" : "Not configured"}</em>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <div className="dashboard-grid">
                <Panel title="Projects" subtitle="Recently updated repositories" className="span-2" action={<button className="text-button" onClick={() => setActive("projects")}>View all <ChevronRight size={14} /></button>}>
                  <div className="mini-projects">
                    {data.projects.slice(0, 4).map((project) => (
                      <a key={project.id} href={project.url} target="_blank" rel="noreferrer">
                        <div className="project-avatar small">{project.name.slice(0, 2).toUpperCase()}</div>
                        <div><strong>{project.name}</strong><span>{project.language ?? "Repository"} · {timeAgo(project.updatedAt)}</span></div>
                        <ChevronRight size={15} />
                      </a>
                    ))}
                  </div>
                </Panel>
                <Panel title="Attention" subtitle="What needs action">
                  <div className="attention">
                    <div><AlertTriangle size={16} /><span><strong>{failedDeployments}</strong> failed deployments</span></div>
                    <div><CircleDot size={16} /><span><strong>{data.issues.length}</strong> open issues</span></div>
                    <div><ListTodo size={16} /><span><strong>{activeTodos}</strong> active tasks</span></div>
                    <div><Gauge size={16} /><span><strong>{downMonitors}</strong> monitors down</span></div>
                  </div>
                </Panel>
              </div>
            </>
          ) : null}

          {active === "projects" && data ? (
            <>
              <div className="section-intro"><div><p className="eyebrow">REPOSITORIES</p><h2>{data.owner} projects</h2></div><span>{data.projects.length} repositories</span></div>
              <div className="project-grid">
                {data.projects.length ? data.projects.map((project) => <ProjectCard project={project} key={project.id} />) : <Empty>No repositories returned by GitHub.</Empty>}
              </div>
            </>
          ) : null}

          {active === "github" && data ? (
            <div className="dashboard-grid">
              <Panel title="Open pull requests" subtitle="Across your repositories" className="span-2">
                <div className="rows">{data.pullRequests.length ? data.pullRequests.map((item) => <IssueRow item={item} kind="pr" key={item.id} />) : <Empty>No open pull requests.</Empty>}</div>
              </Panel>
              <Panel title="GitHub snapshot" subtitle={data.owner}>
                <div className="big-metric"><strong>{data.projects.length}</strong><span>repositories</span></div>
                <div className="split-metrics"><div><strong>{data.issues.length}</strong><span>issues</span></div><div><strong>{data.pullRequests.length}</strong><span>PRs</span></div></div>
                <a className="button wide" href={`https://github.com/${data.owner}`} target="_blank" rel="noreferrer"><GitBranch size={15} />Open GitHub <ExternalLink size={13} /></a>
              </Panel>
              <Panel title="Open issues" subtitle="Recently updated" className="span-3">
                <div className="rows">{data.issues.slice(0, 12).map((item) => <IssueRow item={item} key={item.id} />)}</div>
              </Panel>
            </div>
          ) : null}

          {active === "deployments" && data ? (
            <Panel title="Deployment timeline" subtitle="Vercel + Render">
              <div className="rows">{data.deployments.length ? data.deployments.map((deployment) => <DeploymentRow deployment={deployment} key={`${deployment.provider}-${deployment.id}`} />) : <Empty>Add VERCEL_TOKEN or RENDER_API_KEY to load deployment history.</Empty>}</div>
            </Panel>
          ) : null}

          {active === "logs" && data ? (
            <Panel title="Live build logs" subtitle="Latest Vercel deployment events">
              <div className="terminal">
                <div className="terminal-top"><span /><span /><span /><em>kern://logs</em></div>
                <div className="terminal-body">
                  {data.logs.length ? data.logs.map((line) => (
                    <div className={`log-line ${line.level}`} key={line.id}>
                      <time>{new Date(line.createdAt).toLocaleTimeString()}</time>
                      <span>{line.level.toUpperCase()}</span>
                      <em>{line.source}</em>
                      <code>{line.message}</code>
                    </div>
                  )) : <p className="terminal-empty">No logs loaded. Connect Vercel to stream the latest deployment build events.</p>}
                </div>
              </div>
            </Panel>
          ) : null}

          {active === "uptime" && data ? (
            <>
              <div className="section-intro"><div><p className="eyebrow">HEALTH CHECKS</p><h2>Service uptime</h2></div><span>Checked on refresh</span></div>
              <div className="monitor-grid">
                {data.monitors.length ? data.monitors.map((monitor) => <MonitorCard monitor={monitor} key={monitor.id} />) : <Empty>Configure KERN_MONITORS to start checking your sites and APIs.</Empty>}
              </div>
            </>
          ) : null}

          {active === "issues" && data ? (
            <Panel title="Issue center" subtitle={`${data.issues.length} open issues across ${data.projects.length} repositories`}>
              <div className="rows">{data.issues.length ? data.issues.map((item) => <IssueRow item={item} key={item.id} />) : <Empty>No open issues.</Empty>}</div>
            </Panel>
          ) : null}

          {active === "tasks" ? (
            <>
              <div className="task-compose">
                <input value={newTodo} onChange={(event) => setNewTodo(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTodo()} placeholder="Add a task to KERN…" />
                <button className="button primary" onClick={addTodo}><Plus size={15} />Add task</button>
              </div>
              <div className="task-board">
                {(["critical", "high", "medium", "low"] as const).map((priority) => {
                  const items = todos.filter((todo) => todo.priority === priority && !todo.done);
                  return (
                    <section className="task-column" key={priority}>
                      <div className="task-column-head"><span className={`priority-dot ${priority}`} />{priority.toUpperCase()}<em>{items.length}</em></div>
                      {items.map((todo) => (
                        <div className="todo-card" key={todo.id}>
                          <button className="todo-check" onClick={() => setTodos((all) => all.map((item) => item.id === todo.id ? { ...item, done: true } : item))}><Check size={13} /></button>
                          <div><strong>{todo.title}</strong><span>{todo.project}</span></div>
                          <button className="todo-delete" onClick={() => setTodos((all) => all.filter((item) => item.id !== todo.id))}><Trash2 size={13} /></button>
                        </div>
                      ))}
                      {!items.length ? <div className="task-empty">No {priority} tasks</div> : null}
                    </section>
                  );
                })}
              </div>
              {todos.some((todo) => todo.done) ? (
                <Panel title="Completed" subtitle="Stored locally in this browser">
                  <div className="completed-list">
                    {todos.filter((todo) => todo.done).map((todo) => (
                      <div key={todo.id}><CheckCircle2 size={15} /><s>{todo.title}</s><button onClick={() => setTodos((all) => all.filter((item) => item.id !== todo.id))}><Trash2 size={13} /></button></div>
                    ))}
                  </div>
                </Panel>
              ) : null}
            </>
          ) : null}

          {active === "settings" && data ? (
            <div className="settings-grid">
              <Panel title="Connections" subtitle="Server-side integration state">
                <div className="connection-cards">
                  {[
                    { name: "GitHub", on: true, detail: `Owner: ${data.owner}` },
                    { name: "Vercel", on: data.integrations.vercel, detail: "VERCEL_TOKEN" },
                    { name: "Render", on: data.integrations.render, detail: "RENDER_API_KEY + RENDER_SERVICE_ID" },
                    { name: "Uptime", on: data.integrations.uptime, detail: "KERN_MONITORS" },
                  ].map((item) => (
                    <div key={item.name}>
                      <div><StatusDot tone={item.on ? "ok" : "neutral"} /><strong>{item.name}</strong></div>
                      <span>{item.on ? "Connected" : "Not configured"}</span>
                      <code>{item.detail}</code>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel title="Security" subtitle="KERN access model">
                <div className="security-copy">
                  <div className="security-icon"><Server size={19} /></div>
                  <div><strong>Server-only credentials</strong><p>GitHub, Vercel and Render credentials are read only inside server routes. Provider tokens are never included in dashboard JSON.</p></div>
                </div>
                <div className="security-copy">
                  <div className="security-icon"><CheckCircle2 size={19} /></div>
                  <div><strong>HTTP-only session</strong><p>Set KERN_PASSWORD in production to gate the interface with a secure HTTP-only cookie.</p></div>
                </div>
              </Panel>
            </div>
          ) : null}
        </div>
      </main>

      {palette ? (
        <div className="palette-backdrop" onMouseDown={() => setPalette(false)}>
          <div className="palette" onMouseDown={(event) => event.stopPropagation()}>
            <div className="palette-search"><Search size={17} /><input autoFocus placeholder="Jump to…" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>ESC</kbd></div>
            <div className="palette-results">
              <span className="nav-section">NAVIGATE</span>
              {filteredCommands.map((item) => {
                const Icon = item.icon;
                return <button key={item.id} onClick={() => { setActive(item.id); setPalette(false); setSearch(""); }}><Icon size={16} /><span>{item.label}</span><ChevronRight size={14} /></button>;
              })}
              <span className="nav-section lower">ACTIONS</span>
              <button onClick={() => { void load(true); setPalette(false); }}><RefreshCw size={16} /><span>Refresh all data</span><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
