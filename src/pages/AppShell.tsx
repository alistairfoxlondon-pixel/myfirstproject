import React, { useState } from "react";
import { Navigate, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Blocks, History, CreditCard, Settings, LogOut, Menu, X, ArrowRight, AlertTriangle, Clock3, Plus, LockKeyhole, BookOpen, Plug } from "lucide-react";
import { Logo } from "../components/icons";
import { Badge, Button, Progress, cn } from "../components/ui";
import { ThemeToggle } from "../components/site";
import { useApp } from "../lib/app";
import { fmtLimit, fmtNum } from "../lib/services";
import { createDoc } from "../lib/content";

const NAV = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/studio", label: "Content Studio", icon: BookOpen },
  { to: "/app/tools", label: "AI Tools", icon: Blocks },
  { to: "/app/history", label: "History", icon: History },
  { to: "/app/integrations", label: "Integrations", icon: Plug },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function UsageWidget({ compact = false }: { compact?: boolean }) {
  const { access: a } = useApp();
  const plan = a?.plan ?? null;
  if (!a || !plan) return null;
  const trialing = a.effective === "trialing";
  return (
    <div className={cn("rounded-xl border border-border bg-background p-4", compact && "p-3.5")}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-[13px]">{plan.name} plan</span>
        <Badge tone={trialing ? "warn" : a.effective === "active" ? "success" : "danger"} className="capitalize">{a.effective}</Badge>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-[11.5px] mb-1.5">
            <span className="text-muted-foreground">Words</span>
            <span className="font-mono tabular">{fmtNum(a.wordsUsed)} / {fmtLimit(a.wordsLimit)}</span>
          </div>
          <Progress value={a.wordsUsed} max={a.wordsLimit === -1 ? a.wordsUsed + 1 : a.wordsLimit} />
        </div>
        <div>
          <div className="flex justify-between text-[11.5px] mb-1.5">
            <span className="text-muted-foreground">Generations</span>
            <span className="font-mono tabular">{fmtNum(a.gensUsed)} / {fmtLimit(a.gensLimit)}</span>
          </div>
          <Progress value={a.gensUsed} max={a.gensLimit === -1 ? a.gensUsed + 1 : a.gensLimit} />
        </div>
      </div>
      <p className={cn("mt-3.5 pt-3 border-t border-border text-[11.5px] flex items-center gap-1.5", trialing ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
        <Clock3 className="w-3.5 h-3.5" />
        {trialing ? `${a.daysLeft} trial day${a.daysLeft === 1 ? "" : "s"} left` : a.subscription?.cancelAtPeriodEnd ? `Ends in ${a.daysLeft} days` : `Renews in ${a.daysLeft} days`}
      </p>
    </div>
  );
}

export default function AppShell({ title, sub, children, actions }: { title: string; sub?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  const { user, access, signOut, toast } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  if (user.status === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <span className="inline-flex w-14 h-14 rounded-xl bg-destructive/10 text-destructive items-center justify-center mb-5"><LockKeyhole className="w-6 h-6" /></span>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Account suspended</h1>
          <p className="text-[14px] text-muted-foreground mt-2.5 leading-relaxed">Your account has been suspended by an administrator. If you believe this is a mistake, contact <a href="mailto:support@chatdeck.ai" className="underline text-foreground">support@chatdeck.ai</a>.</p>
          <Button variant="outline" className="mt-6" onClick={() => { signOut(); toast("info", "Signed out"); }}>Sign out</Button>
        </div>
      </div>
    );
  }

  const Banner = () => {
    if (!access) return null;
    if (access.effective === "expired")
      return (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/8 px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between animate-fade-up">
          <div className="flex items-start gap-3"><AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div><p className="font-semibold text-[14px]">Your free trial has ended</p><p className="text-[12.5px] text-muted-foreground mt-0.5">Upgrade to keep generating — your history and drafts are safe.</p></div>
          </div>
          <Button size="sm" onClick={() => nav("/app/billing")}>Choose a plan <ArrowRight className="w-3.5 h-3.5" /></Button>
        </div>
      );
    if (access.effective === "past_due")
      return (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/8 px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between animate-fade-up">
          <div className="flex items-start gap-3"><AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div><p className="font-semibold text-[14px]">Payment failed</p><p className="text-[12.5px] text-muted-foreground mt-0.5">Generation is paused until your last invoice is settled.</p></div>
          </div>
          <Button size="sm" variant="outline" onClick={() => nav("/app/billing")}>Update payment</Button>
        </div>
      );
    if (access.subscription?.cancelAtPeriodEnd && access.effective === "active")
      return (
        <div className="mb-6 rounded-xl border border-border bg-muted/60 px-4 sm:px-5 py-3.5 flex items-center gap-3 text-[13px] animate-fade-up">
          <Clock3 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>Your plan ends in <strong>{access.daysLeft} days</strong> and won't renew. <button className="underline underline-offset-2 font-medium" onClick={() => nav("/app/billing")}>Keep my plan</button></span>
        </div>
      );
    return null;
  };

  const sideNav = (
    <>
      <nav className="space-y-0.5 flex-1" aria-label="App">
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end as boolean | undefined} onClick={() => setOpen(false)}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all duration-200 group",
              isActive ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}>
            <item.icon className="w-[17px] h-[17px]" strokeWidth={1.9} />
            {item.label}
            {item.to === "/app/tools" && access && <span className="ml-auto font-mono text-[10.5px] opacity-60">{access.available.length}</span>}
          </NavLink>
        ))}
        {user.role === "admin" && (
          <NavLink to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all mt-3 border border-dashed border-border">
            <Settings className="w-[17px] h-[17px]" strokeWidth={1.9} /> Admin panel
          </NavLink>
        )}
      </nav>
      <div className="mt-5 space-y-3">
        <UsageWidget />
        <button onClick={() => { if (!user) return; const d = createDoc(user.id, { title: "Untitled document" }); nav(`/app/studio/${d.id}`); }}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-foreground text-background font-medium text-[13.5px] h-11 hover:bg-foreground/90 transition-all active:scale-[0.98]">
          <Plus className="w-4 h-4" /> New draft
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen lg:pl-[248px]">
      {/* sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[248px] border-r border-border bg-sidebar flex-col px-4 py-5 z-40">
        <div className="flex items-center justify-between px-1 mb-7">
          <button onClick={() => nav("/")}><Logo /></button>
        </div>
        {sideNav}
        <div className="mt-5 pt-4 border-t border-sidebar-border flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11.5px] font-bold text-white shrink-0" style={{ background: user.color }}>{user.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold truncate leading-none">{user.name}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-1">{user.email}</p>
          </div>
          <button onClick={() => { signOut(); nav("/"); }} aria-label="Sign out" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><LogOut className="w-4 h-4" /></button>
        </div>
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-sidebar border-r border-border flex flex-col px-4 py-5 animate-fade-in">
            <div className="flex items-center justify-between mb-7 px-1">
              <Logo />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-1.5 rounded-md hover:bg-accent"><X className="w-4.5 h-4.5" /></button>
            </div>
            {sideNav}
            <button onClick={() => { signOut(); nav("/"); }} className="mt-5 pt-4 border-t border-border flex items-center gap-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="w-4 h-4" /> Sign out ({user.email})
            </button>
          </div>
        </div>
      )}

      {/* main */}
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => setOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-accent" aria-label="Open menu"><Menu className="w-5 h-5" /></button>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-[16.5px] tracking-tight truncate leading-tight">{title}</h1>
                {sub && <p className="text-[12px] text-muted-foreground truncate hidden sm:block">{sub}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {actions}
              <ThemeToggle />
              <span className="lg:hidden w-8 h-8 rounded-full flex items-center justify-center text-[11.5px] font-bold text-white" style={{ background: user.color }}>{user.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <Banner />
          {children}
        </main>
        <footer className="border-t border-border py-5">
          <p className="max-w-[1200px] mx-auto px-4 sm:px-6 text-[11.5px] text-muted-foreground flex justify-between">
            <span>© {new Date().getFullYear()} ChatDeck Inc.</span><span className="font-mono">workspace · local preview</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
