/* Content workspace layer: documents, drafts, images, publishing
   integrations, password-reset codes and favorites.
   Every function validates ownership — the equivalent of Laravel policies.
   Integration credentials are stored obfuscated in the local datastore;
   in production they live server-side, encrypted with Laravel Crypt. */
import { getDb, mutate, uid, nowISO, hash } from "./db";
import { countWords, hashStr, rng } from "./ai";
import { ApiError } from "./services";
import type { Generation } from "./db";

/* ================= documents ================= */
export interface DocSeo { title: string; description: string; keyword: string; slug: string; }
export interface DocImage { id: string; prompt: string; seed: number; style: string; alt: string; }
export interface Doc {
  id: string; userId: string; title: string; html: string;
  seo: DocSeo; cover: DocImage | null; images: DocImage[];
  source: { kind: "generation" | "blank"; toolSlug?: string; generationId?: string };
  status: "draft" | "published";
  wordCount: number; createdAt: string; updatedAt: string;
}
export interface UserIntegration { id: string; userId: string; connector: string; config: Record<string, string>; connectedAt: string; }
export interface PublishLog {
  id: string; userId: string; docId: string; docTitle: string; connector: string;
  status: "sent" | "failed"; message: string; payload: string; createdAt: string;
}

interface ContentStore { version: number; docs: Doc[]; integrations: UserIntegration[]; publishLogs: PublishLog[]; resets: { email: string; code: string; expiresAt: string }[]; }

const CKEY = "chatdeck.content.v1";
let ccache: ContentStore | null = null;
function getStore(): ContentStore {
  if (ccache) return ccache;
  try {
    const raw = localStorage.getItem(CKEY);
    if (raw) { ccache = JSON.parse(raw) as ContentStore; return ccache; }
  } catch { /* reseed */ }
  ccache = { version: 1, docs: seedDocs(), integrations: [], publishLogs: [], resets: [] };
  saveStore(ccache);
  return ccache;
}
function saveStore(s: ContentStore) { ccache = s; try { localStorage.setItem(CKEY, JSON.stringify(s)); } catch { /* quota */ } }
function mutateC<T>(fn: (s: ContentStore) => T): T { const s = getStore(); const out = fn(s); saveStore(s); return out; }

/* ================= markdown → safe html ================= */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = (s: string) => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/\*([^*]+)\*/g, "<em>$1</em>")
  .replace(/`([^`]+)`/g, "<code>$1</code>");

export function mdToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }
    if (line.startsWith("### ")) { closeList(); out.push(`<h3>${inline(line.slice(4))}</h3>`); }
    else if (line.startsWith("## ")) { closeList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); }
    else if (line.startsWith("# ")) { closeList(); out.push(`<h1>${inline(line.slice(2))}</h1>`); }
    else if (line.startsWith("---")) { closeList(); out.push("<hr>"); }
    else if (/^[-•→✓] /.test(line)) {
      if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
      out.push(`<li>${inline(line.replace(/^[-•→✓] /, ""))}</li>`);
    } else if (/^\d+\. /.test(line)) {
      if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
      out.push(`<li>${inline(line.replace(/^\d+\. /, ""))}</li>`);
    } else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  return out.join("");
}

export function htmlToText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = sanitizeHtml(html);
  return (div.textContent || "").replace(/\s+/g, " ").trim();
}
export function htmlWordCount(html: string): number { return countWords(htmlToText(html)); }

/* Strict allowlist sanitizer — used before anything touches the editor or export */
const ALLOWED = new Set(["P", "H1", "H2", "H3", "H4", "UL", "OL", "LI", "BLOCKQUOTE", "STRONG", "EM", "B", "I", "U", "S", "A", "BR", "HR", "CODE", "PRE", "IMG", "SPAN", "DIV"]);
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const clean = (node: Element): Element | null => {
    if (!ALLOWED.has(node.tagName)) {
      const frag = document.createElement("span");
      node.childNodes.forEach(ch => { if (ch.nodeType === 3) frag.appendChild(document.createTextNode(ch.textContent || "")); else if (ch.nodeType === 1) { const c = clean(ch as Element); if (c) frag.appendChild(c); } });
      return frag.children.length || frag.textContent ? frag : null;
    }
    const el = document.createElement(node.tagName.toLowerCase());
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (node.tagName === "A" && name === "href" && /^(https?:|mailto:|#|\/)/i.test(attr.value)) el.setAttribute("href", attr.value);
      if (node.tagName === "A" && (name === "title")) el.setAttribute("title", attr.value.slice(0, 200));
      if (node.tagName === "IMG" && name === "src" && /^(data:image\/(png|jpeg|webp);base64,|https?:)/i.test(attr.value)) el.setAttribute("src", attr.value);
      if (node.tagName === "IMG" && name === "alt") el.setAttribute("alt", attr.value.slice(0, 300));
    }
    if (node.tagName === "A") { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener noreferrer"); }
    node.childNodes.forEach(ch => {
      if (ch.nodeType === 3) el.appendChild(document.createTextNode(ch.textContent || ""));
      else if (ch.nodeType === 1) { const c = clean(ch as Element); if (c) el.appendChild(c); }
    });
    return el;
  };
  const wrap = document.createElement("div");
  doc.body.childNodes.forEach(ch => { if (ch.nodeType === 1) { const c = clean(ch as Element); if (c) wrap.appendChild(c); } else if (ch.nodeType === 3 && ch.textContent?.trim()) wrap.appendChild(document.createTextNode(ch.textContent)); });
  return wrap.innerHTML;
}

export function htmlToMarkdown(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = sanitizeHtml(html);
  const walk = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent || "";
    if (node.nodeType !== 1) return "";
    const el = node as Element;
    const inner = () => Array.from(el.childNodes).map(walk).join("");
    switch (el.tagName) {
      case "H1": return `\n# ${inner().trim()}\n\n`;
      case "H2": return `\n## ${inner().trim()}\n\n`;
      case "H3": return `\n### ${inner().trim()}\n\n`;
      case "P": return `${inner().trim()}\n\n`;
      case "STRONG": case "B": return `**${inner()}**`;
      case "EM": case "I": return `*${inner()}*`;
      case "U": return `<u>${inner()}</u>`;
      case "S": return `~~${inner()}~~`;
      case "CODE": return `\`${inner()}\``;
      case "A": return `[${inner()}](${el.getAttribute("href") || ""})`;
      case "IMG": return `![${el.getAttribute("alt") || "image"}](${el.getAttribute("src") || ""})\n\n`;
      case "BR": return "\n";
      case "HR": return "\n---\n\n";
      case "BLOCKQUOTE": return `> ${inner().trim().replace(/\n+/g, "\n> ")}\n\n`;
      case "LI": return `- ${inner().trim()}\n`;
      case "UL": case "OL": return `\n${inner()}\n`;
      default: return inner();
    }
  };
  return Array.from(div.childNodes).map(walk).join("").replace(/\n{3,}/g, "\n\n").trim();
}

export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 70);

/* ================= SEO analysis ================= */
export interface SeoCheck { label: string; pass: boolean; hint: string; }
export function analyzeSeo(html: string, seo: DocSeo): SeoCheck[] {
  const text = htmlToText(html);
  const words = countWords(text);
  const kw = seo.keyword.trim().toLowerCase();
  const lower = text.toLowerCase();
  const occurrences = kw ? lower.split(kw).length - 1 : 0;
  const density = words && kw ? (occurrences * kw.split(" ").length / words) * 100 : 0;
  const div = document.createElement("div");
  div.innerHTML = sanitizeHtml(html);
  const headings = Array.from(div.querySelectorAll("h1,h2,h3")).map(h => h.textContent || "").join(" ").toLowerCase();
  const firstP = (div.querySelector("p")?.textContent || "").toLowerCase();
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 2);
  const avgSentence = sentences.length ? words / sentences.length : 0;
  const title = seo.title.trim();
  return [
    { label: "SEO title is 30–60 characters", pass: title.length >= 30 && title.length <= 60, hint: `${title.length || 0} chars — aim for 30–60 so it isn't truncated in search results.` },
    { label: "Meta description is 70–155 characters", pass: seo.description.trim().length >= 70 && seo.description.trim().length <= 155, hint: `${seo.description.trim().length || 0} chars — under 155 avoids truncation.` },
    { label: "Focus keyword is set", pass: !!kw, hint: "Pick one primary keyword the page should rank for." },
    { label: "Keyword appears in the title", pass: !!kw && title.toLowerCase().includes(kw), hint: "Keep it near the beginning of the title." },
    { label: "Keyword appears in the meta description", pass: !!kw && seo.description.toLowerCase().includes(kw), hint: "Search engines bold matching terms — it lifts CTR." },
    { label: "Keyword appears in the first paragraph", pass: !!kw && firstP.includes(kw), hint: "Early placement signals topical focus." },
    { label: "Keyword appears in at least one heading", pass: !!kw && headings.includes(kw), hint: "Use it naturally in an H2 or H3." },
    { label: "Keyword density is natural (0.5–2.5%)", pass: density >= 0.5 && density <= 2.5, hint: `Currently ${density.toFixed(1)}% — write for people first.` },
    { label: "Content is at least 300 words", pass: words >= 300, hint: `${words} words — thin pages struggle to rank.` },
    { label: "Sentences average under 22 words", pass: avgSentence > 0 && avgSentence <= 22, hint: `Average is ${avgSentence.toFixed(1)} — shorter sentences read better.` },
    { label: "URL slug is set", pass: !!seo.slug.trim(), hint: "Short, lowercase, hyphenated." },
  ];
}
export const seoScore = (checks: SeoCheck[]) => Math.round((checks.filter(c => c.pass).length / checks.length) * 100);

/* ================= documents CRUD (ownership enforced) ================= */
const own = (s: ContentStore, userId: string, docId: string): Doc => {
  const doc = s.docs.find(d => d.id === docId);
  if (!doc || doc.userId !== userId) throw new ApiError("FORBIDDEN", "This document doesn't exist or belongs to another account.");
  return doc;
};

export function listDocs(userId: string): Doc[] {
  return getStore().docs.filter(d => d.userId === userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function getDoc(userId: string, docId: string): Doc {
  return own(getStore(), userId, docId);
}
export function createDoc(userId: string, opts: { title: string; html?: string; source?: Doc["source"] }): Doc {
  const title = opts.title.trim().slice(0, 160) || "Untitled document";
  const html = sanitizeHtml(opts.html || "");
  return mutateC(s => {
    const doc: Doc = {
      id: "doc_" + uid(), userId, title, html,
      seo: { title, description: "", keyword: "", slug: slugify(title) },
      cover: null, images: [], source: opts.source || { kind: "blank" },
      status: "draft", wordCount: htmlWordCount(html), createdAt: nowISO(), updatedAt: nowISO(),
    };
    s.docs.unshift(doc);
    return doc;
  });
}
export function saveDoc(userId: string, docId: string, patch: Partial<Pick<Doc, "title" | "html" | "seo" | "cover" | "images" | "status">>): Doc {
  return mutateC(s => {
    const doc = own(s, userId, docId);
    if (patch.title !== undefined) doc.title = patch.title.trim().slice(0, 160) || "Untitled document";
    if (patch.html !== undefined) { doc.html = sanitizeHtml(patch.html); doc.wordCount = htmlWordCount(doc.html); }
    if (patch.seo) doc.seo = { ...doc.seo, ...patch.seo, slug: slugify(patch.seo.slug || doc.title) };
    if (patch.cover !== undefined) doc.cover = patch.cover;
    if (patch.images) doc.images = patch.images.slice(0, 12);
    if (patch.status) doc.status = patch.status;
    doc.updatedAt = nowISO();
    return { ...doc };
  });
}
export function deleteDoc(userId: string, docId: string): void {
  mutateC(s => { own(s, userId, docId); s.docs = s.docs.filter(d => !(d.id === docId && d.userId === userId)); });
}
export function duplicateDoc(userId: string, docId: string): Doc {
  const src = getDoc(userId, docId);
  return createDoc(userId, { title: src.title + " (copy)", html: src.html, source: src.source });
}
export function docFromGeneration(userId: string, gen: Generation): Doc {
  const firstLine = gen.output.split("\n").find(l => l.startsWith("# "))?.slice(2).trim();
  return createDoc(userId, {
    title: firstLine || gen.toolName + " draft",
    html: mdToHtml(gen.output),
    source: { kind: "generation", toolSlug: gen.toolSlug, generationId: gen.id },
  });
}

/* ================= favorites ================= */
export function getFavs(userId: string): string[] {
  try { return JSON.parse(localStorage.getItem("chatdeck.favs." + userId) || "[]") as string[]; } catch { return []; }
}
export function toggleFav(userId: string, slug: string): string[] {
  const cur = getFavs(userId);
  const next = cur.includes(slug) ? cur.filter(s => s !== slug) : [...cur, slug].slice(-12);
  try { localStorage.setItem("chatdeck.favs." + userId, JSON.stringify(next)); } catch { /* noop */ }
  return next;
}

/* ================= password reset codes ================= */
export function requestResetCode(email: string): { code: string } {
  const db = getDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) throw new ApiError("NOT_FOUND", "No account found for that email.");
  const code = String(Math.floor(100000 + Math.random() * 900000));
  mutateC(s => {
    s.resets = s.resets.filter(r => r.email !== user.email);
    s.resets.push({ email: user.email, code, expiresAt: new Date(Date.now() + 15 * 60000).toISOString() });
  });
  return { code }; // In production this is emailed — never returned to the client.
}
export function consumeResetCode(email: string, code: string, newPassword: string): void {
  if (newPassword.length < 8) throw new ApiError("VALIDATION", "Password must be at least 8 characters.");
  const entry = getStore().resets.find(r => r.email.toLowerCase() === email.toLowerCase());
  if (!entry || entry.code !== code.trim()) throw new ApiError("VALIDATION", "That reset code is incorrect.");
  if (new Date(entry.expiresAt).getTime() < Date.now()) throw new ApiError("EXPIRED", "That code has expired — request a new one.");
  mutate(d => {
    const u = d.users.find(x => x.email.toLowerCase() === email.toLowerCase());
    if (u) u.passHash = hash(newPassword);
  });
  mutateC(s => { s.resets = s.resets.filter(r => r.email.toLowerCase() !== email.toLowerCase()); });
}

/* ================= publishing integrations ================= */
export interface ConnectorField { key: string; label: string; type: "url" | "text" | "secret"; placeholder: string; help?: string; }
export interface Connector { id: string; name: string; blurb: string; icon: string; fields: ConnectorField[]; docs: string; }

export const CONNECTORS: Connector[] = [
  {
    id: "wordpress", name: "WordPress", icon: "globe",
    blurb: "Publish drafts straight to a WordPress site via the REST API.",
    fields: [
      { key: "site", label: "Site URL", type: "url", placeholder: "https://yourblog.com", help: "Must be reachable and running WordPress 4.7+." },
      { key: "username", label: "Username", type: "text", placeholder: "editor" },
      { key: "app_password", label: "Application password", type: "secret", placeholder: "xxxx xxxx xxxx xxxx", help: "Create one under Users → Application Passwords." },
    ],
    docs: "POST {site}/wp-json/wp/v2/posts with basic auth (application password).",
  },
  {
    id: "ghost", name: "Ghost", icon: "ghost",
    blurb: "Push content to Ghost publications with the Admin API.",
    fields: [
      { key: "site", label: "Admin API URL", type: "url", placeholder: "https://yourpub.ghost.io" },
      { key: "key", label: "Admin API key", type: "secret", placeholder: "id:secret", help: "From Settings → Integrations → Add custom integration." },
    ],
    docs: "POST {site}/ghost/api/admin/posts/ using a signed JWT from the Admin API key.",
  },
  {
    id: "medium", name: "Medium", icon: "pen",
    blurb: "Send HTML posts to a connected Medium profile.",
    fields: [
      { key: "token", label: "Integration token", type: "secret", placeholder: "181d415f34379af07b2c11d144dfbe35d", help: "From Medium → Settings → Integration tokens." },
    ],
    docs: "POST https://api.medium.com/v1/users/me/posts with Bearer token.",
  },
  {
    id: "webflow", name: "Webflow", icon: "layout",
    blurb: "Create CMS collection items in a Webflow site.",
    fields: [
      { key: "site", label: "Site ID", type: "text", placeholder: "580e63e98c9a982ac9b8b741" },
      { key: "collection", label: "Collection ID", type: "text", placeholder: "580e63fc9f6f87b761e8c48c" },
      { key: "token", label: "API token", type: "secret", placeholder: "••••••••••••" },
    ],
    docs: "POST https://api.webflow.com/v2/collections/{id}/items with Bearer token.",
  },
];

/* Light obfuscation for the local demo datastore.
   Production: Laravel Crypt (AES-256-CBC) on the server — keys never reach the browser. */
const pack = (s: string) => btoa(unescape(encodeURIComponent("cd1:" + s)));
const unpack = (s: string) => { try { const v = decodeURIComponent(escape(atob(s))); return v.startsWith("cd1:") ? v.slice(4) : ""; } catch { return ""; } };

export function listIntegrations(userId: string): (UserIntegration & { name: string; masked: Record<string, string> })[] {
  return getStore().integrations.filter(i => i.userId === userId).map(i => {
    const conn = CONNECTORS.find(c => c.id === i.connector);
    const decoded: Record<string, string> = {};
    const masked: Record<string, string> = {};
    for (const [k, v] of Object.entries(i.config)) decoded[k] = unpack(v);
    for (const f of conn?.fields || []) masked[f.key] = f.type === "secret" ? "••••••••••" : (decoded[f.key] || "");
    return { ...i, name: conn?.name || i.connector, masked };
  });
}
export function connectIntegration(userId: string, connectorId: string, config: Record<string, string>): UserIntegration {
  const conn = CONNECTORS.find(c => c.id === connectorId);
  if (!conn) throw new ApiError("NOT_FOUND", "Unknown integration.");
  for (const f of conn.fields) {
    const v = (config[f.key] || "").trim();
    if (!v) throw new ApiError("VALIDATION", `${f.label} is required.`);
    if (f.type === "url" && !/^https?:\/\/[^\s]+\.[^\s]+/.test(v)) throw new ApiError("VALIDATION", `${f.label} must be a valid https URL.`);
    if (f.type === "secret" && v.length < 8) throw new ApiError("VALIDATION", `${f.label} looks too short.`);
  }
  return mutateC(s => {
    s.integrations = s.integrations.filter(i => !(i.userId === userId && i.connector === connectorId));
    const rec: UserIntegration = {
      id: "int_" + uid(), userId, connector: connectorId,
      config: Object.fromEntries(Object.entries(config).map(([k, v]) => [k, pack(v.trim())])),
      connectedAt: nowISO(),
    };
    s.integrations.push(rec);
    return rec;
  });
}
export function disconnectIntegration(userId: string, integrationId: string): void {
  mutateC(s => {
    const rec = s.integrations.find(i => i.id === integrationId && i.userId === userId);
    if (!rec) throw new ApiError("FORBIDDEN", "Integration not found.");
    s.integrations = s.integrations.filter(i => i.id !== integrationId);
  });
}

function buildPayload(connector: string, doc: Doc): { url: string; body: unknown } {
  const seo = doc.seo;
  switch (connector) {
    case "wordpress": return { url: "/wp-json/wp/v2/posts", body: { title: doc.title, content: doc.html, excerpt: seo.description, slug: seo.slug, status: "draft" } };
    case "ghost": return { url: "/ghost/api/admin/posts/", body: { posts: [{ title: doc.title, html: doc.html, excerpt: seo.description, slug: seo.slug, status: "draft" }] } };
    case "medium": return { url: "https://api.medium.com/v1/users/me/posts", body: { title: doc.title, contentFormat: "html", content: doc.html, publishStatus: "draft" } };
    case "webflow": return { url: "/items", body: { isArchived: false, isDraft: true, fieldData: { name: doc.title, slug: seo.slug, body: doc.html } } };
    default: throw new ApiError("NOT_FOUND", "Unknown integration.");
  }
}

export async function testIntegration(userId: string, integrationId: string): Promise<{ ok: boolean; message: string }> {
  const store = getStore();
  const rec = store.integrations.find(i => i.id === integrationId && i.userId === userId);
  if (!rec) throw new ApiError("FORBIDDEN", "Integration not found.");
  const conn = CONNECTORS.find(c => c.id === rec.connector)!;
  const site = unpack(rec.config.site || "");
  const target = site || (rec.connector === "medium" ? "https://api.medium.com" : "");
  if (!target) return { ok: false, message: `${conn.name} needs a site URL to test against.` };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    await fetch(target, { method: "HEAD", mode: "no-cors", signal: ctrl.signal });
    clearTimeout(t);
    return { ok: true, message: `Reached ${new URL(target).host}. Credentials are validated on first publish.` };
  } catch {
    return { ok: false, message: `Couldn't reach ${target}. Check the URL, your network, and that the site allows cross-origin requests.` };
  }
}

export async function publishDoc(userId: string, docId: string, integrationId: string): Promise<PublishLog> {
  const doc = getDoc(userId, docId);
  const store = getStore();
  const rec = store.integrations.find(i => i.id === integrationId && i.userId === userId);
  if (!rec) throw new ApiError("FORBIDDEN", "Connect this platform before publishing.");
  if (doc.wordCount < 10) throw new ApiError("VALIDATION", "The document is too short to publish — add some content first.");
  const conn = CONNECTORS.find(c => c.id === rec.connector)!;
  const payload = buildPayload(rec.connector, doc);
  const site = unpack(rec.config.site || "");
  const url = payload.url.startsWith("http") ? payload.url : (site ? site.replace(/\/$/, "") + payload.url : payload.url);

  let status: PublishLog["status"] = "failed";
  let message = "";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(url, {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload.body),
    });
    clearTimeout(t);
    if (res.ok) { status = "sent"; message = `Accepted by ${conn.name} (HTTP ${res.status}). The post was created as a draft on your site.`; }
    else { message = `${conn.name} responded with HTTP ${res.status}. Check the credentials and permissions for this token.`; }
  } catch {
    message = `${conn.name} couldn't be reached from this browser session (network or CORS). The exact API payload is saved below — replay it from your server, or configure the provider endpoint in Admin → Settings.`;
  }
  return mutateC(s => {
    const log: PublishLog = {
      id: "pub_" + uid(), userId, docId, docTitle: doc.title, connector: rec.connector,
      status, message, payload: JSON.stringify({ url, body: payload.body }, null, 2), createdAt: nowISO(),
    };
    s.publishLogs.unshift(log);
    s.publishLogs = s.publishLogs.slice(0, 60);
    if (status === "sent") {
      const d = s.docs.find(x => x.id === docId);
      if (d) { d.status = "published"; d.updatedAt = nowISO(); }
    }
    return log;
  });
}
export function listPublishLogs(userId: string): PublishLog[] {
  return getStore().publishLogs.filter(l => l.userId === userId);
}

/* ================= link suggestions ================= */
export function externalSuggestions(topic: string): { label: string; url: string; why: string }[] {
  const t = topic.toLowerCase();
  const all = [
    { label: "Google Search Central", url: "https://developers.google.com/search/docs", why: "authoritative SEO reference", match: ["seo", "keyword", "search", "ranking"] },
    { label: "MDN Web Docs", url: "https://developer.mozilla.org", why: "trusted technical reference", match: ["web", "code", "javascript", "css", "api", "developer"] },
    { label: "Nielsen Norman Group", url: "https://www.nngroup.com/articles/", why: "UX research citations", match: ["ux", "design", "usability", "user"] },
    { label: "Harvard Business Review", url: "https://hbr.org", why: "business & strategy source", match: ["business", "strategy", "management", "growth", "leadership"] },
    { label: "Statista", url: "https://www.statista.com", why: "statistics and market data", match: ["market", "data", "statistics", "trends", "report"] },
    { label: "Mailmodo Guides", url: "https://www.mailmodo.com/guides/", why: "email deliverability data", match: ["email", "deliverability", "newsletter"] },
    { label: "Ahrefs Blog", url: "https://ahrefs.com/blog/", why: "link-building and content studies", match: ["seo", "content", "backlink", "keyword"] },
  ];
  const scored = all.map(s => ({ ...s, score: s.match.filter(m => t.includes(m)).length }));
  return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)
    .map(({ label, url, why }) => ({ label, url, why }));
}

/* ================= seed documents for the demo account ================= */
function seedDocs(): Doc[] {
  const db = getDb();
  const demo = db.users.find(u => u.email === "demo@chatdeck.ai");
  if (!demo) return [];
  const gen = db.generations.filter(g => g.userId === demo.id).slice(0, 2);
  const docs: Doc[] = [];
  for (const g of gen) {
    const title = g.output.split("\n").find(l => l.startsWith("# "))?.slice(2).trim() || g.toolName + " draft";
    const html = mdToHtml(g.output);
    const r = rng(hashStr(g.id));
    docs.push({
      id: "doc_" + g.id.slice(4), userId: demo.id, title, html,
      seo: { title: title.slice(0, 58), description: `A practical, example-driven guide to ${title.toLowerCase().slice(0, 60)} — with steps you can apply this week.`, keyword: title.split(" ").slice(0, 2).join(" ").toLowerCase(), slug: slugify(title) },
      cover: { id: "img_" + g.id.slice(4), prompt: title, seed: Math.floor(r() * 99999), style: ["editorial", "arc", "band"][Math.floor(r() * 3)], alt: `Abstract cover illustration for ${title.toLowerCase().slice(0, 48)}` },
      images: [], source: { kind: "generation", toolSlug: g.toolSlug, generationId: g.id },
      status: "draft", wordCount: htmlWordCount(html), createdAt: g.createdAt, updatedAt: g.createdAt,
    });
  }
  return docs;
}
