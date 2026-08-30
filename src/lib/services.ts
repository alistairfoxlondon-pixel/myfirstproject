/* Application service layer — the equivalent of Laravel controllers,
   form requests, policies and middleware. Every protected action is
   validated here (never in the UI): authentication, account status,
   subscription state, plan permissions, usage and rate limits. */
import {
  DB, User, Plan, Tool, Subscription, Generation, Usage, Invoice, Settings, Post,
  getDb, mutate, uid, nowISO, daysAheadISO, monthKey, dayKey, hash, tierRank,
  setSession, getSessionUserId, freshDb, saveDb, countWords,
} from "./db";
import { generateOutput, hashStr, studioTransform, AssistAction } from "./ai";

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));
const log = (db: DB, actor: string, role: string, action: string, detail: string) => {
  db.activity.unshift({ id: "act_" + uid(), actor, role, action, detail, createdAt: nowISO() });
  db.activity = db.activity.slice(0, 120);
};

/* ================= auth ================= */
export function register(name: string, email: string, password: string): User {
  const db = getDb();
  if (!db.settings.registration.enabled) throw new ApiError("REGISTRATION_CLOSED", "Public registration is currently disabled. Please contact support.");
  if (!name.trim() || name.trim().length < 2) throw new ApiError("VALIDATION", "Please enter your full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError("VALIDATION", "Please enter a valid email address.");
  if (password.length < 8) throw new ApiError("VALIDATION", "Password must be at least 8 characters.");
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase()))
    throw new ApiError("EMAIL_TAKEN", "An account with this email already exists. Try signing in.");

  return mutate(d => {
    const trial = d.settings.trial;
    const user: User = {
      id: "u_" + uid(), name: name.trim(), email: email.toLowerCase(), passHash: hash(password),
      role: "user", status: "active", createdAt: nowISO(),
      verifiedAt: d.settings.registration.requireVerification ? null : nowISO(),
      color: ["#3f6212", "#1d4ed8", "#9f1239", "#7e22ce", "#b45309", "#0f766e", "#4338ca"][d.users.length % 7],
    };
    const trialPlan = d.plans.find(p => p.isTrial)!;
    const sub: Subscription = {
      id: "sub_" + uid(), userId: user.id, planId: trialPlan.id, status: "trialing", period: "monthly",
      currentPeriodEnd: daysAheadISO(trial.days), cancelAtPeriodEnd: false, startedAt: nowISO(), payment: null, provider: "none",
    };
    d.users.push(user);
    d.subscriptions.push(sub);
    log(d, "System", "system", "user.registered", `${user.name} joined and started a ${trial.days}-day free trial`);
    setSession(user.id);
    return user;
  });
}

export function login(email: string, password: string): User {
  const db = getDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.passHash !== hash(password)) throw new ApiError("AUTH", "Invalid email or password.");
  if (user.status === "suspended") throw new ApiError("SUSPENDED", "This account is suspended. Contact support@chatdeck.ai to resolve this.");
  setSession(user.id);
  return user;
}

export function logout() { setSession(null); }

/* Password resets are code-gated — see requestResetCode / consumeResetCode
   in lib/content.ts. Codes are single-use and expire after 15 minutes. */

export function currentUser(): User | null {
  const id = getSessionUserId();
  if (!id) return null;
  const user = getDb().users.find(u => u.id === id) || null;
  if (user && user.status === "suspended") return user; // still returned; UI shows lock screen
  return user;
}

export function updateProfile(userId: string, patch: { name?: string; email?: string; company?: string }): User {
  return mutate(d => {
    const user = d.users.find(u => u.id === userId); if (!user) throw new ApiError("NOT_FOUND", "User not found.");
    if (patch.email && patch.email !== user.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) throw new ApiError("VALIDATION", "Invalid email address.");
      if (d.users.some(u => u.email.toLowerCase() === patch.email!.toLowerCase())) throw new ApiError("EMAIL_TAKEN", "That email is already in use.");
      user.email = patch.email.toLowerCase();
    }
    if (patch.name !== undefined) {
      if (patch.name.trim().length < 2) throw new ApiError("VALIDATION", "Name is too short.");
      user.name = patch.name.trim();
    }
    if (patch.company !== undefined) user.company = patch.company.trim() || undefined;
    return user;
  });
}

export function changePassword(userId: string, current: string, next: string): void {
  mutate(d => {
    const user = d.users.find(u => u.id === userId); if (!user) throw new ApiError("NOT_FOUND", "User not found.");
    if (user.passHash !== hash(current)) throw new ApiError("AUTH", "Current password is incorrect.");
    if (next.length < 8) throw new ApiError("VALIDATION", "New password must be at least 8 characters.");
    user.passHash = hash(next);
  });
}

export function deleteAccount(userId: string): void {
  mutate(d => {
    d.users = d.users.filter(u => u.id !== userId);
    d.subscriptions = d.subscriptions.filter(s => s.userId !== userId);
    d.generations = d.generations.filter(g => g.userId !== userId);
    d.usage = d.usage.filter(u => u.userId !== userId);
    d.invoices = d.invoices.filter(i => i.userId !== userId);
    setSession(null);
  });
}

/* ================= access context & enforcement ================= */
export interface AccessContext {
  user: User; subscription: Subscription | null; plan: Plan | null;
  effective: "trialing" | "active" | "expired" | "canceled" | "past_due" | "none";
  daysLeft: number; wordsUsed: number; wordsLimit: number; gensUsed: number; gensLimit: number;
  available: Tool[];
}

function renewIfDue(db: DB, sub: Subscription): void {
  // Simulates the Laravel scheduler/cashier webhook: auto-renew active paid subs.
  if (sub.status !== "active" || sub.cancelAtPeriodEnd) return;
  if (new Date(sub.currentPeriodEnd).getTime() > Date.now()) return;
  const plan = db.plans.find(p => p.id === sub.planId);
  const user = db.users.find(u => u.id === sub.userId);
  const days = sub.period === "yearly" ? 365 : 30;
  sub.currentPeriodEnd = daysAheadISO(days);
  if (plan && user && plan.monthly > 0) {
    db.invoices.unshift({
      id: "inv_" + uid(), userId: user.id, number: `INV-2026-${db.seq++}`, planName: plan.name,
      period: sub.period === "yearly" ? "Yearly" : "Monthly",
      amount: sub.period === "yearly" ? plan.yearly : plan.monthly,
      status: "paid", createdAt: nowISO(), last4: sub.payment?.last4 || "4242",
    });
    log(db, "System", "system", "subscription.renewed", `${user.name} — ${plan.name} ${sub.period} renewed`);
  }
}

export function getAccess(user: User): AccessContext {
  const db = getDb();
  const subscription = db.subscriptions.filter(s => s.userId === user.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null;
  if (subscription) renewIfDue(db, subscription);
  const plan = subscription ? db.plans.find(p => p.id === subscription.planId) || null : null;

  let effective: AccessContext["effective"] = "none";
  if (subscription && plan) {
    const ended = new Date(subscription.currentPeriodEnd).getTime() < Date.now();
    if (subscription.status === "past_due") effective = "past_due";
    else if (plan.isTrial) effective = ended ? "expired" : subscription.status === "canceled" ? "canceled" : "trialing";
    else effective = ended ? (subscription.cancelAtPeriodEnd ? "canceled" : "expired") : subscription.status === "canceled" ? "canceled" : "active";
  }
  const daysLeft = subscription ? Math.max(0, Math.ceil((new Date(subscription.currentPeriodEnd).getTime() - Date.now()) / 86400000)) : 0;

  const month = monthKey(nowISO());
  const usage = db.usage.find(u => u.userId === user.id && u.month === month);
  const wordsUsed = usage?.wordsUsed || 0;
  const gensUsed = usage?.generationsUsed || 0;

  const available = user.role === "admin"
    ? db.tools.filter(t => t.active)
    : db.tools.filter(t => t.active && plan && tierRank[plan.tier] >= tierRank[t.minTier]);

  return {
    user, subscription, plan, effective, daysLeft,
    wordsUsed, wordsLimit: plan?.wordsLimit ?? 0, gensUsed, gensLimit: plan?.generationsLimit ?? 0,
    available,
  };
}

export type GuardCode = "UNAUTHENTICATED" | "SUSPENDED" | "TRIAL_EXPIRED" | "SUBSCRIPTION_REQUIRED" | "PAST_DUE"
  | "TOOL_DISABLED" | "PLAN_LOCKED" | "WORD_LIMIT" | "GEN_LIMIT" | "TOOL_DAILY_CAP" | "RATE_LIMITED" | "VALIDATION";

export function checkGeneration(user: User | null, toolSlug: string): { ok: true } | { ok: false; code: GuardCode; message: string } {
  if (!user) return { ok: false, code: "UNAUTHENTICATED", message: "You must be signed in to generate content." };
  if (user.status === "suspended") return { ok: false, code: "SUSPENDED", message: "This account is suspended. Contact support to restore access." };
  const db = getDb();
  const tool = db.tools.find(t => t.slug === toolSlug);
  if (!tool || !tool.active) return { ok: false, code: "TOOL_DISABLED", message: "This tool is not currently available." };

  const access = getAccess(user);
  if (access.effective === "none") return { ok: false, code: "SUBSCRIPTION_REQUIRED", message: "You don't have an active subscription." };
  if (access.effective === "expired") return { ok: false, code: "TRIAL_EXPIRED", message: "Your free trial has ended. Choose a plan to keep creating." };
  if (access.effective === "past_due") return { ok: false, code: "PAST_DUE", message: "Your last payment failed. Update billing to resume generating." };
  if (access.effective === "canceled" && access.daysLeft === 0) return { ok: false, code: "SUBSCRIPTION_REQUIRED", message: "Your subscription has ended. Reactivate to continue." };

  const plan = access.plan!;
  if (user.role !== "admin" && tierRank[plan.tier] < tierRank[tool.minTier])
    return { ok: false, code: "PLAN_LOCKED", message: `${tool.name} is available on the ${cap(tool.minTier)} plan and above.` };

  const month = monthKey(nowISO());
  const usage = db.usage.find(u => u.userId === user.id && u.month === month);
  if (usage && plan.generationsLimit !== -1 && usage.generationsUsed >= plan.generationsLimit)
    return { ok: false, code: "GEN_LIMIT", message: "You've reached your monthly generation limit." };
  if (usage && plan.wordsLimit !== -1 && usage.wordsUsed >= plan.wordsLimit)
    return { ok: false, code: "WORD_LIMIT", message: "You've reached your monthly word limit." };

  const today = dayKey(nowISO());
  const todayCount = db.generations.filter(g => g.userId === user.id && g.toolSlug === toolSlug && g.createdAt.startsWith(today)).length;
  if (tool.dailyCap > 0 && todayCount >= tool.dailyCap)
    return { ok: false, code: "TOOL_DAILY_CAP", message: `Daily limit for this tool reached (${tool.dailyCap}/day). Resets at midnight.` };

  const lastMinute = db.generations.filter(g => g.userId === user.id && Date.now() - new Date(g.createdAt).getTime() < 60000).length;
  if (lastMinute >= db.settings.usage.ratePerMinute)
    return { ok: false, code: "RATE_LIMITED", message: "Too many requests — please wait a few seconds between generations." };

  return { ok: true };
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function validateInputs(tool: Tool, inputs: Record<string, string>): string | null {
  const MAX = { text: 500, textarea: 40000, select: 80, number: 12 };
  for (const f of tool.fields) {
    const v = (inputs[f.key] || "").trim();
    if (v.length > MAX[f.type]) return `"${f.label}" is too long (max ${MAX[f.type].toLocaleString()} characters).`;
    if (f.required && !v) return `"${f.label}" is required.`;
    if (f.type === "number" && v) {
      const n = Number(v);
      if (Number.isNaN(n)) return `"${f.label}" must be a number.`;
      if (f.min !== undefined && n < f.min) return `"${f.label}" must be at least ${f.min}.`;
      if (f.max !== undefined && n > f.max) return `"${f.label}" must be at most ${f.max}.`;
    }
  }
  return null;
}

export async function generate(user: User, toolSlug: string, inputs: Record<string, string>): Promise<Generation> {
  const guard = checkGeneration(user, toolSlug);
  if (!guard.ok) throw new ApiError(guard.code, guard.message);
  const tool = getDb().tools.find(t => t.slug === toolSlug);
  if (!tool) throw new ApiError("NOT_FOUND", "Tool not found.");
  const err = validateInputs(tool, inputs);
  if (err) throw new ApiError("VALIDATION", err);

  const started = Date.now();
  await sleep(650 + Math.random() * 700); // provider round-trip
  const db = getDb();
  const seed = hashStr(JSON.stringify(inputs) + Date.now());
  const res = generateOutput(tool.outputKind as never, inputs, seed);
  const output = res.text.slice(0, db.settings.usage.maxOutputWords * 8);
  const words = countWords(output);

  return mutate(d => {
    // Re-check limits inside the mutation (server-side, atomic).
    const guard2 = checkGeneration(user, tool.slug);
    if (!guard2.ok) throw new ApiError(guard2.code, guard2.message);
    const gen: Generation = {
      id: "gen_" + uid(), userId: user.id, toolSlug: tool.slug, toolName: tool.name,
      inputs, output, words, chars: output.length, status: "completed",
      model: d.settings.ai.model, provider: d.settings.ai.provider,
      createdAt: nowISO(), durationMs: Date.now() - started,
    };
    d.generations.unshift(gen);
    d.generations = d.generations.slice(0, 600);
    const month = monthKey(nowISO());
    let usage = d.usage.find(u => u.userId === user.id && u.month === month);
    if (!usage) { usage = { userId: user.id, month, wordsUsed: 0, generationsUsed: 0, byDay: {}, byTool: {} }; d.usage.push(usage); }
    usage.wordsUsed += words; usage.generationsUsed += 1;
    usage.byDay[dayKey(nowISO())] = (usage.byDay[dayKey(nowISO())] || 0) + words;
    usage.byTool[tool.slug] = (usage.byTool[tool.slug] || 0) + 1;
    const t = d.tools.find(x => x.slug === tool.slug); if (t) t.uses += 1;
    return gen;
  });
}

export function listGenerations(userId: string, opts?: { tool?: string; limit?: number }): Generation[] {
  const db = getDb();
  let list = db.generations.filter(g => g.userId === userId);
  if (opts?.tool) list = list.filter(g => g.toolSlug === opts.tool);
  return list.slice(0, opts?.limit ?? 200);
}
export function deleteGeneration(userId: string, genId: string): void {
  mutate(d => { d.generations = d.generations.filter(g => !(g.id === genId && g.userId === userId)); });
}

/* ================= billing ================= */
export function subscribe(user: User, planId: string, period: "monthly" | "yearly", card: { name: string; number: string; exp: string; cvc: string }): Subscription {
  const db = getDb();
  const plan = db.plans.find(p => p.id === planId);
  if (!plan || !plan.active || plan.isTrial) throw new ApiError("NOT_FOUND", "This plan is not available.");
  const digits = card.number.replace(/\s+/g, "");
  if (digits.length < 12) throw new ApiError("VALIDATION", "Enter a valid card number.");
  if (!/^\d{2}\/\d{2}$/.test(card.exp)) throw new ApiError("VALIDATION", "Expiry must be MM/YY.");
  if (card.cvc.length < 3) throw new ApiError("VALIDATION", "Enter a valid CVC.");

  return mutate(d => {
    const amount = period === "yearly" ? plan.yearly : plan.monthly;
    let sub = d.subscriptions.find(s => s.userId === user.id && s.planId === planId && ["active", "past_due"].includes(s.status));
    if (!sub) {
      sub = {
        id: "sub_" + uid(), userId: user.id, planId: plan.id, status: "active", period,
        currentPeriodEnd: daysAheadISO(period === "yearly" ? 365 : 30), cancelAtPeriodEnd: false,
        startedAt: nowISO(), payment: { brand: digits.startsWith("5") ? "Mastercard" : "Visa", last4: digits.slice(-4), exp: card.exp },
        provider: "stripe",
      };
      d.subscriptions.push(sub);
    } else {
      sub.status = "active"; sub.period = period; sub.cancelAtPeriodEnd = false;
      sub.currentPeriodEnd = daysAheadISO(period === "yearly" ? 365 : 30);
      sub.payment = { brand: digits.startsWith("5") ? "Mastercard" : "Visa", last4: digits.slice(-4), exp: card.exp };
    }
    // Expire old trial subs.
    for (const s of d.subscriptions) if (s.userId === user.id && s.id !== sub!.id) s.status = s.id === sub!.id ? s.status : (s.status === "trialing" ? "expired" : s.status);
    d.invoices.unshift({
      id: "inv_" + uid(), userId: user.id, number: `INV-2026-${d.seq++}`, planName: plan.name,
      period: period === "yearly" ? "Yearly" : "Monthly", amount, status: "paid", createdAt: nowISO(), last4: digits.slice(-4),
    });
    const u = d.users.find(x => x.id === user.id)!;
    log(d, u.name, "user", "subscription.created", `${u.name} subscribed to ${plan.name} (${period}) — $${amount.toFixed(2)}`);
    return sub;
  });
}

export function cancelAtPeriodEnd(user: User): void {
  mutate(d => {
    const sub = d.subscriptions.find(s => s.userId === user.id && ["active", "trialing"].includes(s.status));
    if (!sub) throw new ApiError("NOT_FOUND", "No active subscription to cancel.");
    sub.cancelAtPeriodEnd = true;
    const u = d.users.find(x => x.id === user.id)!;
    const plan = d.plans.find(p => p.id === sub.planId);
    log(d, u.name, "user", "subscription.cancel_scheduled", `${u.name} scheduled ${plan?.name} cancellation at period end`);
  });
}
export function resumeSubscription(user: User): void {
  mutate(d => {
    const sub = d.subscriptions.find(s => s.userId === user.id && s.cancelAtPeriodEnd);
    if (sub) sub.cancelAtPeriodEnd = false;
  });
}
export function retryPayment(user: User): void {
  mutate(d => {
    const sub = d.subscriptions.find(s => s.userId === user.id && s.status === "past_due");
    if (!sub) throw new ApiError("NOT_FOUND", "No overdue subscription found.");
    sub.status = "active";
    sub.currentPeriodEnd = daysAheadISO(sub.period === "yearly" ? 365 : 30);
    const plan = d.plans.find(p => p.id === sub.planId);
    const inv = d.invoices.find(i => i.userId === user.id && i.status === "open");
    if (inv) inv.status = "paid";
    const u = d.users.find(x => x.id === user.id)!;
    log(d, "System", "system", "payment.recovered", `Payment recovered for ${u.name} — ${plan?.name}`);
  });
}
export function listInvoices(userId: string): Invoice[] {
  return getDb().invoices.filter(i => i.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ================= admin ================= */
function requireAdmin(user: User | null): asserts user is User {
  if (!user || user.role !== "admin") throw new ApiError("FORBIDDEN", "Administrator access required.");
}

export const adminStats = (admin: User | null) => {
  requireAdmin(admin);
  const db = getDb();
  const now = Date.now();
  const users = db.users.filter(u => u.role !== "admin");
  const subsFor = (uid_: string) => db.subscriptions.filter(s => s.userId === uid_).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  let trialing = 0, paid = 0, active = 0;
  for (const u of users) {
    const s = subsFor(u.id); if (!s) continue;
    const plan = db.plans.find(p => p.id === s.planId);
    const ended = new Date(s.currentPeriodEnd).getTime() < now;
    if (plan?.isTrial && !ended && s.status === "trialing") trialing++;
    else if (!plan?.isTrial && (s.status === "active" || s.status === "past_due") && !ended) { paid++; if (u.status === "active") active++; }
  }
  const mrr = db.subscriptions.reduce((sum, s) => {
    const plan = db.plans.find(p => p.id === s.planId);
    if (!plan || plan.isTrial || s.status !== "active") return sum;
    if (new Date(s.currentPeriodEnd).getTime() < now) return sum;
    return sum + (s.period === "yearly" ? plan.yearly / 12 : plan.monthly);
  }, 0);
  const d30 = new Date(now - 30 * 86400000).toISOString();
  const gens30 = db.generations.filter(g => g.createdAt >= d30);
  const words30 = gens30.reduce((s, g) => s + g.words, 0);
  const signups: { day: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now - i * 86400000).toISOString().slice(0, 10);
    signups.push({ day, count: db.users.filter(u => u.createdAt.slice(0, 10) === day).length });
  }
  const toolUsage = Object.entries(
    gens30.reduce<Record<string, number>>((acc, g) => { acc[g.toolSlug] = (acc[g.toolSlug] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([slug, count]) => ({ slug, name: db.tools.find(t => t.slug === slug)?.name || slug, count }));
  const revenue: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const dte = new Date(); dte.setMonth(dte.getMonth() - i);
    const key = dte.toISOString().slice(0, 7);
    revenue.push({ month: key, total: db.invoices.filter(inv => inv.createdAt.startsWith(key) && inv.status === "paid").reduce((s, inv) => s + inv.amount, 0) });
  }
  return {
    totalUsers: users.length, newThisWeek: users.filter(u => Date.now() - new Date(u.createdAt).getTime() < 7 * 86400000).length,
    trialing, paid, active, mrr, gens30: gens30.length, gensTotal: db.generations.length, words30, signups, toolUsage, revenue,
    activity: db.activity.slice(0, 12), invoicesOpen: db.invoices.filter(i => i.status === "open").length,
  };
};

export const adminListUsers = (admin: User | null) => {
  requireAdmin(admin);
  const db = getDb();
  return db.users.map(u => {
    const sub = db.subscriptions.filter(s => s.userId === u.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null;
    const plan = sub ? db.plans.find(p => p.id === sub.planId) || null : null;
    const month = monthKey(nowISO());
    const usage = db.usage.find(x => x.userId === u.id && x.month === month);
    return { user: u, sub, plan, gens: db.generations.filter(g => g.userId === u.id).length, wordsMonth: usage?.wordsUsed || 0 };
  });
};

export function adminUpdateUser(admin: User, userId: string, patch: Partial<Pick<User, "name" | "role" | "status" | "company">>): void {
  requireAdmin(admin);
  mutate(d => {
    const u = d.users.find(x => x.id === userId); if (!u) throw new ApiError("NOT_FOUND", "User not found.");
    Object.assign(u, patch);
    log(d, admin.name, "admin", patch.status === "suspended" ? "user.suspended" : "user.updated", `${admin.name} updated ${u.name} (${u.email})`);
  });
}
export function adminDeleteUser(admin: User, userId: string): void {
  requireAdmin(admin);
  mutate(d => {
    const u = d.users.find(x => x.id === userId);
    d.users = d.users.filter(x => x.id !== userId);
    d.subscriptions = d.subscriptions.filter(s => s.userId !== userId);
    d.generations = d.generations.filter(g => g.userId !== userId);
    d.usage = d.usage.filter(x => x.userId !== userId);
    d.invoices = d.invoices.filter(i => i.userId !== userId);
    log(d, admin.name, "admin", "user.deleted", `${admin.name} deleted account ${u?.email || userId}`);
  });
}
export function adminResetUsage(admin: User, userId: string): void {
  requireAdmin(admin);
  mutate(d => {
    const month = monthKey(nowISO());
    const u = d.usage.find(x => x.userId === userId && x.month === month);
    if (u) { u.wordsUsed = 0; u.generationsUsed = 0; u.byDay = {}; u.byTool = {}; }
    const user = d.users.find(x => x.id === userId);
    log(d, admin.name, "admin", "usage.reset", `${admin.name} reset monthly usage for ${user?.email || userId}`);
  });
}

export function adminSavePlan(admin: User, plan: Plan): void {
  requireAdmin(admin);
  mutate(d => {
    const idx = d.plans.findIndex(p => p.id === plan.id);
    if (idx >= 0) d.plans[idx] = plan; else d.plans.push({ ...plan, id: "plan_" + uid() });
    log(d, admin.name, "admin", "plan.saved", `${admin.name} saved plan "${plan.name}" ($${plan.monthly}/mo)`);
  });
}
export function adminDeletePlan(admin: User, planId: string): void {
  requireAdmin(admin);
  mutate(d => {
    const inUse = d.subscriptions.some(s => s.planId === planId && ["active", "trialing", "past_due"].includes(s.status));
    if (inUse) throw new ApiError("IN_USE", "Plan has active subscribers — disable it instead of deleting.");
    d.plans = d.plans.filter(p => p.id !== planId || p.isTrial);
    log(d, admin.name, "admin", "plan.deleted", `${admin.name} deleted a plan`);
  });
}

export function adminSaveTool(admin: User, tool: Tool): void {
  requireAdmin(admin);
  mutate(d => {
    const idx = d.tools.findIndex(t => t.id === tool.id);
    if (idx >= 0) d.tools[idx] = tool;
    else d.tools.push({ ...tool, id: "tool_" + uid(), uses: 0, createdAt: nowISO() });
    log(d, admin.name, "admin", "tool.saved", `${admin.name} saved tool "${tool.name}"`);
  });
}
export function adminDeleteTool(admin: User, toolId: string): void {
  requireAdmin(admin);
  mutate(d => {
    const tool = d.tools.find(t => t.id === toolId);
    d.tools = d.tools.filter(t => t.id !== toolId);
    log(d, admin.name, "admin", "tool.deleted", `${admin.name} deleted tool "${tool?.name}"`);
  });
}

export function getSettings(): Settings { return getDb().settings; }
export function adminSaveSettings(admin: User, settings: Settings): void {
  requireAdmin(admin);
  mutate(d => {
    d.settings = settings;
    const trialPlan = d.plans.find(p => p.isTrial);
    if (trialPlan) { trialPlan.wordsLimit = settings.trial.words; trialPlan.generationsLimit = settings.trial.generations; }
    log(d, admin.name, "admin", "settings.updated", `${admin.name} updated system settings`);
  });
}
export function resetDemoData(): void {
  const db = freshDb(); saveDb(db);
}

/* ================= blog (public + admin) ================= */
const isLive = (p: Post) => p.status === "published" && new Date(p.publishAt).getTime() <= Date.now();
export const listPublishedPosts = (): Post[] =>
  getDb().posts.filter(isLive).sort((a, b) => b.publishAt.localeCompare(a.publishAt));
export const getPostBySlug = (slug: string): Post | null =>
  getDb().posts.find(p => p.slug === slug && isLive(p)) || null;
export const listPostCategories = (): string[] =>
  [...new Set(listPublishedPosts().map(p => p.category))];

export const adminListPosts = (admin: User | null): Post[] => {
  requireAdmin(admin);
  return getDb().posts.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};
export function adminSavePost(admin: User, post: Post): Post {
  requireAdmin(admin);
  if (!post.title.trim()) throw new ApiError("VALIDATION", "The post needs a title.");
  const slug = (post.slug || "").trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
  if (!slug) throw new ApiError("VALIDATION", "Enter a valid URL slug.");
  return mutate(d => {
    const clash = d.posts.find(p => p.slug === slug && p.id !== post.id);
    if (clash) throw new ApiError("VALIDATION", `The slug "${slug}" is already used by "${clash.title}".`);
    const clean: Post = {
      ...post, slug,
      title: post.title.trim().slice(0, 140),
      excerpt: post.excerpt.trim().slice(0, 220),
      category: post.category.trim() || "General",
      tags: post.tags.slice(0, 8).map(t => t.trim().toLowerCase()).filter(Boolean),
      body: post.body.slice(0, 60000),
      seo: {
        title: (post.seo.title || post.title).slice(0, 70),
        description: (post.seo.description || post.excerpt).slice(0, 160),
        canonical: post.seo.canonical.trim(),
      },
      updatedAt: nowISO(),
    };
    const idx = d.posts.findIndex(p => p.id === post.id);
    if (idx >= 0) d.posts[idx] = clean; else d.posts.unshift({ ...clean, id: "post_" + uid(), createdAt: nowISO() });
    log(d, admin.name, "admin", "post.saved", `${admin.name} saved blog post "${clean.title}" (${clean.status})`);
    return clean;
  });
}
export function adminDeletePost(admin: User, id: string): void {
  requireAdmin(admin);
  mutate(d => {
    const p = d.posts.find(x => x.id === id);
    d.posts = d.posts.filter(x => x.id !== id);
    log(d, admin.name, "admin", "post.deleted", `${admin.name} deleted blog post "${p?.title || id}"`);
  });
}

/* Sitemap: public pages + live posts only — never /app or /admin */
export function buildSitemap(): string {
  const d = getDb();
  const base = d.settings.seo.canonicalBase.replace(/\/$/, "");
  const urls = [
    { loc: `${base}/`, lastmod: nowISO().slice(0, 10), priority: "1.0" },
    { loc: `${base}/#/pricing`, lastmod: nowISO().slice(0, 10), priority: "0.8" },
    { loc: `${base}/#/blog`, lastmod: nowISO().slice(0, 10), priority: "0.9" },
    ...d.posts.filter(isLive).map(p => ({ loc: `${base}/#/blog/${p.slug}`, lastmod: p.updatedAt.slice(0, 10), priority: "0.7" })),
  ];
  const body = urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/* ================= in-editor assistant (server-enforced) ================= */
export async function runStudioAssist(user: User, action: AssistAction, text: string, tone = "professional"): Promise<{ text: string; words: number }> {
  if (user.status === "suspended") throw new ApiError("SUSPENDED", "This account is suspended. Contact support to restore access.");
  const access = getAccess(user);
  if (!access.plan || ["expired", "canceled", "past_due", "none"].includes(access.effective))
    throw new ApiError("NO_SUBSCRIPTION", "An active plan or trial is required to use the writing assistant.");
  const db = getDb();
  const month = monthKey(nowISO());
  const usage = db.usage.find(u => u.userId === user.id && u.month === month);
  const out = studioTransform(action, text.slice(0, 8000), tone, hashStr(user.id + action + Date.now()));
  const words = countWords(out);
  if (access.plan.generationsLimit !== -1 && (usage?.generationsUsed ?? 0) + 1 > access.plan.generationsLimit)
    throw new ApiError("GEN_LIMIT", "You've reached your monthly generation limit.");
  if (access.plan.wordsLimit !== -1 && (usage?.wordsUsed ?? 0) + words > access.plan.wordsLimit)
    throw new ApiError("WORD_LIMIT", "This action would exceed your monthly word limit.");
  const lastMinute = db.generations.filter(g => g.userId === user.id && Date.now() - new Date(g.createdAt).getTime() < 60000).length;
  if (lastMinute >= db.settings.usage.ratePerMinute)
    throw new ApiError("RATE_LIMITED", "Too many requests — please wait a few seconds between actions.");
  await sleep(320); // provider round-trip
  /* atomic usage write */
  mutate(d => {
    const m = monthKey(nowISO());
    let u = d.usage.find(x => x.userId === user.id && x.month === m);
    if (!u) { u = { userId: user.id, month: m, wordsUsed: 0, generationsUsed: 0, byDay: {}, byTool: {} }; d.usage.push(u); }
    u.wordsUsed += words; u.generationsUsed += 1;
    u.byDay[dayKey(nowISO())] = (u.byDay[dayKey(nowISO())] || 0) + words;
    u.byTool["studio-assist"] = (u.byTool["studio-assist"] || 0) + 1;
  });
  return { text: out, words };
}

/* ================= formatting helpers ================= */
export const fmtMoney = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n % 1 === 0 ? n : n.toFixed(2)}`;
export const fmtNum = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
export const fmtLimit = (n: number) => (n === -1 ? "Unlimited" : fmtNum(n));
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
