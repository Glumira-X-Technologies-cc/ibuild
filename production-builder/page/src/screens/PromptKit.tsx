import React, { useEffect, useState } from 'react';
import { ApiError, IdeaAnswer, compile, ideasPrompt, ideasRef, ideasStep, ideasToolkit, ideasWeb } from '../api';
import { Card, Fold, H2, Pill, Pre, ScreenProps, Status, useLoad } from './ui';
import { fmtWhen } from '../format';

// One idea process, used by the idea page and by Prompt kit. Same steps: question, goal, prompt, research, toolkit.
const lines = (v: any): string[] => Array.isArray(v) ? v.map(x => typeof x === 'string' ? x : x?.text || x?.ask || '').filter(Boolean)
  : v && typeof v === 'object' ? Object.values(v).flatMap(lines) : typeof v === 'string' && v ? [v] : [];
// A question option is a string or an object such as { id, label }; show its label, never "[object Object]".
export const optionLabel = (o: any): string => typeof o === 'string' ? o
  : o && typeof o === 'object' ? String(o.label ?? o.text ?? o.ask ?? o.value ?? o.id ?? '') : o == null ? '' : String(o);
const errText = (e: any) => e instanceof ApiError && e.code === 'ROUTING_MAP_STALE'
  ? `The routing map does not match the repository, so no prompt can be written until it is updated. ${e.message}`
  : e instanceof ApiError && e.code === 'NO_SOURCE' ? `The Builder cannot read its source repository. ${e.message}` : e?.message || String(e);

const PLAYBACK: [string, string][] = [['Tool', 'tool'], ['Does', 'does'], ['Returns', 'returns'], ['Files', 'files'], ['Role', 'role'], ['Done when', 'done']];
// The goal card in plain words (founder mark-up 2026-10-15 on "Is this the goal?": "BETTER LAYOUT AND TEXT").
// The labels say what each line means for him; the stored answers are not changed.
const GOAL_ROWS: [string, string][] = [['Runs in', 'tool'], ['Kind of work', 'does'], ['You get back', 'returns'], ['Files', 'files'], ['Who does it', 'role'], ['Done when', 'done']];
const PLAIN: Record<string, string> = {
  'Not sure: it lists the files first and waits for my yes': 'It lists the files first and waits for your yes',
  'No files: a plan or review only': 'No files change: a plan or a review only',
  'Not sure, you choose': 'The Builder picks, see below',
  'Not sure yet': 'The Builder picks',
};
const ROLE_CHOICES = ['A builder who makes the change', 'A reviewer who only reports', 'A planner who plans first', 'A designer for look and layout'];

function useLocal(toast: (m: string) => void): NonNullable<ScreenProps['idea']> {
  const [idea, setIdea] = useState('');
  const [answers, setAnswers] = useState<IdeaAnswer[]>([]);
  const [step, setStep] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = async (label: string, fn: () => Promise<void>) => { setBusy(label); setError(null); try { await fn(); } catch (e: any) { setError(errText(e)); } finally { setBusy(''); } };
  const ask = (next: IdeaAnswer[]) => run('Thinking…', async () => {
    const s = await ideasStep({ idea: idea.trim(), answers: next });
    setAnswers(next); setStep(s); setResult(null);
    if (s.blocked) setError(s.stale ? errText(new ApiError(s.blocked, 409, 'ROUTING_MAP_STALE')) : s.blocked);
  });
  return {
    idea, answers, step, result, busy, error,
    onAnswer: (text: string) => { const q = step?.question; if (!q || !text.trim()) return; ask([...answers, { id: q.id, answer: text.trim(), ask: q.ask }]); },
    onWrite: (_pick?: unknown, extra: IdeaAnswer[] = []) => run('Writing the prompt…', async () => { setResult(await ideasPrompt({ idea: idea.trim(), answers: [...answers.filter(a => !extra.some(x => x.id === a.id)), ...extra], confirmed: true })); }),
    onReset: () => { setAnswers([]); setStep(null); setResult(null); setError(null); },
    // local idea text is read by the box below; Start uses ask([])
    ...( { setIdea, ask } as any ),
  };
}

export function IdeaFlow({ toast, idea: flow, onlyQuestions, showToolkit = true }: ScreenProps & { onlyQuestions?: boolean; showToolkit?: boolean }) {
  const local = useLocal(toast);
  const src = flow || local;
  const localBox = !flow;
  const [own, setOwn] = useState('');
  const [agentPick, setAgentPick] = useState<{ id: string; role?: string } | null>(null);
  const [changing, setChanging] = useState(false);
  // What only you know: optional answers to the step's know questions, carried word for word.
  const [know, setKnow] = useState<Record<string, string>>({});
  const knowAnswers = (): IdeaAnswer[] => Object.entries(know).filter(([, v]) => v.trim()).map(([id, answer]) => ({ id, answer: answer.trim() }));
  const [saved, setSaved] = useState<any>(null);
  const [ref, setRef] = useState<{ key?: string; label: string; text?: string; error?: string } | null>(null);
  const [kitQ, setKitQ] = useState('');
  const kit = useLoad<any>(() => ideasToolkit());
  const q = src.step?.question;
  useEffect(() => { setAgentPick(null); setChanging(false); }, [src.idea, q?.id]);
  useEffect(() => { setKnow({}); }, [src.idea]);
  const answer = (text: string) => { if (!text.trim()) return; setOwn(''); src.onAnswer(text); };
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast('Copied.'), () => toast('Could not copy.'));
  const save = () => {
    const body: Record<string, unknown> = { fields: { ...(src.result?.fields || {}), intent: src.result?.playback?.goal || src.idea.trim() } };
    compile(body).then((c: any) => { setSaved(c); toast('Saved to the prompt log.'); }).catch((e: any) => toast(e.message));
  };
  const open = (r: any, key?: string) => {
    const label = r.label || r.path;
    setRef({ key, label });
    const query = r.kind === 'local' && r.href?.includes('item=') ? { item: decodeURIComponent(r.href.split('item=')[1]) } : { path: r.path };
    ideasRef(query).then(text => setRef({ key, label, text })).catch(e => setRef({ key, label, error: e.message }));
  };
  const openWeb = (r: any) => {
    const label = r.label || r.url || 'Web page';
    setRef({ label });
    ideasWeb(String(r.sha256 || '')).then(text => setRef({ label, text })).catch(e => setRef({ label, error: e.message }));
  };
  const items: any[] = (Array.isArray(kit.data?.items) ? kit.data.items : []).filter((i: any) => i && typeof i === 'object');
  const agents = items.filter(i => i.kind === 'agent');
  const kitShown = items.filter(i => !kitQ || (String(i.id ?? '') + ' ' + String(i.description ?? '')).toLowerCase().includes(kitQ.toLowerCase())).slice(0, 30);
  const pb = src.step?.playback;
  // The Builder picks the agent, council and skills for the job (POST /ideas/step -> chosen, each with its reason).
  // They are used as they are; Change is only for the founder who wants another agent.
  const picks: any[] = (Array.isArray(src.step?.chosen) ? src.step.chosen : []).filter((c: any) => c && typeof c === 'object' && c.id);
  const pickedAgent = picks.find(c => c.kind === 'agent');
  const KIND_LABEL: Record<string, string> = { agent: 'Agent', council: 'Council', skill: 'Skill' };
  const webRefs: any[] = (Array.isArray(src.result?.references) ? src.result.references : []).filter((r: any) => r && r.kind === 'web');
  // Documents the prompt is built from: repository docs and folders (skills, agents and councils are listed with their reasons).
  const repoRefs: any[] = (Array.isArray(src.result?.references) ? src.result.references : []).filter((r: any) => r && (r.kind === 'repo-doc' || r.kind === 'repo'));
  const picks2: any[] = (Array.isArray(src.result?.chosen) && src.result.chosen.length ? src.result.chosen : picks).filter((c: any) => c && c.id);

  return (<>
    {localBox && !onlyQuestions && (<><H2>Idea</H2>
      <textarea value={(local as any).idea} onChange={e => (local as any).setIdea(e.target.value)} rows={3} placeholder="Describe what you want built or written" className="input-work-gold rounded px-2 py-1 text-xs w-full" />
      <div className="flex gap-2 mt-2">
        <button className="btn-var16" disabled={!src.idea.trim() || !!src.busy} onClick={() => { src.onReset(); (local as any).ask([]); }}>Start</button>
        {src.step && <Pill onClick={src.onReset}>Clear</Pill>}
      </div></>)}
    {src.busy && <p className="text-xs text-[var(--shade-color)] mt-2">{src.busy}</p>}
    {src.error && <p className="text-xs text-[var(--error)] mt-2">{src.error}</p>}

    {q && (<><H2>Question {Math.min((src.step.asked || 0) + 1, src.step.total || 1)} of {src.step.total || '?'}</H2>
      <Card title={q.ask}>
        <div className="flex flex-wrap gap-2 mt-1">{(Array.isArray(q.options) ? q.options : []).map(optionLabel).filter(Boolean).map((o: string, k: number) => <Pill key={k} onClick={() => answer(o)}>{o}</Pill>)}</div>
        <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
          <input value={own} onChange={e => setOwn(e.target.value)} onKeyDown={e => e.key === 'Enter' && answer(own)} placeholder="Or answer in your own words" className="input-work-gold rounded px-2 py-1 text-xs flex-1 min-w-0" />
          <button className="btn-var16 shrink-0" disabled={!own.trim() || !!src.busy} onClick={() => answer(own)}>Answer</button>
        </div>
      </Card></>)}

    {src.step && !q && pb && !src.result && (<><H2>Is this the goal?</H2>
      <div className="card-var16 text-xs text-[var(--text-secondary)] leading-relaxed" style={{ margin: 0 }}>
        <div className="text-xs uppercase tracking-wider text-[var(--shade-color)]">Your goal, word for word</div>
        <p className="mt-1 pl-2 border-l-2 border-[var(--gold)] text-[13px] leading-snug text-[var(--text-main)] whitespace-pre-wrap">{pb.goal}</p>
        <div className="text-xs uppercase tracking-wider text-[var(--shade-color)] mt-3">How the Builder will work it</div>
        <dl className="mt-1 grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1">
          {GOAL_ROWS.filter(([, k]) => pb[k]).map(([label, k]) => { const v = Array.isArray(pb[k]) ? pb[k].join(', ') : String(pb[k]); return (
            <React.Fragment key={k}><dt className="text-[var(--shade-color)]">{label}</dt><dd className="text-[var(--text-main)]">{PLAIN[v] || v}</dd></React.Fragment>); })}
          {src.step.area && <><dt className="text-[var(--shade-color)]">Where</dt><dd className="text-[var(--text-main)]">{src.step.area.label}, {src.step.area.count} files</dd></>}
        </dl>
        <div className="text-xs uppercase tracking-wider text-[var(--shade-color)] mt-3">Picked by the Builder</div>
        {picks.length ? <ul className="mt-1 space-y-1">{picks.map(c => (
          <li key={c.id}><span className="text-[var(--gold-text)]">{KIND_LABEL[c.kind] || c.kind}: {agentPick && !agentPick.role && c.kind === 'agent' ? agentPick.id : c.id}</span>{c.reason ? <span> · {c.reason}</span> : null}</li>))}</ul>
          : <p className="mt-1">No agent or skill is needed for this job; the prompt says who runs it.</p>}
        {agentPick?.role && <p className="mt-1 text-[var(--gold-text)]">You chose: {agentPick.role}</p>}
        {!showToolkit && <button type="button" className="mt-1 text-xs text-[var(--shade-color)] hover:text-[var(--gold-text)]" onClick={() => setChanging(v => !v)}>{changing ? "Keep the Builder's pick" : 'Change agent'}</button>}
        {changing && <div className="flex flex-wrap gap-2 mt-1">
          {agents.length ? agents.map(a => <Pill key={a.id} on={agentPick ? agentPick.id === a.id && !agentPick.role : pickedAgent?.id === a.id} onClick={() => { setAgentPick({ id: a.id }); setChanging(false); }}>{a.id}</Pill>)
            : ROLE_CHOICES.map(role => <Pill key={role} on={agentPick?.role === role} onClick={() => { setAgentPick({ id: role, role }); setChanging(false); }}>{role}</Pill>)}
        </div>}
        {Array.isArray(src.step.know) && src.step.know.length > 0 && <div className="mt-3">
          <div className="text-xs uppercase tracking-wider text-[var(--shade-color)]">What only you know <span className="normal-case tracking-normal">(optional, carried word for word)</span></div>
          {src.step.know.map((k: any) => (
            <div key={k.id} className="mt-2">
              <div>{k.ask}</div>
              <div className="flex flex-wrap gap-1.5 mt-1">{(Array.isArray(k.options) ? k.options : []).map((o: string) => <Pill key={o} on={know[k.id] === o} onClick={() => setKnow(v => ({ ...v, [k.id]: v[k.id] === o ? '' : o }))}>{o}</Pill>)}</div>
              <input value={know[k.id] && !(k.options || []).includes(know[k.id]) ? know[k.id] : ''} onChange={e => setKnow(v => ({ ...v, [k.id]: e.target.value }))} placeholder="Or in your own words" className="input-work-gold rounded px-2 py-1 text-xs w-full mt-1" />
            </div>))}
        </div>}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[var(--border-color)]"><Pill onClick={() => { setAgentPick(null); setChanging(false); src.onReset(); }}>No, start again</Pill>{/* founder 2026-10-15: "replace yes write prompt with send and move right" */}<button className="btn-gold ml-auto" disabled={!!src.busy} aria-label="Send: write the prompt" onClick={() => src.onWrite(agentPick || undefined, knowAnswers())}>Send</button></div>
      </div>
      {showToolkit && picks.length > 0 && <p className="text-xs text-[var(--shade-color)] mt-2">Toolkit picks: {picks.map((c: any) => String(c?.id ?? '')).join(', ')}</p>}
    </>)}

    {!onlyQuestions && src.result && (<>
      <Fold id="idea.prompt" title="Prompt">
        <Pre text={src.result.prompt || ''} />
        <div className="flex gap-2 mt-2">
          <Pill onClick={() => copy(src.result.prompt || '')}>Copy</Pill>
          <Pill onClick={save}>Save to prompt log</Pill>
        </div>
        {saved && <Card title={saved.dispatch?.ready ? 'Saved, ready' : 'Saved, not ready to run'}>
          Receipt <span className="mono-code">{saved.dispatch?.receiptId}</span>
          {lines(saved.readiness?.blockers).length > 0 && <ul className="list-disc pl-4 mt-1">{lines(saved.readiness.blockers).map((b, i) => <li key={i}>{b}</li>)}</ul>}
        </Card>}
      </Fold>
      {/* Research = everything the Builder gathered to prepare this prompt: the tool, the skills, agents and
          councils it picked from the skills home, the documents it read, the work area, notes, and web pages
          when the idea asked for them. Each item opens in place. */}
      <Fold id="idea.research" title={`Research: ${picks2.length} skills and agents, ${repoRefs.length} documents${webRefs.length ? `, ${webRefs.length} web pages` : ''}`}>
        {src.result.playback?.tool && <p className="text-xs text-[var(--text-secondary)]">Tool: <span className="text-[var(--text-main)]">{String(src.result.playback.tool)}</span></p>}
        <div className="text-xs uppercase tracking-wider text-[var(--shade-color)] mt-3 mb-1">Skills, agents and councils picked{kit.data?.items?.length ? ` (from ${kit.data.items.length} in the skills home)` : ''}</div>
        {picks2.length ? <div className="space-y-1.5">{picks2.map((c: any) => { const key = 'kit:' + c.id; return (
          <div key={key} className="card-var16 text-xs" style={{ margin: 0 }}>
            <div className="flex items-start justify-between gap-2">
              <div><span className="text-[var(--gold-text)]">{KIND_LABEL[c.kind] || c.kind}: {c.id}</span>{c.reason ? <span className="text-[var(--text-secondary)]"> · {c.reason}</span> : null}</div>
              <Pill on={ref?.key === key} onClick={() => ref?.key === key ? setRef(null) : open({ kind: 'local', href: 'item=' + encodeURIComponent(c.id), label: c.id }, key)}>{ref?.key === key ? 'Close' : 'Open'}</Pill>
            </div>
            {ref?.key === key && (ref.text !== undefined ? <Pre text={ref.text} /> : <Status error={ref.error || null} />)}
          </div>); })}</div> : <p className="text-xs text-[var(--shade-color)]">No skill, agent or council was needed for this job.</p>}
        <div className="text-xs uppercase tracking-wider text-[var(--shade-color)] mt-3 mb-1">Documents read ({repoRefs.length})</div>
        {repoRefs.length ? <div className="space-y-1.5">{repoRefs.map((r: any) => { const key = 'doc:' + r.n; return (
          <div key={key} className="card-var16 text-xs" style={{ margin: 0 }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="text-[var(--text-main)]">{r.label}</div><div className="mono-code break-all text-[var(--shade-color)]">{r.path}</div></div>
              <Pill on={ref?.key === key} onClick={() => ref?.key === key ? setRef(null) : open(r, key)}>{ref?.key === key ? 'Close' : 'Open'}</Pill>
            </div>
            {ref?.key === key && (ref.text !== undefined ? <Pre text={ref.text} /> : <Status error={ref.error || null} />)}
          </div>); })}</div> : <p className="text-xs text-[var(--shade-color)]">No repository document was read.</p>}
        {Array.isArray(src.result.files?.list) && src.result.files.list.length > 0 && (<>
          <div className="text-xs uppercase tracking-wider text-[var(--shade-color)] mt-3 mb-1">Work area: {String(src.result.files.label || src.result.files.dir || '')}</div>
          <ul className="list-disc pl-4 text-xs mono-code text-[var(--text-secondary)]">{src.result.files.list.map((p: string) => <li key={p} className="break-all">{p}</li>)}</ul></>)}
        {[...(Array.isArray(src.result.repoNotes) ? src.result.repoNotes : []), ...(Array.isArray(src.result.webNotes) ? src.result.webNotes : [])].length > 0 && (<>
          <div className="text-xs uppercase tracking-wider text-[var(--shade-color)] mt-3 mb-1">Notes</div>
          {[...(Array.isArray(src.result.repoNotes) ? src.result.repoNotes : []), ...(Array.isArray(src.result.webNotes) ? src.result.webNotes : [])].map((n: any, i: number) => <p key={i} className="text-xs text-[var(--text-secondary)]">{String(n)}</p>)}</>)}
        {webRefs.length > 0 && (<>
          <div className="text-xs uppercase tracking-wider text-[var(--shade-color)] mt-3 mb-1">Web pages read ({webRefs.length})</div>
          <div className="space-y-1.5">{webRefs.map((r: any) => (
            <div key={'web:' + r.n} className="card-var16 text-xs" style={{ margin: 0 }}>
              <div className="text-[var(--text-main)]">{r.label}</div>
              {(r.href || r.path) && <a className="mono-code break-all text-[var(--gold-text)]" href={r.href || r.path} target="_blank" rel="noreferrer">{r.href || r.path}</a>}
              <div>{r.fetchedAt ? `Read ${fmtWhen(r.fetchedAt)}` : 'Web page'}{r.warning ? <span className="text-[var(--error)]"> · {r.warning}</span> : null}</div>
              {r.saved && <div className="mt-1"><Pill onClick={() => openWeb(r)}>Open saved copy</Pill></div>}
            </div>))}</div></>)}
        {Array.isArray(src.result.unread) && src.result.unread.length > 0 && <p className="text-xs text-[var(--shade-color)] mt-2">Could not read: {src.result.unread.map((u: any) => `${u.url} (${u.reason})`).join('; ')}</p>}
      </Fold>
      {lines(src.result.why).length > 0 && <Fold id="idea.why" title="Why"><ul className="list-disc pl-4 text-xs text-[var(--text-secondary)] space-y-1">{lines(src.result.why).map((w, i) => <li key={i}>{w}</li>)}</ul></Fold>}
      {src.result.queue?.next && <Fold id="idea.roadmap" title="Roadmap"><p className="text-xs text-[var(--text-secondary)]">{src.result.queue.next}</p></Fold>}
      {(src.result.expert?.ask || src.result.expert?.do) && <Fold id="idea.expert" title="An expert would next"><ul className="list-disc pl-4 text-xs text-[var(--text-secondary)] space-y-1">{src.result.expert.ask && <li>Ask: {src.result.expert.ask}</li>}{src.result.expert.do && <li>Do: {src.result.expert.do}</li>}</ul></Fold>}
    </>)}

    {ref && !ref.key && !onlyQuestions && (<><H2>Source</H2>
      <div className="flex items-center justify-between mb-2"><span className="text-xs break-all">{ref.label}</span><Pill onClick={() => setRef(null)}>Close</Pill></div>
      {ref.text !== undefined ? <Pre text={ref.text} /> : <Status error={ref.error || null} />}</>)}

    {showToolkit && !onlyQuestions && (<Fold id="kit.toolkit" title="Toolkit">
      {kit.data ? <>
        <p className="text-xs text-[var(--shade-color)] mb-2">{kit.data.status}</p>
        <input value={kitQ} onChange={e => setKitQ(e.target.value)} placeholder="Search skills, agents and councils" className="input-work-gold rounded px-2 py-1 text-xs w-full mb-2" />
        {kitShown.length ? <div className="space-y-2">{kitShown.map(i => (
          <Card key={i.id} title={<span><span className="mono-code text-[var(--gold)]">{i.id}</span> · {i.kind}</span>}>
            <div className="line-clamp-2">{i.description}</div>
            <Pill onClick={() => open({ kind: 'local', href: 'item=' + encodeURIComponent(i.id), label: i.id })}>Open</Pill>
          </Card>))}</div> : <p className="text-xs text-[var(--shade-color)]">{items.length ? 'Nothing matches.' : 'The toolkit is empty.'}</p>}
      </> : <Status error={kit.error} />}</Fold>)}
  </>);
}

export default function PromptKit(props: ScreenProps) {
  return <IdeaFlow {...props} />;
}
