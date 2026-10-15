import React, { useState } from 'react';
import { builder, call, newId } from '../api';
import { Card, H2, Pill, ScreenProps, Status, useLoad } from './ui';
import { fmtDayKey, fmtTime } from '../format';

// Diary: the Builder's own record by day (state.diary is the event log, dated in Africa/Windhoek) plus notes.
// Routes: GET /api/builder/state, POST /api/builder/events (note.create),
// outside POST /api/diary/save-chat (publishes the day to the Daily-Diary repo; asks first, confirmExternalSend).
const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA');
const shiftDay = (d: string, n: number) => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() + n); return t.toLocaleDateString('en-CA'); };
const LABEL: Record<string, string> = {
  'note.create': 'Note', 'idea.create': 'Idea saved', 'idea.update': 'Idea changed', 'idea.archive': 'Idea archived', 'idea.delete': 'Idea deleted',
  'reminder.create': 'Reminder set', 'reminder.ack': 'Reminder done', 'request.create': 'Request', 'request.update': 'Request updated',
  'job.upsert': 'Job', 'debug.create': 'Bug reported', 'conversation.append': 'Chat', 'attachment.create': 'Attachment', 'draft.upsert': 'Draft',
};

export default function Diary({ toast }: ScreenProps) {
  const [day, setDay] = useState(new Date().toLocaleDateString('en-CA'));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const st = useLoad<any>(() => builder('/state'));
  if (!st.data) return <Status error={st.error} />;
  const events = (st.data.diary as any[]).filter(e => e.date === day);
  const notes = (st.data.notes as any[]).filter(n => n.createdAt && dayOf(n.createdAt) === day && !n.archivedAt && !n.deletedAt);
  const days = [...new Set((st.data.diary as any[]).map(e => e.date))].sort().reverse().slice(0, 30) as string[];

  const addNote = async () => {
    if (!text.trim()) return;
    try { const id = newId('note'); await builder('/events', { type: 'note.create', requestId: id, payload: { id, text: text.trim() } }); setText(''); st.reload(); toast('Saved to the diary.'); }
    catch (e: any) { toast(e.message); }
  };
  const publish = async () => {
    if (!notes.length) { toast('Nothing written on this day yet.'); return; }
    if (!window.confirm(`Publish ${fmtDayKey(day)} to the Daily-Diary repo on GitHub?`)) return;
    setBusy(true);
    try {
      const markdown = `# ${day}\n\n` + notes.map(n => `- ${String(n.text || n.title || '').replace(/\n/g, ' ')}`).join('\n') + '\n';
      const r: any = await call('/api/diary/save-chat', { date: day, title: `Diary ${day}`, markdown, confirmExternalSend: true });
      toast(r.path ? `Published ${r.path}.` : 'Published.');
    } catch (e: any) { toast(e.message); } finally { setBusy(false); }
  };

  return (<>
    <div className="flex items-center gap-2 mb-4">
      <button className="btn-var16" onClick={() => setDay(shiftDay(day, -1))}>‹</button>
      <span className="mono-code text-xs">{fmtDayKey(day)}</span>
      <input type="date" lang="en-GB" value={day} onChange={e => e.target.value && setDay(e.target.value)} className="input-work-gold rounded px-2 py-0.5 text-xs" aria-label="Pick a day" />
      <button className="btn-var16" onClick={() => setDay(shiftDay(day, 1))}>›</button>
      <button className="btn-var16" onClick={() => setDay(new Date().toLocaleDateString('en-CA'))}>Today</button>
    </div>

    <textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Write what happened, what you decided, what is next."
      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(); }}
      className="w-full input-work-gold rounded p-2.5 text-xs leading-relaxed" />
    <div className="flex justify-end gap-2 mt-2">
      <button className="text-xs text-[var(--shade-color)] hover:text-[var(--gold-text)]" disabled={busy} onClick={publish}>Publish day to Daily-Diary</button>
      <button className="btn-var16" onClick={addNote}>Save</button>
    </div>

    <H2>Notes · {notes.length}</H2>
    <div className="space-y-2">{notes.length ? notes.map(n => (
      <Card key={n.id} title={<span className="mono-code text-[var(--shade-color)]">{fmtTime(new Date(n.createdAt))}</span>}>
        <span className="text-[var(--text-main)] whitespace-pre-wrap">{n.text || n.title}</span>
      </Card>)) : <p className="text-xs text-[var(--shade-color)]">No notes this day.</p>}</div>

    <H2>Builder record · {events.length}</H2>
    <div className="space-y-1">{events.length ? events.map(e => (
      <div key={e.revision} className="text-xs flex gap-2"><span className="mono-code text-[var(--shade-color)]">{fmtTime(new Date(e.createdAt))}</span>
        <span className="text-[var(--text-main)]">{LABEL[e.type] || e.type}</span><span className="mono-code text-[var(--shade-color)] truncate">{e.entityId}</span></div>)) : <p className="text-xs text-[var(--shade-color)]">Nothing recorded this day.</p>}</div>

    {days.length > 0 && (<><H2>Days with entries</H2>
      <div className="flex flex-wrap gap-2">{days.map(d => <Pill key={d} on={d === day} onClick={() => setDay(d)}>{fmtDayKey(d)}</Pill>)}</div></>)}
  </>);
}
