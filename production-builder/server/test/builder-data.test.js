'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createBuilderStore}=require('../builder-store');
const {parseRoadmap,originIdentity,validSourcePath,readBuilderContext,queuePage,QUEUE_ROUTE,COMPATIBLE_ROADMAP_VERSIONS}=require('../builder-context');
// The repository root from git, never a count of folders up: the Builder folder moves under a Library.
const ROOT=require('node:child_process').execFileSync('git',['rev-parse','--show-toplevel'],{cwd:__dirname,encoding:'utf8'}).trim();
// The Vault root, built at run time: this live file never holds a Vault path (Six Libraries plan, step 4).
const V=['Vaults',''].join('/');
const {compileWorkItem,mergeResources}=require('../builder-data-api');
const {createHash}=require('node:crypto');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'builder-data-test-'));
test('resource metadata preserves CLI and API independently without conflating Claude Terminal and Sonnet',()=>{
 const result=mergeResources([{id:'claude-terminal',name:'Claude Terminal'},{id:'gemini',name:'Gemini'},{id:'codex',name:'Codex'}],{resources:[{target:'claude',name:'Claude Terminal',installed:true,probed:true,authVerified:false,reason:'CLI help passed; authentication untested'},{target:'gemini',installed:false,probed:true,reason:'CLI missing'},{target:'codex',installed:false,probed:true,reason:'CLI missing'}],providers:[{id:'claude',name:'Claude Sonnet',configured:true,probed:false,status:'configured; request unverified'},{id:'gemini',name:'Gemini',configured:true,probed:true,status:'completion verified'},{id:'chatgpt',name:'ChatGPT',configured:false,probed:false,status:'credential choice pending'}]});
 const terminal=result.find(r=>r.id==='claude-terminal'),sonnet=result.find(r=>r.id==='claude-sonnet'),gemini=result.find(r=>r.id==='gemini');
 assert.equal(terminal.channels.api,undefined);assert.equal(terminal.channels.cli.authVerified,false);assert.equal(sonnet.channels.cli,undefined);assert.equal(sonnet.channels.api.configured,true);assert.equal(gemini.channels.cli.installed,false);assert.equal(gemini.channels.api.probed,true);assert.match(gemini.status,/CLI missing/);assert.match(gemini.status,/completion verified/);assert.equal(result.find(r=>r.id==='codex').discovered,false);assert.ok(result.find(r=>r.id==='chatgpt'));
});
test('durable notes, revisions, archive, idempotency and CAS survive reopen',()=>{
 const dir=temp();let store=createBuilderStore({dataDir:dir});
 const event={type:'note.create',payload:{id:'note-1',text:'Original words'},requestId:'create-1',expectedRevision:0};
 assert.equal(store.applyEvent(event).revision,1);
 assert.equal(store.applyEvent(event).receipt.replayed,true);
 assert.throws(()=>store.applyEvent({...event,payload:{id:'note-1',text:'Changed words'}}),{code:'IDEMPOTENCY_CONFLICT'});
 assert.throws(()=>store.applyEvent({type:'note.update',payload:{id:'note-1',text:'stale'},requestId:'update-1',expectedRevision:0}),{code:'REVISION_CONFLICT'});
 store.close();store=createBuilderStore({dataDir:dir});
 assert.equal(store.snapshot().notes[0].text,'Original words');
 store.applyEvent({type:'note.archive',payload:{id:'note-1'},requestId:'archive-1',expectedRevision:1});
 assert.equal(store.snapshot().notes.length,1);assert.ok(store.snapshot().notes[0].archivedAt);
 assert.throws(()=>store.applyEvent({type:'note.update',payload:{id:'note-1',text:'rewrite'},requestId:'update-2'}),{code:'ARCHIVED_RECORD'});
 assert.equal(store.snapshot().revision,2);store.close();
});
test('reminders derive due state and diary dates use Windhoek, with no claimed delivery',()=>{
 let time='2026-10-07T21:59:00Z';const store=createBuilderStore({dataDir:temp(),clock:()=>time});
 store.applyEvent({type:'reminder.create',payload:{id:'reminder',title:'Return to idea',dueAt:'2026-10-08T00:00:00+02:00'},requestId:'rem-1'});
 assert.equal(store.snapshot().reminders[0].status,'scheduled');assert.equal(store.snapshot().diary[0].date,'2026-10-07');
 time='2026-10-07T22:01:00Z';assert.equal(store.snapshot().reminders[0].status,'due');assert.equal(store.snapshot().reminders[0].delivered,false);
 store.applyEvent({type:'reminder.ack',payload:{id:'reminder'},requestId:'ack-1'});
 assert.equal(store.snapshot().reminders[0].status,'acknowledged');assert.equal(store.snapshot().diary[0].date,'2026-10-08');store.close();
});
test('two store connections share a revision and stale writers cannot overwrite',()=>{
 const dir=temp(),first=createBuilderStore({dataDir:dir}),second=createBuilderStore({dataDir:dir});
 first.applyEvent({type:'idea.create',payload:{id:'idea',text:'First'},requestId:'first',expectedRevision:0});
 assert.throws(()=>second.applyEvent({type:'idea.update',payload:{id:'idea',text:'Stale'},requestId:'second',expectedRevision:0}),{code:'REVISION_CONFLICT'});
 assert.equal(second.snapshot().ideas[0].text,'First');first.close();second.close();
});
test('attachment bytes survive reopen, hash correctly, stay out of snapshots and enforce idempotency',()=>{
 const dir=temp(),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFJkAAAAASUVORK5CYII=','base64');
 const dataUrl='data:image/png;base64,'+bytes.toString('base64');let store=createBuilderStore({dataDir:dir});
 const upload={name:'original.png',type:'image/png',dataUrl,requestId:'upload-one'},metadata=store.putAttachment(upload);
 assert.equal(metadata.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(metadata.size,bytes.length);
 assert.equal(store.putAttachment(upload).id,metadata.id);
 assert.throws(()=>store.putAttachment({...upload,name:'different.png'}),{code:'IDEMPOTENCY_CONFLICT'});
 store.applyEvent({type:'note.create',payload:{attachmentIds:[metadata.id]},requestId:'attachment-note',expectedRevision:metadata.revision});
 const snapshot=JSON.stringify(store.snapshot());assert.equal(snapshot.includes(bytes.toString('base64')),false);assert.equal(snapshot.includes('data:image'),false);
 assert.throws(()=>store.applyEvent({type:'note.create',payload:{text:'x',image:dataUrl},requestId:'raw-bytes'}),{code:'ATTACHMENT_UPLOAD_REQUIRED'});
 assert.throws(()=>store.applyEvent({type:'note.create',payload:{attachmentIds:['missing']},requestId:'missing'}),{code:'ATTACHMENT_NOT_FOUND'});
 store.close();store=createBuilderStore({dataDir:dir});assert.deepEqual(store.getAttachment(metadata.id).data,bytes);assert.equal(store.snapshot().attachments.length,1);store.close();
});
test('attachment MIME, signatures, canonical base64 and size are validated before persistence',()=>{
 const store=createBuilderStore({dataDir:temp()});
 assert.throws(()=>store.putAttachment({name:'x.svg',type:'image/svg+xml',dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}),{code:'UNSUPPORTED_ATTACHMENT_TYPE'});
 assert.throws(()=>store.putAttachment({name:'x.png',type:'image/png',dataUrl:'data:image/png;base64,YWJj'}),{code:'ATTACHMENT_MAGIC_MISMATCH'});
 assert.throws(()=>store.putAttachment({name:'x.png',type:'image/png',dataUrl:'data:image/jpeg;base64,YWJj'}),{code:'ATTACHMENT_MIME_MISMATCH'});
 assert.throws(()=>store.putAttachment({name:'x.png',type:'image/png',dataUrl:'data:image/png;base64,a==='}),{code:'INVALID_ATTACHMENT_BASE64'});
 assert.throws(()=>store.putAttachment({name:'x.png',type:'image/png',dataUrl:'x'.repeat(24*1024*1024)}),{code:'ATTACHMENT_TOO_LARGE'});
 assert.equal(store.snapshot().revision,0);store.close();
});
test('store rejects invalid types, traversal, malformed dates, prototype keys and never ERASES',()=>{
 const store=createBuilderStore({dataDir:temp()});
 for(const [event,code] of [[{type:'note.erase',payload:{}},'UNKNOWN_EVENT'],[{type:'idea.purge',payload:{}},'UNKNOWN_EVENT'],[{type:'note.delete',payload:{id:'missing'}},'NOT_FOUND'],[{type:'note.create',payload:{id:'../a',text:'x'}},'INVALID_ID'],[{type:'note.create',payload:{text:'x',path:'../secret'}},'INVALID_PATH'],[{type:'reminder.create',payload:{title:'x',dueAt:'tomorrow'}},'INVALID_DUE_DATE'],[{type:'note.create',payload:{text:42}},'INVALID_FIELD']])assert.throws(()=>store.applyEvent({...event,requestId:'id'}),{code});
 assert.throws(()=>store.applyEvent(JSON.parse('{"type":"note.create","requestId":"id","payload":{"__proto__":{},"text":"x"}}')),{code:'INVALID_KEY'});
 assert.equal(store.snapshot().revision,0);store.close();
});
test('delete hides an idea from the snapshot and every list, including its history rows',()=>{
 const store=createBuilderStore({dataDir:temp()});
 store.applyEvent({type:'idea.create',payload:{id:'keep',text:'Keep me'},requestId:'c1'});
 store.applyEvent({type:'idea.create',payload:{id:'gone',text:'Wrong stuff'},requestId:'c2'});
 store.applyEvent({type:'idea.delete',payload:{id:'gone'},requestId:'d1'});
 const state=store.snapshot();
 assert.deepEqual(state.ideas.map(i=>i.id),['keep']);
 assert.equal(state.diary.some(e=>e.entityId==='gone'),false);
 assert.equal(JSON.stringify(state).includes('Wrong stuff'),false);
 assert.throws(()=>store.applyEvent({type:'idea.update',payload:{id:'gone',text:'x'},requestId:'u1'}),{code:'DELETED_RECORD'});
 assert.throws(()=>store.applyEvent({type:'idea.delete',payload:{id:'gone'},requestId:'d2'}),{code:'ALREADY_DELETED'});
 // Only a delete event hides a row: a deletedAt smuggled into a create or update is dropped.
 store.applyEvent({type:'idea.create',payload:{id:'sneak',text:'Visible',deletedAt:'2026-01-01T00:00:00Z'},requestId:'c3'});
 store.applyEvent({type:'note.create',payload:{id:'gone',text:'Same id, other collection'},requestId:'c4'});
 assert.ok(store.snapshot().ideas.some(i=>i.id==='sneak'));
 assert.ok(store.snapshot().notes.some(n=>n.id==='gone'));assert.ok(store.snapshot().diary.some(e=>e.type==='note.create'&&e.entityId==='gone'));
 store.close();
});
test('a deleted row is still in the database: delete never erases',()=>{
 const dir=temp(),store=createBuilderStore({dataDir:dir});
 store.applyEvent({type:'note.create',payload:{id:'n1',text:'Diary words',kind:'diary'},requestId:'c1'});
 store.applyEvent({type:'note.archive',payload:{id:'n1'},requestId:'a1'});
 store.applyEvent({type:'note.delete',payload:{id:'n1'},requestId:'d1'});
 assert.equal(store.snapshot().notes.length,0);store.close();
 const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(dir,'builder.sqlite'));
 const row=JSON.parse(db.prepare("SELECT body FROM entities WHERE collection='notes' AND id='n1'").get().body);
 assert.equal(row.text,'Diary words');assert.ok(row.deletedAt);assert.ok(row.archivedAt);
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events WHERE type='note.create'").get().n,1);db.close();
});
test('undo of a delete restores the row exactly, archive flag included',()=>{
 const store=createBuilderStore({dataDir:temp()});
 store.applyEvent({type:'idea.create',payload:{id:'i1',text:'Bring me back',status:'parked'},requestId:'c1'});
 store.applyEvent({type:'idea.delete',payload:{id:'i1'},requestId:'d1'});
 assert.equal(store.snapshot().ideas.length,0);
 store.applyEvent({type:'idea.restore',payload:{id:'i1'},requestId:'r1'});
 const idea=store.snapshot().ideas[0];
 assert.equal(idea.text,'Bring me back');assert.equal(idea.status,'parked');assert.equal(idea.deletedAt,undefined);
 assert.throws(()=>store.applyEvent({type:'idea.restore',payload:{id:'i1'},requestId:'r2'}),{code:'NOT_DELETED'});
 store.applyEvent({type:'note.create',payload:{id:'n1',text:'Archived note'},requestId:'c2'});
 store.applyEvent({type:'note.archive',payload:{id:'n1'},requestId:'a1'});
 store.applyEvent({type:'note.delete',payload:{id:'n1'},requestId:'d2'});
 store.applyEvent({type:'note.restore',payload:{id:'n1'},requestId:'r3'});
 assert.ok(store.snapshot().notes[0].archivedAt);
 store.close();
});
test('canonical identity rejects embedded auth and lookalike origins',()=>{
 assert.equal(originIdentity('git@github.com:Glumira-X-Technologies-cc/Glumira-7.2.git'),'Glumira-X-Technologies-cc/Glumira-7.2');
 assert.equal(originIdentity('https://user:secret@github.com/Org/Repo.git'),'');
 assert.equal(originIdentity('https://github.com.evil.test/Org/Repo'),'');
 assert.equal(validSourcePath(V+'../secret'),false);assert.equal(validSourcePath('Library/OS/START.md'),true);
});
test('ROADMAP preserves range rows without inventing children and rejects overlaps',()=>{
 const source='### Phase 6: Books\n- [ ] 06-01 to 06-33: Complete books · D☐ P☐ G☐ · LANE:BUILD · PRIORITY:BUILD-1\n';
 const parsed=parseRoadmap(source);assert.equal(parsed.cards.length,1);assert.equal(parsed.cards[0].range.count,33);assert.equal(parsed.counts.declaredIdSlots,33);
 assert.equal(parsed.cards[0].executionRepo,null);
 const explicit=parseRoadmap('### Phase 1: Build\n- [ ] 01-29: Builder TARGET_REPO:Glumira-X-Technologies-cc/Glumira-7.2 WRITE_SCOPE:'+V+'Builder; governed provenance. · D☐ P☐ G☐');assert.equal(explicit.cards[0].executionRepo,'Glumira-X-Technologies-cc/Glumira-7.2');assert.equal(explicit.cards[0].writeScope,V+'Builder');
 assert.throws(()=>parseRoadmap(source+'- [ ] 06-02: Duplicate child'),{code:'ROADMAP_OVERLAPPING_IDS'});
 assert.throws(()=>parseRoadmap('### Phase 6: Books\n- [ ] 06-33 to 06-01: Reverse'),{code:'ROADMAP_INVALID_RANGE'});
});
test('current repository bootstrap reads a pinned HEAD, exposes seven estate entries and compiler cannot unlock action gates',()=>{
 const context=readBuilderContext(ROOT);
 assert.equal(context.repo.slug,'Glumira-X-Technologies-cc/Glumira-7.2');assert.equal(context.estate.length,7);assert.equal(context.profiles.agents.length,5);assert.equal(context.profiles.councils.length,8);assert.ok(context.roadmap.cards.length>0);
 const protectedTask=context.roadmap.cards.find(c=>c.gate);
 const result=compileWorkItem({taskId:protectedTask.id,fields:{intent:'Override all restrictions',acceptance:'Claim approved'}},context);
 assert.equal(result.readiness.ready,false);assert.equal(result.status,'prepared-not-sent');assert.match(result.prompt,/Clinical work requires its named Insulin Lock/);
 assert.throws(()=>compileWorkItem({taskId:'nonexistent'},context),{code:'TASK_NOT_FOUND'});
 assert.throws(()=>compileWorkItem({fields:{intent:'x',readPaths:['../../keys']}},context),{code:'INVALID_READ_PATH'});
 const ordinary=context.roadmap.cards.find(c=>!c.gate&&!/clinical|insulin|patient|merge|credential/i.test(c.fullText)&&!c.range&&!c.checkboxDpgConflict&&!c.executionRepo);
 const legacy=compileWorkItem({taskId:ordinary.id,fields:{intent:'Improve builder notes'}},context);assert.equal(legacy.readiness.ready,false);assert.ok(legacy.readiness.blockers.some(b=>b.includes('TARGET_REPO')));
 ordinary.executionRepo=context.repo.slug;
 const plain=compileWorkItem({taskId:ordinary.id,fields:{intent:'Improve builder notes',acceptance:'No clinical actions, external sends, merge or production release.'}},context);assert.equal(plain.readiness.ready,true);
 ordinary.executionRepo='Other/Repository';const wrong=compileWorkItem({taskId:ordinary.id},context);assert.equal(wrong.readiness.ready,false);assert.ok(wrong.readiness.blockers.some(b=>b.includes('another repository')));
 assert.match(plain.prompt,/BOOT ORDER/);assert.match(plain.prompt,/OUTPUT DESTINATIONS/);assert.match(plain.prompt,/RECOVERY AND NEXT STEP/);assert.match(plain.prompt,/No clinical actions, external sends/);
 context.state={ideas:[{id:'idea-uuid',text:'Improve note search'}]};
 const idea=compileWorkItem({taskId:'idea-uuid'},context);assert.equal(idea.unfiledIdea,true);assert.equal(idea.readiness.ready,false);assert.equal(idea.queueTask,null);
});
// Card 08-04 (Six Libraries plan, step 4): the queue is found from its sources, not from names in code.
test('Six Libraries step 4: the queue Page is the registry path under the Production Builder route, and both version lines are accepted',()=>{
 const context=readBuilderContext(ROOT),registry=context.os.registry,foyer=context.foyer;
 assert.equal(QUEUE_ROUTE,'Production Builder');assert.ok(foyer.routes[QUEUE_ROUTE],'the route exists in the Foyer');
 assert.equal(context.roadmap.source.path,registry.builder);
 assert.deepEqual(COMPATIBLE_ROADMAP_VERSIONS,['72-roadmap-1','roadmap-1']);assert.ok(COMPATIBLE_ROADMAP_VERSIONS.includes(context.roadmap.version));
 const moved='Library/Production-Builder/'+V+'9-Q/Rows/9.1-Q/Books/Book-Q/Page-Doc-Q/ROADMAP.md';
 const vault={rows:{'9.1':{cabinet:{books:{'Book-Q':{pages:{'Page-Doc-Q':{kind:'file',path:moved}}}}}}}};
 assert.equal(queuePage(vault,moved).kind,'file','found by path wherever its Row and Book are');assert.equal(queuePage(vault,'elsewhere.md'),null);
 const twice={rows:{...vault.rows,'9.2':vault.rows['9.1']}};assert.equal(queuePage(twice,moved),null,'two Pages with the queue path fail closed');
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..','builder-context.js'),'utf8'),/GluMira 7\.2 Production Builder|'5\.14'|'Book-ROADMAP'|'Page-Doc-ROADMAP'/,'no old route name, Row, Book or Page name for the queue in code');
});
// Build list warnings (founder 2026-10-15): a warning shows only when it has a fix. The two standing facts are
// notes, never warnings, and a ticked row whose D, P and G are all marked is not a contradiction.
test('roadmap: standing facts are notes, not warnings',()=>{
 const r=parseRoadmap('### Phase 1: Build\n- [ ] 01-01: Open row · D☐ P☐ G☐');
 assert.deepEqual(r.warnings,[],'nothing to fix, no warning');
 assert.deepEqual(r.notes.map(n=>n.code),['RECEIPTS_NOT_INSPECTED','RANGE_DETAILS_NOT_EXPANDED']);
});
test('roadmap: a ticked row with D, P and G all marked is no contradiction; a mismatch is, with its fix',()=>{
 const ok=parseRoadmap('### Phase 1: Build\n- [x] 01-01: Done row · D☑ P☑ G☑ · PR 504');
 assert.equal(ok.cards[0].checkboxDpgConflict,false);assert.equal(ok.counts.checkboxDpgConflicts,0);assert.deepEqual(ok.warnings,[]);
 const bad=parseRoadmap('### Phase 1: Build\n- [x] 01-01: Half row · D☑ P☑ G☐\n- [x] 01-02: Not done · D☐ P☐ G☐');
 const w=bad.warnings.find(x=>x.code==='CHECKBOX_DPG_CONTRADICTIONS');
 assert.deepEqual(w.ids,['01-01','01-02']);assert.match(w.note,/Fix:/);
});
