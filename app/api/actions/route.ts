import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const owner = process.env.GITHUB_OWNER || "bxane-dev";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function validRepo(value: unknown) {
  const repo = String(value ?? "").trim();
  if (!repo.startsWith(`${owner}/`)) {
    throw new Error("Repository is outside the configured GitHub owner.");
  }
  const name = repo.slice(owner.length + 1);
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) {
    throw new Error("Repository name is invalid.");
  }
  return repo;
}

function compact(value: unknown, max: number, label: string) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new Error(`${label} is invalid.`);
  return text;
}

async function providerRequest(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const text = await response.text();
  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text.slice(0, 700) };
    }
  }

  if (!response.ok) {
    const message =
      data?.message ||
      data?.error?.message ||
      data?.error ||
      `${response.status} ${response.statusText}`;
    throw new Error(String(message).slice(0, 700));
  }

  return data;
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return jsonError("Unauthorized", 401);
  if (!sameOrigin(request)) return jsonError("Invalid request origin", 403);

  // KERN is always read-only unless the dashboard itself is password protected.
  if (!process.env.KERN_PASSWORD) {
    return jsonError("Write actions are locked until KERN_PASSWORD is configured.", 403);
  }

  const body = await request.json().catch(() => ({}));

  try {
    switch (body.type) {
      case "github.issue": {
        const token = process.env.GITHUB_TOKEN;
        if (!token) return jsonError("GITHUB_TOKEN is not configured.", 409);

        const repo = validRepo(body.repo);
        const title = compact(body.title, 256, "Issue title");
        const issueBody = String(body.body ?? "").slice(0, 20_000);

        const data = await providerRequest(
          `https://api.github.com/repos/${repo}/issues`,
          {
            method: "POST",
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "User-Agent": "KERN-Command-Center",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({ title, body: issueBody }),
          },
        );

        await recordAuditEvent({
          action: "github.issue.create",
          resource: `${repo}#${data?.number ?? ""}`,
          metadata: { title },
        });

        return NextResponse.json({
          ok: true,
          message: `Created issue #${data?.number ?? ""}`.trim(),
          url: data?.html_url,
        });
      }

      case "github.workflow": {
        const token = process.env.GITHUB_TOKEN;
        if (!token) return jsonError("GITHUB_TOKEN is not configured.", 409);

        const repo = validRepo(body.repo);
        const workflow = compact(body.workflow, 160, "Workflow");
        if (!/^[A-Za-z0-9_.-]+$/.test(workflow)) {
          return jsonError("Workflow must be a workflow filename or numeric ID.");
        }
        const ref = compact(body.ref, 200, "Git ref");

        await providerRequest(
          `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
          {
            method: "POST",
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "User-Agent": "KERN-Command-Center",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({ ref }),
          },
        );

        await recordAuditEvent({
          action: "github.workflow.dispatch",
          resource: `${repo}:${workflow}`,
          metadata: { ref },
        });

        return NextResponse.json({ ok: true, message: `Triggered ${workflow} on ${ref}` });
      }

      case "vercel.redeploy": {
        const token = process.env.VERCEL_TOKEN;
        if (!token) return jsonError("VERCEL_TOKEN is not configured.", 409);

        const deploymentId = compact(body.deploymentId, 180, "Deployment ID");
        const name = compact(body.name, 100, "Project name");
        if (!/^[A-Za-z0-9_.-]+$/.test(deploymentId)) {
          return jsonError("Invalid Vercel deployment ID.");
        }

        const params = new URLSearchParams({ forceNew: "1" });
        if (process.env.VERCEL_TEAM_ID) params.set("teamId", process.env.VERCEL_TEAM_ID);

        const data = await providerRequest(
          `https://api.vercel.com/v13/deployments?${params.toString()}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name, deploymentId }),
          },
        );

        await recordAuditEvent({
          action: "vercel.redeploy",
          resource: deploymentId,
          metadata: { name },
        });

        return NextResponse.json({
          ok: true,
          message: "Vercel redeploy queued.",
          url: data?.url ? `https://${data.url}` : undefined,
        });
      }

      case "render.deploy": {
        const token = process.env.RENDER_API_KEY;
        const serviceId = process.env.RENDER_SERVICE_ID;
        if (!token || !serviceId) {
          return jsonError("Render write credentials are not configured.", 409);
        }

        const clearCache = Boolean(body.clearCache);
        const data = await providerRequest(
          `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/deploys`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              clearCache: clearCache ? "clear" : "do_not_clear",
              deployMode: "build_and_deploy",
            }),
          },
        );

        const deploy = data?.deploy ?? data;

        await recordAuditEvent({
          action: "render.deploy",
          resource: serviceId,
          metadata: { clearCache, deployId: deploy?.id ?? null },
        });

        return NextResponse.json({
          ok: true,
          message: clearCache ? "Render clean deploy queued." : "Render deploy queued.",
          id: deploy?.id,
        });
      }

      case "github.issue.state": {
        const token = process.env.GITHUB_TOKEN;
        if (!token) return jsonError("GITHUB_TOKEN is not configured.", 409);

        const repo = validRepo(body.repo);
        const issueNumber = Number(body.issueNumber);
        if (!Number.isInteger(issueNumber) || issueNumber < 1) {
          return jsonError("Issue number is invalid.");
        }

        const state = String(body.state);
        if (state !== "open" && state !== "closed") {
          return jsonError("Issue state is invalid.");
        }

        const data = await providerRequest(
          `https://api.github.com/repos/${repo}/issues/${issueNumber}`,
          {
            method: "PATCH",
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "User-Agent": "KERN-Command-Center",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({ state }),
          },
        );

        await recordAuditEvent({
          action: `github.issue.${state}`,
          resource: `${repo}#${issueNumber}`,
        });

        return NextResponse.json({
          ok: true,
          message: `${state === "closed" ? "Closed" : "Reopened"} issue #${issueNumber}.`,
          url: data?.html_url,
        });
      }

      case "github.pr.merge": {
        const token = process.env.GITHUB_TOKEN;
        if (!token) return jsonError("GITHUB_TOKEN is not configured.", 409);

        const repo = validRepo(body.repo);
        const pullNumber = Number(body.pullNumber);
        if (!Number.isInteger(pullNumber) || pullNumber < 1) {
          return jsonError("Pull request number is invalid.");
        }

        const method = String(body.method || "squash");
        if (!["merge", "squash", "rebase"].includes(method)) {
          return jsonError("Merge method is invalid.");
        }

        const data = await providerRequest(
          `https://api.github.com/repos/${repo}/pulls/${pullNumber}/merge`,
          {
            method: "PUT",
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "User-Agent": "KERN-Command-Center",
              "X-GitHub-Api-Version": "2022-11-28",
            },
            body: JSON.stringify({ merge_method: method }),
          },
        );

        if (data?.merged === false) {
          throw new Error(data?.message || "GitHub did not merge the pull request.");
        }

        await recordAuditEvent({
          action: "github.pr.merge",
          resource: `${repo}#${pullNumber}`,
          metadata: { method, sha: data?.sha ?? null },
        });

        return NextResponse.json({
          ok: true,
          message: `Merged PR #${pullNumber} using ${method}.`,
        });
      }

      case "github.workflow.rerun": {
        const token = process.env.GITHUB_TOKEN;
        if (!token) return jsonError("GITHUB_TOKEN is not configured.", 409);

        const repo = validRepo(body.repo);
        const runId = Number(body.runId);
        if (!Number.isSafeInteger(runId) || runId < 1) {
          return jsonError("Workflow run ID is invalid.");
        }

        await providerRequest(
          `https://api.github.com/repos/${repo}/actions/runs/${runId}/rerun`,
          {
            method: "POST",
            headers: {
              Accept: "application/vnd.github+json",
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              "User-Agent": "KERN-Command-Center",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          },
        );

        await recordAuditEvent({
          action: "github.workflow.rerun",
          resource: `${repo}:${runId}`,
        });

        return NextResponse.json({ ok: true, message: `Rerun queued for workflow run ${runId}.` });
      }

      case "vercel.rollback": {
        const token = process.env.VERCEL_TOKEN;
        const projectId = process.env.VERCEL_PROJECT_ID;
        if (!token || !projectId) {
          return jsonError("VERCEL_TOKEN and VERCEL_PROJECT_ID are required for rollback.", 409);
        }

        const deploymentId = compact(body.deploymentId, 180, "Deployment ID");
        if (!/^[A-Za-z0-9_.-]+$/.test(deploymentId)) {
          return jsonError("Invalid Vercel deployment ID.");
        }

        const params = new URLSearchParams();
        if (process.env.VERCEL_TEAM_ID) params.set("teamId", process.env.VERCEL_TEAM_ID);
        if (body.description) params.set("description", String(body.description).slice(0, 500));

        await providerRequest(
          `https://api.vercel.com/v1/projects/${encodeURIComponent(projectId)}/rollback/${encodeURIComponent(deploymentId)}${params.size ? `?${params.toString()}` : ""}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          },
        );

        await recordAuditEvent({
          action: "vercel.rollback",
          resource: deploymentId,
          metadata: { projectId },
        });

        return NextResponse.json({ ok: true, message: "Vercel rollback requested." });
      }

      case "render.restart": {
        const token = process.env.RENDER_API_KEY;
        const serviceId = process.env.RENDER_SERVICE_ID;
        if (!token || !serviceId) {
          return jsonError("Render write credentials are not configured.", 409);
        }

        await providerRequest(
          `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/restart`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        await recordAuditEvent({
          action: "render.restart",
          resource: serviceId,
        });

        return NextResponse.json({ ok: true, message: "Render service restart requested." });
      }

      default:
        return jsonError("Unknown action.");
    }
  } catch (error) {
    await recordAuditEvent({
      action: String(body.type || "action.unknown"),
      outcome: "failure",
      metadata: { message: error instanceof Error ? error.message : "Action failed." },
    });
    return jsonError(error instanceof Error ? error.message : "Action failed.", 502);
  }
}
