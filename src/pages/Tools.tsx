import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Search, Lock, Sparkles, Download, RefreshCw, Save, Wand2,
  Columns, CheckCircle2, Zap,
} from "lucide-react";
import AppShell from "./AppShell";
import { FavStar } from "../components/ui";
import { ToolIcon, CATEGORY_META } from "../components/icons";
import { Badge, Button, Card, CopyBtn, EmptyState, Field, Input, RichText, Select, Textarea, cn } from "../components/ui";
import { useApp } from "../lib/app";
import { generate, validateInputs, fmtLimit } from "../lib/services";
import { getDb, dayKey, nowISO, tierRank, Tool, Generation } from "../lib/db";
import { countWords } from "../lib/ai";
import { docFromGeneration, getFavs, toggleFav } from "../lib/content";

/* ---------- shared bits ---------- */
const SAMPLES: Record<string, Record<string, string>> = {
  topic: { topic: "remote team onboarding" },
  content: { content: "our team have been working on the new campaign for three month now, and the results was better then expected. we believes that focusing to the customer journey are the key reason." },
  text: { text: "Starting a blog are easier than ever, but growing one require consistency. Many writer struggle with this because they dont have a system." },
  paragraph: { paragraph: "The quick brown fox jump over the lazy dog. Me and my team thinks this approach works good for most clients, but their feedback suggest otherwise." },
  keyword: { keyword: "ai writing tools" },
  product: { product: "Aurora Desk Lamp" },
  purpose: { purpose: "re-engage dormant trial users" },
  niche: { niche: "personal finance for creatives" },
  seed_keyword: { seed_keyword: "ai writing tools" },
  company: { company: "Brightloop" },
  audience: { audience: "SaaS founders and busy marketing leads" },
  project: { project: "SEO retainer for a DTC skincare brand" },
  client: { client: "Harbor & Sage" },
  role: { role: "Content Strategist" },
  meeting: { meeting: "Q3 planning sync" },
  notes: { notes: "Launch templates library in October\nHire a freelance editor\nCut review cycle from 5 days to 2" },
  process: { process: "Weekly content publish" },
  url: { url: "/blog/pricing-guide" },
  competitors: { competitors: "Jasper, Copy.ai, Writesonic" },
  campaign: { campaign: "Spring launch of the analytics dashboard" },
  quote_person: { quote_person: "Elena Petrova, CEO" },
  author: { author: "Amara Fields" },
  brand: { brand: "ChatDeck" },
};

function useTool(slug: string | undefined): Tool | null {
  return useMemo(() => getDb().tools.find(t => t.slug === slug) || null, [slug]);
}

/* ================= library ================= */
export function ToolsPage() {
  const { user, access } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [favs, setFavs] = useState<string[]>(() => (user ? getFavs(user.id) : []));

  const tools = getDb().tools.filter(t => t.active);
  const unlocked = (t: Tool) => user?.role === "admin" || (access?.plan && tierRank[access.plan.tier] >= tierRank[t.minTier]);

  const list = tools
    .filter(t => cat === "all" || t.category === cat)
    .filter(t => (t.name + t.tagline).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(favs.includes(b.slug)) - Number(favs.includes(a.slug)) || b.uses - a.uses);

  return (
    <AppShell title="AI Tools" sub={`${tools.length} writing, SEO and marketing tools`}>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tools…" className="pl-9" aria-label="Search tools" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scroll-slim -mx-1 px-1" role="tablist" aria-label="Tool categories">
          {["all", "writing", "content", "seo", "marketing", "social", "business", "research", "productivity"].map(c => (
            <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
              className={cn("px-3 h-9 rounded-lg text-[12.5px] font-medium whitespace-nowrap border transition-colors",
                cat === c ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent")}>
              {c === "all" ? "All" : CATEGORY_META[c].label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <Card><EmptyState icon={<Search className="w-5 h-5" />} title="No tools match" body="Try a different search term or category." action={<Button variant="outline" onClick={() => { setQ(""); setCat("all"); }}>Clear filters</Button>} /></Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map(t => {
            const open = unlocked(t);
            return (
              <Card key={t.id} role="button" tabIndex={0} aria-label={`Open ${t.name}`}
                onClick={() => nav(`/app/tools/${t.slug}`)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nav(`/app/tools/${t.slug}`); } }}
                className="p-4 hover:border-foreground/30 hover:shadow-sm transition-all group relative cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <span className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-foreground group-hover:bg-foreground group-hover:text-background transition-colors">
                    <ToolIcon name={t.icon} className="w-[18px] h-[18px]" />
                  </span>
                  <div className="flex items-center gap-1">
                    {!open && <Badge tone="outline" className="text-[10.5px]"><Lock className="w-3 h-3" /> {t.minTier}</Badge>}
                    {user && <FavStar on={favs.includes(t.slug)} label={t.name} onClick={() => setFavs(toggleFav(user.id, t.slug))} />}
                  </div>
                </div>
                <h3 className="font-semibold text-[14px] mt-3 leading-tight">{t.name}</h3>
                <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{t.tagline}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className={cn("text-[10.5px] font-medium px-1.5 py-0.5 rounded", CATEGORY_META[t.category].chip)}>{CATEGORY_META[t.category].label}</span>
                  <span className="text-[10.5px] text-muted-foreground font-mono ml-auto tabular">{t.dailyCap > 0 ? `${t.dailyCap}/day` : "no daily cap"}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

/* ================= single tool workspace ================= */
type ViewMode = "new" | "original" | "compare";

export function ToolPage() {
  const { user, access, refresh, toast } = useApp();
  const { slug } = useParams();
  const nav = useNavigate();
  const tool = useTool(slug);

  const [values, setValues] = useState<Record<string, string>>({});
  const [fieldErr, setFieldErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState<Generation | null>(null);
  const [apiErr, setApiErr] = useState<{ code: string; message: string } | null>(null);
  const [shown, setShown] = useState("");
  const [view, setView] = useState<ViewMode>("new");
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* init form from schema */
  useEffect(() => {
    if (!tool) return;
    setValues(Object.fromEntries(tool.fields.map(f => [f.key, f.default || ""])));
    setGen(null); setApiErr(null); setFieldErr(""); setView("new");
  }, [tool?.id]);

  /* typewriter */
  useEffect(() => {
    if (!gen) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(gen.output); return; }
    let i = 0; setShown("");
    typeTimer.current = setInterval(() => {
      i += 26;
      setShown(gen.output.slice(0, i));
      if (i >= gen.output.length && typeTimer.current) clearInterval(typeTimer.current);
    }, 20);
    return () => { if (typeTimer.current) clearInterval(typeTimer.current); };
  }, [gen?.id]);

  /* per-kind parsing (must run before any early return) */
  const kind = tool?.outputKind || "";
  const grammarParts = useMemo(() => {
    if (kind !== "grammar" || !gen) return null;
    const m = gen.output.split("### ");
    const corrected = m.find(s => s.startsWith("Corrected text"))?.split("\n").slice(2).join("\n").split("###")[0].trim() || "";
    const changes = (m.find(s => s.startsWith("Changes made"))?.split("\n").slice(1).filter(l => /^\d+\./.test(l)) || []);
    const footer = gen.output.split("\n").filter(l => l.startsWith("**Readability")).join(" · ");
    return { corrected, changes, footer };
  }, [gen?.id, kind]);

  const emailSubjects = useMemo(() => {
    if (kind !== "email" || !gen) return null;
    const m = gen.output.match(/\*\*Subject options:\*\*([\s\S]*?)(---|$)/);
    if (!m) return null;
    return m[1].split("\n").filter(l => /^\d+\./.test(l)).map(l => l.replace(/^\d+\.\s*/, ""));
  }, [gen?.id, kind]);

  if (!tool) {
    return (
      <AppShell title="AI Tools" sub="Writing, SEO and marketing tools">
        <Card><EmptyState icon={<Wand2 className="w-5 h-5" />} title="Tool not found" body="It may have been removed or disabled by an administrator."
          action={<Button onClick={() => nav("/app/tools")}><ArrowLeft className="w-4 h-4" /> Back to tools</Button>} /></Card>
      </AppShell>
    );
  }

  const open = user?.role === "admin" || !!(access?.plan && tierRank[access.plan.tier] >= tierRank[tool.minTier]);
  const today = dayKey(nowISO());
  const usedToday = user ? getDb().generations.filter(g => g.userId === user.id && g.toolSlug === tool.slug && g.createdAt.startsWith(today)).length : 0;
  const capLeft = tool.dailyCap > 0 ? Math.max(0, tool.dailyCap - usedToday) : null;

  const run = async () => {
    if (!user) return;
    const err = validateInputs(tool, values);
    if (err) { setFieldErr(err); return; }
    setFieldErr(""); setApiErr(null); setBusy(true);
    try {
      const g = await generate(user, tool.slug, values);
      setGen(g); setView("new"); refresh();
    } catch (ex: unknown) {
      const e = ex as { code?: string; message: string };
      setApiErr({ code: e.code || "ERROR", message: e.message });
    } finally { setBusy(false); }
  };

  const fillSample = () => {
    const next = { ...values };
    for (const f of tool.fields) {
      const s = SAMPLES[f.key];
      if (s && !next[f.key]) next[f.key] = s[f.key];
    }
    setValues(next);
  };

  const saveAsDoc = () => {
    if (!user || !gen) return;
    const doc = docFromGeneration(user.id, gen);
    toast("success", "Saved to Content Studio", "The draft keeps its headings — edit, run SEO checks, and publish from the workspace.");
    nav(`/app/studio/${doc.id}`);
  };

  const isRewrite = ["rewrite", "paragraphRewrite", "improve"].includes(kind);
  const original = isRewrite ? (values.content || values.text || values.paragraph || "") : "";

  const bodyForView = (mode: ViewMode) => {
    if (!gen) return "";
    if (mode === "original") return original;
    if (kind === "grammar" && grammarParts) return grammarParts.corrected;
    return shown || gen.output; // typewriter stream falls back to full text
  };

  return (
    <AppShell title={tool.name} sub={tool.tagline}>
      <Link to="/app/tools" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> All tools
      </Link>
      <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-4 items-start">
        {/* form */}
        <Card className="p-5 lg:sticky lg:top-[76px]">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"><ToolIcon name={tool.icon} className="w-[18px] h-[18px]" /></span>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-[15px] tracking-tight leading-tight">{tool.name}</h2>
              <span className={cn("text-[10.5px] font-medium px-1.5 py-0.5 rounded inline-block mt-1", CATEGORY_META[tool.category].chip)}>{CATEGORY_META[tool.category].label}</span>
            </div>
          </div>

          {!open && (
            <div className="rounded-lg border border-amber-500/35 bg-amber-500/8 p-3.5 mb-4 text-[12.5px] leading-relaxed">
              <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Available on {tool.minTier} and above</p>
              <p className="text-muted-foreground mt-1">Your current plan doesn't include this tool. Upgrade to unlock it — enforcement happens server-side, so this can't be bypassed.</p>
              <Link to="/app/billing"><Button size="sm" className="mt-2.5">View plans</Button></Link>
            </div>
          )}

          <form className="space-y-3.5" onSubmit={e => { e.preventDefault(); run(); }} noValidate>
            {tool.fields.map(f => (
              <Field key={f.key} label={f.label} required={f.required} help={f.help}>
                {f.type === "textarea" ? (
                  <Textarea value={values[f.key] || ""} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} rows={f.rows || 4} placeholder={f.placeholder} disabled={!open || busy} />
                ) : f.type === "select" ? (
                  <Select value={values[f.key] || ""} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))} options={f.options || []} disabled={!open || busy} />
                ) : (
                  <Input type={f.type === "number" ? "number" : "text"} value={values[f.key] || ""} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} min={f.min} max={f.max} disabled={!open || busy} />
                )}
              </Field>
            ))}
            {fieldErr && <p className="text-[12.5px] text-destructive">{fieldErr}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={!open} loading={busy}><Sparkles className="w-4 h-4" /> {busy ? "Generating…" : gen ? "Regenerate" : "Generate"}</Button>
              <Button type="button" variant="outline" onClick={fillSample} disabled={!open || busy} title="Fill sample values">Example</Button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono pt-1">
              <span>{capLeft !== null ? `${capLeft} of ${tool.dailyCap} left today` : "no daily cap"}</span>
              <span>{access ? `${fmtLimit(access.gensLimit)} gens/mo` : ""}</span>
            </div>
          </form>
        </Card>

        {/* output */}
        <div className="min-w-0">
          {apiErr && (
            <Card className="p-4 mb-4 border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0"><Zap className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <p className="font-semibold text-[13.5px]">Generation blocked</p>
                  <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed">{apiErr.message}</p>
                  {["TRIAL_EXPIRED", "SUBSCRIPTION_REQUIRED", "PAST_DUE", "PLAN_LOCKED", "WORD_LIMIT", "GEN_LIMIT"].includes(apiErr.code) && (
                    <Link to="/app/billing"><Button size="sm" variant="outline" className="mt-2.5">Manage subscription</Button></Link>
                  )}
                  {apiErr.code === "RATE_LIMITED" && <p className="text-[11.5px] text-muted-foreground mt-2 font-mono">Rate limits protect the shared AI budget — wait a few seconds and retry.</p>}
                </div>
              </div>
            </Card>
          )}

          {!gen && !busy && !apiErr && (
            <Card>
              <EmptyState icon={<ToolIcon name={tool.icon} className="w-5 h-5" />} title="Output appears here"
                body={`Fill in the form and hit Generate. Results stream in, and you can copy, export or save them to the Content Studio.`} />
            </Card>
          )}

          {busy && (
            <Card className="p-6" aria-busy="true">
              <p className="text-[13px] font-medium mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 animate-pulse-dot" /> Writing with {tool.name}…</p>
              <div className="space-y-2.5">
                {[92, 100, 78, 96, 60, 88, 42].map((w, i) => (
                  <div key={i} className="h-3 rounded-md bg-muted animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 90}ms` }} />
                ))}
              </div>
            </Card>
          )}

          {gen && !busy && (
            <Card className="overflow-hidden">
              {/* action bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30 flex-wrap">
                {isRewrite && (
                  <div className="flex rounded-lg border border-border overflow-hidden mr-1" role="tablist" aria-label="Output view">
                    {([["new", "Rewritten"], ["original", "Original"], ["compare", "Compare"]] as [ViewMode, string][]).map(([k, l]) => (
                      <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
                        className={cn("px-3 h-8 text-[12px] font-medium transition-colors inline-flex items-center gap-1.5",
                          view === k ? "bg-foreground text-background" : "bg-transparent text-muted-foreground hover:text-foreground")}>
                        {k === "compare" && <Columns className="w-3 h-3" />}{l}
                      </button>
                    ))}
                  </div>
                )}
                {grammarParts && <Badge tone="success"><CheckCircle2 className="w-3 h-3" /> {grammarParts.changes.length} fixes</Badge>}
                {kind === "social" && <Badge tone="outline" className="font-mono">{countWords(gen.output) * 6} chars est.</Badge>}
                {kind === "email" && emailSubjects && <Badge tone="outline">{emailSubjects.length} subject lines</Badge>}
                <span className="flex-1" />
                <CopyBtn text={gen.output} />
                <Button variant="outline" size="sm" onClick={() => {
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([gen.output], { type: "text/markdown" }));
                  a.download = tool.slug + ".md"; a.click(); URL.revokeObjectURL(a.href);
                }}><Download className="w-3.5 h-3.5" /> .md</Button>
                <Button variant="outline" size="sm" onClick={saveAsDoc}><Save className="w-3.5 h-3.5" /> Save as document</Button>
              </div>

              {/* email subjects */}
              {emailSubjects && (
                <div className="px-4 sm:px-6 pt-4">
                  <div className="rounded-lg border border-border bg-background p-3.5">
                    <p className="text-[10.5px] font-semibold text-muted-foreground mb-2">SUBJECT LINES</p>
                    <ol className="space-y-1.5">
                      {emailSubjects.map((s, i) => (
                        <li key={i} className="text-[13px] flex items-center gap-2"><span className="font-mono text-[10.5px] text-muted-foreground w-4">{i + 1}.</span><span className="truncate">{s}</span><CopyBtn text={s} label="" /></li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {/* body */}
              {view === "compare" && isRewrite ? (
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                  <div className="p-4 sm:p-6 min-w-0"><p className="text-[10.5px] font-semibold text-muted-foreground mb-3">ORIGINAL · {countWords(original)} words</p><RichText text={original} /></div>
                  <div className="p-4 sm:p-6 min-w-0"><p className="text-[10.5px] font-semibold text-muted-foreground mb-3">REWRITTEN · {gen.words} words</p><RichText text={(shown || gen.output).split("---")[0]} /></div>
                </div>
              ) : grammarParts ? (
                <div className="p-4 sm:p-6 min-w-0">
                  <p className="text-[10.5px] font-semibold text-muted-foreground mb-3">CORRECTED TEXT</p>
                  <RichText text={grammarParts.corrected} />
                  <p className="text-[10.5px] font-semibold text-muted-foreground mt-6 mb-3">CHANGES MADE</p>
                  <ol className="space-y-1.5">
                    {grammarParts.changes.map((c, i) => <li key={i} className="text-[13px] flex gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /><span>{c.replace(/^\d+\.\s*/, "")}</span></li>)}
                  </ol>
                  {grammarParts.footer && <p className="text-[11.5px] text-muted-foreground font-mono mt-5 pt-4 border-t border-border">{grammarParts.footer.replace(/\*\*/g, "")}</p>}
                </div>
              ) : (
                <div className="p-4 sm:p-6 min-w-0"><RichText text={bodyForView(view)} /></div>
              )}

              {/* meta footer */}
              <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 border-t border-border bg-muted/20 text-[11px] text-muted-foreground font-mono tabular overflow-x-auto whitespace-nowrap">
                <span>{gen.words.toLocaleString()} words</span>
                <span>{(gen.durationMs / 1000).toFixed(1)}s</span>
                <span>{gen.provider} · {gen.model}</span>
                <span className="ml-auto flex items-center gap-1.5"><RefreshCw className="w-3 h-3" /> regenerates with a fresh seed</span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
