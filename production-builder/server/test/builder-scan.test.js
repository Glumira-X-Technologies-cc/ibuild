'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {createScanService,fetchMain,readCheckpoint,CHECKPOINT}=require('../builder-scan');
const {readBuilderContext,EXPECTED_REPO}=require('../builder-context');
const {debugFindings,createBuilderRouter}=require('../builder-data-api');
const {createBuilderStore}=require('../builder-store');
function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();}
function put(root,name,body){const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,typeof body==='string'?body:JSON.stringify(body));}
function fixture(){
  // Spaces and shell metacharacters are literal paths, never shell expressions.
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'builder scan & literal-'));
  git(root,'init','-b','main');git(root,'config','user.name','Test');git(root,'config','user.email','test@example.invalid');
  git(root,'remote','add','origin','https://github.com/'+EXPECTED_REPO+'.git');
  const queue='Vaults/5-Production-Builder/queue.md';
  put(root,'Library/OS/START.md','Read committed context');
  put(root,'Library/OS/PROTOCOL.md','ARTICLE 1\n  10. Vault -> Row -> Cabinet -> Book -> Page\nARTICLE 2\n');
  put(root,'Library/OS/GUIDE.md','Main guide');put(root,'Library/OS/MEMORY-GUARD.md','Main guard');
  put(root,'Library/OS/REPO-REGISTRY.json',{active:EXPECTED_REPO,repos:[{repo:EXPECTED_REPO,active:true}],builder:queue,as_of:'fixture'});
  put(root,'Library/OS/JEV-MAP.json',{records:[],revision:'fixture'});
  put(root,'Foyer/FOYER.json',{jev_revision:'fixture',law:'Main law',routes:{'Production Builder':'5'},vaults:{5:{rows:{r:{cabinet:{books:{b:{pages:{p:{kind:'file',path:queue}}}}}}}}}});
  put(root,queue,'version: roadmap-1\n### Phase 01: Work\n- [ ] 01-01: First main task\n');
  put(root,CHECKPOINT,{edition:'Original',status:'DONE',date:'2026-10-15',schemaVersion:1,generatedAt:'2026-10-15T00:00:00Z',repositories:[]});
  put(root,'Library/OS/CHECK.mjs',"throw new Error('Fetched code must never execute');");
  git(root,'add','.');git(root,'commit','-m','first main');const first=git(root,'rev-parse','HEAD');
  put(root,queue,'version: roadmap-1\n### Phase 01: Work\n- [ ] 01-01: Latest main task\n');
  git(root,'add',queue);git(root,'commit','-m','new main');const next=git(root,'rev-parse','HEAD');
  git(root,'update-ref','refs/remotes/origin/main',first);
  git(root,'switch','-c','other-owner');
  put(root,queue,'version: roadmap-1\n### Phase 01: Work\n- [ ] 01-01: Branch task must not leak\n');
  git(root,'add',queue);git(root,'commit','-m','other owner work');const local=git(root,'rev-parse','HEAD');
  put(root,'Library/OS/GUIDE.md','Dirty guide must not leak');
  const fetchOrigin=async()=>git(root,'update-ref','refs/remotes/origin/main',next);
  return {root,first,next,local,fetchOrigin};
}
test('Scan fetches main and freezes bootstrap, debug and checkpoint despite dirty other branch',async()=>{
  const f=fixture(),before=git(f.root,'status','--porcelain');
  const service=createScanService({repoRoot:f.root,fetchOrigin:f.fetchOrigin,hubRoot:path.join(f.root,'missing-hub')});
  const cached=await service.get();assert.equal(cached.repo.commit,f.first);assert.equal(cached.scan.fetchStatus,'cached');
  const context=await service.scan();
  assert.equal(context.scan.runtime.commit,f.local);assert.equal(context.scan.runtime.dirty,true);
  assert.equal(context.repo.commit,f.next);assert.match(context.roadmap.cards[0].title,/Latest main/);
  assert.equal(context.os.documents.find(d=>d.path.endsWith('GUIDE.md')).text,'Main guide');
  assert.equal(debugFindings(context).source,f.next);assert.equal(debugFindings(context).scannedAt,context.scan.scannedAt);
  assert.equal(context.documentCheckpoint.sourceCommit,f.next);assert.equal(context.documentCheckpoint.status,'available');assert.equal(context.documentCheckpoint.stampStatus,'DONE');assert.equal(context.documentCheckpoint.generatedAt,'2026-10-15T00:00:00Z');
  assert.equal(context.estateSync.status,'unavailable');
  assert.ok(context.scan.warnings.some(w=>w.code==='CHECKOUT_NOT_MAIN'));
  assert.equal(git(f.root,'branch','--show-current'),'other-owner');assert.equal(git(f.root,'rev-parse','HEAD'),f.local);
  assert.equal(git(f.root,'status','--porcelain'),before);
  assert.equal((await service.get()).repo.commit,f.next);
});
test('failed fetch reports stale cached main; no remote reference reports unavailable',async()=>{
  const f=fixture(),service=createScanService({repoRoot:f.root,fetchOrigin:async()=>{throw Error('secret must not leak');}});
  const result=await service.scan();assert.equal(result.scan.fetchStatus,'stale');assert.equal(result.repo.commit,f.first);
  assert.ok(result.scan.warnings.some(w=>w.code==='FETCH_FAILED'));assert.equal(JSON.stringify(result).includes('secret must not leak'),false);
  git(f.root,'update-ref','-d','refs/remotes/origin/main');
  await assert.rejects(service.scan(),{code:'MAIN_UNAVAILABLE'});
});
test('concurrent scan, bootstrap and debug share one in-flight fetch and one immutable generation',async()=>{
  const f=fixture();let release,calls=0;
  const gate=new Promise(resolve=>{release=resolve;});
  const service=createScanService({repoRoot:f.root,fetchOrigin:async()=>{calls++;await gate;await f.fetchOrigin();}});
  const a=service.scan(),b=service.scan(),c=service.get();assert.equal(calls,1);release();
  const results=await Promise.all([a,b,c]);assert.ok(results.every(r=>r===results[0]));assert.equal(results[0].repo.commit,f.next);
  git(f.root,'update-ref','refs/remotes/origin/main',f.first);
  assert.equal((await service.get()).repo.commit,f.next,'external ref movement cannot mix the loaded generation');
});
test('snapshot rejects injected revisions and validates origin before fetch',async()=>{
  const f=fixture();assert.throws(()=>readBuilderContext(f.root,{sourceCommit:'HEAD:../../payload'}),{code:'SOURCE_HEAD_INVALID'});
  git(f.root,'remote','set-url','origin','https://evil.invalid/repo');let fetched=false;
  await assert.rejects(createScanService({repoRoot:f.root,fetchOrigin:async()=>{fetched=true;}}).scan(),{code:'SOURCE_ORIGIN_MISMATCH'});assert.equal(fetched,false);
});
test('Git fetch supports literal checkout paths and does not move local HEAD or dirty bytes',async()=>{
  const f=fixture(),remote=fs.mkdtempSync(path.join(os.tmpdir(),'builder remote & literal-'));
  git(remote,'init','--bare');git(f.root,'push',remote,'main:main');
  git(f.root,'remote','set-url','origin',remote);
  const before=git(f.root,'status','--porcelain');await fetchMain(f.root);
  assert.equal(git(f.root,'rev-parse','refs/remotes/origin/main'),f.next);
  assert.equal(git(f.root,'rev-parse','HEAD'),f.local);assert.equal(git(f.root,'status','--porcelain'),before);
});
test('HTTP scan returns matching bootstrap/debug and reads remain pinned without extra fetches',async t=>{
  const f=fixture();let calls=0;
  const scans=createScanService({repoRoot:f.root,fetchOrigin:async()=>{calls++;await f.fetchOrigin();}});
  const store=createBuilderStore({dataDir:path.join(f.root,'runtime')});
  const app=require('express')();app.use('/api/builder',createBuilderRouter({repoRoot:f.root,store,scanService:scans}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();});
  const url='http://127.0.0.1:'+server.address().port+'/api/builder';
  const response=await fetch(url+'/scan',{method:'POST'});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const result=await response.json();assert.equal(result.bootstrap.repo.commit,f.next);assert.equal(result.debug.source,f.next);
  const [boot,debug,estate]=await Promise.all(['/bootstrap','/debug','/estate'].map(async p=>(await fetch(url+p)).json()));
  assert.equal(boot.repo.commit,debug.source);assert.equal(estate.scan.commit,f.next);assert.equal(calls,1);
  assert.equal(estate.estateSync.status,'unavailable');
});
test('checkpoint schema 2 with review record sets is read; an unknown schema is unavailable',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'builder checkpoint-'));
  git(root,'init','-b','main');git(root,'config','user.name','Test');git(root,'config','user.email','test@example.invalid');
  put(root,CHECKPOINT,{edition:'Original',status:'DONE',date:'2026-10-17',schemaVersion:2,generatedAt:'2026-10-17T00:00:00Z',repositories:[{id:'r',counts:{documents:2,pathSparred:1}}],reviewRecordSets:[{name:'Function Register arena',rows:3}]});
  git(root,'add','.');git(root,'commit','-m','v2');const v2=git(root,'rev-parse','HEAD');
  const read=readCheckpoint(root,v2);assert.equal(read.status,'available');assert.equal(read.reviewRecordSets[0].name,'Function Register arena');assert.equal(read.repositories[0].counts.pathSparred,1);
  put(root,CHECKPOINT,{schemaVersion:3,generatedAt:'2026-10-17T00:00:00Z',repositories:[]});
  git(root,'add','.');git(root,'commit','-m','v3');assert.equal(readCheckpoint(root,git(root,'rev-parse','HEAD')).status,'unavailable');
});
