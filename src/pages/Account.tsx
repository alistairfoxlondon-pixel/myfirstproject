import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Copy, RotateCcw, Trash2, CreditCard, Check, AlertTriangle, History as HistoryIcon, Receipt, ArrowRight } from "lucide-react";
import AppShell from "./AppShell";
import { ToolIcon } from "../components/icons";
import { Badge, Button, Card, CopyBtn, EmptyState, Field, Input, Modal, Progress, RichText, Select, cn } from "../components/ui";
import { useApp } from "../lib/app";
import { getDb, Plan, dayKey, monthKey, nowISO } from "../lib/db";
import {
  cancelAtPeriodEnd, changePassword, deleteAccount, deleteGeneration, fmtDate, fmtDateTime,
  fmtLimit, fmtMoney, fmtNum, listGenerations, listInvoices, resumeSubscription, retryPayment,
  subscribe, updateProfile,
} from "../lib/services";

/* ================= history ================= */
export function HistoryPage() {
  const { user, access, toast } = useApp();
  const nav = useNavigate();
  const db = getDb();
  const [toolFilter, setToolFilter] = useState("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [shown, setShown] = useState(25);

  const all = useMemo(() => (user ? listGenerations(user.id) : []), [user, access]);
  const usedTools = useMemo(() => [...new Set(all.map(g => g.toolSlug))], [all]);
  const list = all
    .filter(g => toolFilter === "all" || g.toolSlug === toolFilter)
    .filter(g => !q || (g.output + " " + g.toolName + " " + Object.values(g.inputs).join(" ")).toLowerCase().includes(q.toLowerCase()));
  const totalWords = list.reduce((s, g) => s + g.words, 0);

  if (!user) return null;

  return (
    <AppShell title="History" sub={`${list.length} drafts · ${fmtNum(totalWords)} words generated`}>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search drafts…"
            className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/60" />
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
        <div className="w-full sm:w-64">
          <Select value={toolFilter} onChange={e => setToolFilter(e.target.value)}
            options={[{ value: "all", label: "All tools" }, ...usedTools.map(s => ({ value: s, label: db.tools.find(t => t.slug === s)?.name || s }))]} />
        </div>
      </div>

      {list.length === 0 ? (
        <Card><EmptyState icon={<HistoryIcon className="w-5 h-5" />} title="No drafts yet"
          body={q || toolFilter !== "all" ? "Nothing matches your filters." : "Everything you generate lands here with its inputs, so you can re-run or refine it later."}
          action={<Button onClick={() => nav("/app/tools")}>Open the tools</Button>} /></Card>
      ) : (
        <div className="space-y-2.5">
          {list.slice(0, shown).map(g => {
            const open = openId === g.id;
            const icon = db.tools.find(t => t.slug === g.toolSlug)?.icon || "pen";
            return (
              <Card key={g.id} className={cn("overflow-hidden transition-all duration-300", open && "border-foreground/40 shadow-md")}>
                <button onClick={() => setOpenId(open ? null : g.id)} className="w-full flex items-center gap-3.5 px-4 sm:px-5 py-3.5 text-left" aria-expanded={open}>
                  <span className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0"><ToolIcon name={icon} className="w-4.5 h-4.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[13.5px]">{g.toolName.replace("AI ", "")}</span>
                      <Badge tone="muted" className="font-mono text-[10px]">{g.words}w</Badge>
                      <Badge tone="outline" className="font-mono text-[10px] hidden sm:inline-flex">{g.provider}/{g.model}</Badge>
                    </span>
                    <span className="block text-[12px] text-muted-foreground truncate mt-0.5">{Object.values(g.inputs).find(v => v && v.length > 3) || "—"}</span>
                  </span>
                  <span className="text-right shrink-0 hidden sm:block">
                    <span className="block text-[12px] font-medium">{fmtDateTime(g.createdAt)}</span>
                    <span className="block text-[10.5px] text-muted-foreground font-mono">{(g.durationMs / 1000).toFixed(1)}s</span>
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-300", open && "rotate-180")} />
                </button>
                {open && (
                  <div className="border-t border-border bg-muted/30 px-4 sm:px-5 py-4 animate-fade-in">
                    <div className="grid sm:grid-cols-[220px_1fr] gap-4">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Inputs</p>
                        <dl className="space-y-1.5">
                          {Object.entries(g.inputs).filter(([, v]) => v).slice(0, 6).map(([k, v]) => (
                            <div key={k} className="text-[12px]"><dt className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt><dd className="font-medium truncate" title={v}>{v}</dd></div>
                          ))}
                        </dl>
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Output</p>
                        <div className="max-h-[320px] overflow-y-auto scroll-slim pr-2"><RichText text={g.output} /></div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4 pt-3.5 border-t border-border">
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(g.output).catch(() => undefined); toast("success", "Copied to clipboard"); }}><Copy className="w-3.5 h-3.5" /> Copy</Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        try { sessionStorage.setItem("chatdeck.prefill", JSON.stringify({ slug: g.toolSlug, inputs: g.inputs })); } catch { /* noop */ }
                        nav(`/app/tools/${g.toolSlug}`);
                      }}><RotateCcw className="w-3.5 h-3.5" /> Re-run with same inputs</Button>
                      {confirmDel === g.id ? (
                        <span className="inline-flex items-center gap-1.5 ml-auto">
                          <span className="text-[12px] text-muted-foreground">Delete permanently?</span>
                          <Button size="sm" variant="destructive" onClick={() => { deleteGeneration(user.id, g.id); setConfirmDel(null); toast("info", "Draft deleted"); }}>Yes, delete</Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDel(null)}>Keep</Button>
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:bg-destructive/10" onClick={() => setConfirmDel(g.id)}><Trash2 className="w-3.5 h-3.5" /> Delete</Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          {list.length > shown && (
            <div className="text-center pt-2"><Button variant="outline" onClick={() => setShown(s => s + 25)}>Show more ({list.length - shown} remaining)</Button></div>
          )}
        </div>
      )}
    </AppShell>
  );
}

/* ================= billing ================= */
export function BillingPage() {
  const { user, access, refresh, toast } = useApp();
  const nav = useNavigate();
  const db = getDb();
  const [checkout, setCheckout] = useState<{ plan: Plan; period: "monthly" | "yearly" } | null>(null);
  const [cancelModal, setCancelModal] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user || !access) return null;
  const plans = db.plans.filter(p => p.active && !p.isTrial).sort((a, b) => a.sort - b.sort);
  const invoices = listInvoices(user.id);
  const currentPlanId = access.plan?.id;
  const month = monthKey(nowISO());
  const usage = db.usage.find(u => u.userId === user.id && u.month === month);

  return (
    <AppShell title="Billing & subscription" sub="Plans, invoices and your payment method">
      {/* current status */}
      <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-3.5">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Current plan</p>
              <div className="flex items-center gap-3 mt-2">
                <h2 className="font-display text-[26px] font-extrabold tracking-tight leading-none">{access.plan?.name || "None"}</h2>
                <Badge tone={access.effective === "active" ? "success" : access.effective === "trialing" ? "warn" : "danger"} className="capitalize">{access.effective}</Badge>
                {access.subscription?.cancelAtPeriodEnd && access.effective === "active" && <Badge tone="warn">cancels soon</Badge>}
              </div>
              <p className="text-[13px] text-muted-foreground mt-2">
                {access.plan && access.plan.monthly > 0
                  ? <>{fmtMoney(access.subscription?.period === "yearly" ? access.plan.yearly : access.plan.monthly)} / {access.subscription?.period === "yearly" ? "year" : "month"} · {access.subscription?.cancelAtPeriodEnd ? "ends" : "renews"} {fmtDate(access.subscription?.currentPeriodEnd || nowISO())}</>
                  : <>Free · {access.effective === "trialing" ? `trial ends ${fmtDate(access.subscription?.currentPeriodEnd || nowISO())}` : "no active subscription"}</>}
              </p>
            </div>
            <div className="text-right">
              {access.subscription?.payment ? (
                <div className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-background px-3.5 py-2.5">
                  <CreditCard className="w-4.5 h-4.5 text-muted-foreground" />
                  <span className="text-left"><span className="block text-[12.5px] font-semibold leading-none">{access.subscription.payment.brand} •••• {access.subscription.payment.last4}</span>
                    <span className="block text-[10.5px] text-muted-foreground mt-1">expires {access.subscription.payment.exp}</span></span>
                </div>
              ) : (
                <span className="text-[12px] text-muted-foreground font-mono">no card on file</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 mt-5 pt-5 border-t border-border">
            {access.effective === "past_due" && <Button onClick={() => { setBusy(true); setTimeout(() => { try { retryPayment(user); refresh(); toast("success", "Payment recovered", "Your subscription is active again."); } catch (e) { toast("error", (e as Error).message); } setBusy(false); }, 900); }} loading={busy}>Retry payment · {fmtMoney(db.invoices.find(i => i.userId === user.id && i.status === "open")?.amount || 0)}</Button>}
            {access.effective === "active" && !access.subscription?.cancelAtPeriodEnd && <Button variant="outline" onClick={() => setCancelModal(true)}>Cancel at period end</Button>}
            {access.subscription?.cancelAtPeriodEnd && <Button variant="outline" onClick={() => { resumeSubscription(user); refresh(); toast("success", "Plan kept", "Your subscription will renew as usual."); }}><Check className="w-4 h-4" /> Keep my plan</Button>}
            {(access.effective === "expired" || access.effective === "none" || access.effective === "canceled") && <Button onClick={() => document.querySelector("#plans")?.scrollIntoView({ behavior: "smooth" })}>Choose a plan <ArrowRight className="w-4 h-4" /></Button>}
            {access.effective === "trialing" && <Button onClick={() => document.querySelector("#plans")?.scrollIntoView({ behavior: "smooth" })}>Upgrade before trial ends</Button>}
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <h3 className="font-display font-bold text-[15px] tracking-tight mb-4">This cycle's usage</h3>
          {[
            { l: "Words", v: access.wordsUsed, m: access.wordsLimit },
            { l: "Generations", v: access.gensUsed, m: access.gensLimit },
          ].map(r => (
            <div key={r.l} className="mb-4 last:mb-0">
              <div className="flex justify-between text-[12.5px] mb-1.5"><span className="text-muted-foreground">{r.l}</span><span className="font-mono tabular">{fmtNum(r.v)} / {fmtLimit(r.m)}</span></div>
              <Progress value={r.v} max={r.m === -1 ? r.v + 1 : r.m} />
            </div>
          ))}
          <p className="text-[11.5px] text-muted-foreground mt-4 pt-4 border-t border-border">Cycle resets monthly on the 1st. Top tool: <strong className="text-foreground">{usage && Object.entries(usage.byTool).sort((a, b) => b[1] - a[1])[0] ? db.tools.find(t => t.slug === Object.entries(usage!.byTool).sort((a, b) => b[1] - a[1])[0][0])?.name : "—"}</strong></p>
        </Card>
      </div>

      {/* plans */}
      <h2 id="plans" className="font-display text-[19px] font-bold tracking-tight mt-10 mb-4 scroll-mt-24">Change plan</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {plans.map(p => {
          const current = p.id === currentPlanId && access.effective === "active";
          return (
            <Card key={p.id} className={cn("p-5 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-md", p.isPopular && "border-foreground", current && "ring-2 ring-foreground/70")}>
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-[15px] tracking-tight">{p.name}</h3>
                {p.isPopular && <Badge className="text-[9.5px]">Popular</Badge>}
              </div>
              <p className="font-display text-[26px] font-extrabold tracking-tight mt-2 tabular">${p.monthly}<span className="text-[12px] font-medium text-muted-foreground">/mo</span></p>
              <p className="font-mono text-[10.5px] text-muted-foreground">${p.yearly}/yr</p>
              <ul className="mt-3.5 space-y-1.5 flex-1">
                <li className="text-[12px] flex gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-px" />{p.wordsLimit === -1 ? "Unlimited" : fmtNum(p.wordsLimit)} words/mo</li>
                <li className="text-[12px] flex gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-px" />{p.generationsLimit === -1 ? "Unlimited" : fmtNum(p.generationsLimit)} generations</li>
                <li className="text-[12px] flex gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-px" />{p.tier === "starter" ? "Core" : p.tier === "pro" ? "Core + SEO suite" : "Full"} tool access</li>
              </ul>
              <Button className="mt-4" variant={current ? "secondary" : p.isPopular ? "default" : "outline"} size="sm" disabled={current}
                onClick={() => setCheckout({ plan: p, period: "monthly" })}>
                {current ? "Current plan" : access.plan && p.sort < (access.plan.sort ?? 99) ? "Downgrade" : "Upgrade"}
              </Button>
            </Card>
          );
        })}
      </div>

      {/* invoices */}
      <h2 className="font-display text-[19px] font-bold tracking-tight mt-10 mb-4">Invoices</h2>
      <Card className="overflow-hidden">
        {invoices.length === 0 ? (
          <EmptyState icon={<Receipt className="w-5 h-5" />} title="No invoices yet" body="Invoices appear here the moment a payment is processed." />
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead><tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-5 py-3 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">Invoice</th>
                <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">Date</th>
                <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">Plan</th>
                <th className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">Amount</th>
                <th className="px-5 py-3 text-right font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">Status</th>
              </tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-[12px]">{inv.number}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{fmtDate(inv.createdAt)}</td>
                    <td className="px-4 py-3.5">{inv.planName} · {inv.period} · •••• {inv.last4}</td>
                    <td className="px-4 py-3.5 font-semibold tabular">${inv.amount.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-right"><Badge tone={inv.status === "paid" ? "success" : "warn"} className="capitalize">{inv.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* checkout modal */}
      <CheckoutModal state={checkout} onClose={() => setCheckout(null)} onSuccess={() => { setCheckout(null); refresh(); }} />

      {/* cancel modal */}
      <Modal open={cancelModal} onClose={() => setCancelModal(false)} title="Cancel subscription?"
        footer={<>
          <Button variant="ghost" onClick={() => setCancelModal(false)}>Keep plan</Button>
          <Button variant="destructive" onClick={() => { cancelAtPeriodEnd(user); setCancelModal(false); refresh(); toast("info", "Cancellation scheduled", `Access continues until ${fmtDate(access.subscription?.currentPeriodEnd || nowISO())}.`); }}>Cancel at period end</Button>
        </>}>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed">You'll keep full access until <strong className="text-foreground">{fmtDate(access.subscription?.currentPeriodEnd || nowISO())}</strong>. After that, the workspace switches to read-only — your history stays. You can resume anytime before then.</p>
      </Modal>
    </AppShell>
  );
}

function CheckoutModal({ state, onClose, onSuccess }: { state: { plan: Plan; period: "monthly" | "yearly" } | null; onClose: () => void; onSuccess: () => void }) {
  const { user, toast } = useApp();
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [card, setCard] = useState({ name: "", number: "", exp: "", cvc: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  React.useEffect(() => { if (state) { setPeriod(state.period); setErr(""); setBusy(false); } }, [state]);
  if (!state || !user) return null;
  const amount = period === "monthly" ? state.plan.monthly : state.plan.yearly;

  const pay = () => {
    setErr("");
    setBusy(true);
    setTimeout(() => {
      try {
        subscribe(user, state.plan.id, period, card);
        toast("success", `Welcome to ${state.plan.name}`, "Your new limits are active immediately.");
        onSuccess();
      } catch (e) { setErr((e as Error).message); setBusy(false); }
    }, 1200);
  };

  return (
    <Modal open={!!state} onClose={() => !busy && onClose()} title={`Checkout — ${state.plan.name}`} wide
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Back</Button>
        <Button onClick={pay} loading={busy}><CreditCard className="w-4 h-4" /> Pay ${amount.toFixed(2)}</Button>
      </>}>
      <div className="grid sm:grid-cols-[0.85fr_1.15fr] gap-5">
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground">Summary</p>
          <p className="font-display font-bold text-lg tracking-tight mt-2">{state.plan.name}</p>
          <div className="flex gap-1.5 mt-3">
            {(["monthly", "yearly"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} className={cn("flex-1 rounded-lg border px-2 py-2 text-[12px] font-medium capitalize transition-all", period === p ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground/40")}>
                {p}{p === "yearly" && <span className="block text-[9.5px] opacity-70">save 20%</span>}
              </button>
            ))}
          </div>
          <dl className="mt-4 space-y-2 text-[12.5px]">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-mono">${amount.toFixed(2)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="font-mono">$0.00</dd></div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold"><dt>Total due today</dt><dd className="font-mono">${amount.toFixed(2)}</dd></div>
          </dl>
          <ul className="mt-4 space-y-1.5">
            {state.plan.features.slice(0, 3).map(f => <li key={f} className="text-[11.5px] text-muted-foreground flex gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-px" />{f}</li>)}
          </ul>
        </div>
        <div className="space-y-3.5">
          {err && <div className="rounded-lg border border-destructive/30 bg-destructive/8 text-destructive text-[12.5px] px-3.5 py-2.5 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{err}</div>}
          <Field label="Name on card" required><Input value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value }))} placeholder="Ada Lovelace" /></Field>
          <Field label="Card number" required help="Demo checkout — use any 16 digits, e.g. 4242 4242 4242 4242">
            <Input inputMode="numeric" value={card.number} onChange={e => setCard(c => ({ ...c, number: e.target.value.replace(/[^\d ]/g, "").slice(0, 19) }))} placeholder="4242 4242 4242 4242" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry" required><Input value={card.exp} onChange={e => { let v = e.target.value.replace(/[^\d/]/g, "").slice(0, 5); if (v.length === 2 && !v.includes("/")) v += "/"; setCard(c => ({ ...c, exp: v })); }} placeholder="MM/YY" /></Field>
            <Field label="CVC" required><Input inputMode="numeric" value={card.cvc} onChange={e => setCard(c => ({ ...c, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="123" /></Field>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5"><CreditCard className="w-3.5 h-3.5 shrink-0 mt-px" />Payments are processed by a swappable gateway adapter (Stripe-compatible). Card data never touches our servers in this preview.</p>
        </div>
      </div>
    </Modal>
  );
}

/* ================= settings ================= */
export function SettingsPage() {
  const { user, refresh, signOut, toast, theme, toggleTheme } = useApp();
  const nav = useNavigate();
  const [profile, setProfile] = useState({ name: user?.name || "", email: user?.email || "", company: user?.company || "" });
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErr, setPwErr] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState("");
  const [busy, setBusy] = useState<"" | "profile" | "pw">("");

  if (!user) return null;

  return (
    <AppShell title="Settings" sub="Profile, security and workspace preferences">
      <div className="grid lg:grid-cols-2 gap-3.5 items-start">
        <div className="space-y-3.5">
          <Card className="p-5 sm:p-6">
            <h2 className="font-display font-bold text-[15.5px] tracking-tight mb-1">Profile</h2>
            <p className="text-[12.5px] text-muted-foreground mb-5">How you appear across the workspace.</p>
            <div className="space-y-4">
              <Field label="Full name" required><Input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} /></Field>
              <Field label="Email" required><Input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} /></Field>
              <Field label="Company" help="Optional — appears on invoices."><Input value={profile.company} onChange={e => setProfile(p => ({ ...p, company: e.target.value }))} placeholder="Acme Inc." /></Field>
              <Button loading={busy === "profile"} onClick={() => {
                setBusy("profile");
                setTimeout(() => {
                  try { updateProfile(user.id, profile); refresh(); toast("success", "Profile saved"); }
                  catch (e) { toast("error", (e as Error).message); }
                  setBusy("");
                }, 500);
              }}>Save changes</Button>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-display font-bold text-[15.5px] tracking-tight mb-1">Appearance</h2>
            <p className="text-[12.5px] text-muted-foreground mb-5">Theme preference is stored per browser.</p>
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3.5">
              <div><p className="text-[13.5px] font-medium">Dark mode</p><p className="text-[12px] text-muted-foreground mt-0.5">Currently {theme}</p></div>
              <button onClick={toggleTheme} role="switch" aria-checked={theme === "dark"}
                className={cn("relative h-[22px] w-10 rounded-full transition-colors", theme === "dark" ? "bg-primary" : "bg-muted border border-border")}>
                <span className={cn("absolute top-[3px] h-4 w-4 rounded-full transition-all duration-200", theme === "dark" ? "left-[21px] bg-primary-foreground" : "left-[3px] bg-muted-foreground/60")} />
              </button>
            </div>
          </Card>
        </div>

        <div className="space-y-3.5">
          <Card className="p-5 sm:p-6">
            <h2 className="font-display font-bold text-[15.5px] tracking-tight mb-1">Security</h2>
            <p className="text-[12.5px] text-muted-foreground mb-5">Passwords are hashed — never stored in plain text.</p>
            {pwErr && <div className="rounded-lg border border-destructive/30 bg-destructive/8 text-destructive text-[12.5px] px-3.5 py-2.5 mb-4">{pwErr}</div>}
            <div className="space-y-4">
              <Field label="Current password" required><Input type="password" value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} autoComplete="current-password" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="New password" required><Input type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} autoComplete="new-password" /></Field>
                <Field label="Confirm" required><Input type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" /></Field>
              </div>
              <Button loading={busy === "pw"} variant="outline" onClick={() => {
                setPwErr("");
                if (pw.next !== pw.confirm) { setPwErr("New passwords don't match."); return; }
                setBusy("pw");
                setTimeout(() => {
                  try { changePassword(user.id, pw.current, pw.next); setPw({ current: "", next: "", confirm: "" }); toast("success", "Password updated"); }
                  catch (e) { setPwErr((e as Error).message); }
                  setBusy("");
                }, 500);
              }}>Update password</Button>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="font-display font-bold text-[15.5px] tracking-tight mb-4">Account</h2>
            <dl className="space-y-2.5 text-[13px]">
              {[
                ["Member since", fmtDate(user.createdAt)],
                ["Role", user.role === "admin" ? "Administrator" : "Member"],
                ["Status", user.status === "active" ? "Active" : "Suspended"],
                ["Email verification", user.verifiedAt ? "Verified" : "Pending"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium capitalize">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-5 pt-5 border-t border-border">
              <p className="text-[13px] font-semibold text-destructive">Danger zone</p>
              <p className="text-[12px] text-muted-foreground mt-1 mb-3.5">Deletes your account, drafts, usage and invoices permanently.</p>
              <Button variant="destructive" size="sm" onClick={() => { setDelText(""); setDelOpen(true); }}><Trash2 className="w-3.5 h-3.5" /> Delete account</Button>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Delete account permanently?"
        footer={<>
          <Button variant="ghost" onClick={() => setDelOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={delText !== "DELETE"} onClick={() => { deleteAccount(user.id); signOut(); nav("/"); }}>I understand — delete</Button>
        </>}>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed">This wipes <strong className="text-foreground">{user.email}</strong> and every draft, invoice and usage record. There is no undo.</p>
        <div className="mt-4">
          <Field label='Type "DELETE" to confirm' required><Input value={delText} onChange={e => setDelText(e.target.value)} placeholder="DELETE" className="font-mono" /></Field>
        </div>
      </Modal>
    </AppShell>
  );
}
