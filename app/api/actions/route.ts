import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

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
        return NextResponse.json({
          ok: true,
          message: clearCache ? "Render clean deploy queued." : "Render deploy queued.",
          id: deploy?.id,
        });
      }

      default:
        return jsonError("Unknown action.");
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Action failed.", 502);
  }
}
