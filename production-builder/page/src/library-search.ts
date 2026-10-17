// Library search. One pure module so the filter can be tested without a browser (card 01-29 slice B).
// Search runs on the tree the page already holds from /library-index; there is no server search route.
//
// Everything here is a pure function of its arguments: no clock, no random id, no fetch. The same
// query over the same tree always yields the same rows in the same order.

// Structurally minimal so the committed law tree (deeply `as const`) and the page's mutable Node
// type both satisfy it without a cast.
export type SearchableNode = {
  readonly name?: string;
  readonly note?: string;
  readonly children?: readonly SearchableNode[];
};

// One run of matched or unmatched text, in order. Concatenating every `text` rebuilds the input
// exactly, so highlighting can never alter what the founder reads.
export type Segment = { text: string; hit: boolean };

export function normaliseQuery(raw: string | null | undefined): string {
  return String(raw ?? '').trim().toLowerCase();
}

// Title first, then the text. An empty query matches everything.
export function nodeMatches(node: SearchableNode, query: string): boolean {
  const q = normaliseQuery(query);
  if (!q) return true;
  const title = String(node?.name ?? '').toLowerCase();
  const text = String(node?.note ?? '').toLowerCase();
  return title.includes(q) || text.includes(q);
}

// A row stays visible when it matches or when something beneath it matches, so the path to a hit
// is never hidden by the filter.
export function subtreeMatches(node: SearchableNode, query: string): boolean {
  const q = normaliseQuery(query);
  if (!q) return true;
  if (nodeMatches(node, q)) return true;
  return (node?.children ?? []).some(child => subtreeMatches(child, q));
}

// Top-level rows to draw, order preserved.
export function visibleNodes<T extends SearchableNode>(nodes: readonly T[], query: string): T[] {
  const q = normaliseQuery(query);
  if (!q) return nodes.slice();
  return nodes.filter(node => subtreeMatches(node, q));
}

// Every visible leaf, depth first, order preserved. The tests read this to prove what the search hid.
// Descending prunes any child that neither matches nor holds a match, so a hidden row stays hidden.
export function visibleLeaves<T extends SearchableNode>(nodes: readonly T[], query: string): T[] {
  const q = normaliseQuery(query);
  const out: T[] = [];
  const walk = (node: T) => {
    // A node's children are the same node type; the cast only recovers T through the readonly view.
    const kids = ((node?.children ?? []) as readonly T[]).filter(child => !q || subtreeMatches(child, q));
    if (!kids.length) {
      // A branch whose children were all pruned is not itself a visible row unless it matches.
      if (!(node?.children?.length) || nodeMatches(node, q)) out.push(node);
      return;
    }
    for (const child of kids) walk(child);
  };
  for (const node of nodes) {
    if (q && !subtreeMatches(node, q)) continue;
    walk(node);
  }
  return out;
}

// Split one string on every case-insensitive occurrence of the query. Original casing is kept, so
// the highlighted page reads exactly as the unhighlighted one did.
export function segments(text: string | null | undefined, query: string): Segment[] {
  const value = String(text ?? '');
  const q = normaliseQuery(query);
  if (!value) return [];
  if (!q) return [{ text: value, hit: false }];
  const haystack = value.toLowerCase();
  const out: Segment[] = [];
  let cursor = 0;
  for (;;) {
    const at = haystack.indexOf(q, cursor);
    if (at < 0) break;
    if (at > cursor) out.push({ text: value.slice(cursor, at), hit: false });
    out.push({ text: value.slice(at, at + q.length), hit: true });
    cursor = at + q.length;
  }
  if (cursor < value.length) out.push({ text: value.slice(cursor), hit: false });
  return out;
}
