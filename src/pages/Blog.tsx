import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Tag, User as UserIcon, Search } from "lucide-react";
import { PublicLayout, SectionHead } from "../components/site";
import { Badge, Button, Card, EmptyState, Reveal, cn } from "../components/ui";
import { listPublishedPosts, getPostBySlug, listPostCategories, getSettings, fmtDate } from "../lib/services";
import { mdToHtml } from "../lib/content";
import { countWords } from "../lib/ai";
import { renderImage, ArtStyle } from "../lib/artgen";
import type { Post } from "../lib/db";

const readMin = (body: string) => Math.max(1, Math.round(countWords(body) / 220));

function Cover({ post, height, className = "" }: { post: Post; height?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && post.cover) renderImage(ref.current, { prompt: post.cover.prompt, seed: post.cover.seed, style: post.cover.style as ArtStyle }, 760, 400);
  }, [post.id, post.cover]);
  /* inline height only as a fallback — explicit Tailwind classes win when provided */
  const style = height && !/h-\[|h-full/.test(className) ? { height } : undefined;
  if (!post.cover) return <div className={cn("bg-muted flex items-center justify-center", className)} style={style}><span className="font-mono text-[11px] text-muted-foreground">no cover</span></div>;
  return <canvas ref={ref} role="img" aria-label={post.cover.alt} className={cn("w-full object-cover", className)} style={style} />;
}

function PostMeta({ post }: { post: Post }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground font-mono tabular">
      <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(post.publishAt)}</span>
      <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" />{readMin(post.body)} min read</span>
      <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" />{post.author}</span>
    </p>
  );
}

/* ================= list ================= */
export function BlogListPage() {
  const nav = useNavigate();
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const posts = useMemo(() => listPublishedPosts(), []);
  const cats = useMemo(() => listPostCategories(), []);
  const filtered = posts.filter(p => (cat === "all" || p.category === cat) && (p.title + p.excerpt + p.tags.join(" ")).toLowerCase().includes(q.toLowerCase()));
  const settings = getSettings();
  const [featured, ...rest] = filtered;

  return (
    <PublicLayout>
      <section className="relative overflow-hidden noise border-b border-border">
        <div className="absolute inset-0 dot-grid [mask-image:radial-gradient(ellipse_70%_80%_at_50%_0%,black,transparent)]" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-14 md:pt-36">
          <Reveal>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">The ChatDeck blog</p>
            <h1 className="font-display text-[34px] sm:text-[44px] font-extrabold tracking-[-0.03em] leading-[1.05] mt-3 max-w-2xl">
              Notes on writing, SEO and <em className="font-serif-accent italic font-normal">shipping content</em> that works
            </h1>
            <p className="text-[15px] text-muted-foreground leading-relaxed mt-4 max-w-xl">{settings.site.name} field notes — the workflows, checklists and honest numbers behind content teams that publish consistently.</p>
          </Reveal>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-8">
          <div className="flex gap-1.5 overflow-x-auto scroll-slim -mx-1 px-1" role="tablist" aria-label="Categories">
            {["all", ...cats].map(c => (
              <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)}
                className={cn("px-3.5 h-9 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors capitalize",
                  cat === c ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}>
                {c}
              </button>
            ))}
          </div>
          <div className="relative md:ml-auto md:w-64 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search posts…" aria-label="Search posts"
              className="w-full h-9 rounded-lg border border-input bg-background pl-9 pr-3 text-[13px] placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/60" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <Card><EmptyState icon={<Search className="w-5 h-5" />} title="Nothing matches" body="Try another search term or category."
            action={<Button variant="outline" onClick={() => { setQ(""); setCat("all"); }}>Clear filters</Button>} /></Card>
        ) : (
          <div className="space-y-4">
            {featured && (
              <Reveal>
                <button onClick={() => nav(`/blog/${featured.slug}`)} className="group w-full text-left grid md:grid-cols-[1.1fr_1fr] rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:border-foreground/35 hover:shadow-lg">
                  <div className="overflow-hidden"><Cover post={featured} className="h-[200px] md:h-full transition-transform duration-500 group-hover:scale-[1.03]" /></div>
                  <div className="p-6 md:p-8 flex flex-col">
                    <div className="flex items-center gap-2">
                      <Badge tone="muted" className="font-mono">{featured.category}</Badge>
                      <Badge tone="outline" className="font-mono">Latest</Badge>
                    </div>
                    <h2 className="font-display text-[22px] md:text-[26px] font-extrabold tracking-tight leading-tight mt-3.5 group-hover:underline underline-offset-4 decoration-2">{featured.title}</h2>
                    <p className="text-[14px] text-muted-foreground leading-relaxed mt-3 line-clamp-3">{featured.excerpt}</p>
                    <div className="mt-auto pt-5"><PostMeta post={featured} /></div>
                  </div>
                </button>
              </Reveal>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((p, i) => (
                <Reveal key={p.id} delay={(i % 3) * 70}>
                  <button onClick={() => nav(`/blog/${p.slug}`)} className="group w-full h-full text-left rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-foreground/30 flex flex-col">
                    <div className="overflow-hidden"><Cover post={p} className="h-[150px] transition-transform duration-500 group-hover:scale-[1.04]" /></div>
                    <div className="p-5 flex flex-col flex-1">
                      <Badge tone="muted" className="font-mono self-start">{p.category}</Badge>
                      <h3 className="font-display font-bold text-[16px] tracking-tight leading-snug mt-2.5 group-hover:underline underline-offset-2">{p.title}</h3>
                      <p className="text-[13px] text-muted-foreground leading-relaxed mt-2 line-clamp-2">{p.excerpt}</p>
                      <div className="mt-auto pt-4"><PostMeta post={p} /></div>
                    </div>
                  </button>
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </section>
    </PublicLayout>
  );
}

/* ================= article ================= */
export function BlogPostPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const post = useMemo(() => (slug ? getPostBySlug(slug) : null), [slug]);
  const related = useMemo(() => (post ? listPublishedPosts().filter(p => p.category === post.category && p.id !== post.id).slice(0, 3) : []), [post]);
  const html = useMemo(() => (post ? mdToHtml(post.body) : ""), [post]);
  const settings = getSettings();

  /* per-post meta — search engines + social cards */
  useEffect(() => {
    if (!post) return;
    document.title = `${post.seo.title || post.title} · ${settings.site.name}`;
    let desc = document.querySelector<HTMLMetaElement>("meta[name=description]");
    if (!desc) { desc = document.createElement("meta"); desc.name = "description"; document.head.appendChild(desc); }
    desc.content = post.seo.description || post.excerpt;
    let og = document.querySelector<HTMLMetaElement>("meta[property='og:title']");
    if (og) og.content = post.seo.title || post.title;
  }, [post, settings.site.name]);

  if (!post) {
    return (
      <PublicLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-40 pb-24 text-center">
          <p className="font-mono text-[70px] sm:text-[100px] font-bold leading-none tracking-tighter text-foreground/10 select-none">404</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight -mt-5">Post not found</h1>
          <p className="text-[14.5px] text-muted-foreground mt-3">It may be unpublished, rescheduled, or the link is wrong.</p>
          <Button className="mt-7" onClick={() => nav("/blog")}><ArrowLeft className="w-4 h-4" /> Back to the blog</Button>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 md:pt-32 pb-20">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-mono">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link><span>/</span>
          <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link><span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{post.slug}</span>
        </nav>

        <header className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="muted" className="font-mono">{post.category}</Badge>
            {post.tags.map(t => <Badge key={t} tone="outline" className="font-mono"><Tag className="w-3 h-3" />{t}</Badge>)}
          </div>
          <h1 className="font-display text-[30px] sm:text-[40px] font-extrabold tracking-[-0.03em] leading-[1.1] mt-4">{post.title}</h1>
          <p className="text-[15.5px] text-muted-foreground leading-relaxed mt-4">{post.excerpt}</p>
          <div className="mt-5 pb-6 border-b border-border"><PostMeta post={post} /></div>
        </header>

        {post.cover && (
          <div className="rounded-xl overflow-hidden border border-border my-8">
            <Cover post={post} className="h-[220px] sm:h-[340px]" />
          </div>
        )}

        <div className="prose-doc max-w-none" dangerouslySetInnerHTML={{ __html: html }} />

        <footer className="mt-12 pt-6 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center text-[12px] font-bold">{post.author.split(" ").map(w => w[0]).join("")}</span>
              <div><p className="text-[13.5px] font-semibold leading-none">{post.author}</p><p className="text-[12px] text-muted-foreground mt-1">Writing about content ops at {settings.site.name}</p></div>
            </div>
            <Link to="/blog" className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:underline underline-offset-2">All posts <ArrowRight className="w-3.5 h-3.5" /></Link>
          </div>
        </footer>

        {related.length > 0 && (
          <section className="mt-14" aria-label="Related posts">
            <SectionHead eyebrow="Keep reading" title={<>More from <em className="font-serif-accent italic font-normal">{post.category}</em></>} />
            <div className="grid sm:grid-cols-3 gap-4">
              {related.map(p => (
                <button key={p.id} onClick={() => nav(`/blog/${p.slug}`)} className="group text-left rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-foreground/30">
                  <Cover post={p} className="h-[110px]" />
                  <div className="p-4">
                    <h3 className="font-display font-bold text-[14.5px] tracking-tight leading-snug group-hover:underline underline-offset-2">{p.title}</h3>
                    <p className="text-[11.5px] text-muted-foreground font-mono mt-2">{fmtDate(p.publishAt)} · {readMin(p.body)} min</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </article>
    </PublicLayout>
  );
}
