import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon, IconName } from '../icons';

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => { setError(null); fn().then(setData).catch(e => setError(e.message)); }, deps); // eslint-disable-line
  useEffect(reload, [reload]);
  useEffect(() => { window.addEventListener('builder-scanned', reload); return () => window.removeEventListener('builder-scanned', reload); }, [reload]);
  return { data, error, reload };
}
// Minimize: any block or card with a fold key can be folded to its title. The choice is kept per key
// in this browser (localStorage), so a folded audit stays folded after a reload.
export function useFold(key?: string, startOpen = true): [boolean, () => void] {
  const read = () => { if (!key) return startOpen; try { const v = localStorage.getItem('ais.fold.' + key); return v === null ? startOpen : v === '1'; } catch { return startOpen; } };
  const [open, setOpen] = useState<boolean>(read);
  const toggle = () => setOpen(o => { const n = !o; if (key) { try { localStorage.setItem('ais.fold.' + key, n ? '1' : '0'); } catch { /* storage blocked */ } } return n; });
  return [open, toggle];
}
// One small control for every icon or icon-and-label action (founder 2026-10-15, verbatim: "compact icon spacing
// and make them smaller" / "all the same"): one icon size, one label size, one tight gap, everywhere.
export const ACTION_ICON = 12;
export const IconAction: React.FC<{ icon?: IconName; label?: string; title?: string; onClick?: () => void; active?: boolean; danger?: boolean; spin?: boolean; className?: string }> = ({ icon, label, title, onClick, active, danger, spin, className = '' }) => (
  <button type="button" onClick={onClick} title={title} aria-label={title || label} aria-pressed={active === undefined ? undefined : active}
    className={`pb-action inline-flex items-center gap-1 px-1 py-0.5 leading-none rounded focus:outline-none transition-colors ${active ? 'text-[var(--gold-text)]' : 'text-[var(--shade-color)]'} ${danger ? 'hover:text-[var(--error)]' : 'hover:text-[var(--gold-text)]'} ${className}`}>
    {icon && <Icon name={icon} size={ACTION_ICON} className={spin ? 'animate-spin' : ''} />}
    {label && <span>{label}</span>}
  </button>
);
export const FoldButton: React.FC<{ open: boolean; onToggle: () => void; label?: string }> = ({ open, onToggle, label }) => (
  <button type="button" onClick={e => { e.stopPropagation(); onToggle(); }} aria-expanded={open}
    title={open ? `Minimize${label ? ' ' + label : ''}` : `Show${label ? ' ' + label : ''}`}
    className="pb-action shrink-0 w-4 h-4 inline-flex items-center justify-center rounded border border-[var(--border-color)] text-[var(--shade-color)] hover:text-[var(--gold-text)] hover:border-[var(--gold)] leading-none">
    {open ? '−' : '+'}
  </button>
);
export const Card: React.FC<{ title?: React.ReactNode; children?: React.ReactNode; onClick?: () => void; fold?: string; startOpen?: boolean }> = ({ title, children, onClick, fold, startOpen }) => {
  const [open, toggle] = useFold(fold, startOpen ?? true);
  return (
    <div className={`card-var16 ${onClick ? 'hover:border-[var(--gold)]' : ''}`} style={{ margin: 0, cursor: onClick ? 'pointer' : undefined }} onClick={onClick} role={onClick ? 'link' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}>
      {(title || fold) && <div className={`flex items-start justify-between gap-2 font-semibold text-xs text-[var(--text-main)] ${open && children ? 'mb-1' : ''}`}>
        <div className="min-w-0">{title}</div>
        {fold && <FoldButton open={open} onToggle={toggle} />}
      </div>}
      {children && open && <div className="text-xs text-[var(--text-secondary)] leading-relaxed">{children}</div>}
    </div>
  );
};
// A titled block that can be minimized to its title: the H2 heading with a − / + at its right.
export const Fold: React.FC<{ id: string; title: React.ReactNode; children?: React.ReactNode; startOpen?: boolean; right?: React.ReactNode }> = ({ id, title, children, startOpen, right }) => {
  const [open, toggle] = useFold(id, startOpen ?? true);
  return (<section>
    <div className="section-head flex items-center justify-between gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-text)] cursor-pointer select-none" onClick={toggle}>{title}</h2>
      <div className="flex items-center gap-2">{right}<FoldButton open={open} onToggle={toggle} label={typeof title === 'string' ? title : undefined} /></div>
    </div>
    {open && children}
  </section>);
};
// Every section heading can minimize its section: the content after it, up to the next heading. The folded
// state is re-applied after every render, so content that loads later stays folded.
export const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const key = typeof children === 'string' ? 'h2.' + children : undefined;
  const [open, toggle] = useFold(key);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    for (let el = ref.current?.nextElementSibling; el && !el.hasAttribute('data-h2'); el = el.nextElementSibling) {
      if (open) el.removeAttribute('data-folded'); else el.setAttribute('data-folded', '1');
    }
  });
  return (
    <div ref={ref} data-h2="" className="section-head flex items-center justify-between gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-text)] cursor-pointer select-none" onClick={toggle}>{children}</h2>
      {key && <FoldButton open={open} onToggle={toggle} label={String(children)} />}
    </div>
  );
};
export const Status: React.FC<{ error: string | null }> = ({ error }) =>
  error ? <p className="text-xs text-[var(--error)]">{error}</p> : <p className="text-xs text-[var(--shade-color)]">Loading…</p>;
export const Bar: React.FC<{ pct: number }> = ({ pct }) => (
  <div className="h-1 rounded bg-[var(--bg-main)] overflow-hidden"><div className="h-full bg-[var(--gold)]" style={{ width: `${pct}%` }} /></div>
);
export const Pre: React.FC<{ text: string }> = ({ text }) => (
  <pre className="mono-code text-xs whitespace-pre-wrap leading-relaxed text-[var(--text-secondary)] bg-[var(--bg-main)] border border-[var(--border-color)] rounded p-3 max-h-[60vh] overflow-auto">{text}</pre>
);
export const Pill: React.FC<{ on?: boolean; onClick?: () => void; children: React.ReactNode }> = ({ on, onClick, children }) => (
  <button onClick={onClick} className={`text-xs px-2 py-0.5 rounded border ${on ? 'border-[var(--gold)] text-[var(--gold-text)]' : 'border-[var(--border-color)] text-[var(--shade-color)] hover:text-[var(--gold-text)]'}`}>{children}</button>
);
export type ScreenProps = {
  toast: (msg: string) => void;
  resume?: (item: {
    kind: 'chat' | 'prompt' | 'work';
    id: string;
    text?: string;
    taskId?: string;
    conversationId?: string;
    provider?: string;
    messages?: { id: string; speaker: string; role: 'founder' | 'model'; time: string; text: string }[];
  }) => void;
  go?: (id: string, filter?: 'all' | 'open' | 'checked') => void;
  idea?: {
    idea: string;
    answers: { id: string; answer: string; ask?: string }[];
    step: any;
    result: any;
    busy: string;
    error: string | null;
    onAnswer: (text: string) => void;
    onWrite: (pick?: { id: string; role?: string }, extra?: { id: string; answer: string }[]) => void;
    onReset: () => void;
  };
  listFilter?: 'all' | 'open' | 'checked' | 'conflict';
};
