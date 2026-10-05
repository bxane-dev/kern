import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AlertRecord, IncidentRecord, Todo } from "@/lib/types";

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


function mapAlert(row: any): AlertRecord {
  return {
    id: row.id,
    kind: String(row.kind),
    severity: row.severity as AlertRecord["severity"],
    title: String(row.title),
    body: row.body ?? null,
    status: row.status as AlertRecord["status"],
    fingerprint: row.fingerprint ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at ?? new Date().toISOString(),
    resolvedAt: row.resolved_at ?? null,
  };
}

function mapIncident(row: any): IncidentRecord {
  return {
    id: String(row.id),
    source: String(row.source),
    resource: String(row.resource),
    status: row.status as IncidentRecord["status"],
    summary: String(row.summary),
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    startedAt: row.started_at ?? new Date().toISOString(),
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

export async function listAlerts() {
  const { data, error } = await client()
    .from("kern_alerts")
    .select("id,kind,severity,title,body,status,fingerprint,metadata,created_at,resolved_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAlert);
}

export async function listIncidents() {
  const { data, error } = await client()
    .from("kern_incidents")
    .select("id,source,resource,status,summary,metadata,started_at,resolved_at,created_at,updated_at")
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapIncident);
}

export async function acknowledgeAlert(id: string) {
  const { data, error } = await client()
    .from("kern_alerts")
    .update({
      status: "acknowledged",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "open")
    .select("id,kind,severity,title,body,status,fingerprint,metadata,created_at,resolved_at,updated_at")
    .single();

  if (error) throw new Error(error.message);

  await recordAuditEvent({
    action: "alert.acknowledge",
    resource: id,
  });

  return mapAlert(data);
}

function incidentIdentity(alert: AlertRecord) {
  if (alert.kind === "uptime") {
    const url = typeof alert.metadata.url === "string" ? alert.metadata.url : alert.fingerprint;
    return url ? { source: "uptime", resource: String(url) } : null;
  }

  if (alert.kind === "deployment") {
    const provider = typeof alert.metadata.provider === "string" ? alert.metadata.provider : "deployment";
    const title = alert.title.replace(/ deployment failed$/i, "");
    return { source: "deployment", resource: `${provider}:${title}` };
  }

  return null;
}

export async function syncOperationalState(liveAlerts: AlertRecord[]) {
  if (!persistenceConfigured() || !persistenceAccessAllowed()) return;

  const db = client();
  const now = new Date().toISOString();
  const activeFingerprints = new Set(
    liveAlerts.map((alert) => alert.fingerprint).filter((value): value is string => Boolean(value)),
  );

  const { data: storedAlerts, error: storedAlertsError } = await db
    .from("kern_alerts")
    .select("id,status,fingerprint")
    .in("status", ["open", "acknowledged"]);

  if (storedAlertsError) throw new Error(storedAlertsError.message);

  const storedByFingerprint = new Map(
    (storedAlerts ?? [])
      .filter((row: any) => row.fingerprint)
      .map((row: any) => [String(row.fingerprint), row]),
  );

  for (const alert of liveAlerts) {
    if (!alert.fingerprint) continue;
    const stored = storedByFingerprint.get(alert.fingerprint);

    if (stored) {
      const { error } = await db
        .from("kern_alerts")
        .update({
          kind: alert.kind,
          severity: alert.severity,
          title: alert.title,
          body: alert.body,
          metadata: alert.metadata,
          updated_at: now,
        })
        .eq("id", stored.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("kern_alerts").insert({
        kind: alert.kind,
        severity: alert.severity,
        title: alert.title,
        body: alert.body,
        status: "open",
        fingerprint: alert.fingerprint,
        metadata: alert.metadata,
      });
      if (error) throw new Error(error.message);
    }
  }

  for (const stored of storedAlerts ?? []) {
    if (!stored.fingerprint || activeFingerprints.has(String(stored.fingerprint))) continue;
    const { error } = await db
      .from("kern_alerts")
      .update({
        status: "resolved",
        resolved_at: now,
        updated_at: now,
      })
      .eq("id", stored.id);
    if (error) throw new Error(error.message);
  }

  const criticalIdentities = new Map<string, { source: string; resource: string; alert: AlertRecord }>();
  for (const alert of liveAlerts) {
    if (alert.severity !== "critical") continue;
    const identity = incidentIdentity(alert);
    if (!identity) continue;
    criticalIdentities.set(`${identity.source}:${identity.resource}`, { ...identity, alert });
  }

  const { data: openIncidents, error: incidentError } = await db
    .from("kern_incidents")
    .select("id,source,resource")
    .eq("status", "open");

  if (incidentError) throw new Error(incidentError.message);

  const openByIdentity = new Map(
    (openIncidents ?? []).map((row: any) => [`${row.source}:${row.resource}`, row]),
  );

  for (const [identity, item] of criticalIdentities) {
    if (openByIdentity.has(identity)) {
      const { error } = await db
        .from("kern_incidents")
        .update({
          summary: item.alert.title,
          metadata: item.alert.metadata,
          updated_at: now,
        })
        .eq("id", openByIdentity.get(identity).id);
      if (error) throw new Error(error.message);
      continue;
    }

    const { error } = await db.from("kern_incidents").insert({
      source: item.source,
      resource: item.resource,
      status: "open",
      summary: item.alert.title,
      metadata: item.alert.metadata,
    });
    if (error) throw new Error(error.message);
  }

  for (const [identity, incident] of openByIdentity) {
    if (criticalIdentities.has(identity)) continue;
    const { error } = await db
      .from("kern_incidents")
      .update({
        status: "resolved",
        resolved_at: now,
        updated_at: now,
      })
      .eq("id", incident.id);
    if (error) throw new Error(error.message);
  }
}
