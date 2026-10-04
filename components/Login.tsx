"use client";

import { FormEvent, useState } from "react";
import { Command, Loader2, LockKeyhole } from "lucide-react";

export function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError("Invalid access password.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Could not reach KERN.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-grid" />
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark large"><Command size={23} /></div>
        <div>
          <p className="eyebrow">DEVELOPER COMMAND CENTER</p>
          <h1>KERN</h1>
          <p className="muted">Authenticate to enter your command center.</p>
        </div>
        <label className="field-label" htmlFor="password">ACCESS PASSWORD</label>
        <div className="password-field">
          <LockKeyhole size={17} />
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button primary wide" disabled={loading || !password}>
          {loading ? <Loader2 className="spin" size={16} /> : <Command size={16} />}
          Enter KERN
        </button>
        <p className="login-note">KERN_PASSWORD is configured server-side and is never exposed to the browser.</p>
      </form>
    </main>
  );
}
