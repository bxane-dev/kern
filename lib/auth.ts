import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export const KERN_COOKIE = "kern_session";

function expectedSession() {
  const password = process.env.KERN_PASSWORD;
  if (!password) return null;
  return createHash("sha256").update(`kern:${password}`).digest("hex");
}

export async function isAuthenticated() {
  const expected = expectedSession();
  if (!expected) return true;
  const store = await cookies();
  return store.get(KERN_COOKIE)?.value === expected;
}

export function sessionValueFor(password: string) {
  const configured = process.env.KERN_PASSWORD;
  if (!configured || password !== configured) return null;
  return createHash("sha256").update(`kern:${configured}`).digest("hex");
}
