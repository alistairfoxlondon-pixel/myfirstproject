import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Globe, Ghost, PenLine, LayoutGrid, Plug, Unplug, Activity, CheckCircle2, XCircle, ShieldCheck, Loader2, FileText, ExternalLink } from "lucide-react";
import AppShell from "./AppShell";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, cn } from "../components/ui";
import { useApp } from "../lib/app";
import {
  CONNECTORS, Connector, listIntegrations, connectIntegration, disconnectIntegration,
  testIntegration, listPublishLogs,
} from "../lib/content";
import { fmtDateTime } from "../lib/services";

const ICONS: Record<string, typeof Globe> = { globe: Globe, ghost: Ghost, pen: PenLine, layout: LayoutGrid };

export default function IntegrationsPage() {
  const { user, toast, refresh } = useApp();
  const [connecting, setConnecting] = useState<Connector | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState<string | null>(null);
  const [showPayload, setShowPayload] = useState<string | null>(null);
  const [, bump] = useState(0);

  if (!user) return null;
  const connected = listIntegrations(user.id);
  const logs = listPublishLogs(user.id).slice(0, 8);

  const openConnect = (c: Connector) => {
    const existing = connected.find(i => i.connector === c.id);
    setForm(existing ? { ...existing.masked } : Object.fromEntries(c.fields.map(f => [f.key, ""])));
    setErrs({}); setTestResult(null);
    setConnecting(c);
  };
  const save = () => {
    if (!connecting) return;
    setBusy(true);
    setTimeout(() => {
      try {
        connectIntegration(user.id, connecting.id, form);
        toast("success", `${connecting.name} connected`, "Credentials are stored encrypted in your workspace datastore.");
        setConnecting(null); bump(x => x + 1); refresh();
      } catch (ex: unknown) {
        const msg = (ex as Error).message;
        const fieldErr = connecting.fields.find(f => msg.includes(f.label));
        setErrs(fieldErr ? { [fieldErr.key]: msg } : { _: msg });
      }
      setBusy(false);
    }, 350);
  };
  const runTest = async (id: string) => {
    setTesting(id); setTestResult(null);
    try { setTestResult(await testIntegration(user.id, id)); }
    catch (ex: unknown) { setTestResult({ ok: false, message: (ex as Error).message }); }
    setTesting(null);
  };

  const existingFor = (c: Connector) => connected.find(i => i.connector === c.id);

  return (
    <AppShell title="Publishing integrations" sub="Connect your platforms, then publish from the Content Studio">
      <div className="grid sm:grid-cols-2 gap-3.5">
        {CONNECTORS.map(c => {
          const Icon = ICONS[c.icon] || Globe;
          const ex = existingFor(c);
          return (
            <Card key={c.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between">
                <span className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Icon className="w-5 h-5" strokeWidth={1.8} /></span>
                {ex ? <Badge tone="success"><CheckCircle2 className="w-3 h-3" /> Connected</Badge> : <Badge tone="muted">Not connected</Badge>}
              </div>
              <h3 className="font-display font-bold text-[15.5px] tracking-tight mt-3">{c.name}</h3>
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed flex-1">{c.blurb}</p>
              {ex && (
                <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2.5 space-y-1">
                  {c.fields.filter(f => f.type !== "secret").map(f => (
                    <p key={f.key} className="text-[12px] font-mono flex justify-between gap-3"><span className="text-muted-foreground">{f.label}</span><span className="truncate">{ex.masked[f.key]}</span></p>
                  ))}
                  <p className="text-[12px] font-mono flex justify-between gap-3"><span className="text-muted-foreground">Credentials</span><span>••••••••••</span></p>
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <Button variant={ex ? "outline" : "default"} size="sm" className="flex-1" onClick={() => openConnect(c)}>
                  <Plug className="w-3.5 h-3.5" /> {ex ? "Update credentials" : "Connect"}
                </Button>
                {ex && <>
                  <Button variant="outline" size="sm" onClick={() => runTest(ex.id)} loading={testing === ex.id} aria-label={`Test ${c.name} connection`}>Test</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmOff(ex.id)} aria-label={`Disconnect ${c.name}`} className="text-muted-foreground hover:text-destructive"><Unplug className="w-3.5 h-3.5" /></Button>
                </>}
              </div>
              {testing === ex?.id && <p className="text-[11.5px] text-muted-foreground mt-2 font-mono">Checking endpoint…</p>}
              {ex && testResult && testing === null && (
                <p className={cn("text-[12px] mt-2 leading-snug flex items-start gap-1.5", testResult.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
                  {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-px" /> : <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" />}
                  {testResult.message}
                </p>
              )}
              <p className="text-[10.5px] text-muted-foreground font-mono mt-3 pt-3 border-t border-border">{c.docs}</p>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 p-4 flex items-start gap-3">
        <ShieldCheck className="w-4.5 h-4.5 shrink-0 mt-0.5 text-muted-foreground" />
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          Credentials are <strong className="text-foreground">obfuscated at rest in this preview datastore</strong> and masked everywhere in the UI. In the production Laravel build they are encrypted server-side with Laravel Crypt, never returned to the browser, and requests are signed per-platform (e.g. Ghost JWT, WordPress application passwords). Publishing always creates a <strong className="text-foreground">draft</strong> on the target first — nothing goes live without your review.
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-muted-foreground" /><h2 className="font-display font-bold text-[15px] tracking-tight">Publish activity</h2></div>
        {logs.length === 0 ? (
          <EmptyState icon={<FileText className="w-5 h-5" />} title="Nothing published yet"
            body="Open a document in the Content Studio, pick a connected platform, and publish it as a draft."
            action={<Link to="/app/studio"><Button variant="outline" size="sm">Open Content Studio <ExternalLink className="w-3.5 h-3.5" /></Button></Link>} />
        ) : (
          <ul className="space-y-2.5">
            {logs.map(l => (
              <li key={l.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-[13px] flex-wrap">
                  {l.status === "sent" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                  <span className="font-semibold">{l.docTitle}</span>
                  <span className="text-muted-foreground">→ {CONNECTORS.find(c => c.id === l.connector)?.name}</span>
                  <span className="ml-auto font-mono text-[10.5px] text-muted-foreground">{fmtDateTime(l.createdAt)}</span>
                </div>
                <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-snug">{l.message}</p>
                <button className="text-[11.5px] font-medium underline underline-offset-2 mt-1.5 text-muted-foreground hover:text-foreground" onClick={() => setShowPayload(showPayload === l.id ? null : l.id)}>
                  {showPayload === l.id ? "Hide API payload" : "View API payload"}
                </button>
                {showPayload === l.id && <pre className="mt-2 text-[10.5px] font-mono bg-muted rounded-md p-2.5 overflow-x-auto max-h-44 scroll-slim whitespace-pre-wrap break-all">{l.payload}</pre>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* connect modal */}
      <Modal open={!!connecting} onClose={() => setConnecting(null)} title={connecting ? `Connect ${connecting.name}` : ""}
        footer={<>
          <Button variant="outline" onClick={() => setConnecting(null)}>Cancel</Button>
          <Button onClick={save} loading={busy}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save connection</Button>
        </>}>
        {connecting && (
          <div className="space-y-4">
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">{connecting.blurb} <span className="font-mono text-[11px]">{connecting.docs}</span></p>
            {errs._ && <div className="rounded-lg border border-destructive/30 bg-destructive/8 text-destructive text-[13px] px-3.5 py-2.5">{errs._}</div>}
            {connecting.fields.map(f => (
              <Field key={f.key} label={f.label} required error={errs[f.key]} help={f.help}>
                <Input type={f.type === "secret" ? "password" : f.type === "url" ? "url" : "text"} value={form[f.key] || ""}
                  onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  autoComplete="off" className={cn(f.type === "secret" && "font-mono")} />
              </Field>
            ))}
          </div>
        )}
      </Modal>

      {/* disconnect confirm */}
      <Modal open={!!confirmOff} onClose={() => setConfirmOff(null)} title="Disconnect platform?"
        footer={<>
          <Button variant="outline" onClick={() => setConfirmOff(null)}>Keep it</Button>
          <Button variant="destructive" onClick={() => { if (confirmOff) { disconnectIntegration(user.id, confirmOff); toast("info", "Disconnected", "Stored credentials were deleted."); } setConfirmOff(null); bump(x => x + 1); refresh(); }}>
            <Unplug className="w-4 h-4" /> Disconnect
          </Button>
        </>}>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed">Stored credentials are deleted immediately. Documents already published stay on the platform.</p>
      </Modal>
    </AppShell>
  );
}
