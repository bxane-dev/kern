import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Todo } from "@/lib/types";

let cached: SupabaseClient | null = null;
let cachedKey = "";

function credentials() {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";
  return { url, key };
}

export function persistenceConfigured() {
  const { url, key } = credentials();
  return Boolean(url && key);
}

export function persistenceAccessAllowed() {
  return process.env.KERN_DESKTOP === "1" || Boolean(process.env.KERN_PASSWORD);
}

function client() {
  const { url, key } = credentials();
  if (!url || !key) {
    throw new Error("Supabase persistence is not configured.");
  }

  const identity = `${url}:${key}`;
  if (!cached || cachedKey !== identity) {
    cached = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          "X-Client-Info": "kern-server",
        },
      },
    });
    cachedKey = identity;
  }

  return cached;
}

function mapTodo(row: any): Todo {
  return {
    id: String(row.id),
    title: String(row.title),
    project: String(row.project ?? "KERN"),
    priority: (row.priority ?? "medium") as Todo["priority"],
    done: Boolean(row.done),
    dueAt: row.due_at ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

export async function listTodos() {
  const { data, error } = await client()
    .from("kern_todos")
    .select("id,title,project,priority,done,due_at,created_at,updated_at")
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTodo);
}

export async function createTodo(input: {
  title: string;
  project?: string;
  priority?: Todo["priority"];
  dueAt?: string | null;
}) {
  const payload = {
    title: input.title,
    project: input.project || "KERN",
    priority: input.priority || "medium",
    due_at: input.dueAt || null,
  };

  const { data, error } = await client()
    .from("kern_todos")
    .insert(payload)
    .select("id,title,project,priority,done,due_at,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message);
  return mapTodo(data);
}

export async function updateTodo(
  id: string,
  patch: Partial<Pick<Todo, "title" | "project" | "priority" | "done" | "dueAt">>,
) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.project !== undefined) payload.project = patch.project;
  if (patch.priority !== undefined) payload.priority = patch.priority;
  if (patch.done !== undefined) payload.done = patch.done;
  if (patch.dueAt !== undefined) payload.due_at = patch.dueAt;

  const { data, error } = await client()
    .from("kern_todos")
    .update(payload)
    .eq("id", id)
    .select("id,title,project,priority,done,due_at,created_at,updated_at")
    .single();

  if (error) throw new Error(error.message);
  return mapTodo(data);
}

export async function deleteTodo(id: string) {
  const { error } = await client().from("kern_todos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function recordAuditEvent(input: {
  action: string;
  resource?: string | null;
  outcome?: "success" | "failure";
  metadata?: Record<string, unknown>;
}) {
  if (!persistenceConfigured() || !persistenceAccessAllowed()) return;

  const { error } = await client().from("kern_audit_events").insert({
    action: input.action,
    resource: input.resource ?? null,
    outcome: input.outcome ?? "success",
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.warn("KERN audit persistence failed:", error.message);
  }
}
