import React, { useEffect, useState } from 'react';
import { builder, compile, jobsStart, newId } from '../api';
import { Fold, FoldButton, ScreenProps, Status, useLoad } from './ui';

// Build list: the ROADMAP. Several rows can be open, and each workable row can start its own job
// while others are already building. Phases and warnings minimize to their titles.
// Route: GET /api/builder/bootstrap -> roadmap.phases, roadmap.cards, roadmap.counts, roadmap.warnings (builder-context.js parseRoadmap).
type Filter = 'all' | 'open' | 'checked' | 'conflict';
// GitHub blob link from roadmap.source {repo, path, commit}; repo may be 'owner/name' or a full URL.
const srcUrl = (src: any): string | null => {
  const repo = typeof src?.repo === 'string' ? src.repo.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '') : '';
  const path = typeof src?.path === 'string' ? src.path.replace(/^\/+/, '') : '';
  const commit = typeof src?.commit === 'string' ? src.commit.trim() : '';
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !path || !commit) return null;
  return `https://github.com/${repo}/blob/${encodeURIComponent(commit)}/${path.split('/').map(encodeURIComponent).join('/')}`;
};
// Hidden rows and minimized phases are this browser's view only (localStorage). The ROADMAP is never changed here.
const readSet = (k: string): string[] => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };
const writeSet = (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } };
const lineUrl = (src: any, line?: number): string | null => { const u = srcUrl(src); return u && line ? `${u}#L${line}` : u; };
const match = (c: any, f: Filter) => f === 'all' || (f === 'open' && c.reportedStatus === 'open') || (f === 'checked' && c.sourceChecked) || (f === 'conflict' && c.checkboxDpgConflict);

// The next step is the first blocker the Builder already enforces. It does not add a rule.
export function nextStep(c: any, slug = ''): { text: string; canWork: boolean } {
  if (!c.executionRepo) return { text: 'Next: this row has no TARGET_REPO. Name the repository before dispatch.', canWork: false };
  if (slug && String(c.executionRepo).toLowerCase() !== slug.toLowerCase()) return { text: `Next: this row targets ${c.executionRepo}. This builder cannot execute it in the current checkout.`, canWork: false };
  if (c.range) return { text: 'Next: a range is not a task. Resolve one child row before execution.', canWork: false };
  if (c.gate) return { text: `Next: ${c.gate} approval is required before this runs.`, canWork: false };
  if (c.checkboxDpgConflict) return { text: 'Next: the source checkbox conflicts with the D/P/G boxes. Fix that row in the ROADMAP before anything else. A tick is not acceptance.', canWork: false };
  if (c.priority === 'UNKNOWN' || /HOLD/i.test(String(c.priority || ''))) return { text: 'Next: the priority is unknown or held. Do not dispatch.', canWork: false };
  if (c.sourceChecked) return { text: 'Next: the source is ticked. A tick is not independent acceptance, and the receipt has not been inspected.', canWork: false };
  const boxes = `D ${c.d ? '☑' : '☐'} P ${c.p ? '☑' : '☐'} G ${c.g ? '☑' : '☐'}`;
  if (!(c.d && c.p && c.g)) return { text: `Next: ${boxes}. Do this row. Do not tick it until D, P and G are all marked.`, canWork: true };
  return { text: 'Next: D, P and G are marked and the row is still open. Tick it only when an independent receipt exists.', canWork: true };
}

const Tick = ({ on, letter, name }: { on: boolean; letter: string; name: string }) => (
  <span title={`${name}: ${on ? 'ticked on the roadmap' : 'not ticked on the roadmap'}`} className="inline-flex items-center justify-center w-4 h-4 rounded-[3px] border text-xs leading-none" style={on ? { borderColor: 'var(--success)', color: 'var(--success)' } : { borderColor: 'var(--border-color)', color: 'var(--shade-color)' }}>{on ? '✓' : letter}</span>
);

export default function BuildList({ resume, listFilter, toast }: ScreenProps) {
  const boot = useLoad<any>(() => builder('/bootstrap'));
  const [filter, setFilter] = useState<Filter>(listFilter || 'all');
  const [q, setQ] = useState('');
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [building, setBuilding] = useState<string[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [target, setTarget] = useState('');
  const [hidden, setHidden] = useState<string[]>(() => readSet('ais.build.hidden'));
  const [showHidden, setShowHidden] = useState(false);
  const [minPhases, setMinPhases] = useState<string[]>(() => readSet('ais.build.minPhases'));
  const toggleHidden = (id: string) => { const next = hidden.includes(id) ? hidden.filter(x => x !== id) : [...hidden, id]; setHidden(next); writeSet('ais.build.hidden', next); if (!hidden.includes(id)) { setOpenIds(ids => ids.filter(x => x !== id)); toast(`${id} hidden. "Hidden (${next.length})" at the top shows it again.`); } };
  useEffect(() => {
    const load = () => builder<any>('/jobs').then(r => setJobs((Array.isArray(r.jobs) ? r.jobs : []).filter(Boolean))).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    builder<any>('/jobs/targets?probe=1').then(r => {
      const ts = (Array.isArray(r?.targets) ? r.targets : []).filter(Boolean);
      setTargets(ts);
      const ready = ts.find((x: any) => x.installed && (!x.probed || x.ready));
      if (ready) setTarget(ready.target);
    }).catch(() => {});
  }, []);
  const togglePhase = (n: string) => { const next = minPhases.includes(n) ? minPhases.filter(x => x !== n) : [...minPhases, n]; setMinPhases(next); writeSet('ais.build.minPhases', next); };
  if (!boot.data) return <Status error={boot.error} />;
  const R = boot.data.roadmap;
  if (!R || !Array.isArray(R.phases)) return <p className="text-xs text-[var(--error)]">The Builder did not return a roadmap.</p>;
  const C = R.counts || {};
  const warnings: any[] = R.warnings || [];
  const notes: any[] = Array.isArray(R.notes) ? R.notes : [];
  const ql = q.trim().toLowerCase();
  const shown = (p: any) => (p.cards || []).filter((c: any) => match(c, filter) && (showHidden ? hidden.includes(String(c.id)) : !hidden.includes(String(c.id))) && (!ql || (c.id + ' ' + c.fullText).toLowerCase().includes(ql)));
  const phases = R.phases.map((p: any) => ({ p, cards: shown(p) })).filter((x: any) => x.cards.length);
  const byId = new Map<string, any>((R.cards || []).map((c: any) => [c.id, c]));
  const slug = String(boot.data.repo?.slug || '');
  const work = (c: any) => {
    const step = nextStep(c, slug);
    if (!step.canWork) { toast(step.text); return; }
    resume?.({ kind: 'work', id: c.id, taskId: c.id, text: c.fullText || c.title });
  };
  // Writing a prompt is not dispatch: any row can go to Founder Capture; the gates still hold at Start job.
  const writePrompt = (c: any) => resume?.({ kind: 'work', id: c.id, taskId: c.id, text: c.fullText || c.title });
  const show = (id: string) => { const c = byId.get(id); setFilter('all'); setShowHidden(false); setQ(c ? '' : id); setOpenIds(ids => ids.includes(id) ? ids : [...ids, id]); };
  const ACTIVE = ['queued', 'spawning', 'accepted', 'running'];
  const jobFor = (id: string) => jobs.find(j => j?.taskId === id && ACTIVE.includes(j.status));
  // Each row starts on its own. One start does not wait for, or cancel, another.
  const buildRow = async (c: any) => {
    const id = String(c.id);
    const step = nextStep(c, slug);
    if (!step.canWork) { toast(step.text); return; }
    if (building.includes(id)) return;
    if (!target) { toast('No builder agent is installed yet.'); return; }
    setBuilding(ids => ids.includes(id) ? ids : [...ids, id]);
    try {
      const compileTarget = ['claude', 'claude-code', 'codex', 'gemini', 'hermes', 'claude-terminal'].includes(target) ? target : undefined;
      const made: any = await compile({ taskId: id, fields: { intent: String(c.fullText || c.title || '') }, ...(compileTarget ? { target: compileTarget } : {}) });
      if (!made.dispatch?.ready) { toast(`${id} is not ready: ${(made.readiness?.blockers || []).join('; ') || 'the gates held it.'}`); return; }
      const prompt = String(made.prompt || '');
      if (!prompt || prompt.length > 30000) { toast(`${id} brief is longer than one job can carry.`); return; }
      await jobsStart({ requestId: newId('job'), taskId: id, target, prompt, context: { dispatchReceiptId: made.dispatch.receiptId } });
      toast(`${id} started.`);
      const r: any = await builder('/jobs');
      setJobs((Array.isArray(r.jobs) ? r.jobs : []).filter(Boolean));
    } catch (e: any) { toast(e?.message || 'The job did not start.'); }
    finally { setBuilding(ids => ids.filter(x => x !== id)); }
  };

  return (<>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {([
        ['all', `${C.rows ?? 0} rows`],
        ['open', 'Open'],
        ['checked', `${C.checkedRows ?? 0} ticked`],
        ['conflict', `${C.checkboxDpgConflicts ?? 0} contradictions`],
      ] as [Filter, string][]).map(([f, label]) => (
        <button key={f} type="button" onClick={() => setFilter(f)} className={`${filter === f ? 'text-[var(--gold-text)]' : 'text-[var(--shade-color)] hover:text-[var(--gold-text)]'}`}>{label}</button>
      ))}
      <button type="button" onClick={() => setShowHidden(v => !v)} className={`${showHidden ? 'text-[var(--gold-text)]' : 'text-[var(--shade-color)] hover:text-[var(--gold-text)]'}`}>{showHidden ? 'Back to the list' : `Hidden (${hidden.length})`}</button>
      <span className="text-[var(--shade-color)]">{C.declaredIdSlots ?? 0} declared ids · {C.singleRows ?? 0} single · {C.rangeRows ?? 0} ranges</span>
    </div>
    {R.source && <p className="text-xs text-[var(--shade-color)] mt-2">
      Read from {srcUrl(R.source) ? <a className="mono-code text-[var(--gold-text)]" href={srcUrl(R.source)!} target="_blank" rel="noreferrer">{R.source.path}</a> : <span className="mono-code">{R.source.path || '(no path)'}</span>} at <span className="mono-code">{String(R.source.commit || '').slice(0, 7)}</span>{R.version ? ` · ${R.version}` : ''}.
    </p>}

    {warnings.length > 0 && <Fold id="build.warnings" title={`Warnings (${warnings.length})`}>
      <div className="space-y-2">{warnings.map((w, i) => (
        <p key={(w.code || 'w') + i} className="text-xs text-[var(--text-secondary)]">
          <span className="mono-code text-[var(--text-main)]">{w.code}</span>{w.note ? ` ${w.note}` : ''}
          {Array.isArray(w.ids) && w.ids.length > 0 && <span> {w.ids.map((id: string) => (
            <button key={id} type="button" className="ml-2 text-[var(--gold-text)]" onClick={() => show(id)}>{id}</button>
          ))}</span>}
        </p>
      ))}</div></Fold>}

    {notes.length > 0 && <p className="text-xs text-[var(--shade-color)] mt-2">{notes.map(n => n.note).filter(Boolean).join(' ')}</p>}

    <div className="flex flex-wrap items-center gap-2 mb-3">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search rows" className="input-work-gold rounded px-2 py-1 text-xs flex-1 min-w-[8rem]" />
      <label className="flex items-center gap-2 text-xs text-[var(--shade-color)]">
        <span>Build with</span>
        <select aria-label="Build agent" value={target} onChange={e => setTarget(e.target.value)} className="text-xs input-work-gold rounded px-2 py-0.5">
          {targets.length === 0 && <option value="">No builder agents</option>}
          {targets.map(t => { if (!t) return null; const off = !t.installed || (t.probed && !t.ready); return <option key={t.target} value={t.target} disabled={off}>{t.name || t.target}{!t.installed ? ' (not installed)' : t.probed ? (t.ready ? ' · ready' : ' · not ready') : ''}</option>; })}
        </select>
      </label>
    </div>
    {jobs.some(j => ACTIVE.includes(j.status)) && <p className="text-xs text-[var(--shade-color)] mb-2">Building now: {jobs.filter(j => ACTIVE.includes(j.status)).map(j => j.taskId).join(', ')}</p>}
    {!phases.length && <p className="text-xs text-[var(--shade-color)]">No rows match.</p>}
    <div className="flex gap-3 overflow-x-auto pb-2">
      {phases.map(({ p, cards }: any) => {
        const min = minPhases.includes(String(p.n));
        return (
        <div key={p.n} className={`${min ? 'w-[44px] min-w-[44px]' : 'min-w-[240px] flex-1'} flex flex-col max-h-[70vh] rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]`}>
          <div className={`flex ${min ? 'flex-col items-center gap-2 py-2' : 'items-center justify-between gap-2 px-3 py-2.5'} border-b border-[var(--border-color)] text-xs uppercase tracking-wide text-[var(--text-main)]`}>
            {min ? <span className="[writing-mode:vertical-rl] whitespace-nowrap cursor-pointer" onClick={() => togglePhase(String(p.n))}>Phase {p.n}: {p.name}</span> : <span>Phase {p.n}: {p.name}</span>}
            <span className="flex items-center gap-1.5 normal-case tracking-normal">
              <span className="rounded-full px-2 py-0.5 bg-[var(--bg-panel)] text-[var(--shade-color)]">{cards.length}</span>
              <FoldButton open={!min} onToggle={() => togglePhase(String(p.n))} label={`phase ${p.n}`} />
            </span>
          </div>
          {!min && <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
            {cards.map((c: any) => {
              const step = nextStep(c, slug);
              const isOpen = openIds.includes(String(c.id));
              const isHidden = hidden.includes(String(c.id));
              const running = jobFor(String(c.id));
              const url = lineUrl(R.source, c.sourceLine);
              return (
                <div key={c.id} className={`rounded border ${isOpen ? 'border-[var(--gold)]' : 'border-[var(--border-color)] hover:border-[var(--gold)]'} bg-[var(--bg-panel)]`}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpenIds(ids => isOpen ? ids.filter(x => x !== String(c.id)) : [...ids, String(c.id)])} className="w-full text-left px-3 py-2.5">
                    <div className="mono-code text-xs text-[var(--gold-text)]">{c.id}{c.sourceChecked ? ' · ticked' : ''}{running ? ` · ${running.status}` : ''}</div>
                    <div className={`text-xs text-[var(--text-main)] leading-snug mt-0.5 ${isOpen ? '' : 'line-clamp-4'}`}>{isOpen ? (c.fullText || c.title) : c.title}</div>
                    <div className="flex gap-1 mt-1.5"><Tick on={!!c.d} letter="D" name="Documents" /><Tick on={!!c.p} letter="P" name="Programming" /><Tick on={!!c.g} letter="G" name="Git" /></div>
                  </button>
                  {isOpen && <div className="px-3 pb-3 text-xs text-[var(--text-secondary)] space-y-2">
                    <p className={step.canWork ? 'text-[var(--text-main)]' : ''}>{step.text}</p>
                    <div className="flex flex-wrap gap-2">
                      {step.canWork
                        ? <>
                          <button type="button" className="btn-var16" disabled={building.includes(String(c.id))} onClick={() => { void buildRow(c); }}>{building.includes(String(c.id)) ? 'Starting…' : 'Build'}</button>
                          <button type="button" className="btn-var16" onClick={() => work(c)}>Work this row</button>
                        </>
                        : <button type="button" className="btn-var16" onClick={() => writePrompt(c)} title="Loads the row into Founder Capture. Nothing is sent; the gates above still hold at Build.">Write a prompt for it</button>}
                      {url && <a className="text-xs px-2 py-0.5 rounded border border-[var(--border-color)] text-[var(--shade-color)] hover:text-[var(--gold-text)]" href={url} target="_blank" rel="noreferrer">Open in roadmap</a>}
                      <button type="button" className="text-xs px-2 py-0.5 rounded border border-[var(--border-color)] text-[var(--shade-color)] hover:text-[var(--gold-text)]" onClick={() => toggleHidden(String(c.id))}>{isHidden ? 'Unhide' : 'Hide'}</button>
                    </div>
                  </div>}
                </div>
              );
            })}
          </div>}
        </div>);
      })}
    </div>
  </>);
}
