import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  acknowledgeAlert,
  listAlerts,
  listIncidents,
  persistenceAccessAllowed,
  persistenceConfigured,
} from "@/lib/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function GET() {
  if (!(await isAuthenticated())) return fail("Unauthorized", 401);

  if (!persistenceConfigured()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      alerts: [],
      incidents: [],
    });
  }

  if (!persistenceAccessAllowed()) {
    return fail("Operational history is locked until KERN_PASSWORD is configured.", 403);
  }

  try {
    const [alerts, incidents] = await Promise.all([listAlerts(), listIncidents()]);
    return NextResponse.json({ ok: true, configured: true, alerts, incidents });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load operations history.", 502);
  }
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) return fail("Unauthorized", 401);
  if (!sameOrigin(request)) return fail("Invalid request origin", 403);
  if (!persistenceConfigured() || !persistenceAccessAllowed()) {
    return fail("Persistent alerts are not available.", 409);
  }

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  if (!id) return fail("Alert id is required.", 400);

  try {
    const alert = await acknowledgeAlert(id);
    return NextResponse.json({ ok: true, alert });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not acknowledge alert.", 502);
  }
}
