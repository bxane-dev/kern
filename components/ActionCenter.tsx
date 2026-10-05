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
  XCircle,
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

  const [issueActionRepo, setIssueActionRepo] = useState(data.issues[0]?.repo ?? data.projects[0]?.fullName ?? "");
  const [issueNumber, setIssueNumber] = useState(String(data.issues[0]?.number ?? ""));
  const [issueState, setIssueState] = useState<"open" | "closed">("closed");

  const [prKey, setPrKey] = useState(
    data.pullRequests[0]?.number ? `${data.pullRequests[0].repo}#${data.pullRequests[0].number}` : "",
  );
  const [mergeMethod, setMergeMethod] = useState<"merge" | "squash" | "rebase">("squash");

  const [rerunRepo, setRerunRepo] = useState(data.projects[0]?.fullName ?? "");
  const [workflowRunId, setWorkflowRunId] = useState("");

  const [rollbackId, setRollbackId] = useState(vercelDeployments[1]?.id ?? vercelDeployments[0]?.id ?? "");
  const selectedRollback = vercelDeployments.find((deployment) => deployment.id === rollbackId);

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
        <section className="action-card">
          <div className="action-card-head">
            <div className="action-card-icon"><CircleDot size={17} /></div>
            <div><strong>Close / reopen issue</strong><p>Change an issue state directly on GitHub.</p></div>
            <span className={data.writeActions.github && !locked ? "ready" : ""}>
              {data.writeActions.github ? "TOKEN" : "NO TOKEN"}
            </span>
          </div>
          <label>Repository</label>
          <select value={issueActionRepo} onChange={(event) => setIssueActionRepo(event.target.value)}>
            {data.projects.map((project) => <option value={project.fullName} key={project.id}>{project.fullName}</option>)}
          </select>
          <label>Issue number</label>
          <input inputMode="numeric" value={issueNumber} onChange={(event) => setIssueNumber(event.target.value.replace(/\D/g, ""))} placeholder="123" />
          <label>New state</label>
          <select value={issueState} onChange={(event) => setIssueState(event.target.value as "open" | "closed")}>
            <option value="closed">Closed</option>
            <option value="open">Open</option>
          </select>
          <button
            className="button primary"
            disabled={locked || !data.writeActions.github || !issueActionRepo || !issueNumber || busy !== ""}
            onClick={() => void run(
              "issue-state",
              { type: "github.issue.state", repo: issueActionRepo, issueNumber: Number(issueNumber), state: issueState },
              `${issueState === "closed" ? "Close" : "Reopen"} issue #${issueNumber} in ${issueActionRepo}?`,
            )}
          >
            {busy === "issue-state" ? <Loader2 className="spin" size={15} /> : <XCircle size={15} />}
            {issueState === "closed" ? "Close issue" : "Reopen issue"}
          </button>
        </section>

        <section className="action-card">
          <div className="action-card-head">
            <div className="action-card-icon"><GitBranch size={17} /></div>
            <div><strong>Merge pull request</strong><p>Merge an open PR with an explicit method.</p></div>
            <span className={data.writeActions.github && !locked ? "ready" : ""}>
              {data.writeActions.github ? "TOKEN" : "NO TOKEN"}
            </span>
          </div>
          <label>Pull request</label>
          <select value={prKey} onChange={(event) => setPrKey(event.target.value)}>
            {!data.pullRequests.length ? <option value="">No open pull requests</option> : null}
            {data.pullRequests.map((pr) => (
              <option value={`${pr.repo}#${pr.number}`} key={pr.id}>{pr.repo} #{pr.number} · {pr.title}</option>
            ))}
          </select>
          <label>Merge method</label>
          <select value={mergeMethod} onChange={(event) => setMergeMethod(event.target.value as "merge" | "squash" | "rebase")}>
            <option value="squash">Squash</option>
            <option value="merge">Merge commit</option>
            <option value="rebase">Rebase</option>
          </select>
          <button
            className="button primary"
            disabled={locked || !data.writeActions.github || !prKey || busy !== ""}
            onClick={() => {
              const [repo, number] = prKey.split("#");
              void run(
                "merge-pr",
                { type: "github.pr.merge", repo, pullNumber: Number(number), method: mergeMethod },
                `Merge PR #${number} in ${repo} using ${mergeMethod}?`,
              );
            }}
          >
            {busy === "merge-pr" ? <Loader2 className="spin" size={15} /> : <CheckCircle2 size={15} />}
            Merge PR
          </button>
        </section>

        <section className="action-card">
          <div className="action-card-head">
            <div className="action-card-icon"><RefreshCw size={17} /></div>
            <div><strong>Rerun workflow run</strong><p>Rerun a completed GitHub Actions workflow by run ID.</p></div>
            <span className={data.writeActions.github && !locked ? "ready" : ""}>
              {data.writeActions.github ? "TOKEN" : "NO TOKEN"}
            </span>
          </div>
          <label>Repository</label>
          <select value={rerunRepo} onChange={(event) => setRerunRepo(event.target.value)}>
            {data.projects.map((project) => <option value={project.fullName} key={project.id}>{project.fullName}</option>)}
          </select>
          <label>Workflow run ID</label>
          <input inputMode="numeric" value={workflowRunId} onChange={(event) => setWorkflowRunId(event.target.value.replace(/\D/g, ""))} placeholder="37315499987" />
          <button
            className="button primary"
            disabled={locked || !data.writeActions.github || !rerunRepo || !workflowRunId || busy !== ""}
            onClick={() => void run(
              "rerun",
              { type: "github.workflow.rerun", repo: rerunRepo, runId: Number(workflowRunId) },
              `Rerun workflow run ${workflowRunId} in ${rerunRepo}?`,
            )}
          >
            {busy === "rerun" ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
            Rerun workflow
          </button>
        </section>

        <section className="action-card">
          <div className="action-card-head">
            <div className="action-card-icon"><Zap size={17} /></div>
            <div><strong>Rollback Vercel production</strong><p>Point production traffic to a previous deployment.</p></div>
            <span className={data.writeActions.vercel && !locked ? "ready" : ""}>
              {data.writeActions.vercel ? "TOKEN" : "NO TOKEN"}
            </span>
          </div>
          <label>Target deployment</label>
          <select value={rollbackId} onChange={(event) => setRollbackId(event.target.value)}>
            {!vercelDeployments.length ? <option value="">No Vercel deployments loaded</option> : null}
            {vercelDeployments.map((deployment) => (
              <option value={deployment.id} key={deployment.id}>
                {deployment.name} · {deployment.branch || "production"} · {deployment.id.slice(0, 12)}
              </option>
            ))}
          </select>
          <div className="render-action-copy">
            <strong>PRODUCTION TRAFFIC CHANGE</strong>
            <p>This changes which previous deployment receives production traffic. It does not rebuild the app.</p>
          </div>
          <button
            className="button primary"
            disabled={locked || !data.writeActions.vercel || !selectedRollback || busy !== ""}
            onClick={() => selectedRollback && void run(
              "rollback",
              { type: "vercel.rollback", deploymentId: selectedRollback.id, description: "Rollback requested from KERN" },
              `Rollback Vercel production to deployment ${selectedRollback.id}?`,
            )}
          >
            {busy === "rollback" ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
            Roll back production
          </button>
        </section>

        <section className="action-card">
          <div className="action-card-head">
            <div className="action-card-icon"><Rocket size={17} /></div>
            <div><strong>Restart Render service</strong><p>Restart the running service without deploying new code.</p></div>
            <span className={data.writeActions.render && !locked ? "ready" : ""}>
              {data.writeActions.render ? "TOKEN" : "NO TOKEN"}
            </span>
          </div>
          <div className="render-action-copy">
            <strong>ZERO-DOWNTIME RESTART</strong>
            <p>Render starts a replacement instance using the current deployed commit and configuration.</p>
          </div>
          <button
            className="button primary"
            disabled={locked || !data.writeActions.render || busy !== ""}
            onClick={() => void run(
              "render-restart",
              { type: "render.restart" },
              "Restart the configured Render service?",
            )}
          >
            {busy === "render-restart" ? <Loader2 className="spin" size={15} /> : <RefreshCw size={15} />}
            Restart service
          </button>
        </section>
      </div>
    </>
  );
}
