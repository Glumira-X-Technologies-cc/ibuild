import React, { useState } from 'react';
import { builder } from '../api';
import { ScreenProps, Status, useLoad } from './ui';

// Van Clief estate: VAN-CLIEF-STRUCTURE-72.txt as pinned in the Production Builder page
// (memory-governance-archive .planning/codebase/VAN-CLIEF-STRUCTURE-72.txt, station 1b19eec311e9).
// The words are the file's. A click only opens a row. It does not place, rename or tick anything.
type Row = { id: string; name: string; status?: string; children?: Row[] };

const TAGS = '[LAW] founder words, verbatim. [OBS] observed at the pinned revision. [PROP] proposal, not approved. [OPEN] unresolved, needs a ruling or evidence.';

const TREE: Row[] = [
  { id: '1', name: '1 ESTATE', status: 'GLUMIRA 7.2' },
  { id: '2', name: '2 LIBRARY', status: 'https://github.com/Glumira-X-Technologies-cc/Glumira-7.2', children: [
    { id: '2o', name: 'Owner', status: '[OPEN] owner conflict: org repo vs francoissteyn-2026/Glumira-7.2 (identity hold 1)' },
  ] },
  { id: '3', name: '3 FOYER', children: [
    { id: 'onb', name: 'Onboarding', status: '[OBS] 12 families, 183 files', children: [
      { id: 'o1', name: 'Onboarding-About-You', status: '24' },
      { id: 'o2', name: 'Onboarding-Biological-Sex-Health', status: '12' },
      { id: 'o3', name: 'Onboarding-Care-Circle', status: '14' },
      { id: 'o4', name: 'Onboarding-Comorbidities', status: '10' },
      { id: 'o5', name: 'Onboarding-Diabetes-Device', status: '11' },
      { id: 'o6', name: 'Onboarding-Finish', status: '11' },
      { id: 'o7', name: 'Onboarding-Insulin', status: '8' },
      { id: 'o8', name: 'Onboarding-Invite-Access', status: '18' },
      { id: 'o9', name: 'Onboarding-Module-Preferences', status: '18' },
      { id: 'o10', name: 'Onboarding-Targets', status: '22' },
      { id: 'o11', name: 'Onboarding-Welcome', status: '18' },
      { id: 'o12', name: 'Emergency-Contact', status: '17. Founder: "emergency contact is in onboarding"' },
    ] },
    { id: 'dash', name: 'Dashboard', status: '[OBS] Dashboard (39)' },
    { id: 'ins', name: 'Insulin & What-If', status: '[OBS] Insulin-What-If (30)   INSULIN LOCK: pointer Pages only' },
    { id: 'cook', name: 'Cookbook & Meals', status: '[OBS] Cookbook-Meals (36)' },
    { id: 'spec', name: 'Special Provisions', status: '[OBS] Special-Provisions (31)' },
    { id: 'rep', name: 'Reports & Logs', status: '[OBS] Reports-Logs (44)' },
    { id: 'edu', name: 'Education & Library', status: '[OBS] Education-Library (72)' },
    { id: 'care', name: 'Care Circle', status: '[OBS] Care-Circle (23)   (see also Onboarding-Care-Circle)' },
    { id: 'alarm', name: 'Alarms & Settings', status: '[OBS] Alarms-Settings (30)' },
    { id: 'mira', name: 'Mira Media', status: '[OBS] Mira-Media (49)' },
    { id: 'sub', name: 'Subscription Tiers', status: '[OPEN] NO BOOK - unaccounted for' },
    { id: '31', name: '3.1 GluMira', status: '[OPEN] NO BOOK - unaccounted for', children: [
      { id: '31a', name: 'GluMira Insight', status: '[OPEN] NO BOOK' },
      { id: '31b', name: 'GluMira AI', status: '[OPEN] NO BOOK' },
      { id: '31c', name: 'GluMira Research', status: '[OPEN] NO BOOK' },
      { id: '31d', name: 'GluMira Clinician Interface', status: '[OPEN] NO BOOK. Founder 2026-09-28 said "GluMira Clinical"; the law says "GluMira Clinician Interface". Both kept verbatim. Not renamed.' },
    ] },
    { id: '32', name: '3.2 Reports & Logs', status: 'same subject as Foyer "Reports & Logs"' },
    { id: '33', name: '3.3 Engines', status: '[OPEN] NO BOOK - unaccounted for (as a group)' },
  ] },
  { id: '4', name: '4 VAULTS', status: '1 VAULT PER FUNCTION', children: [
    { id: '4o', name: 'Function list', status: '[OPEN] the function list is not written: GluMira-7.2.1 INDEX/MASTER-FUNCTIONS.json is absent at 9977fbc. No Vault is named until that list exists.' },
  ] },
  { id: '5', name: '5 ROWS', status: 'MODULES SORTED IN FUNCTIONS RELATED. [OPEN] follows the function list' },
  { id: '6', name: '6 CABINET', status: 'one per Row, with a Cabinet summary. [OPEN] follows the Rows' },
  { id: '7', name: '7 CABINET SUMMARY', status: 'of all the Books in the Cabinet. [OPEN]' },
  { id: '8', name: '8 BOOKS', status: 'All the data related to the topic. [OBS] HERDS families hold Book files today; whether a family is a Vault, Row or Book is [OPEN]' },
  { id: '9', name: '9 PAGES', status: '3 layers of every topic: Documents | Programming | Git. [OBS] HERDS file names already carry the layer, e.g. Documents-*.md' },
  { id: 'u', name: 'Unplaced families', status: '[OBS] 13 families, 1,539 files. Each needs a ruling or evidence before it is placed.', children: [
    { id: 'u1', name: 'CGM', status: '64' },
    { id: 'u2', name: 'Diets', status: '34' },
    { id: 'u3', name: 'Filing', status: '186' },
    { id: 'u4', name: 'GlucoGuard-History', status: '11' },
    { id: 'u5', name: 'Hub', status: '385' },
    { id: 'u6', name: 'IOB', status: '107. INSULIN LOCK: pointer Pages only, never sent to Jev' },
    { id: 'u7', name: 'Life-Stage', status: '27' },
    { id: 'u8', name: 'Mira-Whisper', status: '32' },
    { id: 'u9', name: 'Paediatric-Planner', status: '7' },
    { id: 'u10', name: 'Prior', status: '20' },
    { id: 'u11', name: 'Programme', status: '291' },
    { id: 'u12', name: 'Soup-Training', status: '48' },
    { id: 'u13', name: 'Unherded', status: '327' },
  ] },
];

const FLOORS = [
  { n: '1', name: 'GluMira 7.2', desc: 'Glumira-X-Technologies-cc/Glumira-7.2', axis: 'Library (level 2) · floor unassigned' },
  { n: '2', name: 'GluMira 7.1', desc: 'The CONDUCTOR · WRITER · ARCHITECT. Version control.', axis: 'F3 Product' },
  { n: '3', name: 'Memory Governance Archive', desc: 'Operational live copies + 2 previous versions. The READ FIRST AND TRUE engine.', axis: 'F1 Hub' },
  { n: '4', name: 'GluMira Archive', desc: 'Build from sorting station. Canonical structure — literally the files and folders. Index-card filing system.', axis: 'F2 Archive' },
  { n: '5', name: 'Sorting Station', desc: 'Glumira-X-Technologies-cc/glumira-document-sorting-station', axis: 'Floor unassigned · holds the Books (Library-7.2/HERDS)' },
  { n: '6', name: 'Foundation Archive', desc: 'Founding work. Institutional memory. Source and original intent.', axis: 'F0 Foundation archive' },
  { n: '7', name: 'GluMira 7.2.1', desc: 'Planned build', axis: 'Floor unassigned · planned' },
];

const hit = (n: Row, q: string): boolean => !q || n.name.toLowerCase().includes(q) || (n.status || '').toLowerCase().includes(q) || (n.children || []).some(c => hit(c, q));

function find(id: string, rows: Row[]): Row | null {
  for (const r of rows) {
    if (r.id === id) return r;
    const c = r.children && find(id, r.children);
    if (c) return c;
  }
  return null;
}

function Branch({ row, depth, q, open, active, toggle, pick }: { row: Row; depth: number; q: string; open: Set<string>; active: string; toggle: (id: string) => void; pick: (id: string) => void }) {
  if (!hit(row, q)) return null;
  const kids = row.children || [];
  const show = kids.length > 0 && (open.has(row.id) || (!!q && kids.some(c => hit(c, q))));
  const on = active === row.id;
  return (<>
    <div className="flex items-start gap-2 py-1 pr-2 cursor-pointer text-xs" style={{ paddingLeft: 8 + depth * 16, background: on ? 'var(--bg-panel)' : undefined, boxShadow: on ? 'inset 3px 0 0 var(--gold)' : undefined }} onClick={() => { pick(row.id); if (kids.length) toggle(row.id); }}>
      <span className="w-3 shrink-0 text-xs text-[var(--shade-color)] mt-0.5" style={{ transform: show ? 'rotate(90deg)' : undefined }}>{kids.length ? '▶' : ''}</span>
      <span className="text-[var(--text-main)] shrink-0">{row.name}</span>
      {row.status && <span className="text-[var(--shade-color)] min-w-0">{row.status}</span>}
    </div>
    {show && kids.map(c => <Branch key={c.id} row={c} depth={depth + 1} q={q} open={open} active={active} toggle={toggle} pick={pick} />)}
  </>);
}

export default function Estate(_props: ScreenProps) {
  const boot = useLoad<any>(() => builder('/bootstrap'));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set(['3', 'onb']));
  const [active, setActive] = useState('3');
  const [part, setPart] = useState<'tree' | 'floors' | 'repos'>('tree');
  const query = q.trim().toLowerCase();
  const toggle = (id: string) => setOpen(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const node = find(active, TREE);
  const estate: any[] = Array.isArray(boot.data?.estate) ? boot.data.estate : [];

  return (<>
    <p className="text-xs text-[var(--shade-color)] mb-2">VAN-CLIEF-STRUCTURE-72.txt, pinned at station 1b19eec. {TAGS} Founder 2026-10-05: "3.2 Reports & Logs / 3.3 Engines / these are vaults". Where the file shows them under the Foyer, that ruling is newer. A click opens a row. It does not place or tick it.</p>
    <div className="flex gap-4 text-xs mb-2">
      {(['tree', 'floors', 'repos'] as const).map(id => (
        <button key={id} type="button" onClick={() => setPart(id)} className={`${part === id ? 'text-[var(--gold-text)]' : 'text-[var(--shade-color)]'}`}>{id === 'tree' ? 'Structure' : id === 'floors' ? 'Floors' : 'Repositories'}</button>
      ))}
    </div>
    {part === 'tree' && (
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,1.2fr)_minmax(220px,0.8fr)] gap-4 items-start">
        <div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search the structure" className="input-work-gold rounded px-2 py-1 text-xs w-full mb-2" />
          {TREE.map(r => <Branch key={r.id} row={r} depth={0} q={query} open={open} active={active} toggle={toggle} pick={setActive} />)}
        </div>
        {node && <div>
          <div className="text-sm text-[var(--text-main)]">{node.name}</div>
          <div className="label-text mt-3 mb-1">Where this line stands</div>
          <div className="text-xs text-[var(--text-secondary)]">{node.status || 'Named in the structure. No further mark on this line.'}</div>
          {(node.children || []).length > 0 && <div className="mt-3 border-t border-[var(--border-color)]">
            {node.children!.map(c => (
              <button key={c.id} type="button" onClick={() => { setActive(c.id); setOpen(prev => new Set(prev).add(node.id)); }} className="w-full text-left py-1.5 border-b border-[var(--border-color)]">
                <span className="block text-xs text-[var(--text-main)]">{c.name}</span>
                {c.status && <span className="block text-xs text-[var(--shade-color)]">{c.status}</span>}
              </button>
            ))}
          </div>}
        </div>}
      </div>
    )}
    {part === 'floors' && <div>{FLOORS.map(f => (
      <div key={f.n} className="flex gap-3 py-2 border-b border-[var(--border-color)] text-xs">
        <span className="mono-code text-[var(--gold-text)] w-4">{f.n}</span>
        <span className="min-w-0"><span className="text-[var(--text-main)]">{f.name}</span><span className="block text-[var(--shade-color)]">{f.desc}</span></span>
        <span className="text-[var(--shade-color)] shrink-0">{f.axis}</span>
      </div>
    ))}</div>}
    {part === 'repos' && (!boot.data ? <Status error={boot.error} /> : estate.length ? <div>{estate.map(r => (
      <div key={r.id} className="py-2 border-b border-[var(--border-color)] text-xs">
        <div className="text-[var(--text-main)]">{r.label}{r.status === 'active' ? ' · active' : ''}</div>
        <div className="text-[var(--shade-color)]">{r.role}</div>
        <div className="mono-code">{r.slug ? <a className="text-[var(--gold-text)]" href={`https://github.com/${r.slug}`} target="_blank" rel="noreferrer">{r.slug}</a> : 'No repository identity'}{r.path ? ` · ${r.path}` : ''}</div>
        <div className="text-[var(--shade-color)]">{r.status} · {r.executionAuthority}</div>
      </div>
    ))}</div> : <p className="text-xs text-[var(--shade-color)]">The Builder returned no estate.</p>)}
    {part === 'repos' && boot.data?.os?.registry?.as_of && <p className="text-xs text-[var(--shade-color)] mt-2">OS registry as of {boot.data.os.registry.as_of}.</p>}
  </>);
}
