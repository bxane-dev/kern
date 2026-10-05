"use client";

import { AlertTriangle, ChevronRight, Command, Loader2, RefreshCw } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  generatedAt?: string;
};

type AiStatus = {
  configured: boolean;
  model: string;
  mode: string;
};

const suggestions = [
  "What needs my attention right now?",
  "Why did the latest deployment fail?",
  "Summarize current uptime and incidents.",
  "Which issue should I handle next?",
];

export function KernAI() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void fetch("/api/ai", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Could not load KERN AI.");
        setStatus(body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load KERN AI."));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: messages.slice(-8).map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "KERN AI request failed.");

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: String(body.text || "No analysis returned."),
          model: body.model,
          generatedAt: body.generatedAt,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "KERN AI request failed.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask(input);
  }

  return (
    <div className="kern-ai-shell">
      <aside className="kern-ai-context">
        <div className="kern-ai-status">
          <div className="kern-ai-orb"><Command size={18} /></div>
          <div>
            <strong>KERN AI</strong>
            <span>{status?.configured ? "ONLINE" : "NOT CONFIGURED"}</span>
          </div>
        </div>

        <div className="kern-ai-model">
          <span>MODEL</span>
          <code>{status?.model || "Loading…"}</code>
        </div>

        <div className="kern-ai-guardrail">
          <strong>READ-ONLY ANALYSIS</strong>
          <p>KERN AI can inspect the current operational snapshot and recommend actions. It cannot execute control-plane mutations.</p>
        </div>

        <div className="kern-ai-suggestions">
          <span>QUICK ANALYSIS</span>
          {suggestions.map((suggestion) => (
            <button key={suggestion} disabled={busy || status?.configured === false} onClick={() => void ask(suggestion)}>
              <span>{suggestion}</span><ChevronRight size={13} />
            </button>
          ))}
        </div>

        <button className="button wide" type="button" onClick={() => setMessages([])} disabled={!messages.length || busy}>
          <RefreshCw size={14} />Clear conversation
        </button>
      </aside>

      <section className="kern-ai-chat">
        <div className="kern-ai-chat-head">
          <div>
            <p className="eyebrow">OPERATIONS ANALYST</p>
            <h2>Ask KERN</h2>
          </div>
          <span>Uses live KERN state</span>
        </div>

        <div className="kern-ai-messages">
          {!messages.length ? (
            <div className="kern-ai-empty">
              <div className="kern-ai-orb large"><Command size={23} /></div>
              <strong>Ask about your stack.</strong>
              <p>Deployments, logs, incidents, uptime, issues, pull requests, and current alerts are included in each analysis snapshot.</p>
            </div>
          ) : null}

          {messages.map((message) => (
            <article className={`kern-ai-message ${message.role}`} key={message.id}>
              <div className="kern-ai-message-role">{message.role === "assistant" ? "KERN" : "YOU"}</div>
              <div>
                <div className="kern-ai-message-body">{message.content}</div>
                {message.role === "assistant" && message.model ? (
                  <span className="kern-ai-message-meta">{message.model}</span>
                ) : null}
              </div>
            </article>
          ))}

          {busy ? (
            <article className="kern-ai-message assistant">
              <div className="kern-ai-message-role">KERN</div>
              <div className="kern-ai-thinking"><Loader2 className="spin" size={14} />Analyzing current operational state…</div>
            </article>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {error ? <div className="kern-ai-error"><AlertTriangle size={14} />{error}</div> : null}

        <form className="kern-ai-input" onSubmit={submit}>
          <textarea
            rows={2}
            value={input}
            disabled={busy || status?.configured === false}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void ask(input);
              }
            }}
            placeholder={status?.configured === false ? "Configure AI Gateway in Settings first." : "Ask why something failed, what needs attention, or what to do next…"}
          />
          <button className="button primary" disabled={busy || !input.trim() || status?.configured === false}>
            {busy ? <Loader2 className="spin" size={15} /> : <Command size={15} />}
            Analyze
          </button>
        </form>
      </section>
    </div>
  );
}
