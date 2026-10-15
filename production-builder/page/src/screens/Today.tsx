import React, { useState } from 'react';
import { builder, newId } from '../api';
import { Bar, Card, H2, Pill, ScreenProps, Status, useLoad } from './ui';
import { fmtTime, fmtWhen } from '../format';
import { nextStep } from './BuildList';

// Today: the next open roadmap cards in priority order, phase progress, due reminders and open requests.
// Routes: GET /api/builder/bootstrap, GET /api/builder/reminders, GET /api/builder/state, POST /api/builder/events (reminder.create, reminder.ack).
const rank = (p: string) => { const m = /^(FIX|BUILD)-(\d+)/.exec(p || ''); return m ? (m[1] === 'FIX' ? 0 : 100) + Number(m[2]) : 1000; };

export default function Today({ toast, resume, go }: ScreenProps) {
  const boot = useLoad<any>(() => builder('/bootstrap'));
  const rem = useLoad<any>(() => builder('/reminders'));
  const st = useLoad<any>(() => builder('/state'));
  const [q, setQ] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  if (!boot.data) return <Status error={boot.error} />;
  const R = boot.data.roadmap;
  const cards: any[] = R.cards;
  const done = cards.filter(c => c.reportedStatus !== 'open').length;
  const open = cards.filter(c => c.reportedStatus === 'open');
  const next = [...open].sort((a, b) => rank(a.priority) - rank(b.priority) || Number(a.sourceOrder) - Number(b.sourceOrder))
    .filter(c => !q || (c.id + ' ' + c.title).toLowerCase().includes(q.toLowerCase())).slice(0, 12);
  const today = new Date().toLocaleDateString('en-CA');
  const todayEvents = (st.data?.diary || []).filter((e: any) => e.date === today).length;
  const openRequests = (st.data?.requests || []).filter((r: any) => !['done', 'failed', 'cancelled'].includes(r.status));

  const addReminder = async () => {
    if (!title.trim() || !due) { toast('Give the reminder a title and a time.'); return; }
    try { const id = newId('rem'); await builder('/events', { type: 'reminder.create', requestId: id, payload: { id, title: title.trim(), dueAt: new Date(due).toISOString() } }); setTitle(''); setDue(''); rem.reload(); st.reload(); toast('Reminder saved.'); }
    catch (e: any) { toast(e.message); }
  };
  const ack = async (id: string) => {
    try { await builder('/events', { type: 'reminder.ack', requestId: newId('ack'), payload: { id } }); rem.reload(); } catch (e: any) { toast(e.message); }
  };

  const openSaved = (r: any) => {
    const thread = (st.data?.conversations || []).filter((m: any) => m && (m.requestId === r.id || m.conversationId === r.conversationId || String(m.id || '').startsWith(r.id + ':')))
      .sort((a: any, b: any) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    if (r.kind === 'compiled-instruction') {
      if (!r.text) { toast('This compile kept a hash only. The prompt was not stored, so there is nothing to open.'); return; }
      resume?.({ kind: 'prompt', id: r.id, text: r.text });
      return;
    }
    const messages = thread.length
      ? thread.map((m: any) => ({ id: String(m.id), speaker: m.role === 'user' ? 'Founder' : (m.provider || 'Reply'), role: m.role === 'user' ? 'founder' as const : 'model' as const, time: m.createdAt ? fmtTime(new Date(m.createdAt)) : '', text: String(m.text || '') }))
      : (r.text ? [{ id: r.id, speaker: 'Founder', role: 'founder' as const, time: '', text: String(r.text) }] : []);
    if (!messages.length) { toast('Nothing was stored for this request.'); return; }
    resume?.({ kind: 'chat', id: r.id, conversationId: r.conversationId || thread[0]?.conversationId, provider: r.provider, messages });
  };

  return (<>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {([
        [String(R.counts.rows), 'Roadmap rows', () => go?.('build', 'all')],
        [`${done} · ${R.counts.rows ? Math.round((done / R.counts.rows) * 100) : 0}%`, 'Ticked in the roadmap', () => go?.('build', 'checked')],
        [String(open.length), 'Open', () => go?.('build', 'open')],
        [String(todayEvents), 'Builder entries today', () => go?.('diary')],
      ] as [string, string, () => void][]).map(([n, label, onClick]) => (
        <button key={label} type="button" onClick={onClick} className="text-left rounded px-1 py-1 hover:bg-[var(--bg-panel)]">
          <div className="text-lg font-semibold text-[var(--gold-text)] ">{n}</div>
          <div className="text-xs text-[var(--shade-color)] mt-0.5">{label}</div>
        </button>
      ))}
    </div>

    <H2>Next actions</H2>
    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search open cards" className="input-work-gold rounded px-2 py-1 text-xs w-full mb-2" />
    <div className="space-y-2">{next.map(c => {
      const step = nextStep(c, String(boot.data?.repo?.slug || ''));
      return (
      <div key={c.id} className="py-2 border-b border-[var(--border-color)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-[var(--text-main)]"><span className="mono-code text-[var(--gold-text)]">{c.id}</span> {c.title}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">{step.text}</div>
          </div>
          {step.canWork && <button className="btn-var16 shrink-0" onClick={() => resume?.({ kind: 'work', id: c.id, taskId: c.id, text: c.fullText || `${c.id} ${c.title}` })}>Work</button>}
        </div>
      </div>
      );
    })}
      {!next.length && <p className="text-xs text-[var(--shade-color)]">No open cards match.</p>}
    </div>

    <H2>Reminders</H2>
    <div className="flex gap-2 mb-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Remind me to…" className="input-work-gold rounded px-2 py-1 text-xs flex-1" />
      <input type="datetime-local" value={due} onChange={e => setDue(e.target.value)} className="input-work-gold rounded px-2 py-1 text-xs" />
      <button className="btn-var16" onClick={addReminder}>Add</button>
    </div>
    {rem.data ? (rem.data.reminders.length ? <div className="space-y-2">{rem.data.reminders.map((r: any) => (
      <Card key={r.id} title={r.title}>
        <div className="flex items-center justify-between"><span className="mono-code">{fmtWhen(r.dueAt)}{r.status === 'due' ? ' · due' : r.status ? ` · ${r.status}` : ''}</span>
          {r.status !== 'acknowledged' && <Pill onClick={() => ack(r.id)}>Done</Pill>}</div>
      </Card>))}</div> : <p className="text-xs text-[var(--shade-color)]">No reminders.</p>) : <Status error={rem.error} />}

    {openRequests.length > 0 && (<><H2>Open requests</H2>
      <div className="space-y-1">{openRequests.slice(0, 10).map((r: any) => {
        const label = r.kind === 'compiled-instruction'
          ? `Compiled instruction${r.taskId ? ' · ' + r.taskId : ''}`
          : (r.text ? String(r.text).replace(/\s+/g, ' ').slice(0, 72) : (r.title || r.id));
        return (
          <div key={r.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-[var(--border-color)]">
            <span className="text-xs text-[var(--text-main)] min-w-0 truncate">{label}<span className="text-[var(--shade-color)]"> · {r.status}</span></span>
            <button className="btn-var16 shrink-0" onClick={() => openSaved(r)}>Open</button>
          </div>
        );
      })}</div></>)}

    <H2>Phases</H2>
    <div className="space-y-2">{R.phases.map((p: any) => {
      const t = p.cards.length, d = p.cards.filter((c: any) => c.reportedStatus !== 'open').length;
      return <div key={p.n} className="text-xs"><div className="flex justify-between mb-1"><span>{p.n}. {p.name}</span><span className="mono-code text-[var(--shade-color)]">{d} / {t}</span></div><Bar pct={t ? (d / t) * 100 : 0} /></div>;
    })}</div>
  </>);
}
