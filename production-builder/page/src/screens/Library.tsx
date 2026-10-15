import React, { useMemo, useState } from 'react';
import { builder } from '../api';
import { Status, useLoad } from './ui';
import { libraryLaw } from '../library-law';

// Law tree from production-builder/index.html (founder 2026-09-27).
// A row is ticked only when its name is a path in the committed Library repo. A click cannot tick it.
type Node = { name: string; type: string; status?: string; note?: string; url?: string; count?: number; children?: Node[]; filed?: boolean };
type Index = { repo: string; sha: string; total: number; files: string[] };

const ICONS: Record<string, string> = { estate: 'E', libraryrepo: 'L', foyer: 'F', subject: '3', vaultlevel: '4', vault: 'V', unplaced: '?', book: 'B' };
const WHAT: Record<string, string> = { estate: 'Estate', libraryrepo: 'Library', foyer: 'Foyer', subject: 'Foyer subject', vaultlevel: 'Vaults', vault: 'Vault', unplaced: 'Unplaced', book: 'Book' };
const norm = (s: string) => String(s || '').toLowerCase().replace(/\(vault\)/g, '').replace(/^3\.\d\s*/, '').replace(/&/g, 'and').replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '');

function overlay(files: string[] | null, sha: string): Node {
  const root = JSON.parse(JSON.stringify(libraryLaw)) as Node;
  if (!files || !sha) return root;
  const dirs: Record<string, string> = {};
  files.forEach(f => f.split('/').forEach((seg, i) => { const k = norm(seg); if (k && !dirs[k]) dirs[k] = f.split('/').slice(0, i + 1).join('/'); }));
  const used: Record<string, 1> = {};
  const short = sha.slice(0, 7);
  const base = 'https://github.com/Glumira-X-Technologies-cc/Glumira-7.2/tree/' + sha + '/';
  const walk = (n: Node) => {
    (n.children || []).forEach(walk);
    if (!['book', 'subject', 'vault'].includes(n.type)) return;
    const hit = dirs[norm(n.name)];
    if (hit) used[hit] = 1;
    if (/unaccounted/i.test(n.note || '')) {
      if (hit) { n.filed = true; n.status = 'partial'; n.url = base + hit.split('/').map(encodeURIComponent).join('/'); n.note = 'Unaccounted in the law, but the Library repo has ' + hit + ' at ' + short + '.'; }
      else n.status = 'unaccounted';
      return;
    }
    if (n.type === 'subject' && n.children && n.children.length) {
      const any = n.children.some(c => c.filed);
      n.status = any || hit ? 'partial' : 'missing';
      if (hit) { n.filed = true; n.url = base + hit.split('/').map(encodeURIComponent).join('/'); }
      return;
    }
    if (hit) { n.filed = true; n.status = 'partial'; n.url = base + hit.split('/').map(encodeURIComponent).join('/'); n.note = 'In the Library repo at ' + short + ': ' + hit; }
    else { n.status = 'missing'; n.note = 'Not in the Library repo (Glumira-7.2) at ' + short + '.'; }
  };
  walk(root);
  const hits = Object.keys(used);
  const onTree = (f: string) => hits.some(h => f === h || f.startsWith(h + '/'));
  const tops: Record<string, number> = {};
  files.filter(f => !onTree(f)).forEach(f => { const t = f.split('/')[0]; tops[t] = (tops[t] || 0) + 1; });
  const extra = Object.keys(tops).sort();
  const lib = root.children?.[0]?.children?.[0];
  if (lib) {
    lib.note = '2 LIBRARY · Glumira-7.2 at ' + short + ' · ' + files.length + ' files';
    lib.url = base;
    if (extra.length) lib.children = [...(lib.children || []), { name: 'In the Library repo, not on the law tree', type: 'unplaced', status: 'partial', note: 'Files and folders the law tree does not name yet. Each needs a home.', children: extra.map(t => ({ name: t, type: 'book', status: 'partial', filed: true, count: tops[t], url: base + encodeURIComponent(t), note: tops[t] + ' file(s) in the Library repo, not placed under the law.' })) }];
  }
  return root;
}

function findNode(name: string, node: Node): Node | null {
  if (node.name === name) return node;
  for (const c of node.children || []) { const f = findNode(name, c); if (f) return f; }
  return null;
}

const dot = (n: Node) => n.status === 'missing' ? 'var(--error)' : n.status === 'partial' || n.status === 'complete' ? 'var(--gold)' : 'var(--shade-color)';

function Tick({ on }: { on: boolean }) {
  return <input type="checkbox" checked={on} readOnly onClick={e => e.preventDefault()} tabIndex={-1} title={on ? 'Ticked because this name is in the Library repo. A click does not tick it.' : 'Not ticked. It ticks when this name is committed in the Library repo.'} className="mt-0.5 shrink-0" />;
}

function Tree({ node, depth, open, active, toggle, pick, q }: { node: Node; depth: number; open: Set<string>; active: string; toggle: (n: string) => void; pick: (n: string) => void; q: string }) {
  const kids = node.children || [];
  const self = !q || node.name.toLowerCase().includes(q) || (node.note || '').toLowerCase().includes(q);
  const kidHit = kids.some(function hit(n): boolean { return n.name.toLowerCase().includes(q) || (n.note || '').toLowerCase().includes(q) || (n.children || []).some(hit); });
  if (q && !self && !kidHit) return null;
  const showKids = kids.length > 0 && (open.has(node.name) || (!!q && kidHit));
  const on = active === node.name;
  return (<>
    <div
      className="flex items-center gap-1.5 py-1 pr-2 cursor-pointer text-xs text-[var(--text-main)]"
      style={{ paddingLeft: 8 + depth * 16, background: on ? 'var(--bg-panel)' : undefined, boxShadow: on ? 'inset 3px 0 0 var(--gold)' : undefined }}
      onClick={() => { pick(node.name); if (kids.length) toggle(node.name); }}
    >
      <span className="w-3.5 shrink-0 text-xs text-[var(--shade-color)]" style={{ transform: showKids ? 'rotate(90deg)' : undefined }}>{kids.length ? '▶' : ''}</span>
      <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded text-xs shrink-0 bg-[#1a3268] text-[var(--text-main)]">{ICONS[node.type] || '?'}</span>
      <span className="flex-1 truncate">{node.name}</span>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot(node) }} title={node.filed ? 'In the Library repo' : node.status === 'missing' ? 'Not in the Library repo' : node.status || ''} />
      {kids.length > 0 && <span className="mono-code text-xs text-[var(--shade-color)] w-5 text-right shrink-0">{kids.length}</span>}
    </div>
    {showKids && kids.map(c => <Tree key={c.name} node={c} depth={depth + 1} open={open} active={active} toggle={toggle} pick={pick} q={q} />)}
  </>);
}

function Where({ node }: { node: Node }) {
  return (<>
    <div className="text-xs text-[var(--text-secondary)]">{node.note || 'The law names this and gives no further place.'}{node.count ? ' · ' + node.count + ' files' : ''}</div>
    {node.url && /^https:\/\/github\.com\//.test(node.url) && <a className="text-xs text-[var(--gold-text)]" href={node.url} target="_blank" rel="noreferrer">Open this place</a>}
  </>);
}

export default function Library() {
  const idx = useLoad<Index>(() => builder('/library-index'));
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(() => new Set(['GLUMIRA 7.2', 'Glumira-7.2', 'FOYER']));
  const [active, setActive] = useState('GLUMIRA 7.2');
  const tree = useMemo(() => overlay(idx.data?.files || null, idx.data?.sha || ''), [idx.data]);
  const toggle = (name: string) => setOpen(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const node = findNode(active, tree) || tree.children?.[0] || null;
  const query = q.trim().toLowerCase();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,420px)_1fr] gap-4 items-start">
      <div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search vault, cabinet, book..." className="input-work-gold rounded px-2 py-1 text-xs w-full mb-2" />
        {idx.error && <p className="text-xs text-[var(--error)] mb-2">{idx.error}</p>}
        {!idx.data && !idx.error && <Status error={null} />}
        <div>{(tree.children || []).map(n => <Tree key={n.name} node={n} depth={0} open={open} active={active} toggle={toggle} pick={setActive} q={query} />)}</div>
      </div>
      {node && <div>
        <div className="text-sm text-[var(--text-main)]">{node.name}</div>
        <div className="label-text mt-3 mb-1">What</div>
        <div className="text-xs text-[var(--text-main)]">{WHAT[node.type] || node.type}</div>
        <div className="label-text mt-3 mb-1">Where</div>
        <Where node={node} />
        <div className="flex items-start gap-2 mt-3">
          <Tick on={!!node.filed} />
          <div className="text-xs text-[var(--text-secondary)]">{node.filed ? 'Ticked. This name is in the committed Library repo.' : 'Not ticked. It ticks when this name is committed in the Library repo. A click cannot tick it.'}</div>
        </div>
        {(node.children || []).length > 0 && <div className="mt-4 border-t border-[var(--border-color)]">
          {(node.children || []).map(c => (
            <button key={c.name} type="button" onClick={() => { setActive(c.name); setOpen(prev => new Set(prev).add(node.name)); }} className="w-full text-left flex items-start gap-2 py-2 border-b border-[var(--border-color)]">
              <Tick on={!!c.filed} />
              <span className="min-w-0">
                <span className="block text-xs text-[var(--text-main)]">{c.name}</span>
                <span className="block text-xs text-[var(--text-secondary)]">What · {WHAT[c.type] || c.type}</span>
                <span className="block text-xs text-[var(--shade-color)]">Where · {c.note || 'No place recorded.'}</span>
              </span>
            </button>
          ))}
        </div>}
      </div>}
    </div>
  );
}
