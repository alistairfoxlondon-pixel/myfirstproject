import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, Link2, AlignLeft, AlignCenter,
  Undo2, Redo2, Code2, RemoveFormatting, Check, Minus,
} from "lucide-react";
import { Button, cn } from "./ui";
import { sanitizeHtml } from "../lib/content";

export interface EditorHandle {
  insertHtml(html: string, mode: "append" | "replace" | "cursor"): void;
  getHtml(): string;
  focus(): void;
  hasSelection(): boolean;
  getSelectionText(): string;
  replaceSelectionHtml(html: string, after?: boolean): void;
}

interface EditorProps {
  initialHtml: string;
  onChange(html: string): void;
  onStats(stats: { words: number; chars: number; readMin: number }): void;
  placeholder?: string;
  renderLinkPopover?: (setUrl: (url: string) => void) => React.ReactNode; // suggestion content inside the link popover
  onSelect?: (text: string, rect: DOMRect | null) => void; // selection changed (for the AI selection toolbar)
}

const TBtn = ({ on, title, onClick, children }: { on?: boolean; title: string; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" title={title} aria-label={title} aria-pressed={on}
    onMouseDown={e => e.preventDefault()}
    onClick={onClick}
    className={cn("w-8 h-8 rounded-md inline-flex items-center justify-center transition-colors",
      on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-accent")}>
    {children}
  </button>
);
const Sep = () => <span className="w-px h-5 bg-border mx-1 shrink-0" aria-hidden />;

export const RichEditor = forwardRef<EditorHandle, EditorProps>(function RichEditor({ initialHtml, onChange, onStats, placeholder, renderLinkPopover, onSelect }, ref) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [source, setSource] = useState(false);
  const [srcText, setSrcText] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [block, setBlock] = useState("p");
  const [stats, setStats] = useState({ words: 0, chars: 0, readMin: 0 });

  /* mount once — never let React re-render the contentEditable body */
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.innerHTML = sanitizeHtml(initialHtml);
    emit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const html = el.innerHTML;
    onChange(html);
    const text = (el.innerText || "").replace(/\s+/g, " ").trim();
    const words = (text.match(/\S+/g) || []).length;
    const s = { words, chars: text.length, readMin: Math.max(words > 0 ? 1 : 0, Math.round(words / 220)) };
    setStats(s);
    onStats(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd: string, val?: string) => {
    bodyRef.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
    detectBlock();
  };

  const detectBlock = () => {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let n: Node | null = sel.anchorNode;
    while (n && n !== bodyRef.current) {
      if (n instanceof HTMLElement && ["H1", "H2", "H3", "BLOCKQUOTE"].includes(n.tagName)) { setBlock(n.tagName.toLowerCase()); return; }
      n = n.parentNode;
    }
    setBlock("p");
  };

  const saveSelection = () => {
    const sel = document.getSelection();
    if (sel && sel.rangeCount > 0 && bodyRef.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    if (!savedRange.current) return;
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(savedRange.current);
  };

  const emitSelection = () => {
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0 || !bodyRef.current?.contains(sel.anchorNode)) return;
    const text = sel.toString().trim();
    if (text.length < 3) { onSelect?.("", null); return; }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    savedRange.current = range.cloneRange();
    onSelect?.(text, rect.width > 0 ? rect : null);
  };

  useImperativeHandle(ref, () => ({
    getHtml: () => bodyRef.current?.innerHTML || "",
    focus: () => bodyRef.current?.focus(),
    hasSelection: () => !!savedRange.current && !savedRange.current.collapsed,
    getSelectionText: () => savedRange.current?.toString().trim() || "",
    replaceSelectionHtml(html: string, after = false) {
      bodyRef.current?.focus();
      if (savedRange.current) {
        const sel = document.getSelection();
        sel?.removeAllRanges();
        const r = savedRange.current.cloneRange();
        if (after) r.collapse(false); // insert after the selection instead of replacing it
        sel?.addRange(r);
      }
      document.execCommand("insertHTML", false, sanitizeHtml(html));
      savedRange.current = null;
      emit();
    },
    insertHtml(html, mode) {
      const el = bodyRef.current;
      if (!el) return;
      const clean = sanitizeHtml(html);
      if (mode === "replace") { el.innerHTML = clean; }
      else if (mode === "cursor") {
        el.focus();
        restoreSelection();
        document.execCommand("insertHTML", false, clean);
      } else {
        el.innerHTML = (el.innerHTML ? el.innerHTML.replace(/<p><br><\/p>$/, "") : "") + clean;
      }
      emit();
    },
  }));

  const openLink = () => {
    saveSelection();
    setLinkUrl("");
    setLinkOpen(o => !o);
  };
  const applyLink = () => {
    const url = linkUrl.trim();
    setLinkOpen(false);
    if (!url) return;
    bodyRef.current?.focus();
    restoreSelection();
    document.execCommand("createLink", false, url);
    /* harden the created anchors */
    bodyRef.current?.querySelectorAll("a").forEach(a => { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); });
    emit();
  };

  const toggleSource = () => {
    if (!source) { setSrcText(bodyRef.current?.innerHTML || ""); setSource(true); }
    else {
      if (bodyRef.current) bodyRef.current.innerHTML = sanitizeHtml(srcText);
      setSource(false);
      emit();
    }
  };

  /* keyboard shortcuts */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); exec("bold"); }
    else if (k === "i") { e.preventDefault(); exec("italic"); }
    else if (k === "u") { e.preventDefault(); exec("underline"); }
  };

  const blockBtn = (tag: string, label: string) => (
    <TBtn on={block === tag} title={label} onClick={() => exec("formatBlock", tag === "p" ? "p" : `<${tag}>`)}>
      <span className={cn("font-semibold", tag === "h1" ? "text-[13px]" : tag === "h2" ? "text-[12px]" : tag === "h3" ? "text-[11px]" : "text-[12px]")}>
        {tag === "p" ? "¶" : tag.toUpperCase()}
      </span>
    </TBtn>
  );

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/40 overflow-x-auto scroll-slim" role="toolbar" aria-label="Formatting">
        {blockBtn("p", "Paragraph")}{blockBtn("h1", "Heading 1")}{blockBtn("h2", "Heading 2")}{blockBtn("h3", "Heading 3")}
        <Sep />
        <TBtn title="Blockquote" onClick={() => exec("formatBlock", "<blockquote>")}><Quote className="w-4 h-4" /></TBtn>
        <Sep />
        <TBtn title="Bold (Ctrl+B)" onClick={() => exec("bold")}><Bold className="w-4 h-4" /></TBtn>
        <TBtn title="Italic (Ctrl+I)" onClick={() => exec("italic")}><Italic className="w-4 h-4" /></TBtn>
        <TBtn title="Underline (Ctrl+U)" onClick={() => exec("underline")}><Underline className="w-4 h-4" /></TBtn>
        <TBtn title="Strikethrough" onClick={() => exec("strikeThrough")}><Strikethrough className="w-4 h-4" /></TBtn>
        <Sep />
        <TBtn title="Bullet list" onClick={() => exec("insertUnorderedList")}><List className="w-4 h-4" /></TBtn>
        <TBtn title="Numbered list" onClick={() => exec("insertOrderedList")}><ListOrdered className="w-4 h-4" /></TBtn>
        <Sep />
        <TBtn on={linkOpen} title="Insert link" onClick={openLink}><Link2 className="w-4 h-4" /></TBtn>
        <TBtn title="Align left" onClick={() => exec("justifyLeft")}><AlignLeft className="w-4 h-4" /></TBtn>
        <TBtn title="Align center" onClick={() => exec("justifyCenter")}><AlignCenter className="w-4 h-4" /></TBtn>
        <Sep />
        <TBtn title="Horizontal rule" onClick={() => exec("insertHorizontalRule")}><Minus className="w-4 h-4" /></TBtn>
        <TBtn title="Clear formatting" onClick={() => { exec("removeFormat"); exec("formatBlock", "p"); }}><RemoveFormatting className="w-4 h-4" /></TBtn>
        <span className="flex-1" />
        <TBtn title="Undo" onClick={() => exec("undo")}><Undo2 className="w-4 h-4" /></TBtn>
        <TBtn title="Redo" onClick={() => exec("redo")}><Redo2 className="w-4 h-4" /></TBtn>
        <Sep />
        <TBtn on={source} title="Edit HTML source" onClick={toggleSource}><Code2 className="w-4 h-4" /></TBtn>
      </div>

      {/* link popover */}
      {linkOpen && (
        <div className="px-3 py-3 border-b border-border bg-popover animate-fade-in space-y-2.5">
          <div className="flex gap-2">
            <input autoFocus value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://example.com" aria-label="Link URL"
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") setLinkOpen(false); }}
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/60" />
            <Button size="sm" className="h-9" onClick={applyLink}><Check className="w-3.5 h-3.5" /> Apply</Button>
          </div>
          {renderLinkPopover?.(u => setLinkUrl(u))}
          <p className="text-[11px] text-muted-foreground">Tip: select text first, then apply. Pasting keeps formatting safe — scripts are stripped.</p>
        </div>
      )}

      {/* body */}
      {source ? (
        <textarea value={srcText} onChange={e => setSrcText(e.target.value)} spellCheck={false} aria-label="HTML source"
          className="w-full min-h-[420px] p-4 font-mono text-[12px] leading-relaxed bg-background text-foreground focus:outline-none resize-y" />
      ) : (
        <div
          ref={bodyRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Document editor"
          data-placeholder={placeholder || "Start writing, or generate a draft with the assistant…"}
          className="prose-doc min-h-[420px] max-h-[62vh] overflow-y-auto studio-scroll px-5 sm:px-8 py-6 focus:outline-none"
          onInput={emit}
          onKeyUp={e => { detectBlock(); if (e.key.startsWith("Arrow") || e.key === "Shift") emitSelection(); }}
          onMouseUp={() => { detectBlock(); saveSelection(); emitSelection(); }}
          onKeyDown={e => { onKeyDown(e); }}
          onPaste={e => {
            e.preventDefault();
            const html = e.clipboardData.getData("text/html");
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertHTML", false, html ? sanitizeHtml(html) : text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>"));
            emit();
          }}
        />
      )}

      {/* status bar */}
      <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2 border-t border-border bg-muted/30 text-[11.5px] text-muted-foreground font-mono tabular overflow-x-auto whitespace-nowrap">
        <span>{stats.words.toLocaleString()} words</span>
        <span>{stats.chars.toLocaleString()} chars</span>
        <span>~{stats.readMin} min read</span>
        <span className="hidden sm:inline">{source ? "HTML source" : "Rich text"}</span>
      </div>
    </div>
  );
});
