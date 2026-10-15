import React, { useState } from 'react';
import { builder } from '../api';
import { Card, H2, Pill, Pre, ScreenProps, Status, useLoad } from './ui';

// Structure: the law, the Foyer rules and routes, and the JEV-MAP vaults and records, read at the pinned commit.
// Route: GET /api/builder/bootstrap (law, foyer.rules, foyer.routes, foyer.vaults, os.jev, os.routingRevision, repo.commit).
const txt = (v: unknown) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''));
export default function Structure(_props: ScreenProps) {
  const boot = useLoad<any>(() => builder('/bootstrap'));
  const [q, setQ] = useState('');
  const [vault, setVault] = useState<string | null>(null);
  if (!boot.data) return <Status error={boot.error} />;
  const { law, foyer, os, repo } = boot.data;
  const jev = os?.jev || {};
  const vaults: [string, any][] = Object.entries(jev.vaults || {});
  const records: any[] = Array.isArray(jev.records) ? jev.records : [];
  const rules: [string, string][] = Object.entries(foyer?.rules || {}).map(([k, v]) => [k, txt(v)]);
  const routes: [string, string][] = Object.entries(foyer?.routes || {}).map(([k, v]) => [k, txt(v)]);
  const ql = q.trim().toLowerCase();
  const shown = records.filter(r => (!vault || String(r.vault) === vault) &&
    (!ql || [r.subject, r.row, r.path].filter(Boolean).join(' ').toLowerCase().includes(ql)));
  const filed = (id: string) => Object.keys(foyer?.vaults?.[id]?.rows || {}).length;

  return (<>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card title={String(vaults.length)}>Vaults in JEV-MAP</Card>
      <Card title={String(records.length)}>JEV-MAP records</Card>
      <Card title={<span className="mono-code">{os?.routingRevision || 'unknown'}</span>}>Routing revision</Card>
      <Card title={<span className="mono-code">{repo?.commit ? String(repo.commit).slice(0, 7) : 'unknown'}</span>}>Pinned commit</Card>
    </div>

    <H2>Law</H2>
    {law ? <div className="space-y-2">
      <Card title={law.chainSource}>{law.chain}</Card>
      <Card title={law.step10Source}>{law.step10}</Card>
    </div> : <p className="text-xs text-[var(--shade-color)]">The Builder returned no law.</p>}

    <H2>Foyer rules</H2>
    {rules.length ? <div className="space-y-2">{rules.map(([k, v]) => <Card key={k} title={k.replace(/_/g, ' ')}>{v}</Card>)}</div>
      : <p className="text-xs text-[var(--shade-color)]">The Foyer lists no rules.</p>}

    <H2>Foyer routes</H2>
    {routes.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{routes.map(([name, id]) => (
      <Card key={name} title={name}><span className="mono-code">Vault {id}</span>{jev.vaults?.[id]?.name && jev.vaults[id].name !== name ? ` · ${jev.vaults[id].name}` : ''}</Card>))}</div>
      : <p className="text-xs text-[var(--shade-color)]">The Foyer lists no routes.</p>}

    <H2>Vaults</H2>
    <div className="flex flex-wrap gap-1 mb-2">
      <Pill on={!vault} onClick={() => setVault(null)}>All</Pill>
      {vaults.map(([id, v]) => <Pill key={id} on={vault === id} onClick={() => setVault(vault === id ? null : id)}>{id}. {v.name}</Pill>)}
    </div>
    {vault && jev.vaults?.[vault] && <Card title={`${vault}. ${jev.vaults[vault].name}`}>
      <span className="mono-code">{jev.vaults[vault].path}</span>{jev.vaults[vault].os_pointer ? ` · OS pointer ${jev.vaults[vault].os_pointer}` : ''}
      {' · '}{filed(vault) ? `${filed(vault)} Rows filed in the Foyer` : '[OPEN] NO BOOK'}
    </Card>}

    <H2>Records</H2>
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search subjects, Rows and paths" className="input-work-gold rounded px-2 py-1 text-xs w-full mb-2" />
    {shown.length ? <div className="space-y-1">{shown.map((r, i) => (
      <div key={i} className="text-xs flex gap-3 border-b border-[var(--border-color)] py-1">
        <span className="mono-code text-[var(--gold)] w-12 shrink-0">{r.row || r.vault}</span>
        <span className="flex-1">{r.subject}</span>
        <span className="mono-code text-[var(--shade-color)] truncate max-w-[50%]">{r.path || `Vault ${r.vault}`}</span>
      </div>))}</div> : <p className="text-xs text-[var(--shade-color)]">No records match.</p>}
    {jev.about && <><H2>About JEV-MAP</H2><Pre text={typeof jev.about === 'string' ? jev.about : JSON.stringify(jev.about, null, 2)} /></>}
  </>);
}
