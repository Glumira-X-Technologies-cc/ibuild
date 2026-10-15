import React, { useState } from 'react';
import { builder, call, jobsList, laneStatus } from '../api';
import { Card, H2, Pill, ScreenProps, Status, useLoad } from './ui';
import { fmtWhen, laneName } from '../format';

// Resources: model providers, CLI job targets, recent jobs, lanes and the proxy's own Gemini key and models.
// Routes: GET /api/builder/providers(?probe=1), GET /api/builder/providers/:id/models, GET /api/builder/jobs (jobs, targets),
// GET /api/builder/jobs/targets(?probe=1), outside GET /api/lane/status, GET /health, GET /v1/models.
const Dot: React.FC<{ ok: boolean | null | undefined }> = ({ ok }) =>
  <span className={ok ? 'text-[var(--gold)]' : 'text-[var(--shade-color)]'}>{ok ? '●' : '○'}</span>;
const Muted: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-xs text-[var(--shade-color)]">{children}</p>;

const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const when = (v: unknown) => { const s = fmtWhen(v); return s || null; };

export default function Resources({ toast }: ScreenProps) {
  const [probe, setProbe] = useState(0);
  const prov = useLoad<any>(() => builder(probe ? '/providers?probe=1' : '/providers'), [probe]);
  const targets = useLoad<any>(() => builder(probe ? '/jobs/targets?probe=1' : '/jobs/targets'), [probe]);
  const jobs = useLoad<any>(jobsList);
  const lanes = useLoad<any>(laneStatus);
  const health = useLoad<any>(() => call('/health'));
  const gm = useLoad<any>(() => call('/v1/models'));
  const [open, setOpen] = useState<string | null>(null);
  const [cat, setCat] = useState<Record<string, any>>({});

  const showModels = async (id: string) => {
    if (open === id) { setOpen(null); return; }
    setOpen(id);
    if (cat[id]) return;
    try { setCat(c => ({ ...c, [id]: { loading: true } })); const r = await builder(`/providers/${encodeURIComponent(id)}/models`); setCat(c => ({ ...c, [id]: r })); }
    catch (e: any) { setCat(c => ({ ...c, [id]: { error: e.message } })); }
  };
  const refresh = () => { setProbe(p => p + 1); setCat({}); jobs.reload(); lanes.reload(); health.reload(); gm.reload(); toast('Probing providers and CLI targets…'); };

  const providers = arr(prov.data?.providers).filter(Boolean);
  const tlist = arr(targets.data?.targets).filter(Boolean);
  const jlist = arr(jobs.data?.jobs).filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const llist = arr(lanes.data?.lanes).filter(Boolean);
  const models = arr(gm.data?.data);

  return (<>
    <div className="flex justify-end"><button className="btn-var16" onClick={refresh}>Probe now</button></div>

    <H2>Model providers</H2>
    {prov.data ? (providers.length ? <div className="space-y-2">{providers.map(p => { if (!p) return null; return (
      <Card key={p.id} title={<span><Dot ok={p.completionVerified} /> {laneName(p.name)}</span>}>
        <div className="flex items-center justify-between gap-2">
          <span>{p.status}{p.catalogVerified ? ' · catalogue read' : ''}{p.imageInput ? ' · images' : ''}</span>
          {p.configured && <Pill on={open === p.id} onClick={() => showModels(p.id)}>Models</Pill>}
        </div>
        {open === p.id && (() => { const c = cat[p.id]; if (!c || c.loading) return <Muted>Loading…</Muted>; if (c.error) return <p className="text-xs text-[var(--error)]">{c.error}</p>;
          return <div className="mt-2 space-y-0.5">{arr(c.models).map((m: any) => <div key={m.id} className="mono-code">{m.id === c.selected ? '▸ ' : '  '}{m.id}</div>)}
            {!arr(c.models).length && <Muted>No models returned.</Muted>}<Muted>{when(c.checkedAt) ? 'Checked ' + when(c.checkedAt) : 'Not checked'}</Muted></div>; })()}
      </Card>); })}</div> : <Muted>No providers are defined.</Muted>) : <Status error={prov.error} />}

    <H2>CLI job targets</H2>
    {targets.data ? (tlist.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{tlist.map(t => { if (!t) return null; return (
      <Card key={t.target} title={<span><Dot ok={t.ready} /> {t.name || t.target} <span className="mono-code text-[var(--shade-color)]">{t.target}</span></span>}>
        <div className={t.ready ? 'text-[var(--text-main)]' : ''}>{!t.probed ? 'Not checked yet: press Refresh to run its --help probe.' : t.ready ? 'Ready' : 'Not ready'}</div>
        {t.probed && <div>{t.reason}</div>}
        {t.fix && <div className="mt-1">Fix: <span className="mono-code">{t.fix}</span></div>}
      </Card>); })}</div> : <Muted>No CLI targets are defined.</Muted>) : <Status error={targets.error} />}

    <H2>Recent jobs</H2>
    {jobs.data ? (jlist.length ? <div className="space-y-1">{jlist.slice(0, 20).map(j => { if (!j) return null; return (
      <div key={j.id} className="text-xs flex flex-wrap gap-3 border-b border-[var(--border-color)] py-1">
        <span className="mono-code w-20 shrink-0">{j.status}</span><span className="w-24 shrink-0">{j.target}</span>
        <span className="mono-code flex-1">{j.taskId || 'unfiled'}</span>
        <span className="mono-code text-[var(--shade-color)]">{when(j.createdAt) || ''}</span>
        {j.error && <span className="w-full text-[var(--error)]">{j.error}</span>}
      </div>); })}</div> : <Muted>No jobs yet.</Muted>) : <Status error={jobs.error} />}

    <H2>Lanes</H2>
    {lanes.data ? (llist.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{llist.map(l => { if (!l) return null; return (
      <Card key={l.id} title={<span><Dot ok={l.reachable} /> {laneName(l.label || l.id)}</span>}>
        {l.free ? 'free · ' : ''}key {l.keyPresent ? 'present' : 'missing'}
        {l.listed === false ? ' · model not listed' : ''}{l.error ? ` · ${l.error}` : ''}
      </Card>); })}</div> : <Muted>No lanes are configured.</Muted>) : <Status error={lanes.error} />}

    <H2>Proxy</H2>
    {health.data ? <Card title={<span><Dot ok={health.data.ok} /> Server answering</span>}>Gemini key {health.data.key_present ? 'present' : 'missing'}</Card> : <Status error={health.error} />}
    <div className="mt-2">{gm.data ? (models.length ? <Card title={`Gemini models · default ${gm.data.default || 'none'}`}>
      <div className="space-y-0.5">{models.map((m: any) => <div key={m.id} className="mono-code">{m.id}</div>)}</div></Card> : <Muted>No Gemini models listed.</Muted>) : <Status error={gm.error} />}</div>
  </>);
}
