import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Menu, Moon, Sun, X, Twitter, Github, Linkedin, Mail } from "lucide-react";
import { Logo } from "./icons";
import { Button, cn } from "./ui";
import { useApp } from "../lib/app";
import { getSettings } from "../lib/services";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useApp();
  return (
    <button onClick={toggleTheme} aria-label="Toggle theme"
      className={cn("relative w-9 h-9 rounded-lg border border-border bg-card hover:bg-accent transition-all duration-300 flex items-center justify-center overflow-hidden", className)}>
      <Sun className={cn("w-4 h-4 absolute transition-all duration-500", theme === "dark" ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100")} />
      <Moon className={cn("w-4 h-4 absolute transition-all duration-500", theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50")} />
    </button>
  );
}

export function Navbar() {
  const { user, access } = useApp();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const settings = getSettings();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => setOpen(false), [loc.pathname]);

  const links = [
    { href: "/#tools", label: "Tools" },
    { href: "/#features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/#faq", label: "FAQ" },
  ];
  const goAnchor = (href: string) => {
    setOpen(false);
    if (href.startsWith("/#")) {
      if (loc.pathname === "/") {
        document.querySelector(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      nav(href); // → route "/" with hash; Landing scrolls to the section
      return;
    }
    nav(href);
  };

  return (
    <header className={cn("fixed top-0 inset-x-0 z-50 transition-all duration-300", scrolled ? "bg-background/85 backdrop-blur-md border-b border-border shadow-sm" : "bg-transparent border-b border-transparent")}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="shrink-0" aria-label="ChatDeck home"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {links.map(l => (
            <button key={l.label} onClick={() => goAnchor(l.href)}
              className="px-3.5 py-2 text-[13.5px] font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
              {l.label}
            </button>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-2.5">
          <ThemeToggle />
          {user ? (
            <Button size="sm" onClick={() => nav(user.role === "admin" ? "/admin" : "/app")}>
              Open dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => nav("/login")}>Sign in</Button>
              <Button size="sm" onClick={() => nav("/register")}>Start free trial</Button>
            </>
          )}
        </div>
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button onClick={() => setOpen(o => !o)} className="w-9 h-9 rounded-lg border border-border flex items-center justify-center" aria-label="Menu">
            {open ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md animate-fade-in">
          <div className="px-4 py-4 flex flex-col gap-1">
            {links.map(l => (
              <button key={l.label} onClick={() => goAnchor(l.href)} className="text-left px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-accent transition-colors">{l.label}</button>
            ))}
            <div className="h-px bg-border my-2" />
            {user ? (
              <Button onClick={() => nav(user.role === "admin" ? "/admin" : "/app")}>Open dashboard <ArrowRight className="w-4 h-4" /></Button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => nav("/login")}>Sign in</Button>
                <Button onClick={() => nav("/register")}>Start free trial</Button>
              </div>
            )}
            {access && user && (
              <p className="text-xs text-muted-foreground text-center mt-2">Signed in as {user.email}</p>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const s = getSettings().site;
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div className="col-span-2 md:col-span-1">
            <Logo />
            <p className="text-[13px] text-muted-foreground leading-relaxed mt-4 max-w-[260px]">{s.description}</p>
            <div className="flex items-center gap-2 mt-5">
              <a href={s.twitter} target="_blank" rel="noreferrer" aria-label="Twitter" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><Twitter className="w-3.5 h-3.5" /></a>
              <a href={s.github} target="_blank" rel="noreferrer" aria-label="GitHub" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><Github className="w-3.5 h-3.5" /></a>
              <a href={s.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><Linkedin className="w-3.5 h-3.5" /></a>
              <a href={`mailto:${s.supportEmail}`} aria-label="Email" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><Mail className="w-3.5 h-3.5" /></a>
            </div>
          </div>
          {[
            { h: "Product", links: [["AI tools", "/#tools"], ["Pricing", "/pricing"], ["Dashboard", "/app"], ["Start free trial", "/register"]] },
            { h: "Company", links: [["About", "/#features"], ["How it works", "/#how"], ["Testimonials", "/#testimonials"], ["FAQ", "/#faq"]] },
            { h: "Support", links: [["Contact", `mailto:${s.supportEmail}`], ["Sign in", "/login"], ["Reset password", "/forgot"], ["Status", "/#faq"]] },
          ].map(col => (
            <div key={col.h}>
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-3.5">{col.h}</h4>
              <ul className="space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("mailto") ? (
                      <a href={href} className="text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">{label}</a>
                    ) : (
                      <Link to={href} className="text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">{label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {s.name} Inc. All rights reserved.</p>
          <p className="text-xs text-muted-foreground font-mono">support@chatdeck.ai · v2.4.1</p>
        </div>
      </div>
    </footer>
  );
}

export function LogoMarquee() {
  const names = ["Northwind", "Driftline", "Brightloop", "Fjordlab", "Atlas Growth", "Sahel Media", "Okafor Studio", "Lumen&Co", "Vertex Labs", "Halyard"];
  const row = [...names, ...names];
  return (
    <div className="marquee-mask overflow-hidden py-2" data-marquee>
      <div className="animate-logo-scroll flex items-center w-max marquee-track" style={{ gap: "3.5rem" }}>
        {row.map((n, i) => (
          <span key={i} className="text-[15px] font-semibold tracking-tight text-muted-foreground/60 whitespace-nowrap flex items-center gap-2 select-none">
            <svg width="14" height="14" viewBox="0 0 14 14" className="opacity-50"><rect width="14" height="14" rx="3.5" fill="currentColor" opacity="0.55" /></svg>
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SectionHead({ eyebrow, title, sub, align = "center" }: { eyebrow?: string; title: React.ReactNode; sub?: string; align?: "center" | "left" }) {
  return (
    <div className={cn("max-w-2xl mb-10 md:mb-14", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className="font-mono text-[11.5px] uppercase tracking-[0.18em] text-muted-foreground mb-3">{eyebrow}</p>}
      <h2 className="font-display text-[26px] sm:text-[32px] font-bold tracking-tight leading-[1.15]">{title}</h2>
      {sub && <p className="text-[15px] text-muted-foreground leading-relaxed mt-3.5">{sub}</p>}
    </div>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
