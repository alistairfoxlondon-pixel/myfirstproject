import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, ExternalLink, Check, RefreshCw, Search } from "lucide-react";
import { AdminShell } from "./Admin";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Switch, Tabs, Textarea, cn } from "../components/ui";
import { useApp } from "../lib/app";
import { adminListPosts, adminSavePost, adminDeletePost, fmtDate, fmtDateTime } from "../lib/services";
import { slugify, mdToHtml } from "../lib/content";
import { renderImage, suggestAltText, ArtStyle } from "../lib/artgen";
import type { Post } from "../lib/db";
import { uid } from "../lib/db";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATUS_TONE = { draft: "muted", published: "success", scheduled: "warn" } as const;

function CoverEdit({ cover, onChange }: { cover: Post["cover"]; onChange(c: NonNullable<Post["cover"]>): void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && cover) renderImage(ref.current, { prompt: cover.prompt, seed: cover.seed, style: cover.style as ArtStyle }, 640, 336);
  }, [cover]);
  if (!cover) return (
    <Button variant="outline" size="sm" onClick={() => onChange({ prompt: "your article title", seed: Math.floor(Math.random() * 99999), style: "editorial", alt: "" })}>
      <Plus className="w-3.5 h-3.5" /> Add cover image
    </Button>
  );
  return (
    <div className="space-y-2.5">
      <canvas ref={ref} role="img" aria-label="Cover preview" className="w-full h-[130px] object-cover rounded-lg border border-border" />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input value={cover.prompt} onChange={e => onChange({ ...cover, prompt: e.target.value })} placeholder="Cover prompt" aria-label="Cover prompt" />
        <Button variant="outline" size="md" onClick={() => onChange({ ...cover, seed: Math.floor(Math.random() * 99999) })} aria-label="New variation"><RefreshCw className="w-3.5 h-3.5" /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={cover.style} onChange={e => onChange({ ...cover, style: e.target.value })} aria-label="Cover style"
          options={[{ value: "editorial", label: "Editorial" }, { value: "band", label: "Bands" }, { value: "arc", label: "Rings" }, { value: "grid", label: "Grid" }]} />
        <Input value={cover.alt || suggestAltText(cover.prompt)} onChange={e => onChange({ ...cover, alt: e.target.value })} placeholder="Alt text" aria-label="Cover alt text" />
      </div>
      <button onClick={() => onChange(null as never)} className="text-[11.5px] text-muted-foreground hover:text-destructive transition-colors">Remove cover</button>
    </div>
  );
}

export default function AdminBlog() {
  const { user: admin, toast, refresh } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState<Post | null>(null);
  const [del, setDel] = useState<Post | null>(null);
  const [preview, setPreview] = useState(false);
  const [err, setErr] = useState("");
  const isAdmin = admin?.role === "admin";
  const posts = useMemo(() => (isAdmin && admin ? adminListPosts(admin) : []), [isAdmin, admin, edit, del]);

  if (!isAdmin) return null;

  const list = posts
    .filter(p => filter === "all" || p.status === filter)
    .filter(p => (p.title + p.category + p.tags.join(" ")).toLowerCase().includes(q.toLowerCase()));

  const blank = (): Post => ({
    id: "post_" + uid(), slug: "", title: "", excerpt: "", body: "", category: "General", tags: [],
    author: admin?.name || "Team", status: "draft", publishAt: new Date().toISOString(),
    cover: null, seo: { title: "", description: "", canonical: "" }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  const set = (patch: Partial<Post>) => setEdit(p => (p ? { ...p, ...patch } : p));
  const save = () => {
    if (!edit || !admin) return;
    try {
      const clean = {
        ...edit,
        slug: edit.slug || slugify(edit.title),
        seo: { title: edit.seo.title || edit.title, description: edit.seo.description || edit.excerpt, canonical: edit.seo.canonical },
      };
      adminSavePost(admin, clean);
      toast("success", edit.status === "published" ? "Post published" : "Post saved", `"${clean.title}" is ${clean.status}.`);
      setEdit(null); setErr(""); refresh();
    } catch (ex: unknown) { setErr((ex as Error).message); }
  };

  return (
    <AdminShell title="Blog" sub="The public content engine — posts, categories and SEO"
      actions={<Button size="sm" onClick={() => { setEdit(blank()); setPreview(false); setErr(""); }}><Plus className="w-3.5 h-3.5" /> New post</Button>}>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search posts…" className="pl-9" aria-label="Search posts" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scroll-slim" role="tablist" aria-label="Status filter">
          {["all", "published", "draft", "scheduled"].map(f => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={cn("px-3.5 h-9 rounded-lg text-[13px] font-medium whitespace-nowrap capitalize transition-colors",
                filter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}>{f}</button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState icon={<Search className="w-5 h-5" />} title="No posts found" body={q ? "Try a different search." : "Write your first post — it powers the sitemap, social cards and related-post links automatically."}
            action={<Button onClick={() => { setEdit(blank()); setPreview(false); setErr(""); }}><Plus className="w-4 h-4" /> New post</Button>} />
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/40">
                  <th className="px-4 py-3 font-medium">Post</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Publish date</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/40 transition-colors">
                    <td className="px-4 py-3">
                      <button onClick={() => { setEdit(p); setPreview(false); setErr(""); }} className="text-left min-w-0 max-w-[340px]">
                        <span className="font-semibold block truncate hover:underline underline-offset-2">{p.title || "Untitled"}</span>
                        <span className="text-[11.5px] text-muted-foreground font-mono">/{p.slug || "—"} · updated {fmtDate(p.updatedAt)}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3"><Badge tone="muted" className="font-mono">{p.category}</Badge></td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[p.status]} className="capitalize">{p.status}</Badge></td>
                    <td className="px-4 py-3 font-mono text-[12px] text-muted-foreground whitespace-nowrap">{fmtDateTime(p.publishAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {p.status === "published" && (
                          <Link to={`/blog/${p.slug}`} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" aria-label={`View ${p.title}`}><ExternalLink className="w-4 h-4" /></Link>
                        )}
                        <button onClick={() => { setEdit(p); setPreview(false); setErr(""); }} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" aria-label={`Edit ${p.title}`}><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setDel(p)} className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label={`Delete ${p.title}`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* editor */}
      <Modal open={!!edit} onClose={() => setEdit(null)} wide title={edit?.title ? `Edit — ${edit.title.slice(0, 40)}` : "New post"}
        footer={<>
          <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
          <Button onClick={save}><Check className="w-4 h-4" /> {edit?.status === "published" ? "Save & keep published" : "Save post"}</Button>
        </>}>
        {edit && (
          <div className="space-y-4">
            {err && <div className="rounded-lg border border-destructive/30 bg-destructive/8 text-destructive text-[13px] px-3.5 py-2.5">{err}</div>}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Field label="Title" required><Input value={edit.title} onChange={e => set({ title: e.target.value, slug: slugify(e.target.value) === slugify(edit.title) || !edit.slug ? slugify(e.target.value) : edit.slug })} placeholder="A headline people actually click" /></Field>
              </div>
              <Field label="Slug" help="Used in the URL and sitemap."><Input value={edit.slug} onChange={e => set({ slug: slugify(e.target.value) })} className="font-mono" placeholder="my-post-url" /></Field>
              <Field label="Author"><Input value={edit.author} onChange={e => set({ author: e.target.value })} /></Field>
              <Field label="Category"><Input value={edit.category} onChange={e => set({ category: e.target.value })} placeholder="SEO, Product, Content strategy…" /></Field>
              <Field label="Tags" help="Comma separated, max 8."><Input value={edit.tags.join(", ")} onChange={e => set({ tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })} placeholder="workflow, keywords" /></Field>
              <Field label="Status">
                <Select value={edit.status} onChange={e => set({ status: e.target.value as Post["status"] })}
                  options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "scheduled", label: "Scheduled" }]} />
              </Field>
              <Field label="Publish date" help={edit.status === "scheduled" ? "Goes live automatically at this time." : "Shown on the post."}>
                <Input type="datetime-local" value={toLocalInput(edit.publishAt)} onChange={e => e.target.value && set({ publishAt: new Date(e.target.value).toISOString() })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Excerpt" help={`${edit.excerpt.length}/220 — used in cards, meta description and RSS.`}>
                  <Textarea rows={2} value={edit.excerpt} onChange={e => set({ excerpt: e.target.value })} maxLength={220} />
                </Field>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[13px] font-medium">Body <span className="text-muted-foreground font-normal">(Markdown: # headings, **bold**, - lists, &gt; quotes)</span></p>
                <button onClick={() => setPreview(v => !v)} className={cn("inline-flex items-center gap-1.5 text-[12.5px] font-medium px-2.5 h-8 rounded-md transition-colors", preview ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent")}>
                  <Eye className="w-3.5 h-3.5" /> {preview ? "Edit" : "Preview"}
                </button>
              </div>
              {preview ? (
                <div className="prose-doc rounded-lg border border-border bg-background p-5 min-h-[220px] max-h-[380px] overflow-y-auto studio-scroll" dangerouslySetInnerHTML={{ __html: mdToHtml(edit.body) }} />
              ) : (
                <Textarea rows={10} className="font-mono text-[12.5px] min-h-[220px]" value={edit.body} onChange={e => set({ body: e.target.value })} placeholder={"## First section\n\nWrite in Markdown…"} />
              )}
            </div>

            <div className="grid sm:grid-cols-[240px_1fr] gap-4">
              <div>
                <p className="text-[13px] font-medium mb-2">Cover image</p>
                <CoverEdit cover={edit.cover} onChange={c => set({ cover: c })} />
              </div>
              <div className="space-y-3.5">
                <p className="text-[13px] font-medium">Post SEO</p>
                <Field label="SEO title" help={`${(edit.seo.title || edit.title).length}/60 characters`}>
                  <Input value={edit.seo.title} onChange={e => set({ seo: { ...edit.seo, title: e.target.value } })} placeholder={edit.title} maxLength={70} />
                </Field>
                <Field label="Meta description" help={`${(edit.seo.description || edit.excerpt).length}/160 characters`}>
                  <Textarea rows={2} value={edit.seo.description} onChange={e => set({ seo: { ...edit.seo, description: e.target.value } })} placeholder={edit.excerpt} maxLength={160} />
                </Field>
                <Field label="Canonical URL" help="Leave empty to use this post's own URL.">
                  <Input value={edit.seo.canonical} onChange={e => set({ seo: { ...edit.seo, canonical: e.target.value } })} placeholder="https://…" className="font-mono" />
                </Field>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* delete confirm */}
      <Modal open={!!del} onClose={() => setDel(null)} title={`Delete "${del?.title.slice(0, 40)}"?`}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { if (admin && del) { adminDeletePost(admin, del.id); toast("info", "Post deleted", del.title); setDel(null); refresh(); } }}><Trash2 className="w-4 h-4" /> Delete post</Button></>}>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed">The post disappears from the blog, sitemap and related links immediately. This can't be undone.</p>
      </Modal>
    </AdminShell>
  );
}
