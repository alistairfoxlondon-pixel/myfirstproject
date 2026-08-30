import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Linkedin, Twitter, Instagram, Youtube, Sparkles, CalendarDays, ListTodo, Trash2,
  Loader2 as LoaderCircle, ArrowLeft, ArrowRight, Send, FileText, CheckCircle2, Clock3, AlertTriangle,
} from "lucide-react";
import AppShell from "./AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea, cn } from "../components/ui";
import { useApp } from "../lib/app";
import { generate, listSocialPosts, saveSocialPost, deleteSocialPost, fmtDateTime } from "../lib/services";
import type { SocialPost } from "../lib/db";

/* platform → AI tool that produces a native variation */
const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", tool: "linkedin-post", icon: Linkedin, limit: 3000 },
  { id: "x", label: "X Thread", tool: "x-thread", icon: Twitter, limit: 280 },
  { id: "instagram", label: "Instagram", tool: "ig-caption", icon: Instagram, limit: 2200 },
  { id: "youtube", label: "YouTube", tool: "yt-description", icon: Youtube, limit: 5000 },
];

interface Variation { platform: string; text: string; busy?: boolean; }

export default function SocialStudio() {
  const { user, access, refresh, toast } = useApp();
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<string[]>(["linkedin", "x"]);
  const [vars, setVars] = useState<Variation[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState("");
  const [view, setView] = useState<"composer" | "queue" | "calendar">("composer");
  const [bump, setBump] = useState(0);

  const posts = useMemo(() => (user ? listSocialPosts(user.id) : []), [user, bump]);

  if (!user) return null;

  const toggle = (id: string) =>
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const runGenerate = async () => {
    if (!topic.trim()) { setGenErr("Enter a topic, link, or paste a headline first."); return; }
    if (!selected.length) { setGenErr("Pick at least one platform."); return; }
    setGenErr(""); setGenerating(true);
    setVars(selected.map(p => ({ platform: p, text: "", busy: true })));
    /* generate each platform's variation through the real tool pipeline (limit-enforced) */
    for (const pid of selected) {
      const plat = PLATFORMS.find(p => p.id === pid)!;
      try {
        const gen = await generate(user, plat.tool, { topic: topic.trim() });
        setVars(v => v.map(x => x.platform === pid ? { ...x, text: gen.output, busy: false } : x));
      } catch (ex: unknown) {
        setVars(v => v.map(x => x.platform === pid ? { ...x, text: "", busy: false } : x));
        setGenErr((ex as Error).message);
      }
    }
    setGenerating(false);
    refresh();
  };

  const setVarText = (platform: string, text: string) =>
    setVars(v => v.map(x => x.platform === platform ? { ...x, text } : x));

  const schedule = (platform: string, when: string) => {
    const v = vars.find(x => x.platform === platform);
    if (!v || !v.text.trim()) return;
    saveSocialPost(user, { platform, text: v.text, status: "scheduled", scheduledFor: when, sourceDocId: null });
    setVars(x => x.filter(y => y.platform !== platform));
    setBump(b => b + 1);
    toast("success", "Scheduled", `${PLATFORMS.find(p => p.id === platform)?.label} post queued for ${fmtDateTime(when)}.`);
  };

  return (
    <AppShell title="Social Studio" sub="One idea → native posts for every platform, scheduled honestly">
      <div className="flex gap-1.5 mb-5 overflow-x-auto scroll-slim" role="tablist">
        {([["composer", "Composer", Sparkles], ["queue", "Queue", ListTodo], ["calendar", "Calendar", CalendarDays]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
            className={cn("inline-flex items-center gap-2 px-3.5 h-9 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors",
              view === k ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}>
            <I className="w-3.5 h-3.5" /> {l}
            {k === "queue" && posts.length > 0 && <span className="ml-1 text-[10px] font-mono bg-background/20 px-1.5 py-0.5 rounded">{posts.length}</span>}
          </button>
        ))}
      </div>

      {view === "composer" && (
        <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] gap-4 items-start">
          <Card className="p-5 lg:sticky lg:top-[76px]">
            <h2 className="font-display font-bold text-[15px] tracking-tight mb-1">What's the idea?</h2>
            <p className="text-[12.5px] text-muted-foreground leading-relaxed mb-4">A topic, a headline, or a link. We'll write a native post for each platform you pick.</p>
            <Field label="Topic or headline" required>
              <Textarea rows={3} value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="e.g. We cut our content production time in half with a repurposing system" />
            </Field>
            <p className="text-[12px] font-medium mt-4 mb-2">Platforms</p>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map(p => {
                const on = selected.includes(p.id);
                return (
                  <button key={p.id} onClick={() => toggle(p.id)} aria-pressed={on}
                    className={cn("flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-all",
                      on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40")}>
                    <p.icon className="w-4 h-4" /> {p.label}
                  </button>
                );
              })}
            </div>
            {genErr && <p className="text-[12.5px] text-destructive mt-3 leading-snug">{genErr}</p>}
            <Button className="w-full mt-4" onClick={runGenerate} loading={generating} disabled={!access || access.available.length === 0}>
              <Sparkles className="w-4 h-4" /> {generating ? "Writing variations…" : "Generate variations"}
            </Button>
            <p className="text-[11px] text-muted-foreground font-mono mt-3 leading-relaxed">
              Each variation runs through its own AI tool and counts against your plan. Publishing to the actual platforms requires connecting them (OAuth) — scheduling here is your content queue.
            </p>
          </Card>

          <div className="space-y-4 min-w-0">
            {vars.length === 0 && !generating && (
              <Card><EmptyState icon={<Sparkles className="w-5 h-5" />} title="Your variations appear here"
                body="Describe the idea, pick platforms, and generate. Then edit each post and schedule it." /></Card>
            )}
            {vars.map(v => {
              const plat = PLATFORMS.find(p => p.id === v.platform)!;
              return (
                <Card key={v.platform} className="p-5">
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><plat.icon className="w-4 h-4" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14px]">{plat.label}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{v.text.length}/{plat.limit} chars</p>
                    </div>
                    {v.busy && <LoaderCircle className="w-4 h-4 animate-spin text-muted-foreground" />}
                  </div>
                  {v.busy ? (
                    <div className="space-y-2">{[90, 100, 72, 84].map((w, i) => <div key={i} className="h-3 rounded-md bg-muted animate-pulse" style={{ width: `${w}%` }} />)}</div>
                  ) : v.text ? (
                    <>
                      <Textarea rows={6} value={v.text} onChange={e => setVarText(v.platform, e.target.value)} className="font-[13px] leading-relaxed" />
                      <ScheduleRow onPick={when => schedule(v.platform, when)} />
                    </>
                  ) : (
                    <p className="text-[12.5px] text-muted-foreground">Couldn't generate this one — a limit may have been reached. Try again or check your plan.</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {view === "queue" && <Queue posts={posts} onChanged={() => setBump(b => b + 1)} />}
      {view === "calendar" && <Calendar posts={posts} />}
    </AppShell>
  );
}

function ScheduleRow({ onPick }: { onPick(when: string): void }) {
  const defaultWhen = () => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [when, setWhen] = useState(defaultWhen);
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <Input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} className="flex-1 min-w-[190px] font-mono text-[12px]" aria-label="Schedule for" />
      <Button size="sm" onClick={() => onPick(new Date(when).toISOString())}><Send className="w-3.5 h-3.5" /> Add to queue</Button>
    </div>
  );
}

const STATUS_META: Record<SocialPost["status"], { label: string; tone: "muted" | "warn" | "success" | "danger"; icon: typeof Clock3 }> = {
  draft: { label: "draft", tone: "muted", icon: FileText },
  scheduled: { label: "scheduled", tone: "warn", icon: Clock3 },
  published: { label: "published", tone: "success", icon: CheckCircle2 },
  failed: { label: "failed", tone: "danger", icon: AlertTriangle },
};

function Queue({ posts, onChanged }: { posts: SocialPost[]; onChanged(): void }) {
  const { user, toast } = useApp();
  if (!user) return null;
  if (!posts.length) {
    return <Card><EmptyState icon={<ListTodo className="w-5 h-5" />} title="Queue is empty"
      body="Generate variations in the Composer and add them here. They'll show up on the calendar too." /></Card>;
  }
  return (
    <div className="space-y-2.5">
      {posts.map(p => {
        const plat = PLATFORMS.find(x => x.id === p.platform);
        const meta = STATUS_META[p.status];
        return (
          <Card key={p.id} className="p-4 flex items-start gap-3.5">
            <span className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {plat ? <plat.icon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-[13.5px]">{plat?.label || p.platform}</p>
                <Badge tone={meta.tone} className="capitalize"><meta.icon className="w-3 h-3" /> {meta.label}</Badge>
                <span className="text-[11px] text-muted-foreground font-mono ml-auto">{fmtDateTime(p.scheduledFor)}</span>
              </div>
              <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-snug line-clamp-2">{p.text}</p>
            </div>
            <button onClick={() => { deleteSocialPost(user, p.id); onChanged(); toast("info", "Removed from queue"); }}
              aria-label="Delete scheduled post" className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </Card>
        );
      })}
    </div>
  );
}

function Calendar({ posts }: { posts: SocialPost[] }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const forDay = (day: number) => posts.filter(p => {
    const d = new Date(p.scheduledFor);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  });
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-[15px] tracking-tight">{monthLabel}</h2>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Previous month"><ArrowLeft className="w-3.5 h-3.5" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Next month"><ArrowRight className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="bg-muted/60 px-2 py-2 text-center text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className={cn("bg-card min-h-[74px] p-1.5", day === null && "bg-muted/30")}>
            {day !== null && (
              <>
                <span className="text-[11px] font-mono text-muted-foreground">{day}</span>
                <div className="space-y-1 mt-1">
                  {forDay(day).slice(0, 3).map(p => {
                    const plat = PLATFORMS.find(x => x.id === p.platform);
                    return (
                      <div key={p.id} title={p.text} className={cn("flex items-center gap-1 rounded px-1.5 py-1 text-[10px] font-medium truncate",
                        p.status === "published" ? "bg-emerald-600/12 text-emerald-700 dark:text-emerald-400"
                          : p.status === "failed" ? "bg-destructive/12 text-destructive"
                          : "bg-amber-500/12 text-amber-700 dark:text-amber-400")}>
                        {plat && <plat.icon className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{plat?.label || p.platform}</span>
                      </div>
                    );
                  })}
                  {forDay(day).length > 3 && <span className="text-[10px] text-muted-foreground font-mono px-1.5">+{forDay(day).length - 3} more</span>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-muted-foreground mt-3 flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" /> Scheduled posts appear on their publish date. Nothing is posted anywhere until a platform is connected.</p>
    </Card>
  );
}
