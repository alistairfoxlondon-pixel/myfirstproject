import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Lock, RotateCcw, Search, Sparkles, Trash2, X, Zap, AlertTriangle, Crown } from "lucide-react";
import AppShell from "./AppShell";
import { CATEGORY_META, ToolIcon } from "../components/icons";
import { Badge, Button, Card, Field, Input, Modal, RichText, Select, Textarea, cn } from "../components/ui";
import { useApp } from "../lib/app";
import { getDb, Tool, dayKey, nowISO, tierRank } from "../lib/db";
import { ApiError, GuardCode, checkGeneration, generate, getSettings, fmtLimit, fmtNum } from "../lib/services";
import { streamText, countWords } from "../lib/ai";

/* ================= library ================= */
export function ToolsPage() {
  const { access, user } = useApp();
  const nav = useNavigate();
  const db = getDb();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const cats = ["all", "writing", "content", "seo", "marketing", "productivity"];

  if (!user || !access) return null;
  const unlocked = new Set(access.available.map(t => t.slug));
  const tools = db.tools.filter(t => t.active)
    .filter(t => cat === "all" || t.category === cat)
    .filter(t => (t.name + t.tagline + t.category).toLowerCase().includes(q.toLowerCase()));
  const today = dayKey(nowISO());

  return (
    <AppShell title="AI Tools" sub={`${access.available.length} of ${db.tools.filter(t => t.active).length} tools unlocked on your plan`}>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search 26 tools…" className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {cats.map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={cn("px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-all",
                cat === c ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30")}>
              {c === "all" ? "All" : CATEGORY_META[c]?.label || c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {tools.map((t, i) => {
          const isOpen = unlocked.has(t.slug) || user.role === "admin";
          const usedToday = db.generations.filter(g => g.userId === user.id && g.toolSlug === t.slug && g.createdAt.startsWith(today)).length;
          return (
            <button key={t.slug} onClick={() => nav(`/app/tools/${t.slug}`)}
              className="group text-left rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-foreground/30 animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <div className="flex items-start justify-between">
                <span className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105", CATEGORY_META[t.category].chip)}>
                  <ToolIcon name={t.icon} className="w-5 h-5" />
                </span>
                <span className="flex items-center gap-1.5">
                  {t.minTier !== "trial" && (
                    <Badge tone="outline" className={cn("font-mono text-[10px] capitalize", !isOpen && "opacity-70")}>
                      {!isOpen && <Lock className="w-2.5 h-2.5" />}{t.minTier}+
                    </Badge>
                  )}
                  {t.minTier === "trial" && <Badge tone="success" className="text-[10px]">free trial</Badge>}
                </span>
              </div>
              <h3 className="font-semibold text-[14.5px] mt-3.5 leading-snug group-hover:underline underline-offset-2 decoration-foreground/30">{t.name}</h3>
              <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">{t.tagline}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <span className="font-mono text-[10.5px] text-muted-foreground">{CATEGORY_META[t.category].label}</span>
                {t.dailyCap > 0 && (
                  <span className={cn("font-mono text-[10.5px]", usedToday >= t.dailyCap ? "text-destructive" : "text-muted-foreground")}>
                    {usedToday}/{t.dailyCap} today
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {tools.length === 0 && (
        <p className="text-center text-[13.5px] text-muted-foreground py-16">No tools match “{q}”. Try a different search.</p>
      )}
    </AppShell>
  );
}

/* ================= workspace ================= */
const LIMIT_COPY: Record<string, { title: string; body: string; cta: string }> = {
  TRIAL_EXPIRED: { title: "Your free trial has ended", body: "The trial words and generations are used up or the trial window closed. Pick a paid plan to keep generating — everything you've made stays in your history.", cta: "View plans" },
  GEN_LIMIT: { title: "Monthly generation limit reached", body: "You've used every generation on your current plan this cycle. Upgrade for a higher ceiling, or wait for the monthly reset.", cta: "Upgrade plan" },
  WORD_LIMIT: { title: "Monthly word limit reached", body: "You've generated all the words your plan allows this cycle. Upgrade for more headroom — it applies instantly.", cta: "Upgrade plan" },
  PLAN_LOCKED: { title: "This tool is on a higher plan", body: "Your current tier doesn't include this tool. The plan below unlocks it along with the rest of its suite.", cta: "See plans" },
  TOOL_DAILY_CAP: { title: "Daily tool limit reached", body: "To keep things fast for everyone, this tool has a per-day cap. It resets at midnight — your monthly allowance is untouched.", cta: "Browse other tools" },
  RATE_LIMITED: { title: "Slow down a moment", body: "You're generating faster than the fair-use rate. Take a breath — you can fire again in a few seconds.", cta: "Got it" },
  PAST_DUE: { title: "Payment needed", body: "Your last invoice failed, so generation is paused. Retry the payment from Billing to resume instantly.", cta: "Fix payment" },
  SUSPENDED: { title: "Account suspended", body: "This account has been suspended. Contact support to restore access.", cta: "Contact support" },
};

export function ToolPage() {
  const { slug } = useParams();
  const { user, access, refresh, toast } = useApp();
  const nav = useNavigate();
  const db = getDb();
  const tool = db.tools.find(t => t.slug === slug && t.active);

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "thinking" | "streaming" | "done" | "error">("idle");
  const [output, setOutput] = useState("");
  const [finalWords, setFinalWords] = useState(0);
  const [duration, setDuration] = useState(0);
  const [model, setModel] = useState("");
  const [errMsg, setErrMsg] = useState<{ code: GuardCode | "VALIDATION" | "API"; message: string } | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  // defaults + prefill from history "re-run"
  useEffect(() => {
    if (!tool) return;
    const def: Record<string, string> = {};
    tool.fields.forEach(f => { def[f.key] = f.default || ""; });
    try {
      const raw = sessionStorage.getItem("chatdeck.prefill");
      if (raw) {
        const pf = JSON.parse(raw);
        if (pf.slug === tool.slug) Object.assign(def, pf.inputs);
        sessionStorage.removeItem("chatdeck.prefill");
      }
    } catch { /* noop */ }
    setInputs(def);
    setState("idle"); setOutput(""); setErrMsg(null);
  }, [tool?.slug]);

  useEffect(() => () => cancelRef.current?.(), []);

  const unlocked = !!(user && access && (access.available.some(t => t.slug === slug) || user.role === "admin"));
  const wordsLeft = access ? (access.wordsLimit === -1 ? null : Math.max(0, access.wordsLimit - access.wordsUsed)) : 0;
  const gensLeft = access ? (access.gensLimit === -1 ? null : Math.max(0, access.gensLimit - access.gensUsed)) : 0;

  if (!user || !access) return null;

  if (!tool) {
    return (
      <AppShell title="Tool not found" sub="It may have been removed or disabled by an administrator.">
        <Card className="p-10 text-center">
          <p className="text-[14px] text-muted-foreground">The tool “{slug}” doesn't exist in your workspace.</p>
          <Button className="mt-5" onClick={() => nav("/app/tools")}><ArrowLeft className="w-4 h-4" /> Back to all tools</Button>
        </Card>
      </AppShell>
    );
  }

  if (!unlocked) {
    return (
      <AppShell title={tool.name} sub={tool.tagline}>
        <Card className="p-8 sm:p-12 text-center max-w-xl mx-auto noise relative overflow-hidden">
          <div className="absolute inset-0 dot-grid opacity-50" aria-hidden />
          <div className="relative">
            <span className={cn("inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-5", CATEGORY_META[tool.category].chip)}><ToolIcon name={tool.icon} className="w-7 h-7" /></span>
            <h2 className="font-display text-[22px] font-extrabold tracking-tight">Unlocks on {tool.minTier.charAt(0).toUpperCase() + tool.minTier.slice(1)} and above</h2>
            <p className="text-[13.5px] text-muted-foreground mt-2.5 leading-relaxed">{tool.tagline} This tool sits in the {tool.minTier} suite — upgrade and it appears instantly, no re-login needed.</p>
            <Button size="lg" className="mt-6" onClick={() => nav("/app/billing")}><Crown className="w-4 h-4" /> View plans</Button>
          </div>
        </Card>
      </AppShell>
    );
  }

  const run = async (silent = false) => {
    setErrMsg(null);
    const guard = checkGeneration(user, tool.slug);
    if (!guard.ok) { setErrMsg({ code: guard.code, message: guard.message }); setState("error"); return; }
    const t0 = performance.now();
    setState("thinking"); setOutput("");
    cancelRef.current?.();
    try {
      const gen = await generate(user, tool.slug, inputs);
      refresh();
      setModel(`${gen.provider}/${gen.model}`);
      setState("streaming");
      cancelRef.current = streamText(gen.output,
        partial => setOutput(partial),
        () => {
          setState("done");
          setFinalWords(gen.words);
          setDuration(Math.round(performance.now() - t0));
          if (!silent) toast("success", "Draft ready", `${gen.words} words · saved to history`);
        },
      );
    } catch (ex: unknown) {
      const e = ex as ApiError;
      setState("error");
      setErrMsg({ code: (e.code as GuardCode) || "API", message: e.message });
      refresh();
    }
  };

  const setField = (key: string, v: string) => setInputs(s => ({ ...s, [key]: v }));
  const estWords = useMemo(() => {
    const textLen = Object.values(inputs).join(" ").length;
    return tool.outputKind === "article" || tool.outputKind === "blog" ? (inputs.length === "long" ? 900 : inputs.length === "short" ? 350 : 600) : Math.min(400, 60 + textLen / 3);
  }, [inputs, tool]);

  return (
    <AppShell title={tool.name} sub={tool.tagline}
      actions={<Button size="sm" variant="outline" onClick={() => nav("/app/tools")} className="hidden sm:inline-flex"><ArrowLeft className="w-3.5 h-3.5" /> All tools</Button>}>
      <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-4 items-start">
        {/* -------- form -------- */}
        <Card className="p-5 sm:p-6 lg:sticky lg:top-[76px]">
          <div className="flex items-center gap-3 mb-5">
            <span className={cn("w-10 h-10 rounded-xl flex items-center justify-center", CATEGORY_META[tool.category].chip)}><ToolIcon name={tool.icon} className="w-5 h-5" /></span>
            <div>
              <h2 className="font-display font-bold text-[15.5px] tracking-tight leading-none">Inputs</h2>
              <p className="text-[11.5px] text-muted-foreground mt-1 font-mono">{tool.fields.length} fields · ~{Math.round(estWords)} words out</p>
            </div>
          </div>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(); }}>
            {tool.fields.map(f => (
              <Field key={f.key} label={f.label} required={f.required} help={f.help}>
                {f.type === "textarea" ? (
                  <div className="relative">
                    <Textarea rows={f.rows || 3} value={inputs[f.key] || ""} placeholder={f.placeholder}
                      onChange={e => setField(f.key, e.target.value)} />
                    <span className="absolute bottom-2 right-2.5 font-mono text-[10px] text-muted-foreground">{(inputs[f.key] || "").length} chars</span>
                  </div>
                ) : f.type === "select" ? (
                  <Select options={f.options || []} value={inputs[f.key] || f.options?.[0] || ""} onChange={e => setField(f.key, e.target.value)} />
                ) : (
                  <Input type={f.type === "number" ? "number" : "text"} value={inputs[f.key] || ""} placeholder={f.placeholder}
                    min={f.min} max={f.max} onChange={e => setField(f.key, e.target.value)} />
                )}
              </Field>
            ))}
            <div className="flex gap-2.5 pt-1.5">
              <Button type="submit" className="flex-1" size="lg" loading={state === "thinking"} disabled={state === "streaming"}>
                {state === "streaming" ? <><Sparkles className="w-4 h-4 animate-pulse" /> Writing…</> : state === "done" ? <><RotateCcw className="w-4 h-4" /> Regenerate</> : <><Zap className="w-4 h-4" /> Generate</>}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => { const def: Record<string, string> = {}; tool.fields.forEach(f => { def[f.key] = f.default || ""; }); setInputs(def); setOutput(""); setState("idle"); setErrMsg(null); }} aria-label="Clear inputs">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </form>
          <div className="mt-5 pt-4 border-t border-border grid grid-cols-3 gap-2 text-center">
            {[
              [wordsLeft === null ? "∞" : fmtNum(wordsLeft), "words left"],
              [gensLeft === null ? "∞" : fmtNum(gensLeft), "gens left"],
              [tool.dailyCap > 0 ? String(tool.dailyCap) : "∞", "daily cap"],
            ].map(([v, l]) => (
              <div key={l as string} className="rounded-lg bg-muted/60 py-2.5">
                <p className="font-mono text-[14px] font-semibold tabular leading-none">{v}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{l}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* -------- output -------- */}
        <Card className="min-h-[420px] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40">
            <span className="font-mono text-[11px] text-muted-foreground tracking-wide uppercase">Output</span>
            <div className="flex items-center gap-2">
              {state === "done" && (
                <>
                  <Badge tone="muted" className="font-mono text-[10px]">{finalWords} words · {(duration / 1000).toFixed(1)}s</Badge>
                  <Badge tone="outline" className="font-mono text-[10px]">{model}</Badge>
                </>
              )}
              {state === "streaming" && <Badge tone="warn" className="font-mono text-[10px]"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-dot" />streaming</Badge>}
            </div>
          </div>
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto scroll-slim max-h-[640px]">
            {state === "idle" && (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <span className="relative inline-flex w-14 h-14 rounded-2xl bg-muted items-center justify-center text-muted-foreground mb-5">
                  <ToolIcon name={tool.icon} className="w-6 h-6" />
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-card animate-pulse-dot" />
                </span>
                <p className="font-semibold text-[14.5px]">Ready when you are</p>
                <p className="text-[13px] text-muted-foreground mt-1.5 max-w-xs leading-relaxed">Fill in the fields and hit <strong>Generate</strong>. Output streams in word by word and is saved to your history automatically.</p>
              </div>
            )}
            {state === "thinking" && (
              <div className="py-4 space-y-3.5" aria-label="Generating">
                <div className="h-5 w-2/5 rounded-md bg-muted animate-pulse" />
                {[92, 100, 84, 96, 60].map((w, i) => <div key={i} className="h-3.5 rounded-md bg-muted animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />)}
                <div className="h-3.5 w-3/4 rounded-md bg-muted animate-pulse" />
                <p className="font-mono text-[11px] text-muted-foreground pt-3 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 animate-pulse" /> calling {getSettings().ai.provider} · temperature {getSettings().ai.temperature}</p>
              </div>
            )}
            {(state === "streaming" || state === "done") && (
              <>
                <RichText text={output} />
                {state === "streaming" && <span className="inline-block w-[8px] h-[16px] bg-foreground align-middle ml-1 animate-caret" />}
                {state === "done" && (
                  <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center gap-2.5 animate-fade-up">
                    <Button size="sm" onClick={() => { navigator.clipboard?.writeText(output).catch(() => undefined); toast("success", "Copied to clipboard"); }}>Copy output</Button>
                    <Button size="sm" variant="outline" onClick={() => void run(true)}><RotateCcw className="w-3.5 h-3.5" /> Regenerate</Button>
                    <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">{countWords(output)} words · {output.length} chars</span>
                  </div>
                )}
              </>
            )}
            {state === "error" && errMsg && (
              <div className="h-full flex flex-col items-center justify-center text-center py-14 animate-fade-up">
                <span className="inline-flex w-13 h-13 p-3.5 rounded-2xl bg-destructive/10 text-destructive items-center justify-center mb-4"><AlertTriangle className="w-6 h-6" /></span>
                <p className="font-display font-bold text-[16px] tracking-tight">{LIMIT_COPY[errMsg.code]?.title || "Generation failed"}</p>
                <p className="text-[13px] text-muted-foreground mt-2 max-w-sm leading-relaxed">{LIMIT_COPY[errMsg.code]?.body || errMsg.message}</p>
                <div className="flex gap-2.5 mt-6">
                  {["TRIAL_EXPIRED", "GEN_LIMIT", "WORD_LIMIT", "PLAN_LOCKED", "PAST_DUE"].includes(errMsg.code) && (
                    <Button onClick={() => nav("/app/billing")}>{LIMIT_COPY[errMsg.code]?.cta} <ArrowRight className="w-3.5 h-3.5" /></Button>
                  )}
                  {errMsg.code === "TOOL_DAILY_CAP" && <Button variant="outline" onClick={() => nav("/app/tools")}>{LIMIT_COPY.TOOL_DAILY_CAP.cta}</Button>}
                  {errMsg.code === "RATE_LIMITED" && <Button variant="outline" onClick={() => setState("idle")}>OK</Button>}
                  {!LIMIT_COPY[errMsg.code] && <Button variant="outline" onClick={() => setState("idle")}>Dismiss</Button>}
                  {LIMIT_COPY[errMsg.code] && errMsg.code !== "RATE_LIMITED" && <Button variant="ghost" onClick={() => setState("idle")}><X className="w-4 h-4" /></Button>}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
      {/* rate-limit quick modal handled inline above; keep focus */}
    </AppShell>
  );
}
