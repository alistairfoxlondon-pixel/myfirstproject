import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronDown, ShieldCheck, Gauge, History, LayoutDashboard, Users, ServerCog, Star, Zap, Play } from "lucide-react";
import { PublicLayout, LogoMarquee, SectionHead } from "../components/site";
import { Logo, ToolIcon, CATEGORY_META } from "../components/icons";
import { Badge, Button, Card, CountUp, Reveal, cn } from "../components/ui";
import { getDb, tierRank } from "../lib/db";
import { getSettings } from "../lib/services";
import { useApp } from "../lib/app";

/* ================= hero typing deck ================= */
const SCENES = [
  { tool: "Blog Title Generator", prompt: "remote team onboarding", out: ["1. Remote Onboarding: The 30-Day Playbook", "2. How We Onboard Remote Hires in 5 Days", "3. 7 Onboarding Mistakes Remote Teams Make"] },
  { tool: "AI Content Writer", prompt: "sustainable packaging for DTC brands", out: ["## Why packaging is your silent salesman", "Gen-Z shoppers judge the box before the product.", "Brands that switch early earn loyalty that ads can't buy…"] },
  { tool: "Meta Description Generator", prompt: "landing page conversion", out: ["1. Discover how landing page conversion really works —", "   practical steps you can apply today. Start now.", "   · 148 chars"] },
  { tool: "AI Email Writer", prompt: "re-engage dormant trial users", out: ["Subject: Quick idea for your trial", "Hi there — your workspace is still set up.", "One click and you're back where you left off…"] },
];

function HeroDeck() {
  const [scene, setScene] = useState(0);
  const [chars, setChars] = useState(0);
  const [phase, setPhase] = useState<"typing" | "hold">("typing");
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const s = SCENES[scene];
  const full = s.out.join("\n");

  useEffect(() => {
    if (reduced) { setChars(full.length); setPhase("hold"); return; }
    if (phase === "typing") {
      if (chars >= full.length) { setPhase("hold"); return; }
      const id = setTimeout(() => setChars(c => Math.min(full.length, c + 2)), 24);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => { setScene(v => (v + 1) % SCENES.length); setChars(0); setPhase("typing"); }, 2600);
    return () => clearTimeout(id);
  }, [phase, chars, full.length, reduced, scene]);

  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-foreground/[0.04] blur-2xl" aria-hidden />
      <div className="relative rounded-xl border border-border bg-card shadow-xl shadow-black/5 overflow-hidden shimmer-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-foreground/15" /><span className="w-2.5 h-2.5 rounded-full bg-foreground/15" /><span className="w-2.5 h-2.5 rounded-full bg-foreground/15" />
          </div>
          <span className="font-mono text-[11px] text-muted-foreground tracking-wide">chatdeck · studio</span>
          <Badge tone="success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />live</Badge>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5"><Users className="w-3.5 h-3.5 text-muted-foreground" /></div>
            <div className="rounded-xl rounded-tl-sm bg-muted border border-border px-3.5 py-2.5 text-[13px] max-w-[85%]">
              <span className="font-mono text-[10.5px] text-muted-foreground block mb-0.5">{s.tool}</span>
              {s.prompt}
            </div>
          </div>
          <div className="flex gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center shrink-0 mt-0.5"><Zap className="w-3.5 h-3.5" /></div>
            <div className="rounded-xl rounded-tl-sm border border-border bg-background px-3.5 py-2.5 text-[13px] font-mono leading-relaxed min-h-[96px] flex-1 min-w-0">
              <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px]">{full.slice(0, chars)}{phase === "typing" && <span className="inline-block w-[7px] h-[14px] bg-foreground align-middle ml-0.5 animate-caret" />}</pre>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1.5">{SCENES.map((_, i) => <button key={i} onClick={() => { setScene(i); setChars(0); setPhase("typing"); }} aria-label={`Scene ${i + 1}`} className={cn("h-1.5 rounded-full transition-all duration-300", i === scene ? "w-6 bg-foreground" : "w-1.5 bg-foreground/20 hover:bg-foreground/40")} />)}</div>
            <span className="font-mono text-[10.5px] text-muted-foreground">{Math.round((chars / Math.max(1, full.length)) * 100)}% · gpt-4.1-mini</span>
          </div>
        </div>
      </div>
      <div className="absolute -left-4 sm:-left-10 top-1/4 hidden sm:block animate-float">
        <div className="rounded-xl border border-border bg-card shadow-lg px-3.5 py-2.5 flex items-center gap-2.5">
          <Gauge className="w-4 h-4" /><div><p className="text-[11px] font-semibold leading-none">2.4s median</p><p className="text-[10px] text-muted-foreground mt-0.5">generation time</p></div>
        </div>
      </div>
      <div className="absolute -right-3 sm:-right-8 -bottom-5 hidden sm:block animate-float" style={{ animationDelay: "1.2s" }}>
        <div className="rounded-xl border border-border bg-card shadow-lg px-3.5 py-2.5 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4" /><div><p className="text-[11px] font-semibold leading-none">Limits enforced</p><p className="text-[10px] text-muted-foreground mt-0.5">server-side, per plan</p></div>
        </div>
      </div>
    </div>
  );
}

/* ================= pricing ================= */
export function PricingSection({ compact = false }: { compact?: boolean }) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const db = getDb();
  const plans = db.plans.filter(p => p.active && !p.isTrial).sort((a, b) => a.sort - b.sort);
  const nav = useNavigate();
  const { user } = useApp();
  const ctaTarget = () => nav(user ? "/app/billing" : "/register");
  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={cn("text-[13.5px] font-medium transition-colors", period === "monthly" ? "text-foreground" : "text-muted-foreground")}>Monthly</span>
        <button onClick={() => setPeriod(p => p === "monthly" ? "yearly" : "monthly")} role="switch" aria-checked={period === "yearly"} aria-label="Billing period"
          className="relative h-[26px] w-[52px] rounded-full bg-muted border border-border transition-colors">
          <span className={cn("absolute top-[3px] h-[18px] w-[18px] rounded-full bg-foreground transition-all duration-300", period === "yearly" ? "left-[29px]" : "left-[3px]")} />
        </button>
        <span className={cn("text-[13.5px] font-medium transition-colors flex items-center gap-1.5", period === "yearly" ? "text-foreground" : "text-muted-foreground")}>
          Yearly <Badge tone="success">−20%</Badge>
        </span>
      </div>
      <div className={cn("grid gap-5 md:grid-cols-3 lg:gap-6", compact ? "" : "items-stretch")}>
        {plans.slice(0, compact ? 3 : 4).map((p, i) => {
          const price = period === "monthly" ? p.monthly : Math.round(p.yearly / 12);
          const popular = p.isPopular;
          return (
            <Reveal key={p.id} delay={i * 80} className={cn(compact && i === 3 && "hidden lg:block")}>
              <Card className={cn("relative h-full flex flex-col p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg", popular && "border-foreground shadow-md")}>
                {popular && <span className="absolute -top-3 left-6"><Badge>Most popular</Badge></span>}
                <h3 className="font-display font-bold text-lg tracking-tight">{p.name}</h3>
                <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed min-h-[38px]">{p.description}</p>
                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-[38px] font-extrabold tracking-tight tabular leading-none">${price}</span>
                  <span className="text-[13px] text-muted-foreground">/ month</span>
                </div>
                <p className="text-[11.5px] text-muted-foreground mt-1 h-4 font-mono">{period === "yearly" ? `billed $${p.yearly}/yr` : p.slug === "enterprise" ? "or custom terms" : "billed monthly"}</p>
                <ul className="mt-5 space-y-2.5 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px]">
                      <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5 6.5 11.5 12.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={popular ? "default" : "outline"} size="md" onClick={ctaTarget}>
                  {p.slug === "enterprise" ? "Contact sales" : "Start with " + p.name}
                </Button>
              </Card>
            </Reveal>
          );
        })}
      </div>
      {!compact && (
        <div className="mt-8 text-center text-[13px] text-muted-foreground">
          Every paid plan starts with a <Link to="/register" className="underline underline-offset-2 hover:text-foreground">free {getSettings().trial.days}-day trial</Link> — no card required. Prices configurable per plan.
        </div>
      )}
    </div>
  );
}

/* ================= page ================= */
export default function Landing() {
  const db = getDb();
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useApp();
  const settings = getSettings();
  const tools = db.tools.filter(t => t.active).slice(0, 8);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // arrive on "/#section" from other routes → smooth-scroll to the section
  useEffect(() => {
    if (!loc.hash) return;
    const t = setTimeout(() => document.querySelector(loc.hash)?.scrollIntoView({ behavior: "smooth" }), 80);
    return () => clearTimeout(t);
  }, [loc.hash, loc.pathname]);

  const faqs = [
    ["How does the free trial work?", `Every new account gets ${settings.trial.days} days of free access with ${settings.trial.words.toLocaleString()} words and ${settings.trial.generations} generations across all trial-tier tools. No credit card required. When it ends, you can pick any paid plan to keep going — your history stays intact.`],
    ["Can I switch plans later?", "Yes. Upgrades apply immediately and downgrades take effect at the end of your billing period. Usage limits update the moment your plan changes, and any unused time is credited automatically on yearly plans."],
    ["Which AI models power the tools?", `Requests are routed through our server to the provider configured for your workspace (currently ${settings.ai.provider} · ${settings.ai.model}). API keys never touch the browser, and every generation is logged against your usage.`],
    ["What happens when I hit my word limit?", "Generation is paused server-side — you'll see exactly how much you've used in the dashboard. You can upgrade instantly, wait for the monthly reset, or ask an admin for a one-time usage reset."],
    ["Do you offer team or enterprise plans?", "The Business plan includes 3 seats and usage analytics. Enterprise adds SSO, custom AI routing, and unlimited volume with an SLA — contact sales for a tailored quote."],
    ["Is my content private?", "Yes. Your inputs and outputs are stored in your workspace only, are never used to train models, and can be deleted at any time from your history. Account deletion removes everything permanently."],
  ];

  const features = [
    { icon: <Gauge className="w-5 h-5" />, title: "Usage you can actually see", body: "Word and generation meters update in real time, per plan and per tool, with a 14-day activity chart on your dashboard.", big: true },
    { icon: <ShieldCheck className="w-5 h-5" />, title: "Limits enforced server-side", body: "Plan checks, rate limits and daily tool caps run on the backend — not in JavaScript you can bypass." },
    { icon: <History className="w-5 h-5" />, title: "Full generation history", body: "Every draft is saved with its inputs, model and cost in words. Re-run, copy or delete in one click." },
    { icon: <LayoutDashboard className="w-5 h-5" />, title: "A dashboard that stays out of the way", body: "One workspace for tools, billing and settings — the same design language end to end.", big: true },
    { icon: <ServerCog className="w-5 h-5" />, title: "Swappable AI providers", body: "OpenAI, Anthropic or Gemini behind one interface. Switch models from the admin panel, no redeploy." },
    { icon: <Users className="w-5 h-5" />, title: "Admin controls built in", body: "Manage users, plans, tools and trial rules from a full admin panel with an activity log." },
  ];

  return (
    <PublicLayout>
      {/* ============ hero ============ */}
      <section className="relative overflow-hidden noise">
        <div className="absolute inset-0 dot-grid [mask-image:radial-gradient(ellipse_75%_65%_at_50%_35%,black,transparent)]" aria-hidden />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[420px] rounded-full bg-foreground/[0.05] blur-3xl" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-32 pb-16 md:pt-40 md:pb-24">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
            <div>
              <Reveal>
                <Badge tone="outline" className="mb-6 font-mono text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                  {db.tools.filter(t => t.active).length} tools · free {settings.trial.days}-day trial
                </Badge>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="font-display text-[40px] sm:text-[54px] lg:text-[60px] font-extrabold tracking-[-0.035em] leading-[1.02]">
                  The AI writing studio<br className="hidden sm:block" /> for teams that <em className="font-serif-accent italic font-normal tracking-normal">ship</em><span className="text-gradient-animated">.</span>
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="text-[16px] sm:text-[17px] text-muted-foreground leading-relaxed mt-6 max-w-[520px]">
                  {settings.site.tagline} Draft articles, titles, SEO briefs, emails and ad copy in one deck — with honest usage limits and a trial that doesn't ask for a card.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <div className="flex flex-wrap items-center gap-3 mt-8">
                  <Button size="lg" onClick={() => nav(user ? "/app" : "/register")}>
                    Start free trial <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => document.querySelector("#tools")?.scrollIntoView({ behavior: "smooth" })}>
                    <Play className="w-4 h-4" /> Explore the tools
                  </Button>
                </div>
              </Reveal>
              <Reveal delay={320}>
                <div className="flex flex-wrap items-center gap-4 mt-9">
                  <div className="flex -space-x-2.5">
                    {["#3f6212", "#1d4ed8", "#9f1239", "#7e22ce", "#b45309"].map((c, i) => (
                      <span key={i} className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-[10.5px] font-bold text-white" style={{ background: c }}>{"PSMEL"[i]}</span>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />)}</div>
                    <p className="text-[12.5px] text-muted-foreground mt-1">Trusted by <strong className="text-foreground">4,200+</strong> writers & marketing teams</p>
                  </div>
                </div>
              </Reveal>
            </div>
            <Reveal delay={200}><HeroDeck /></Reveal>
          </div>
        </div>
      </section>

      {renderSections()}
    </PublicLayout>
  );

  function renderSections() {
    const order = settings.sections.filter(s => s.enabled).map(s => s.id);
    return order.map(id => SECTION_RENDER[id] || null);
  }

  const SECTION_RENDER: Record<string, React.ReactNode> = {
  logos: (
    <section key="logos" className="border-y border-border bg-card/40 py-6">
      <p className="text-center font-mono text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground mb-4">Teams writing with ChatDeck</p>
      <LogoMarquee />
    </section>
  ),
  tools: (
    <section key="tools" id="tools" className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 scroll-mt-20">
        <SectionHead eyebrow="The deck" title={<>Every tool a content team reaches for, <em className="font-serif-accent italic font-normal">in one place</em></>} sub="Twenty-six specialized generators — each with inputs shaped for the job, not a generic prompt box." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tools.map((t, i) => (
            <Reveal key={t.slug} delay={(i % 4) * 70}>
              <button onClick={() => nav(user ? `/app/tools/${t.slug}` : "/register")}
                className="group w-full text-left h-full rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-foreground/30">
                <div className="flex items-start justify-between">
                  <span className={cn("w-9 h-9 rounded-lg flex items-center justify-center", CATEGORY_META[t.category].chip)}><ToolIcon name={t.icon} className="w-4.5 h-4.5" /></span>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <h3 className="font-semibold text-[14.5px] mt-3.5 leading-snug">{t.name}</h3>
                <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">{t.tagline}</p>
                <div className="flex items-center gap-2 mt-3.5">
                  <Badge tone="muted" className="font-mono text-[10px]">{CATEGORY_META[t.category].label}</Badge>
                  {t.minTier !== "trial" && <Badge tone="outline" className="font-mono text-[10px] capitalize">{t.minTier}+</Badge>}
                </div>
              </button>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-9 text-center">
          <Button variant="outline" onClick={() => nav(user ? "/app/tools" : "/register")}>
            Explore all {db.tools.filter(t => t.active).length} tools <ArrowRight className="w-4 h-4" />
          </Button>
        </Reveal>
      </section>

      {/* ============ features ============ */}
      <section id="features" className="border-y border-border bg-card/40 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <SectionHead eyebrow="Built like a product, not a wrapper" title={<>Serious SaaS plumbing under <em className="font-serif-accent italic font-normal">a calm interface</em></>} sub="Trials, plans, enforcement, billing and admin — the unglamorous parts, done properly." />
          <div className="grid md:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80} className={cn(f.big && "md:col-span-2")}>
                <Card className={cn("h-full p-6 transition-all duration-300 hover:border-foreground/30 hover:-translate-y-0.5", f.big && "md:flex md:items-center md:gap-8")}>
                  <div className={cn(f.big && "md:w-1/2")}>
                    <span className="inline-flex w-10 h-10 rounded-lg bg-foreground text-background items-center justify-center">{f.icon}</span>
                    <h3 className="font-display font-bold text-[16.5px] tracking-tight mt-4">{f.title}</h3>
                  </div>
                  <p className={cn("text-[13.5px] text-muted-foreground leading-relaxed mt-2.5", f.big && "md:w-1/2 md:mt-0")}>{f.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ stats band ============ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border border border-border rounded-xl bg-card overflow-hidden">
            {[
              { n: db.tools.filter(t => t.active).length, s: "", l: "specialized AI tools" },
              { n: 1200000, s: "+", l: "generations tracked" },
              { n: 6, s: "", l: "languages supported" },
              { n: 99, s: ".9%", l: "uptime last 90 days" },
            ].map((x, i) => (
              <div key={i} className="px-6 py-8 text-center">
                <p className="font-display text-[30px] font-extrabold tracking-tight"><CountUp to={x.n} suffix={x.s} /></p>
                <p className="text-[12.5px] text-muted-foreground mt-1">{x.l}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ============ how ============ */}
      <section id="how" className="max-w-6xl mx-auto px-4 sm:px-6 pb-20 md:pb-28 scroll-mt-20">
        <SectionHead eyebrow="How it works" title={<>From blank page to published in <em className="font-serif-accent italic font-normal">three moves</em></>} />
        <div className="grid md:grid-cols-3 gap-4 relative">
          <div className="hidden md:block absolute top-[38px] left-[18%] right-[18%] border-t border-dashed border-border" aria-hidden />
          {[
            { n: "01", t: "Pick a tool from the deck", b: "Each of the 26 tools has inputs designed for its job — topic, tone, audience, length — so you never fight a blank prompt." },
            { n: "02", t: "Generate, refine, regenerate", b: "Output streams in as it's written. Copy it, tweak the inputs, regenerate with a new seed until it sounds like you." },
            { n: "03", t: "Watch usage, not invoices", b: "Live meters show words and generations left on your plan. No surprise overages — limits are enforced, not estimated." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 110}>
              <div className="relative rounded-xl border border-border bg-card p-6 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <span className="relative z-10 inline-flex w-11 h-11 rounded-xl bg-foreground text-background font-mono text-[13px] font-semibold items-center justify-center">{s.n}</span>
                <h3 className="font-display font-bold text-[16px] tracking-tight mt-4">{s.t}</h3>
                <p className="text-[13.5px] text-muted-foreground leading-relaxed mt-2">{s.b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ pricing ============ */}
      <section id="pricing" className="border-y border-border bg-card/40 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <SectionHead eyebrow="Pricing" title={<>Simple plans, <em className="font-serif-accent italic font-normal">honest limits</em></>} sub="Start free for 7 days. Upgrade when the meters tell you to — every plan is configurable down to the word." />
          <PricingSection />
        </div>
      </section>

      {/* ============ testimonials ============ */}
      <section id="testimonials" className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 overflow-hidden scroll-mt-20">
        <SectionHead eyebrow="Wall of love" title={<>Writers ship more, <em className="font-serif-accent italic font-normal">stress less</em></>} />
        <TestimonialMarquee />
      </section>

      {/* ============ faq ============ */}
      <section id="faq" className="border-t border-border bg-card/40 scroll-mt-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 md:py-28">
          <SectionHead eyebrow="FAQ" title={<>Questions, <em className="font-serif-accent italic font-normal">answered</em></>} />
          <div className="space-y-2.5">
            {faqs.map(([q, a], i) => (
              <Reveal key={q} delay={i * 40}>
                <div className={cn("rounded-xl border bg-card transition-colors", openFaq === i ? "border-foreground/40" : "border-border")}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left" aria-expanded={openFaq === i}>
                    <span className="font-semibold text-[14.5px]">{q}</span>
                    <ChevronDown className={cn("w-4.5 h-4.5 shrink-0 transition-transform duration-300", openFaq === i && "rotate-180")} />
                  </button>
                  <div className={cn("grid transition-all duration-300 ease-out", openFaq === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                    <div className="overflow-hidden"><p className="px-5 pb-5 text-[13.5px] text-muted-foreground leading-relaxed">{a}</p></div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ cta ============ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-xl bg-foreground text-background noise">
            <div className="absolute inset-0 dot-grid opacity-[0.14]" aria-hidden />
            <div className="relative px-6 py-14 sm:px-14 sm:py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div>
                <h2 className="font-display text-[28px] sm:text-[36px] font-extrabold tracking-tight leading-tight">Your first {settings.trial.words.toLocaleString()} words<br className="hidden sm:block" /> are on us.</h2>
                <p className="text-[15px] opacity-70 mt-3 max-w-md">Free for {settings.trial.days} days. No credit card. Keep everything you create.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <Button size="lg" variant="secondary" onClick={() => nav(user ? "/app" : "/register")}>Start free trial <ArrowRight className="w-4 h-4" /></Button>
                <Button size="lg" variant="ghost" className="text-background border border-background/25 hover:bg-background/10 hover:text-background" onClick={() => nav("/pricing")}>Compare plans</Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </PublicLayout>
  );
}

function TestimonialMarquee() {
  const quotes = [
    { q: "We replaced four separate subscriptions with ChatDeck. The usage meters alone are worth it — finance stopped emailing me.", n: "Priya Sharma", r: "Head of Content, Northwind" },
    { q: "The SEO brief tool outputs exactly what our writers need. We went from 6 to 14 articles a month without hiring.", n: "Marcus Chen", r: "Founder, Driftline" },
    { q: "Trial actually works like a trial. No card, no dark patterns, and upgrading took 40 seconds.", n: "Sophie Lindqvist", r: "Content Lead, Fjordlab" },
    { q: "As an admin I love that I can tune plan limits and tool access without touching code.", n: "Amara Fields", r: "Operations, ChatDeck" },
    { q: "The tone changer rescued a whole set of landing pages written by a very enthusiastic intern.", n: "Tom Okafor", r: "Studio Owner" },
    { q: "Generation history is underrated — we reuse half our drafts as templates now.", n: "Elena Petrova", r: "CEO, Brightloop" },
    { q: "Rate limits sound annoying until you realize they're why the tool is fast at 5pm on a Tuesday.", n: "Leo Martin", r: "Indie Hacker" },
    { q: "Our non-profit got the trial extended in one support email. That's how you win people.", n: "Amina Keita", r: "Comms, Sahel Media" },
  ];
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const Row = ({ items, reverse }: { items: typeof quotes; reverse?: boolean }) => (
    <div className="marquee-mask overflow-hidden" data-marquee>
      <div className={cn("flex w-max marquee-track", !reduced && "animate-marquee")} style={{ gap: "1rem", ["--gap" as never]: "1rem", animationDirection: reverse ? "reverse" : undefined, ["--marquee-duration" as never]: "44s" }}>
        {[...items, ...items].map((t, i) => (
          <figure key={i} className="w-[320px] sm:w-[380px] shrink-0 rounded-xl border border-border bg-card p-5">
            <div className="flex gap-0.5 mb-3">{[...Array(5)].map((_, j) => <Star key={j} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />)}</div>
            <blockquote className="text-[13.5px] leading-relaxed">“{t.q}”</blockquote>
            <figcaption className="mt-4 flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-[11px] font-bold">{t.n.split(" ").map(w => w[0]).join("")}</span>
              <span><span className="block text-[12.5px] font-semibold leading-none">{t.n}</span><span className="block text-[11.5px] text-muted-foreground mt-1">{t.r}</span></span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <Row items={quotes.slice(0, 4)} />
      <Row items={quotes.slice(4)} reverse />
    </div>
  );
}
