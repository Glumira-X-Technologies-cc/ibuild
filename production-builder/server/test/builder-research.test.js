'use strict';
// Builder research fix (founder 2026-10-10: "i ask to improve iob engine / your builder wants to read
// diesel engines"). Four fixes, one test group each, run on the repo's own routing map, function
// register and engine standards E01 to E05, read from this checkout.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const express=require('express');
const {searchOtherRepos,loadKnowledge,researchFor,glossaryOf,missingTests,relevant,scoreSubject,shortFormTyped,cacheSize,JEV_MAP,ROWS,rowPath,FILING_INDEX}=require('../builder-research');
const {createWebReader}=require('../builder-web');
const {createIdeasRouter,scanToolkit,nextStep,buildPrompt,FILES_PROPOSE}=require('../builder-ideas');

// The repository root from git, never a count of folders up: the Builder folder moves under a Library.
const ROOT=require('node:child_process').execFileSync('git',['rev-parse','--show-toplevel'],{cwd:__dirname,encoding:'utf8'}).trim();
// No Vault path is written in this live file (Six Libraries plan, step 4). Real paths come from the
// routing map below; made-up ones are built at run time from this root.
const V=['Vaults',''].join('/');
const readRepoFile=(s,p)=>fs.readFileSync(path.join(ROOT,p),'utf8');
// Today's Rows, found through the committed routing map the same way the Builder finds them.
const MAP=JSON.parse(readRepoFile(null,JEV_MAP));
const DOC_SET=rowPath(MAP,ROWS.docSet)+ROWS.docSet.book,TREE=rowPath(MAP,ROWS.tree)+ROWS.tree.book;
const ENGINE_FILES=fs.readdirSync(path.join(ROOT,DOC_SET)).filter(f=>/^E\d\d-Engine-.+\.md$/.test(f)).map(f=>DOC_SET+f);
const listFiles=()=>ENGINE_FILES;
const PLAN=rowPath(MAP,ROWS.docSet)+'Books/Book-Cards/Page-Doc-Cards/PLAN.md';
// A Row of today's map by its subject, and the Row path the map records for it.
const rowOf=(name,row)=>rowPath(MAP,{name,row});
const recorded=row=>MAP.records.find(r=>r.row===row).path+'/';
const FILING_LAW=rowOf('Filing Law','4.5')+'Books/Book-Filing-Law/Page-Doc-Filing-Law/GLUMIRA-FILING-LAW.md';
const SUPERSEDED=rowOf('Superseded','3.1')+'Cabinet-Superseded.md';
// git grep stand-in: the plan file mentions every engine; index files are ignored by the research.
const grep=(source,term)=>[PLAN,DOC_SET+'TRACE.md'];
let n=0;const source=()=>({repo:{slug:'Glumira-X-Technologies-cc/Glumira-7.2',commit:(++n).toString(16).padStart(40,'a'),root:ROOT}});
const know=()=>loadKnowledge(source(),{listFiles,readRepoFile});
// The founder picks one concrete goal before a prompt is written (engine-context fix): the first goal.
const goalOf=idea=>researchFor(idea,know(),{source:source(),grep}).goals[0].text;
const picked=idea=>[{id:'goal-choice',answer:goalOf(idea)}];
const SENTENCES={'improve iob engine':{subject:'IOB Hunter',engine:'E01',phrase:'insulin on board'},'improve food to curve':{subject:'Food to Curve',engine:'E03',phrase:'Meal-to-Curve'},'fix what-if engine':{subject:'What-If',engine:'E02',phrase:'What-If'}};

test('fix 1: the query expansion comes from repo data, for any GluMira subject',()=>{
  const k=know();
  assert.ok(k.subjects.some(s=>s.from==='JEV-MAP'&&s.name==='IOB Hunter'),'subjects from JEV-MAP.json');
  assert.ok(k.subjects.some(s=>s.from==='function register'),'rows from TREE.json');
  assert.deepEqual(k.engines.map(e=>e.id),['E01','E02','E03','E04','E05']);
  // The phrase for IOB is the one E01 defines, not one written in the Builder.
  const g=k.glossary.find(x=>x.abbr==='IOB');assert.equal(g.phrase,'insulin on board');assert.match(g.source,/E01-Engine-IOB-Hunter\.md$/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..','builder-research.js'),'utf8'),/insulin on board"\s*[:,]|'insulin on board'/,'no fixed IOB phrase in code');
  assert.deepEqual(glossaryOf('Computes "insulin on board" (IOB) as a series.'),[{abbr:'IOB',phrase:'insulin on board'}]);
  assert.deepEqual(glossaryOf('IOB without a definition'),[],'nothing defined, nothing expanded');
  for(const [idea,want] of Object.entries(SENTENCES)){
    const r=researchFor(idea,k,{source:source(),grep});
    assert.equal(r.subject,want.subject,idea);assert.equal(r.engine.id,want.engine,idea);
    assert.ok(r.queries.length>=2,idea);
    for(const q of r.queries){assert.match(q,/diabetes|GluMira/,'context in '+q);assert.doesNotMatch(q,/diesel|\bcar\b|motor/i,q);}
    assert.ok(r.queries.some(q=>q.includes(want.phrase)),idea+': '+r.queries.join(' | '));
    assert.equal(r.docs[0].path,DOC_SET+path.basename(r.engine.path),'the engine standard is the first repo doc');
    assert.ok(!r.docs.some(d=>/TRACE\.md$/.test(d.path)),'index files are not sources');
  }
  // The IOB idea expands IOB to the E01 phrase in its first query.
  assert.equal(researchFor('improve iob engine',k,{source:source(),grep}).queries[0],'"insulin on board" IOB diabetes');
  // Remove E01 and the expansion is gone: it lives in the repo, not in the Builder.
  const without=loadKnowledge(source(),{listFiles:()=>ENGINE_FILES.filter(f=>!/E01/.test(f)),readRepoFile});
  const r=researchFor('improve iob engine',without,{source:source(),grep});
  assert.ok(!r||!r.queries.some(q=>/insulin on board/.test(q)),'no E01, no "insulin on board"');
  assert.equal(researchFor('fix the diesel engine',k,{source:source(),grep}),null,'nothing the repo knows');
});

test('fix 1 and (a): the engine standard and its named but missing tests come from the document',()=>{
  const k=know(),e01=k.engines.find(e=>e.id==='E01');
  assert.deepEqual(e01.missing,missingTests(readRepoFile(null,e01.path)));
  assert.ok(e01.missing.includes('iob-chart-renders-series'),e01.missing.join(', '));
  assert.ok(k.engines.find(e=>e.id==='E03').aliases.includes('Meal-to-Curve'));
});

// A stub search engine that answers every query with a diesel page, a car page and a diabetes page.
let server,base,flaky=0;const queries=[];
const INSULIN='<title>Insulin on board: how IOB works in diabetes</title><p>Insulin on board is the insulin still active after a bolus. People with diabetes use it with glucose readings to avoid stacking insulin.</p>';
test.before(async()=>{
  server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://x'),send=(body)=>{res.writeHead(200,{'content-type':'text/html'});res.end(body);};
    if(u.pathname==='/ddg'){queries.push(u.searchParams.get('q'));return send([['/diesel','Diesel engine IOB repair guide'],['/car','Car engine improvements'],['/insulin','Insulin on board explained'],['/meal','Meal glucose curve in diabetes']].map(([p,t])=>'<a class="result__a" href="//duckduckgo.com/l/?uddg='+encodeURIComponent(base+p)+'">'+t+'</a>').join(''));}
    if(u.pathname==='/ddgchallenge')return send('<html><title>DuckDuckGo</title><form id="challenge-form" class="anomaly-modal__form"><p>Unfortunately, bots use DuckDuckGo too. Please complete the following challenge.</p></form></html>');
    if(u.pathname==='/ddg403'){res.writeHead(403);return res.end('blocked');}
    if(u.pathname==='/ddgflaky'){flaky++;if(flaky===1){res.writeHead(429);return res.end('slow down');}return send('<a class="result__a" href="//duckduckgo.com/l/?uddg='+encodeURIComponent(base+'/insulin')+'">Insulin on board explained</a>');}
    if(u.pathname==='/diesel')return send('<title>Diesel engine IOB repair guide</title><p>Diesel engine injectors, the IOB module and the fuel pump. Engine repair for trucks and cars.</p>');
    if(u.pathname==='/car')return send('<title>Car engine improvements</title><p>How to improve a car engine with a better intake, exhaust and tuning for more power.</p>');
    if(u.pathname==='/insulin')return send(INSULIN);
    if(u.pathname==='/meal')return send('<title>Meal glucose curve in diabetes</title><p>After a meal glucose rises; carbohydrate, protein and fat change the curve. Insulin timing in diabetes matters.</p>');
    res.writeHead(404);res.end('no');
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
});
test.after(()=>{server.closeAllConnections();server.close();});
const noScrapling={path:'none',available:()=>false,run:async()=>{throw new Error('no');}};
const reader=(route='/ddg')=>createWebReader({retryPauseMs:10,dataDir:fs.mkdtempSync(path.join(os.tmpdir(),'builder-research-web-')),searchUrl:base+route+'?q=',testAllowOrigins:[base],lookup:async()=>{throw new Error('no dns');},scrapling:noScrapling,minChars:20});

test('fix 2: a subject alone runs a real search with the repo query and keeps only diabetes pages',async()=>{
  const k=know();
  for(const idea of Object.keys(SENTENCES)){
    queries.length=0;
    const research=researchFor(idea,k,{source:source(),grep});
    const out=await reader().read({idea,research});
    assert.deepEqual(queries.slice(0,research.queries.length),research.queries,'the existing DuckDuckGo search ran the repo queries');
    assert.ok(out.pages.length>=1,idea);
    for(const p of out.pages){assert.ok(relevant(p.title+' '+p.excerpt),p.url);assert.doesNotMatch(p.url+' '+p.title,/diesel|car/i);}
    assert.ok(out.notes.some(n=>/left out: not about diabetes or GluMira/.test(n)),out.notes.join(' | '));
    assert.deepEqual(out.search.queries,research.queries.slice(0,out.search.queries.length));
  }
  // No research and no research words: nothing is fetched, as before.
  queries.length=0;const plain=await reader().read({idea:'tidy builder-client.js'});
  assert.equal(queries.length,0);assert.equal(plain.pages.length,0);
});

function home(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'builder-research-skills-'));for(const s of ['ponytail','drift-buster','golden-standard','investigate','qa','taste-frontend']){fs.mkdirSync(path.join(dir,s));fs.writeFileSync(path.join(dir,s,'SKILL.md'),'---\nname: '+s+'\ndescription: '+s+'\n---\n');}return dir;}

test('fix 3: an idea about a subject the repo knows asks no questions; one it does not know still asks',()=>{
  const t=scanToolkit(home()),k=know();
  for(const idea of Object.keys(SENTENCES)){
    const research=researchFor(idea,k,{source:source(),grep});
    const first=nextStep({idea,answers:[]},t,source(),[],research);
    assert.equal(first.question.id,'goal-choice',idea+': the one question is which goal');assert.equal(first.autoReady,false);
    assert.ok(first.question.options.length>=2&&first.question.options.length<=3,idea);
    const s=nextStep({idea,answers:picked(idea)},t,source(),[],research);
    assert.equal(s.question,null,idea+': nothing else is asked');
    assert.equal(s.playback.tool,'Claude Code');assert.equal(s.playback.files,FILES_PROPOSE);assert.equal(s.playback.goal,goalOf(idea));
    assert.ok(s.answers.every(a=>a.from==='repo'||a.from==='idea'||a.from==='goal'||a.id==='goal-choice'),'every other answer is read, not asked');
  }
  assert.equal(nextStep({idea:'improve iob engine',answers:picked('improve iob engine')},t,source(),[],researchFor('improve iob engine',k,{source:source(),grep})).playback.does,'Improve how it looks or works');
  assert.equal(nextStep({idea:'fix what-if engine',answers:picked('fix what-if engine')},t,source(),[],researchFor('fix what-if engine',k,{source:source(),grep})).playback.does,'Fix something broken');
  for(const idea of Object.keys(SENTENCES))assert.ok(!nextStep({idea,answers:[]},t,source(),[],researchFor(idea,k,{source:source(),grep})).chosen.some(c=>c.id==='taste-frontend'),idea+': no page-design skill for an engine');
  assert.ok(nextStep({idea:'improve how the iob engine chart looks',answers:[]},t,source(),[],researchFor('improve how the iob engine chart looks',k,{source:source(),grep})).chosen.some(c=>c.id==='taste-frontend'),'an idea about looks still gets it');
  const plain=nextStep({idea:'tidy the diary page header',answers:[]},t,source(),[],null);
  assert.ok(plain.question,'without repo context the questions stay');assert.equal(plain.autoReady,false);
});

test('fix 1 to 3 end to end: the prompt for Claude Code cites repo docs first, then diabetes web pages, and never changes the maths',async()=>{
  const app=express();app.use(express.json());
  const src=source();
  app.use('/ideas',createIdeasRouter({skillsHome:home(),getSource:()=>src,listFiles,readRepoFile,grep,web:reader()}));
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:{code:err.code,message:err.message}}));
  const s=http.createServer(app);await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;
  const post=(p,b)=>fetch(url+'/ideas'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(r=>r.json());
  try{
    for(const [idea,want] of Object.entries(SENTENCES)){
      const step=await post('/step',{idea,answers:[]});
      assert.equal(step.question.id,'goal-choice');assert.equal(step.research.subject,want.subject);
      const out=await post('/prompt',{idea,answers:picked(idea),confirmed:true});
      assert.match(out.prompt,/^# Task for Claude Code$/m);
      assert.match(out.prompt,/^## Engine standard$/m);assert.ok(out.prompt.includes(want.engine));
      assert.doesNotMatch(out.prompt,/## Web pages read|https?:\/\//,'no web source inside the prompt');
      assert.match(out.prompt,/Do not change the .+ maths/);
      const kinds=out.references.map(r=>r.kind),firstWeb=kinds.indexOf('web');
      assert.equal(kinds[0],'repo-doc');assert.ok(firstWeb>0,'web sources follow the repo docs');
      assert.ok(kinds.slice(0,firstWeb).every(k=>k==='repo-doc'));
      assert.deepEqual(out.references.map(r=>r.n),out.references.map((r,i)=>i+1));
      for(const r of out.references.filter(r=>r.kind==='web'))assert.doesNotMatch(r.href+' '+r.label,/diesel|car/i);
      assert.ok(out.research.queries.length>=1);
    }
    const iob=await post('/prompt',{idea:'improve iob engine',answers:picked('improve iob engine'),confirmed:true});
    assert.match(iob.prompt,/IOB means "insulin on board", as defined in `[^`]*\/E01-Engine-IOB-Hunter\.md`/);
    assert.match(iob.prompt,/This prompt covers all 1 of them/);assert.match(iob.prompt,/`iob-chart-renders-series`/);
  }finally{s.close();}
});

test('review 5: a short form is spelled out only when the idea typed it, with that idea\'s own expansion',()=>{
  const k=know(),t=scanToolkit(home());
  const typed=idea=>researchFor(idea,k,{source:source(),grep}).phrases.filter(x=>x.abbr&&x.typed);
  const iob=typed('improve iob engine');
  assert.deepEqual(iob.map(x=>x.abbr),['IOB']);assert.equal(iob[0].phrase.toLowerCase(),'insulin on board');
  assert.deepEqual(typed('improve food to curve'),[]);assert.deepEqual(typed('fix what-if engine'),[]);
  for(const idea of Object.keys(SENTENCES)){
    const r=researchFor(idea,k,{source:source(),grep});const s=nextStep({idea,answers:[]},t,source(),[],r);
    const {prompt}=buildPrompt({idea,answers:s.answers,goal:'',chosen:s.chosen,research:r},source(),null);
    assert.equal(/IOB means/.test(prompt),idea==='improve iob engine',idea);
  }
  assert.match(fs.readFileSync(path.join(__dirname,'..','production-builder','builder-client.js'),'utf8'),/filter\(x=>x\.abbr&&x\.typed\)\.map\(x=>x\.abbr\+' means '/,'the thread line uses the same rule');
});

test('lazy bones 1: a score of 2 needs every telling word, and two of them, a joined name or an engine title',()=>{
  assert.equal(scoreSubject('fix the curve','Food to Curve'),1,'one word of two stays weak');
  assert.equal(scoreSubject('food curve tweaks','Food to Curve'),2);
  assert.equal(scoreSubject('basal dose','Basal Dose Window'),1,'two of three words is not all');
  assert.equal(scoreSubject('fix what-if engine','What-If Engine'),4,'a name of two or more words typed whole outranks a one-word Row name');
  assert.equal(scoreSubject('the what if bits','What-If Engine'),2,'a joined name counts whole');
  assert.equal(scoreSubject('the hunter','Hunter Engine'),1,'one plain word stays weak');
  assert.equal(scoreSubject('the hunter','Hunter Engine',[],{standard:true}),2,'an engine standard title counts whole');
  const t=scanToolkit(home()),k=know();
  for(const idea of Object.keys(SENTENCES)){const r=researchFor(idea,k,{source:source(),grep});assert.equal(r.strong,true,idea);assert.equal(nextStep({idea,answers:[]},t,source(),[],r).question.id,'goal-choice',idea+' asks only which goal');}
  const hunter=researchFor('fix the hunter thing',k,{source:source(),grep});assert.equal(hunter.strong,false);
  assert.equal(nextStep({idea:'fix the hunter thing',answers:[]},t,source(),[],hunter).autoReady,false);
});

test('lazy bones 2: a short form counts only in capitals or at three letters, never a common word',()=>{
  assert.equal(shortFormTyped('IOB','improve iob engine'),true,'lowercase iob is three letters');
  assert.equal(shortFormTyped('IS','this is slow'),false);assert.equal(shortFormTyped('IS','this IS slow'),false,'IS is a common word');
  assert.equal(shortFormTyped('CR','fix the cr window'),false,'two letters in lowercase');
  assert.equal(shortFormTyped('CR','fix the CR window'),true);
  const k={subjects:[{name:'Insulin Sensitivity',from:'engine standard'}],engines:[],glossary:[{abbr:'IS',phrase:'insulin sensitivity',source:'x.md'}]};
  const r=researchFor('this is slow',k,{grep:()=>[]});assert.ok(!r||!r.strong,'this is slow is not strong');
  const iob=researchFor('improve iob engine',know(),{source:source(),grep});assert.equal(iob.engine.id,'E01');assert.equal(iob.strong,true);
  const t=scanToolkit(home());assert.equal(nextStep({idea:'this is slow',answers:[]},t,source(),[],r).autoReady,false);
});

test('review 6: a short form only in a purpose section stays out of queries, grep and prompt',()=>{
  const k=know(),t=scanToolkit(home());
  for(const idea of Object.keys(SENTENCES)){
    const terms=[];const r=researchFor(idea,k,{source:source(),grep:(s,term)=>{terms.push(term);return grep(s,term);}});
    const s=nextStep({idea,answers:[]},t,source(),[],r);
    const {prompt}=buildPrompt({idea,answers:s.answers,goal:'',chosen:s.chosen,research:r},source(),null);
    const iob=idea==='improve iob engine';
    const own=r.engine&&/insulin on board|\bIOB\b/i.test(r.engine.name);
    assert.equal(r.queries.some(q=>/insulin on board/i.test(q)),iob||own,idea+' queries: '+r.queries.join(' / '));
    assert.equal(terms.some(x=>/insulin on board/i.test(x)),iob||own,idea+' grep: '+terms.join(' / '));
    assert.equal(/IOB means/.test(prompt),iob,idea+' prompt');
    if(!iob&&!own)assert.doesNotMatch(prompt.split('## Sources')[0],/insulin on board/i,idea);
  }
});

test('review 7: own-row docs rank first, superseded, filing-law and handover files last',()=>{
  const low=[SUPERSEDED,FILING_LAW,rowOf('Handover','4.7')+'Books/Book-Handover/Page-Doc-Handover/2026-10-09T2130Z-x.md'];
  const mid=rowPath(MAP,ROWS.tree)+'Books/Book-Baseline/Page-Doc-Baseline/GAP.md';
  // PLAN.md is a tracker now (it mentions every subject), so a plain page in the same Row stands in.
  const own='Vaults/5-Production-Builder/Rows/5.14-Build-Plan/Books/Book-Engine-Notes/Page-Doc-Engine-Notes/WHAT-IF-NOTES.md';
  const r=researchFor('fix what-if engine',know(),{source:source(),grep:()=>[...low,mid,PLAN,own]});
  const top=r.docs.slice(0,3).map(d=>path.basename(d.path));
  assert.ok(!top.includes('Cabinet-Superseded.md')&&!top.includes('GLUMIRA-FILING-LAW.md'),top.join(', '));
  assert.equal(top[0],'E02-Engine-What-If.md');assert.equal(top[1],'WHAT-IF-NOTES.md','own row before mentions');
  assert.ok(!r.docs.some(d=>d.path===PLAN),'the plan tracker is not a source');
  assert.ok(r.docs.findIndex(d=>/Handover/.test(d.path))>r.docs.findIndex(d=>d.path===mid));
});

test('merge 1: filing indexes (Library/OS, Cabinet-*, the filing law) are left out of the repo grep',()=>{
  const files=['Library/OS/GUIDE.md',MAP.vaults['4'].path+'/GUIDE.md',rowPath(MAP,ROWS.tree)+'old-superseded-plan.md',SUPERSEDED,FILING_LAW,PLAN];
  const r=researchFor('fix what-if engine',know(),{source:source(),grep:()=>files});
  const names=r.docs.map(d=>path.basename(d.path));
  // A page with "superseded" only in its own name is not a Superseded folder: it is still read, last.
  // PLAN.md is a tracker that names every subject, so it is not a source either.
  assert.deepEqual(names,['E02-Engine-What-If.md','old-superseded-plan.md']);
  assert.ok(!r.docs.some(d=>/FILING-LAW|Cabinet-|^Library\/OS\/|GUIDE\.md$/i.test(d.path)||FILING_INDEX.test(d.path)));
});

test('merge 2: a failed search is retried once after a short pause, and the source is named',async()=>{
  flaky=0;const out=await reader('/ddgflaky').read({idea:'improve iob engine',research:{queries:['"insulin on board" IOB diabetes']}});
  assert.equal(flaky,2,'one retry');assert.ok(out.pages.some(p=>/insulin/.test(p.url)));
  assert.ok(out.notes.some(n=>/Web source: DuckDuckGo, on the second try/.test(n)),out.notes.join(' | '));
});

test('merge 3: with research set, a blocked search still reaches the prompt under Repo research notes',async()=>{
  const app=express();app.use(express.json());const src=source();
  app.use('/ideas',createIdeasRouter({skillsHome:home(),getSource:()=>src,listFiles,readRepoFile,grep,web:reader('/ddg403')}));
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:{code:err.code,message:err.message}}));
  const s=http.createServer(app);await new Promise(r=>s.listen(0,'127.0.0.1',r));
  try{
    const out=await fetch('http://127.0.0.1:'+s.address().port+'/ideas/prompt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idea:'improve iob engine',answers:picked('improve iob engine'),confirmed:true})}).then(r=>r.json());
    assert.match(out.prompt,/^## Repo research notes$/m);
    assert.match(out.prompt,/Search unavailable \(HTTP 403\), also after one retry/);
  }finally{s.close();}
});

test('merge 4: a 200 challenge page is Search unavailable, and the note reaches the prompt',async()=>{
  const out=await reader('/ddgchallenge').read({idea:'improve iob engine',research:{queries:['"insulin on board" IOB diabetes']}});
  assert.equal(out.search.status,'unavailable');assert.equal(out.pages.length,0);
  assert.ok(out.notes.some(n=>/^Search unavailable \(DuckDuckGo asked for a bot check\)/.test(n)),out.notes.join(' | '));
  const app=express();app.use(express.json());const src=source();
  app.use('/ideas',createIdeasRouter({skillsHome:home(),getSource:()=>src,listFiles,readRepoFile,grep,web:reader('/ddgchallenge')}));
  const s=http.createServer(app);await new Promise(r=>s.listen(0,'127.0.0.1',r));
  try{
    const res=await fetch('http://127.0.0.1:'+s.address().port+'/ideas/prompt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idea:'improve iob engine',answers:picked('improve iob engine'),confirmed:true})}).then(r=>r.json());
    assert.match(res.prompt,/Search unavailable \(DuckDuckGo asked for a bot check\)/);
  }finally{s.close();}
});

test('lazy bones 3: the knowledge cache keeps the last three commits only',()=>{
  for(let i=0;i<5;i++)loadKnowledge({repo:{commit:String(i).repeat(40)}},{listFiles:()=>[],readRepoFile:()=>''});
  assert.ok(cacheSize()<=3,'cache size '+cacheSize());
});

test('review 1: only a strong match skips the read-back; a weak one and "fix the chart tabs" show it first',()=>{
  const t=scanToolkit(home()),k=know();
  for(const idea of Object.keys(SENTENCES)){const r=researchFor(idea,k,{source:source(),grep});assert.equal(r.strong,true,idea);}
  const weak=researchFor('fix the hunter thing',k,{source:source(),grep});
  assert.equal(weak.score,1);assert.equal(weak.strong,false);
  assert.equal(nextStep({idea:'fix the hunter thing',answers:[]},t,source(),[],weak).autoReady,false,'score 1 shows the read-back');
  const tabs=researchFor('fix the chart tabs',k,{source:source(),grep});
  assert.ok(!tabs||!tabs.strong,'fix the chart tabs is not a strong match');
  const s=nextStep({idea:'fix the chart tabs',answers:[]},t,source(),[],tabs);
  assert.equal(s.autoReady,false);assert.equal(s.question,null,'"fix" says what to do, so nothing is asked');assert.ok(s.playback,'the read-back shows');
});

test('review 2: a search with no repo subject is neither changed nor filtered',async()=>{
  for(const idea of ['research the best Node test runner','look into Vercel pricing']){
    queries.length=0;const out=await reader().read({idea,research:null});
    assert.ok(queries.length>=1,idea+' searched');
    for(const q of queries)assert.doesNotMatch(q,/diabetes/,q);
    assert.ok(out.pages.some(p=>/diesel|car/.test(p.url)),'off-topic pages are kept: '+out.pages.map(p=>p.url).join(' '));
    assert.ok(!out.notes.some(n=>/not about diabetes/.test(n)));assert.equal(out.dropped,0);
  }
});

test('review 3: missing 5.14 or 5.16 paths are named in the prompt, never skipped in silence',async()=>{
  const k=loadKnowledge(source(),{listFiles:()=>[],readRepoFile:(s,p)=>{if(p===JEV_MAP)return readRepoFile(s,p);throw new Error('moved');}});
  assert.equal(k.notes.length,2);assert.ok(k.notes.some(n=>n.includes(TREE)));assert.ok(k.notes.some(n=>n.includes(DOC_SET)));
  const app=express();app.use(express.json());const src=source();
  app.use('/ideas',createIdeasRouter({skillsHome:home(),getSource:()=>src,listFiles:()=>[],readRepoFile:k2=>{throw new Error('moved');},grep:()=>[],web:null}));
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:{code:err.code,message:err.message}}));
  const s=http.createServer(app);await new Promise(r=>s.listen(0,'127.0.0.1',r));
  try{
    const out=await fetch('http://127.0.0.1:'+s.address().port+'/ideas/prompt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idea:'improve iob engine',answers:[{id:'does',answer:'Improve how it looks or works'}],confirmed:true})}).then(r=>r.json());
    assert.match(out.prompt,/^## Repo research notes$/m);
    // The routing map itself is unreadable here, so both Rows are named by number instead of by path.
    for(const pth of [JEV_MAP,'Row 5.14','Row 5.16'])assert.ok(out.prompt.includes(pth),pth);
    assert.equal(out.repoNotes.length,3);
  }finally{s.close();}
});

test('fix 4: the chat has a labelled Clear button next to Send, at least 32px tall, with undo',()=>{
  const client=fs.readFileSync(path.join(__dirname,'..','production-builder','builder-client.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(client,/B\('Clear',/,'a text button labelled Clear');
  assert.match(client,/composerRow\(row,plusMenu\(chatMenu,'Chat options'\),null,input,clear,stop,send,/,'Clear sits right before Send');
  assert.match(client,/undoToast\('Chat cleared\.'/);assert.match(client,/B\('Undo',/);
  assert.match(client,/setTimeout\(\(\)=>\{box\.hidden=true;box\.replaceChildren\(\);\},6000\)/,'undo stays a few seconds');
  const rule=/\.pb-btn\.pb-clear\s*\{([^}]*)\}/.exec(css)[1];
  assert.match(rule,/min-height:\s*32px/);assert.match(rule,/font-weight:\s*400/);
  assert.match(css,/\.pb-composer > \.pb-btn\.pb-clear:not\(\.pb-plus\) \{ grid-column: 3; justify-self: end; \}/,'Clear has its own cell left of Send, never on top of it');
  // Clear never deletes: it moves the conversation key to a new epoch, and Undo restores the old one.
  assert.match(client,/function clearChat\(\)\{[^}]*setEpoch\(base,String\(Date\.now\(\)\)\)/);
  assert.doesNotMatch(client,/conversation\.(delete|archive)/);
  for(const f of ['builder-research.js'])assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),/\u2014/,f+' has no em dash');
});
// Folder rename safety: the 5.14 and 5.16 Rows are found by name through JEV-MAP.json on every run.
test('rename safety: today\'s layout resolves through the routing map',()=>{
  assert.equal(rowPath(MAP,ROWS.docSet),recorded('5.14'));
  assert.equal(rowPath(MAP,ROWS.tree),recorded('5.16'));
  const k=know();assert.equal(k.paths.docSet,DOC_SET);assert.equal(k.paths.tree,TREE);
  const code=fs.readFileSync(path.join(__dirname,'..','builder-research.js'),'utf8');
  for(const v of Object.values(MAP.vaults))assert.ok(!code.includes(v.path),'no Vault path in code: '+v.path);
});
test('rename safety: a Library/<Name>/ layout is followed, from a vault library field or from the files',()=>{
  const moved=JSON.parse(JSON.stringify(MAP));moved.vaults['5'].library='Builder';
  const pre='Library/Builder/';
  const files=ENGINE_FILES.map(f=>pre+f);
  const read=(s,p)=>{if(p===JEV_MAP)return JSON.stringify(moved);if(!p.startsWith(pre))throw new Error('old path');return readRepoFile(s,p.slice(pre.length));};
  const k=loadKnowledge(source(),{listFiles:()=>files,readRepoFile:read});
  assert.equal(k.paths.docSet,pre+DOC_SET);assert.equal(k.paths.tree,pre+TREE);
  assert.deepEqual(k.engines.map(e=>e.id),['E01','E02','E03','E04','E05']);
  assert.ok(k.subjects.some(s=>s.from==='function register'),'TREE.json read from the moved Row');
  assert.equal(k.notes.length,0,k.notes.join(' | '));
  // No library field: the prefix is taken from the files themselves.
  assert.equal(rowPath(MAP,ROWS.docSet,files),pre+recorded('5.14'));
  // A record whose own path already starts with Library/<Name>/.
  const own=JSON.parse(JSON.stringify(MAP));for(const r of own.records)if(r.row==='5.14')r.path=pre+r.path;
  assert.equal(rowPath(own,ROWS.docSet),pre+recorded('5.14'));
});
test('rename safety: a Row missing from the map is named in the notes, never skipped in silence',()=>{
  const gone=JSON.parse(JSON.stringify(MAP));gone.records=gone.records.filter(r=>r.row!=='5.14'&&r.row!=='5.16');
  const k=loadKnowledge(source(),{listFiles,readRepoFile:(s,p)=>p===JEV_MAP?JSON.stringify(gone):readRepoFile(s,p)});
  assert.equal(k.engines.length,0);assert.equal(k.paths.docSet,null);
  assert.ok(k.notes.some(n=>n.includes('5.14')&&n.includes(JEV_MAP)),k.notes.join(' | '));
  assert.ok(k.notes.some(n=>n.includes('5.16')&&n.includes(JEV_MAP)),k.notes.join(' | '));
});
test('rename safety: only real Archive or Superseded folders are skipped, not every file named archive',()=>{
  for(const f of [V+'3-Archive/Rows/3.1-Old/x.md',V+'5-X/Rows/5.99-Superseded/y.md',V+'5-X/Rows/5.1-A/Books/Book-Archive/z.md',V+'5-X/Cabinet-5.md','Library/OS/GUIDE.md'])assert.ok(FILING_INDEX.test(f),f);
  for(const f of [V+'5-X/Rows/5.14-Build-Plan/Books/Book-Specs/Page-Doc-Specs/archive-retention-spec.md',V+'5-X/superseded-notes.md'])assert.ok(!FILING_INDEX.test(f),f);
  const page=recorded('5.14')+'Books/Book-Specs/Page-Doc-Specs/archive-retention-spec.md';
  const r=researchFor('improve iob engine',know(),{source:source(),grep:()=>[page,V+'3-Archive/Rows/3.1-Old/iob.md']});
  assert.ok(r.docs.some(d=>d.path===page),'archive-retention-spec.md is still searched');
  assert.ok(!r.docs.some(d=>/3-Archive/.test(d.path)),'the Archive vault is skipped');
});

// Engine-context fix (founder 2026-10-11: "it does not know context", "giving a half baked
// something"). Engineering Team's six test sentences, one test each.
const {NEW_ENGINE}=require('../builder-ideas');
const ALL_FILES=require('node:child_process').execFileSync('git',['-C',ROOT,'ls-files','Vaults'],{encoding:'utf8'}).split('\n').filter(Boolean);
const OTHER={searched:['GluMira 7.1','GluMira Archive'],unavailable:['Foundation Archive'],hits:[{repo:'Glumira-X-Technologies-cc/glumira-7.1',label:'GluMira 7.1',commit:'e6a413cd8e5410a8ae0e6541421e9e9a2618da53',path:'src/engines/iob-hunter.ts'}]};
const NONE={searched:['GluMira 7.1','GluMira Archive'],unavailable:[],hits:[]};
async function withRouter(opts,fn){
  const app=express();app.use(express.json());const src=source();
  app.use('/ideas',createIdeasRouter({skillsHome:home(),getSource:()=>src,listFiles,readRepoFile,grep:()=>[],web:null,...opts}));
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:{code:err.code,message:err.message}}));
  const s=http.createServer(app);await new Promise(r=>s.listen(0,'127.0.0.1',r));
  const post=(p,b)=>fetch('http://127.0.0.1:'+s.address().port+'/ideas'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(async r=>({status:r.status,...(await r.json())}));
  try{return await fn(post);}finally{s.close();}
}
const goalsOn=(idea,others)=>researchFor(idea,know(),{source:source(),grep:()=>[],others:()=>others}).goals;

test('engine 1: "improve the iob engine" says the Row is empty, names what the other repos hold, and offers goals first',async()=>{
  await withRouter({others:()=>OTHER},async post=>{
    const step=await post('/step',{idea:'improve the iob engine',answers:[]});
    assert.equal(step.question.id,'goal-choice');assert.ok(step.question.options.length>=2&&step.question.options.length<=3);
    assert.ok(step.question.facts.some(f=>/Row 7\.1 IOB Hunter .*has no files in Glumira-7\.2 yet/.test(f)),step.question.facts.join(' | '));
    assert.ok(step.question.facts.some(f=>f.includes('src/engines/iob-hunter.ts')));
    assert.ok(step.question.options.some(o=>/Bring the IOB Hunter code from GluMira 7\.1/.test(o)));
    const early=await post('/prompt',{idea:'improve the iob engine',answers:[],confirmed:true});
    assert.equal(early.error.code,'QUESTIONS_OPEN','no prompt before a goal is picked');
    const goal=step.question.options[1];
    const out=await post('/prompt',{idea:'improve the iob engine',answers:[{id:'goal-choice',answer:goal}],confirmed:true});
    assert.equal(out.prompt.split('## Goal\n\n')[1].split('\n')[0],goal,'the goal is the choice, not the raw words');
    assert.match(out.prompt,/^## What exists and what is missing$/m);
    assert.match(out.prompt,/has no files in Glumira-7\.2 yet/);
    const readFirst=out.prompt.split('## Read first\n\n')[1].split('\n\n')[0];
    assert.ok(readFirst.includes('In glumira-7.1 (not this repo), commit e6a413cd8e54: `src/engines/iob-hunter.ts`'),readFirst);
    assert.doesNotMatch(readFirst,/Library\/OS\/|FOYER\.json|ROADMAP\.md|PLAN\.md|TRACKER\.md/,'boot files and trackers are not sources');
    assert.ok(out.references.every(r=>!/^Library\/OS\/|FOYER\.json$|ROADMAP\.md$/.test(r.path||'')),'nor references');
    assert.doesNotMatch(out.prompt,/chosen for you|A working change in the repo/,'no filler defaults');
    assert.match(out.prompt,/^## Done when\n\n- (?!Tests pass and I can see it working)/m,'done comes from the goal');
  });
});

test('engine 2: an engine nobody has gets one question and never a guessed prompt',async()=>{
  await withRouter({others:()=>NONE},async post=>{
    const step=await post('/step',{idea:'improve the zebra engine',answers:[]});
    assert.equal(step.question.id,'engine');
    assert.match(step.question.ask,/^There is no zebra engine: no Row in the routing map, no engine standard, nothing in GluMira 7\.1, GluMira Archive\. Which engine do you mean\?$/);
    assert.ok(step.question.options.includes('IOB Hunter')&&step.question.options.includes(NEW_ENGINE));
    const refused=await post('/step',{idea:'improve the zebra engine',answers:[{id:'engine',answer:NEW_ENGINE}]});
    assert.equal(refused.question,null,'no old question after the refusal');assert.match(refused.blocked,/no zebra engine/);
    const out=await post('/prompt',{idea:'improve the zebra engine',answers:[{id:'engine',answer:NEW_ENGINE}],confirmed:true});
    assert.equal(out.status,409);assert.equal(out.error.code,'NO_SOURCE');assert.ok(!out.prompt);
    // Naming a real engine routes the idea to it.
    const named=await post('/step',{idea:'improve the zebra engine',answers:[{id:'engine',answer:'IOB Hunter'}]});
    assert.equal(named.research.subject,'IOB Hunter');assert.equal(named.question.id,'goal-choice');
  });
});

test('engine 3: a Row that has files lists its own files ahead of the generic plan files',async()=>{
  await withRouter({listFiles:()=>ALL_FILES,others:()=>NONE},async post=>{
    const idea='improve the build plan';
    const step=await post('/step',{idea,answers:[]});
    assert.equal(step.research.row.row,'5.14');assert.equal(step.research.row.empty,false);
    const answers=step.question?.id==='goal-choice'?[{id:'goal-choice',answer:step.question.options[0]}]:[];
    const out=await post('/prompt',{idea,answers,confirmed:true});
    const lines=out.prompt.split('## Read first\n\n')[1].split('\n\n')[0].split('\n');
    const own=lines.findIndex(l=>l.includes('Rows/5.14-Build-Plan/'));
    assert.ok(own>=0&&own<=1,lines.join('\n'));assert.ok(!lines.some(l=>l.includes('Library/OS/')),'boot files are steps, not sources');
  });
});

test('engine 4: no "Not sure" lines, no questions inside the prompt, and notes are findings',async()=>{
  const web={read:async()=>({pages:[],unread:[],notes:['Web source: DuckDuckGo.'],search:{status:'ok',queries:[]}}),saved:()=>null};
  await withRouter({others:()=>OTHER,web},async post=>{
    for(const idea of ['improve the iob engine','fix what-if engine']){
      const step=await post('/step',{idea,answers:[]});
      const out=await post('/prompt',{idea,answers:[{id:'goal-choice',answer:step.question.options[0]}],confirmed:true});
      assert.doesNotMatch(out.prompt,/Not sure/,idea);
      assert.ok(!out.prompt.split('\n').some(l=>/\?\s*$/.test(l)),idea+': a line ends in a question mark');
      assert.doesNotMatch(out.prompt,/^- Web source: \S+\.?$/m,idea);
      assert.match(out.prompt,/^- Web search: none found\.$/m,idea);
      assert.doesNotMatch(out.prompt,/^## What it does$/m,'a default is not printed as an answer');
    }
  });
});

test('engine 5: the insulin chart skills come only with a goal that touches a chart',()=>{
  const t=scanToolkit(home()),k=know(),idea='improve the iob engine';
  const r=researchFor(idea,k,{source:source(),grep:()=>[],others:()=>OTHER});
  const chart=r.goals.find(g=>g.chart),plain=r.goals.find(g=>!g.chart);
  assert.ok(chart&&plain,r.goals.map(g=>g.text).join(' | '));
  const ids=g=>nextStep({idea,answers:[{id:'goal-choice',answer:g.text}]},t,source(),[],r).chosen.map(c=>c.id);
  assert.ok(!ids(plain).includes('drift-buster')&&!ids(plain).includes('golden-standard'),ids(plain).join(','));
  assert.ok(ids(chart).includes('drift-buster'),ids(chart).join(','));
});

test('engine 6: the IOB maths lock stays word for word, and duplicate names are said out loud',async()=>{
  await withRouter({others:()=>OTHER},async post=>{
    const step=await post('/step',{idea:'improve the iob engine',answers:[]});
    for(const goal of step.question.options){
      const out=await post('/prompt',{idea:'improve the iob engine',answers:[{id:'goal-choice',answer:goal}],confirmed:true});
      assert.ok(out.prompt.includes('- Do not change the IOB Hunter maths: no change to its formulas, curves, constants or clinical thresholds. Tests, wording and non-clinical code only, unless the founder unlocks it.'),goal);
    }
  });
  const dup=JSON.parse(JSON.stringify(MAP));dup.records.push({subject:'Build Plan',vault:'4',row:'4.99',path:'Vaults/4-Governance/Rows/4.99-Build-Plan'});
  const k=loadKnowledge(source(),{listFiles,readRepoFile:(s,p)=>p===JEV_MAP?JSON.stringify(dup):readRepoFile(s,p)});
  assert.equal(k.paths.docSet,DOC_SET,'the Row number decides');
  assert.ok(k.notes.some(n=>/More than one record .* named "Build Plan": Row 5\.14 was taken by its number/.test(n)),k.notes.join(' | '));
});

test('engine 7: the other-repo search has one 20 second limit, and names what it skipped',()=>{
  const fsx=require('node:fs');const dir=fsx.mkdtempSync(path.join(os.tmpdir(),'roots-'));
  for(const n of ['glumira-7.1','glumira-archive']){fsx.mkdirSync(path.join(dir,n));require('node:child_process').execFileSync('git',['init','-q',path.join(dir,n)]);}
  const reg={repos:[{label:'GluMira 7.1',repo:'X/glumira-7.1'},{label:'GluMira Archive',repo:'X/glumira-archive'},{label:'Foundation Archive',repo:'X/Foundation-Archive'}]};
  const out=searchOtherRepos(reg,['IOB Hunter'],{roots:dir,limitMs:0});
  assert.deepEqual(out.searched,[]);
  assert.ok(out.unavailable.includes('GluMira 7.1 (time ran out)')&&out.unavailable.includes('Foundation Archive (no local copy)'),out.unavailable.join(' | '));
  const ok=searchOtherRepos(reg,['IOB Hunter'],{roots:dir});
  assert.deepEqual(ok.searched,['GluMira 7.1','GluMira Archive']);assert.equal(ok.hits.length,0);
});

test('engine 8: the other-repo search does not block the server, and the limit cuts a slow git',{skip:process.platform==='win32'&&'uses a shell script as a slow git'},async()=>{
  const fsx=require('node:fs'),{searchOtherReposAsync}=require('../builder-research');
  const dir=fsx.mkdtempSync(path.join(os.tmpdir(),'slow-'));const bin=path.join(dir,'bin');fsx.mkdirSync(bin);
  fsx.writeFileSync(path.join(bin,'git'),'#!/bin/sh\nsleep 3\n',{mode:0o755});
  for(const n of ['glumira-7.1','glumira-archive'])fsx.mkdirSync(path.join(dir,n,'.git'),{recursive:true});
  const reg={repos:[{label:'GluMira 7.1',repo:'X/glumira-7.1'},{label:'GluMira Archive',repo:'X/glumira-archive'}]};
  const oldPath=process.env.PATH;process.env.PATH=bin+path.delimiter+oldPath;
  try{
    let ticks=0;const iv=setInterval(()=>ticks++,50);const t0=Date.now();
    const out=await searchOtherReposAsync(reg,['IOB Hunter'],{roots:dir,limitMs:1000});
    clearInterval(iv);const took=Date.now()-t0;
    assert.ok(ticks>=10,'the event loop kept running during the search: '+ticks+' ticks');
    assert.ok(took<2500,'the limit cut the slow git: '+took+' ms');
    assert.deepEqual(out.unavailable,['GluMira 7.1 (time ran out)','GluMira Archive (time ran out)']);
  }finally{process.env.PATH=oldPath;}
});

test('engine 9: a Row idea with no goal prints no made-up Done line and no memory notes as sources',async()=>{
  const {memoryRoot}=require('../builder-research');
  assert.equal(memoryRoot({vaults:{2:{name:'Memory',path:'Vaults/2-Memory'}}}),'Vaults/2-Memory/');
  assert.equal(memoryRoot({vaults:{2:{name:'Memory',path:'Vaults/Memory'}}}),'Vaults/Memory/','no number prefix');
  assert.equal(memoryRoot(null,['Vaults/Memory/Rows/x.md']),'Vaults/Memory/','found by name without a map');
  const nk=know();nk.memory='Vaults/Memory/';
  const n=researchFor('improve the build plan',nk,{source:source(),grep:()=>['Vaults/Memory/Rows/Agent-Memory/feedback-x.md']});
  assert.ok(n&&!n.docs.some(d=>/Memory\//.test(d.path)),'no-prefix memory notes are not sources');
  const r=researchFor('improve the build plan',{...know(),memory:'Vaults/2-Memory/'},{source:source(),grep:()=>['Vaults/2-Memory/Rows/2.1-Agent-Memory/Books/Book-Agent-Memory/Page-Doc-Agent-Memory/feedback-clean-slate-is-same-snapshot.md']});
  assert.ok(r&&!r.docs.some(d=>/2-Memory/.test(d.path)),'memory notes are hints, not sources');
});

// Engine follow-up cards (Ruflo, 2026-10-13): a routing map that does not match stops the Builder, the
// repo grep never blocks the server, and every Row asks for its goal first.
test('engine 10: a routing map that does not match the repo stops the Builder and lists no OS boot files',async()=>{
  const {STALE_MAP,staleMap}=require('../builder-research');
  assert.equal(STALE_MAP,'Routing map out of date, regenerate JEV-MAP');
  assert.deepEqual(staleMap(MAP,ALL_FILES),[],'today\'s map matches the repo');
  assert.deepEqual(staleMap(null,ALL_FILES),[],'an unreadable map is a note, not a stop');
  assert.deepEqual(staleMap(MAP,ALL_FILES.map(f=>'Library/Builder/'+f)),[],'a Vault under a Library/<Name>/ still matches');
  const gone=JSON.parse(JSON.stringify(MAP));gone.records=gone.records.filter(r=>r.row!=='5.14');
  assert.ok(staleMap(gone,ALL_FILES).some(s=>s.includes(recorded('5.14').replace(/\/$/,''))),'a Row folder missing from the map is named');
  assert.deepEqual(staleMap(MAP,ALL_FILES,{routes:{'Made Up':'99'}}),['Foyer route "Made Up" (Vault 99) is not in '+JEV_MAP+'.'],'a Foyer route missing from the map is named');
  const read=(s,p)=>p===JEV_MAP?JSON.stringify(gone):readRepoFile(s,p);
  await withRouter({listFiles:()=>ALL_FILES,readRepoFile:read,others:()=>OTHER},async post=>{
    for(const idea of ['improve the build plan','improve the iob engine']){
      const step=await post('/step',{idea,answers:[]});
      assert.equal(step.blocked,STALE_MAP,idea);assert.equal(step.question,null,idea);assert.equal(step.research,null,idea);
      assert.doesNotMatch(JSON.stringify(step),/Library\/OS\/START|Library\/OS\/PROTOCOL|FOYER\.json|ROADMAP\.md/,idea+': no OS boot files as sources');
      const out=await post('/prompt',{idea,answers:[],confirmed:true});
      assert.equal(out.status,409);assert.equal(out.error.code,'ROUTING_MAP_STALE');assert.equal(out.error.message,STALE_MAP);assert.ok(!out.prompt,idea+': no prompt');
    }
  });
});

test('engine 11: the repo grep does not block the server, and the limit or the caller\'s signal cuts a slow git',{skip:process.platform==='win32'&&'uses a shell script as a slow git'},async()=>{
  const fsx=require('node:fs'),{grepRepoAsync}=require('../builder-research');
  const dir=fsx.mkdtempSync(path.join(os.tmpdir(),'slowgrep-'));const bin=path.join(dir,'bin');fsx.mkdirSync(bin);
  fsx.writeFileSync(path.join(bin,'git'),'#!/bin/sh\nsleep 3\n',{mode:0o755});
  const src={repo:{root:dir,commit:'a'.repeat(40)}};
  const oldPath=process.env.PATH;process.env.PATH=bin+path.delimiter+oldPath;
  try{
    let ticks=0;const iv=setInterval(()=>ticks++,50);const t0=Date.now();
    await assert.rejects(grepRepoAsync(src,'IOB Hunter',{limitMs:1000}),e=>e.code==='TIME_RAN_OUT');
    clearInterval(iv);const took=Date.now()-t0;
    assert.ok(ticks>=10,'the event loop kept running during the grep: '+ticks+' ticks');
    assert.ok(took<2500,'the limit cut the slow git: '+took+' ms');
    const ac=new AbortController();setTimeout(()=>ac.abort(),300);const t1=Date.now();
    await assert.rejects(grepRepoAsync(src,'IOB Hunter',{signal:ac.signal}),e=>e.code==='TIME_RAN_OUT');
    assert.ok(Date.now()-t1<2000,'the shared signal cut it: '+(Date.now()-t1)+' ms');
  }finally{process.env.PATH=oldPath;}
});

test('engine 12: the router prefetches every repo grep under the one signal it shares with the other-repo search',async()=>{
  const seen=[];
  const opts={grep:()=>{throw new Error('the blocking grep was called');},grepAsync:async(s,term,{signal})=>{seen.push(['grep',term,signal]);return [];},others:()=>OTHER,othersAsync:async(reg,terms,{signal})=>{seen.push(['others',terms,signal]);return OTHER;}};
  await withRouter(opts,async post=>{
    const step=await post('/step',{idea:'improve the iob engine',answers:[]});
    assert.equal(step.question.id,'goal-choice');
    assert.ok(seen.some(x=>x[0]==='grep'&&x[1]==='IOB Hunter'),'the subject is grepped');
    assert.ok(seen.some(x=>x[0]==='others'),'the other repos are searched');
    assert.equal(new Set(seen.map(x=>x[2])).size,1,'one AbortSignal for every search');
    assert.ok(step.question.facts.some(f=>f.includes('src/engines/iob-hunter.ts')),'the second pass reads the results');
  });
  await withRouter({grep:()=>[],grepAsync:async()=>{const e=new Error('time ran out');e.code='TIME_RAN_OUT';throw e;},others:()=>NONE},async post=>{
    const step=await post('/step',{idea:'improve the iob engine',answers:[]});
    assert.ok(step.repoNotes.some(n=>n==='Repo search for "IOB Hunter" not run: time ran out.'),step.repoNotes.join(' | '));
  });
});

test('engine 13: every Row asks for its goal first, from its own files, starting with "improve the build plan"',async()=>{
  const k={...know(),files:ALL_FILES};
  for(const [idea,row] of [['improve the build plan','5.14'],['improve the builder app','5.13'],['improve agent memory','2.1']]){
    const r=researchFor(idea,k,{source:source(),grep:()=>[],others:()=>NONE});
    assert.equal(r.row.row,row,idea);assert.equal(r.engine,null,idea);
    assert.ok(r.goals.length>=2&&r.goals.length<=3,idea+': '+r.goals.map(g=>g.text).join(' | '));
    assert.equal(r.goals[0].id,'row-review',idea);assert.equal(r.goals[0].review,true);
    for(const g of r.goals.filter(g=>g.files))for(const f of g.files){assert.ok(ALL_FILES.includes(f),idea+': a real file '+f);assert.ok(f.startsWith(recorded(row)),idea+': in its own Row '+f);}
  }
  const plan=researchFor('improve the build plan',k,{source:source(),grep:()=>[],others:()=>NONE});
  assert.ok(plan.goals.some(g=>(g.files||[]).some(f=>/\/PLAN\.md$/.test(f))),'the plan itself is offered');
  await withRouter({listFiles:()=>ALL_FILES,others:()=>NONE},async post=>{
    const idea='improve the build plan';
    const step=await post('/step',{idea,answers:[]});
    assert.equal(step.question.id,'goal-choice','the goal is asked first');
    assert.deepEqual(step.question.options,plan.goals.map(g=>g.text));
    const early=await post('/prompt',{idea,answers:[],confirmed:true});assert.equal(early.error.code,'QUESTIONS_OPEN','no prompt before a goal is picked');
    const g=plan.goals.find(x=>x.files);
    const out=await post('/prompt',{idea,answers:[{id:'goal-choice',answer:g.text}],confirmed:true});
    assert.equal(out.prompt.split('## Goal\n\n')[1].split('\n')[0],g.text);
    assert.equal(out.prompt.split('## Files you may create or change\n\n')[1].split('\n\n')[0],'- `'+g.files[0]+'`','only the goal\'s own file');
    assert.ok(out.prompt.includes('- '+g.done),'done comes from the goal');
    assert.doesNotMatch(out.prompt,/Tests pass and I can see it working|chosen for you|Not sure/,'no made-up defaults');
  });
});
test('engine 14: a git error in the repo grep is named in the notes, and no match is still an empty list',async()=>{
  const {grepRepoAsync}=require('../builder-research'),cp=require('node:child_process');
  const head=cp.execFileSync('git',['-C',ROOT,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  assert.deepEqual(await grepRepoAsync({repo:{root:ROOT,commit:head}},'zq-no-such-phrase-'+Date.now()),[],'no match is an empty list');
  const gone=path.join(os.tmpdir(),'no-repo-here-'+process.pid+'-'+Date.now());
  await assert.rejects(grepRepoAsync({repo:{root:gone,commit:head}},'IOB Hunter'),e=>e.code==='GIT_FAILED'&&e.message.length>0&&e.message.length<=120);
  await withRouter({grep:()=>[],grepAsync:async()=>{const e=new Error('not a git repository');e.code='GIT_FAILED';throw e;},others:()=>NONE},async post=>{
    const step=await post('/step',{idea:'improve the iob engine',answers:[]});
    assert.ok(step.repoNotes.some(n=>n==='Repo search for "IOB Hunter" failed: not a git repository.'),step.repoNotes.join(' | '));
  });
});

test('engine 15: a Row with no files asks for its goal first, from its routing entry only ("improve skills", Row 4.1)',async()=>{
  const k={...know(),files:ALL_FILES};
  const r=researchFor('improve skills',k,{source:source(),grep:()=>[],others:()=>NONE});
  assert.equal(r.row.row,'4.1');assert.equal(r.row.empty,true);assert.equal(r.engine,null);
  assert.ok(r.goals.length>=2&&r.goals.length<=3,r.goals.map(g=>g.text).join(' | '));
  assert.equal(r.goals[0].id,'row-start');assert.equal(r.goals[0].review,true);
  assert.match(r.goals[0].text,/Start Row 4\.1 Skills: it has no files yet\. Propose its first Book and Pages from its routing entry/);
  assert.ok(r.goals[0].text.includes(recorded('4.1').replace(/\/$/,'')),'the recorded Row path');
  assert.ok(r.goals[0].text.includes('Foyer: [OPEN] NO BOOK'),'the Foyer status: '+r.goals[0].text);
  const arr=JSON.parse(JSON.stringify(k.foyer));arr.vaults=Object.entries(arr.vaults).map(([id,v])=>({...v,id,rows:Object.entries(v.rows||{}).map(([row,x])=>({...x,row}))}));
  const ra=researchFor('improve skills',{...k,foyer:arr},{source:source(),grep:()=>[],others:()=>NONE});
  assert.equal(ra.row.foyer?.status,r.row.foyer.status,'the Foyer as arrays is read too');
  for(const g of r.goals){for(const f of g.files||[])assert.ok(ALL_FILES.includes(f),'a real file '+f);assert.ok(g.review,'review or proposal only: '+g.text);}
  assert.ok(r.goals.every(g=>!(g.files||[]).length),'an empty Row offers no files');
  await withRouter({listFiles:()=>ALL_FILES,others:()=>NONE},async post=>{
    const step=await post('/step',{idea:'improve skills',answers:[]});
    assert.equal(step.question.id,'goal-choice','the goal is asked first');
    assert.deepEqual(step.question.options,r.goals.map(g=>g.text));
    const out=await post('/prompt',{idea:'improve skills',answers:[{id:'goal-choice',answer:r.goals[0].text}],confirmed:true});
    assert.equal(out.prompt.split('## Goal\n\n')[1].split('\n')[0],r.goals[0].text);
    assert.doesNotMatch(out.prompt,/Tests pass and I can see it working|chosen for you|Not sure/,'no made-up defaults');
  });
});

test('engine 16: a Row with only its Cabinet offers a real other-repo hit, and "nothing found" only when nothing was',async()=>{
  const dir=recorded('4.5'),cab=ALL_FILES.find(f=>f.startsWith(dir)&&/\/Cabinet-[^/]*\.md$/.test(f.slice(dir.length-1)));
  assert.ok(cab,'Row 4.5 has a Cabinet file');
  const files=ALL_FILES.filter(f=>!f.startsWith(dir)||f===cab),k={...know(),files};
  const HIT={searched:['GluMira 7.1'],unavailable:[],hits:[{repo:'x/glumira-7.1',label:'GluMira 7.1',commit:'HEAD',path:'docs/filing-law.md'}]};
  const r=researchFor('improve the filing law',k,{source:source(),grep:()=>[],others:()=>HIT});
  assert.equal(r.row.row,'4.5');assert.equal(r.row.onlyIndex,true);assert.equal(r.engine,null);
  assert.equal(r.goals[0].id,'bring-in',r.goals.map(g=>g.text).join(' | '));assert.ok(r.goals[0].text.includes('docs/filing-law.md'));
  assert.ok(r.goals.every(g=>!g.text.includes('nothing found')),'no "nothing found" with a hit');
  const n=researchFor('improve the filing law',k,{source:source(),grep:()=>[],others:()=>NONE});
  assert.equal(n.goals[0].id,'row-start');assert.ok(n.goals.some(g=>g.id==='row-cabinet'&&g.files[0]===cab));
  assert.ok(n.goals.some(g=>g.text.includes('nothing found')),'"nothing found" when nothing was');
});

// Founder 2026-10-14: "research missing the mark". A Builder job routed to an estate Vault (here Row 4.1
// Skills in Governance) searched the web for "Skills diabetes". Vaults 1 to 6 get no subject web search.
test('research: an estate subject (Vaults 1 to 6) gets no web queries; a product subject keeps them',()=>{
  const k=know();
  const skills=researchFor('the builder does not pick the skills as it is supposed to',k,{source:source(),grep});
  if(skills&&skills.routed&&Number(skills.routed.vault)<=6)assert.deepEqual(skills.queries,[],'no "Skills diabetes" search');
  assert.ok(skills===null||skills.queries.length===0,'estate subject: no subject search');
  assert.ok(researchFor('improve iob engine',k,{source:source(),grep}).queries.length>=2,'Vault 7 engine still searches');
});

// Founder 2026-10-14, on a Builder idea turned into "Start Row 4.1 Skills": "useless". The exact name
// "production builder" outranks the one word "skills", the idea goes to the Builder's own Row 5.13, the
// founder's own words are the first goal, and the area is the Builder's server and its page together.
test('routing: a described Builder idea goes to Row 5.13 with the founder\'s words as the first goal',async()=>{
  const IDEA='i want to give this production builder to claude to improve layout, functions, debug, currently the context is screwed up. the builder does not pick the agents or skills as it is supposed to do in this app';
  const k={...know(),files:ALL_FILES};
  const r=researchFor(IDEA,k,{source:source(),grep:()=>[],others:()=>NONE});
  assert.equal(r.routed.row,'5.13',r.subject);
  assert.equal(r.goals[0].id,'as-written');assert.equal(r.goals[0].text,IDEA);
  assert.equal(researchFor('improve skills',k,{source:source(),grep:()=>[],others:()=>NONE}).goals[0].id,'row-start','a short idea keeps the Row goals');
  const WITH_APPS=[...ALL_FILES,...require('node:child_process').execFileSync('git',['-C',ROOT,'ls-files','apps'],{encoding:'utf8'}).split('\n').filter(Boolean)];
  await withRouter({listFiles:()=>WITH_APPS,others:()=>NONE},async post=>{
    const step=await post('/step',{idea:IDEA,answers:[]});
    assert.equal(step.question.id,'goal-choice');assert.equal(step.question.options[0],IDEA);
    const s2=await post('/step',{idea:IDEA,answers:[{id:'goal-choice',answer:IDEA}]});
    assert.equal(s2.area.label,'Builder App','the Builder area, not the Function Register');
    assert.ok(s2.area.count>20,'server and page files together');
  });
});
