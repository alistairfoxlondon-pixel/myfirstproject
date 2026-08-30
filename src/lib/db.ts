/* Relational-style data store persisted to localStorage.
   Mirrors the Laravel schema: users, plans, tools, subscriptions,
   generations, usage, invoices, activity_log, settings. */
import { generateOutput, countWords, hashStr, rng } from "./ai";

/* ================= types ================= */
export type Role = "user" | "admin";
export type UserStatus = "active" | "suspended";
export type Tier = "trial" | "starter" | "pro" | "business" | "enterprise";
export type PlanStatus = "active" | "archived";
export type SubStatus = "trialing" | "active" | "canceled" | "expired" | "past_due";
export type ToolCategory = "writing" | "content" | "seo" | "marketing" | "productivity";

export interface User {
  id: string; name: string; email: string; passHash: string;
  role: Role; status: UserStatus; createdAt: string; verifiedAt: string | null;
  color: string; company?: string;
}
export interface Plan {
  id: string; slug: string; name: string; description: string; tier: Tier;
  monthly: number; yearly: number; wordsLimit: number; generationsLimit: number; // -1 = unlimited
  features: string[]; active: boolean; isTrial: boolean; isPopular: boolean; sort: number;
}
export interface ToolField {
  key: string; label: string; type: "text" | "textarea" | "select" | "number";
  placeholder?: string; options?: string[]; required?: boolean; rows?: number;
  default?: string; min?: number; max?: number; help?: string;
}
export interface Tool {
  id: string; slug: string; name: string; tagline: string; category: ToolCategory;
  icon: string; outputKind: string; minTier: Tier; dailyCap: number; // 0 = no cap
  fields: ToolField[]; active: boolean; uses: number; createdAt: string;
}
export interface Subscription {
  id: string; userId: string; planId: string; status: SubStatus; period: "monthly" | "yearly";
  currentPeriodEnd: string; cancelAtPeriodEnd: boolean; startedAt: string;
  payment: { brand: string; last4: string; exp: string } | null; provider: string;
}
export interface Generation {
  id: string; userId: string; toolSlug: string; toolName: string;
  inputs: Record<string, string>; output: string; words: number; chars: number;
  status: "completed" | "failed"; model: string; provider: string; createdAt: string; durationMs: number;
}
export interface Usage {
  userId: string; month: string; wordsUsed: number; generationsUsed: number;
  byDay: Record<string, number>; byTool: Record<string, number>;
}
export interface Invoice {
  id: string; userId: string; number: string; planName: string; period: string;
  amount: number; status: "paid" | "open" | "void"; createdAt: string; last4: string;
}
export interface Activity { id: string; actor: string; role: string; action: string; detail: string; createdAt: string; }
export interface Post {
  id: string; slug: string; title: string; excerpt: string; body: string;
  category: string; tags: string[]; author: string;
  status: "draft" | "published" | "scheduled"; publishAt: string;
  cover: { prompt: string; seed: number; style: string; alt: string } | null;
  seo: { title: string; description: string; canonical: string };
  createdAt: string; updatedAt: string;
}
export interface Settings {
  site: { name: string; tagline: string; description: string; supportEmail: string; twitter: string; github: string; linkedin: string };
  registration: { enabled: boolean; requireVerification: boolean };
  trial: { days: number; words: number; generations: number; onExpire: "lock" | "readonly" };
  ai: { provider: "openai" | "anthropic" | "gemini" | "mock"; model: string; apiKey: string; temperature: number; maxTokens: number };
  usage: { ratePerMinute: number; maxOutputWords: number };
  billing: { currency: string; taxRate: number };
  seo: { defaultTitle: string; defaultDescription: string; canonicalBase: string; ogSiteName: string; indexPublic: boolean; robots: string };
  sections: { id: string; label: string; enabled: boolean }[];
}
export interface DB {
  version: number;
  users: User[]; plans: Plan[]; tools: Tool[]; subscriptions: Subscription[];
  generations: Generation[]; usage: Usage[]; invoices: Invoice[]; activity: Activity[];
  posts: Post[]; settings: Settings; seq: number;
}

/* ================= helpers ================= */
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const nowISO = () => new Date().toISOString();
export const daysAgoISO = (n: number, h = 10) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, (n * 17) % 60, 0, 0); return d.toISOString(); };
export const daysAheadISO = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); };
export const monthKey = (iso: string) => iso.slice(0, 7);
export const dayKey = (iso: string) => iso.slice(0, 10);
export const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return "h$" + h.toString(36); };
export const tierRank: Record<Tier, number> = { trial: 0, starter: 1, pro: 2, business: 3, enterprise: 4 };

const TONES = ["professional", "friendly", "persuasive", "witty", "neutral"];
const TOPICS = [
  "remote team onboarding", "sustainable packaging for DTC brands", "no-code automation",
  "B2B content marketing", "customer retention strategy", "product-led growth",
  "email deliverability", "technical SEO audits", "community-led growth", "freelance pricing",
  "AI in customer support", "landing page conversion", "podcast marketing", "SaaS churn reduction",
  "personal branding for founders", "influencer partnerships", "webinar funnels", "local SEO",
];
const KW_POOL = ["automation", "templates", "ROI", "workflow", "analytics", "checklist", "onboarding", "conversion"];
const SAMPLE_TEXT = [
  "our team have been working on the new campaign for three month now, and the results was better then expected. we believes that focusing to the customer journey are the key reason. however, their is still room for improvements in the follow-up sequences.",
  "The quick brown fox jump over the lazy dog. Me and my team thinks this approach works good for most clients, but their feedback suggest otherwise. We was planning to revising the offer before the next quarter begin.",
  "Starting a blog are easier than ever, but growing one require consistency. Many writer struggle with this because they dont have a system. Its important to plan you topics ahead and writes even when you dont feel motivated.",
];

/* ================= seed ================= */
const SEED_VERSION = 8;

function seedTools(): Tool[] {
  const tone = { key: "tone", label: "Tone of voice", type: "select" as const, options: TONES, default: "professional" };
  const lang = { key: "language", label: "Language", type: "select" as const, options: ["English", "Spanish", "German", "French", "Portuguese", "Dutch"], default: "English" };
  const length = { key: "length", label: "Content length", type: "select" as const, options: ["short", "medium", "long"], default: "medium" };
  const audience = { key: "audience", label: "Target audience", type: "text" as const, placeholder: "e.g. SaaS founders, busy marketers…" };
  const count = (d = 8) => ({ key: "count", label: "How many?", type: "number" as const, default: String(d), min: 3, max: 15 });
  const topic = (ph: string) => ({ key: "topic", label: "Topic", type: "text" as const, placeholder: ph, required: true });
  const mk = (slug: string, name: string, tagline: string, category: ToolCategory, icon: string, outputKind: string, minTier: Tier, dailyCap: number, fields: ToolField[]): Tool =>
    ({ id: "tool_" + slug, slug, name, tagline, category, icon, outputKind, minTier, dailyCap, fields, active: true, uses: 0, createdAt: daysAgoISO(120) });

  return [
    mk("content-writer", "AI Content Writer", "Long-form content from a topic and a few keywords.", "content", "pen", "article", "trial", 20, [
      { key: "topic", label: "What should it be about?", type: "textarea", rows: 2, placeholder: "e.g. Why sustainable packaging matters to Gen-Z shoppers", required: true },
      { key: "keywords", label: "Keywords (comma separated)", type: "text", placeholder: "eco packaging, DTC brands" },
      tone, lang, length,
    ]),
    mk("article-writer", "AI Article Writer", "Research-grade articles with a clear structure.", "content", "fileText", "article", "starter", 15, [
      { key: "title", label: "Working title", type: "text", placeholder: "The Complete Guide to Product-Led Growth", required: true },
      { key: "keywords", label: "Keywords", type: "text", placeholder: "PLG, onboarding, activation" },
      audience, tone, length,
    ]),
    mk("blog-writer", "AI Blog Writer", "Publish-ready blog posts with headings and flow.", "content", "notebook", "blog", "starter", 15, [
      topic("e.g. 7 email deliverability fixes that actually work"),
      { key: "keywords", label: "Keywords", type: "text" }, tone, length,
      { key: "include_faq", label: "Append FAQ section?", type: "select", options: ["yes", "no"], default: "yes" },
    ]),
    mk("content-rewriter", "AI Content Rewriter", "Rewrite anything in a new voice or style.", "writing", "refresh", "rewrite", "trial", 30, [
      { key: "content", label: "Content to rewrite", type: "textarea", rows: 5, placeholder: "Paste your text here…", required: true },
      tone, { key: "strength", label: "Rewrite strength", type: "select", options: ["light", "moderate", "heavy"], default: "moderate" },
    ]),
    mk("paragraph-rewriter", "AI Paragraph Rewriter", "Sharpen a single paragraph in seconds.", "writing", "paragraph", "paragraphRewrite", "trial", 40, [
      { key: "paragraph", label: "Paragraph", type: "textarea", rows: 4, required: true },
      { key: "tone", label: "Desired tone", type: "select", options: TONES, default: "neutral" },
    ]),
    mk("text-improver", "AI Text Improver", "Clarity, flow and punch for existing copy.", "writing", "sparkles", "improve", "trial", 40, [
      { key: "text", label: "Your text", type: "textarea", rows: 5, required: true },
      { key: "goal", label: "Improve for", type: "select", options: ["clarity", "engagement", "conciseness"], default: "clarity" },
    ]),
    mk("grammar-checker", "AI Grammar Checker", "Corrections with a clear change log.", "writing", "spell", "grammar", "trial", 50, [
      { key: "text", label: "Text to check", type: "textarea", rows: 5, required: true },
      { key: "english_variant", label: "English variant", type: "select", options: ["US", "UK"], default: "US" },
    ]),
    mk("summarizer", "AI Content Summarizer", "Compress long text into bullets or a brief.", "productivity", "compress", "summary", "trial", 30, [
      { key: "content", label: "Content to summarize", type: "textarea", rows: 6, required: true },
      { key: "format", label: "Format", type: "select", options: ["bullets", "paragraph"], default: "bullets" },
      { key: "length", label: "Summary length", type: "select", options: ["short", "medium"], default: "short" },
    ]),
    mk("blog-title-generator", "AI Blog Title Generator", "Clickable, honest titles for any topic.", "seo", "type", "titles", "trial", 40, [
      topic("e.g. remote team onboarding"), { key: "keywords", label: "Keywords", type: "text" },
      count(8), tone,
    ]),
    mk("headline-generator", "AI Headline Generator", "Headlines for pages, ads and campaigns.", "marketing", "heading", "headline", "trial", 40, [
      topic("e.g. project management for agencies"), audience, count(8),
      { key: "style", label: "Style", type: "select", options: ["benefit-driven", "curiosity", "how-to", "listicle"], default: "benefit-driven" },
    ]),
    mk("meta-title-generator", "AI Meta Title Generator", "SERP titles that fit and convert.", "seo", "tag", "metaTitle", "trial", 40, [
      topic("e.g. best CRM for startups"), { key: "keywords", label: "Keywords", type: "text" },
      { key: "brand", label: "Brand name (optional)", type: "text", placeholder: "ChatDeck" }, count(6),
    ]),
    mk("meta-description-generator", "AI Meta Description Generator", "Descriptions under 155 characters that earn clicks.", "seo", "alignLeft", "metaDesc", "trial", 40, [
      topic("e.g. landing page conversion"), { key: "keywords", label: "Keywords", type: "text" }, tone, count(5),
    ]),
    mk("seo-content-generator", "AI SEO Content Generator", "Full SEO briefs: structure, keywords, SERP notes.", "seo", "search", "seoBrief", "pro", 12, [
      { key: "keyword", label: "Primary keyword", type: "text", placeholder: "e.g. ai writing tools", required: true },
      { key: "secondary_keywords", label: "Secondary keywords", type: "text" },
      { key: "intent", label: "Search intent", type: "select", options: ["informational", "commercial", "transactional", "navigational"], default: "informational" },
      length,
    ]),
    mk("product-description", "AI Product Description Generator", "E-commerce copy that sells the benefit.", "marketing", "package", "product", "starter", 25, [
      { key: "product", label: "Product name", type: "text", placeholder: "e.g. Aurora Desk Lamp", required: true },
      { key: "features", label: "Key features (comma separated)", type: "textarea", rows: 2, placeholder: "3 color temps, USB-C, dimmable" },
      audience, tone, length,
    ]),
    mk("social-media-content", "AI Social Media Content Generator", "Platform-native posts with hooks and tags.", "marketing", "megaphone", "social", "trial", 30, [
      topic("e.g. our new analytics dashboard"),
      { key: "platform", label: "Platform", type: "select", options: ["linkedin", "twitter", "x", "instagram"], default: "linkedin" },
      tone, { key: "hashtags", label: "Include hashtags?", type: "select", options: ["yes", "no"], default: "yes" },
    ]),
    mk("email-writer", "AI Email Writer", "Cold, warm and lifecycle emails that read human.", "marketing", "mail", "email", "starter", 25, [
      { key: "purpose", label: "Purpose", type: "text", placeholder: "e.g. re-engage dormant trial users", required: true },
      { key: "audience", label: "Recipient", type: "text", placeholder: "e.g. marketing leads at 50-person companies" },
      { key: "key_points", label: "Key points (one per line)", type: "textarea", rows: 3 },
      tone, length,
    ]),
    mk("ad-copy-generator", "AI Ad Copy Generator", "Google, Meta and LinkedIn ad variants.", "marketing", "target", "adCopy", "pro", 20, [
      { key: "product", label: "Product / service", type: "text", required: true },
      audience, { key: "benefit", label: "Core benefit", type: "text", placeholder: "e.g. cut reporting time in half" },
      { key: "platform", label: "Ad platform", type: "select", options: ["google", "facebook", "linkedin"], default: "google" },
      { key: "cta", label: "Call to action", type: "text", placeholder: "Start free trial" },
    ]),
    mk("introduction-generator", "AI Introduction Generator", "Openings that make people keep reading.", "writing", "doorOpen", "intro", "trial", 30, [
      topic("e.g. customer retention strategy"),
      { key: "hook_style", label: "Hook style", type: "select", options: ["question", "statistic", "story", "bold"], default: "question" },
      audience, tone,
    ]),
    mk("conclusion-generator", "AI Conclusion Generator", "Closings with a recap and a real CTA.", "writing", "flag", "conclusion", "trial", 30, [
      topic("e.g. webinar funnels"),
      { key: "key_points", label: "Key points to recap (comma separated)", type: "textarea", rows: 2 },
      { key: "cta", label: "CTA type", type: "select", options: ["newsletter", "trial", "comment", "share"], default: "newsletter" },
    ]),
    mk("faq-generator", "AI FAQ Generator", "Question sets your audience actually asks.", "content", "helpCircle", "faq", "starter", 20, [
      topic("e.g. our pricing model"), audience, count(6),
    ]),
    mk("outline-generator", "AI Content Outline Generator", "Structured outlines before you write a word.", "content", "listTree", "outline", "trial", 30, [
      topic("e.g. technical SEO audits"),
      { key: "type", label: "Content type", type: "select", options: ["blog post", "article", "video script", "landing page"], default: "blog post" },
      { key: "depth", label: "Depth", type: "select", options: ["standard", "detailed"], default: "standard" },
      { key: "sections", label: "Sections", type: "number", default: "5", min: 3, max: 9 },
    ]),
    mk("keyword-cluster", "AI Keyword Content Planner", "Clustered keywords mapped to funnels.", "seo", "gitBranch", "keywords", "pro", 12, [
      { key: "seed_keyword", label: "Seed keyword", type: "text", placeholder: "e.g. ai writing tools", required: true },
      { key: "niche", label: "Niche context", type: "text" }, count(12),
    ]),
    mk("tone-changer", "AI Tone Changer", "Move copy from one register to another.", "writing", "sliders", "rewrite", "pro", 20, [
      { key: "content", label: "Original content", type: "textarea", rows: 5, required: true },
      { key: "to_tone", label: "Convert to tone", type: "select", options: TONES, default: "friendly" },
      { key: "strength", label: "Strength", type: "select", options: ["light", "moderate", "heavy"], default: "moderate" },
    ]),
    mk("idea-brainstormer", "AI Idea Brainstormer", "Never stare at a blank content calendar again.", "productivity", "lightbulb", "ideas", "trial", 30, [
      { key: "niche", label: "Niche / subject", type: "text", placeholder: "e.g. personal finance for creatives", required: true },
      { key: "format", label: "Preferred format", type: "select", options: ["any", "long-form", "social", "video"], default: "any" },
      count(10),
    ]),
    mk("press-release", "AI Press Release Writer", "Announcement-ready releases in AP style.", "marketing", "newspaper", "press", "business", 8, [
      { key: "company", label: "Company", type: "text", required: true },
      { key: "announcement", label: "What are you announcing?", type: "textarea", rows: 2, required: true },
      { key: "quote_person", label: "Quoted person & role", type: "text", placeholder: "Jane Doe, CEO" },
      { key: "audience", label: "Who benefits?", type: "text" },
    ]),
    mk("video-script", "AI Video Script Writer", "Timed scripts with hooks, b-roll and CTAs.", "content", "clapperboard", "script", "business", 8, [
      topic("e.g. how we cut support tickets 40%"),
      { key: "duration", label: "Duration", type: "select", options: ["30 seconds", "60 seconds", "3 minutes", "8 minutes"], default: "60 seconds" },
      { key: "platform", label: "Platform", type: "select", options: ["youtube", "tiktok", "reels", "webinar"], default: "youtube" },
      audience, tone,
    ]),
  ];
}

function seedPlans(): Plan[] {
  return [
    { id: "plan_trial", slug: "trial", name: "Free Trial", description: "Explore the core writing toolkit — no card required.", tier: "trial", monthly: 0, yearly: 0, wordsLimit: 5000, generationsLimit: 30, active: true, isTrial: true, isPopular: false, sort: 0, features: ["All trial-tier tools", "Generation history", "Copy & export", "Community support"] },
    { id: "plan_starter", slug: "starter", name: "Starter", description: "For solo creators shipping content every week.", tier: "starter", monthly: 12, yearly: 115, wordsLimit: 50000, generationsLimit: 500, active: true, isTrial: false, isPopular: false, sort: 1, features: ["Everything in Trial", "50,000 words / month", "500 generations / month", "Article & blog writers", "Email support"] },
    { id: "plan_pro", slug: "pro", name: "Pro", description: "For marketers and founders who publish daily.", tier: "pro", monthly: 29, yearly: 278, wordsLimit: 200000, generationsLimit: 2500, active: true, isTrial: false, isPopular: true, sort: 2, features: ["Everything in Starter", "200,000 words / month", "2,500 generations / month", "SEO suite & ad copy", "Keyword planner", "Priority support"] },
    { id: "plan_business", slug: "business", name: "Business", description: "For teams that need room and controls.", tier: "business", monthly: 79, yearly: 758, wordsLimit: 1000000, generationsLimit: 10000, active: true, isTrial: false, isPopular: false, sort: 3, features: ["Everything in Pro", "1M words / month", "10,000 generations / month", "Press & video tools", "3 team seats included", "Usage analytics"] },
    { id: "plan_enterprise", slug: "enterprise", name: "Enterprise", description: "Custom volume, SSO, and a dedicated success manager.", tier: "enterprise", monthly: 199, yearly: 1990, wordsLimit: -1, generationsLimit: -1, active: true, isTrial: false, isPopular: false, sort: 4, features: ["Unlimited words & generations", "All tools + early access", "SSO / SAML", "Custom AI provider routing", "Dedicated success manager", "99.9% SLA"] },
  ];
}

function seedUsers(): User[] {
  const u = (name: string, email: string, pass: string, role: Role, status: UserStatus, created: string, color: string, company?: string): User =>
    ({ id: "u_" + hash(email).slice(2, 8), name, email, passHash: hash(pass), role, status, createdAt: created, verifiedAt: created, color, company });
  return [
    u("Amara Fields", "admin@chatdeck.ai", "admin1234", "admin", "active", daysAgoISO(210), "#18181b", "ChatDeck"),
    u("Jonas Weber", "demo@chatdeck.ai", "demo1234", "user", "active", daysAgoISO(4), "#3f6212", "Freelance"),
    u("Priya Sharma", "priya@northwind.io", "password123", "user", "active", daysAgoISO(96), "#9f1239", "Northwind"),
    u("Marcus Chen", "marcus@driftline.co", "password123", "user", "active", daysAgoISO(64), "#1d4ed8", "Driftline"),
    u("Elena Petrova", "elena@brightloop.com", "password123", "user", "active", daysAgoISO(150), "#7e22ce", "Brightloop"),
    u("Tom Okafor", "tom@okafor.studio", "password123", "user", "active", daysAgoISO(21), "#b45309", "Okafor Studio"),
    u("Aisha Diallo", "aisha@sahelmedia.com", "password123", "user", "suspended", daysAgoISO(88), "#0f766e", "Sahel Media"),
    u("Leo Martin", "leo@martin.dev", "password123", "user", "active", daysAgoISO(41), "#be185d", "Independent"),
    u("Sophie Lindqvist", "sophie@fjordlab.se", "password123", "user", "active", daysAgoISO(2), "#4338ca", "Fjordlab"),
    u("Omar Haddad", "omar@atlasgrowth.io", "password123", "user", "active", daysAgoISO(1), "#065f46", "Atlas Growth"),
  ];
}

function seedSubscriptions(users: User[], plans: Plan[]): Subscription[] {
  const by = (slug: string) => plans.find(p => p.slug === slug)!;
  const s = (email: string, planSlug: string, status: SubStatus, period: "monthly" | "yearly", endIn: number, cancel = false, pay = true): Subscription | null => {
    const user = users.find(u => u.email === email); if (!user) return null;
    return {
      id: "sub_" + hash(email + planSlug).slice(2, 10), userId: user.id, planId: by(planSlug).id, status, period,
      currentPeriodEnd: daysAheadISO(endIn), cancelAtPeriodEnd: cancel, startedAt: user.createdAt,
      payment: pay ? { brand: "Visa", last4: String(1000 + (hash(email).length * 137) % 9000), exp: "09/27" } : null,
      provider: pay ? "stripe" : "none",
    };
  };
  return [
    s("demo@chatdeck.ai", "trial", "trialing", "monthly", 3, false, false),
    s("priya@northwind.io", "pro", "active", "monthly", 12),
    s("marcus@driftline.co", "starter", "active", "monthly", 19),
    s("elena@brightloop.com", "business", "active", "yearly", 210),
    s("tom@okafor.studio", "trial", "expired", "monthly", -7, false, false),
    s("aisha@sahelmedia.com", "pro", "past_due", "monthly", 2),
    s("leo@martin.dev", "starter", "active", "monthly", 9, true),
    s("sophie@fjordlab.se", "trial", "trialing", "monthly", 6, false, false),
    s("omar@atlasgrowth.io", "trial", "trialing", "monthly", 7, false, false),
    s("admin@chatdeck.ai", "enterprise", "active", "yearly", 300),
  ].filter(Boolean) as Subscription[];
}

const GEN_TOPICS: Record<string, Record<string, string>> = {
  "content-writer": { topic: "Why sustainable packaging matters to Gen-Z shoppers", keywords: "eco packaging, DTC" },
  "blog-writer": { topic: "7 email deliverability fixes that actually work", keywords: "deliverability, SPF, DKIM" },
  "article-writer": { title: "The Complete Guide to Product-Led Growth", keywords: "PLG, activation" },
  "content-rewriter": { content: SAMPLE_TEXT[0], tone: "friendly" },
  "paragraph-rewriter": { paragraph: SAMPLE_TEXT[1], tone: "professional" },
  "text-improver": { text: SAMPLE_TEXT[2], goal: "clarity" },
  "grammar-checker": { text: SAMPLE_TEXT[0] },
  "summarizer": { content: SAMPLE_TEXT[2] + " " + SAMPLE_TEXT[1], format: "bullets" },
  "blog-title-generator": { topic: "remote team onboarding", count: "8" },
  "headline-generator": { topic: "project management for agencies", count: "8" },
  "meta-title-generator": { topic: "best CRM for startups", brand: "ChatDeck", count: "6" },
  "meta-description-generator": { topic: "landing page conversion", count: "5" },
  "seo-content-generator": { keyword: "ai writing tools", intent: "commercial" },
  "product-description": { product: "Aurora Desk Lamp", features: "3 color temps, USB-C, dimmable" },
  "social-media-content": { topic: "our new analytics dashboard", platform: "linkedin" },
  "email-writer": { purpose: "re-engage dormant trial users", key_points: "New templates library\nOne-click export\nPriority support this month" },
  "ad-copy-generator": { product: "ChatDeck Pro", benefit: "cut content time in half", platform: "google" },
  "introduction-generator": { topic: "customer retention strategy", hook_style: "statistic" },
  "conclusion-generator": { topic: "webinar funnels", cta: "trial" },
  "faq-generator": { topic: "our pricing model", count: "6" },
  "outline-generator": { topic: "technical SEO audits", sections: "6" },
  "keyword-cluster": { seed_keyword: "ai writing tools", count: "12" },
  "idea-brainstormer": { niche: "personal finance for creatives", count: "10" },
  "press-release": { company: "Brightloop", announcement: "Series B funding to expand AI research team", quote_person: "Elena Petrova, CEO" },
  "video-script": { topic: "how we cut support tickets 40%", duration: "60 seconds", platform: "youtube" },
  "tone-changer": { content: SAMPLE_TEXT[1], to_tone: "witty" },
};

function seedGenerations(users: User[], tools: Tool[]): Generation[] {
  const out: Generation[] = [];
  const workers = ["demo@chatdeck.ai", "priya@northwind.io", "marcus@driftline.co", "elena@brightloop.com", "sophie@fjordlab.se"];
  const r = rng(hashStr("seed-gens"));
  for (const email of workers) {
    const user = users.find(u => u.email === email)!;
    const n = email === "demo@chatdeck.ai" ? 9 : 8 + int(r, 0, 6);
    for (let i = 0; i < n; i++) {
      const tool = tools[int(r, 0, tools.length - 1)];
      const day = int(r, 0, 27);
      const base = GEN_TOPICS[tool.slug] || { topic: TOPICS[int(r, 0, TOPICS.length - 1)] };
      const inputs = { ...base, tone: base.tone || TONES[int(r, 0, TONES.length - 1)] };
      const res = generateOutput(tool.outputKind as never, inputs, hashStr(email + tool.slug + i));
      out.push({
        id: "gen_" + uid(), userId: user.id, toolSlug: tool.slug, toolName: tool.name,
        inputs, output: res.text, words: res.words, chars: res.text.length,
        status: "completed", model: "gpt-4.1-mini", provider: "openai",
        createdAt: daysAgoISO(day, 8 + (i % 10)), durationMs: 600 + int(r, 0, 1800),
      });
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
const int = (r: () => number, min: number, max: number) => min + Math.floor(r() * (max - min + 1));

function seedUsage(users: User[], generations: Generation[]): Usage[] {
  const map = new Map<string, Usage>();
  for (const g of generations) {
    const key = g.userId + "|" + monthKey(g.createdAt);
    let u = map.get(key);
    if (!u) { u = { userId: g.userId, month: monthKey(g.createdAt), wordsUsed: 0, generationsUsed: 0, byDay: {}, byTool: {} }; map.set(key, u); }
    u.wordsUsed += g.words; u.generationsUsed += 1;
    u.byDay[dayKey(g.createdAt)] = (u.byDay[dayKey(g.createdAt)] || 0) + g.words;
    u.byTool[g.toolSlug] = (u.byTool[g.toolSlug] || 0) + 1;
  }
  void users;
  return [...map.values()];
}

function seedInvoices(users: User[]): Invoice[] {
  const inv = (email: string, planName: string, period: string, amount: number, ago: number, last4: string, status: "paid" | "open" = "paid"): Invoice => {
    const user = users.find(u => u.email === email)!;
    return { id: "inv_" + uid(), userId: user.id, number: `INV-2026-${String(1040 + ago * 7).padStart(4, "0")}`, planName, period, amount, status, createdAt: daysAgoISO(ago), last4 };
  };
  return [
    inv("priya@northwind.io", "Pro", "Monthly", 29, 12, "4242"), inv("priya@northwind.io", "Pro", "Monthly", 29, 42, "4242"), inv("priya@northwind.io", "Pro", "Monthly", 29, 72, "4242"),
    inv("marcus@driftline.co", "Starter", "Monthly", 12, 19, "1881"), inv("marcus@driftline.co", "Starter", "Monthly", 12, 49, "1881"),
    inv("elena@brightloop.com", "Business", "Yearly", 758, 150, "0005"),
    inv("admin@chatdeck.ai", "Enterprise", "Yearly", 1990, 65, "9012"),
    inv("aisha@sahelmedia.com", "Pro", "Monthly", 29, 2, "7719", "open"),
  ];
}

function seedActivity(): Activity[] {
  const a = (actor: string, role: string, action: string, detail: string, ago: number): Activity =>
    ({ id: "act_" + uid(), actor, role, action, detail, createdAt: daysAgoISO(ago, 9 + ago) });
  return [
    a("Amara Fields", "admin", "plan.updated", "Pro monthly price set to $29", 1),
    a("System", "system", "user.registered", "Omar Haddad joined and started a free trial", 1),
    a("System", "system", "user.registered", "Sophie Lindqvist joined and started a free trial", 2),
    a("Amara Fields", "admin", "user.suspended", "Aisha Diallo suspended — payment past due", 2),
    a("System", "system", "subscription.renewed", "Priya Sharma — Pro monthly renewed ($29.00)", 12),
    a("Amara Fields", "admin", "tool.updated", "AI SEO Content Generator moved to Pro tier", 6),
    a("System", "system", "trial.expired", "Tom Okafor's trial expired after 7 days", 7),
    a("Amara Fields", "admin", "settings.updated", "Trial extended to 7 days / 5,000 words", 9),
    a("System", "system", "subscription.renewed", "Marcus Chen — Starter monthly renewed ($12.00)", 19),
    a("Amara Fields", "admin", "tool.created", "AI Video Script Writer added (Business tier)", 24),
  ];
}

function seedPosts(): Post[] {
  const p = (slug: string, title: string, category: string, tags: string[], status: Post["status"], ago: number, style: string, excerpt: string, body: string): Post => ({
    id: "post_" + slug, slug, title, excerpt, body, category, tags, author: "Amara Fields",
    status, publishAt: daysAgoISO(ago),
    cover: { prompt: title, seed: hashStr(slug) % 99999, style, alt: `Abstract cover illustration for ${title.toLowerCase()}` },
    seo: { title: title.slice(0, 58), description: excerpt.slice(0, 152), canonical: "" },
    createdAt: daysAgoISO(ago + 2), updatedAt: daysAgoISO(ago),
  });
  return [
    p("usage-limits-are-a-feature", "Usage limits are a feature, not a friction", "Product", ["saas", "pricing", "trust"], "published", 6, "band",
      "Why honest word and generation meters build more trust than “unlimited” plans that quietly throttle you.",
      `Every SaaS buyer has been burned by "unlimited". Unlimited pages that load for four seconds. Unlimited seats that cost extra per seat. Unlimited generations that stop being unlimited the moment you scale.\n\n## The problem with fake unlimited\n\nUnlimited pricing is a promise the product can't keep. Compute costs money, so someone has to ration it — and when the rationing is invisible, it feels like betrayal. Visible limits feel like honesty.\n\n## What honest meters do\n\n- **They set expectations before the invoice arrives.** Nobody is surprised by a bill they could see counting up.\n- **They make upgrades feel earned.** When the meter tells you it's time, the upgrade decision is yours — not a sales rep's.\n- **They protect quality at peak hours.** Rate limits are why the tool still feels fast at 5pm on a Tuesday.\n\n## Designing limits people accept\n\nShow the meter in the sidebar, not buried in a billing page. Warn at 80%, not 100%. And when a user hits the ceiling, offer three honest doors: upgrade, wait for the reset, or export what they've made.\n\nLimits, displayed well, are one of the cheapest trust-building exercises a product team has. Use them.`),
    p("seo-brief-workflow", "The 20-minute SEO brief that beats a 4-hour article", "SEO", ["workflow", "keywords", "briefs"], "published", 13, "editorial",
      "A tight brief — intent, outline, entities, SERP notes — outperforms long-form guesswork almost every time.",
      `Most content teams write the article first and "optimize" it afterwards. That's backwards. The brief is where ranking decisions get made.\n\n## What goes in a 20-minute brief\n\n1. **Search intent, in one sentence.** "The reader wants to compare options before buying" beats "informational".\n2. **A skeleton of H2s.** Three to six, each answering a question the SERP proves people ask.\n3. **Entities, not keywords.** The nouns and products the topic must mention to be considered complete.\n4. **SERP notes.** What the top five results all cover — and what they all miss.\n\n## The compound effect\n\nA brief takes twenty minutes and saves the writer from the expensive mistake: a 1,500-word answer to a question nobody ranks for. Writers draft faster, editors review faster, and refresh cycles get shorter because the structure was right from day one.\n\nBrief first. Write second. Rank occasionally, and learn every time.`),
    p("rewriting-without-losing-voice", "Rewriting with AI without losing your voice", "Content strategy", ["editing", "voice", "ai"], "published", 21, "arc",
      "Tone controls and rewrite strength are levers — but the voice has to come from your corpus, not the model's defaults.",
      `The fastest way to make AI content feel generic is to accept the first rewrite. Models default to a pleasant, corporate mean — competent and forgettable.\n\n## Keep the voice, change the register\n\nThink of tone as a dial with three honest positions: *light* cleans grammar and rhythm, *moderate* restructures sentences, *heavy* rewrites for a different audience. Most documents want light. Heavy is for repurposing, not polishing.\n\n## A review pass that takes four minutes\n\n- Read it aloud once. Anything you stumble over, the reader skips.\n- Delete every sentence that could open any other article on the topic.\n- Put one specific number, name, or date back in. Specificity is the fingerprint.\n\nThe tool's job is velocity. Your job is the fingerprint. Teams that keep that division of labor ship more *and* sound like themselves.`),
    p("publishing-pipeline-checklist", "A publishing pipeline checklist for small teams", "Content strategy", ["checklist", "cms", "process"], "published", 30, "grid",
      "From draft to published in one repeatable loop: write, brief-check, SEO pass, schedule, distribute.",
      `Small teams don't fail at writing — they fail at the last mile. The draft sits in a doc for three weeks because nobody owns the steps between "done" and "live".\n\n## The five-step loop\n\n1. **Write** against a brief, not a blank page.\n2. **Brief-check**: does every H2 answer its question? Cut what doesn't.\n3. **SEO pass**: title under 60 characters, description under 155, keyword in the first paragraph and one heading.\n4. **Schedule** at the hour your audience actually reads — for B2B, that's usually Tuesday or Wednesday morning.\n5. **Distribute** the same day: newsletter paragraph, one social post, one internal link from an older article.\n\n## Make the loop boring\n\nThe checklist works because it's the same every time. After ten cycles your team runs it in under an hour, and "publishing" stops being an event and becomes a Tuesday.`),
    p("trial-design-principles", "Seven trial-design principles we stole from the best onboarding teams", "Product", ["trial", "onboarding", "activation"], "published", 41, "editorial",
      "No card up front, limits shown not hidden, and an upgrade path that feels like a door — not a wall.",
      `A free trial is a promise: "this is what owning the product feels like." Most trials break that promise in the first hour — card forms, vague limits, or a feature set so stripped the product feels like a demo.\n\n## Principles that survive contact with real users\n\n- **No card before value.** Ask for payment after the first result, not before it.\n- **Show the meter.** Users who can see their allowance spend it deliberately — and upgrade deliberately.\n- **Time-box honestly.** Seven days is a deadline people respect; "14-day trial, then we'll see" is not.\n- **Let them keep the work.** Export everything, always. Locking creations hostage poisons the upgrade.\n\n## The exit should be graceful\n\nWhen the trial ends, the product should say one clear sentence: what you used, what it cost, what happens next. No dark patterns, no guilt screens. Users who leave gracefully come back; users who feel tricked don't.`),
    p("schema-markup-primer", "Schema markup: the 30-minute primer that actually sticks", "SEO", ["schema", "technical-seo", "faq"], "scheduled", -4, "band",
      "Article, FAQ and Breadcrumb schema — what they do, what they don't, and the only three worth adding this week.",
      `Structured data doesn't move rankings. It moves *presentation* — and presentation moves clicks. That distinction is why most schema advice online is either oversold or dismissed.\n\n## The three worth adding first\n\n1. **Article schema** on blog posts: headline, author, dates. It keeps your byline intact as content gets reshared.\n2. **FAQ schema** on pages with real questions — not keyword-stuffed ones. Rich results here are earned by usefulness.\n3. **Breadcrumb schema** so search results show the path, not a raw URL.\n\n## Validate, then forget\n\nPaste your URL into any structured-data tester, fix the warnings, and move on. Schema is a set-and-forget layer: add it once, keep it honest, and spend your energy on the content it describes.`),
    p("draft-content-calendar-system", "Draft: a content calendar that runs itself", "Content strategy", ["calendar", "systems"], "draft", -9, "arc",
      "Working notes on recurring formats, theme months, and the 3-1-1 cadence.",
      `Working draft — not for publication yet.\n\n## Ideas to develop\n\n- The 3-1-1 cadence: three short posts, one deep dive, one experiment per month.\n- Theme months vs evergreen rotation.\n- How to let the calendar own distribution so writing stays focused.`),
  ];
}

const DEFAULT_SECTIONS = [
  { id: "logos", label: "Customer logos", enabled: true },
  { id: "tools", label: "Tool showcase", enabled: true },
  { id: "features", label: "Feature grid", enabled: true },
  { id: "stats", label: "Stats band", enabled: true },
  { id: "how", label: "How it works", enabled: true },
  { id: "pricing", label: "Pricing preview", enabled: true },
  { id: "testimonials", label: "Testimonials", enabled: true },
  { id: "faq", label: "FAQ", enabled: true },
  { id: "cta", label: "Closing CTA", enabled: true },
];

export function freshDb(): DB {
  const tools = seedTools();
  const plans = seedPlans();
  const users = seedUsers();
  const generations = seedGenerations(users, tools);
  return {
    version: SEED_VERSION,
    users, plans, tools,
    subscriptions: seedSubscriptions(users, plans),
    generations,
    usage: seedUsage(users, generations),
    invoices: seedInvoices(users),
    activity: seedActivity(),
    posts: seedPosts(),
    settings: {
      site: { name: "ChatDeck", tagline: "The AI writing studio for teams that ship.", description: "25+ AI writing, SEO and marketing tools with flexible plans and a dashboard built for speed.", supportEmail: "support@chatdeck.ai", twitter: "https://twitter.com/chatdeck", github: "https://github.com/chatdeck", linkedin: "https://linkedin.com/company/chatdeck" },
      registration: { enabled: true, requireVerification: false },
      trial: { days: 7, words: 5000, generations: 30, onExpire: "lock" },
      ai: { provider: "openai", model: "gpt-4.1-mini", apiKey: "sk-demo-••••••••••••••••3f2a", temperature: 0.7, maxTokens: 2048 },
      usage: { ratePerMinute: 6, maxOutputWords: 1500 },
      billing: { currency: "USD", taxRate: 0 },
      seo: {
        defaultTitle: "ChatDeck — The AI writing studio for teams that ship",
        defaultDescription: "25+ AI writing, SEO, and marketing tools with flexible plans, a free trial, and a dashboard built for speed.",
        canonicalBase: "https://chatdeck.app", ogSiteName: "ChatDeck", indexPublic: true,
        robots: "User-agent: *\nAllow: /\n\n# Authenticated areas are never indexed\nDisallow: /#/app\nDisallow: /#/admin\n\nSitemap: https://chatdeck.app/sitemap.xml",
      },
      sections: JSON.parse(JSON.stringify(DEFAULT_SECTIONS)),
    },
    seq: 1041,
  };
}

/* ================= persistence ================= */
const DB_KEY = "chatdeck.db";
let cache: DB | null = null;

export function getDb(): DB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === SEED_VERSION) { cache = parsed; return cache; }
    }
  } catch { /* corrupted → reseed */ }
  cache = freshDb();
  saveDb(cache);
  return cache;
}
export function saveDb(db: DB) { cache = db; try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch { /* quota */ } }
export function mutate<T>(fn: (db: DB) => T): T { const db = getDb(); const out = fn(db); saveDb(db); return out; }
export function resetDb() { localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSION_KEY); cache = null; }

/* ================= session ================= */
export const SESSION_KEY = "chatdeck.session";
export function getSessionUserId(): string | null { try { return localStorage.getItem(SESSION_KEY); } catch { return null; } }
export function setSession(userId: string | null) { try { userId ? localStorage.setItem(SESSION_KEY, userId) : localStorage.removeItem(SESSION_KEY); } catch { /* noop */ } }
export { countWords };
