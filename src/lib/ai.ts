/* Deterministic AI simulation engine.
   In production this module is swapped for a server-side call to the
   configured provider (OpenAI / Anthropic / Gemini) — the interface stays identical. */

export type OutputKind =
  | "article" | "blog" | "rewrite" | "paragraphRewrite" | "improve" | "grammar"
  | "summary" | "titles" | "headline" | "metaTitle" | "metaDesc" | "seoBrief"
  | "product" | "social" | "email" | "adCopy" | "intro" | "conclusion"
  | "faq" | "outline" | "keywords" | "ideas" | "press" | "script";

export interface GenResult { text: string; words: number; }

/* ---------- seeded randomness ---------- */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];
const int = (r: () => number, min: number, max: number) => min + Math.floor(r() * (max - min + 1));

export const countWords = (t: string) => (t.trim().match(/\S+/g) || []).length;

/* ---------- in-editor selection transforms ---------- */
const splitSentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 3);
const stripFiller = (s: string) => s
  .replace(/\b(very|really|just|quite|basically|actually|in order to|that being said)\s+/gi, "")
  .replace(/\s{2,}/g, " ")
  .replace(/\bi\b/g, "I");

export type AssistAction = "improve" | "shorten" | "expand" | "continue" | "tone";

export function studioTransform(action: AssistAction, text: string, tone: string, seed: number): string {
  const r = rng(hashStr(text) ^ seed);
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const sentences = splitSentences(clean);
  if (action === "improve") {
    const out = sentences.map(s => {
      let x = stripFiller(s);
      x = x.charAt(0).toUpperCase() + x.slice(1);
      return x;
    });
    return out.join(" ");
  }
  if (action === "shorten") {
    const keep = Math.max(1, Math.ceil(sentences.length * 0.6));
    return sentences.slice(0, keep).map(stripFiller).join(" ");
  }
  if (action === "expand") {
    const topicBit = clean.slice(0, 60).replace(/[.!?,;:]+$/, "").trim() || "this point";
    const extra = pick(r, [
      `In practice, teams that apply this to ${topicBit} see the difference within a few publishing cycles — not because any single change is dramatic, but because the compounding effect is relentless.`,
      `It's worth being specific here: measure before and after, keep the change small enough to revert, and document what worked so the next draft starts smarter.`,
      `A useful test is to imagine a reader skimming this section. If the core claim survives the skim, the detail that follows earns its place.`,
    ]);
    return `${clean} ${extra}`;
  }
  if (action === "continue") {
    return pick(r, [
      `The next step is where most drafts stall: turning the idea above into a repeatable habit. Pick one concrete action from this section, put it on the calendar, and treat the result as data — not as a verdict on the whole strategy.`,
      `None of this requires a bigger budget or a bigger team. It requires a smaller loop: decide, draft, publish, measure, repeat. Teams that protect that loop outwrite teams that keep planning.`,
      `Keep the momentum honest — one shipped improvement this week beats a perfect system next month. The goal is a writing process you'd happily run every single week.`,
    ]);
  }
  /* tone */
  const openers = OPENERS[tone] || OPENERS.neutral;
  const opener = openers[Math.floor(r() * openers.length)].split("{t}").join("this topic");
  return `${opener} ${sentences.map(stripFiller).join(" ")}`;
}

/* ---------- language banks ---------- */
const OPENERS: Record<string, string[]> = {
  professional: [
    "In today's competitive landscape, {t} has become a decisive factor for sustainable growth.",
    "Organizations that approach {t} with intention consistently outperform those that treat it as an afterthought.",
    "The economics of {t} have shifted dramatically over the last few years.",
  ],
  friendly: [
    "Let's be honest — {t} can feel overwhelming when you're just getting started.",
    "Here's the good news about {t}: it's far more approachable than most people think.",
    "If you've ever stared at a blank page wondering where to begin with {t}, you're not alone.",
  ],
  persuasive: [
    "Every day you postpone getting serious about {t}, your competitors pull further ahead.",
    "{t} isn't optional anymore — it's the difference between being chosen and being ignored.",
    "The brands winning right now all share one habit: they mastered {t} before it was obvious.",
  ],
  witty: [
    "{t}: two words that launch a thousand browser tabs.",
    "Nobody puts {t} on their bucket list, and yet here we all are, doing it anyway.",
    "There are two kinds of people: those who understand {t}, and those who are about to.",
  ],
  neutral: [
    "{t} covers a set of practices that directly affect how audiences discover and evaluate your work.",
    "Understanding {t} starts with a few core principles that apply across industries.",
    "This guide breaks {t} down into practical, sequenced steps.",
  ],
};
const MIDS: string[] = [
  "The most common mistake is treating this as a one-time task instead of a system. A repeatable process — capture, draft, refine, publish, measure — compounds quickly.",
  "Start with the audience's actual questions. Search data, support tickets, and sales calls reveal the exact language people use, which makes every asset you produce work harder.",
  "Quality thresholds matter more than volume. One well-researched piece that answers a real question will outrank ten shallow posts written to hit a word count.",
  "Document what works. A simple playbook of winning formats, angles, and distribution channels turns scattered experiments into an asset.",
  "Automation should remove friction, not judgment. Let software handle drafts, briefs, and repurposing — keep strategy and taste human.",
  "Set a measurable definition of done: target keyword mapped, outline approved, draft reviewed, internal links placed, and performance tracked after thirty days.",
  "Repurpose aggressively. A single long-form asset can become a newsletter, three social posts, a slide deck, and a short video script.",
  "Review performance monthly and prune ruthlessly. Merge thin pages, refresh stale dates, and double down on the topics that earn clicks and conversions.",
];
const CLOSERS: string[] = [
  "The takeaway is simple: consistency beats intensity. Ship a little every week, measure honestly, and let the results guide the next iteration.",
  "Begin with one asset this week. Momentum — not perfection — is what turns {t} from a chore into a growth channel.",
  "Treat every piece as an experiment with a hypothesis, and the compound effect over a quarter will surprise you.",
  "When in doubt, return to the fundamentals: a clear audience, a specific promise, and proof. Everything else is optimization.",
];
const TRANSITIONS = ["First,", "Next,", "Beyond that,", "Equally important,", "In practice,", "More specifically,", "Finally,"];
const TONE_ADJ: Record<string, string> = {
  professional: "structured", friendly: "approachable", persuasive: "high-converting",
  witty: "memorable", neutral: "clear",
};

const kw = (inputs: Record<string, string>, keys: string[], fallback: string) => {
  for (const k of keys) if (inputs[k]?.trim()) return inputs[k].trim();
  return fallback;
};
const kwList = (inputs: Record<string, string>, keys: string[]): string[] => {
  for (const k of keys) if (inputs[k]?.trim())
    return inputs[k].split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  return [];
};

function para(r: () => number, topic: string, kws: string[], tone: string): string {
  const bits: string[] = [pick(r, MIDS)];
  if (kws.length && r() > 0.35) {
    const k = pick(r, kws);
    bits.push(pick(r, [
      `In the context of ${k}, this means choosing channels where intent is already high rather than chasing raw reach.`,
      `Teams that align ${k} with a clear owner see turnaround times drop by as much as half.`,
      `A useful test: could a newcomer execute your ${k} workflow using only the documentation you have today?`,
    ]));
  }
  if (r() > 0.55) bits.push(pick(r, [
    `For ${topic}, the compounding effect shows up within six to eight weeks when publishing cadence holds steady.`,
    `Applied to ${topic}, these steps typically reduce production time from days to hours without sacrificing depth.`,
  ]));
  return bits.join(" ");
}

function longform(kind: OutputKind, inputs: Record<string, string>, seed: number): string {
  const r = rng(seed);
  const topic = kw(inputs, ["topic", "title", "keyword", "subject", "niche"], "your core topic");
  const kws = kwList(inputs, ["keywords", "secondary_keywords", "secondary keywords"]);
  const tone = inputs.tone || "professional";
  const len = inputs.length || inputs.depth || "medium";
  const sections = len === "short" ? 2 : len === "long" ? 5 : 3;
  const opener = pick(r, OPENERS[tone] || OPENERS.professional).split("{t}").join(topic);

  const heads = [
    `Why ${topic} deserves a strategy, not a to-do list`,
    `The fundamentals that actually move the needle`,
    `A step-by-step workflow you can run every week`,
    `Common mistakes — and the fixes that stick`,
    `Measuring what matters`,
    `Tools and automation worth adopting`,
  ];
  let out = `# ${kind === "blog" ? topic.charAt(0).toUpperCase() + topic.slice(1) : topic}\n\n`;
  if (kind === "blog" || kind === "article") out += `*A ${TONE_ADJ[tone] || "clear"} guide${kws.length ? ` covering ${kws.slice(0, 3).join(", ")}` : ""}.*\n\n`;
  out += `## Introduction\n\n${opener}\n\n${para(r, topic, kws, tone)}\n\n`;
  for (let i = 0; i < sections; i++) {
    out += `## ${heads[i % heads.length]}\n\n${TRANSITIONS[i % TRANSITIONS.length]} ${para(r, topic, kws, tone)}\n\n`;
  }
  out += `## Final thoughts\n\n${pick(r, CLOSERS).split("{t}").join(topic)}`;
  return out;
}

function listGen(inputs: Record<string, string>, seed: number, kind: OutputKind): string {
  const r = rng(seed);
  const topic = kw(inputs, ["topic", "keyword", "subject", "product", "announcement", "niche"], "your topic");
  const kws = kwList(inputs, ["keywords"]);
  const n = Math.min(Math.max(parseInt(inputs.count || "8", 10) || 8, 3), 15);
  const angles = [
    (t: string) => `${t}: The Complete ${new Date().getFullYear()} Playbook`,
    (t: string) => `How We Improved ${t} by 43% in 30 Days`,
    (t: string) => `7 ${t} Mistakes That Quietly Kill Your Results`,
    (t: string) => `The Beginner's Guide to ${t} (That Actually Goes Deep)`,
    (t: string) => `${t} vs. the Old Way: What Changed and Why It Matters`,
    (t: string) => `10 Quick Wins for ${t} You Can Ship This Week`,
    (t: string) => `Why ${t} Is Easier Than You Think — With the Right System`,
    (t: string) => `${t} Checklist: Everything to Review Before You Publish`,
    (t: string) => `The Underrated ${t} Tactics Experts Swear By`,
    (t: string) => `${t} on a Budget: A Lean, Step-by-Step Approach`,
    (t: string) => `What Nobody Tells You About ${t}`,
    (t: string) => `${t}: 5 Lessons From 100 Real Campaigns`,
    (t: string) => `The ${t} Framework We Use for Every Client`,
    (t: string) => `From Zero to Traction: A 90-Day ${t} Roadmap`,
    (t: string) => `${t} Trends Worth Watching (and Ones to Ignore)`,
  ];
  const items: string[] = [];
  const t = topic.charAt(0).toUpperCase() + topic.slice(1);
  for (let i = 0; i < n; i++) {
    const a = angles[(i + int(r, 0, 4)) % angles.length](kws.length && r() > 0.6 ? `${t} ${pick(r, kws)}` : t);
    if (!items.includes(a)) items.push(a);
  }
  while (items.length < n) items.push(angles[int(r, 0, angles.length - 1)](`${t} — Angle ${items.length + 1}`));
  if (kind === "metaTitle") {
    const brand = inputs.brand ? ` | ${inputs.brand}` : "";
    return items.map((x, i) => `${i + 1}. ${x.slice(0, 55 - brand.length)}${brand}  ·  ${45 + int(r, 0, 15)} chars`).join("\n");
  }
  return items.map((x, i) => `${i + 1}. ${x}`).join("\n");
}

function metaDescs(inputs: Record<string, string>, seed: number): string {
  const r = rng(seed);
  const topic = kw(inputs, ["topic", "keyword"], "your topic");
  const kws = kwList(inputs, ["keywords"]);
  const n = Math.min(Math.max(parseInt(inputs.count || "5", 10) || 5, 3), 10);
  const verbs = ["Discover", "Learn", "Master", "Explore", "Get"];
  const hooks = [
    "practical steps you can apply today", "a proven framework with real examples",
    "actionable tactics, zero fluff", "everything you need in one clear guide",
    "checklists and templates included", "strategies tested across 100+ projects",
  ];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const k = kws.length ? `, ${pick(r, kws)}` : "";
    const d = `${pick(r, verbs)} how ${topic} works${k} — ${pick(r, hooks)}. Start improving your results today.`;
    out.push(`${i + 1}. ${d.slice(0, 155)}  ·  ${d.length > 155 ? 155 : d.length} chars`);
  }
  return out.join("\n\n");
}

function transform(inputs: Record<string, string>, seed: number, kind: OutputKind): string {
  const r = rng(seed);
  const src = (inputs.content || inputs.text || inputs.paragraph || "").trim();
  const sentences = src ? src.split(/(?<=[.!?])\s+/).filter(s => s.length > 3) : [];
  const connectors = ["In other words,", "Put simply,", "More precisely,", "On reflection,", "Crucially,", "In practice,"];
  const upgrades = [
    (s: string) => s, (s: string) => `${pick(r, connectors)} ${s.charAt(0).toLowerCase() + s.slice(1)}`,
    (s: string) => s.replace(/\bvery\s+/gi, "").replace(/\breally\s+/gi, "").replace(/\bjust\s+/gi, ""),
    (s: string) => s.replace(/\bgood\b/gi, "effective").replace(/\bbad\b/gi, "counterproductive").replace(/\bbig\b/gi, "substantial").replace(/\bthings\b/gi, "elements"),
  ];
  if (kind === "grammar") {
    const fixes = [
      "Corrected subject–verb agreement in the second sentence.",
      "Added the missing comma before the coordinating conjunction.",
      "Standardized capitalization of proper nouns.",
      "Replaced a dangling modifier with a clear subject.",
      "Fixed inconsistent tense (past → present) in the closing lines.",
      "Removed the double negative for clarity.",
      "Corrected \"their/there\" usage.",
    ];
    const corrected = sentences.map(s =>
      s.replace(/\bi\b/g, "I").replace(/\s+/g, " ").replace(/([a-z])\s+([,.!?])/g, "$1$2")
    ).join(" ");
    const n = Math.min(fixes.length, 3 + int(r, 0, 3));
    const list = Array.from({ length: n }, (_, i) => fixes[(i + int(r, 0, 2)) % fixes.length]);
    return `### Corrected text\n\n${corrected || "No text provided."}\n\n### Changes made (${list.length})\n${[...new Set(list)].map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\n**Readability score:** ${82 + int(r, 0, 14)}/100 · **Confidence:** ${95 + int(r, 0, 4)}%`;
  }
  if (kind === "summary") {
    const words = src.split(/\s+/).filter(Boolean);
    const keyTerms = [...new Set(words.filter(w => w.length > 5).map(w => w.replace(/[^a-zA-Z-]/g, "")))].slice(0, 5);
    const format = inputs.format || "bullets";
    const pts = sentences.slice(0, 6).map((s, i) => `${i + 1}. ${s}`);
    const body = format === "paragraph"
      ? sentences.slice(0, 4).join(" ") + ` Overall, the text centers on ${keyTerms.slice(0, 3).join(", ") || "the main argument"} and concludes with a clear recommendation.`
      : pts.join("\n");
    return `### Summary (${int(r, 68, 84)}% shorter)\n\n${body}\n\n**Key terms:** ${keyTerms.join(", ") || "—"}\n**Reading time:** ~${Math.max(1, Math.round(words.length / 200 / 3))} min`;
  }
  if (!sentences.length) return "Please provide source text to transform.";
  const strength = inputs.strength || inputs.goal || "moderate";
  const depth = strength === "light" ? 1 : strength === "heavy" ? 3 : 2;
  const rewritten = sentences.map(s => {
    let out = s;
    for (let i = 0; i < depth; i++) out = upgrades[int(r, 1, upgrades.length - 1)](out);
    return out;
  }).join(" ");
  const tone = inputs.tone || inputs.to_tone || "professional";
  return `### Rewritten (${tone} · ${strength} strength)\n\n${rewritten}\n\n---\n**Similarity to original:** ${int(r, 22, 48)}% · **Readability:** improved by ${int(r, 6, 18)} points`;
}

function structured(kind: OutputKind, inputs: Record<string, string>, seed: number): string {
  const r = rng(seed);
  const topic = kw(inputs, ["topic", "product", "keyword", "company", "purpose", "seed_keyword", "niche", "announcement"], "your topic");
  const kws = kwList(inputs, ["keywords", "secondary_keywords", "features", "key_points", "benefit"]);
  const audience = inputs.audience || "your target audience";
  const tone = inputs.tone || "professional";

  switch (kind) {
    case "faq": {
      const n = Math.min(Math.max(parseInt(inputs.count || "6", 10) || 6, 3), 10);
      const qs = [
        `What exactly is ${topic} and who is it for?`,
        `How long does it take to see results from ${topic}?`,
        `How much does ${topic} typically cost?`,
        `Do I need prior experience to get started?`,
        `What are the most common mistakes beginners make?`,
        `Can ${topic} be done with a small team or budget?`,
        `How do I measure whether ${topic} is working?`,
        `What tools do you recommend for ${topic}?`,
        `Is ${topic} still effective in ${new Date().getFullYear()}?`,
        `What's the first step I should take today?`,
      ];
      return qs.slice(0, n).map((q, i) =>
        `**Q${i + 1}: ${q}**\n\n${pick(r, MIDS)} For ${audience}, the practical starting point is a small, time-boxed experiment you can evaluate within two weeks.`
      ).join("\n\n---\n\n");
    }
    case "outline": {
      const depth = inputs.depth || "standard";
      const secs = Math.min(Math.max(parseInt(inputs.sections || "5", 10) || 5, 3), 9);
      let out = `# Outline: ${topic}\n\n**Format:** ${inputs.type || "blog post"} · **Depth:** ${depth} · **Est. words:** ${secs * (depth === "detailed" ? 320 : 220)}\n\n`;
      out += `## 1. Hook & introduction\n- Open with the core tension around ${topic}\n- Promise a specific outcome for ${audience}\n\n`;
      for (let i = 2; i <= secs; i++) {
        out += `## ${i}. ${pick(r, [
          `Context: what most people get wrong about ${topic}`,
          `Framework: the 3-part model`,
          `Step-by-step walkthrough`,
          `Examples & case evidence`,
          `Pitfalls and how to avoid them`,
          `Tools, templates & shortcuts`,
          `Measurement: metrics that matter`,
          `Advanced variations`,
        ])}\n- Key point A${kws.length ? ` (${pick(r, kws)})` : ""}\n- Key point B\n- Supporting example\n\n`;
      }
      return out + `## ${secs + 1}. Conclusion & CTA\n- Recap the one thing to remember\n- Next step for the reader`;
    }
    case "email": {
      const pts = (inputs.key_points || inputs.points || "").split("\n").filter(Boolean);
      const len = inputs.length || "medium";
      let body = `Hi there,\n\n${pick(r, OPENERS[tone] || OPENERS.professional).split("{t}").join(topic)}\n\n`;
      body += `I'm reaching out about **${topic}** because it directly affects ${audience}. `;
      body += (pts.length ? pts : [
        "It removes the most time-consuming part of the workflow",
        "Results typically show within the first two weeks",
        "Getting started takes less than ten minutes",
      ]).slice(0, len === "short" ? 2 : 3).map((p, i) => `\n${i + 1}. ${p}`).join("") + "\n\n";
      body += `Would a quick 15-minute call this week make sense? I'm happy to tailor this to your setup.\n\nBest,\n[Your name]`;
      return `**Subject options:**\n1. Quick idea for ${topic}\n2. ${topic} — 3 things worth your 5 minutes\n3. Re: ${topic}\n\n---\n\n${body}`;
    }
    case "adCopy": {
      const platform = inputs.platform || "google";
      const benefit = kws[0] || "measurable results";
      const product = inputs.product || topic;
      if (platform === "google") {
        return `### Google Search Ads\n\n**Headlines (30 char max)**\n1. ${product.slice(0, 28)}\n2. Get ${benefit.slice(0, 20)} Today\n3. Try It Free for 14 Days\n\n**Descriptions (90 char max)**\n1. Built for ${audience}. Set up in minutes and see ${benefit} from week one. No credit card required.\n2. Join 4,000+ teams already using ${product}. Cancel anytime — results guaranteed or your money back.`;
      }
      if (platform === "facebook") {
        return `### Facebook / Instagram Ads\n\n**Primary text**\nStill doing ${topic} the hard way? ${product} gives ${audience} ${benefit} — without the busywork.\n\n✓ ${benefit}\n✓ Built for ${audience}\n✓ Free 14-day trial\n\n**Headline:** ${product} — ${benefit}, minus the grind\n**CTA:** Learn More\n\n**Variant B (story-led)**\nLast quarter we cut our ${topic} time in half. Here's the exact tool we used →`;
      }
      return `### LinkedIn Sponsored Content\n\n**Intro:** Most teams lose hours every week to ${topic}. It doesn't have to be that way.\n\n**Body:** ${product} helps ${audience} get ${benefit} with a workflow that fits how you already work. Setup takes minutes, not sprints.\n\n**CTA:** Book a demo\n\n**Lead form headline:** See ${product} in action — 15 minutes, tailored to your stack.`;
    }
    case "social": {
      const platform = inputs.platform || "linkedin";
      const tags = inputs.hashtags === "no" ? "" : `\n\n#${topic.replace(/[^a-zA-Z]/g, "")} #AI #ContentStrategy`;
      if (platform === "twitter" || platform === "x") {
        return `**Post 1 (hook)**\nUnpopular opinion: most advice about ${topic} is recycled. Here's what actually worked for us 🧵\n\n**Post 2 (thread opener)**\nWe spent 6 months testing ${topic} approaches for ${audience}.\n\n3 lessons worth stealing:\n\n**Post 3 (punchy)**\n${topic} isn't a talent. It's a system.\n\nBuild the system.${tags}`;
      }
      if (platform === "instagram") {
        return `**Caption**\nPOV: you finally cracked ${topic} 👀\n\nSave this for later — 3 things we wish we knew sooner:\n1️⃣ Consistency beats perfection\n2️⃣ Small experiments, fast feedback\n3️⃣ Document everything${tags}\n\n**Alt text:** Tips for ${topic} for ${audience}`;
      }
      return `**LinkedIn post**\nWe used to spend 10+ hours a week on ${topic}.\n\nNow it takes two. The difference wasn't hiring — it was building a system around what actually moves metrics for ${audience}.\n\nThree shifts that mattered most:\n→ We stopped publishing to publish\n→ We reused every asset 4×\n→ We measured leading indicators, not vanity numbers\n\nFull breakdown in the comments.${tags}`;
    }
    case "product": {
      const feats = kws.length ? kws : ["fast setup", "team-friendly", "measurable impact"];
      return `## ${topic}\n\n**${pick(r, [
        `The ${TONE_ADJ[tone] || "smarter"} way to handle ${feats[0]}`,
        `Built for ${audience} who refuse to settle`,
        `Everything you need. Nothing you don't.`,
      ])}**\n\nMeet **${topic}** — designed for ${audience} who need results without the learning curve. ${pick(r, OPENERS[tone] || OPENERS.neutral).split("{t}").join(topic)}\n\n**Why you'll love it:**\n${feats.slice(0, 5).map(f => `- **${f.charAt(0).toUpperCase() + f.slice(1)}** — ${pick(r, [
        "works out of the box, no configuration marathons", "backed by real usage data from thousands of teams",
        "built to scale from day one to day one thousand", "the detail you'll notice in the first five minutes"])}`).join("\n")}\n\n**Perfect for:** ${audience}.\n\n**In the box:** ${topic}, onboarding guide, and priority support.\n\n→ *Add to cart and see the difference in your first week.*`;
    }
    case "seoBrief": {
      const k = inputs.keyword || topic;
      const secondary = kws.length ? kws : [`${k} strategy`, `${k} examples`, `how to ${k}`];
      return `# SEO Content Brief — "${k}"\n\n**Intent:** ${inputs.intent || "informational"} · **Target length:** ${inputs.length === "long" ? "2,200–2,800" : "1,400–1,800"} words · **Difficulty:** ${int(r, 18, 62)}/100\n\n## Target keyword\n\`${k}\` — place in H1, first 100 words, one H2, meta title & description.\n\n## Secondary keywords\n${secondary.map(s => `- \`${s}\` (H2 or early paragraph)`).join("\n")}\n\n## Suggested structure\n1. H1: The Practical Guide to ${k.charAt(0).toUpperCase() + k.slice(1)} (${new Date().getFullYear()})\n2. H2: What is ${k}? (40–60 words, answer-box friendly)\n3. H2: Why it matters now\n4. H2: Step-by-step process\n5. H2: Mistakes to avoid\n6. H2: Tools & templates\n7. H2: FAQ (3 questions with schema)\n\n## SERP notes\n- Current top results average ${int(r, 1300, 2400)} words; winners include original data or screenshots.\n- People-also-ask opportunities: "${k} examples", "is ${k} worth it?", "${k} for beginners".\n\n## Internal links\nLink from 2–3 related hub pages; add 1 outbound authority source.`;
    }
    case "keywords": {
      const seedK = inputs.seed_keyword || topic;
      const n = Math.min(Math.max(parseInt(inputs.count || "12", 10) || 12, 5), 20);
      const mods = ["best", "how to", "tools", "examples", "template", "strategy", "for beginners", "checklist", "vs alternatives", "pricing", "benefits", "mistakes", "trends", "software", "guide", "workflow", "metrics", "agency", "freelance", "automation"];
      const rows = [`| Keyword | Volume | Difficulty | Intent |`, `|---|---|---|---|`];
      for (let i = 0; i < n; i++) {
        const mod = mods[(i + int(r, 0, 5)) % mods.length];
        const phrase = r() > 0.5 ? `${mod} ${seedK}` : `${seedK} ${mod}`;
        rows.push(`| ${phrase} | ${(int(r, 1, 90) / 10).toFixed(1)}k | ${int(r, 8, 74)} | ${pick(r, ["informational", "commercial", "transactional", "navigational"])} |`);
      }
      return `## Keyword clusters for "${seedK}"\n\n**Cluster A — Learning (top of funnel)**\n${rows.slice(0, 2 + Math.ceil(n / 3)).join("\n")}\n\n**Cluster B — Comparing (middle of funnel)**\n${[rows[0], rows[1], ...rows.slice(2 + Math.ceil(n / 3), 2 + Math.ceil((2 * n) / 3))].join("\n")}\n\n**Cluster C — Buying (bottom of funnel)**\n${[rows[0], rows[1], ...rows.slice(2 + Math.ceil((2 * n) / 3))].join("\n")}\n\n*Tip: build one pillar page for Cluster A and interlink B and C into it.*`;
    }
    case "intro": {
      const hook = inputs.hook_style || "question";
      const t = topic.charAt(0).toUpperCase() + topic.slice(1);
      const hooks: Record<string, string> = {
        question: `What if everything you've read about ${topic} was optimized for clicks instead of results?`,
        statistic: `Teams that systematize ${topic} publish 3× more — with half the headcount.`,
        story: `Six months ago, our ${topic} process was a shared doc, two freelancers, and a prayer.`,
        bold: `${t} is broken — and most teams are too busy executing to notice.`,
      };
      return `${hooks[hook] || hooks.question}\n\n${pick(r, OPENERS[tone] || OPENERS.professional).split("{t}").join(topic)} For ${audience}, the gap between effort and outcome usually comes down to a handful of decisions made early — and repeated weekly.\n\nIn this piece, you'll learn the framework behind those decisions, see it applied to real examples, and leave with a checklist you can run this week. No theory for theory's sake; every section earns its place.\n\n*Reading time: 7 minutes. Worth every one of them.*`;
    }
    case "conclusion": {
      const pts = kwList(inputs, ["key_points"]).length ? kwList(inputs, ["key_points"]) : [
        "systems beat bursts of inspiration", "measure leading indicators", "start smaller than feels ambitious",
      ];
      const cta = inputs.cta || "newsletter";
      const ctaMap: Record<string, string> = {
        newsletter: "If this was useful, join 12,000 readers who get one practical guide like this every Tuesday. No spam, unsubscribe anytime.",
        trial: "Ready to put this into practice? Start your free 14-day trial — no credit card required, cancel in two clicks.",
        comment: "What's the one thing you'll try first? Tell us in the comments — we read every single one.",
        share: "Know someone wrestling with this? Share this guide — it takes one click and might save them a month.",
      };
      return `## Wrapping up\n\nLet's make it stick. The three ideas worth carrying forward:\n\n${pts.map((p, i) => `${i + 1}. **${p.charAt(0).toUpperCase() + p.slice(1)}.**`).join("\n")}\n\n${topic.charAt(0).toUpperCase() + topic.slice(1)} rewards the teams that treat it as a practice, not a project. Pick one of the steps above, time-box it to this week, and let the results argue for the next one.\n\n${ctaMap[cta] || ctaMap.newsletter}`;
    }
    case "ideas": {
      const n = Math.min(Math.max(parseInt(inputs.count || "10", 10) || 10, 4), 15);
      const formats = ["a myth-busting post", "a data-backed teardown", "a beginner's field guide", "a controversial hot take", "a behind-the-scenes case study", "a template + walkthrough", "an expert roundup", "a 30-day challenge series", "a comparison matrix", "an AMA with a practitioner", "a fail-log (what didn't work)", "a tools-stack reveal"];
      const out: string[] = [];
      for (let i = 0; i < n; i++) {
        out.push(`${i + 1}. **${pick(r, formats)}** — "${pick(r, [
          `What ${topic} looks like when done right`, `The ${topic} advice I'd ignore in ${new Date().getFullYear()}`,
          `I tested every ${topic} tip for 30 days`, `${topic}: the boring parts that actually work`,
          `The hidden costs of ${topic} nobody budgets for`, `How a 2-person team wins at ${topic}`,
          `${topic} for skeptics`, `The ${topic} iceberg`])}" · ${pick(r, ["high search intent", "great for social", "link-magnet", "quick win", "authority builder"])}`);
      }
      return `## ${n} content ideas for ${topic}\n\n${out.join("\n")}`;
    }
    case "press": {
      const company = inputs.company || topic;
      const person = inputs.quote_person || "the CEO";
      const date = inputs.date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      return `**FOR IMMEDIATE RELEASE**\n\n# ${company} Announces ${topic}\n\n*${date} — San Francisco, CA*\n\n${company} today announced ${topic}, a move the company says will deliver meaningful value for ${audience}. The announcement follows a period of focused development and direct feedback from early customers.\n\n"${pick(r, [
        `This is the announcement we've been building toward for a long time. It changes what's possible for our customers.`,
        `We listened to what ${audience} actually needed, and this is the answer.`,
        `Today marks a new chapter — one where our customers get more of what matters and less of what doesn't.`])}" said ${person} of ${company}.\n\n**Key highlights:**\n- Immediate availability for all customers\n- Designed around the workflows of ${audience}\n- Backed by ${company}'s long-term product commitment\n\n**About ${company}**\n${company} builds tools that help ${audience} do their best work. Learn more at ${company.toLowerCase().replace(/[^a-z]/g, "")}.com.\n\n**Media contact:** press@${company.toLowerCase().replace(/[^a-z]/g, "")}.com\n\n###`;
    }
    case "script": {
      const dur = inputs.duration || "60 seconds";
      const platform = inputs.platform || "youtube";
      return `# Video script — ${topic}\n**Platform:** ${platform} · **Runtime:** ${dur} · **Tone:** ${tone}\n\n**[0:00 — HOOK]** *(on camera, tight framing)*\n"${pick(r, [
        `Everything you've heard about ${topic} is about to get a lot simpler.`,
        `Give me ${dur}, and I'll save you a month of trial and error on ${topic}.`,
        `This is the ${topic} video I wish existed when I started.`])}"\n\n**[0:08 — CONTEXT]** *(b-roll, screen recording)*\nQuick setup: who this is for (${audience}), what we'll cover, and the one result to expect by the end.\n\n**[0:20 — POINT 1]**\n${pick(r, MIDS)}\n→ *Visual: checklist overlay*\n\n**[0:40 — POINT 2]**\n${pick(r, MIDS)}\n→ *Visual: before/after split screen*\n\n**[1:00 — PROOF / EXAMPLE]**\nShow, don't tell: one concrete walkthrough with numbers on screen.\n\n**[FINAL 10s — CTA]**\n"If this saved you time, the full checklist is linked below. Subscribe for one practical ${topic} video every week."\n\n**Title options:**\n1. ${topic} in ${dur} (no fluff)\n2. The only ${topic} guide you need in ${new Date().getFullYear()}\n3. I was wrong about ${topic}`;
    }
    case "headline": {
      const style = inputs.style || "benefit-driven";
      const base = listGen(inputs, seed, "headline");
      return `### ${style.charAt(0).toUpperCase() + style.slice(1)} headlines for ${audience}\n\n${base}`;
    }
    default:
      return longform(kind, inputs, seed);
  }
}

export function generateOutput(kind: OutputKind, inputs: Record<string, string>, seed: number): GenResult {
  let text: string;
  switch (kind) {
    case "rewrite": case "paragraphRewrite": case "improve": case "grammar": case "summary":
      text = transform(inputs, seed, kind); break;
    case "titles": case "metaTitle":
      text = listGen(inputs, seed, kind); break;
    case "metaDesc":
      text = metaDescs(inputs, seed); break;
    case "article": case "blog":
      text = longform(kind, inputs, seed); break;
    default:
      text = structured(kind, inputs, seed);
  }
  return { text, words: countWords(text) };
}

/* ---------- streaming ---------- */
export function streamText(
  text: string,
  onChunk: (partial: string) => void,
  onDone: () => void,
  cps = 160,
): () => void {
  const words = text.split(/(\s+)/);
  let i = 0;
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) { onChunk(text); onDone(); return () => {}; }
  const tick = Math.max(16, Math.round((1000 / cps) * 3));
  const id = window.setInterval(() => {
    i = Math.min(words.length, i + 3);
    onChunk(words.slice(0, i).join(""));
    if (i >= words.length) { window.clearInterval(id); onDone(); }
  }, tick);
  return () => window.clearInterval(id);
}
