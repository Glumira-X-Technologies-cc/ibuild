import React, { useState } from 'react';
import { builder } from '../api';
import { Card, H2, Pill, ScreenProps, Status, useLoad } from './ui';

// Modules: the skills and agents the Builder can choose from, and the agent and council reference profiles.
// Routes: GET /api/builder/ideas/toolkit (home, status, items[id, kind, description]); GET /api/builder/bootstrap (profiles.agents, profiles.councils).
const Profile: React.FC<{ p: any }> = ({ p }) => (
  <Card title={<span>{p.label}{p.clinical ? <span className="text-[var(--gold)]"> · clinical</span> : ''}</span>}>
    {p.description && <div>{p.description}</div>}
    <div className="mt-1">{p.status}{p.authority ? ` · ${p.authority}` : ''}</div>
    <div className="mono-code mt-1 truncate">{p.path}</div>
  </Card>
);

export default function Modules(_props: ScreenProps) {
  const kit = useLoad<any>(() => builder('/ideas/toolkit'));
  const boot = useLoad<any>(() => builder('/bootstrap'));
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string | null>(null);
  const items: any[] = Array.isArray(kit.data?.items) ? kit.data.items.filter(Boolean) : [];
  const kinds = [...new Set(items.map(i => String(i.kind)))].sort();
  const ql = q.trim().toLowerCase();
  const shown = items.filter(i => (!kind || i.kind === kind) && (!ql || `${i.id} ${i.description || ''}`.toLowerCase().includes(ql)));
  const agents: any[] = Array.isArray(boot.data?.profiles?.agents) ? boot.data.profiles.agents.filter(Boolean) : [];
  const councils: any[] = Array.isArray(boot.data?.profiles?.councils) ? boot.data.profiles.councils.filter(Boolean) : [];

  return (<>
    <H2>Toolkit</H2>
    {kit.data ? <>
      <p className="text-xs text-[var(--shade-color)] mb-2">{kit.data.status} · <span className="mono-code">{kit.data.home}</span></p>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search skills and agents" className="input-work-gold rounded px-2 py-1 text-xs w-full mb-2" />
      {kinds.length > 1 && <div className="flex flex-wrap gap-1 mb-2">
        <Pill on={!kind} onClick={() => setKind(null)}>All {items.length}</Pill>
        {kinds.map(k => <Pill key={k} on={kind === k} onClick={() => setKind(kind === k ? null : k)}>{k} {items.filter(i => i.kind === k).length}</Pill>)}
      </div>}
      {shown.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{shown.map(i => { if (!i) return null; return (
        <Card key={i.id} title={<span><span className="mono-code text-[var(--gold)]">{i.id}</span> <span className="text-[var(--shade-color)]">· {i.kind}</span></span>}>{i.description || 'No description.'}</Card>); })}</div>
        : <p className="text-xs text-[var(--shade-color)]">{items.length ? 'Nothing matches.' : 'The toolkit is empty.'}</p>}
    </> : <Status error={kit.error} />}

    <H2>Agents</H2>
    {boot.data ? (agents.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{agents.map(p => { if (!p) return null; return <Profile key={p.id} p={p} />; })}</div>
      : <p className="text-xs text-[var(--shade-color)]">No agent profiles.</p>) : <Status error={boot.error} />}

    <H2>Councils</H2>
    {boot.data ? (councils.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{councils.map(p => <Profile key={p.id} p={p} />)}</div>
      : <p className="text-xs text-[var(--shade-color)]">No council profiles.</p>) : <Status error={boot.error} />}
  </>);
}
