// Workspace layout (founder 2026-10-15, verbatim: "add a layout icon next to scan where i can change which panes
// show in work space all 3 is default"). Pure helpers, no React, so the Builder suite can test them.
export type PaneId = 'left' | 'middle' | 'right';
export type Panes = Record<PaneId, boolean>;
export const PANE_IDS: PaneId[] = ['left', 'middle', 'right'];
export const ALL_PANES: Panes = { left: true, middle: true, right: true };
export const PANES_KEY = 'ais.panes';

type Reader = { getItem(key: string): string | null } | null | undefined;
type Writer = { setItem(key: string, value: string): void } | null | undefined;

/** The viewer's choice, or all three when nothing (or nothing usable) is stored. */
export function readPanes(storage: Reader): Panes {
  try {
    const v = JSON.parse((storage && storage.getItem(PANES_KEY)) || 'null');
    if (v && typeof v === 'object') {
      const p: Panes = { left: v.left !== false, middle: v.middle !== false, right: v.right !== false };
      return PANE_IDS.some(id => p[id]) ? p : { ...ALL_PANES };
    }
  } catch { /* storage blocked or bad JSON: the default */ }
  return { ...ALL_PANES };
}

/** Tick or untick one pane. The last ticked pane cannot be unticked. */
export function togglePane(p: Panes, id: PaneId): Panes {
  const next: Panes = { ...p, [id]: !p[id] };
  return PANE_IDS.some(k => next[k]) ? next : p;
}

export function savePanes(storage: Writer, p: Panes): void {
  try { if (storage) storage.setItem(PANES_KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

/** The pane that takes the freed width: the middle when shown, else the chat, else the left. */
export function growPane(p: Panes): PaneId {
  return p.middle ? 'middle' : p.right ? 'right' : 'left';
}

/** What the chat reads of one pane: capped, and it says when it was cut or is hidden. */
export const PANE_TEXT_CAP = 12000;
export function paneSnapshot(pane: 'left' | 'middle', tab: string, title: string, hidden: boolean, text: string) {
  const clean = String(text || '').replace(/\n{3,}/g, '\n\n').trim();
  const cut = clean.length > PANE_TEXT_CAP;
  return { pane, tab, title, hidden, text: cut ? clean.slice(0, PANE_TEXT_CAP) : clean, cut };
}
