"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { ApiError, getFixtures, type StorePolicy } from "@/lib/api";

const opts = [
  { k: "auto", l: "Autonomous resolution", d: "Resolve eligible tickets without human approval." },
  { k: "idem", l: "Idempotency check before retry", d: "Query DB state after any timeout before re-calling a tool." },
  { k: "verify", l: "Deterministic final verification", d: "Block resolution unless DB state matches planned reply." },
  { k: "refund", l: "Allow refunds over $200", d: "Escalate high-value refunds to a human when off." },
];

const outcomes = [
  { k: "arranged", l: "Arranged", d: "Replacement reserved, return created, label ready." },
  { k: "clarification", l: "Clarification", d: "Agent parks the case and asks the customer for specifics." },
  { k: "denial", l: "Denial", d: "Policy blocks the exchange; the reason quotes the facts." },
  { k: "escalation", l: "Escalation", d: "A human specialist takes over with full context." },
] as const;

const lifecycle = [
  "Reserve replacement",
  "Create return",
  "Create label",
  "Verify & arrange",
];

function PolicyPanel() {
  const [policy, setPolicy] = useState<StorePolicy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getFixtures().then(
      (f) => { if (!cancelled) setPolicy(f.policy); },
      (err) => {
        if (!cancelled) {
          setError(err instanceof ApiError && err.status === 0
            ? "Service unreachable."
            : err instanceof Error ? err.message : "Policy failed to load");
        }
      },
    );
    return () => { cancelled = true; };
  }, []);

  return (
    <section aria-label="Store policy" className="panel space-y-5 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold">Store policy</h2>
          <p className="text-xs text-muted-foreground">
            Read-only — enforced by the agent on every ticket.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-warning">{error}</p>}
      {!policy && !error && (
        <p className="text-sm text-muted-foreground">Loading policy…</p>
      )}
      {policy && (
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-hairline bg-background/60 p-4">
            <dt className="text-xs text-muted-foreground">Return window</dt>
            <dd className="mt-1 text-lg font-semibold">{policy.window_days} days</dd>
          </div>
          <div className="rounded-xl border border-hairline bg-background/60 p-4">
            <dt className="text-xs text-muted-foreground">Eligible status</dt>
            <dd className="mt-1 text-lg font-semibold">{policy.eligible_status}</dd>
          </div>
          <div className="rounded-xl border border-hairline bg-background/60 p-4">
            <dt className="text-xs text-muted-foreground">Final sale</dt>
            <dd className="mt-1 text-lg font-semibold">
              {policy.final_sale_excluded ? "Excluded" : "Allowed"}
            </dd>
          </div>
        </dl>
      )}

      <div>
        <h3 className="text-sm font-semibold">Every ticket ends in exactly one outcome</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {outcomes.map((o) => (
            <div key={o.k} className="rounded-xl border border-hairline bg-background/60 p-4">
              <p className="text-sm font-semibold capitalize">{o.l}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{o.d}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Exchange lifecycle</h3>
        <ol className="mt-2 flex flex-wrap items-center gap-2">
          {lifecycle.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-hairline bg-background/60 px-3 py-1.5 font-mono text-xs">
                {i + 1}. {step}
              </span>
              {i < lifecycle.length - 1 && (
                <span aria-hidden="true" className="text-muted-foreground">→</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const [on, setOn] = useState<Record<string, boolean>>({ auto: true, idem: true, verify: true, refund: false });
  return (
    <AppShell crumbs={[{ label: "SwapDesk", to: "/" }, { label: "Settings" }]}>
      <PageTitle title="Settings" sub="Guardrails for swapdesk-agent v2.4.1" />
      <div className="space-y-4">
      <PolicyPanel />
      <div className="panel divide-y divide-hairline">
        {opts.map((o) => (
          <div key={o.k} className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{o.l}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{o.d}</p>
            </div>
            <button
              role="switch"
              aria-checked={on[o.k]}
              aria-label={o.l}
              onClick={() => {
                setOn({ ...on, [o.k]: !on[o.k] });
                toast(`${o.l} ${on[o.k] ? "disabled" : "enabled"}`);
              }}
              className={`relative h-6 w-11 shrink-0 rounded-full border border-hairline transition-colors ${on[o.k] ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-foreground transition-all ${on[o.k] ? "left-[22px]" : "left-0.5"}`}
              />
            </button>
          </div>
        ))}
      </div>
      </div>
    </AppShell>
  );
}
