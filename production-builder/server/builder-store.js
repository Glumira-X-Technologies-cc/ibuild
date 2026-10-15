'use strict';
const { DatabaseSync } = require('node:sqlite');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
class BuilderError extends Error { constructor(code, message, status = 400) { super(message || code); this.code = code; this.status = status; } }
const fail = (code, message, status) => { throw new BuilderError(code, message, status); };
const TYPES = Object.freeze({ 'note.create':'notes', 'note.update':'notes', 'note.archive':'notes', 'note.delete':'notes', 'note.restore':'notes', 'idea.create':'ideas', 'idea.update':'ideas', 'idea.archive':'ideas', 'idea.delete':'ideas', 'idea.restore':'ideas', 'draft.upsert':'notes', 'conversation.append':'conversations', 'reminder.create':'reminders', 'reminder.update':'reminders', 'reminder.ack':'reminders', 'request.create':'requests', 'request.update':'requests', 'job.upsert':'jobs', 'debug.create':'debugReports' });
const identifier = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(v);
function validate(value, depth = 0) {
  if (depth > 12) fail('PAYLOAD_DEPTH', 'Payload is too deeply nested');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail('INVALID_NUMBER'); return; }
  if (typeof value === 'string') { if (value.length > 100000 || value.includes('\0')) fail('INVALID_TEXT'); return; }
  if (Array.isArray(value)) { if (value.length > 1000) fail('ARRAY_TOO_LARGE'); value.forEach(v => validate(v, depth + 1)); return; }
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) fail('INVALID_PAYLOAD');
  for (const [key, item] of Object.entries(value)) { if (['__proto__','constructor','prototype'].includes(key)) fail('INVALID_KEY'); validate(item, depth + 1); }
}
function canonical(value) { if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'; if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'; return JSON.stringify(value); }
function createBuilderStore({ dataDir = path.join(__dirname, '.runtime'), clock = () => new Date() } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'builder.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS events (revision INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT UNIQUE NOT NULL, hash TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS entities (collection TEXT NOT NULL,id TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(collection,id));');
  db.exec('CREATE TABLE IF NOT EXISTS attachment_blobs (sha256 TEXT PRIMARY KEY, data BLOB NOT NULL); CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY,name TEXT NOT NULL,type TEXT NOT NULL,size INTEGER NOT NULL,sha256 TEXT NOT NULL,createdAt TEXT NOT NULL);');
  const now = () => new Date(clock()).toISOString();
  const revision = () => Number(db.prepare('SELECT COALESCE(MAX(revision),0) AS revision FROM events').get().revision);
  function snapshot() {
    db.exec('BEGIN');
    try {
    const state = { revision: revision(), notes:[], ideas:[], reminders:[], diary:[], conversations:[], requests:[], jobs:[], debugReports:[],attachments:db.prepare('SELECT * FROM attachments ORDER BY rowid').all().map(r=>({...r})) };
    // Delete means gone from view: the row stays in the entities table, but no list, Archive view included, ever shows it.
    const hidden = new Set();
    for (const row of db.prepare('SELECT collection, body FROM entities ORDER BY rowid').all()) { const body = JSON.parse(row.body); if (body.deletedAt) hidden.add(row.collection + '/' + body.id); else state[row.collection].push(body); }
    const at = now();
    state.reminders = state.reminders.map(r => ({...r, status:r.acknowledgedAt ? 'acknowledged' : r.dueAt <= at ? 'due' : 'scheduled', delivery:'in-app', delivered:false }));
    state.diary = db.prepare('SELECT revision,type,payload,created_at FROM events ORDER BY revision DESC').all().map(e => ({ revision:Number(e.revision), type:e.type, entityId:JSON.parse(e.payload).id, createdAt:e.created_at, date:new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Windhoek',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.created_at)), timeZone:'Africa/Windhoek' })).filter(e => !hidden.has(TYPES[e.type] + '/' + e.entityId));
    db.exec('COMMIT');
    return state;
    } catch(error) { if(db.isTransaction) db.exec('ROLLBACK'); throw error; }
  }
  function getAttachment(id) {
    if(!identifier(id))fail('INVALID_ID');
    const row=db.prepare('SELECT a.*,b.data FROM attachments a JOIN attachment_blobs b ON a.sha256=b.sha256 WHERE a.id=?').get(id);
    if(!row)fail('ATTACHMENT_NOT_FOUND','Attachment does not exist',404);
    return {...row,data:Buffer.from(row.data)};
  }
  function putAttachment({name,type,dataUrl,requestId=randomUUID()}={}) {
    if(typeof name!=='string'||!name.trim()||name.length>255||/[\x00-\x1f\x7f]/.test(name))fail('INVALID_ATTACHMENT_NAME');
    if(!identifier(requestId))fail('REQUEST_ID_REQUIRED');
    if(!['image/png','image/jpeg','image/gif','image/webp'].includes(type))fail('UNSUPPORTED_ATTACHMENT_TYPE','Only PNG, JPEG, GIF and WebP images are supported',415);
    if(typeof dataUrl!=='string'||dataUrl.length>Math.ceil(16*1024*1024/3)*4+64)fail('ATTACHMENT_TOO_LARGE','Image exceeds 16 MiB',413);
    const prefix='data:'+type+';base64,';
    if(!dataUrl.startsWith(prefix))fail('ATTACHMENT_MIME_MISMATCH');
    const encoded=dataUrl.slice(prefix.length);
    if(!encoded||encoded.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))fail('INVALID_ATTACHMENT_BASE64');
    const data=Buffer.from(encoded,'base64');
    if(data.toString('base64')!==encoded)fail('INVALID_ATTACHMENT_BASE64');
    if(data.length>16*1024*1024)fail('ATTACHMENT_TOO_LARGE','Image exceeds 16 MiB',413);
    const magic=type==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?data.length>=3&&data[0]===255&&data[1]===216&&data[2]===255:type==='image/gif'?['GIF87a','GIF89a'].includes(data.subarray(0,6).toString('ascii')):data.subarray(0,4).toString('ascii')==='RIFF'&&data.subarray(8,12).toString('ascii')==='WEBP';
    if(!magic)fail('ATTACHMENT_MAGIC_MISMATCH','Image bytes do not match declared MIME type',415);
    const sha256=createHash('sha256').update(data).digest('hex'),hash=createHash('sha256').update(canonical({type:'attachment.create',name,mime:type,sha256})).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      const prior=db.prepare('SELECT hash,payload FROM events WHERE request_id=?').get(requestId);
      if(prior){if(prior.hash!==hash)fail('IDEMPOTENCY_CONFLICT','Request ID was already used for different content',409);const result=JSON.parse(prior.payload);db.exec('COMMIT');return {...result,revision:revision()};}
      const metadata={id:randomUUID(),name,type,size:data.length,sha256,createdAt:now()};
      db.prepare('INSERT OR IGNORE INTO attachment_blobs(sha256,data) VALUES(?,?)').run(sha256,data);
      db.prepare('INSERT INTO attachments(id,name,type,size,sha256,createdAt) VALUES(?,?,?,?,?,?)').run(metadata.id,name,type,data.length,sha256,metadata.createdAt);
      const event=db.prepare('INSERT INTO events(request_id,hash,type,payload,created_at) VALUES(?,?,?,?,?)').run(requestId,hash,'attachment.create',JSON.stringify(metadata),metadata.createdAt);
      db.exec('COMMIT');return {...metadata,revision:Number(event.lastInsertRowid)};
    }catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
  }
  function applyEvent(input) {
    validate(input);
    const {type, payload, expectedRevision, requestId} = input;
    if (!Object.hasOwn(TYPES,type)) fail('UNKNOWN_EVENT');
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') fail('INVALID_PAYLOAD');
    if (!identifier(requestId)) fail('REQUEST_ID_REQUIRED');
    if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)) fail('INVALID_REVISION');
    if (Buffer.byteLength(JSON.stringify(payload)) > 256000) fail('PAYLOAD_TOO_LARGE', 'Payload exceeds 256 KB', 413);
    if (payload.id !== undefined && !identifier(payload.id)) fail('INVALID_ID');
    const containsBytes=value=>typeof value==='string'?/^data:image\//i.test(value):Array.isArray(value)?value.some(containsBytes):value&&typeof value==='object'?Object.values(value).some(containsBytes):false;
    if(containsBytes(payload))fail('ATTACHMENT_UPLOAD_REQUIRED','Upload image bytes through /attachments and store attachmentIds only');
    if(payload.attachmentIds!==undefined){if(!Array.isArray(payload.attachmentIds)||payload.attachmentIds.some(id=>!identifier(id)))fail('INVALID_ATTACHMENT_IDS');for(const id of payload.attachmentIds)if(!db.prepare('SELECT id FROM attachments WHERE id=?').get(id))fail('ATTACHMENT_NOT_FOUND','Attachment does not exist',404);}
    for (const key of ['title','text','content','taskId','queueId','status','role','provider','conversationId']) if (payload[key] !== undefined && typeof payload[key] !== 'string') fail('INVALID_FIELD', key + ' must be text');
    for (const key of ['path','sourcePath']) if (payload[key] !== undefined && (typeof payload[key] !== 'string' || payload[key].includes('..') || /^[a-z]:|^[/\\]/i.test(payload[key]))) fail('INVALID_PATH');
    if (payload.dueAt !== undefined && (typeof payload.dueAt !== 'string' || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(payload.dueAt) || !Number.isFinite(Date.parse(payload.dueAt)))) fail('INVALID_DUE_DATE');
    const hash = createHash('sha256').update(canonical({type,payload})).digest('hex');
    db.exec('BEGIN IMMEDIATE');
    try {
      const prior = db.prepare('SELECT revision,hash,payload FROM events WHERE request_id=?').get(requestId);
      if (prior) { if (prior.hash !== hash) fail('IDEMPOTENCY_CONFLICT','Request ID was already used for different content',409); db.exec('COMMIT'); return {revision:revision(),state:snapshot(),receipt:{requestId,eventRevision:Number(prior.revision),id:JSON.parse(prior.payload).id,replayed:true}}; }
      if (expectedRevision !== undefined && expectedRevision !== revision()) fail('REVISION_CONFLICT','State changed. Reload and retry your edit.',409);
      const collection = TYPES[type], action = type.split('.')[1], id = payload.id || randomUUID(), at = now();
      const row = db.prepare('SELECT body FROM entities WHERE collection=? AND id=?').get(collection,id);
      const old = row ? JSON.parse(row.body) : null;
      if (['update','archive','ack','delete','restore'].includes(action) && !old) fail('NOT_FOUND','Record does not exist',404);
      if (['create','append'].includes(action) && old) fail('ALREADY_EXISTS','ID already exists',409);
      if (action === 'delete' || action === 'restore') {
        // Delete hides the row and keeps it; restore (the Undo) brings it back exactly as it was, archive flag included.
        if (action === 'delete' && old.deletedAt) fail('ALREADY_DELETED','Record is already deleted',409);
        if (action === 'restore' && !old.deletedAt) fail('NOT_DELETED','Record is not deleted',409);
        const kept = {...old,updatedAt:at};
        if (action === 'delete') kept.deletedAt = at; else delete kept.deletedAt;
        db.prepare('UPDATE entities SET body=? WHERE collection=? AND id=?').run(JSON.stringify(kept),collection,id);
        const event = db.prepare('INSERT INTO events(request_id,hash,type,payload,created_at) VALUES(?,?,?,?,?)').run(requestId,hash,type,JSON.stringify({id}),at);
        db.exec('COMMIT');
        return {revision:Number(event.lastInsertRowid),state:snapshot(),receipt:{requestId,eventRevision:Number(event.lastInsertRowid),id,replayed:false,persisted:true}};
      }
      if (old?.deletedAt) fail('DELETED_RECORD','Deleted records are hidden. Restore it first.',409);
      if (old?.archivedAt) fail('ARCHIVED_RECORD','Archived records are immutable',409);
      if (action === 'create' && ['notes','ideas'].includes(collection) && !String(payload.text || payload.title || '').trim() && !payload.attachmentIds?.length) fail('TEXT_REQUIRED');
      if (type === 'conversation.append' && !String(payload.text || payload.content || '').trim() && !payload.attachmentIds?.length) fail('TEXT_REQUIRED');
      if (type === 'reminder.create' && (!payload.dueAt || !payload.title?.trim())) fail('REMINDER_FIELDS_REQUIRED');
      const next = {...old,...payload,id,createdAt:old?.createdAt || at,updatedAt:at};
      delete next.archivedAt; delete next.acknowledgedAt; delete next.deletedAt;
      if (old?.acknowledgedAt) next.acknowledgedAt = old.acknowledgedAt;
      if (next.dueAt) next.dueAt = new Date(next.dueAt).toISOString();
      if (action === 'archive') next.archivedAt = at;
      if (action === 'ack') next.acknowledgedAt = at;
      if (type === 'draft.upsert') next.kind = 'draft';
      db.prepare('INSERT INTO entities(collection,id,body) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET body=excluded.body').run(collection,id,JSON.stringify(next));
      const event = db.prepare('INSERT INTO events(request_id,hash,type,payload,created_at) VALUES(?,?,?,?,?)').run(requestId,hash,type,JSON.stringify({...payload,id}),at);
      db.exec('COMMIT');
      return {revision:Number(event.lastInsertRowid),state:snapshot(),receipt:{requestId,eventRevision:Number(event.lastInsertRowid),id,replayed:false,persisted:true}};
    } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
  }
  return {snapshot,applyEvent,putAttachment,getAttachment,close:()=>db.close()};
}
module.exports = {createBuilderStore,BuilderError,identifier,validate,TYPES};
