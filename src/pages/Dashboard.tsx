import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Type, Zap, CalendarClock, Blocks, Sparkles, FileText, Plus } from "lucide-react";
import AppShell from "./AppShell";
import { FavStar } from "./Studio";
import { CATEGORY_META, ToolIcon } from "../components/icons";
import { AreaChart, Badge, Button, Card, Donut, EmptyState, Progress, Reveal, cn } from "../components/ui";
import { useApp } from "../lib/app";
import { getDb, monthKey, nowISO } from "../lib/db";
import { fmtDateTime, fmtLimit, fmtNum, listGenerations } from "../lib/services";
import { listDocs, createDoc, getFavs, toggleFav } from "../lib/content";

export default function Dashboard() {
  const { user, access, refresh } = useApp();
  const nav = useNavigate();
  const db = getDb();
  const [favs, setFavs] = useState<string[]>(() => (user ? getFavs(user.id) : []));
  const docs = useMemo(() => (user ? listDocs(user.id).slice(0, 4) : []), [user, access]);
  const newDoc = () => { if (!user) return; const d = createDoc(user.id, { title: "Untitled document" }); nav(`/app/studio/${d.id}`); };
  const recommended = useMemo(() => {
    if (!user || !access) return [];
    const used = new Set(listGenerations(user.id, { limit: 200 }).map(g => g.toolSlug));
    return access.available.filter(t => !favs.includes(t.slug) && !used.has(t.slug)).sort((a, b) => b.uses - a.uses).slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, access, favs]);

  const recent = useMemo(() => (user ? listGenerations(user.id, { limit: 5 }) : []), [user, access]);
  const days14 = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    const monthUsage = db.usage.filter(u => u.userId === user?.id);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const m = monthKey(d.toISOString());
      const u = monthUsage.find(x => x.month === m);
      out.push({ label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: u?.byDay[key] || 0 });
    }
    return out;
  }, [user, access, db.usage]);

  if (!user || !access) return null;
  void refresh;

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const topTools = Object.entries(access && (db.usage.find(u => u.userId === user.id && u.month === monthKey(nowISO()))?.byTool || {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([slug, count]) => ({ slug, count, tool: db.tools.find(t => t.slug === slug) }));
  const wordsTotal14 = days14.reduce((s, d) => s + d.value, 0);

  const tiles = [
    { icon: <Type className="w-4.5 h-4.5" />, label: "Words used", value: fmtNum(access.wordsUsed), sub: `of ${fmtLimit(access.wordsLimit)} this month`, pct: access.wordsLimit === -1 ? 0 : (access.wordsUsed / access.wordsLimit) * 100 },
    { icon: <Zap className="w-4.5 h-4.5" />, label: "Generations", value: fmtNum(access.gensUsed), sub: `of ${fmtLimit(access.gensLimit)} this month`, pct: access.gensLimit === -1 ? 0 : (access.gensUsed / access.gensLimit) * 100 },
    { icon: <CalendarClock className="w-4.5 h-4.5" />, label: access.effective === "trialing" ? "Trial days left" : access.subscription?.cancelAtPeriodEnd ? "Days until plan ends" : "Days until renewal", value: String(access.daysLeft), sub: access.effective === "trialing" ? "then pick a plan" : new Date(access.subscription?.currentPeriodEnd || "").toLocaleDateString("en-US", { month: "short", day: "numeric" }), pct: -1 },
    { icon: <Blocks className="w-4.5 h-4.5" />, label: "Tools unlocked", value: String(access.available.length), sub: `of ${db.tools.filter(t => t.active).length} in the deck`, pct: -1 },
  ];

  return (
    <AppShell title={`${greet}, ${user.name.split(" ")[0]}`} sub={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      actions={<Button size="sm" onClick={newDoc} className="hidden sm:inline-flex"><Plus className="w-3.5 h-3.5" /> New draft</Button>}>
      {/* stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {tiles.map((t, i) => (
          <Reveal key={t.label} delay={i * 60}>
            <Card className="p-4.5 sm:p-5 h-full transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-muted-foreground">{t.label}</span>
                <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">{t.icon}</span>
              </div>
              <p className="font-display text-[26px] font-extrabold tracking-tight tabular mt-2 leading-none">{t.value}</p>
              <p className="text-[11.5px] text-muted-foreground mt-1.5">{t.sub}</p>
              {t.pct >= 0 && <Progress value={Math.min(100, t.pct)} max={100} className="mt-3 h-1.5" />}
            </Card>
          </Reveal>
        ))}
      </div>

      {/* chart row */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-3.5 mt-3.5">
        <Reveal delay={80}>
          <Card className="p-5 sm:p-6 h-full">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display font-bold text-[15.5px] tracking-tight">Writing activity</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">Words generated per day · last 14 days</p>
              </div>
              <Badge tone="muted" className="font-mono">{fmtNum(wordsTotal14)} words</Badge>
            </div>
            <AreaChart data={days14} height={150} format={n => `${fmtNum(n)} words`} />
          </Card>
        </Reveal>
        <Reveal delay={140}>
          <Card className="p-5 sm:p-6 h-full">
            <h2 className="font-display font-bold text-[15.5px] tracking-tight mb-1">Top tools this month</h2>
            <p className="text-[12px] text-muted-foreground mb-4">Where your words went</p>
            {topTools.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-muted-foreground mb-3"><Sparkles className="w-5 h-5" /></span>
                <p className="text-[13px] font-medium">No generations yet</p>
                <Button size="sm" variant="outline" className="mt-4" onClick={() => nav("/app/tools")}>Open a tool</Button>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <Donut size={132} thickness={15} centerLabel={String(access.gensUsed)} centerSub="generations"
                  segments={topTools.map((t, i) => ({ value: t.count, color: ["var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"][i], label: t.tool?.name || t.slug }))} />
                <ul className="flex-1 space-y-2.5 min-w-0">
                  {topTools.map((t, i) => (
                    <li key={t.slug} className="flex items-center gap-2.5 text-[12.5px]">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: ["var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"][i] }} />
                      <span className="truncate flex-1">{t.tool?.name.replace("AI ", "") || t.slug}</span>
                      <span className="font-mono text-muted-foreground tabular">{t.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </Reveal>
      </div>

      {/* documents + shortcuts */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-3.5 mt-3.5">
        <Reveal delay={90}>
          <Card className="p-5 sm:p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-bold text-[15.5px] tracking-tight">Recent documents</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">From the Content Studio</p>
              </div>
              <button onClick={() => nav("/app/studio")} className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">All documents <ArrowRight className="w-3.5 h-3.5" /></button>
            </div>
            {docs.length === 0 ? (
              <EmptyState icon={<FileText className="w-5 h-5" />} title="No documents yet"
                body="Save any generation as a draft, or start from a blank page — then edit, run SEO checks and publish."
                action={<Button size="sm" onClick={newDoc}><Plus className="w-3.5 h-3.5" /> New document</Button>} />
            ) : (
              <ul className="space-y-1">
                {docs.map(d => (
                  <li key={d.id}>
                    <button onClick={() => nav(`/app/studio/${d.id}`)} className="w-full text-left flex items-center gap-3 rounded-lg px-2 py-2.5 -mx-2 hover:bg-accent transition-colors group">
                      <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground"><FileText className="w-4 h-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium truncate">{d.title}</span>
                        <span className="block text-[11.5px] text-muted-foreground truncate">{d.wordCount.toLocaleString()} words · SEO {d.seo.keyword || "not set"}</span>
                      </span>
                      <Badge tone={d.status === "published" ? "success" : "muted"} className="shrink-0">{d.status}</Badge>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
        <Reveal delay={150}>
          <Card className="p-5 sm:p-6 h-full">
            <h2 className="font-display font-bold text-[15.5px] tracking-tight mb-1">Your shortcuts</h2>
            <p className="text-[12px] text-muted-foreground mb-4">Favorites first, then tools you haven't tried</p>
            <ul className="space-y-1">
              {[...access.available.filter(t => favs.includes(t.slug)), ...recommended].slice(0, 6).map(t => (
                <li key={t.slug} className="flex items-center gap-2 rounded-lg px-1 py-1.5 -mx-1 hover:bg-accent transition-colors group">
                  <button onClick={() => nav(`/app/tools/${t.slug}`)} className="flex items-center gap-3 min-w-0 flex-1 text-left py-1">
                    <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", CATEGORY_META[t.category].chip)}><ToolIcon name={t.icon} className="w-4 h-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium truncate group-hover:underline underline-offset-2">{t.name.replace("AI ", "")}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">{favs.includes(t.slug) ? "Favorite" : "Suggested for you"}</span>
                    </span>
                  </button>
                  <FavStar on={favs.includes(t.slug)} label={t.name} onClick={() => { setFavs(toggleFav(user.id, t.slug)); refresh(); }} />
                </li>
              ))}
              {access.available.length === 0 && <p className="text-[13px] text-muted-foreground py-6 text-center">No tools available on this plan.</p>}
            </ul>
          </Card>
        </Reveal>
      </div>

      {/* quick tools + recent */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-3.5 mt-3.5">
        <Reveal delay={100}>
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-bold text-[15.5px] tracking-tight">Jump back in</h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">Your unlocked tools</p>
              </div>
              <button onClick={() => nav("/app/tools")} className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">All tools <ArrowRight className="w-3.5 h-3.5" /></button>
            </div>
            <div className="grid sm:grid-cols-3 gap-2.5">
              {access.available.slice(0, 6).map(t => (
                <button key={t.slug} onClick={() => nav(`/app/tools/${t.slug}`)}
                  className="group text-left rounded-xl border border-border p-3.5 transition-all duration-200 hover:border-foreground/40 hover:-translate-y-0.5 hover:shadow-sm bg-background">
                  <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center", CATEGORY_META[t.category].chip)}><ToolIcon name={t.icon} className="w-4 h-4" /></span>
                  <p className="font-semibold text-[13px] mt-2.5 leading-snug">{t.name.replace("AI ", "")}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{t.tagline}</p>
                </button>
              ))}
            </div>
          </Card>
        </Reveal>
        <Reveal delay={160}>
          <Card className="p-5 sm:p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-[15.5px] tracking-tight">Recent drafts</h2>
              <button onClick={() => nav("/app/history")} className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">History <ArrowRight className="w-3.5 h-3.5" /></button>
            </div>
            {recent.length === 0 ? (
              <p className="text-[13px] text-muted-foreground py-8 text-center">Your generated content will appear here.</p>
            ) : (
              <ul className="space-y-1">
                {recent.map(g => (
                  <li key={g.id}>
                    <button onClick={() => nav("/app/history")} className="w-full text-left flex items-center gap-3 rounded-lg px-2 py-2.5 -mx-2 hover:bg-accent transition-colors group">
                      <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground"><ToolIcon name={db.tools.find(t => t.slug === g.toolSlug)?.icon || "pen"} className="w-4 h-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium truncate">{g.toolName.replace("AI ", "")}</span>
                        <span className="block text-[11.5px] text-muted-foreground truncate">{Object.values(g.inputs)[0] || g.toolName}</span>
                      </span>
                      <span className="text-right shrink-0">
                        <span className="block font-mono text-[11px] tabular">{g.words}w</span>
                        <span className="block text-[10.5px] text-muted-foreground">{fmtDateTime(g.createdAt)}</span>
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>
    </AppShell>
  );
}
