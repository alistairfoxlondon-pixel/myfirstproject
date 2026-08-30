import {
  PenLine, FileText, BookOpen, RefreshCw, SpellCheck, Minimize2,
  Type, Heading1, Tag, AlignLeft, Search, Package, Megaphone, Mail, Target, DoorOpen,
  Flag, HelpCircle, ListTree, GitBranch, SlidersHorizontal, Lightbulb, Newspaper, Clapperboard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function Logo({ size = 28, withWord = true, className = "" }: { size?: number; withWord?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-foreground" />
        <path d="M9 11.5A3.5 3.5 0 0 1 12.5 8h7A3.5 3.5 0 0 1 23 11.5v6a3.5 3.5 0 0 1-3.5 3.5H15l-4.2 3.4c-.66.53-1.8.06-1.8-.8V11.5Z"
          fill="none" stroke="var(--background)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12.5 13.5h7M12.5 16.5h4.5" stroke="var(--background)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {withWord && (
        <span className="font-display text-[17px] font-bold tracking-tight leading-none">
          Chat<span className="opacity-55">Deck</span>
        </span>
      )}
    </span>
  );
}

const MAP: Record<string, LucideIcon> = {
  pen: PenLine, fileText: FileText, notebook: BookOpen, refresh: RefreshCw,
  paragraph: Type, sparkles: SpellCheck, spell: SpellCheck, compress: Minimize2,
  type: Type, heading: Heading1, tag: Tag, alignLeft: AlignLeft, search: Search,
  package: Package, megaphone: Megaphone, mail: Mail, target: Target, doorOpen: DoorOpen,
  flag: Flag, helpCircle: HelpCircle, listTree: ListTree, gitBranch: GitBranch,
  sliders: SlidersHorizontal, lightbulb: Lightbulb, newspaper: Newspaper, clapperboard: Clapperboard,
};

export function ToolIcon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  const Cmp = MAP[name] || PenLine;
  return <Cmp className={className} strokeWidth={1.8} />;
}

export const CATEGORY_META: Record<string, { label: string; chip: string }> = {
  writing: { label: "Writing", chip: "bg-chart-2/15 text-chart-2" },
  content: { label: "Content", chip: "bg-chart-3/15 text-chart-3" },
  seo: { label: "SEO", chip: "bg-chart-4/15 text-chart-4" },
  marketing: { label: "Marketing", chip: "bg-chart-5/15 text-chart-5" },
  productivity: { label: "Productivity", chip: "bg-foreground/10 text-foreground" },
};
