import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, FileText, Plus, Search, Trash2, Copy as CopyIcon, Sparkles, Wand2, ListTree,
  Image as ImageIcon, Send, Download, CheckCircle2, XCircle, Globe, Ghost, PenLine, LayoutGrid,
  RefreshCw, Save, ExternalLink, Link2, Clock3, Loader2 as LoaderCircle, X as XIcon,
  Archive, ArchiveRestore,
} from "lucide-react";
import AppShell from "./AppShell";
import { RichEditor, EditorHandle } from "../components/editor";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea, cn } from "../components/ui";
import { useApp } from "../lib/app";
import { generate, fmtDateTime, runStudioAssist } from "../lib/services";
import type { AssistAction } from "../lib/ai";
import {
  Doc, listDocs, getDoc, createDoc, saveDoc, deleteDoc, duplicateDoc, archiveDoc,
  analyzeSeo, seoScore, htmlToMarkdown, slugify, htmlWordCount, mdToHtml,
  listIntegrations, publishDoc, listPublishLogs, externalSuggestions, CONNECTORS,
} from "../lib/content";
import { renderImage, imageDataUrl, suggestAltText, ArtStyle } from "../lib/artgen";

const CONN_ICON: Record<string, typeof Globe> = { globe: Globe, ghost: Ghost, pen: PenLine, layout: LayoutGrid };

function download(name: string, content: string, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ================= documents list ================= */
export function DocumentsPage() {
  const { user } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [del, setDel] = useState<Doc | null>(null);
  const [, bump] = useState(0);
  if (!user) return null;
  const archived = view === "archived";
  const docs = listDocs(user.id, { includeArchived: archived }).filter(d => (d.title + d.seo.keyword).toLowerCase().includes(q.toLowerCase()));

  const newDoc = () => {
    const d = createDoc(user.id, { title: "Untitled document" });
    nav(`/app/studio/${d.id}`);
  };

  return (
    <AppShell title="Content Studio" sub="Drafts, SEO and publishing in one workspace">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search documents…" className="pl-9" aria-label="Search documents" />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <div className="inline-flex rounded-lg border border-border overflow-hidden" role="tablist" aria-label="Document filter">
            {([["active", "Active"], ["archived", "Archived"]] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)}
                className={cn("px-3.5 h-9 text-[13px] font-medium transition-colors",
                  view === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>
          <Button onClick={newDoc}><Plus className="w-4 h-4" /> New document</Button>
        </div>
      </div>

      {docs.length === 0 ? (
        <Card>
          <EmptyState icon={archived ? <Archive className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            title={q ? "No matches" : archived ? "Nothing archived" : "No documents yet"}
            body={q ? "Try a different search term." : archived ? "Archived documents are kept safe here, out of your way." : "Create a blank document, or save any AI generation as a draft and edit it here with the full SEO workspace."}
            action={q ? <Button variant="outline" onClick={() => setQ("")}>Clear search</Button> : archived ? <Button variant="outline" onClick={() => setView("active")}>Back to active</Button> : <Button onClick={newDoc}><Plus className="w-4 h-4" /> Create your first document</Button>} />
        </Card>
      ) : (
        <div className="grid gap-2.5">
          {docs.map(d => (
            <Card key={d.id} className="p-4 flex items-center gap-4 hover:border-foreground/25 transition-colors group">
              <button onClick={() => nav(`/app/studio/${d.id}`)} className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-[14.5px] truncate group-hover:underline underline-offset-2">{d.title}</h3>
                  <Badge tone={d.status === "published" ? "success" : "muted"}>{d.status}</Badge>
                  {d.source.kind === "generation" && <Badge tone="outline" className="font-mono">{d.source.toolSlug}</Badge>}
                </div>
                <p className="text-[12px] text-muted-foreground mt-1 font-mono tabular">
                  {d.wordCount.toLocaleString()} words · updated {fmtDateTime(d.updatedAt)}
                  {d.cover ? " · has cover" : ""}
                </p>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                {archived ? (
                  <button title="Restore" aria-label={`Restore ${d.title}`} onClick={() => { archiveDoc(user.id, d.id, false); bump(x => x + 1); }}
                    className="p-2 rounded-md text-muted-foreground hover:text-emerald-600 hover:bg-emerald-600/10 transition-colors"><ArchiveRestore className="w-4 h-4" /></button>
                ) : (
                  <>
                    <button title="Duplicate" aria-label={`Duplicate ${d.title}`} onClick={() => { duplicateDoc(user.id, d.id); bump(x => x + 1); }}
                      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><CopyIcon className="w-4 h-4" /></button>
                    <button title="Archive" aria-label={`Archive ${d.title}`} onClick={() => { archiveDoc(user.id, d.id, true); bump(x => x + 1); }}
                      className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><Archive className="w-4 h-4" /></button>
                  </>
                )}
                <button title="Delete" aria-label={`Delete ${d.title}`} onClick={() => setDel(d)}
                  className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!del} onClose={() => setDel(null)} title="Delete document?"
        footer={<>
          <Button variant="outline" onClick={() => setDel(null)}>Keep it</Button>
          <Button variant="destructive" onClick={() => { if (del) deleteDoc(user.id, del.id); setDel(null); bump(x => x + 1); }}><Trash2 className="w-4 h-4" /> Delete</Button>
        </>}>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed">“{del?.title}” and its SEO data will be permanently removed. This can't be undone.</p>
      </Modal>
    </AppShell>
  );
}

/* ================= assistant ================= */
const ACTIONS = [
  { key: "draft", label: "Full draft", tool: "content-writer", desc: "Generate a structured draft from the title", mode: "replace" as const, icon: Wand2 },
  { key: "intro", label: "Introduction", tool: "introduction-generator", desc: "A hook plus opening paragraph", mode: "append" as const, icon: Sparkles },
  { key: "outline", label: "Outline", tool: "outline-generator", desc: "Section headings to write against", mode: "replace" as const, icon: ListTree },
  { key: "faq", label: "FAQ section", tool: "faq-generator", desc: "Append question-and-answer blocks", mode: "append" as const, icon: Send },
  { key: "conclusion", label: "Conclusion", tool: "conclusion-generator", desc: "Recap and a call to action", mode: "append" as const, icon: CheckCircle2 },
  { key: "improve", label: "Improve writing", tool: "text-improver", desc: "Rewrite the current text for clarity", mode: "replace" as const, icon: RefreshCw },
];

function Assistant({ doc, editor, onUsed }: { doc: Doc; editor: React.RefObject<EditorHandle>; onUsed(): void }) {
  const { user, toast } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const run = async (a: typeof ACTIONS[0]) => {
    if (!user) return;
    setBusy(a.key); setErr("");
    try {
      const plain = editor.current ? editor.current.getHtml().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
      const inputs: Record<string, string> = a.key === "improve"
        ? { text: plain.slice(0, 6000) || doc.title, goal: "clarity" }
        : { topic: doc.title || "your topic", keywords: doc.seo.keyword };
      const gen = await generate(user, a.tool, inputs);
      const html = gen.output.split("\n").filter(l => !l.startsWith("# ")).join("\n");
      const isEmpty = !editor.current || htmlWordCount(editor.current.getHtml()) < 5;
      editor.current?.insertHtml(mdToHtml(html), isEmpty || a.mode === "replace" ? "replace" : "append");
      onUsed();
      toast("success", `${a.label} ready`, `${gen.words.toLocaleString()} words inserted.`);
    } catch (ex: unknown) {
      const msg = (ex as Error).message;
      setErr(msg);
      if (/trial|plan|subscription|limit/i.test(msg)) toast("error", "Generation blocked", msg);
      else toast("error", "Generation failed", msg);
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11.5px] font-medium text-muted-foreground px-1">ASSISTANT · uses your plan's generation allowance</p>
      {ACTIONS.map(a => (
        <button key={a.key} onClick={() => run(a)} disabled={busy !== null}
          className={cn("w-full flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-all hover:border-foreground/30 hover:shadow-sm",
            busy === a.key && "opacity-70", busy && busy !== a.key && "opacity-45 pointer-events-none")}>
          <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 text-foreground">
            {busy === a.key ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <a.icon className="w-4 h-4" />}
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-semibold leading-tight">{a.label}</span>
            <span className="block text-[12px] text-muted-foreground mt-0.5 leading-snug">{a.desc}</span>
          </span>
        </button>
      ))}
      {err && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-[12.5px] text-destructive leading-relaxed">
          {err}
          {/trial|plan/i.test(err) && <Link to="/app/billing" className="block mt-1.5 font-semibold underline underline-offset-2">Manage subscription →</Link>}
        </div>
      )}
    </div>
  );
}

/* ================= cover image panel ================= */
function CoverPreview({ prompt, seed, style, alt, onSpec, onInserted }: {
  prompt: string; seed: number; style: ArtStyle; alt: string;
  onSpec(patch: Partial<{ seed: number; style: ArtStyle; alt: string }>): void;
  onInserted(dataUrl: string, alt: string): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvasRef.current) renderImage(canvasRef.current, { prompt, seed, style }, 960, 504); }, [prompt, seed, style]);
  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="w-full rounded-lg border border-border" aria-label="Generated cover preview" />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onSpec({ seed: Math.floor(Math.random() * 99999) })}><RefreshCw className="w-3.5 h-3.5" /> New variation</Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={() => downloadImage(prompt, seed, style)}><Download className="w-3.5 h-3.5" /> Download</Button>
      </div>
      <Field label="Alt text" help="Describes the image for screen readers and search engines.">
        <Input value={alt} onChange={e => onSpec({ alt: e.target.value })} />
      </Field>
      <Button size="sm" className="w-full" onClick={() => onInserted(imageDataUrl({ prompt, seed, style }), alt || suggestAltText(prompt))}>
        <ImageIcon className="w-3.5 h-3.5" /> Insert into document
      </Button>
    </div>
  );
}
function downloadImage(prompt: string, seed: number, style: ArtStyle) {
  const c = document.createElement("canvas");
  renderImage(c, { prompt, seed, style }, 1200, 630);
  const a = document.createElement("a");
  a.href = c.toDataURL("image/png");
  a.download = slugify(prompt || "cover") + ".png";
  a.click();
}

/* ================= studio workspace ================= */
export function StudioPage() {
  const { user, access, refresh, toast } = useApp();
  const { docId } = useParams();
  const nav = useNavigate();
  const editor = useRef<EditorHandle>(null);

  const doc0 = useMemo(() => { try { return user && docId ? getDoc(user.id, docId) : null; } catch { return null; } }, [user, docId]);
  const [doc, setDoc] = useState<Doc | null>(doc0);
  const [title, setTitle] = useState(doc0?.title || "");
  const [seo, setSeo] = useState(doc0?.seo || { title: "", description: "", keyword: "", slug: "" });
  const [cover, setCover] = useState(doc0?.cover);
  const [tab, setTab] = useState<"seo" | "outline" | "images" | "publish">("seo");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [stats, setStats] = useState({ words: doc0?.wordCount || 0, chars: 0, readMin: 0 });
  const [outline, setOutline] = useState<{ tag: string; text: string; id: string }[]>([]);
  const [seoHtml, setSeoHtml] = useState(doc0?.html || "");
  const [showPayload, setShowPayload] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [pubTarget, setPubTarget] = useState("");
  const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);
  const [selBusy, setSelBusy] = useState<string | null>(null);
  const [toneOpen, setToneOpen] = useState(false);

  /* the toolbar is positioned from a viewport rect — dismiss it on scroll so it never floats stale */
  useEffect(() => {
    if (!sel) return;
    const onScroll = () => setSel(null);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sel]);

  const runSel = async (action: AssistAction, tone = "professional") => {
    if (!user || !sel) return;
    setSelBusy(action + tone);
    try {
      const res = await runStudioAssist(user, action, sel.text, tone);
      editor.current?.replaceSelectionHtml(mdToHtml(res.text), action === "continue");
      if (editor.current) onEditorChange(editor.current.getHtml());
      toast("success", action === "continue" ? "Kept writing" : "Selection updated", `${res.words.toLocaleString()} words · counted against your plan.`);
      refresh();
      setSel(null); setToneOpen(false);
    } catch (ex: unknown) { toast("error", "Assistant blocked", (ex as Error).message); }
    setSelBusy(null);
  };

  const htmlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* autosave pipeline: keystroke → debounce html → debounce persist */
  const onEditorChange = (html: string) => {
    setSaveState("dirty");
    if (htmlTimer.current) clearTimeout(htmlTimer.current);
    htmlTimer.current = setTimeout(() => { setSeoHtml(html); persist({ html }); }, 700);
  };
  const persist = (patch: Partial<Pick<Doc, "title" | "html" | "seo" | "cover" | "status">>) => {
    if (!doc) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const next = saveDoc(user!.id, doc.id, patch);
        setDoc(next); setSaveState("saved");
      } catch (ex: unknown) { toast("error", "Couldn't save", (ex as Error).message); }
    }, 350);
  };

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); if (htmlTimer.current) clearTimeout(htmlTimer.current); }, []);

  /* outline extraction */
  useEffect(() => {
    const div = document.createElement("div");
    div.innerHTML = seoHtml;
    setOutline(Array.from(div.querySelectorAll("h1,h2,h3")).slice(0, 24).map((h, i) => ({ tag: h.tagName.toLowerCase(), text: (h.textContent || "").trim(), id: "h-" + i })));
  }, [seoHtml]);

  const checks = useMemo(() => analyzeSeo(seoHtml, seo), [seoHtml, seo]);

  /* not found — checked after all hooks have run */
  if (!doc0 || !doc) {
    return (
      <AppShell title="Content Studio" sub="Drafts, SEO and publishing in one workspace">
        <Card><EmptyState icon={<FileText className="w-5 h-5" />} title="Document not found"
          body="It may have been deleted, or it belongs to another account."
          action={<Button onClick={() => nav("/app/studio")}><ArrowLeft className="w-4 h-4" /> Back to documents</Button>} /></Card>
      </AppShell>
    );
  }
  const score = seoScore(checks);
  const integrations = user ? listIntegrations(user.id) : [];
  const logs = user ? listPublishLogs(user.id).filter(l => l.docId === doc.id).slice(0, 6) : [];

  const saveTitle = (v: string) => { setTitle(v); persist({ title: v }); };
  const saveSeo = (patch: Partial<typeof seo>) => { const next = { ...seo, ...patch }; setSeo(next); persist({ seo: next }); };

  const doPublish = async () => {
    if (!pubTarget) { setPubMsg({ ok: false, text: "Choose a connected platform first." }); return; }
    setPublishing(true); setPubMsg(null);
    try {
      const log = await publishDoc(user!.id, doc.id, pubTarget);
      setPubMsg({ ok: log.status === "sent", text: log.message });
      setDoc({ ...doc, status: log.status === "sent" ? "published" : doc.status });
      refresh();
    } catch (ex: unknown) { setPubMsg({ ok: false, text: (ex as Error).message }); }
    setPublishing(false);
  };

  const md = () => htmlToMarkdown(editor.current?.getHtml() || doc.html);

  return (
    <AppShell title="Content Studio" sub="Drafts, SEO and publishing in one workspace">
      {/* top bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link to="/app/studio" className="p-2 rounded-md border border-border hover:bg-accent transition-colors shrink-0" aria-label="Back to documents"><ArrowLeft className="w-4 h-4" /></Link>
        <input value={title} onChange={e => saveTitle(e.target.value)} aria-label="Document title"
          className="flex-1 min-w-[180px] bg-transparent font-display font-bold text-[17px] tracking-tight focus:outline-none border-b border-transparent focus:border-border px-0.5" />
        <Badge tone={doc.status === "published" ? "success" : "muted"}>{doc.status}</Badge>
        <span className={cn("text-[11.5px] font-mono inline-flex items-center gap-1.5", saveState === "saved" ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400")}>
          {saveState === "saving" ? <><LoaderCircle className="w-3 h-3 animate-spin" /> Saving…</> : saveState === "dirty" ? <><Clock3 className="w-3 h-3" /> Unsaved</> : <><Save className="w-3 h-3" /> Saved</>}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_300px] items-start">
        {/* assistant */}
        <aside className="xl:sticky xl:top-[76px] order-2 xl:order-1">
          <Assistant doc={doc} editor={editor} onUsed={() => { refresh(); }} />
        </aside>

        {/* editor */}
        <div className="order-1 xl:order-2 min-w-0">
          <RichEditor ref={editor} initialHtml={doc.html} onChange={onEditorChange} onStats={setStats}
            onSelect={(t, rect) => setSel(rect && t ? { text: t, x: rect.left + rect.width / 2, y: rect.top } : null)}
            renderLinkPopover={setUrl => (
              <LinkSuggestions keyword={seo.keyword || title} docs={user ? listDocs(user.id).filter(d => d.id !== doc.id).slice(0, 4) : []} onPick={setUrl} />
            )} />
          {sel && (
            <div className="fixed z-[80] animate-scale-in" style={{ left: Math.max(8, Math.min(window.innerWidth - 330, sel.x - 160)), top: Math.max(70, sel.y - (toneOpen ? 96 : 52)) }} role="toolbar" aria-label="Selection actions">
              <div className="rounded-lg border border-border bg-popover shadow-xl px-1.5 py-1.5 flex items-center gap-0.5">
                <span className="pl-1.5 pr-1 text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:inline">AI</span>
                {([["improve", "Improve"], ["shorten", "Shorten"], ["expand", "Expand"], ["continue", "Continue"]] as [AssistAction, string][]).map(([k, l]) => (
                  <button key={k} onClick={() => runSel(k)} disabled={selBusy !== null}
                    className="px-2.5 h-7 rounded-md text-[12px] font-medium hover:bg-accent transition-colors disabled:opacity-50">
                    {selBusy === k + "professional" ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : l}
                  </button>
                ))}
                <button onClick={() => setToneOpen(o => !o)} disabled={selBusy !== null}
                  className={cn("px-2.5 h-7 rounded-md text-[12px] font-medium transition-colors disabled:opacity-50", toneOpen ? "bg-foreground text-background" : "hover:bg-accent")}>Tone</button>
                <button onClick={() => setSel(null)} aria-label="Dismiss selection toolbar" className="w-7 h-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-accent"><XIcon className="w-3.5 h-3.5" /></button>
              </div>
              {toneOpen && (
                <div className="mt-1.5 rounded-lg border border-border bg-popover shadow-xl px-1.5 py-1.5 flex items-center gap-0.5 animate-fade-in">
                  {["professional", "friendly", "persuasive", "witty"].map(t => (
                    <button key={t} onClick={() => runSel("tone", t)} disabled={selBusy !== null}
                      className="px-2.5 h-7 rounded-md text-[12px] font-medium capitalize hover:bg-accent transition-colors disabled:opacity-50">
                      {selBusy === "tone" + t ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {access && access.wordsLimit !== -1 && access.wordsLimit - access.wordsUsed < 2000 && (
            <p className="mt-2 text-[12px] text-amber-600 dark:text-amber-400">Heads up: you're close to your monthly word limit — assistant generations count against it.</p>
          )}
        </div>

        {/* right panels */}
        <aside className="order-3 xl:sticky xl:top-[76px] min-w-0">
          <div className="flex gap-1 border-b border-border mb-3.5 overflow-x-auto scroll-slim" role="tablist">
            {([["seo", "SEO"], ["outline", "Outline"], ["images", "Images"], ["publish", "Publish"]] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn("px-3 py-2 text-[12.5px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                  tab === k ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>

          {tab === "seo" && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold">SEO score</p>
                <span className={cn("font-mono text-[13px] font-bold tabular", score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 50 ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>{score}/100</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full transition-all duration-500", score >= 80 ? "bg-emerald-600" : score >= 50 ? "bg-amber-500" : "bg-destructive")} style={{ width: `${score}%` }} /></div>
              <Field label="SEO title" help={`${seo.title.length}/60 characters`}>
                <Input value={seo.title} onChange={e => saveSeo({ title: e.target.value })} maxLength={90} />
              </Field>
              <Field label="Meta description" help={`${seo.description.length}/155 characters`}>
                <Textarea value={seo.description} onChange={e => saveSeo({ description: e.target.value })} maxLength={220} className="min-h-[70px]" />
              </Field>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Focus keyword"><Input value={seo.keyword} onChange={e => saveSeo({ keyword: e.target.value })} placeholder="ai writing tools" /></Field>
                <Field label="Slug"><Input value={seo.slug} onChange={e => saveSeo({ slug: slugify(e.target.value) })} className="font-mono text-[12px]" /></Field>
              </div>
              <ul className="space-y-1.5 pt-1">
                {checks.map(c => (
                  <li key={c.label} className="flex items-start gap-2 text-[12.5px] leading-snug">
                    {c.pass ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />}
                    <span title={c.hint} className={c.pass ? "" : "text-muted-foreground cursor-help"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "outline" && (
            <div>
              {outline.length === 0 ? (
                <EmptyState icon={<ListTree className="w-5 h-5" />} title="No headings yet" body="Headings (H1–H3) you add in the editor appear here as a clickable outline." />
              ) : (
                <ul className="space-y-0.5">
                  {outline.map((h, i) => (
                    <li key={i}>
                      <button onClick={() => {
                        const el = editor.current; if (!el) return;
                        el.focus();
                        const heads = (document.querySelector(".prose-doc"))?.querySelectorAll("h1,h2,h3");
                        heads?.[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                        className={cn("w-full text-left text-[13px] py-1.5 px-2 rounded-md hover:bg-accent transition-colors truncate",
                          h.tag === "h1" ? "font-bold" : h.tag === "h2" ? "font-medium pl-2" : "pl-6 text-muted-foreground")}>
                        {h.text || "(empty heading)"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "images" && (
            <CoverPreview
              prompt={seo.keyword || title || doc.title}
              seed={cover?.seed ?? 42} style={(cover?.style as ArtStyle) || "editorial"} alt={cover?.alt || suggestAltText(title || doc.title)}
              onSpec={patch => {
                const next = { id: cover?.id || "img_" + Date.now().toString(36), prompt: seo.keyword || title || doc.title, seed: patch.seed ?? cover?.seed ?? 42, style: patch.style || cover?.style || "editorial", alt: patch.alt ?? cover?.alt ?? "" };
                setCover(next);
                persist({ cover: next });
              }}
              onInserted={(dataUrl, alt) => {
                editor.current?.insertHtml(`<p><img src="${dataUrl}" alt="${alt.replace(/"/g, "&quot;")}" /></p>`, "cursor");
                toast("success", "Image inserted", "Inline images are stored with the document — keep an eye on draft size.");
              }} />
          )}

          {tab === "publish" && (
            <div className="space-y-3.5">
              {integrations.length === 0 ? (
                <EmptyState icon={<Globe className="w-5 h-5" />} title="No platforms connected"
                  body="Connect WordPress, Ghost, Medium or Webflow to publish straight from this workspace."
                  action={<Link to="/app/integrations"><Button variant="outline" size="sm"><ExternalLink className="w-3.5 h-3.5" /> Connect a platform</Button></Link>} />
              ) : (
                <>
                  <Field label="Publish to">
                    <Select value={pubTarget} onChange={e => setPubTarget(e.target.value)}
                      options={[{ value: "", label: "Choose a platform…" }, ...integrations.map(i => ({ value: i.id, label: i.name }))]} />
                  </Field>
                  <Button className="w-full" onClick={doPublish} loading={publishing}><Send className="w-4 h-4" /> Publish as draft</Button>
                  {pubMsg && (
                    <div className={cn("rounded-lg border p-3 text-[12.5px] leading-relaxed", pubMsg.ok ? "border-emerald-600/30 bg-emerald-600/8 text-emerald-700 dark:text-emerald-400" : "border-amber-500/35 bg-amber-500/8 text-amber-800 dark:text-amber-300")}>{pubMsg.text}</div>
                  )}
                </>
              )}
              <div className="pt-1 space-y-2">
                <p className="text-[11.5px] font-medium text-muted-foreground">EXPORT</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => download(slugify(doc.title) + ".md", md())}><Download className="w-3.5 h-3.5" /> Markdown</Button>
                  <Button variant="outline" size="sm" onClick={() => download(slugify(doc.title) + ".html", `<!doctype html><html><head><meta charset="utf-8"><title>${doc.title.replace(/</g, "&lt;")}</title></head><body>${editor.current?.getHtml() || doc.html}</body></html>`, "text/html")}><Download className="w-3.5 h-3.5" /> HTML</Button>
                </div>
              </div>
              {logs.length > 0 && (
                <div className="pt-1 space-y-2">
                  <p className="text-[11.5px] font-medium text-muted-foreground">PUBLISH HISTORY</p>
                  <ul className="space-y-2">
                    {logs.map(l => (
                      <li key={l.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2 text-[12.5px]">
                          {l.status === "sent" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                          <span className="font-semibold capitalize">{CONNECTORS.find(c => c.id === l.connector)?.name || l.connector}</span>
                          <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">{fmtDateTime(l.createdAt)}</span>
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-1.5 leading-snug">{l.message}</p>
                        <button className="text-[11.5px] font-medium underline underline-offset-2 mt-1.5 hover:text-foreground text-muted-foreground" onClick={() => setShowPayload(showPayload === l.id ? null : l.id)}>
                          {showPayload === l.id ? "Hide API payload" : "View API payload"}
                        </button>
                        {showPayload === l.id && <pre className="mt-2 text-[10.5px] font-mono bg-muted rounded-md p-2.5 overflow-x-auto max-h-44 scroll-slim whitespace-pre-wrap break-all">{l.payload}</pre>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

/* ================= link suggestions inside editor popover ================= */
function LinkSuggestions({ keyword, docs, onPick }: { keyword: string; docs: Doc[]; onPick(url: string): void }) {
  const ext = useMemo(() => externalSuggestions(keyword), [keyword]);
  if (docs.length === 0 && ext.length === 0) return null;
  return (
    <div className="space-y-2">
      {docs.length > 0 && (
        <div>
          <p className="text-[10.5px] font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Link2 className="w-3 h-3" /> LINK TO YOUR CONTENT</p>
          <div className="space-y-1">
            {docs.map(d => (
              <button key={d.id} className="w-full text-left text-[12.5px] rounded-md border border-border px-2.5 py-1.5 hover:bg-accent transition-colors truncate" onClick={() => onPick(`#/app/studio/${d.id}`)}>
                {d.title}
              </button>
            ))}
          </div>
        </div>
      )}
      {ext.length > 0 && (
        <div>
          <p className="text-[10.5px] font-semibold text-muted-foreground mb-1 flex items-center gap-1"><ExternalLink className="w-3 h-3" /> AUTHORITATIVE EXTERNAL SOURCES</p>
          <div className="space-y-1">
            {ext.map(s => (
              <button key={s.url} className="w-full text-left text-[12.5px] rounded-md border border-border px-2.5 py-1.5 hover:bg-accent transition-colors" onClick={() => onPick(s.url)}>
                <span className="font-medium">{s.label}</span> <span className="text-muted-foreground">— {s.why}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


