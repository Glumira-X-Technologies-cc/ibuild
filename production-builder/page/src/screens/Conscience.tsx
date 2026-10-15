import React, { useState } from 'react';
import { builder, newId } from '../api';
import { Card, H2, Pill, Pre, ScreenProps, Status, useLoad } from './ui';
import { fmtWhen } from '../format';

// Conscience: what the Builder prepared and what it found, read from the Builder store.
// Routes: GET /api/builder/state (requests = compiled prompt log, debugReports), GET /api/builder/debug (scannedAt, source, findings, scope),
//         GET /api/builder/export (schema, exportedAt, state), POST /api/builder/events (debug.create).
// /debug can answer 500 until the debugFindings fix lands; then the findings come from /bootstrap roadmap.warnings, as Scan now does.
type Scan = { from: 'debug' | 'bootstrap'; scannedAt: string; source?: string; findings: any[]; scope?: string; debugError?: string };

async function scan(): Promise<Scan> {
  try {
    const d: any = await builder('/debug');
    return { from: 'debug', scannedAt: d.scannedAt, source: d.source, findings: (Array.isArray(d.findings) ? d.findings : []).filter(Boolean), scope: d.scope };
  } catch (e: any) {
    const b: any = await builder('/bootstrap');
    return { from: 'bootstrap', scannedAt: new Date().toISOString(), source: b.repo?.commit, findings: (Array.isArray(b.roadmap?.warnings) ? b.roadmap.warnings : []).filter(Boolean), debugError: e.message };
  }
}
const when = (s?: string) => fmtWhen(s);

// Each finding belongs to one function in this Builder. The link opens that function.
const WHERE: Record<string, { screen: 'build' | 'structure' | 'estate' | 'resources'; label: string }> = {
  CHECKBOX_DPG_CONTRADICTIONS: { screen: 'build', label: 'Build list' },
  RECEIPTS_NOT_INSPECTED: { screen: 'build', label: 'Build list' },
  RANGE_DETAILS_NOT_EXPANDED: { screen: 'build', label: 'Build list' },
  UNRESOLVED_ROUTE: { screen: 'structure', label: 'Structure' },
  ESTATE_IDENTITY_UNRESOLVED: { screen: 'estate', label: 'Estate' },
  RESOURCE_NOT_PROBED: { screen: 'resources', label: 'Resources' },
  FOYER_PIN_DIFFERS_FROM_HEAD_BLOB: { screen: 'structure', label: 'Structure' },
};

function cardsOf(b: any): any[] {
  const r = b?.roadmap;
  if (Array.isArray(r?.cards)) return r.cards.filter(Boolean);
  if (Array.isArray(r?.phases)) return r.phases.flatMap((p: any) => (Array.isArray(p?.cards) ? p.cards : [])).filter(Boolean);
  return [];
}

export default function Conscience({ toast, resume, go }: ScreenProps) {
  const st = useLoad<any>(() => builder('/state'));
  const sc = useLoad<Scan>(scan);
  const boot = useLoad<any>(() => builder('/bootstrap'));
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const data = await builder('/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `builder-export-${String(data.exportedAt || '').slice(0, 10) || 'now'}.json`; a.click(); URL.revokeObjectURL(url);
      toast('Export downloaded.');
    } catch (e: any) { toast(e.message); } finally { setBusy(false); }
  };
  const flag = async (r: any) => {
    const why = window.prompt(`What is wrong with ${r.taskId || r.id}?`);
    if (!why || !why.trim()) return;
    try {
      const id = newId('dbg');
      await builder('/events', { type: 'debug.create', requestId: id, payload: { id, title: `Conscience: ${r.taskId || r.id}`, text: why.trim(), screen: 'conscience', requestRef: r.id, at: new Date().toISOString() } });
      st.reload(); toast('Saved as a debug report.');
    } catch (e: any) { toast(e.message); }
  };

  const findings: any[] = sc.data && Array.isArray(sc.data.findings) ? sc.data.findings.filter(Boolean) : [];
  const requests: any[] = st.data && Array.isArray(st.data.requests) ? [...st.data.requests].reverse() : [];
  const reports: any[] = st.data && Array.isArray(st.data.debugReports) ? [...st.data.debugReports].reverse() : [];
  const cards = cardsOf(boot.data);
  const byId = new Map(cards.map(c => [String(c.id), c]));
  const openRow = (id: string) => {
    const c = byId.get(id);
    if (!c) { go?.('build'); toast('That row is not in the roadmap loaded here. Build list is open.'); return; }
    resume?.({ kind: 'work', id: c.id, taskId: c.id, text: c.fullText || `${c.id} ${c.title || ''}`.trim() });
  };

  return (<>
    <div className="flex items-center justify-between">
      <H2>Findings</H2>
      <div className="flex gap-2"><Pill onClick={sc.reload}>Scan again</Pill><Pill onClick={download}>{busy ? 'Exporting…' : 'Export store'}</Pill></div>
    </div>
    {sc.data ? <>
      {sc.data.from === 'bootstrap' && <Card title="Full scan unavailable">
        The full scan did not answer, so only the roadmap warnings are shown. Unresolved routes, estate identities and unchecked resources are not covered here.
      </Card>}
      <p className="text-xs text-[var(--shade-color)] my-2">Scanned {when(sc.data.scannedAt)}{sc.data.source ? <> at <span className="mono-code">{String(sc.data.source).slice(0, 7)}</span></> : null}.{sc.data.scope ? ` ${sc.data.scope}` : ''}</p>
      {findings.length ? <div className="space-y-2">{findings.map((f, i) => {
        if (!f) return null;
        const code = typeof f === 'string' ? f : String(f.code || 'FINDING');
        const where = WHERE[code];
        const named: string[] = typeof f === 'string' ? [] : (Array.isArray(f.ids) ? f.ids.filter(Boolean).map(String) : []);
        const rowIds = named.length ? named : (code === 'RANGE_DETAILS_NOT_EXPANDED' ? cards.filter(c => c.range).map(c => String(c.id)) : []);
        const shown = rowIds.slice(0, 12);
        return (<Card key={i} title={<span className="mono-code">{code}</span>}>
          {typeof f !== 'string' && <div>{[f.subject, f.reason, f.note].filter(Boolean).join(' · ')}</div>}
          {shown.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{shown.map(id => {
            const c = byId.get(id);
            return <button key={id} type="button" className="text-xs text-[var(--gold-text)]" onClick={() => openRow(id)}>{id}{c?.title ? ` ${c.title}` : ''}</button>;
          })}{rowIds.length > shown.length && <button type="button" className="text-xs text-[var(--shade-color)]" onClick={() => go?.('build')}>+{rowIds.length - shown.length} on the build list</button>}</div>}
          {where && <div className="mt-2"><button type="button" className="text-xs text-[var(--gold-text)]" onClick={() => go?.(where.screen)}>{where.label}</button></div>}
        </Card>);
      })}</div> : <p className="text-xs text-[var(--shade-color)]">No findings.</p>}
    </> : <Status error={sc.error} />}

    <H2>Compiled prompt log</H2>
    {st.data ? (requests.length ? <div className="space-y-2">{requests.map(r => {
      const blockers: string[] = r.readiness?.blockers || [];
      return (<Card key={r.id} onClick={() => setOpenId(openId === r.id ? null : r.id)} title={<span><span className="mono-code text-[var(--gold)]">{r.taskId || r.id}</span> {r.title || r.kind || ''}</span>}>
        {[r.status, r.readiness ? (r.readiness.ready ? 'ready' : `${blockers.length} blocker${blockers.length === 1 ? '' : 's'}`) : null, r.provider, r.target, r.executionRepo, when(r.createdAt)].filter(Boolean).join(' · ')}
        {openId === r.id && <div className="mt-2 space-y-2" onClick={e => e.stopPropagation()}>
          {blockers.length > 0 && <ul className="list-disc pl-4">{blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>}
          {r.promptHash && <p>Prompt sha256 <span className="mono-code break-all">{r.promptHash}</span>{r.sourceCommit ? <> · source <span className="mono-code">{String(r.sourceCommit).slice(0, 7)}</span></> : null}</p>}
          {(r.text || r.content) && <Pre text={String(r.text || r.content)} />}
          <div className="flex gap-2">
            {(r.text || r.content || r.prompt) && <Pill onClick={() => resume?.({ kind: 'prompt', id: r.id, text: String(r.text || r.content || r.prompt) })}>Open</Pill>}
            <Pill onClick={() => flag(r)}>Flag a problem</Pill>
          </div>
        </div>}
      </Card>);
    })}</div> : <p className="text-xs text-[var(--shade-color)]">No compiled prompts yet.</p>) : <Status error={st.error} />}

    <H2>Debug reports</H2>
    {st.data ? (reports.length ? <div className="space-y-2">{reports.map(d => (
      <Card key={d.id} title={d.title || d.id}>{[d.screen, when(d.at || d.createdAt)].filter(Boolean).join(' · ')}{d.text ? <div className="mt-1 whitespace-pre-wrap">{d.text}</div> : null}</Card>
    ))}</div> : <p className="text-xs text-[var(--shade-color)]">No debug reports.</p>) : <Status error={st.error} />}
  </>);
}
