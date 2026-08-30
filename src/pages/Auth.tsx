import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound, Mail, Sparkles, Check } from "lucide-react";
import { PublicLayout, SectionHead } from "../components/site";
import { Logo } from "../components/icons";
import { Badge, Button, Card, Field, Input, Reveal } from "../components/ui";
import { PricingSection } from "./Landing";
import { login, register, resetPassword, getSettings } from "../lib/services";
import { getDb } from "../lib/db";
import { useApp } from "../lib/app";

function AuthShell({ title, sub, children, footer }: { title: string; sub: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-20 grid lg:grid-cols-[1fr_0.9fr] gap-12 items-start">
        <div className="max-w-md w-full mx-auto lg:mx-0">
          <Reveal>
            <h1 className="font-display text-[30px] font-extrabold tracking-tight">{title}</h1>
            <p className="text-[14.5px] text-muted-foreground mt-2 leading-relaxed">{sub}</p>
          </Reveal>
          <Reveal delay={100}><div className="mt-7">{children}</div></Reveal>
          {footer && <Reveal delay={160}><div className="mt-6">{footer}</div></Reveal>}
        </div>
        <Reveal delay={180} className="hidden lg:block sticky top-28">
          <div className="relative rounded-2xl border border-border bg-card p-8 overflow-hidden noise">
            <div className="absolute inset-0 dot-grid opacity-60" aria-hidden />
            <div className="relative">
              <Logo size={30} withWord={false} />
              <p className="font-display text-[22px] font-bold tracking-tight leading-snug mt-6">“We replaced four subscriptions with ChatDeck. The usage meters alone are worth it.”</p>
              <p className="text-[13px] text-muted-foreground mt-4">Priya Sharma — Head of Content, Northwind</p>
              <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                {[["26", "AI tools"], ["7 days", "free trial"], ["0", "card required"]].map(([a, b]) => (
                  <div key={b} className="rounded-xl border border-border bg-background/70 py-4">
                    <p className="font-display font-extrabold text-lg leading-none">{a}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">{b}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </PublicLayout>
  );
}

export function LoginPage() {
  const nav = useNavigate();
  const { refresh, toast } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!email) errs.email = "Email is required.";
    if (!password) errs.password = "Password is required.";
    setErr(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setTimeout(() => {
      try {
        const user = login(email, password);
        refresh();
        toast("success", `Welcome back, ${user.name.split(" ")[0]}`);
        nav(user.role === "admin" ? "/admin" : "/app");
      } catch (ex: unknown) {
        setErr({ form: (ex as Error).message });
        setBusy(false);
      }
    }, 450);
  };

  return (
    <AuthShell title="Welcome back" sub="Sign in to pick up exactly where your last draft left off."
      footer={<p className="text-[13.5px] text-muted-foreground">New here? <Link to="/register" className="font-medium text-foreground underline underline-offset-2">Start your free trial</Link></p>}>
      <Card className="p-6">
        {err.form && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/8 text-destructive text-[13px] px-3.5 py-2.5">{err.form}</div>}
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" error={err.email} required>
            <div className="relative"><Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="pl-9" autoComplete="email" /></div>
          </Field>
          <Field label="Password" error={err.password} required>
            <div className="relative"><KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pl-9" autoComplete="current-password" /></div>
          </Field>
          <div className="flex justify-end -mt-1"><Link to="/forgot" className="text-[12.5px] text-muted-foreground hover:text-foreground underline underline-offset-2">Forgot password?</Link></div>
          <Button type="submit" className="w-full" loading={busy}>Sign in <ArrowRight className="w-4 h-4" /></Button>
        </form>
      </Card>
      <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/50 p-4">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-muted-foreground mb-2.5">Demo accounts</p>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <button type="button" onClick={() => { setEmail("demo@chatdeck.ai"); setPassword("demo1234"); }} className="text-left rounded-lg border border-border bg-card px-3 py-2 hover:border-foreground/40 transition-colors">
            <span className="font-semibold block">Trial user</span><span className="text-muted-foreground font-mono text-[10.5px]">demo@chatdeck.ai</span>
          </button>
          <button type="button" onClick={() => { setEmail("admin@chatdeck.ai"); setPassword("admin1234"); }} className="text-left rounded-lg border border-border bg-card px-3 py-2 hover:border-foreground/40 transition-colors">
            <span className="font-semibold block">Admin</span><span className="text-muted-foreground font-mono text-[10.5px]">admin@chatdeck.ai</span>
          </button>
        </div>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  const nav = useNavigate();
  const { refresh, toast } = useApp();
  const s = getSettings();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email address.";
    if (form.password.length < 8) errs.password = "Minimum 8 characters.";
    if (form.confirm !== form.password) errs.confirm = "Passwords don't match.";
    setErr(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setTimeout(() => {
      try {
        const user = register(form.name, form.email, form.password);
        refresh();
        toast("success", "Trial started", `${s.trial.days} days · ${s.trial.words.toLocaleString()} words · ${s.trial.generations} generations`);
        nav("/app");
      } catch (ex: unknown) {
        const e2 = ex as Error & { code?: string };
        setErr({ form: e2.message, ...(e2.code === "EMAIL_TAKEN" ? { email: e2.message } : {}) });
        setBusy(false);
      }
    }, 550);
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  if (!s.registration.enabled) {
    return (
      <AuthShell title="Registration paused" sub="Public signups are temporarily disabled by the administrator.">
        <Card className="p-6 text-[14px] text-muted-foreground">Please contact <a className="underline text-foreground" href={`mailto:${s.site.supportEmail}`}>{s.site.supportEmail}</a> for access.</Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your workspace" sub={`Start free — ${s.trial.days} days, ${s.trial.words.toLocaleString()} words and ${s.trial.generations} generations. No credit card.`}
      footer={<p className="text-[13.5px] text-muted-foreground">Already have an account? <Link to="/login" className="font-medium text-foreground underline underline-offset-2">Sign in</Link></p>}>
      <Card className="p-6">
        {err.form && !err.email && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/8 text-destructive text-[13px] px-3.5 py-2.5">{err.form}</div>}
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Full name" error={err.name} required><Input value={form.name} onChange={set("name")} placeholder="Ada Lovelace" autoComplete="name" /></Field>
          <Field label="Work email" error={err.email} required><Input type="email" value={form.email} onChange={set("email")} placeholder="ada@company.com" autoComplete="email" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Password" error={err.password} required><Input type="password" value={form.password} onChange={set("password")} placeholder="8+ characters" autoComplete="new-password" /></Field>
            <Field label="Confirm" error={err.confirm} required><Input type="password" value={form.confirm} onChange={set("confirm")} placeholder="Repeat it" autoComplete="new-password" /></Field>
          </div>
          <Button type="submit" className="w-full" loading={busy}><Sparkles className="w-4 h-4" /> Start {s.trial.days}-day free trial</Button>
          <p className="text-[11.5px] text-muted-foreground text-center leading-relaxed">By continuing you agree to the Terms of Service and Privacy Policy. You'll be asked for payment only if you choose a paid plan.</p>
        </form>
      </Card>
    </AuthShell>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pass, setPass] = useState({ p1: "", p2: "" });
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const nav = useNavigate();
  const { toast } = useApp();

  return (
    <AuthShell title="Reset password" sub={sent ? "Since this is a local preview, reset right here — in production this step happens over a secure emailed link." : "Enter your account email and we'll issue a reset."}
      footer={<p className="text-[13.5px] text-muted-foreground"><Link to="/login" className="font-medium text-foreground underline underline-offset-2">← Back to sign in</Link></p>}>
      <Card className="p-6">
        {!sent ? (
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!email) { setErr("Email is required."); return; } setErr(""); setSent(true); }} noValidate>
            <Field label="Email" error={err} required><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
            <Button type="submit" className="w-full">Send reset link</Button>
          </form>
        ) : !done ? (
          <form className="space-y-4" onSubmit={e => {
            e.preventDefault();
            if (pass.p1.length < 8) { setErr("Minimum 8 characters."); return; }
            if (pass.p1 !== pass.p2) { setErr("Passwords don't match."); return; }
            try { resetPassword(email, pass.p1); setDone(true); toast("success", "Password updated", "Sign in with your new password."); }
            catch (ex: unknown) { setErr((ex as Error).message); }
          }} noValidate>
            {err && <div className="rounded-lg border border-destructive/30 bg-destructive/8 text-destructive text-[13px] px-3.5 py-2.5">{err}</div>}
            <Field label="New password" required><Input type="password" value={pass.p1} onChange={e => setPass(p => ({ ...p, p1: e.target.value }))} placeholder="8+ characters" /></Field>
            <Field label="Confirm new password" required><Input type="password" value={pass.p2} onChange={e => setPass(p => ({ ...p, p2: e.target.value }))} placeholder="Repeat it" /></Field>
            <Button type="submit" className="w-full">Update password</Button>
          </form>
        ) : (
          <div className="text-center py-4">
            <span className="inline-flex w-12 h-12 rounded-full bg-emerald-600/12 text-emerald-600 items-center justify-center mb-4"><Check className="w-6 h-6" /></span>
            <p className="font-semibold">All set!</p>
            <Button className="mt-5" onClick={() => nav("/login")}>Go to sign in</Button>
          </div>
        )}
      </Card>
    </AuthShell>
  );
}

/* ================= pricing page ================= */
export function PricingPage() {
  const db = getDb();
  const plans = db.plans.filter(p => p.active && !p.isTrial).sort((a, b) => a.sort - b.sort);
  const rows: { label: string; get: (p: typeof plans[0]) => React.ReactNode }[] = [
    { label: "Monthly words", get: p => p.wordsLimit === -1 ? "Unlimited" : p.wordsLimit.toLocaleString() },
    { label: "Monthly generations", get: p => p.generationsLimit === -1 ? "Unlimited" : p.generationsLimit.toLocaleString() },
    { label: "Trial-tier tools", get: () => <Check className="w-4 h-4 mx-auto text-emerald-600" /> },
    { label: "Article & blog writers", get: p => (p.tier === "starter" || p.tier === "pro" || p.tier === "business" || p.tier === "enterprise") ? <Check className="w-4 h-4 mx-auto text-emerald-600" /> : "—" },
    { label: "SEO suite & ad copy", get: p => (p.tier === "pro" || p.tier === "business" || p.tier === "enterprise") ? <Check className="w-4 h-4 mx-auto text-emerald-600" /> : "—" },
    { label: "Press & video tools", get: p => (p.tier === "business" || p.tier === "enterprise") ? <Check className="w-4 h-4 mx-auto text-emerald-600" /> : "—" },
    { label: "Team seats", get: p => (p.tier === "business" ? "3 included" : p.tier === "enterprise" ? "Custom" : "1") },
    { label: "Support", get: p => (p.tier === "enterprise" ? "Dedicated CSM" : p.tier === "pro" || p.tier === "business" ? "Priority" : "Email") },
  ];
  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        <SectionHead eyebrow="Pricing" title={<>Plans that scale with your <em className="font-serif-accent italic font-normal">word count</em></>} sub="Every plan includes the full dashboard, history and every tool its tier unlocks. Prices and limits are managed from the admin panel — what you see is live." />
        <PricingSection />
        <Reveal className="mt-20">
          <h2 className="font-display text-[24px] font-bold tracking-tight text-center mb-8">Compare everything</h2>
          <div className="overflow-x-auto scroll-slim rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-semibold px-5 py-4 w-[220px]">Feature</th>
                  {plans.map(p => <th key={p.id} className="px-4 py-4 font-display font-bold">{p.name}{p.isPopular && <Badge className="ml-2">Popular</Badge>}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.label} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3.5 text-muted-foreground">{r.label}</td>
                    {plans.map(p => <td key={p.id} className="px-4 py-3.5 text-center font-medium">{r.get(p)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal className="mt-12">
          <Card className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div>
              <h3 className="font-display font-bold text-lg tracking-tight">Still on the fence?</h3>
              <p className="text-[13.5px] text-muted-foreground mt-1">Try everything free for {getSettings().trial.days} days. Your drafts stay yours either way.</p>
            </div>
            <Link to="/register"><Button size="lg">Start free trial <ArrowRight className="w-4 h-4" /></Button></Link>
          </Card>
        </Reveal>
      </div>
    </PublicLayout>
  );
}
