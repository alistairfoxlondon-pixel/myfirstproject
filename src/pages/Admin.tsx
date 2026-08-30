import React, { useMemo, useState } from "react";
import { Navigate, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard, Blocks, Settings as SettingsIcon, LogOut, ArrowLeft,
  Search, Pencil, Trash2, RotateCcw, Plus, Eye, EyeOff, AlertTriangle, Check, X, Activity,
} from "lucide-react";
import { Logo, ToolIcon, CATEGORY_META } from "../components/icons";
import { AreaChart, Badge, BarChart, Button, Card, Field, Input, Modal, Select, Switch, Tabs, Textarea, cn } from "../components/ui";
import { useApp } from "../lib/app";
import { Plan, Settings as SettingsT, Tool, User, getDb } from "../lib/db";
import {
  adminDeletePlan, adminDeleteTool, adminDeleteUser, adminListUsers, adminResetUsage, adminSavePlan,
  adminSaveSettings, adminSaveTool, adminStats, adminUpdateUser, fmtDate, fmtDateTime, fmtMoney, fmtNum,
  getSettings, resetDemoData,
} from "../lib/services";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/plans", label: "Plans", icon: CreditCard },
  { to: "/admin/tools", label: "AI Tools", icon: Blocks },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

function AdminShell({ title, sub, children, actions }: { title: string; sub?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  const { user, signOut } = useApp();
  const nav = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/app" replace />;
  return (
    <div className="min-h-screen lg:pl-[232px]">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[232px] border-r border-border bg-sidebar flex-col px-4 py-5 z-40">
        <div className="px-1 mb-7 flex items-center justify-between">
          <button onClick={() => nav("/admin")}><Logo /></button>
          <Badge tone="outline" className="font-mono text-[9.5px]">ADMIN</Badge>
        </div>
        <nav className="space-y-0.5 flex-1" aria-label="Admin">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end as boolean | undefined}
              className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all",
                isActive ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
              <item.icon className="w-[17px] h-[17px]" strokeWidth={1.9} />{item.label}
            </NavLink>
          ))}
          <NavLink to="/app" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all mt-3 border border-dashed border-border">
            <ArrowLeft className="w-[17px] h-[17px]" strokeWidth={1.9} /> User workspace
          </NavLink>
        </nav>
        <button onClick={() => { signOut(); nav("/"); }} className="mt-5 pt-4 border-t border-border flex items-center gap-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </aside>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => nav("/admin")} className="lg:hidden"><Logo size={24} withWord={false} /></button>
              <div className="min-w-0">
                <h1 className="font-display font-bold text-[16.5px] tracking-tight truncate leading-tight">{title}</h1>
                {sub && <p className="text-[12px] text-muted-foreground truncate hidden sm:block">{sub}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">{actions}</div>
          </div>
          <nav className="lg:hidden flex gap-1 px-3 pb-2 overflow-x-auto scroll-slim" aria-label="Admin mobile">
            {NAV.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end as boolean | undefined}
                className={({ isActive }) => cn("px-3 py-1.5 rounded-lg text-[12.5px] font-medium whitespace-nowrap", isActive ? "bg-foreground text-background" : "text-muted-foreground bg-muted")}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

/* ================= overview ================= */
export function AdminOverview() {
  const { user: admin } = useApp();
  const isAdmin = admin?.role === "admin";
  const s = useMemo(() => (isAdmin ? adminStats(admin) : null), [isAdmin, admin]);
  if (!isAdmin || !s) return <Navigate to={admin ? "/app" : "/login"} replace />;
  const tiles = [
    { l: "Total users", v: s.totalUsers, d: `+${s.newThisWeek} this week` },
    { l: "Trial users", v: s.trialing, d: "active trials" },
    { l: "Paid subscribers", v: s.paid, d: `${s.active} in good standing` },
    { l: "MRR", v: s.mrr, money: true, d: `${s.invoicesOpen} open invoice${s.invoicesOpen === 1 ? "" : "s"}` },
    { l: "Generations · 30d", v: s.gens30, d: `${fmtNum(s.gensTotal)} all-time` },
    { l: "Words · 30d", v: s.words30, d: "across all tools" },
  ];
  return (
    <AdminShell title="Admin overview" sub="The whole platform at a glance">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {tiles.map((t, i) => (
          <Card key={t.l} className="p-4 animate-fade-up" >
            <p className="text-[11.5px] text-muted-foreground font-medium">{t.l}</p>
            <p className="font-display text-[24px] font-extrabold tracking-tight tabular mt-1.5 leading-none" style={{ animationDelay: `${i * 50}ms` }}>
              {t.money ? `$${s.mrr.toFixed(0)}` : fmtNum(t.v)}
            </p>
            <p className="text-[10.5px] text-muted-foreground mt-1.5 font-mono">{t.d}</p>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-3.5 mt-3.5">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between mb-3">
            <div><h2 className="font-display font-bold text-[15px] tracking-tight">Revenue</h2><p className="text-[11.5px] text-muted-foreground mt-0.5">Paid invoices · last 6 months</p></div>
            <Badge tone="success" className="font-mono">${fmtNum(s.revenue.reduce((a, b) => a + b.total, 0))} total</Badge>
          </div>
          <AreaChart data={s.revenue.map(r => ({ label: new Date(r.month + "-15").toLocaleDateString("en-US", { month: "short" }), value: r.total }))} height={150} format={n => `$${fmtNum(n)}`} />
        </Card>
        <Card className="p-5">
          <h2 className="font-display font-bold text-[15px] tracking-tight mb-0.5">Signups</h2>
          <p className="text-[11.5px] text-muted-foreground mb-3">New accounts · 14 days</p>
          <BarChart data={s.signups.map(x => ({ label: new Date(x.day + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: x.count }))} height={120} />
        </Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-3.5 mt-3.5">
        <Card className="p-5">
          <h2 className="font-display font-bold text-[15px] tracking-tight mb-4">Tool usage · 30d</h2>
          <ul className="space-y-3">
            {s.toolUsage.map((t, i) => {
              const max = s.toolUsage[0]?.count || 1;
              return (
                <li key={t.slug}>
                  <div className="flex justify-between text-[12.5px] mb-1"><span className="font-medium truncate">{t.name.replace("AI ", "")}</span><span className="font-mono text-muted-foreground tabular shrink-0">{t.count}</span></div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-foreground transition-all duration-700" style={{ width: `${(t.count / max) * 100}%`, opacity: 1 - i * 0.13 }} /></div>
                </li>
              );
            })}
            {s.toolUsage.length === 0 && <p className="text-[12.5px] text-muted-foreground">No generations yet.</p>}
          </ul>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-muted-foreground" /><h2 className="font-display font-bold text-[15px] tracking-tight">System activity</h2></div>
          <ul className="space-y-1">
            {s.activity.map(a => (
              <li key={a.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <span className={cn("mt-1 w-2 h-2 rounded-full shrink-0", a.role === "admin" ? "bg-foreground" : a.action.includes("registered") ? "bg-emerald-500" : a.action.includes("expired") || a.action.includes("suspended") ? "bg-amber-500" : "bg-muted-foreground/50")} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug">{a.detail}</p>
                  <p className="font-mono text-[10.5px] text-muted-foreground mt-0.5">{a.action} · {fmtDateTime(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AdminShell>
  );
}

/* ================= users ================= */
export function AdminUsers() {
  const { user: admin, toast, refresh } = useApp();
  const isAdmin = admin?.role === "admin";
  const rows = useMemo(() => (isAdmin ? adminListUsers(admin) : []), [isAdmin, admin]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [edit, setEdit] = useState<typeof rows[0] | null>(null);
  const [del, setDel] = useState<User | null>(null);
  const [form, setForm] = useState({ name: "", role: "user", status: "active", company: "" });

  const list = rows
    .filter(r => r.user.role !== "admin" || status === "all")
    .filter(r => status === "all" || (status === "suspended" ? r.user.status === "suspended" : status === "paid" ? r.plan && !r.plan.isTrial && r.sub?.status !== "expired" : status === "trial" ? r.plan?.isTrial && r.sub?.status === "trialing" : true))
    .filter(r => (r.user.name + r.user.email).toLowerCase().includes(q.toLowerCase()));

  const openEdit = (r: typeof rows[0]) => {
    setEdit(r);
    setForm({ name: r.user.name, role: r.user.role, status: r.user.status, company: r.user.company || "" });
  };
  const save = () => {
    if (!edit || !admin) return;
    try {
      adminUpdateUser(admin, edit.user.id, { name: form.name, role: form.role as User["role"], status: form.status as User["status"], company: form.company || undefined });
      toast("success", "User updated", form.status === "suspended" ? "The user has been suspended." : undefined);
      setEdit(null); refresh();
    } catch (e) { toast("error", (e as Error).message); }
  };

  return (
    <AdminShell title="User management" sub={`${rows.filter(r => r.user.role !== "admin").length} accounts`}
      actions={<Badge tone="muted" className="hidden sm:inline-flex font-mono">{list.length} shown</Badge>}>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or email…" className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[["all", "All"], ["trial", "Trial"], ["paid", "Paid"], ["suspended", "Suspended"]].map(([k, l]) => (
            <button key={k} onClick={() => setStatus(k)} className={cn("px-3 py-2 rounded-lg text-[12.5px] font-medium border transition-all", status === k ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-slim">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead><tr className="border-b border-border bg-muted/40 text-left">
              {["User", "Plan", "Status", "Usage · mo", "Gens", "Joined", ""].map(h => <th key={h} className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(r => (
                <tr key={r.user.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-full text-white text-[11px] font-bold flex items-center justify-center shrink-0" style={{ background: r.user.color }}>{r.user.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
                      <div className="min-w-0"><p className="font-semibold truncate flex items-center gap-1.5">{r.user.name}{r.user.role === "admin" && <Badge tone="outline" className="text-[9px]">admin</Badge>}</p><p className="text-[11.5px] text-muted-foreground truncate">{r.user.email}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge tone={r.plan?.isTrial ? "warn" : r.plan ? "success" : "muted"}>{r.plan?.name || "—"}</Badge></td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium capitalize")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", r.user.status === "suspended" ? "bg-destructive" : "bg-emerald-500")} />{r.user.status}
                    </span>
                    {r.sub?.status === "past_due" && <Badge tone="warn" className="ml-1.5">past due</Badge>}
                    {r.sub?.cancelAtPeriodEnd && <Badge tone="muted" className="ml-1.5">canceling</Badge>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] tabular">{fmtNum(r.wordsMonth)}w</td>
                  <td className="px-4 py-3 font-mono text-[12px] tabular">{r.gens}</td>
                  <td className="px-4 py-3 text-muted-foreground text-[12px]">{fmtDate(r.user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button title="Reset monthly usage" onClick={() => { if (!admin) return; adminResetUsage(admin, r.user.id); toast("success", "Usage reset", `${r.user.name}'s monthly counters are back to zero.`); refresh(); }} className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><RotateCcw className="w-3.5 h-3.5" /></button>
                      <button title="Edit" onClick={() => openEdit(r)} className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      {r.user.role !== "admin" && <button title="Delete" onClick={() => setDel(r.user)} className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <p className="text-center text-[13px] text-muted-foreground py-10">No users match your filters.</p>}
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Edit ${edit?.user.name || ""}`} wide
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}><Check className="w-4 h-4" /> Save changes</Button></>}>
        {edit && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Full name" required><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Company"><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></Field>
            <Field label="Role" help="Admins can access this panel.">
              <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} options={[{ value: "user", label: "Member" }, { value: "admin", label: "Administrator" }]} />
            </Field>
            <Field label="Account status">
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]} />
            </Field>
            <div className="sm:col-span-2 grid grid-cols-3 gap-3 rounded-xl border border-border bg-muted/40 p-4 text-center">
              <div><p className="font-display font-extrabold text-lg tabular">{edit.gens}</p><p className="text-[10.5px] text-muted-foreground mt-0.5">generations</p></div>
              <div><p className="font-display font-extrabold text-lg tabular">{fmtNum(edit.wordsMonth)}</p><p className="text-[10.5px] text-muted-foreground mt-0.5">words this month</p></div>
              <div><p className="font-display font-extrabold text-lg tabular">{edit.plan?.name || "—"}</p><p className="text-[10.5px] text-muted-foreground mt-0.5">current plan</p></div>
            </div>
            {form.status === "suspended" && edit.user.status !== "suspended" && (
              <p className="sm:col-span-2 text-[12px] text-amber-600 dark:text-amber-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Suspending blocks sign-in and all generation immediately.</p>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title="Delete this account?"
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { if (!admin || !del) return; adminDeleteUser(admin, del.id); setDel(null); toast("info", "Account deleted", `${del.name} and all their data were removed.`); refresh(); }}><Trash2 className="w-4 h-4" /> Delete permanently</Button></>}>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed">This permanently removes <strong className="text-foreground">{del?.email}</strong> including drafts, invoices and usage history. Consider suspending instead if you may need the data.</p>
      </Modal>
    </AdminShell>
  );
}

/* ================= plans ================= */
const emptyPlan = (): Plan => ({ id: "", slug: "", name: "", description: "", tier: "starter", monthly: 12, yearly: 115, wordsLimit: 50000, generationsLimit: 500, features: [], active: true, isTrial: false, isPopular: false, sort: 5 });

export function AdminPlans() {
  const { user: admin, toast, refresh } = useApp();
  const db = getDb();
  const [edit, setEdit] = useState<Plan | null>(null);
  const [del, setDel] = useState<Plan | null>(null);
  const [featText, setFeatText] = useState("");

  const subsByPlan = (id: string) => db.subscriptions.filter(s => s.planId === id && ["active", "trialing", "past_due"].includes(s.status)).length;
  const save = () => {
    if (!edit || !admin) return;
    if (!edit.name.trim()) { toast("error", "Plan name is required."); return; }
    const slug = edit.slug.trim() || edit.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    adminSavePlan(admin, {
      ...edit,
      slug: edit.isTrial ? "trial" : slug,
      tier: edit.isTrial ? "trial" : edit.tier,
      features: featText.split("\n").map(s => s.trim()).filter(Boolean),
    });
    toast("success", "Plan saved", `${edit.name} is now live in pricing.`);
    setEdit(null); refresh();
  };

  return (
    <AdminShell title="Subscription plans" sub="Pricing, limits and features — changes apply instantly"
      actions={<Button size="sm" onClick={() => { setEdit(emptyPlan()); setFeatText(""); }}><Plus className="w-3.5 h-3.5" /> New plan</Button>}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {[...db.plans].sort((a, b) => a.sort - b.sort).map(p => (
          <Card key={p.id} className={cn("p-5 flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-md", !p.active && "opacity-60", p.isPopular && "border-foreground")}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2"><h3 className="font-display font-bold text-[15.5px] tracking-tight">{p.name}</h3>{p.isTrial && <Badge tone="warn">trial</Badge>}{p.isPopular && <Badge>popular</Badge>}</div>
                <p className="font-mono text-[11px] text-muted-foreground mt-1">{p.tier} tier · {p.active ? "visible" : "hidden"}</p>
              </div>
              <p className="font-display font-extrabold text-[22px] tracking-tight tabular">${p.monthly}<span className="text-[11px] text-muted-foreground font-medium">/mo</span></p>
            </div>
            <p className="text-[12.5px] text-muted-foreground mt-2 leading-relaxed flex-1">{p.description}</p>
            <div className="grid grid-cols-2 gap-2 mt-4 text-center">
              <div className="rounded-lg bg-muted/60 py-2"><p className="font-mono text-[12.5px] font-semibold">{p.wordsLimit === -1 ? "∞" : fmtNum(p.wordsLimit)}</p><p className="text-[9.5px] text-muted-foreground">words/mo</p></div>
              <div className="rounded-lg bg-muted/60 py-2"><p className="font-mono text-[12.5px] font-semibold">{p.generationsLimit === -1 ? "∞" : fmtNum(p.generationsLimit)}</p><p className="text-[9.5px] text-muted-foreground">gens/mo</p></div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-border">
              <span className="text-[11.5px] text-muted-foreground font-mono">{subsByPlan(p.id)} active subs</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEdit({ ...p }); setFeatText(p.features.join("\n")); }}><Pencil className="w-3.5 h-3.5" /></Button>
                {!p.isTrial && <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDel(p)}><Trash2 className="w-3.5 h-3.5" /></Button>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : "Create plan"} wide
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}><Check className="w-4 h-4" /> Save plan</Button></>}>
        {edit && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Plan name" required><Input value={edit.name} onChange={e => setEdit(p => ({ ...p!, name: e.target.value }))} placeholder="Growth" /></Field>
            <Field label="Tier" help={edit?.isTrial ? "The trial tier is fixed." : "Controls which tools unlock."}>
              <Select value={edit.isTrial ? "trial" : edit.tier} disabled={edit.isTrial} onChange={e => setEdit(p => ({ ...p!, tier: e.target.value as Plan["tier"] }))} options={edit?.isTrial ? ["trial"] : ["starter", "pro", "business", "enterprise"]} />
            </Field>
            <Field label="Monthly price ($)"><Input type="number" min={0} value={edit.monthly} onChange={e => setEdit(p => ({ ...p!, monthly: Number(e.target.value) }))} /></Field>
            <Field label="Yearly price ($)"><Input type="number" min={0} value={edit.yearly} onChange={e => setEdit(p => ({ ...p!, yearly: Number(e.target.value) }))} /></Field>
            <Field label="Words / month" help="-1 = unlimited"><Input type="number" min={-1} value={edit.wordsLimit} onChange={e => setEdit(p => ({ ...p!, wordsLimit: Number(e.target.value) }))} /></Field>
            <Field label="Generations / month" help="-1 = unlimited"><Input type="number" min={-1} value={edit.generationsLimit} onChange={e => setEdit(p => ({ ...p!, generationsLimit: Number(e.target.value) }))} /></Field>
            <div className="sm:col-span-2"><Field label="Description"><Input value={edit.description} onChange={e => setEdit(p => ({ ...p!, description: e.target.value }))} /></Field></div>
            <div className="sm:col-span-2"><Field label="Features" help="One per line — shown on pricing cards."><Textarea rows={4} value={featText} onChange={e => setFeatText(e.target.value)} placeholder={"Everything in Starter\nPriority support"} /></Field></div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2.5 text-[13px] font-medium">Visible <Switch checked={edit.active} onChange={v => setEdit(p => ({ ...p!, active: v }))} /></label>
              <label className="flex items-center gap-2.5 text-[13px] font-medium">Mark popular <Switch checked={edit.isPopular} onChange={v => setEdit(p => ({ ...p!, isPopular: v }))} /></label>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.name}?`}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { if (!admin || !del) return; try { adminDeletePlan(admin, del.id); toast("info", "Plan deleted"); setDel(null); refresh(); } catch (e) { toast("error", (e as Error).message); setDel(null); } }}><Trash2 className="w-4 h-4" /> Delete</Button></>}>
        {del && subsByPlan(del.id) > 0
          ? <p className="text-[13.5px] leading-relaxed flex gap-2.5"><AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />This plan has <strong>{subsByPlan(del.id)} active subscriber(s)</strong>. Plans with subscribers can't be deleted — set it to hidden instead.</p>
          : <p className="text-[13.5px] text-muted-foreground leading-relaxed">This removes the plan from pricing immediately. This can't be undone.</p>}
      </Modal>
    </AdminShell>
  );
}

/* ================= tools ================= */
const OUTPUT_KINDS = ["article", "blog", "rewrite", "paragraphRewrite", "improve", "grammar", "summary", "titles", "headline", "metaTitle", "metaDesc", "seoBrief", "product", "social", "email", "adCopy", "intro", "conclusion", "faq", "outline", "keywords", "ideas", "press", "script"];

export function AdminTools() {
  const { user: admin, toast, refresh } = useApp();
  const db = getDb();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Tool | null>(null);
  const [del, setDel] = useState<Tool | null>(null);
  const list = db.tools.filter(t => (t.name + t.category + t.tagline).toLowerCase().includes(q.toLowerCase()));

  const newTool = (): Tool => ({
    id: "", slug: "", name: "New AI Tool", tagline: "", category: "writing", icon: "sparkles",
    outputKind: "article", minTier: "starter", dailyCap: 20, active: true, uses: 0, createdAt: new Date().toISOString(),
    fields: [
      { key: "topic", label: "Topic", type: "text", required: true, placeholder: "What should it be about?" },
      { key: "tone", label: "Tone of voice", type: "select", options: ["professional", "friendly", "persuasive", "witty", "neutral"], default: "professional" },
      { key: "length", label: "Content length", type: "select", options: ["short", "medium", "long"], default: "medium" },
    ],
  });
  const save = () => {
    if (!edit || !admin) return;
    if (!edit.name.trim()) { toast("error", "Tool name is required."); return; }
    const slug = edit.slug.trim() || edit.name.toLowerCase().replace(/^ai\s+/, "").replace(/[^a-z0-9]+/g, "-");
    adminSaveTool(admin, { ...edit, slug });
    toast("success", "Tool saved", `${edit.name} is ${edit.active ? "live in the deck" : "saved as disabled"}.`);
    setEdit(null); refresh();
  };
  const tierOpts = ["trial", "starter", "pro", "business"];

  return (
    <AdminShell title="AI tool management" sub={`${db.tools.length} tools · architecture is schema-driven, so new tools need no code`}
      actions={<Button size="sm" onClick={() => setEdit(newTool())}><Plus className="w-3.5 h-3.5" /> Add tool</Button>}>
      <div className="relative max-w-sm mb-5">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tools…" className="pl-9" />
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scroll-slim">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead><tr className="border-b border-border bg-muted/40 text-left">
              {["Tool", "Category", "Min. tier", "Daily cap", "Uses", "Enabled", ""].map(h => <th key={h} className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(t => (
                <tr key={t.id} className={cn("border-b border-border last:border-0 hover:bg-muted/30 transition-colors", !t.active && "opacity-55")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", CATEGORY_META[t.category].chip)}><ToolIcon name={t.icon} className="w-4 h-4" /></span>
                      <div className="min-w-0"><p className="font-semibold truncate">{t.name}</p><p className="text-[11px] text-muted-foreground font-mono truncate">/{t.slug} · {t.outputKind}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge tone="muted">{CATEGORY_META[t.category].label}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={t.minTier === "trial" ? "success" : "outline"} className="capitalize font-mono text-[10px]">{t.minTier}+</Badge></td>
                  <td className="px-4 py-3 font-mono text-[12px] tabular">{t.dailyCap || "∞"}</td>
                  <td className="px-4 py-3 font-mono text-[12px] tabular">{t.uses}</td>
                  <td className="px-4 py-3"><Switch checked={t.active} onChange={v => { if (!admin) return; adminSaveTool(admin, { ...t, active: v }); toast("info", v ? "Tool enabled" : "Tool disabled", t.name); refresh(); }} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button title="Edit" onClick={() => setEdit({ ...t })} className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button title="Delete" onClick={() => setDel(t)} className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : "Add tool"} wide
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}><Check className="w-4 h-4" /> Save tool</Button></>}>
        {edit && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Tool name" required><Input value={edit.name} onChange={e => setEdit(t => ({ ...t!, name: e.target.value }))} placeholder="AI Slogan Generator" /></Field>
            <Field label="Slug" help="Auto-generated if empty."><Input value={edit.slug} onChange={e => setEdit(t => ({ ...t!, slug: e.target.value }))} placeholder="slogan-generator" className="font-mono" /></Field>
            <div className="sm:col-span-2"><Field label="Tagline"><Input value={edit.tagline} onChange={e => setEdit(t => ({ ...t!, tagline: e.target.value }))} placeholder="Punchy one-liner shown on the tool card" /></Field></div>
            <Field label="Category">
              <Select value={edit.category} onChange={e => setEdit(t => ({ ...t!, category: e.target.value as Tool["category"] }))} options={Object.keys(CATEGORY_META)} />
            </Field>
            <Field label="Output engine" help="Which generator template runs.">
              <Select value={edit.outputKind} onChange={e => setEdit(t => ({ ...t!, outputKind: e.target.value }))} options={OUTPUT_KINDS} />
            </Field>
            <Field label="Minimum tier" help="Plans at this tier and above get access.">
              <Select value={edit.minTier} onChange={e => setEdit(t => ({ ...t!, minTier: e.target.value as Tool["minTier"] }))} options={tierOpts} />
            </Field>
            <Field label="Daily cap per user" help="0 = unlimited."><Input type="number" min={0} value={edit.dailyCap} onChange={e => setEdit(t => ({ ...t!, dailyCap: Number(e.target.value) }))} /></Field>
            <div className="sm:col-span-2">
              <Field label="Input fields" help="Schema-driven form — edit as JSON-ish lines: key | label | type | options(comma) | required(y/n).">
                <Textarea rows={6} className="font-mono text-[12px]" value={edit.fields.map(f => `${f.key} | ${f.label} | ${f.type}${f.options ? ` | ${f.options.join(",")}` : ""} | ${f.required ? "y" : "n"}`).join("\n")}
                  onChange={e => setEdit(t => ({
                    ...t!, fields: e.target.value.split("\n").filter(l => l.includes("|")).map(l => {
                      const [key, label, type, opts, req] = l.split("|").map(s => s.trim());
                      return { key: key || "field", label: label || key || "Field", type: (["text", "textarea", "select", "number"].includes(type) ? type : "text") as Tool["fields"][0]["type"], options: opts ? opts.split(",").map(o => o.trim()) : undefined, required: req === "y" };
                    }),
                  }))} />
              </Field>
            </div>
            <label className="flex items-center gap-2.5 text-[13px] font-medium">Enabled in the deck <Switch checked={edit.active} onChange={v => setEdit(t => ({ ...t!, active: v }))} /></label>
          </div>
        )}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title={`Delete ${del?.name}?`}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { if (!admin || !del) return; adminDeleteTool(admin, del.id); toast("info", "Tool deleted", del.name); setDel(null); refresh(); }}><Trash2 className="w-4 h-4" /> Delete tool</Button></>}>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed">Existing history entries keep their content, but the tool disappears from the deck for everyone. Consider disabling it instead.</p>
      </Modal>
    </AdminShell>
  );
}

/* ================= settings ================= */
export function AdminSettings() {
  const { user: admin, toast, refresh } = useApp();
  const [tab, setTab] = useState("site");
  const [s, setS] = useState<SettingsT>(() => JSON.parse(JSON.stringify(getSettings())));
  const [showKey, setShowKey] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const save = () => {
    if (!admin) return;
    adminSaveSettings(admin, s);
    toast("success", "Settings saved", "Changes apply across the platform immediately.");
    refresh();
  };
  const set = <K extends keyof SettingsT>(k: K, patch: Partial<SettingsT[K]>) => setS(prev => ({ ...prev, [k]: { ...prev[k], ...patch } }));

  return (
    <AdminShell title="System settings" sub="Site, registration, trial, AI provider and usage policy"
      actions={<Button size="sm" onClick={save}><Check className="w-3.5 h-3.5" /> Save all</Button>}>
      <Tabs className="mb-6" value={tab} onChange={setTab} items={[
        { key: "site", label: "Site" }, { key: "registration", label: "Registration" },
        { key: "trial", label: "Free trial" }, { key: "ai", label: "AI provider" }, { key: "usage", label: "Usage & billing" },
      ]} />

      {tab === "site" && (
        <Card className="p-5 sm:p-6 max-w-2xl">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Site name"><Input value={s.site.name} onChange={e => set("site", { name: e.target.value })} /></Field>
            <Field label="Support email"><Input value={s.site.supportEmail} onChange={e => set("site", { supportEmail: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Tagline"><Input value={s.site.tagline} onChange={e => set("site", { tagline: e.target.value })} /></Field></div>
            <div className="sm:col-span-2"><Field label="Meta description" help="Used in SEO tags on public pages."><Textarea rows={2} value={s.site.description} onChange={e => set("site", { description: e.target.value })} /></Field></div>
            <Field label="Twitter / X URL"><Input value={s.site.twitter} onChange={e => set("site", { twitter: e.target.value })} /></Field>
            <Field label="GitHub URL"><Input value={s.site.github} onChange={e => set("site", { github: e.target.value })} /></Field>
          </div>
        </Card>
      )}

      {tab === "registration" && (
        <Card className="p-5 sm:p-6 max-w-2xl space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[14px] font-medium">Allow public registration</p><p className="text-[12.5px] text-muted-foreground mt-0.5">When off, the signup form is replaced by a contact notice.</p></div>
            <Switch checked={s.registration.enabled} onChange={v => set("registration", { enabled: v })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[14px] font-medium">Require email verification</p><p className="text-[12.5px] text-muted-foreground mt-0.5">New accounts are flagged until they verify (simulated here).</p></div>
            <Switch checked={s.registration.requireVerification} onChange={v => set("registration", { requireVerification: v })} />
          </div>
        </Card>
      )}

      {tab === "trial" && (
        <Card className="p-5 sm:p-6 max-w-2xl">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Trial duration (days)"><Input type="number" min={1} max={90} value={s.trial.days} onChange={e => set("trial", { days: Number(e.target.value) })} /></Field>
            <Field label="Trial words"><Input type="number" min={0} value={s.trial.words} onChange={e => set("trial", { words: Number(e.target.value) })} /></Field>
            <Field label="Trial generations"><Input type="number" min={0} value={s.trial.generations} onChange={e => set("trial", { generations: Number(e.target.value) })} /></Field>
            <Field label="When the trial expires">
              <Select value={s.trial.onExpire} onChange={e => set("trial", { onExpire: e.target.value as "lock" | "readonly" })}
                options={[{ value: "lock", label: "Lock generation, prompt upgrade" }, { value: "readonly", label: "Read-only workspace" }]} />
            </Field>
          </div>
          <p className="text-[12px] text-muted-foreground mt-4 pt-4 border-t border-border leading-relaxed">Trial-tier tools stay available during the trial; changing these limits updates the Trial plan for all <strong className="text-foreground">new</strong> signups. Existing trials keep their original allowance.</p>
        </Card>
      )}

      {tab === "ai" && (
        <Card className="p-5 sm:p-6 max-w-2xl">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Provider">
              <Select value={s.ai.provider} onChange={e => set("ai", { provider: e.target.value as SettingsT["ai"]["provider"] })}
                options={[{ value: "openai", label: "OpenAI" }, { value: "anthropic", label: "Anthropic" }, { value: "gemini", label: "Google Gemini" }, { value: "mock", label: "Local mock (no external calls)" }]} />
            </Field>
            <Field label="Model"><Input value={s.ai.model} onChange={e => set("ai", { model: e.target.value })} placeholder="gpt-4.1-mini" className="font-mono" /></Field>
            <div className="sm:col-span-2">
              <Field label="API key" help="Stored server-side only — never sent to the browser in production.">
                <div className="relative">
                  <Input type={showKey ? "text" : "password"} value={s.ai.apiKey} onChange={e => set("ai", { apiKey: e.target.value })} className="pr-10 font-mono" />
                  <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle key visibility">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>
            </div>
            <Field label="Temperature" help="0 = deterministic, 1 = creative."><Input type="number" min={0} max={1} step={0.1} value={s.ai.temperature} onChange={e => set("ai", { temperature: Number(e.target.value) })} /></Field>
            <Field label="Max output tokens"><Input type="number" min={256} value={s.ai.maxTokens} onChange={e => set("ai", { maxTokens: Number(e.target.value) })} /></Field>
          </div>
          <p className="text-[12px] text-muted-foreground mt-4 pt-4 border-t border-border leading-relaxed flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />All generation requests route through the backend service layer. Keys configured here are masked in the UI and would live in environment variables in a production deployment.</p>
        </Card>
      )}

      {tab === "usage" && (
        <Card className="p-5 sm:p-6 max-w-2xl">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Rate limit (generations / minute)"><Input type="number" min={1} value={s.usage.ratePerMinute} onChange={e => set("usage", { ratePerMinute: Number(e.target.value) })} /></Field>
            <Field label="Max output words per generation"><Input type="number" min={100} value={s.usage.maxOutputWords} onChange={e => set("usage", { maxOutputWords: Number(e.target.value) })} /></Field>
            <Field label="Currency"><Select value={s.billing.currency} onChange={e => set("billing", { currency: e.target.value })} options={["USD", "EUR", "GBP"]} /></Field>
            <Field label="Tax rate (%)"><Input type="number" min={0} max={40} value={s.billing.taxRate} onChange={e => set("billing", { taxRate: Number(e.target.value) })} /></Field>
          </div>
          <div className="mt-6 pt-5 border-t border-border">
            <p className="text-[13px] font-semibold text-destructive">Danger zone</p>
            <p className="text-[12px] text-muted-foreground mt-1 mb-3.5">Restore the original demo dataset — users, plans, tools, history. You'll be signed out.</p>
            <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)}><RotateCcw className="w-3.5 h-3.5" /> Reset demo data</Button>
          </div>
        </Card>
      )}

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset all demo data?"
        footer={<><Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { resetDemoData(); window.location.hash = "#/login"; window.location.reload(); }}><X className="w-4 h-4" /> Reset everything</Button></>}>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed">Every account (including yours), subscription, generation and setting returns to the seeded state. The page will reload.</p>
      </Modal>
    </AdminShell>
  );
}
