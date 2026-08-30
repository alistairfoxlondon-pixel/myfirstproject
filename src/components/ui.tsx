import React, { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { useReveal } from "../lib/app";

export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/* ---------- Button ---------- */
type BtnVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
export function Button({
  variant = "default", size = "md", loading, className = "", children, disabled, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const variants: Record<BtnVariant, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-white hover:bg-destructive/90",
  };
  const sizes = { sm: "h-8 px-3 text-[13px] gap-1.5", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-6 text-[15px] gap-2" };
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 select-none",
        "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        variants[variant], sizes[size], className,
      )}
      {...rest}
    >
      {loading && <Spinner className="w-4 h-4" />}
      {children}
    </button>
  );
}
export function Spinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Badge ---------- */
export function Badge({ tone = "default", className = "", children }: { tone?: "default" | "muted" | "success" | "warn" | "danger" | "outline"; className?: string; children: React.ReactNode }) {
  const tones = {
    default: "bg-primary text-primary-foreground",
    muted: "bg-muted text-muted-foreground",
    success: "bg-emerald-600/12 text-emerald-700 dark:text-emerald-400 border border-emerald-600/20",
    warn: "bg-amber-500/12 text-amber-700 dark:text-amber-400 border border-amber-500/25",
    danger: "bg-red-600/12 text-red-700 dark:text-red-400 border border-red-600/20",
    outline: "border border-border text-foreground",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium tracking-wide", tones[tone], className)}>{children}</span>;
}

/* ---------- Card ---------- */
export function Card({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn("rounded-lg border border-border bg-card text-card-foreground", rest.onClick && "cursor-pointer", className)}>
      {children}
    </div>
  );
}

/* ---------- Form ---------- */
export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-[13px] font-medium mb-1.5">
      {children}
      {hint && <span className="ml-2 text-muted-foreground font-normal">{hint}</span>}
    </label>
  );
}
export const inputCls = "w-full h-10 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground/70 transition-shadow focus:outline-none focus:ring-2 focus:ring-ring/60 focus:border-foreground/30";
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "h-auto min-h-[90px] py-2.5 leading-relaxed resize-y", props.className)} />;
}
export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] | string[] }) {
  const opts = options.map(o => (typeof o === "string" ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1) } : o));
  return (
    <select {...props} className={cn(inputCls, "appearance-none bg-no-repeat pr-8 cursor-pointer", props.className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundPosition: "right 10px center" }}>
      {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
export function Field({ label, error, required, children, help }: { label: string; error?: string; required?: boolean; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      {children}
      {help && !error && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "bg-primary" : "bg-muted border border-border", disabled && "opacity-50 pointer-events-none")}>
      <span className={cn("inline-block h-4 w-4 rounded-full transition-transform duration-200", checked ? "translate-x-[21px] bg-primary-foreground" : "translate-x-[3px] bg-muted-foreground/60")} />
    </button>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    /* move focus into the dialog; restore on close */
    requestAnimationFrame(() => {
      const el = panelRef.current;
      if (!el) return;
      const focusable = el.querySelector<HTMLElement>("input, select, textarea, button:not([aria-label='Close'])");
      (focusable || el).focus();
    });
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} className={cn("relative w-full bg-card border border-border shadow-2xl animate-scale-in rounded-t-xl sm:rounded-lg max-h-[92vh] flex flex-col focus:outline-none", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <h3 className="font-semibold text-[15px]">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent transition-colors" aria-label="Close"><X className="w-4 h-4" /></button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto scroll-slim">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border flex justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Tabs ---------- */
export function Tabs({ items, value, onChange, className = "" }: { items: { key: string; label: React.ReactNode; badge?: React.ReactNode }[]; value: string; onChange: (k: string) => void; className?: string }) {
  return (
    <div className={cn("flex gap-1 border-b border-border overflow-x-auto scroll-slim", className)} role="tablist">
      {items.map(it => (
        <button key={it.key} role="tab" aria-selected={value === it.key} onClick={() => onChange(it.key)}
          className={cn("px-3.5 py-2.5 text-[13.5px] font-medium whitespace-nowrap border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5",
            value === it.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {it.label}{it.badge}
        </button>
      ))}
    </div>
  );
}

/* ---------- Progress ---------- */
export function Progress({ value, max, className = "", tone }: { value: number; max: number; className?: string; tone?: "auto" | "default" }) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  const danger = tone !== "default" && pct > 88;
  const warn = tone !== "default" && pct > 70 && !danger;
  return (
    <div className={cn("h-2 rounded-full bg-muted overflow-hidden", className)}>
      <div className={cn("h-full rounded-full transition-all duration-700 ease-out", danger ? "bg-destructive" : warn ? "bg-amber-500" : "bg-foreground")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {icon && <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="font-semibold text-[15px]">{title}</h3>
      {body && <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Reveal ---------- */
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: { children: React.ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" }) {
  const ref = useReveal<HTMLDivElement>();
  return <Tag ref={ref as never} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>{children}</Tag>;
}

/* ---------- CountUp ---------- */
export function CountUp({ to, prefix = "", suffix = "", className = "" }: { to: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setVal(to); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const dur = 1100;
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref} className={cn("tabular", className)}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

/* ---------- Copy ---------- */
export function CopyBtn({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "sm" | "md" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button variant="outline" size={size} onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch {
        const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); ta.remove();
      }
      setCopied(true); setTimeout(() => setCopied(false), 1600);
    }}>
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/* ---------- Charts (hand-rolled SVG) ---------- */
export function BarChart({ data, height = 120, className = "" }: { data: { label: string; value: number }[]; height?: number; className?: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const bw = 100 / data.length;
  return (
    <div className={className}>
      <svg viewBox={`0 0 100 ${height / 2}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 2 - 6);
          return (
            <g key={i}>
              <rect x={i * bw + bw * 0.18} y={height / 2 - h} width={bw * 0.64} height={Math.max(1, h)} rx={1}
                className="fill-foreground/80 hover:fill-foreground transition-colors" />
              <title>{d.label}: {d.value}</title>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-mono">
        <span>{data[0]?.label}</span><span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export function AreaChart({ data, height = 140, className = "", format }: { data: { label: string; value: number }[]; height?: number; className?: string; format?: (n: number) => string }) {
  const gid = useId().replace(/[:]/g, "");
  const w = 300, h = 100;
  const max = Math.max(1, ...data.map(d => d.value));
  const pts = data.map((d, i) => [ (i / Math.max(1, data.length - 1)) * w, h - (d.value / max) * (h - 12) - 4 ]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(((e.clientX - r.left) / r.width) * (data.length - 1)));
        }}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gid})`} />
        <path d={line} fill="none" stroke="var(--foreground)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover !== null && pts[hover] && (
          <g>
            <line x1={pts[hover][0]} y1="0" x2={pts[hover][0]} y2={h} stroke="var(--foreground)" strokeOpacity="0.25" strokeDasharray="3 3" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r="3.5" fill="var(--foreground)" />
          </g>
        )}
      </svg>
      {hover !== null && data[hover] && (
        <div className="absolute top-1 right-1 text-[11px] font-mono bg-popover border border-border rounded-md px-2 py-1 shadow-sm pointer-events-none">
          {data[hover].label}: <strong>{format ? format(data[hover].value) : data[hover].value}</strong>
        </div>
      )}
    </div>
  );
}

export function Donut({ segments, size = 140, thickness = 16, centerLabel, centerSub }: { segments: { value: number; color: string; label: string }[]; size?: number; thickness?: number; centerLabel?: string; centerSub?: string }) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const dash = `${frac * C} ${C}`;
          const off = -acc * C;
          acc += frac;
          return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={dash} strokeDashoffset={off} strokeLinecap="butt" className="transition-all duration-700" />;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-bold tracking-tight tabular">{centerLabel}</span>
        {centerSub && <span className="text-[10.5px] text-muted-foreground mt-0.5">{centerSub}</span>}
      </div>
    </div>
  );
}

/* ---------- Rich text (markdown-lite) ---------- */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const inline = (s: string, key: number) => {
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean);
    return <React.Fragment key={key}>{parts.map((p, i) =>
      p.startsWith("**") ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
        : p.startsWith("`") ? <code key={i} className="font-mono text-[0.85em] bg-muted border border-border rounded px-1 py-0.5">{p.slice(1, -1)}</code>
        : p.startsWith("*") && p.endsWith("*") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em> : <React.Fragment key={i}>{p}</React.Fragment>)}</React.Fragment>;
  };
  return (
    <div className={cn("text-[13.5px] leading-[1.75] space-y-2.5", className)}>
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        if (line.startsWith("# ")) return <h1 key={i} className="text-lg font-bold tracking-tight mt-1">{inline(line.slice(2), i)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-[15px] font-bold tracking-tight mt-4 first:mt-0">{inline(line.slice(3), i)}</h2>;
        if (line.startsWith("### ")) return <h3 key={i} className="text-[13.5px] font-semibold mt-3">{inline(line.slice(4), i)}</h3>;
        if (line.startsWith("---")) return <hr key={i} className="border-border my-3" />;
        if (line.startsWith("| ")) {
          const cells = line.split("|").filter(c => c.trim()).map(c => c.trim());
          if (cells.every(c => /^-+$/.test(c))) return null;
          return <div key={i} className="font-mono text-xs grid grid-cols-[1.6fr_0.6fr_0.6fr_0.8fr] gap-px">{cells.map((c, j) => <span key={j} className="truncate">{c}</span>)}</div>;
        }
        if (/^(\d+\.|-|→|✓|•) /.test(line)) return <p key={i} className="pl-1">{inline(line, i)}</p>;
        return <p key={i}>{inline(line, i)}</p>;
      })}
    </div>
  );
}
