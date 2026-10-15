// API base. Default '' = same origin: server.js on 3001 serves this page and the API. Vite dev proxies
// /api, /health, /v1 to that Builder (BUILDER_URL). Override at build time with VITE_API_BASE.
export const API_BASE: string = ((import.meta as any).env?.VITE_API_BASE || '').replace(/\/$/, '');

export class ApiError extends Error { constructor(message: string, public status = 0, public code = '') { super(message); } }

export async function call<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const init: RequestInit = { credentials: 'same-origin', method: method || (body === undefined ? 'GET' : 'POST') };
  if (body !== undefined) { init.headers = { 'Content-Type': 'application/json' }; init.body = JSON.stringify(body); }
  let r: Response;
  try { r = await fetch(API_BASE + path, init); } catch { throw new ApiError('The Builder server is not answering.'); }
  let data: any = null;
  try { data = await r.json(); } catch { throw new ApiError(`Unreadable response (${r.status}).`, r.status); }
  if (!r.ok) { const e = data?.error; throw new ApiError((typeof e === 'string' ? e : e?.message) || data?.message || `Request failed (${r.status})`, r.status, e?.code || data?.code || ''); }
  return data as T;
}
/** Builder routes live under /api/builder. */
export const builder = <T = any>(path: string, body?: unknown, method?: string) => call<T>('/api/builder' + path, body, method);
export const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export type IdeaAnswer = { id: string; answer: string; ask?: string; from?: string };

// ---- Shared helpers (Engineering Team lane). Shapes follow the Builder server code at e9cc196. ----

/** Ideas: POST /ideas/step returns the next question or the goal playback for an idea. */
export const ideasStep = (body: { idea: string; answers?: IdeaAnswer[]; goal?: string; taskId?: string }) => builder('/ideas/step', body);
/** Ideas: POST /ideas/prompt. Needs confirmed:true; 409 ROUTING_MAP_STALE / NO_SOURCE, 400 QUESTIONS_OPEN or PLAYBACK_NOT_CONFIRMED. */
export const ideasPrompt = (body: { idea: string; answers?: IdeaAnswer[]; goal?: string; taskId?: string; confirmed: true; chosen?: string[] }) => builder('/ideas/prompt', body);
export const ideasToolkit = () => builder<{ home: string; status: string; items: { id: string; kind: string; description: string }[] }>('/ideas/toolkit');
/** GET /ideas/ref returns text/plain (a committed repo file, or a skill by item id); errors come back as JSON. */
export async function ideasRef(ref: { path: string } | { item: string }): Promise<string> {
  const q = 'path' in ref ? 'path=' + encodeURIComponent(ref.path) : 'item=' + encodeURIComponent(ref.item);
  let r: Response;
  try { r = await fetch(API_BASE + '/api/builder/ideas/ref?' + q, { credentials: 'same-origin' }); } catch { throw new ApiError('The Builder server is not answering.'); }
  if (r.ok) return r.text();
  let d: any = null; try { d = await r.json(); } catch {}
  const e = d?.error; throw new ApiError((typeof e === 'string' ? e : e?.message) || `Could not open the file (${r.status}).`, r.status, e?.code || '');
}
/** GET /ideas/web/:sha returns the saved page as text; errors come back as JSON. */
export async function ideasWeb(sha: string): Promise<string> {
  let r: Response;
  try { r = await fetch(API_BASE + '/api/builder/ideas/web/' + encodeURIComponent(sha), { credentials: 'same-origin' }); } catch { throw new ApiError('The Builder server is not answering.'); }
  if (r.ok) return r.text();
  let d: any = null; try { d = await r.json(); } catch {}
  const e = d?.error; throw new ApiError((typeof e === 'string' ? e : e?.message) || `Could not open the saved page (${r.status}).`, r.status, e?.code || '');
}
/** POST /compile: records a request.create and returns dispatch.receiptId used by jobsStart. */
export const compile = (body: Record<string, unknown>) => builder('/compile', body);

/** Jobs: POST /jobs needs requestId, taskId, a target from /jobs/targets, prompt (<=30000) and context {dispatchReceiptId} only. */
export const jobsStart = (body: { requestId: string; taskId: string; target: string; prompt: string; context: { dispatchReceiptId: string } }) => builder('/jobs', body);
export const jobsCancel = (id: string) => builder('/jobs/' + encodeURIComponent(id) + '/cancel', {});
export const jobsList = () => builder('/jobs');

/** Attachments: PNG/JPEG/GIF/WebP only, <=16 MiB, sent as a data URL. Returns the saved attachment (use its id in chat). */
export async function uploadImage(file: File): Promise<any> {
  const dataUrl = await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => no(new ApiError('Could not read the file.')); r.readAsDataURL(file); });
  return builder('/attachments', { name: file.name, type: file.type, dataUrl, requestId: newId('att') });
}

/** Lane bridge (outside /api/builder). */
export const laneStatus = () => call('/api/lane/status');
export const lane = (body: { prompt: string; system?: string; json?: boolean; maxTokens?: number }) => call('/api/lane', body);

/** Chat: POST /chat streams Server-Sent Events: meta, delta {text}, done {message, receipt}, error {code, message}. */
export async function chatStream(
  body: { requestId: string; conversationId: string; provider: string; text: string; attachmentIds?: string[]; context?: Record<string, unknown>; mode?: 'vent'; history?: { role: 'user' | 'assistant'; text: string }[] },
  on: { delta?: (t: string) => void; meta?: (m: any) => void },
  signal?: AbortSignal,
): Promise<{ message: any; receipt?: any }> {
  let r: Response;
  try { r = await fetch(API_BASE + '/api/builder/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }); }
  catch { throw new ApiError('The Builder server is not answering.'); }
  if (!r.ok || !r.body) { let d: any = null; try { d = await r.json(); } catch {} throw new ApiError(d?.error?.message || `Chat failed (${r.status})`, r.status, d?.error?.code || ''); }
  const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '', done: any = null;
  for (;;) {
    const { value, done: end } = await reader.read(); if (end) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /^event: (.*)$/m.exec(block)?.[1], raw = /^data: (.*)$/m.exec(block)?.[1]; if (!ev || raw === undefined) continue;
      const data = JSON.parse(raw);
      if (ev === 'delta') on.delta?.(data.text || ''); else if (ev === 'meta') on.meta?.(data);
      else if (ev === 'error') throw new ApiError(data.message || 'Chat failed.', 0, data.code || '');
      else if (ev === 'done') done = data;
    }
  }
  if (!done) throw new ApiError('The chat stream ended without an answer.');
  return done;
}
