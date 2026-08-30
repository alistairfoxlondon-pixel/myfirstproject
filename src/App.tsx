import React, { Suspense, lazy, useEffect } from "react";
import { HashRouter, Route, Routes, useLocation, useParams, Link } from "react-router-dom";
import { CheckCircle2, Info, XCircle, X } from "lucide-react";
import { AppProvider, useApp } from "./lib/app";
import { Button, Spinner, cn } from "./components/ui";
import { PublicLayout } from "./components/site";
import Landing from "./pages/Landing";
import { LoginPage, RegisterPage, ForgotPage, PricingPage } from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import { ToolsPage, ToolPage } from "./pages/Tools";
import { DocumentsPage, StudioPage } from "./pages/Studio";
import IntegrationsPage from "./pages/Integrations";
import { HistoryPage, BillingPage, SettingsPage } from "./pages/Account";

/* Admin is code-split — it's only needed by administrators */
const AdminOverview = lazy(() => import("./pages/Admin").then(m => ({ default: m.AdminOverview })));
const AdminUsers = lazy(() => import("./pages/Admin").then(m => ({ default: m.AdminUsers })));
const AdminPlans = lazy(() => import("./pages/Admin").then(m => ({ default: m.AdminPlans })));
const AdminTools = lazy(() => import("./pages/Admin").then(m => ({ default: m.AdminTools })));
const AdminSettings = lazy(() => import("./pages/Admin").then(m => ({ default: m.AdminSettings })));

const TITLES: [string, string][] = [
  ["/app/studio", "Content Studio"],
  ["/app/tools", "AI Tools"],
  ["/app/history", "History"],
  ["/app/integrations", "Integrations"],
  ["/app/billing", "Billing"],
  ["/app/settings", "Settings"],
  ["/app", "Dashboard"],
  ["/admin", "Admin"],
  ["/pricing", "Pricing"],
  ["/login", "Sign in"],
  ["/register", "Create account"],
  ["/forgot", "Reset password"],
  ["", "ChatDeck — The AI writing studio for teams that ship"],
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/* Per-route document title + indexability (private areas stay out of search indexes) */
function PageMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const hit = TITLES.find(([p]) => (p === "" ? pathname === "/" : pathname.startsWith(p)));
    const base = hit ? hit[1] : "ChatDeck";
    document.title = hit && hit[0] === "" ? base : `${base} · ChatDeck`;
    const privateArea = pathname.startsWith("/app") || pathname.startsWith("/admin");
    let meta = document.querySelector<HTMLMetaElement>("meta[name=robots]");
    if (!meta) { meta = document.createElement("meta"); meta.name = "robots"; document.head.appendChild(meta); }
    meta.content = privateArea ? "noindex, nofollow" : "index, follow";
  }, [pathname]);
  return null;
}

function ToastHost() {
  const { toasts, dismissToast } = useApp();
  const icons = { success: <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />, error: <XCircle className="w-4.5 h-4.5 text-destructive" />, info: <Info className="w-4.5 h-4.5 text-muted-foreground" /> };
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className="animate-scale-in rounded-lg border border-border bg-popover text-popover-foreground shadow-xl px-4 py-3.5 flex items-start gap-3">
          <span className="mt-0.5 shrink-0">{icons[t.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold leading-tight">{t.title}</p>
            {t.message && <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-snug">{t.message}</p>}
          </div>
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss notification" className="p-1 -m-1 rounded-md hover:bg-accent text-muted-foreground transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function LazyFallback() {
  return <div className="min-h-[50vh] flex items-center justify-center"><Spinner className="w-6 h-6 text-muted-foreground" /></div>;
}

/* keyed by doc id so switching documents fully re-initializes the workspace */
function StudioRoute() {
  const { docId } = useParams();
  return <StudioPage key={docId || "new"} />;
}

function NotFound() {
  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-40 pb-24 text-center">
        <p className="font-mono text-[80px] sm:text-[120px] font-bold leading-none tracking-tighter text-foreground/10 select-none">404</p>
        <h1 className="font-display text-2xl font-extrabold tracking-tight -mt-6">This page wandered off</h1>
        <p className="text-[14.5px] text-muted-foreground mt-3 max-w-md mx-auto">The URL doesn't match anything in the workspace. Maybe it was deleted, or maybe it never existed.</p>
        <div className="flex justify-center gap-3 mt-8">
          <Link to="/"><Button>Back to home</Button></Link>
          <Link to="/app"><Button variant="outline">Open dashboard</Button></Link>
        </div>
      </div>
    </PublicLayout>
  );
}

function Shell() {
  const loc = useLocation();
  const adminRoute = loc.pathname.startsWith("/admin");
  return (
    <div className={cn(adminRoute && "bg-background")}>
      <ScrollToTop />
      <PageMeta />
      <Suspense fallback={<LazyFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot" element={<ForgotPage />} />
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/studio" element={<DocumentsPage />} />
          <Route path="/app/studio/:docId" element={<StudioRoute />} />
          <Route path="/app/tools" element={<ToolsPage />} />
          <Route path="/app/tools/:slug" element={<ToolPage />} />
          <Route path="/app/integrations" element={<IntegrationsPage />} />
          <Route path="/app/history" element={<HistoryPage />} />
          <Route path="/app/billing" element={<BillingPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/plans" element={<AdminPlans />} />
          <Route path="/admin/tools" element={<AdminTools />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ToastHost />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppProvider>
  );
}
