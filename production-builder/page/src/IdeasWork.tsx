import React, { useEffect, useState } from 'react';
import { builder, compile, jobsStart, jobsCancel, laneStatus, lane, newId, IdeaAnswer } from './api';
import { laneName } from './format';
import { Fold } from './screens/ui';

// Centre view: the prompt from POST /ideas/prompt, Start job (POST /compile -> POST /jobs),
// running jobs with Cancel (POST /jobs/:id/cancel), and the lane bridge (GET /api/lane/status, POST /api/lane).
type Props = { prompt: any; idea: string; taskId: string; answers: IdeaAnswer[]; onCopy: () => void; onEvidence: () => void; toast: (m: string) => void; showPrompt?: boolean };
const ACTIVE = ['queued', 'spawning', 'accepted', 'running'];

export default function IdeasWork({ prompt, idea, taskId, onCopy, toast, showPrompt = true }: Props) {
  const [targets, setTargets] = useState<any[]>([]);
  const [target, setTarget] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [lanes, setLanes] = useState<any[] | null>(null);
  const [laneErr, setLaneErr] = useState<string | null>(null);
  const [laneQ, setLaneQ] = useState('');
  const [laneOut, setLaneOut] = useState<any>(null);

  const loadJobs = () => builder<any>('/jobs').then(r => { setJobs((Array.isArray(r.jobs) ? r.jobs : []).filter(Boolean)); const ts = (Array.isArray(r.targets) ? r.targets : []).filter(Boolean); setTargets(ts); if (!target) { const t = ts.find((x: any) => x.installed); if (t) setTarget(t.target); } }).catch(() => {});
  // Each agent's own --help probe, once per page load, so the list says ready or not ready with the reason.
  useEffect(() => { builder<any>('/jobs/targets?probe=1').then(r => { const ts = (Array.isArray(r?.targets) ? r.targets : []).filter(Boolean); if (ts.length) setTargets(ts); }).catch(() => {}); }, []);
  useEffect(() => { loadJobs(); const t = setInterval(loadJobs, 5000); return () => clearInterval(t); }, []);
  useEffect(() => { laneStatus().then((r: any) => setLanes((Array.isArray(r.lanes) ? r.lanes : []).filter(Boolean))).catch((e: any) => setLaneErr(e.message)); }, []);

  const startJob = async () => {
    if (!prompt?.prompt) return;
    if (!taskId) { toast('A job needs a roadmap card. Enter it under the idea box.'); return; }
    if (!target) { toast('No builder agent is installed yet.'); return; }
    setBusy(true);
    try {
      const c: any = await compile({ idea, taskId, fields: prompt.fields || {}, target });
      if (!c.dispatch?.ready) { toast('Not ready: ' + (c.readiness?.blockers || []).join('; ')); return; }
      await jobsStart({ requestId: newId('job'), taskId, target, prompt: String(c.prompt).slice(0, 30000), context: { dispatchReceiptId: c.dispatch.receiptId } });
      toast('Job started.'); loadJobs();
    } catch (e: any) { toast(e.message); } finally { setBusy(false); }
  };
  const cancel = async (id: string) => { try { await jobsCancel(id); loadJobs(); toast('Cancel sent.'); } catch (e: any) { toast(e.message); } };
  const askLane = async () => {
    if (!laneQ.trim()) return;
    setLaneOut({ pending: true });
    try { setLaneOut(await lane({ prompt: laneQ.trim() })); } catch (e: any) { setLaneOut({ error: e.message }); }
  };

  // Each block can be minimized to its title (− / +); Jobs and Lane bridge are audits next to the job.
  return (<>
    <Fold id="ideas.brief" title="Build brief" right={<button onClick={onCopy} disabled={!prompt?.prompt} className="btn-var16">Copy prompt</button>}>
    {showPrompt && (prompt?.prompt ? (<>
      {prompt.why && <p className="text-xs text-[var(--text-secondary)] mb-3 whitespace-pre-wrap">{typeof prompt.why === 'string' ? prompt.why : JSON.stringify(prompt.why)}</p>}
      <pre className="card-var16 text-xs mono-code whitespace-pre-wrap max-h-[50vh] overflow-y-auto" style={{ margin: 0 }}>{prompt.prompt}</pre>
      {Array.isArray(prompt.repoNotes) && prompt.repoNotes.length > 0 && <ul className="text-xs text-[var(--shade-color)] mt-2 list-disc pl-4">{prompt.repoNotes.map((n: string) => <li key={n}>{n}</li>)}</ul>}
    </>) : <p className="text-xs text-[var(--shade-color)]">Write an idea on the left and press Send. The prompt the Builder makes appears here.</p>)}
    {prompt?.prompt && <div className="flex items-center gap-2 mt-3">
      <select value={target} onChange={e => setTarget(e.target.value)} className="text-xs input-work-gold rounded px-2 py-0.5">
        {targets.length === 0 && <option value="">No builder agents</option>}
        {targets.map(t => { if (!t) return null; const off = !t.installed || (t.probed && !t.ready); return <option key={t.target} value={t.target} disabled={off} title={t.reason || ''}>{t.name || t.target}{!t.installed ? ' (not installed)' : t.probed ? (t.ready ? ' · ready' : ' · not ready') : ''}</option>; })}
      </select>
      <button onClick={startJob} disabled={busy} className="btn-var16">Start job</button>
    </div>}
    {!prompt?.prompt && !showPrompt && <p className="text-xs text-[var(--shade-color)]">When the prompt is written, Copy prompt and Start job work on it here.</p>}
    </Fold>

    <Fold id="ideas.jobs" title={`Jobs${jobs.length ? ` (${jobs.length})` : ''}`}>
    {jobs.length ? <div className="space-y-2">{[...jobs].reverse().slice(0, 10).map(j => { if (!j) return null; return (
      <div key={j.id} className="card-var16 text-xs flex items-center justify-between" style={{ margin: 0 }}>
        <span><span className="mono-code text-[var(--gold-text)]">{j.taskId}</span> · {j.target} · {j.status}{j.error ? ' · ' + j.error : ''}</span>
        {ACTIVE.includes(j.status) && <button onClick={() => cancel(j.id)} className="text-xs text-[var(--shade-color)] hover:text-[var(--error)]">Cancel</button>}
      </div>); })}</div> : <p className="text-xs text-[var(--shade-color)]">No jobs yet.</p>}
    </Fold>

    <Fold id="ideas.lane" title="Lane bridge">
    {laneErr ? <p className="text-xs text-[var(--shade-color)]">{laneErr}</p> : lanes === null ? <p className="text-xs text-[var(--shade-color)]">Checking…</p> :
      <div className="text-xs space-y-1">{lanes.length ? lanes.map(l => { if (!l) return null; return <div key={l.id}>{laneName(l.label || l.id)} · {l.reachable ? 'online' : 'offline'}{l.keyPresent ? '' : ' · not set up'}</div>; }) : 'No lanes configured.'}</div>}
    <div className="flex gap-2 mt-2">
      <input value={laneQ} onChange={e => setLaneQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') askLane(); }} placeholder="Ask the lane" className="flex-1 input-work-gold rounded px-2 py-1 text-xs" />
      <button onClick={askLane} className="btn-var16">Ask</button>
    </div>
    {laneOut && <div className="card-var16 text-xs mt-2 whitespace-pre-wrap" style={{ margin: 0 }}>{laneOut.pending ? 'Waiting for the lane…' : laneOut.error ? laneOut.error : `${laneOut.text || ''}${laneOut.lane ? `\n\n— ${laneName(typeof laneOut.lane === 'object' ? (laneOut.lane.label || laneOut.lane.id || '') : String(laneOut.lane))}` : ''}`}</div>}
    </Fold>
  </>);
}
