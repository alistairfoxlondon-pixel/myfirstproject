import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { User, getDb } from "./db";
import { AccessContext, currentUser, getAccess, getSettings, logout as svcLogout } from "./services";

/* ---------- toasts ---------- */
export interface Toast { id: number; kind: "success" | "error" | "info"; title: string; message?: string; }
let toastId = 0;

interface AppCtx {
  user: User | null;
  access: AccessContext | null;
  refresh: () => void;
  signOut: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  toasts: Toast[];
  toast: (kind: Toast["kind"], title: string, message?: string) => void;
  dismissToast: (id: number) => void;
  siteName: string;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => currentUser());
  const [version, setVersion] = useState(0);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const stored = localStorage.getItem("chatdeck.theme");
      if (stored === "dark" || stored === "light") return stored;
    } catch { /* noop */ }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try { localStorage.setItem("chatdeck.theme", theme); } catch { /* noop */ }
  }, [theme]);

  const refresh = useCallback(() => { setUser(currentUser()); setVersion(v => v + 1); }, []);

  const access = useMemo(() => {
    void version; void getDb();
    return user ? getAccess(user) : null;
  }, [user, version]);

  const toast = useCallback((kind: Toast["kind"], title: string, message?: string) => {
    const id = ++toastId;
    setToasts(t => [...t, { id, kind, title, message }]);
    window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

  const signOut = useCallback(() => { svcLogout(); setUser(null); }, []);

  const value: AppCtx = {
    user, access, refresh, signOut, theme,
    toggleTheme: () => setTheme(t => (t === "dark" ? "light" : "dark")),
    toasts, toast, dismissToast,
    siteName: getSettings().site.name,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

/* ---------- scroll reveal ---------- */
export function useReveal<T extends HTMLElement>(threshold = 0.12) {
  const ref = React.useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.classList.add("is-visible"); return; }
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } }),
      { threshold, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}
