"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  GitBranch,
  Loader2,
  RefreshCw,
  Rocket,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DashboardData } from "@/lib/types";

type ActionResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  url?: string;
};

export function ActionCenter({
  data,
  onRefresh,
}: {
  data: DashboardData;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<ActionResponse | null>(null);

  const [issueRepo, setIssueRepo] = useState(data.projects[0]?.fullName ?? "");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueBody, setIssueBody] = useState("");

  const [workflowRepo, setWorkflowRepo] = useState(data.projects[0]?.fullName ?? "");
  const selectedWorkflowProject = data.projects.find((project) => project.fullName === workflowRepo);
  const [workflow, setWorkflow] = useState("ci.yml");
  const [workflowRef, setWorkflowRef] = useState(selectedWorkflowProject?.branch ?? "main");

  const vercelDeployments = useMemo(
    () => data.deployments.filter((deployment) => deployment.provider === "Vercel"),
    [data.deployments],
  );
  const [vercelId, setVercelId] = useState(vercelDeployments[0]?.id ?? "");
  const selectedVercel = vercelDeployments.find((deployment) => deployment.id === vercelId);

  const [clearRenderCache, setClearRenderCache] = useState(false);

  async function run(key: string, payload: Record<string, unknown>, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return;

    setBusy(key);
    setResult(null);

    try {
      const response = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as ActionResponse;
      if (!response.ok || !body.ok) throw new Error(body.error || "Action failed.");

      setResult(body);
      onRefresh();
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : "Action failed.",
      });
    } finally {
      setBusy("");
    }
  }

  const locked = data.writeActions.locked;

  return (
    <>
      <div className={`action-safety ${locked ? "locked" : "ready"}`}>
        <div>
          {locked ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <div>
            <strong>{locked ? "Write actions locked" : "Write actions protected"}</strong>
            <p>
              {locked
                ? "Set KERN_PASSWORD before KERN will perform any provider mutation."
                : "Mutations require your authenticated KERN session and server-side provider credentials."}
            </p>
          </div>
        </div>
        <span>{locked ? "READ ONLY" : "ARMED"}</span>
      </div>

      {result ? (
        <div className={`action-result ${result.ok ? "success" : "error"}`}>
          {result.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{result.message || result.error}</span>
          {result.url ? (
            <a href={result.url} target="_blank" rel="noreferrer">
              Open <ExternalLink size={13} />
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="action-grid">
        <section className="action-card">
          <div className="action-card-head">
            <div className="action-card-icon"><CircleDot size={17} /></div>
            <div><strong>Create GitHub issue</strong><p>Open an issue without leaving KERN.</p></div>
            <span className={data.writeActions.github && !locked ? "ready" : ""}>
              {data.writeActions.github ? "TOKEN" : "NO TOKEN"}
            </span>
          </div>
          <label>Repository</label>
          <select value={issueRepo} onChange={(event) => setIssueRepo(event.target.value)}>
            {data.projects.map((project) => <option value={project.fullName} key={project.id}>{project.fullName}</option>)}
          </select>
          <label>Title</label>
          <input value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} placeholder="Describe the issue…" maxLength={256} />
          <label>Body</label>
          <textarea value={issueBody} onChange={(event) => setIssueBody(event.target.value)} placeholder="Context, expected behavior, notes…" rows={4} />
          <button
            className="button primary"
            disabled={locked || !data.writeActions.github || !issueRepo || !issueTitle.trim() || busy !== ""}
            onClick={() => void run("issue", { type: "github.issue", repo: issueRepo, title: issueTitle, body: issueBody })}
          >
            {busy === "issue" ? <Loader2 className="spin" size={15} /> : <CircleDot size={15} />}
            Create issue
          </button>
        </section>

        <section className="action-card">
          <div className="action-card-head">
            <div className="action-card-icon"><GitBranch size={17} /></div>
            <div><strong>Run GitHub workflow</strong><p>Dispatch a workflow on a branch or SHA.</p></div>
            <span className={data.writeActions.github && !locked ? "ready" : ""}>
              {data.writeActions.github ? "TOKEN" : "NO TOKEN"}
            </span>
          </div>
          <label>Repository</label>
          <select
            value={workflowRepo}
            onChange={(event) => {
              const repo = event.target.value;
              setWorkflowRepo(repo);
              const project = data.projects.find((item) => item.fullName === repo);
              setWorkflowRef(project?.branch ?? "main");
            }}
          >
            {data.projects.map((project) => <option value={project.fullName} key={project.id}>{project.fullName}</option>)}
          </select>
          <label>Workflow filename / ID</label>
          <input value={workflow} onChange={(event) => setWorkflow(event.target.value)} placeholder="ci.yml" />
          <label>Git ref</label>
          <input value={workflowRef} onChange={(event) => setWorkflowRef(event.target.value)} placeholder="main" />
          <button
            className="button primary"
            disabled={locked || !data.writeActions.github || !workflowRepo || !workflow || !workflowRef || busy !== ""}
            onClick={() => void run(
              "workflow",
              { type: "github.workflow", repo: workflowRepo, workflow, ref: workflowRef },
              `Trigger ${workflow} on ${workflowRepo}@${workflowRef}?`,
            )}
          >
            {busy === "workflow" ? <Loader2 className="spin" size={15} /> : <GitBranch size={15} />}
            Trigger workflow
          </button>
        </section>

        <section className="action-card">
          <div className="action-card-head">
            <div className="action-card-icon"><Zap size={17} /></div>
            <div><strong>Redeploy Vercel</strong><p>Create a fresh build from an existing deployment.</p></div>
            <span className={data.writeActions.vercel && !locked ? "ready" : ""}>
              {data.writeActions.vercel ? "TOKEN" : "NO TOKEN"}
            </span>
          </div>
          <label>Existing deployment</label>
          <select value={vercelId} onChange={(event) => setVercelId(event.target.value)}>
            {!vercelDeployments.length ? <option value="">No Vercel deployments loaded</option> : null}
            {vercelDeployments.map((deployment) => (
              <option value={deployment.id} key={deployment.id}>
                {deployment.name} · {deployment.state} · {deployment.branch || deployment.id.slice(0, 10)}
              </option>
            ))}
          </select>
          <div className="action-detail">
            <span>Project</span><strong>{selectedVercel?.name ?? "—"}</strong>
            <span>Branch</span><strong>{selectedVercel?.branch ?? "Inherited"}</strong>
            <span>Commit</span><strong>{selectedVercel?.commit?.slice(0, 10) ?? "Inherited"}</strong>
          </div>
          <button
            className="button primary"
            disabled={locked || !data.writeActions.vercel || !selectedVercel || busy !== ""}
            onClick={() => selectedVercel && void run(
              "vercel",
              { type: "vercel.redeploy", deploymentId: selectedVercel.id, name: selectedVercel.name },
              `Redeploy ${selectedVercel.name} on Vercel?`,
            )}
          >
            {busy === "vercel" ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
            Redeploy
          </button>
        </section>

        <section className="action-card">
          <div className="action-card-head">
            <div className="action-card-icon"><Rocket size={17} /></div>
            <div><strong>Deploy Render service</strong><p>Build and deploy the configured Render service.</p></div>
            <span className={data.writeActions.render && !locked ? "ready" : ""}>
              {data.writeActions.render ? "TOKEN" : "NO TOKEN"}
            </span>
          </div>
          <div className="render-action-copy">
            <strong>RENDER_SERVICE_ID</strong>
            <p>KERN uses the service configured in the server environment. The ID is never exposed in the browser.</p>
          </div>
          <label className="check-row">
            <input type="checkbox" checked={clearRenderCache} onChange={(event) => setClearRenderCache(event.target.checked)} />
            <span><strong>Clear build cache</strong><em>Use for stale dependencies or a clean rebuild.</em></span>
          </label>
          <button
            className="button primary"
            disabled={locked || !data.writeActions.render || busy !== ""}
            onClick={() => void run(
              "render",
              { type: "render.deploy", clearCache: clearRenderCache },
              clearRenderCache ? "Trigger a clean Render deploy and clear the build cache?" : "Trigger a Render deploy?",
            )}
          >
            {busy === "render" ? <Loader2 className="spin" size={15} /> : <Rocket size={15} />}
            Deploy Render
          </button>
        </section>
      </div>
    </>
  );
}
