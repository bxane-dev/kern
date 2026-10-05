import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  createTodo,
  deleteTodo,
  listTodos,
  persistenceAccessAllowed,
  persistenceConfigured,
  recordAuditEvent,
  updateTodo,
} from "@/lib/persistence";
import type { Todo } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function ready() {
  return persistenceConfigured() && persistenceAccessAllowed();
}

export async function GET() {
  if (!(await isAuthenticated())) return responseError("Unauthorized", 401);

  if (!persistenceConfigured()) {
    return NextResponse.json({ ok: true, configured: false, todos: [] });
  }

  if (!persistenceAccessAllowed()) {
    return responseError("Persistent data is locked until KERN_PASSWORD is configured.", 403);
  }

  try {
    return NextResponse.json({
      ok: true,
      configured: true,
      todos: await listTodos(),
    });
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Could not load TODOs.", 502);
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return responseError("Unauthorized", 401);
  if (!sameOrigin(request)) return responseError("Invalid request origin", 403);
  if (!ready()) return responseError("Supabase persistence is not available.", 409);

  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();

  if (!title || title.length > 500) return responseError("TODO title is invalid.", 400);

  const priority = String(body.priority ?? "medium") as Todo["priority"];
  if (!["low", "medium", "high", "critical"].includes(priority)) {
    return responseError("TODO priority is invalid.", 400);
  }

  try {
    const todo = await createTodo({
      title,
      project: String(body.project ?? "KERN").trim().slice(0, 120) || "KERN",
      priority,
      dueAt: body.dueAt ? String(body.dueAt) : null,
    });

    await recordAuditEvent({
      action: "todo.create",
      resource: todo.id,
      metadata: { title: todo.title, project: todo.project },
    });

    return NextResponse.json({ ok: true, configured: true, todo }, { status: 201 });
  } catch (error) {
    await recordAuditEvent({
      action: "todo.create",
      outcome: "failure",
      metadata: { message: error instanceof Error ? error.message : "unknown error" },
    });
    return responseError(error instanceof Error ? error.message : "Could not create TODO.", 502);
  }
}

export async function PATCH(request: Request) {
  if (!(await isAuthenticated())) return responseError("Unauthorized", 401);
  if (!sameOrigin(request)) return responseError("Invalid request origin", 403);
  if (!ready()) return responseError("Supabase persistence is not available.", 409);

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  if (!id) return responseError("TODO id is required.", 400);

  const patch: Partial<Pick<Todo, "title" | "project" | "priority" | "done" | "dueAt">> = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title || title.length > 500) return responseError("TODO title is invalid.", 400);
    patch.title = title;
  }

  if (body.project !== undefined) patch.project = String(body.project).trim().slice(0, 120) || "KERN";

  if (body.priority !== undefined) {
    const priority = String(body.priority) as Todo["priority"];
    if (!["low", "medium", "high", "critical"].includes(priority)) {
      return responseError("TODO priority is invalid.", 400);
    }
    patch.priority = priority;
  }

  if (body.done !== undefined) patch.done = Boolean(body.done);
  if (body.dueAt !== undefined) patch.dueAt = body.dueAt ? String(body.dueAt) : null;

  try {
    const todo = await updateTodo(id, patch);
    await recordAuditEvent({
      action: "todo.update",
      resource: todo.id,
      metadata: patch,
    });
    return NextResponse.json({ ok: true, configured: true, todo });
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Could not update TODO.", 502);
  }
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticated())) return responseError("Unauthorized", 401);
  if (!sameOrigin(request)) return responseError("Invalid request origin", 403);
  if (!ready()) return responseError("Supabase persistence is not available.", 409);

  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();
  if (!id) return responseError("TODO id is required.", 400);

  try {
    await deleteTodo(id);
    await recordAuditEvent({ action: "todo.delete", resource: id });
    return NextResponse.json({ ok: true, configured: true });
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Could not delete TODO.", 502);
  }
}
