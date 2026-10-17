// Workspace layout (founder 2026-10-15, verbatim: "add a layout icon next to scan where i can change which panes
// show in work space all 3 is default"). Pure helpers, no React, so the Builder suite can test them.
// Terminal (bottom dock) is a fourth toggle, persisted with the same key (founder 2026-10-16).
export type ColumnPaneId = 'left' | 'middle' | 'right';
export type PaneId = ColumnPaneId | 'terminal';
export type Panes = Record<PaneId, boolean>;
export const COLUMN_PANE_IDS: ColumnPaneId[] = ['left', 'middle', 'right'];
export const PANE_IDS: PaneId[] = ['left', 'middle', 'right', 'terminal'];
export const ALL_PANES: Panes = { left: true, middle: true, right: true, terminal: false };
export const PANES_KEY = 'ais.panes';
export const TERMINAL_HEIGHT_KEY = 'ais.terminalHeight';
export const DEFAULT_TERMINAL_HEIGHT = 180;
export const MIN_TERMINAL_HEIGHT = 96;
export const MAX_TERMINAL_HEIGHT = 480;

type Reader = { getItem(key: string): string | null } | null | undefined;
type Writer = { setItem(key: string, value: string): void } | null | undefined;

/** The viewer's choice, or the default when nothing (or nothing usable) is stored. */
export function readPanes(storage: Reader): Panes {
  try {
    const v = JSON.parse((storage && storage.getItem(PANES_KEY)) || 'null');
    if (v && typeof v === 'object') {
      const p: Panes = {
        left: v.left !== false,
        middle: v.middle !== false,
        right: v.right !== false,
        terminal: v.terminal === true,
      };
      return COLUMN_PANE_IDS.some(id => p[id]) ? p : { ...ALL_PANES };
    }
  } catch { /* storage blocked or bad JSON: the default */ }
  return { ...ALL_PANES };
}

/** Tick or untick one pane. The last ticked column pane cannot be unticked. Terminal may always flip. */
export function togglePane(p: Panes, id: PaneId): Panes {
  const next: Panes = { ...p, [id]: !p[id] };
  if (id === 'terminal') return next;
  return COLUMN_PANE_IDS.some(k => next[k]) ? next : p;
}

export function savePanes(storage: Writer, p: Panes): void {
  try { if (storage) storage.setItem(PANES_KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

/** The pane that takes the freed width: the middle when shown, else the chat, else the left. */
export function growPane(p: Panes): ColumnPaneId {
  return p.middle ? 'middle' : p.right ? 'right' : 'left';
}

export function readTerminalHeight(storage: Reader): number {
  try {
    const n = Number((storage && storage.getItem(TERMINAL_HEIGHT_KEY)) || '');
    if (Number.isFinite(n) && n >= MIN_TERMINAL_HEIGHT && n <= MAX_TERMINAL_HEIGHT) return Math.round(n);
  } catch { /* storage blocked */ }
  return DEFAULT_TERMINAL_HEIGHT;
}

export function saveTerminalHeight(storage: Writer, h: number): void {
  try {
    if (!storage) return;
    const n = Math.max(MIN_TERMINAL_HEIGHT, Math.min(MAX_TERMINAL_HEIGHT, Math.round(h)));
    storage.setItem(TERMINAL_HEIGHT_KEY, String(n));
  } catch { /* storage blocked */ }
}

/** What the chat reads of one pane: capped, and it says when it was cut or is hidden. */
export const PANE_TEXT_CAP = 12000;
export function paneSnapshot(pane: 'left' | 'middle', tab: string, title: string, hidden: boolean, text: string) {
  const clean = String(text || '').replace(/\n{3,}/g, '\n\n').trim();
  const cut = clean.length > PANE_TEXT_CAP;
  return { pane, tab, title, hidden, text: cut ? clean.slice(0, PANE_TEXT_CAP) : clean, cut };
}
