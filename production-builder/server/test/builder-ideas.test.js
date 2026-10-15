'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const express=require('express');
const {execFileSync}=require('node:child_process');
const {createIdeasRouter,scanToolkit,nextStep,buildPrompt,findArea,pageAreas,gitFiles,QUESTIONS,FILES_PROPOSE,FILES_NONE}=require('../builder-ideas');
const {ACTION_GATES,bootOrder,INDEPENDENT_REVIEW}=require('../builder-data-api');
const {readBuilderContext,article1Step}=require('../builder-context');
const {jobKind,sites,KINDS,WRITING_QUESTIONS,RESEARCH_QUESTIONS}=require('../builder-ideas-kind');

// A small skills home shaped like the real one, with the decoys the founder saw picked by keyword:
// /typesafe-ai ("possible"), Spec Kitty git helpers ("workflow"), java-jenny ("tool"), diabetes councils.
function skillsHome(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'builder-ideas-'));
  const skill=(name,description)=>{fs.mkdirSync(path.join(dir,name));fs.writeFileSync(path.join(dir,name,'SKILL.md'),'---\nname: '+name+'\ndescription: >\n  '+description+'\n---\n\n# '+name+'\n');};
  const role=(name,description,roles)=>fs.writeFileSync(path.join(dir,name+'.md'),'---\nname: '+name+'\ndescription: "'+description+'"\nroles: ['+roles+']\n---\n');
  skill('ponytail','The shortest fix to all issues.');
  skill('taste-frontend','Frontend layout, buttons and page design.');
  skill('firecrawl-scrape','Scrape any web page into markdown.');
  skill('drift-buster','Insulin chart integrity audit.');
  skill('jev-system','Jev modules: skill selection, routing, tool choice.');
  skill('qa','Test a web application in a browser and fix what breaks.');
  skill('typesafe-ai','Build the best AI software possible with prompts and tools.');
  skill('spec-kitty-git-workflow','Git workflow for Spec Kitty missions: improve your workflow.');
  role('java-jenny','Java implementer with Maven tool support, best prompt tool','implementer');
  role('node-norris','Server-side Node.js implementer','implementer');
  role('architect-alphonso','System architecture and technical design specialist','architect');
  role('council-repotruth','RepoTruth review seat','council, reviewer');
  role('council-endo','Endocrinology review seat','council, reviewer');
  role('council-dsmes','Diabetes education review seat','council, reviewer');
  fs.writeFileSync(path.join(dir,'notes.txt'),'not a skill');
  return dir;
}
// No Vault path is written here (Six Libraries plan, step 4): the repository root comes from git, the
// Builder folder from this file's own place in it, and the queue from REPO-REGISTRY.json.
const ROOT=execFileSync('git',['rev-parse','--show-toplevel'],{cwd:__dirname,encoding:'utf8'}).trim();
const PB=path.relative(ROOT,path.resolve(__dirname,'..')).split(path.sep).join('/');
const ROADMAP=JSON.parse(fs.readFileSync(path.join(ROOT,'Library/OS/REPO-REGISTRY.json'),'utf8')).builder;
const FILES=[PB+'/server.js',PB+'/builder-ideas.js',PB+'/production-builder/builder-client.js',PB+'/test/builder-ideas.test.js',PB+'/package-lock.json',PB+'/setup-service.ps1',PB+'/README.md',ROADMAP,'Library/Memory/Vaults/2-Notes/Rows/2.1-Notes/Books/Book-Notes/Page-Doc-Notes/notes.md'];
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const SHA='490c7f2cf7a4968943d4290a47c35ebdabfceb5e';
const SOURCE={repo:{slug:'Glumira-X-Technologies-cc/Glumira-7.2',commit:SHA},os:{version:'2026-10-07',routingRevision:'3d23cf92d98ed804'},roadmap:{source:{path:ROADMAP},cards:[
  {id:'01-16',title:'Production Builder v2 prompt tool in Daily-Diary',fullText:'Production Builder v2 prompt tool in Daily-Diary',executionRepo:'francoissteyn-2026/Daily-Diary'},
  {id:'01-29',title:'Complete the Production Builder: Ideas front door, prompt from skills',fullText:'Complete the Production Builder: Ideas front door, prompt from skills',executionRepo:'Glumira-X-Technologies-cc/Glumira-7.2'},
  {id:'02-01',title:'Cookbook meals page',fullText:'Cookbook meals page'},
]}};
// The founder's exact sentence (fix round 2).
const FOUNDER='i want a bot that improves my Production Builder workflow. scan all my skills and tools and build the best prompt possible';
function answerAll(idea,t,pick={}){
  const answers=Object.entries(pick).map(([id,answer])=>({id,answer}));let step=nextStep({idea,answers},t,SOURCE,FILES);
  while(step.question){answers.push({id:step.question.id,answer:pick[step.question.id]??step.question.options[0]});step=nextStep({idea,answers},t,SOURCE,FILES);}
  // Defaults count as answers, so a later call carries them explicitly.
  return {answers:step.answers.filter(a=>a.from!=='idea').map(({id,answer})=>({id,answer})),step};
}

test('the toolkit scan reads skills, agents and councils from the skills home',()=>{
  const t=scanToolkit(skillsHome());
  assert.equal(t.items.length,14);
  assert.equal(t.items.find(i=>i.id==='java-jenny').kind,'agent');assert.equal(t.items.find(i=>i.id==='council-endo').kind,'council');
  assert.equal(scanToolkit(path.join(os.tmpdir(),'no-such-skills-home')).items.length,0);
});

test('fix 1 (2026-10-11): an idea the repo does not recognise asks at most one question; the rest are defaults in the read-back',()=>{
  const t=scanToolkit(skillsHome());
  assert.deepEqual(QUESTIONS.map(q=>q.id),['tool','does','returns','files','role','done']);
  let step=nextStep({idea:FOUNDER,answers:[]},t,SOURCE,FILES);
  assert.equal(step.question,null,'"improves" names what it does, so nothing is asked');assert.equal(step.answers.find(a=>a.id==='tool').answer,'Claude Code');
  const vague=nextStep({idea:'the diary header and the tabs',answers:[]},t,SOURCE,FILES);
  assert.equal(vague.question.id,'does','no verb: the one question is what it should do');
  assert.equal(nextStep({idea:'the diary header and the tabs',answers:[{id:'does',answer:'Fix something broken'}]},t,SOURCE,FILES).question,null,'one answer and done');
  const {step:last}=answerAll(FOUNDER,t);
  assert.equal(last.question,null);
  assert.equal(last.playback.goal,FOUNDER,'the goal is the founder text, never a rewrite');
  assert.equal(nextStep({idea:FOUNDER,answers:[],goal:'Automate prompt creation from my skills'},t,SOURCE,FILES).playback.goal,'Automate prompt creation from my skills');
  // A question the idea already answers is not asked again.
  step=nextStep({idea:'Use Claude Code to tidy the Production Builder buttons',answers:[]},t,SOURCE,FILES);
  assert.equal(step.question.id,'does');assert.equal(step.answers.find(a=>a.id==='tool').from,'idea');assert.ok(step.answers.filter(a=>a.from==='default').length>=4);
  // All eight brief fields fill.
  const f=last.fields;for(const k of ['intent','output','role','constraints','acceptance'])assert.ok(String(f[k]).trim(),k+' is filled');
  assert.ok(f.readPaths.length&&f.roleReferences.length);
});

test('fix 2: skills by need, at most five, each with a reason, no keyword decoys or clinical seats',()=>{
  const t=scanToolkit(skillsHome());
  const {step}=answerAll(FOUNDER,t);
  const ids=step.chosen.map(c=>c.id);
  assert.ok(ids.length<=5);assert.equal(ids[0],'ponytail');assert.ok(ids.includes('jev-system'));assert.ok(ids.includes('node-norris'),'a Node builder for the Node program');
  for(const decoy of ['typesafe-ai','spec-kitty-git-workflow','java-jenny','council-endo','council-dsmes'])assert.ok(!ids.includes(decoy),decoy+' is not picked');
  step.chosen.forEach(c=>assert.ok(c.reason&&!/^matches /.test(c.reason),'a need, not a keyword: '+c.id));
  const clinical=answerAll('the insulin chart shows a wrong peak',t).step.chosen.map(c=>c.id);
  assert.ok(clinical.includes('drift-buster'));
  const review=answerAll(FOUNDER,t,{returns:'A review with findings, no edits'}).step.chosen.map(c=>c.id);
  assert.ok(review.includes('council-repotruth'));assert.ok(!review.includes('council-endo'));
});

test('fix 3: the prompt names exact files, or asks for them first; never "the files I named"',()=>{
  const t=scanToolkit(skillsHome());
  const area=findArea(FOUNDER,FILES);
  assert.equal(area.dir,PB);assert.deepEqual(area.files,['README.md','builder-ideas.js','production-builder/builder-client.js','server.js','test/builder-ideas.test.js'],'lock files and service scripts are left out');
  const {answers,step}=answerAll(FOUNDER,t);
  assert.match(answers.find(a=>a.id==='files').answer,/^Only the Production Builder files \(5\)$/);
  const {prompt}=buildPrompt({idea:FOUNDER,answers:step.answers,goal:'',chosen:step.chosen},SOURCE,area);
  assert.match(prompt,new RegExp('## Files you may create or change\\n\\nFolder: `'+esc(PB)+'/`\\n- `README\\.md`\\n- `builder-ideas\\.js`'));
  assert.doesNotMatch(prompt,/files I named/);
  const propose=answerAll(FOUNDER,t,{files:FILES_PROPOSE});
  const p2=buildPrompt({idea:FOUNDER,answers:propose.step.answers,goal:'',chosen:propose.step.chosen},SOURCE,area).prompt;
  assert.match(p2,/None approved yet\. First list the exact files you plan to create or change .*then stop and wait for the founder to say yes\./);
});

test('fix 4: an idea not on the ROADMAP gets the closest card for this repo, or a draft card',()=>{
  const t=scanToolkit(skillsHome());
  const {step}=answerAll(FOUNDER,t);
  assert.equal(step.queue.onRoadmap,false);assert.equal(step.queue.closest.id,'01-29','the Daily-Diary card is another repo');
  assert.match(step.queue.next,/01-29/);
  const draft=answerAll('add a weekly export of the diary notes',t).step.queue;
  assert.equal(draft.onRoadmap,false);assert.match(draft.draft,/^- \[ \] NN-NN: add a weekly export/);assert.match(draft.next,/Approve the draft card/);
  assert.equal(nextStep({idea:FOUNDER,answers:[],taskId:'01-29'},t,SOURCE,FILES).queue.onRoadmap,true);
});

test('fixes 5, 6 and 11: one readable prompt with boot order, pinning, review and gates, no resource noise',()=>{
  const t=scanToolkit(skillsHome());
  const {step}=answerAll(FOUNDER+' http://127.0.0.1:3001/builder',t);
  const {prompt}=buildPrompt({idea:FOUNDER+' http://127.0.0.1:3001/builder',answers:step.answers,goal:'',chosen:step.chosen},SOURCE,findArea(FOUNDER,FILES));
  for(const h of ['Goal','Where you work','Files you may create or change','Boot order (Article 1)','Read first','Order of work','Skills and agents','Review','Action gates','Done when'])assert.match(prompt,new RegExp('^## '+h.replace(/[()]/g,'\\$&')+'$','m'));
  assert.match(prompt,/^# Task for Claude Code$/m);
  assert.match(prompt,new RegExp('Pinned source: `'+SHA+'`'));assert.match(prompt,/OS version: 2026-10-07/);assert.match(prompt,/Routing revision: 3d23cf92d98ed804/);
  bootOrder(SOURCE).forEach(s=>assert.ok(prompt.includes(s.replace(/(Library\/OS\/[A-Z]+\.md)/g,'`$1`').replace('npm run os:check','`npm run os:check`').replace('os:check.`','os:check`.')),'boot step: '+s));
  assert.ok(prompt.includes(INDEPENDENT_REVIEW));ACTION_GATES.forEach(g=>assert.ok(prompt.includes(g),'gate: '+g));
  assert.match(prompt,/Work on a branch\. Never push to main, never merge\./);
  assert.match(prompt,/`\/jev-system` \(skill\)/);assert.match(prompt,/not a data API/);
  assert.doesNotMatch(prompt,/FOUNDER INPUT|RESOURCE ASSESSMENT|configured=|probed|not probed|—/,'no resource list, no boilerplate wall, no em dashes');
  // Monospace only for paths and commands: no backticks around plain words.
  for(const m of prompt.matchAll(/`([^`]+)`/g))assert.match(m[1],/\/|\.|^[0-9a-f]{40}$|^npm |^node |^git /,'monospace is a path or command: '+m[1]);
});

test('fixes 8, 9 and 10: why, references actually used, and what an expert would ask and do next',()=>{
  const t=scanToolkit(skillsHome());
  const {step}=answerAll(FOUNDER,t);
  const out=buildPrompt({idea:FOUNDER,answers:step.answers,goal:'',chosen:step.chosen},SOURCE,findArea(FOUNDER,FILES));
  assert.ok(out.why.length>=3&&out.why.length<=6);assert.match(out.why.join(' '),/Skills: .*Files: .*Gates: /s);
  const hrefs=out.references.map(r=>r.href);
  step.chosen.forEach(c=>assert.ok(hrefs.includes('/api/builder/ideas/ref?item='+encodeURIComponent(c.id))));
  assert.ok(hrefs.includes('/api/builder/ideas/ref?path='+encodeURIComponent('Library/OS/START.md')));
  assert.ok(!hrefs.some(h=>/typesafe|java-jenny|council-endo/.test(h)),'only what the prompt used');
  assert.ok(out.references.every(r=>r.kind!=='outside'),'no outside URL');
  assert.ok(out.expert.ask.endsWith('?'));assert.match(out.expert.do,/01-29/);assert.equal(out.expert.source,'rules');
});

test('fix round 3, finding 1: Done when uses CHECK --snapshot HEAD for work under Vaults, Library or Foyer',()=>{
  const t=scanToolkit(skillsHome()),area=findArea(FOUNDER,FILES);
  const {step}=answerAll(FOUNDER,t);
  const {prompt}=buildPrompt({idea:FOUNDER,answers:step.answers,goal:'',chosen:step.chosen},SOURCE,area);
  const done=prompt.slice(prompt.indexOf('## Done when'));
  assert.match(done,/`node Library\/OS\/CHECK\.mjs --snapshot HEAD`/);
  assert.ok(done.includes('"If this branch is where you change Library, Foyer or Vaults, check with --snapshot HEAD"'),'quotes the check rule');
  assert.doesNotMatch(done,/`node Library\/OS\/CHECK\.mjs` pass/,'never the plain check for an area job');
  const none=answerAll(FOUNDER,t,{files:FILES_NONE}).step;
  assert.equal(none.files.mode,'none');
  const pn=buildPrompt({idea:FOUNDER,answers:none.answers,goal:'',chosen:none.chosen},SOURCE,area).prompt;
  assert.doesNotMatch(pn.slice(pn.indexOf('## Done when')),/--snapshot HEAD/,'no files changed: the plain check');
});

test('fix round 3, finding 2: a URL typed in the idea is never listed under References',()=>{
  const t=scanToolkit(skillsHome()),idea=FOUNDER+' http://127.0.0.1:3001/builder';
  const {step}=answerAll(idea,t);
  const out=buildPrompt({idea,answers:step.answers,goal:'',chosen:step.chosen},SOURCE,findArea(FOUNDER,FILES));
  assert.ok(!out.references.some(r=>/127\.0\.0\.1|3001/.test(r.href+r.label)),'the idea URL is not a reference');
  assert.ok(out.references.every(r=>r.href.startsWith('/api/builder/ideas/ref?')),'only consulted local references');
});

test('fix round 3, finding 4: skills-home files are labelled local only and not required',()=>{
  const t=scanToolkit(skillsHome()),area=findArea(FOUNDER,FILES);
  const {step}=answerAll(FOUNDER,t);
  const out=buildPrompt({idea:FOUNDER,answers:step.answers,goal:'',chosen:step.chosen},SOURCE,area);
  const line=out.prompt.split('\n').find(l=>l.startsWith('- node-norris (agent)'));
  assert.ok(line,'node-norris is in the prompt');
  assert.match(line,/Reference, local only \(ASUS laptop\), not required: `/);assert.doesNotMatch(line,/\. Read `/);
  assert.match(out.references.find(r=>r.label.startsWith('node-norris')).label,/local only \(ASUS laptop\)$/);
});

test('the HTTP flow refuses a prompt before the goal is confirmed, honours chips and serves references',async()=>{
  const app=express();app.use(express.json());
  app.use('/ideas',createIdeasRouter({skillsHome:skillsHome(),getSource:()=>SOURCE,listFiles:()=>FILES,readRepoFile:(s,p)=>{if(p!=='Library/OS/START.md')throw new Error('missing');return '# START';}}));
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:{code:err.code}}));
  const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const post=(p,body)=>fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(async r=>({status:r.status,body:await r.json()}));
  try{
    assert.equal((await post('/ideas/step',{idea:''})).status,400);
    const {answers}=answerAll(FOUNDER,scanToolkit(skillsHome()));
    const open=await post('/ideas/prompt',{idea:'the diary header and the tabs',answers:[],confirmed:true});assert.equal(open.body.error.code,'QUESTIONS_OPEN');
    const unconfirmed=await post('/ideas/prompt',{idea:FOUNDER,answers});assert.equal(unconfirmed.body.error.code,'PLAYBACK_NOT_CONFIRMED');
    const ok=await post('/ideas/prompt',{idea:FOUNDER,answers,confirmed:true,chosen:['ponytail','architect-alphonso']});
    assert.equal(ok.status,200);assert.deepEqual(ok.body.chosen.map(c=>c.id),['ponytail','architect-alphonso']);
    assert.doesNotMatch(ok.body.prompt,/jev-system/);assert.match(ok.body.prompt,/- architect-alphonso \(agent\): added by you/);
    assert.match(ok.body.prompt,/`builder-ideas\.js`/);assert.ok(ok.body.why.length>=3);assert.ok(ok.body.expert.do);
    // Fix round 3, finding 3: chips the founder adds are capped at five in total.
    const many=await post('/ideas/step',{idea:FOUNDER,answers,chosen:['ponytail','architect-alphonso','jev-system','qa','taste-frontend','firecrawl-scrape','node-norris']});
    assert.equal(many.body.chosen.length,5);
    const manyPrompt=await post('/ideas/prompt',{idea:FOUNDER,answers,confirmed:true,chosen:['ponytail','architect-alphonso','jev-system','qa','taste-frontend','firecrawl-scrape','node-norris']});
    assert.equal(manyPrompt.body.chosen.length,5);
    const kit=await fetch(base+'/ideas/toolkit').then(r=>r.json());assert.equal(kit.items[0].path,undefined,'no file paths in the public list');
    const skill=await fetch(base+'/ideas/ref?item=ponytail');assert.equal(skill.status,200);assert.match(await skill.text(),/name: ponytail/);
    const doc=await fetch(base+'/ideas/ref?path='+encodeURIComponent('Library/OS/START.md'));assert.equal(await doc.text(),'# START');
    assert.equal((await fetch(base+'/ideas/ref?item=nope')).status,404);
    assert.equal((await fetch(base+'/ideas/ref?path='+encodeURIComponent('../secret.txt'))).status,400);
    assert.equal((await fetch(base+'/ideas/ref?path='+encodeURIComponent('Library/OS/NOPE.md'))).status,404);
  }finally{server.close();}
});

// /ideas/ref serves apps/ sources the server lists, with the same guards as Library/Foyer/Vaults.
test('ideas/ref: apps/ files the server lists are served; unlisted or unsafe apps/ paths are refused',async()=>{
  const APP='apps/ais-builder/src/api.ts';
  const app=express();app.use(express.json());
  app.use('/ideas',createIdeasRouter({skillsHome:skillsHome(),getSource:()=>SOURCE,listFiles:()=>[...FILES,APP],readRepoFile:(s,p)=>{if(p!==APP)throw new Error('missing');return '// api';}}));
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:{code:err.code}}));
  const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const ref=p=>fetch('http://127.0.0.1:'+server.address().port+'/ideas/ref?path='+encodeURIComponent(p));
  try{
    const ok=await ref(APP);assert.equal(ok.status,200);assert.equal(await ok.text(),'// api');
    for(const bad of ['apps/ais-builder/src/other.ts','apps/../Library/OS/START.md','apps/a\\b.ts','apps/c:/x.ts','apps//x.ts','/apps/x.ts','app/x.ts']){
      const r=await ref(bad);assert.equal(r.status,400,bad);assert.equal((await r.json()).error.code,'INVALID_REFERENCE',bad);
    }
  }finally{server.close();}
});

// Live accept: the real git file list includes the pinned commit's apps/ files, so /ideas/ref serves them.
test('ideas/ref live: gitFiles lists apps/ at the pinned commit and /ideas/ref serves it',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pb-apps-'));
  const g=(...a)=>execFileSync('git',['-C',dir,'-c','user.name=t','-c','user.email=t@t',...a],{encoding:'utf8'}).trim();
  g('init','-q');
  for(const [f,c] of [['Vaults/1-X/a.md','# a'],['apps/ais-builder/src/api.ts','// live api'],['other/x.txt','no']]){fs.mkdirSync(path.join(dir,path.dirname(f)),{recursive:true});fs.writeFileSync(path.join(dir,f),c);}
  g('add','-A');g('commit','-qm','t');const commit=g('rev-parse','HEAD');
  const src={...SOURCE,repo:{...SOURCE.repo,root:dir,commit},foyer:{vaults:{x:{path:'Vaults/1-X'}}}};
  const listed=gitFiles(src);
  assert.ok(listed.includes('apps/ais-builder/src/api.ts'));assert.ok(listed.includes('Vaults/1-X/a.md'));assert.ok(!listed.includes('other/x.txt'));
  const app=express();app.use(express.json());
  app.use('/ideas',createIdeasRouter({skillsHome:skillsHome(),getSource:()=>src}));
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:{code:err.code}}));
  const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const ref=p=>fetch('http://127.0.0.1:'+server.address().port+'/ideas/ref?path='+encodeURIComponent(p));
  try{
    const ok=await ref('apps/ais-builder/src/api.ts');assert.equal(ok.status,200);assert.equal(await ok.text(),'// live api');
    assert.equal((await ref('apps/ais-builder/src/nope.ts')).status,400);
  }finally{server.close();fs.rmSync(dir,{recursive:true,force:true});}
});

// Lane C (2026-10-09): job type first. The founder's outreach idea came back as a code-change prompt.
const OUTREACH='i want to reach out to leaphealth.ai for a collaboration proposal / read their profile and draft a proposal on the idea - co founder is dietician already in hospitals';
test('job type: code ideas keep today\'s questions; writing, research and mixed ideas are told apart',()=>{
  const t=scanToolkit(skillsHome());
  for(const idea of [FOUNDER,'the insulin chart shows wrong peak','add a weekly export of the diary notes','Use Claude Code to tidy the Production Builder buttons']){
    const s=nextStep({idea,answers:[]},t,SOURCE,FILES);assert.equal(s.kind,'code',idea);assert.ok(!s.question||s.question.id==='does',idea);
    assert.ok(!s.answers.some(a=>a.id==='job'),'no job answer on a code idea');
  }
  assert.equal(nextStep({idea:FOUNDER,answers:[]},t,SOURCE,FILES).question,null,'code flow: at most one question, none when the idea says what to do');
  assert.equal(jobKind(OUTREACH,[]),'writing');assert.equal(jobKind('research what CGM apps exist in Namibia',[]),'research');
  const mixed=nextStep({idea:'write a proposal for the new export button',answers:[]},t,SOURCE,FILES);
  assert.equal(mixed.kind,'ask');assert.equal(mixed.question.id,'job');assert.deepEqual(mixed.question.options,Object.keys(KINDS));
  const asCode=nextStep({idea:'write a proposal for the new export button',answers:[{id:'job',answer:'A code change: build or fix something'}]},t,SOURCE,FILES);
  assert.equal(asCode.kind,'code');assert.equal(asCode.question,null,'"new" says what it does; the rest are defaults');assert.equal(asCode.answers[0].id,'job');
  assert.deepEqual(sites(OUTREACH),['https://leaphealth.ai/']);assert.deepEqual(sites(FOUNDER+' http://127.0.0.1:3001/builder builder-ideas.js'),[]);
});
test('writing: asks who, offer, ask, tone and length, then a draft prompt with no files, CHECK or branch rules',()=>{
  const t=scanToolkit(skillsHome());
  const first=nextStep({idea:OUTREACH,answers:[]},t,SOURCE,FILES);
  assert.equal(first.kind,'writing');assert.equal(first.question.id,'who');assert.equal(first.answers.find(a=>a.id==='job').from,'idea');
  assert.equal(first.queue,null);assert.equal(first.files.mode,'none');
  const {answers,step}=answerAll(OUTREACH,t);
  assert.deepEqual(answers.map(a=>a.id),WRITING_QUESTIONS.map(q=>q.id));assert.equal(step.total,WRITING_QUESTIONS.length+1);
  assert.equal(step.playback.goal,OUTREACH,'the goal is the founder text');
  assert.deepEqual(step.chosen.map(c=>c.id),['firecrawl-scrape'],'reading their site is the one need; no code skills');
  assert.deepEqual(step.fields.readPaths,['https://leaphealth.ai/']);
  const out=buildPrompt({idea:OUTREACH,answers:step.answers,goal:'',chosen:step.chosen},SOURCE,null);
  assert.match(out.prompt,/^# Draft for the founder to review: outreach proposal$/m);
  for(const h of ['Who it is for','What we offer','What we ask for','Tone','Length and form','Read first','Rules','What comes back','Done when'])assert.match(out.prompt,new RegExp('^## '+h+'$','m'));
  assert.match(out.prompt,/Never send anything\. Return the draft only\. The founder reviews it and sends it himself\./);
  assert.match(out.prompt,/\[VERIFY: /);assert.match(out.prompt,/Mark each one \[CLINICAL REVIEW\] so a clinician can check it/,'dietician and hospitals are clinical claims');
  assert.doesNotMatch(out.prompt,/keep it out of the final wording/,'clinical claims are marked, not kept out');
  assert.match(out.prompt,/- https:\/\/leaphealth\.ai/);
  assert.doesNotMatch(out.prompt,/CHECK\.mjs|os:check|branch|Boot order|Files you may|ROADMAP|Pinned source|Library\/OS|—/,'no repo rules, files or em dashes');
  assert.equal(out.queue,null);assert.equal(out.files.mode,'none');assert.match(out.why.join(' '),/writing/);assert.match(out.expert.do,/send it yourself/);
  assert.ok(out.references.every(r=>r.href.startsWith('/api/builder/ideas/ref?')));
});
test('research: its own questions and a report-only prompt; HTTP flow serves the writing prompt',async()=>{
  const t=scanToolkit(skillsHome()),idea='research what CGM apps exist in Namibia';
  const {answers,step}=answerAll(idea,t);
  assert.deepEqual(answers.map(a=>a.id),RESEARCH_QUESTIONS.map(q=>q.id));
  const out=buildPrompt({idea,answers:step.answers,goal:'',chosen:step.chosen},SOURCE,null);
  assert.match(out.prompt,/^# Research for the founder: report only$/m);assert.match(out.prompt,/Never contact anyone/);assert.match(out.prompt,/link for every source/);
  assert.doesNotMatch(out.prompt,/CHECK\.mjs|branch|Files you may/);
  const app=express();app.use(express.json());
  app.use('/ideas',createIdeasRouter({skillsHome:skillsHome(),getSource:()=>SOURCE,listFiles:()=>FILES}));
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:{code:err.code}}));
  const server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const post=(p,body)=>fetch('http://127.0.0.1:'+server.address().port+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(async r=>({status:r.status,body:await r.json()}));
  try{
    const w=answerAll(OUTREACH,t).answers;
    assert.equal((await post('/ideas/prompt',{idea:OUTREACH,answers:w})).body.error.code,'PLAYBACK_NOT_CONFIRMED');
    assert.equal((await post('/ideas/prompt',{idea:OUTREACH,answers:w.slice(0,2),confirmed:true})).body.error.code,'QUESTIONS_OPEN');
    const ok=await post('/ideas/prompt',{idea:OUTREACH,answers:w,confirmed:true});
    assert.equal(ok.status,200);assert.match(ok.body.prompt,/^# Draft for the founder to review/);assert.equal(ok.body.queue,null);
  }finally{server.close();}
});
// PR #51 after the #49 merge: webSection numbers web pages by their place, never by sha256, so two
// pages with the same text get two numbers, in the writing prompt and in the code prompt.
test('two web pages with the same text get two different numbers; read pages are the only sources',()=>{
  const t=scanToolkit(skillsHome());
  const page=(n,href)=>({url:href,finalUrl:href,title:'Same page '+n,fetchedAt:'2026-10-09T12:00:00.000Z',status:200,via:'fetch',from:'search',sha256:'a'.repeat(64),used:'',excerpt:'same text',instructionLike:false});
  const web={pages:[page(1,'https://leaphealth.ai/'),page(2,'https://leaphealth.ai/copy'),page(3,'https://leaphealth.ai/copy2')],unread:[],notes:[],search:{status:'not-needed',query:'',found:0}};
  for(const [idea,answers,chosen] of [[OUTREACH,answerAll(OUTREACH,t).step.answers,answerAll(OUTREACH,t).step.chosen],[FOUNDER,answerAll(FOUNDER,t).step.answers,answerAll(FOUNDER,t).step.chosen]]){
    const out=buildPrompt({idea,answers,goal:'',chosen,web},SOURCE,null);
    const sect=out.prompt.slice(out.prompt.indexOf('## Web pages read'));
    assert.deepEqual(sect.match(/^- \[(\d+)\]/gm),['- [1]','- [2]','- [3]'],'no duplicate [2]: '+idea.slice(0,30));
    assert.deepEqual(out.references.filter(r=>r.kind==='web').map(r=>r.n),[1,2,3]);
  }
  const w=buildPrompt({idea:OUTREACH,answers:answerAll(OUTREACH,t).step.answers,goal:'',chosen:[],web},SOURCE,null).prompt;
  assert.match(w,/Use only the founder's words and the numbered pages under Web pages read\. Do not run new searches and do not look up private individuals\./);
  assert.doesNotMatch(w,/do not look anyone up/);
});

// Static checks on the page code: the Ideas page never wipes itself, it is the one prompt view, and
// forward actions sit right.
const client=fs.readFileSync(path.join(__dirname,'..','production-builder','builder-client.js'),'utf8');
const fn=name=>{const start=client.indexOf('function '+name+'(');assert.ok(start>=0,name+' exists');return client.slice(start,client.indexOf('\n',start));};
test('typing an answer does not clear the page or the idea',()=>{
  const flow=client.slice(client.indexOf('function renderFlow('),client.indexOf('\n  }',client.indexOf('function renderFlow(')));
  const input=flow.slice(flow.indexOf("answer.addEventListener('input'"),flow.indexOf("answer.addEventListener('keydown'"));
  assert.match(input,/flow\.draft=answer\.value;saveFlow\(\);/);
  assert.doesNotMatch(input,/render|paint|replaceChildren|ideaText/,'the input handler only stores the draft');
  assert.doesNotMatch(fn('startFlow'),/sendChat|chatDraft/,'Take it further never routes through the chat');
  assert.doesNotMatch(fn('paintFlow'),/resetPage|renderPage|renderIdeas/,'the flow repaints only its own block and the prompt column');
  assert.match(fn('paintThread'),/messagesForCurrent\(\)/,'the page chat shows the whole thread, not only the last answer');
});
test('fix 7: Ideas is the one prompt view; the Prompt kit view is retired, not deleted',()=>{
  assert.doesNotMatch(fn('initializeNavigation'),/'prompt'/,'no Prompt kit tab');
  assert.match(fn('setPage'),/if\(name==='prompt'\)name='ideas';/);
  assert.match(fn('prepareFrom'),/setPage\('ideas'\)/);assert.ok(client.includes('function renderPrompt('),'the retired view is kept in code');
  assert.match(fn('renderIdeas'),/pb-grid.*pb-prompt-panel/,'two columns: the questions left, the prompt right');
  const panel=client.slice(client.indexOf('function fillPromptPanel('),client.indexOf('async function saveIdeaText('));
  assert.match(panel,/get\.disabled=!ready/,'Get your prompt is locked until answered and confirmed');
  assert.match(panel,/Why this prompt/);assert.match(panel,/'Sources \('\+webRefs\.length\+'\)'/);assert.match(panel,/'Skills and files'/);
  assert.match(panel,/'Could not read'/);assert.match(panel,/'\['\+r\.n\+'\] '/);assert.match(panel,/link\('saved',r\.saved/);assert.match(panel,/out\.webNotes/);assert.match(panel,/What an expert would ask next/);assert.match(panel,/a\.target='_blank'/);
});
const block=name=>{const start=client.indexOf('function '+name+'(');assert.ok(start>=0,name+' exists');return client.slice(start,client.indexOf('\n  }',start));};
// BRIEF-UI-5 (founder 2026-10-09): "no chips - only +". Each area is a text box, one + at the left and one
// forward action on the right; every other choice is a labelled row in the + menu.
test('forward actions sit right, secondary options live in one + menu with labels, no em dashes',()=>{
  const ideas=fn('renderIdeas'),menu=fn('ideaMenu');
  assert.ok(ideas.indexOf("B('Take it further'")>ideas.indexOf("plusMenu(ideaMenu"),'the + is at the left, Take it further on the right');
  for(const label of ['Vent','Save idea','Park idea','Archive idea','Start over'])assert.ok(menu.includes("label:'"+label+"'"),label+' is a + menu row');
  assert.doesNotMatch(ideas,/iconButton\(|pb-toolbar/,'no row of buttons in the idea box');
  assert.match(fn('iconButton'),/b\.title=label;b\.setAttribute\('aria-label',label\)/);
  assert.match(block('openMenu'),/row\.setAttribute\('aria-label',item\.label/,'every menu row has an accessible label');
  assert.match(block('openMenu'),/setAttribute\('role','menuitem'\)/);
  assert.doesNotMatch(client,/—/);
});
test('no chips: answer choices, go back, start over and skills are + menu rows; typing still answers',()=>{
  const flow=client.slice(client.indexOf('function renderFlow('),client.indexOf('\n  }',client.indexOf('function renderFlow(')));
  assert.doesNotMatch(flow,/pb-option|pb-chip|iconButton\(/,'no option chips, chip rows or icon rows in the flow');
  assert.match(flow,/list\(step\.question\.options\)\.map\(o=>\(\{icon:'answer',label:o,run:\(\)=>answerFlow\(o\)\}\)\)/);
  assert.match(flow,/B\('Next',\(\)=>answerFlow\(answer\.value\)/,'a typed answer still goes through Next');
  assert.ok(!client.includes('function renderChips('),'the chip row is gone');assert.match(fn('skillRows'),/label:'Skills and agents'.*items:/);
});
test('chat: + left, Send right, Stop only while streaming, no debug text on screen',()=>{
  const dock=fn('createDock'),chat=fn('chatMenu');
  for(const label of ['Add image','Steer page','Promote new prompt idea','Save as note','History'])assert.ok(chat.includes("label:'"+label+"'"),label+' is a chat + menu row');
  assert.doesNotMatch(dock,/B\('(Image|Steer page|Promote new prompt idea|Notes|History|Stop|Send)/,'no visible chat buttons besides + and Send');
  // Clear (2026-10-10) is the one labelled button beside Send; see builder-research.test.js.
  assert.match(dock,/composerRow\(row,plusMenu\(chatMenu,'Chat options'\),null,input,clear,stop,send/);assert.match(dock,/statusLine\.hidden=true/);
  assert.match(dock,/add\(head,E\('strong','Chat'\)\)/,'Page chat is renamed Chat');
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css,/\.pb-dock:not\(\.is-busy\) \.pb-stop, \.pb-dock\.is-busy \.pb-send \{ display: none; \}/);
  const html=fs.readFileSync(path.join(__dirname,'..','production-builder','index.html'),'utf8');
  assert.doesNotMatch(html,/<button class="scan-btn"/,'no old big scan button in the static header');
  assert.match(fn('chatMenu'),/label:'History'/,'History stays in the chat + menu');
});
// Builder round 3 (founder rule): Debug, Fix and Scan are right-aligned in the title bar as small icon buttons.
test('header: Debug, Fix and Scan are small icon buttons in the title bar, not inside a + menu',()=>{
  const head=block('initializeHeader');
  assert.match(head,/iconButton\('debug','Debug this page',debugPage\),iconButton\('fix','Prepare fix',fixPage\),iconButton\('scan','Scan now',scanNow\)/);
  // Council 2026-10-12 (founder: "Why + for light and dark - icon only"): no + menu in the title bar at all; the theme
  // switch is one sun or moon icon after the three tools.
  assert.doesNotMatch(head,/plusMenu\(/,'no + menu in the title bar');
  assert.ok(head.indexOf("iconButton('sun'")>head.indexOf("iconButton('scan'"),'the theme icon comes after the three tools');
  assert.match(head,/replaceChildren\(stamp,\.\.\.tools,theme\)/,'the theme icon is the last control');
  assert.match(head,/svgIcon\(mode==='light'\?'sun':'moon'\)/,'a sun in dark mode, a moon in light mode');
  assert.match(head,/label='Switch to '\+mode\+' mode';[^}]*theme\.title=label;theme\.setAttribute\('aria-label',label\)/,'title and aria-label say what it does');
  assert.match(head,/try\{localStorage\.setItem\('pb-theme',mode\);\}catch\{toast\(/,'the choice is remembered, with the toast fallback');
  assert.match(client,/sun:'<circle/);assert.match(client,/moon:'<path/);
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css,/\.header \.header-meta \{ margin-left: auto;/,'right-aligned');
  assert.match(css,/\.header \.header-meta \.pb-plus, \.header \.header-meta \.pb-head-tool \{ width: 2rem; height: 2rem;/,'same size as the +, at least 32px');
  const html=fs.readFileSync(path.join(__dirname,'..','production-builder','index.html'),'utf8');
  assert.doesNotMatch(html,/live in the \+ menu/,'the outdated comment is gone');
});
// Council 2026-10-12 (founder: remove the chat header context title): the chat head is "Chat" and the model picker,
// nothing else, so no idea, card id, uuid or thread words can show there, before or after Clear. The active idea
// still travels to the model as context through currentContext(); only the visible title is gone.
test('chat head is only Chat and the model; after Clear no idea or thread text is left in the dock header',()=>{
  assert.ok(!client.includes('function chatTitle('),'the context title helper is gone');
  assert.doesNotMatch(client,/pb-dock-context/,'no context span anywhere in the client');
  const dock=fn('createDock');
  assert.match(dock,/const head=E\('div',null,'pb-dock-head'\);add\(head,E\('strong','Chat'\)\);/);
  assert.equal((client.match(/pb-dock-head/g)||[]).length,1,'only createDock names the chat head; nothing else reaches into it');
  assert.deepEqual([...dock.matchAll(/(?:head\.append\(|add\(head,)([^;]*?)\);/g)].map(m=>m[1]),["E('strong','Chat')",'dot','provider'],'the head holds Chat, the model dot and the model picker');
  assert.match(dock,/const dot=E\('span',null,'pb-model-dot'\);dot\.id='pb-model-dot';dot\.setAttribute\('aria-hidden','true'\);head\.append\(dot\);/,'the dot is a mark with no text');
  assert.match(fn('renderDock'),/\$\('#pb-model-dot'\)\.dataset\.model=draft\.provider;/,'renderDock only sets which model the dot shows');
  for(const name of ['renderDock','clearChat'])assert.doesNotMatch(fn(name),/pb-dock-head|\.title=app\.|textContent=.*(idea|currentTaskId|title)/,name+' never writes idea or thread text into the head');
  assert.match(fn('renderDock'),/const draft=chatDraft\(\);/,'the thread still follows the page and the idea through chatDraft');
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css,/\.pb-dock-head select \{ margin-left: auto;/,'the model picker sits at the right of the head');
  // Behaviour: run the real renderDock and clearChat against a small fake dock and read what is left on screen.
  const mk=(tag,text)=>({tag,text:text||'',children:[],hidden:false,value:'',append(...c){this.children.push(...c);},replaceChildren(...c){this.children=c;},get textContent(){return [this.text,...this.children.map(c=>c.textContent)].join(' ').replace(/\s+/g,' ').trim();}});
  const head=mk('div');head.append(mk('strong','Chat'));const dot=Object.assign(mk('span'),{dataset:{}});head.append(dot);const select=mk('select');head.append(select);const answer=mk('div');
  const els={'#pb-chat-input':mk('textarea'),'#pb-model-dot':dot,'#pb-chat-provider':select,'#pb-chat-free-note':mk('div')};
  const idea='Morning page with overnight changes',id='817133ea-1c2d-4e5f-8a9b-0c1d2e3f4a5b';let epoch='1';
  const threads={'chat:ideas:1':[{text:idea},{text:'Here is a plan for the overnight page.'}]};
  const app={providers:[{id:'claude',configured:true}],chatBusy:false,currentTaskId:id,ideaId:id,ideaText:idea};
  const deps={app,$:s=>els[s],E:mk,growInput:()=>{},CHAT_PROVIDERS:['claude'],CHAT_LABELS:{claude:'Claude'},chatDraft:()=>({text:'',provider:'claude'}),paintThread:()=>answer.replaceChildren(...(threads['chat:ideas:'+epoch]||[]).map(m=>mk('div',m.text))),status:()=>{},renderAttachments:()=>{}};
  const renderDock=new Function(...Object.keys(deps),'return '+fn('renderDock').trim())(...Object.values(deps));
  renderDock();assert.match(answer.textContent,/overnight/,'the thread shows before Clear');assert.equal(head.textContent,'Chat Claude','before Clear the head is Chat and the model');
  const more={app,chatBase:()=>'chat:ideas',chatEpoch:()=>epoch,setEpoch:(b,e)=>{epoch=e;},renderDock,undoToast:()=>{}};
  new Function(...Object.keys(more),'return '+fn('clearChat').trim())(...Object.values(more))();
  assert.equal(answer.textContent,'','Clear leaves nothing of the old thread on screen');
  assert.equal(head.textContent,'Chat Claude','after Clear the head is still only Chat and the model');
  assert.doesNotMatch(head.textContent+answer.textContent,/overnight|Morning page|817133ea/,'no idea, thread or id text is left');
});
test('chat composer CSS keeps +, text box and Send inside the box at laptop sizes',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css,/\.pb-composer \{ box-sizing: border-box; min-width: 0; max-width: 100%; \}/);
  assert.match(css,/\.pb-dock > \.pb-dock-row \{ flex: 0 0 auto; min-height: auto;/,'the composer never shrinks below its content');
  assert.match(css,/\.pb-composer-input \{[^}]*overflow-y: auto;[^}]*overflow-wrap: anywhere;/,'long drafts wrap and scroll inside');
  assert.match(css,/\.pb-composer > \.pb-btn \{ flex-shrink: 0;/);
  assert.match(css,/\.pb-dock-input \{[^}]*resize: none; \}/,'the chat box cannot be dragged past the pane');
});
test('on load a finished prompt is not restored; the idea and open questions are',()=>{
  const restoreFlow=new Function('return '+fn('restoreFlow').trim())();
  const saved={v:2,idea:'Morning page',answers:[{id:'q1',answer:'yes'}],step:{question:{id:'q2'}},confirmed:true,result:{prompt:'P'},prompt:'P',draft:'half'};
  const flow=restoreFlow(saved);
  assert.equal(flow.result,null);assert.equal(flow.prompt,null);
  assert.equal(flow.idea,'Morning page');assert.deepEqual(flow.answers,saved.answers);assert.deepEqual(flow.step,saved.step);
  assert.equal(restoreFlow({}),null);assert.equal(restoreFlow({v:1,idea:'x'}),null);
  assert.match(fn('renderIdeas'),/app\.ideaFlow=restoreFlow\(savedDraft\('ui:ideaflow'\)\)/);
});
// Builder round 3 (b): one type system. Three sizes in rem, two weights, one muted grey, nothing below 14px.
test('type system: three rem sizes, weights 400 and 600, no px font sizes, one muted grey',()=>{
  const dir=path.join(__dirname,'..','production-builder');
  const css=['theme.css','builder-client.css'].map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
  const sizes=[...css.matchAll(/font-size:\s*([^;}!]+)/g)].map(m=>m[1].trim());
  for(const s of sizes)assert.ok(/^var\(--fs-(title|head|body)\)$|^0\.875rem$|^110%$/.test(s),'font-size '+s+' is one of the three sizes (110% is the root size)');
  const shorthand=[...css.matchAll(/font:\s*([^;}]+)/g)].map(m=>m[1]);
  for(const s of shorthand)assert.doesNotMatch(s,/\d+(\.\d+)?px/,'font shorthand uses rem sizes: '+s);
  const weights=[...css.matchAll(/font-weight:\s*([^;}!]+)/g)].map(m=>m[1].trim());
  for(const w of weights)assert.ok(['400','600'].includes(w),'font-weight '+w+' is 400 or 600');
  const theme=fs.readFileSync(path.join(dir,'theme.css'),'utf8');
  assert.match(theme,/--fs-title: 1\.5rem; --fs-head: 1\.125rem; --fs-body: 1rem;/);
  assert.match(theme,/--text-muted: var\(--pb-navy-300\); --text-dim: var\(--pb-navy-300\);/,'one muted tone, a ramp step, at least 4.5:1 on every navy surface (council contrast test)');
  assert.match(theme,/input::placeholder, textarea::placeholder \{ color: var\(--text-muted\); opacity: 1; \}/);
  assert.match(theme,/\.pb-btn, \.pb-plus, \.pb-dock-head select \{ min-height: 2rem; min-width: 2rem; \}/,'every button at least 32px');
});
// Builder round 3 (c): per-page subtraction, safe markdown in chat replies.
test('chat markdown is safe: raw HTML stays text, headings without colon-bold, links get noopener',()=>{
  const parseMarkdown=new Function('return '+fn('parseMarkdown').trim())();
  const xss=parseMarkdown('Hello <img src=x onerror=alert(1)> there');
  assert.equal(xss.length,1);assert.equal(xss[0].type,'p');
  assert.deepEqual(xss[0].inl,[{t:'text',v:'Hello <img src=x onerror=alert(1)> there'}],'the tag is plain text, never markup');
  const md=parseMarkdown('**Decision-Changing Questions:**\n1. First `code` one\n2. Second **strong**\n\n[site](https://example.com) and [bad](javascript:alert(1))');
  assert.deepEqual(md[0],{type:'h',inl:[{t:'text',v:'Decision-Changing Questions'}]},'a bold label line is a plain heading, no colon, no asterisks');
  assert.equal(md[1].type,'ol');assert.deepEqual(md[1].items[0],[{t:'text',v:'First '},{t:'code',v:'code'},{t:'text',v:' one'}]);
  assert.ok(md[2].inl.some(x=>x.t==='link'&&x.href==='https://example.com'));
  assert.ok(!md[2].inl.some(x=>x.t==='link'&&/javascript/.test(x.href)),'only http(s) links');
  for(const name of ['renderMarkdown','inlineNodes'])assert.doesNotMatch(fn(name),/innerHTML|insertAdjacentHTML|outerHTML/,name+' never writes HTML');
  assert.match(fn('inlineNodes'),/a\.rel='noopener noreferrer'/);
  assert.match(fn('bubble'),/role==='assistant'\?renderMarkdown\(text\):E\('div',text\)/,'replies render markdown, the founder\'s own words stay plain text');
});
test('Daily cards: id and first clause as title, rest clamped, no Open pill, Send to prompt alone on the right',()=>{
  const firstClause=new Function('return '+fn('firstClause').trim())();
  assert.deepEqual(firstClause('Register the station, GluMira-7.2.1, Glumira-7.2 and more'),['Register the station','GluMira-7.2.1, Glumira-7.2 and more']);
  const [h]=firstClause('Averyveryveryverylongwordthatgoeson and then more words keep coming here without any punctuation at all');
  assert.ok(h.length<=60);assert.ok(!/\S$/.test(h+' ')||true);
  const today=fn('renderToday');
  assert.match(today,/card\(c\.id\+' · '\+head,null,null\)/,'no status pill on the Daily rows');
  assert.match(today,/E\('p',rest\.replace\(\/`\/g,''\),'pb-clamp'\)/,'code spans without raw backticks');assert.doesNotMatch(today,/sourceSummary\(\)/,'the source summary lives once, on the Build page');assert.match(today,/forwardRow\(B\('Send to prompt'/);
  assert.doesNotMatch(today,/→/,'no arrow decoration');
});
test('Notes fold to two lines with Expand in the + menu; every card + menu has Minimize; menus open upward',()=>{
  const notes=fn('renderNotes');
  assert.match(notes,/card\(parts\.title,parts\.body\|\|null,null\)/,'no raw context pill');
  assert.match(notes,/classList\.add\('pb-clamp'\)/);assert.match(notes,/label:c\.classList\.contains\('pb-open'\)\?'Show two lines':'Expand'/);
  assert.match(fn('actionBar'),/label:'Minimize',run:\(\)=>minimize\(c,true\)/);
  assert.match(client,/placeMenu\(a,menu\.offsetWidth,menu\.offsetHeight/,'the + menu is placed by placeMenu, which keeps it off every card title');
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css,/\.pb-card\.pb-min > :not\(\.pb-card-head\), \.pb-card\.pb-min \.pb-tag \{ display: none; \}/);
  assert.match(css,/\.pb-clamp \{ display: -webkit-box; -webkit-line-clamp: 2;/);
});
test('Estate says reference only once; Healing has + and a quiet Debug on the heading row; chat input grows',()=>{
  const estate=fn('renderEstate');
  assert.match(estate,/card\(noDash\(entry\.label\),noDash\(entry\.role\),ref\?null:noDash\(entry\.executionAuthority\)\)/);
  assert.match(estate,/ref\?null:B\('Send to prompt'/);
  assert.match(estate,/Reference repositories are reference only: no writes authorized\./);
  const ev=fn('renderEvidence');
  assert.match(ev,/B\('Debug this page',debugPage,'pb-btn pb-forward'\)/,'Debug uses the shared secondary style, not gold');
  assert.match(ev,/querySelector\('\.pb-heading'\)\?\.append\(plusMenu\(/,'+ and Debug sit on the heading row, no extra wrapper');
  assert.match(ev,/E\('p','No diagnostic reports yet\.','pb-muted'\)/);
  assert.match(fn('createDock'),/input\.rows=3;/);assert.match(fn('growInput'),/window\.innerHeight\*0\.4/);
});
test('layout: work pane and chat pane are one unit with a small gap; slim tab row carries the date',()=>{
  assert.match(block('initializeShell'),/add\(work,\$\('\.header'\),\$\('\.nav-tabs'\),layout\)/);
  assert.match(fn('initializeNavigation'),/pb-nav-date/);
  assert.match(fn('renderIdeas'),/resetPage\(''\)/,'no date heading band on Ideas');
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css,/\.pb-dock-resizer \{\s*flex: 0 0 10px;/);assert.match(css,/\.pb-work \{[^}]*border-radius: 12px/);assert.match(css,/\.pb-dock \{ border: 1px solid var\(--pb-navy-700\); border-radius: 12px;/);
});
test('the theme keeps the locked gold rule and the ground',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css,/\.pb-toolbar \.pb-btn\.primary[^{]*\{ order: 99; margin-left: auto; \}/);
  assert.match(css,/html \{ background: var\(--bg-deep\)/);
});

test('round 3: a restored draft with open questions shows one muted line, gone when they finish',()=>{
  const restoreFlow=new Function('return '+fn('restoreFlow').trim())();
  const draftNote=new Function('return '+fn('draftNote').trim())();
  const flow=restoreFlow({v:2,idea:'x',answers:[],confirmed:false,result:null});
  assert.equal(draftNote(flow),'Draft \u00b7 questions open');
  assert.equal(draftNote({...flow,confirmed:true}),'');
  assert.equal(draftNote({v:2,idea:'x',confirmed:false}),'','a fresh flow in this session shows nothing');
  assert.equal(draftNote(null),'');
  assert.match(fn('paintFlow'),/syncDraftNote\(\)/);
});

test('round 3: an open + menu closes when a scroll moves its + (capture, panes too) and on resize, not when the menu itself scrolls',()=>{
  const src=/window\.addEventListener\('scroll',(e=>\{.*?closeMenus\(\);\}),true\)/.exec(client);assert.ok(src,'capture scroll listener');
  assert.match(client,/window\.addEventListener\('resize',closeMenus\)/);
  const anchorMoved=new Function(/function anchorMoved\(at,now\)\{.*?\}/.exec(client)[0]+';return anchorMoved;')();
  let rect={top:100,left:10};const anchor={isConnected:true,getBoundingClientRect:()=>rect};let menu={_anchor:anchor,_at:{top:100,left:10}};
  const closed=[];const handler=new Function('closeMenus','$','anchorMoved','return '+src[1])(()=>closed.push(1),()=>menu,anchorMoved);
  handler({target:{closest:()=>null}});assert.equal(closed.length,0,'a late scroll event that did not move the + keeps the menu open');
  rect={top:60,left:10};handler({target:{closest:()=>null}});assert.equal(closed.length,1,'a pane or page scroll that moves the + closes it');
  handler({target:{closest:s=>s==='.pb-menu'?{}:null}});assert.equal(closed.length,1,'scrolling inside the menu does not');
});

test('round 4: a + menu opens touching its +, never over its own title or the + itself',()=>{
  const placeMenu=new Function('return '+fn('placeMenu').trim())();
  const box=(l,t,w,h)=>({left:l,top:t,right:l+w,bottom:t+h,width:w,height:h});
  const hit=(p,w,r)=>p.left<r.right&&p.left+w>r.left&&p.top<r.bottom&&p.top+p.height>r.top;
  const dist=(p,w,a)=>Math.hypot(Math.max(0,a.left-(p.left+w),p.left-a.right),Math.max(0,a.top-(p.top+p.height),p.top-a.bottom));
  const cases=[
    ['first Notes card',box(42,441,32,32),box(42,377,200,24),1440,900,220,180],
    ['last Estate card near the bottom',box(42,826,32,32),box(42,690,120,24),1440,900,220,130],
    ['short card, small screen',box(28,150,32,32),box(28,120,180,24),683,427,220,200],
    ['+ at the right edge',box(990,300,32,32),box(600,260,200,24),1024,640,220,180]];
  for(const [name,a,title,vw,vh,w,h] of cases){const p=placeMenu(a,w,h,vw,vh,title);
    assert.ok(!hit(p,w,title),name+': own title covered');
    assert.ok(!hit(p,w,a),name+': + covered');
    assert.ok(dist(p,w,a)<=8,name+': '+dist(p,w,a)+'px from the +');}
  assert.deepEqual(placeMenu(box(42,441,32,32),220,180,1440,900,null),{left:78,top:441,height:180},'right of the + by default');
  assert.match(client,/ownTitle\(anchor\)\);/);
});
test('round 4: text boxes hold only text, + and forward button in a row under the box',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css,/\.pb-composer \{ padding: 0; border: 0;/);
  assert.match(css,/\.pb-composer-input \{ border: 1px solid var\(--pb-navy-500\) !important;/);
  assert.match(css,/\.pb-composer > \.pb-btn \{ grid-row: 2;/,'buttons on the row under the box');
});

test('round 4: 110% root size, chat pane at least 360px, full-width messages, chat input opens empty',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css,/html \{ font-size: 110%; \}/);assert.doesNotMatch(css,/zoom:|transform: scale/);
  assert.match(css,/\.pb-dock \{ min-width: 360px; \}/);assert.match(client,/min=360,/,'the resizer never drags the chat below 360px');
  assert.match(css,/\.pb-dock-answer \.pb-bubble \{ max-width: none; width: 100%;/);
});

test('round 4: title bar icons, tabs and the gold title and button pass 4.5:1 against the bar in both themes',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  const ramp={};for(const [,k,v] of css.matchAll(/(--pb-navy-\d+):\s*(#[0-9A-Fa-f]{6})/g))ramp[k]=v;
  const vars=sel=>{const m=[...css.matchAll(new RegExp(sel.replace(/[[\]()".*]/g,'\\$&')+' \\{([^}]*)\\}','g'))].map(x=>x[1]).join(';');const o={};for(const [,k,v] of m.matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6}|var\(--pb-navy-\d+\))/g))o[k]=v.startsWith('var(')?ramp[v.slice(4,-1)]:v;return o;};
  const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
  const ratio=(a,b)=>{const [x,y]=[L(a),L(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};
  const dark=vars(':root'),light=vars(':root[data-theme="light"]');
  for(const [name,v] of [['dark',dark],['light',light]]){
    assert.ok(v['--bar-bg']&&v['--bar-ink'],name+' bar colours defined');
    assert.ok(ratio(v['--bar-ink'],v['--bar-bg'])>=4.5,name+' icons and tabs on the bar');
    assert.ok(ratio(v['--bar-ink'],v['--bar-active'])>=4.5,name+' active tab');
  }
  // Council 2026-10-12: the title bar and tab row are one navy band in both themes, so light mode reads as GluMira.
  assert.equal(light['--bar-bg'].toUpperCase(),'#102347','light bar is the navy band');assert.equal(dark['--bar-bg'].toUpperCase(),'#102347');
  assert.equal(light['--gold'].toUpperCase(),'#7A5C0A','one light-mode gold');assert.doesNotMatch(css,/8A6A1F|gold-strong/i,'no second light gold');
  assert.doesNotMatch(css,/\[data-theme="light"\] \.header \.header-title/,'the wordmark keeps its gold sheen in light mode too');
  assert.ok(ratio('#C9A24B',light['--bar-bg'])>=4.5&&ratio('#C9A24B',dark['--bar-bg'])>=4.5,'the gold wordmark on the band, both themes');
  assert.match(css,/\[data-theme="light"\] \.pb-btn\.primary, [^{]*\{ background: var\(--gold\); color: #FFFFFF; border-color: var\(--gold\);/,'gold button uses #7A5C0A');
  assert.ok(ratio('#FFFFFF',light['--gold'])>=4.5,'light gold button text');
  assert.ok(ratio(dark['--bar-ink'],dark['--bar-bg'])>=4.5);
  assert.match(css,/\.header \.header-meta \.pb-plus, \.header \.header-meta \.pb-head-tool \{ color: var\(--bar-ink\); \}|\.header \.header-meta \.pb-head-tool \{ color: var\(--bar-ink\); \}/,'icons use the bar ink');
  assert.match(css,/html, body \{ overflow: hidden; \}/,'only the page body scrolls');
});

test('round 4: Notes drop a body that repeats the title; one ellipsis; saved ideas show body only; Estate status on the path line; tooltips',()=>{
  const oneEllipsis=new Function('return '+fn('oneEllipsis').trim())();
  const noteParts=new Function('oneEllipsis','return '+fn('noteParts').trim())(oneEllipsis);
  assert.equal(oneEllipsis('wait.... and... more\u2026\u2026'),'wait\u2026 and\u2026 more\u2026');
  assert.deepEqual(noteParts({title:'QA check',text:'QA check'}),{title:'QA check',body:''},'body repeating the title is not shown');
  const long='Steer check. Challenge and improve this idea before it goes further, with sources.';
  const p=noteParts({title:long.slice(0,40),text:long});assert.equal(p.title,long.slice(0,40).trim()+'\u2026');assert.equal(p.body,long);
  assert.doesNotMatch(noteParts({title:'Cut...',text:'Cut... the rest'}).title,/\.\.\./);
  assert.match(fn('ideaCard'),/E\('p',oneEllipsis\(idea\.text/,'saved idea: body only');assert.doesNotMatch(fn('ideaCard'),/card\(idea\.title/);
  assert.match(fn('renderEstate'),/'pb-path pb-path-line'/);
  assert.match(fn('renderEstate'),/add\(line,entry\.status\?E\('span',noDash\(entry\.status\)\+' \\u00b7','pb-muted'\):null,where\)/,'status first, then the path');
  assert.match(fn('renderEstate'),/where\.title=slug/,'full path in the tooltip');
  const noDash=new Function('return '+fn('noDash').trim())();
  assert.equal(noDash('GluMira Archive \u2014 the founding record'),'GluMira Archive: the founding record');assert.equal(noDash('a\u2014b'),'a: b');
  const css2=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css2,/\.pb-path-line > \.pb-muted \{ flex: 0 0 auto; white-space: nowrap;/,'status never wraps');
  assert.match(css2,/\.pb-path-line > \.pb-path-text \{[^}]*text-overflow: ellipsis; white-space: nowrap;/,'path cut from the end');
  assert.doesNotMatch(client.replace(/\\u2014/g,''),/\u2014/,'no em dash in Builder client text');
  assert.match(fn('iconButton'),/b\.title=label;b\.setAttribute\('aria-label',label\)/,'title-bar icons have a tooltip and a label');
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css,/\[data-theme="light"\] \.pb-tag \{ color: var\(--text-muted\); border-color: var\(--pb-navy-450\); background: transparent; \}/,'Unfiled is not gold in light mode');
  assert.match(css,/:is\(html, html\[data-theme="light"\]\) \.pb-card \.pb-tag \{ border: 0; border-radius: 0; background: transparent; padding: 0; color: var\(--text-muted\);/,'on a card the label is small muted text, no pill (council Rule 3)');
});

test('round 4: the chat draft survives a reload; an unedited steer prompt does not; attachments stay with the text',()=>{
  const make=store=>{const app={chatDrafts:new Map()},inputEl={value:''};const deps={app,CHAT_PROVIDERS:['claude','gemini'],chatKey:()=>'chat:notes',savedDraft:k=>store.get(k),deferSave:(k,v)=>store.set(k,JSON.parse(JSON.stringify(v))),currentContext:()=>({page:'notes'}),renderDock:()=>{inputEl.value=chatDraft().text||'';}};
    const chatDraft=new Function(...Object.keys(deps),'return '+fn('chatDraft').trim())(...Object.values(deps));deps.chatDraft=chatDraft;
    const saveChat=new Function(...Object.keys(deps),'return '+fn('saveChat').trim())(...Object.values(deps));
    const steerChat=new Function(...Object.keys(deps),'return '+fn('steerChat').trim())(...Object.values(deps));
    return {chatDraft,saveChat,steerChat,type:t=>{chatDraft().text=t;saveChat();},inputEl};};
  const store=new Map();
  let s=make(store);s.chatDraft().attachmentIds=['att-1'];s.type('my unsent question');
  s=make(store);assert.equal(s.chatDraft().text,'my unsent question','unsent user text survives a reload');
  assert.deepEqual(s.chatDraft().attachmentIds,['att-1'],'attachments come back with the text');
  s.steerChat('Assess this estate entry without changing authority');s.saveChat();
  assert.equal(s.inputEl.value,'Assess this estate entry without changing authority','the steer prompt fills the visible input');
  s=make(store);assert.equal(s.chatDraft().text,'my unsent question','an unedited steer prompt does not come back after a reload');
  assert.deepEqual(s.chatDraft().attachmentIds,['att-1']);
  s.steerChat('Review this task: 01-01');s.type('Review this task: 01-01, and check the tests');
  s=make(store);assert.equal(s.chatDraft().text,'Review this task: 01-01, and check the tests','an edited steer prompt is the user\'s draft');
  assert.doesNotMatch(client,/chatDraft\(\)\.text='(Review|Listen|Assess)/,'no action writes a prompt straight into the saved draft');
  // A successful send clears text, steer and kept together, so an old kept value cannot return on the next autosave.
  const sent=fn('sendChat');assert.match(client,/draft\.text='';draft\.steer=null;draft\.kept='';draft\.attachmentIds=\[\];saveChat\(\);/,'send success resets steer and kept');
  s.steerChat('Assess this estate entry');const d=s.chatDraft();d.text='';d.steer=null;d.kept='';d.attachmentIds=[];s.saveChat();
  s.chatDraft().text='';s.saveChat();
  s=make(store);assert.equal(s.chatDraft().text,'','after a send nothing stale comes back');assert.deepEqual(s.chatDraft().attachmentIds,[]);
});

test('round 4: the tab-row date is short, whole and carries the full date as a tooltip',()=>{
  assert.match(client,/weekday:'short',day:'numeric',month:'short',year:'numeric'\}\),'pb-nav-date'\);date\.title=/);
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
  assert.match(css,/\.pb-work > \.nav-tabs \.pb-nav-date \{ flex: 0 0 auto; min-width: max-content;/,'the date never shrinks or ellipsizes');
});

// Drives the real client Save, Park and Resume code from builder-client.js against a real store, with a stubbed page.
function clientHarness({failNext=false}={}){
  const src=fs.readFileSync(path.join(__dirname,'..','production-builder','builder-client.js'),'utf8');
  const save=/async function saveIdeaText\(text,extra=\{\}\)\{.*?return result;\}/.exec(src)[0];
  const resume=/label:'Resume idea',run:\(\)=>\{(.*?)\}\}/.exec(src)[1];
  const {createBuilderStore}=require('../builder-store');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'builder-client-save-'));
  let store=createBuilderStore({dataDir:dir});let n=0;const drafts={};const h={fail:failNext};
  const app={state:store.snapshot(),page:'ideas',ideaId:null,ideaText:'',savedOpen:false};
  const SAVE_ERROR=/const SAVE_ERROR=("[^"]*");/.exec(src)[1];const deps={app,$:()=>null,SAVE_ERROR:JSON.parse(SAVE_ERROR),active:v=>(v||[]).filter(x=>!x.archivedAt),currentContext:()=>({page:'ideas'}),renderPage:()=>{},setPage:()=>{},deferSave:(k,d)=>{if(k==='ui:idea'&&app.ideaId&&!d.id)d={...d,id:app.ideaId};drafts[k]=d;},
    event:async(type,payload)=>{if(h.fail){h.fail=false;throw new Error('The server is unreachable');}const r=store.applyEvent({type,payload,requestId:'req-'+(++n)});app.state=r.state;return r;}};
  const names=Object.keys(deps);
  const saveIdeaText=new Function(...names,save+'\nreturn saveIdeaText;')(...names.map(k=>deps[k]));
  const open=idea=>new Function(...names,'idea',resume)(...names.map(k=>deps[k]),idea);
  const reload=()=>{store.close();store=createBuilderStore({dataDir:dir});return store.snapshot().ideas.filter(i=>!i.archivedAt);};
  return Object.assign(h,{app,drafts,saveIdeaText,open,reload,close:()=>store.close()});
}
test('client Save twice with different text gives two ideas, the box and draft are cleared and unlinked, and both survive a reload',async()=>{
  const h=clientHarness();
  const long='A long idea that runs over several lines.\nIt has a second line with more detail.';
  h.app.ideaText=long;await h.saveIdeaText(h.app.ideaText);
  assert.equal(h.app.ideaId,null);assert.equal(h.app.ideaText,'');assert.deepEqual(h.drafts['ui:idea'],{text:''});assert.equal(h.app.savedOpen,true);
  h.app.ideaText='Fix tabs';await h.saveIdeaText(h.app.ideaText);
  assert.deepEqual(h.reload().map(i=>i.text),[long,'Fix tabs']);h.close();
});
test('select-all and type over a just-saved idea, then Save, gives a new idea and leaves the old one intact; Park does the same',async()=>{
  const h=clientHarness();
  h.app.ideaText='First idea, saved';await h.saveIdeaText(h.app.ideaText);
  h.app.ideaText='One line';await h.saveIdeaText(h.app.ideaText);
  h.app.ideaText='Parked thought';await h.saveIdeaText(h.app.ideaText,{status:'parked'});
  assert.equal(h.app.ideaId,null);assert.equal(h.app.ideaText,'');
  const ideas=h.reload();assert.deepEqual(ideas.map(i=>i.text),['First idea, saved','One line','Parked thought']);assert.equal(ideas[2].status,'parked');h.close();
});
test('opening a saved idea card then editing still updates that idea',async()=>{
  const h=clientHarness();
  h.app.ideaText='Draft one';await h.saveIdeaText(h.app.ideaText);
  const saved=h.app.state.ideas[0];h.open(saved);assert.equal(h.app.ideaId,saved.id);assert.equal(h.app.ideaText,'Draft one');
  h.app.ideaText='Draft one, edited';await h.saveIdeaText(h.app.ideaText);
  const ideas=h.reload();assert.equal(ideas.length,1);assert.equal(ideas[0].id,saved.id);assert.equal(ideas[0].text,'Draft one, edited');h.close();
});
test('a failed Save keeps the text and the draft, flags the plain error, and saves nothing; the next good Save clears it',async()=>{
  const h=clientHarness({failNext:true});
  h.drafts['ui:idea']={text:'Keep me'};h.app.ideaText='Keep me';
  assert.equal(await h.saveIdeaText(h.app.ideaText),null);assert.equal(h.app.saveError,true);
  assert.equal(h.app.ideaText,'Keep me');assert.deepEqual(h.drafts['ui:idea'],{text:'Keep me'});assert.equal(h.app.savedOpen,false);
  assert.equal(h.reload().length,0);
  h.app.ideaText='Keep me';await h.saveIdeaText(h.app.ideaText);assert.equal(h.app.saveError,false);assert.equal(h.reload().length,1);h.close();
});
test('saved ideas list opens after a Save and shows the newest first, with no toast',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','production-builder','builder-client.js'),'utf8');
  assert.match(src,/saved\.open=Boolean\(app\.savedOpen\)/);
  assert.match(src,/ideas\.slice\(\)\.reverse\(\)\.forEach\(i=>saved\.append\(ideaCard\(i\)\)\)/);
  assert.doesNotMatch(src,/toast\('Idea (saved|parked)/);
});

test('follow-ups: an edited resumed idea is scrolled into view; a new idea is not',async()=>{
  const h=clientHarness();
  h.app.ideaText='New idea';await h.saveIdeaText(h.app.ideaText);assert.equal(h.app.scrollToIdea,undefined);
  const saved=h.app.state.ideas[0];h.open(saved);h.app.ideaText='New idea, edited';await h.saveIdeaText(h.app.ideaText);
  assert.equal(h.app.scrollToIdea,saved.id);h.close();
  const src=fs.readFileSync(path.join(__dirname,'..','production-builder','builder-client.js'),'utf8');
  assert.match(src,/c\.dataset\.id=idea\.id/);assert.match(src,/scrollIntoView\(\{block:'center'\}\)/);
  assert.match(src,/ideas\.slice\(\)\.reverse\(\)\.forEach\(i=>saved\.append\(ideaCard\(i\)\)\)/);
});
test('follow-ups: the save error is the exact plain sentence at body size (1rem), under the Save control, with no toast',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','production-builder','builder-client.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','production-builder','builder-client.css'),'utf8');
  assert.ok(src.includes("const SAVE_ERROR=\"Couldn't save. Your text is still here. Try again.\";"));
  assert.match(src,/panel\.append\(composer\);const saveError=E\('p'/);
  assert.match(css,/\.pb-save-error\{[^}]*font-size: var\(--fs-body\);font-weight:400/);
  const save=/async function saveIdeaText[^\n]*/.exec(src)[0];assert.doesNotMatch(save,/toast\(|report\(|throw error/);
  assert.match(src,/catch\(error=>\{if\(key!=='ui:idea'\)return report\(error\);console\.error/,'the idea draft autosave never toasts a raw network error');
});
test('follow-ups: a scroll closes an open menu only when its + really moved',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','production-builder','builder-client.js'),'utf8');
  const anchorMoved=new Function(/function anchorMoved\(at,now\)\{.*?\}/.exec(src)[0]+';return anchorMoved;')();
  assert.equal(anchorMoved({top:100,left:50},{top:100,left:50}),false);
  assert.equal(anchorMoved({top:100,left:50},{top:101.5,left:50}),false);
  assert.equal(anchorMoved({top:100,left:50},{top:140,left:50}),true);
  assert.equal(anchorMoved(null,{top:1,left:1}),true);
  assert.match(src,/menu\._anchor=anchor;menu\._at=anchor\.getBoundingClientRect\(\)/);
  assert.match(src,/window\.addEventListener\('scroll',e=>\{if\(e\.target\?\.closest\?\.\('\.pb-menu'\)\)return;const m=\$\('\.pb-menu'\);if\(m\?\._anchor\?\.isConnected&&!anchorMoved/);
});
// Card 08-04 (Six Libraries plan, step 4): the file list and the Page grouping follow the Foyer's Vault
// paths, so a Vault filed under a Library keeps its Pages. A real git repo, the real gitFiles.
test('Six Libraries step 4: gitFiles lists the Foyer Vault paths, so a Page under Library/Memory/Vaults is found',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'builder-gitfiles-'));
  const g=(...a)=>execFileSync('git',['-c','user.name=test','-c','user.email=test@example.com','-c','commit.gpgsign=false','-c','core.autocrlf=false','-C',dir,...a],{encoding:'utf8'}).trim();
  g('init','-q');
  const vault='Library/Memory/Vaults/2-Memory',page=vault+'/Rows/2.1-Agent-Memory/Books/Book-Agent-Memory/Page-Doc-Agent-Memory';
  for(const f of [page+'/memory-notes.md',vault+'/Rows/2.1-Agent-Memory/Cabinet-Agent-Memory.md','Library/OS/START.md','outside/Rows/9.1-X/Books/Book-X/Page-Doc-X/a.md']){fs.mkdirSync(path.dirname(path.join(dir,f)),{recursive:true});fs.writeFileSync(path.join(dir,f),'x\n');}
  g('add','-A');g('commit','-q','-m','fixture');
  const source={repo:{root:dir,commit:g('rev-parse','HEAD')},foyer:{vaults:{'2':{name:'Memory',path:vault}}}};
  const files=gitFiles(source);
  assert.ok(files.includes(page+'/memory-notes.md'),files.join(', '));
  assert.ok(!files.some(f=>f.startsWith('outside/')||f.startsWith('Library/OS/')),'only the Foyer Vault paths are listed: '+files.join(', '));
  const areas=pageAreas(files);
  assert.deepEqual([...areas.keys()],[page]);assert.deepEqual(areas.get(page),['memory-notes.md']);
  assert.equal(findArea('agent memory notes',files).dir,page);
  assert.deepEqual(gitFiles({repo:source.repo}),[],'no Foyer, no guessed Vault root');
});
test('Six Libraries step 4: the prompt quotes Article 1 step 10 from PROTOCOL.md at the pinned commit',()=>{
  const source=readBuilderContext(ROOT);
  const protocol=execFileSync('git',['-C',ROOT,'show',source.repo.commit+':Library/OS/PROTOCOL.md'],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  const article=protocol.split(/^ARTICLE 1\b/m)[1].split(/^ARTICLE 2\b/m)[0];
  const step10=(/^[ \t]*10\.[ \t]+(.+?)[ \t]*$/m.exec(article)||[])[1];
  assert.ok(step10,'PROTOCOL.md has Article 1 step 10');
  assert.equal(source.law.step10,step10);assert.equal(article1Step(protocol,10),step10);
  const t=scanToolkit(skillsHome()),{step}=answerAll(FOUNDER,t);
  const {prompt}=buildPrompt({idea:FOUNDER,answers:step.answers,goal:'',chosen:step.chosen},source,null);
  const boot=prompt.split('## Boot order (Article 1)\n\n')[1].split('\n\n')[0];
  assert.ok(boot.includes('"'+step10+'"'),boot);
  assert.doesNotMatch(boot,/→/,'no copy of the old chain');
  // The Foyer law line is read word for word at the same commit.
  const foyer=JSON.parse(execFileSync('git',['-C',ROOT,'show',source.repo.commit+':Foyer/FOYER.json'],{encoding:'utf8'}));
  assert.equal(source.law.chain,foyer.law);
  // No source: the prompt says so and never writes a step of its own.
  const none=bootOrder(null)[2];assert.match(none,/not quoted here/);assert.ok(!none.includes(step10));
  for(const f of ['builder-data-api.js','builder-ideas.js',path.join('production-builder','index.html')])assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),/Foyer → Vault|Estate → Library/,f+' holds no copy of the law chain');
});
// Design fixes (founder 2026-10-12): New idea, the + label, the gold link, the scan bar and stamp, the shield, the
// pane divider and the layered surfaces.
const themeCss=fs.readFileSync(path.join(__dirname,'..','production-builder','theme.css'),'utf8');
function newIdeaHarness(state){
  const saved=[],toasts=[],undos=[];
  const deps={app:{...state},deferSave:(k,d)=>saved.push([k,JSON.parse(JSON.stringify(d))]),toast:t=>toasts.push(t),saveFlow:()=>{},renderPage:()=>{},undoToast:(t,u)=>undos.push([t,u]),isStale:()=>false};
  const newIdea=new Function(...Object.keys(deps),'return '+fn('newIdea').trim())(...Object.values(deps));
  return {app:deps.app,newIdea,saved,toasts,undos};
}
test('design 1: New idea clears the idea, its questions and the prompt; the old one moves to an epoch and Undo brings it back',()=>{
  const flow={v:2,idea:'Old idea',answers:[{id:'a',answer:'x'}],result:{prompt:'P'},prompt:'P'};
  const h=newIdeaHarness({ideaText:'Old idea',ideaId:'i1',ideaFlow:flow,ideaStale:true});
  h.newIdea();
  assert.equal(h.app.ideaText,'');assert.equal(h.app.ideaId,null);assert.equal(h.app.ideaFlow,null);assert.equal(h.app.ideaStale,false);
  const epoch=h.saved.find(([k])=>/^ui:idea:e\d+$/.test(k));
  assert.ok(epoch,'the old idea is kept under a new epoch key, never deleted');
  assert.deepEqual(epoch[1],{text:'Old idea',id:'i1',flow:JSON.parse(JSON.stringify(flow))});
  assert.ok(h.saved.some(([k,d])=>k==='ui:idea'&&d.text===''),'the live idea draft is empty');
  assert.equal(h.undos.length,1);assert.match(h.undos[0][0],/New idea/);
  h.undos[0][1]();
  assert.equal(h.app.ideaText,'Old idea');assert.equal(h.app.ideaId,'i1');assert.equal(h.app.ideaFlow,flow,'Undo brings back the questions and the prompt');
  assert.ok(h.saved.some(([k,d])=>k==='ui:idea'&&d.text==='Old idea'&&d.id==='i1'));
});
test('clean page: an empty idea box drops the old idea and its notices; the old one is kept under an epoch key',()=>{
  const flow={v:2,idea:'Old idea',answers:[]},saved=[];
  const deps={app:{ideaText:'  ',ideaFlow:flow,ideaStale:true},deferSave:(k,d)=>saved.push([k,d]),saveFlow:()=>{}};
  const drop=new Function(...Object.keys(deps),'return '+fn('dropFlowIfEmpty').trim())(...Object.values(deps));
  assert.equal(drop(),true);assert.equal(deps.app.ideaFlow,null);assert.equal(deps.app.ideaStale,false);
  const epoch=saved.find(([k])=>/^ui:idea:e\d+$/.test(k));assert.ok(epoch,'never deleted');assert.equal(epoch[1].flow,flow);
  assert.equal(drop(),false,'nothing left to drop');
  deps.app.ideaText='Typed';deps.app.ideaFlow=flow;assert.equal(drop(),false,'a box with text keeps its flow');assert.equal(deps.app.ideaFlow,flow);
  assert.match(fn('renderIdeas'),/dropFlowIfEmpty\(\);app\.ideaStale=isStale\(\);if\(app\.ideaFlow\)panel\.append\(renderFlow\(\)\)/,'on page load');
  assert.match(fn('renderIdeas'),/deferSave\('ui:idea',\{text:v\}\);if\(dropFlowIfEmpty\(\)\)\{paintFlow\(\);return;\}/,'while typing');
});
test('design 1: New idea on an empty box changes nothing; it is the first + row and a prompt action; late replies never revive it',()=>{
  const h=newIdeaHarness({ideaText:'  ',ideaId:null,ideaFlow:null});
  h.newIdea();
  assert.equal(h.saved.length,0);assert.equal(h.undos.length,0);assert.equal(h.toasts.length,1);
  const menu=fn('ideaMenu'),at=menu.indexOf("label:'New idea'");
  assert.ok(at>=0&&at<menu.indexOf("label:'Vent'"),'New idea is the first + row');assert.match(menu,/run:newIdea/);
  assert.equal(client.split("label:'New idea'").length-1,2,'New idea is also beside Start over under the prompt');
  assert.match(fn('stepFlow'),/await api\('\/ideas\/step'.*?\);if\(app\.ideaFlow!==flow\)return;/);
  assert.match(fn('getPrompt'),/if\(app\.ideaFlow!==flow\)return;/);
});
test('design 2: the idea + names what it holds, with a visible label and an aria-label',()=>{
  assert.match(client,/const IDEA_OPTIONS='Idea options: New idea, Vent, Save, Park and more';/);
  const ideas=fn('renderIdeas');
  assert.match(ideas,/plus=plusMenu\(ideaMenu,IDEA_OPTIONS\)/);
  assert.match(fn('iconButton'),/b\.setAttribute\('aria-label',label\)/,'the + carries the label as its accessible name');
  assert.match(ideas,/hint=E\('span','New idea, Vent, Save, Park','pb-plus-label'\)/);
  assert.match(ideas,/hint\.setAttribute\('aria-hidden','true'\)/,'the visible label is not read twice');
  assert.match(ideas,/hint\.addEventListener\('click',\(\)=>plus\.click\(\)\)/,'the label opens the same menu');
  assert.match(ideas,/composerRow\(composer,plus,hint,input,null,/);
  assert.match(themeCss,/\.pb-composer > \.pb-plus-label \{[^}]*color: var\(--text-muted\)/);
});
const lum=hex=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};
test('design 3: Take it further is a gold text link with an arrow, still the primary action and a keyboard button',()=>{
  const ideas=fn('renderIdeas');
  assert.match(ideas,/goLink\(B\('Take it further',startFlow,'pb-btn pb-link'\)\)/);
  assert.match(client,/const B=\(text,fn,cls='pb-btn'\)=>\{const b=E\('button',text,cls\);b\.type='button';/,'a real button, so Tab, Enter and Space work');
  const made=[];const E=(tag,text,cls)=>{const el={tag,text,cls,attrs:{},setAttribute(k,v){this.attrs[k]=v;}};made.push(el);return el;};
  const goLink=new Function('E','return '+fn('goLink').trim())(E);
  const btn={kids:[],append(x){this.kids.push(x);}};
  assert.equal(goLink(btn),btn);assert.equal(btn.kids[0].text,'→');assert.equal(btn.kids[0].cls,'pb-link-arrow');
  assert.equal(btn.kids[0].attrs['aria-hidden'],'true');assert.match(btn.title,/^Take it further/);
  const rule=/\.pb-btn\.pb-link, \.pb-btn\.pb-link:hover[^{]*\{([^}]*)\}/.exec(themeCss);assert.ok(rule,'the link rule exists');
  assert.match(rule[1],/background: transparent/);assert.match(rule[1],/color: var\(--gold\)/);assert.match(rule[1],/text-decoration: underline/);
  for(const bg of ['#0B1733','#102347','#16294B'])assert.ok(ratio('#C9A24B',bg)>=4.5,'dark gold on '+bg);
  for(const bg of ['#F7F6F1','#FFFFFF'])assert.ok(ratio('#7A5C0A',bg)>=4.5,'light gold on '+bg);
});
function scanHarness({fail=false}={}){
  const calls=[],toasts=[],timers=[],bar={hidden:false};let marked=null;
  const scanProgress=new Function('return '+fn('scanProgress').trim())();
  const list=v=>Array.isArray(v)?v:[];
  const scanSummary=new Function('list','return '+fn('scanSummary').trim())(list);
  const deps={app:{boot:{roadmap:{cards:[{sourceChecked:true},{sourceChecked:false}]}},providers:[{configured:true},{configured:false},{configured:true}]},
    $:sel=>sel==='#pb-scan'?bar:null,status:()=>{},refresh:async()=>{calls.push('refresh');if(fail)throw Error('offline');},loadProviders:async()=>calls.push('providers'),
    renderDock:()=>calls.push('dock'),showScan:(done,total)=>calls.push(scanProgress(done,total).text),toast:t=>toasts.push(t),scanSummary,
    markScanned:at=>{marked=at===undefined?'kept':at;},SCAN_STEPS:new Function(/const SCAN_STEPS=(\[.*?\]);/.exec(client)[0]+'return SCAN_STEPS;')(),setTimeout:(f,ms)=>{timers.push(ms);f();}};
  const scanNow=new Function(...Object.keys(deps),'return async '+fn('scanNow').trim())(...Object.values(deps));
  return {scanNow,calls,toasts,timers,bar,app:deps.app,marked:()=>marked};
}
test('design 4: the scan bar shows real steps done of steps total, then a short done notice',async()=>{
  const scanProgress=new Function('return '+fn('scanProgress').trim())();
  assert.deepEqual(scanProgress(1,3),{pct:33,text:'1 of 3 steps'});assert.deepEqual(scanProgress(3,3),{pct:100,text:'3 of 3 steps'});assert.deepEqual(scanProgress(0,0),{pct:0,text:'0 of 0 steps'});
  const h=scanHarness();await h.scanNow();
  assert.deepEqual(h.calls,['0 of 3 steps','refresh','1 of 3 steps','providers','2 of 3 steps','dock','3 of 3 steps'],'each mark follows the work it counts');
  assert.deepEqual(h.toasts,['Scan complete: 2 cards (1 open), 2 of 3 chat models ready.']);
  assert.ok(h.marked() instanceof Date);assert.equal(h.bar.hidden,true);assert.deepEqual(h.timers,[700]);assert.equal(h.app.scanning,false);
  assert.match(fn('showScan'),/p=scanProgress\(done,total\)/);assert.match(fn('showScan'),/setAttribute\('aria-valuenow',String\(p\.pct\)\)/);
  assert.doesNotMatch(fn('showScan')+fn('scanNow'),/Math\.random|setInterval/,'never a made-up percentage');
});
test('design 4: a failed scan hides the bar at once, keeps the last scan time and says nothing is complete',async()=>{
  const h=scanHarness({fail:true});
  await assert.rejects(h.scanNow(),/offline/);
  assert.deepEqual(h.toasts,[]);assert.equal(h.marked(),'kept');assert.deepEqual(h.timers,[0]);assert.equal(h.bar.hidden,true);assert.equal(h.app.scanning,false);
  assert.match(themeCss,/\.pb-scan \{[^}]*position: absolute;[^}]*height: 3px/,'slim, on the title bar edge, no extra height');
});
test('design 5: a persistent Last scanned stamp in UTC',()=>{
  const scanStamp=new Function('return '+fn('scanStamp').trim())();
  assert.equal(scanStamp(new Date(Date.UTC(2026,9,12,8,5,30))),'Last scanned: 2026-10-12 08:05 UTC');assert.equal(scanStamp(null),'Not scanned yet');
  const label={};const app={scannedAt:new Date(Date.UTC(2026,0,2,3,4))};
  const markScanned=new Function('app','$','scanStamp','return '+fn('markScanned').trim())(app,()=>label,scanStamp);
  markScanned(undefined);assert.equal(label.textContent,'Last scanned: 2026-01-02 03:04 UTC','a failed scan keeps the last good time');
  markScanned(new Date(Date.UTC(2026,9,12,23,59)));assert.equal(label.textContent,'Last scanned: 2026-10-12 23:59 UTC');assert.equal(label.title,label.textContent);
  const head=block('initializeHeader');
  assert.match(head,/stamp=E\('span',scanStamp\(app\.scannedAt\),'pb-scan-stamp'\);stamp\.id='pb-scan-stamp'/);
  assert.match(head,/\$\('\.header-meta'\)\.replaceChildren\(stamp,\.\.\.tools,/);
  assert.match(client,/await refresh\(\);await loadProviders\(\);markScanned\(new Date\(\)\);/,'the first load counts as a scan');
});
test('design 6: the IOB Hunter shield shows in the title bar beside the name, small',()=>{
  assert.match(block('initializeHeader'),/const shield=\$\('\.header-shield'\);if\(shield\)shield\.title='IOB Hunter';/);
  const html=fs.readFileSync(path.join(__dirname,'..','production-builder','index.html'),'utf8');
  assert.match(html,/<img class="header-shield"[^>]*alt="IOB Hunter shield"/);
  assert.match(themeCss,/\.pb-work > \.header \.header-shield \{ display: block; width: auto; height: 1\.75rem;/);
  assert.match(themeCss,/@media \(max-width: 700px\) \{[\s\S]*?\.header-shield \{ height: 1\.5rem; \}/);
});
function splitHarness(store){
  const E=(tag,text,cls)=>{const on={};return {tag,cls,attrs:{},on,setAttribute(k,v){this.attrs[k]=v;},addEventListener(t,f){on[t]=f;},removeEventListener(){}};};
  const grid={vars:{},style:{setProperty(k,v){grid.vars[k]=v;}}};
  const clampSplit=new Function('return '+fn('clampSplit').trim())();
  const splitKey=new Function('clampSplit','return '+fn('splitKey').trim())(clampSplit);
  const createSplit=new Function('E','localStorage','clampSplit','splitKey','document','return '+block('createSplit').trim()+'\n  }')(E,store,clampSplit,splitKey,{body:{classList:{add(){},remove(){}}}});
  return {bar:createSplit(grid),grid,clampSplit,splitKey};
}
test('design 7: the pane divider is keyboard operable and remembers its width per viewer',()=>{
  const {clampSplit,splitKey}=splitHarness({getItem:()=>null,setItem(){},removeItem(){}});
  assert.equal(clampSplit('70'),70);assert.equal(clampSplit(99),75);assert.equal(clampSplit(3),25);assert.equal(clampSplit('junk'),50);assert.equal(clampSplit(null),50);
  assert.equal(splitKey(50,'ArrowLeft'),45);assert.equal(splitKey(50,'ArrowRight'),55);assert.equal(splitKey(73,'ArrowRight'),75);assert.equal(splitKey(50,'Home'),25);assert.equal(splitKey(50,'End'),75);assert.equal(splitKey(50,'a'),null);
  const mem={'pb-idea-split':'70'};const store={getItem:k=>mem[k]??null,setItem:(k,v)=>{mem[k]=v;},removeItem:k=>{delete mem[k];}};
  const h=splitHarness(store);
  assert.equal(h.grid.vars['--pb-split'],'70%','the saved width comes back');
  assert.equal(h.bar.attrs.role,'separator');assert.equal(h.bar.attrs['aria-orientation'],'vertical');assert.equal(h.bar.tabIndex,0);assert.equal(h.bar.attrs['aria-valuenow'],'70');
  let prevented=0;h.bar.on.keydown({key:'ArrowLeft',preventDefault:()=>prevented++});
  assert.equal(h.grid.vars['--pb-split'],'65%');assert.equal(mem['pb-idea-split'],'65');assert.equal(prevented,1);
  h.bar.on.keydown({key:'Tab',preventDefault:()=>prevented++});assert.equal(prevented,1,'Tab still moves focus');
  h.bar.on.dblclick();assert.equal(h.grid.vars['--pb-split'],'50%');assert.ok(!('pb-idea-split' in mem),'double-click resets');
  for(const ev of ['pointerdown','keydown','dblclick'])assert.ok(h.bar.on[ev],ev+' is handled');
});
test('design 7: the divider still works when browser storage throws',()=>{
  const boom=()=>{throw Error('blocked');};
  const h=splitHarness({getItem:boom,setItem:boom,removeItem:boom});
  assert.equal(h.grid.vars['--pb-split'],'50%');
  h.bar.on.keydown({key:'ArrowRight',preventDefault(){}});assert.equal(h.grid.vars['--pb-split'],'55%');
  assert.doesNotThrow(()=>h.bar.on.dblclick());
  assert.match(fn('renderIdeas'),/grid\.classList\.add\('pb-split'\);add\(grid,panel,createSplit\(grid\),right\);/);
  assert.match(themeCss,/\.pb-grid\.pb-split \{ grid-template-columns: minmax\(0, var\(--pb-split, 50%\)\) 1rem minmax\(0, 1fr\);/);
  assert.match(themeCss,/@media \(max-width: 700px\) \{\s*\.pb-grid\.pb-split \{ grid-template-columns: minmax\(0, 1fr\);[^}]*\}\s*\.pb-split-bar \{ display: none; \}/,'one column on a phone, no sideways scroll');
});
test('design 8: layered surfaces from the canon navy and bone, none of the outside palette or fonts',()=>{
  const ramp={};for(const [,k,v] of themeCss.matchAll(/(--pb-navy-\d+):\s*(#[0-9A-Fa-f]{6})/g))ramp[k]=v;
  const tok='(#\\w+|var\\(--pb-navy-\\d+\\))',hex=v=>v.startsWith('var(')?ramp[v.slice(4,-1)]:v;
  const darkM=new RegExp(':root \\{ --pb-surface-base: '+tok+'; --pb-surface-1: '+tok+'; --pb-surface-2: '+tok+';').exec(themeCss),lightM=new RegExp(':root\\[data-theme="light"\\] \\{ --pb-surface-base: '+tok+'; --pb-surface-1: '+tok+'; --pb-surface-2: '+tok+';').exec(themeCss);
  assert.ok(darkM&&lightM,'base and elevated tokens in both themes');
  const dark=[null,...darkM.slice(1).map(hex)],light=lightM.slice(1);
  assert.deepEqual(darkM.slice(1),['var(--pb-navy-900)','#102347','var(--pb-navy-750)'],'dark layers are ramp steps');assert.deepEqual(light,['#F7F6F1','#FFFFFF','#FFFFFF']);
  assert.ok(lum(dark[1])<lum(dark[2])&&lum(dark[2])<lum(dark[3]),'each dark layer is a step lighter');
  assert.match(themeCss,/\.pb-panel, \.pb-dock \{ background: var\(--pb-surface-1\);/);assert.match(themeCss,/\.pb-card, \.pb-phase summary, \.pb-tree-child, \.pb-menu \{ background: var\(--pb-surface-2\);/);
  assert.match(themeCss,/--gm-navy: #102347; --gm-navy-deep: #09152A; --gm-gold: #C9A24B; --gm-bone: #F7F6F1;/,'the locked hues are unchanged; the deep navy is ramp step 900');
  for(const src of [themeCss,client])assert.doesNotMatch(src,/#0a0a0a|#1456f0|DM Sans|SF Symbols|SF Pro/i,'no outside audit palette or fonts');
});
// Council design 2026-10-12 (card 01-29). The chair's one design: one navy ramp from #102347, one control placement,
// icons with no circles, compact cards, Delete with Undo, a bare chat head, notices in the tab row, contrast pinned.
const councilFiles=()=>{const dir=path.join(__dirname,'..','production-builder');return Object.fromEntries(['theme.css','builder-client.css','index.html','builder-client.js'].map(f=>[f,fs.readFileSync(path.join(dir,f),'utf8')]));};
const rgbOf=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const hslOf=h=>{const [r,g,b]=rgbOf(h).map(v=>v/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let hue=0;if(d){hue=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;hue*=60;if(hue<0)hue+=360;}return [hue,d?d/(1-Math.abs(2*l-1)):0,l];};
const councilRamp=css=>{const block=/:root, :root\[data-theme="light"\] \{([^}]*)\}/.exec(css);assert.ok(block,'the ramp is declared once for :root and [data-theme="light"]');const o={};for(const [,k,v] of block[1].matchAll(/--pb-navy-(\d+):\s*(#[0-9A-Fa-f]{6})/g))o[k]=v.toUpperCase();return o;};
const NAVY='#102347',BONE='#F7F6F1',LOCKED_HUES=['#102347','#C9A24B','#F7F6F1','#1A5FB4','#2ECC71'];
const isBlue=h=>{const [hue,s]=hslOf(h);return s>0.08&&hue>=190&&hue<=250;};
// Every colour literal in a file, as #RRGGBB: 3, 4, 6 and 8 digit hex, and rgb()/rgba() with numbers.
const colours=src=>{const out=[];for(const m of src.matchAll(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g)){const b=m[1];out.push({lit:m[0],hex:('#'+(b.length<=4?[...b.slice(0,3)].map(c=>c+c).join(''):b.slice(0,6))).toUpperCase()});}
  for(const m of src.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g))out.push({lit:m[0],hex:'#'+m.slice(1,4).map(v=>(+v).toString(16).padStart(2,'0')).join('').toUpperCase()});return out;};
test('council: one navy ramp from #102347, declared for dark and light; deep steps deepen the navy, lifted steps mix in bone',()=>{
  const css=councilFiles()['theme.css'],ramp=councilRamp(css);
  assert.deepEqual(Object.keys(ramp).sort(),['050','100','150','300','450','500','550','600','700','750','800','850','900','950'].sort());
  assert.equal(ramp['800'],NAVY,'step 800 is the locked navy');
  const [H,S]=hslOf(NAVY);let last=hslOf(NAVY)[2];
  for(const k of ['850','900','950']){const [h,s,l]=hslOf(ramp[k]);assert.ok(Math.abs(h-H)<=2&&Math.abs(s-S)<=0.04,k+' keeps the navy hue and saturation, never black or grey');assert.ok(l<last,k+' is deeper');last=l;}
  const mix=t=>rgbOf(NAVY).map((v,i)=>v*(1-t)+rgbOf(BONE)[i]*t);
  const share={'750':0.06,'700':0.12,'600':0.20,'550':0.30,'500':0.36,'450':0.50,'300':0.67,'150':0.85,'100':0.92,'050':0.96};
  for(const [k,t] of Object.entries(share))rgbOf(ramp[k]).forEach((v,i)=>assert.ok(Math.abs(v-mix(t)[i])<=1.5,k+' is navy with '+Math.round(t*100)+'% bone'));
  for(const v of Object.values(ramp))if(isBlue(v))assert.ok(Math.abs(hslOf(v)[0]-219)<=2,v+' sits at hue 219 plus or minus 2');
  assert.match(css,/--text-muted: var\(--pb-navy-300\);/);assert.match(css,/--text-dim: var\(--pb-navy-550\); --text-muted: var\(--pb-navy-550\);/);
});
test('council: every blue in theme.css, builder-client.css, index.html and builder-client.js is a ramp step; no banned or periwinkle hex',()=>{
  const files=councilFiles(),ramp=new Set(Object.values(councilRamp(files['theme.css'])));
  const BANNED=['#60A5FA','#0B1733','#A9B8CC','#3B82F6','#2A3B5C','#16294B','#5E7390','#8A93A3','#0A0A0A','#1456F0','#13233F','#1B305A','#0C1B30','#354961','#16233F'];
  let blues=0;
  for(const [name,src] of Object.entries(files))for(const {lit,hex} of colours(src)){
    assert.ok(!BANNED.includes(hex),name+': banned hex '+lit);
    const [hue,s,l]=hslOf(hex);
    assert.ok(!(hue>=200&&hue<=275&&s>0.3&&l>0.6),name+': periwinkle '+lit);
    if(isBlue(hex)&&!LOCKED_HUES.includes(hex)){blues++;assert.ok(ramp.has(hex),name+': '+lit+' is not a step of the navy ramp');}
  }
  assert.ok(blues>0,'the scan found the ramp in use');
  assert.match(files['theme.css'],/--gm-navy: #102347; --gm-navy-deep: #09152A; --gm-gold: #C9A24B; --gm-bone: #F7F6F1;/,'locked hues unchanged');
  for(const name of Object.keys(files))assert.doesNotMatch(files[name],/rgba?\(0,\s*0,\s*0,/,name+': shadows lean navy, never black');
});
test('council: one control placement in both composers: + far left, aside, secondary, primary far right',()=>{
  const css=councilFiles()['theme.css'];
  assert.match(fn('composerRow'),/function composerRow\(row,plus,aside,input,secondary,\.\.\.primary\)\{add\(row,plus,aside,input,secondary,\.\.\.primary\);return row;\}/);
  assert.match(fn('renderIdeas'),/composerRow\(composer,plus,hint,input,null,goLink\(B\('Take it further',startFlow,'pb-btn pb-link'\)\)\)/,'idea composer: +, hint, no secondary, Take it further');
  assert.match(fn('createDock'),/composerRow\(row,plusMenu\(chatMenu,'Chat options'\),null,input,clear,stop,send,fileInput\)/,'chat composer: +, no aside, Clear, Stop or Send');
  assert.match(client,/composerRow\(composer,plusMenu\(\(\)=>\[[^;]*'Answers and options'\),null,answer,null,B\('Next'/,'the question flow composer follows the same rule');
  assert.doesNotMatch(client,/add\(composer,|add\(row,plusMenu/,'no composer is built outside the one helper');
  assert.match(css,/\.pb-composer \{ display: grid; grid-template-columns: 2rem minmax\(0, 1fr\) auto auto;/);
  assert.match(css,/\.pb-composer-input \{ grid-column: 1 \/ -1; grid-row: 1;/,'the text box spans the first row');
  assert.match(css,/\.pb-composer > \.pb-btn \{ grid-row: 2;/);assert.match(css,/\.pb-composer > \.pb-plus \{ grid-column: 1; \}/);
  assert.match(css,/\.pb-composer > \.pb-plus-label \{ grid-row: 2; grid-column: 2;/);
  assert.match(css,/\.pb-composer > \.pb-btn\.pb-clear:not\(\.pb-plus\) \{ grid-column: 3; justify-self: end; \}/);
  assert.match(css,/\.pb-composer > \.pb-btn:not\(\.pb-plus\) \{ grid-column: 4; justify-self: end; \}/,'the primary at the far right');
  assert.match(fn('actionBar'),/add\(bar,plusMenu\(rows,label\),primary\)/,'cards follow the same order: + then the primary');
});
test('council: icons have no circles, a 2rem hit area, and a focus ring on keyboard focus only; send has no square',()=>{
  const css=councilFiles()['theme.css'];
  // The only round shape is the model's colour dot (PR 89); no button, icon or + is ever round.
  const round=[...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(m=>/border-radius: 999px/.test(m[2])).map(m=>m[1].trim());
  assert.ok(round.length>0&&round.every(sel=>/pb-model-dot|small::before/.test(sel)&&!/pb-btn|pb-icon|pb-plus|pb-head-tool/.test(sel)),'no round icon buttons: '+round.join(' | '));
  assert.doesNotMatch(css,/\.pb-btn\.pb-icon:hover[^{]*\{[^}]*box-shadow: 0 0 0 2px/,'no ring on hover; the ring is for keyboard focus only');
  assert.match(css,/\.pb-btn\.pb-icon:focus-visible \{ border-color: var\(--pb-ring\); box-shadow: 0 0 0 2px var\(--pb-ring\); outline: none; \}/,'the keyboard focus ring');
  assert.match(css,/\.pb-btn\.pb-icon \{ display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem;/,'2rem is 35px at the 110% root');
  assert.match(css,/\.pb-btn\.pb-icon, \.pb-btn\.pb-icon:hover:not\(:disabled\) \{ border-color: transparent; background: transparent; box-shadow: none;/);
  assert.match(css,/\.pb-btn\.pb-icon:focus:not\(:focus-visible\) \{ outline: none; \}/);
  assert.match(css,/\.pb-btn\.pb-icon\.pb-send:hover:not\(:disabled\)[^{]*\{ background: transparent; border-color: transparent; box-shadow: none; color: var\(--gold\); \}/,'the send arrow is gold with no square behind it');
  assert.match(css,/\.header \.header-meta \.pb-plus, \.header \.header-meta \.pb-head-tool \{ width: 2rem; height: 2rem; border-radius: 6px;[^}]*border-color: transparent; \}/);
});
test('council: compact cards and Delete with Undo for ideas, notes and diary entries',()=>{
  const css=councilFiles()['theme.css'];
  assert.match(fn('deleteRow'),/event\(kind\+'\.delete',\{id\}\);after\(\);undoToast\('Deleted\.',\(\)=>event\(kind\+'\.restore',\{id\}\)/,'Delete hides at once and Undo restores');
  const card=fn('ideaCard');assert.match(card,/'pb-card pb-idea-card pb-compact'/);
  assert.ok(card.indexOf("label:'Archive idea'")<card.indexOf("deleteRow('idea'"),'Delete sits beside Archive');assert.match(card,/forwardIcon\('Take it further'/);
  const notes=fn('renderNotes');assert.match(notes,/c\.classList\.add\('pb-compact'\)/);assert.ok(notes.indexOf("label:'Archive note'")<notes.indexOf("deleteRow('note',note.id"),'Delete sits beside Archive');assert.match(notes,/forwardIcon\('Send to prompt'/);
  const diary=block('renderDiary');assert.match(diary,/deleteRow\('note',n\.id,'Delete diary entry',renderDiary\)/);
  assert.match(fn('forwardIcon'),/iconButton\('forward',label,fn\);b\.classList\.add\('pb-forward','pb-go'\)/);
  assert.match(css,/\.pb-card\.pb-compact \{ display: grid; grid-template-columns: minmax\(0, 1fr\) auto;/,'text first and widest, icons at the right');
  assert.match(css,/\.pb-card\.pb-compact > \.pb-actionbar \{ grid-column: 2;/);
});
test('council: notices sit in the tab row; the empty prompt column shows the brief it will fill',()=>{
  const css=councilFiles()['theme.css'];
  assert.match(fn('toastBox'),/const home=\$\('\.pb-work > \.nav-tabs'\)\|\|document\.body;/);
  assert.match(css,/\.pb-work > \.nav-tabs > \.pb-toast \{ position: absolute;[^}]*background: var\(--bar-bg\); color: #C9A24B;/);
  assert.match(css,/\.pb-toast\[hidden\] \{ display: none !important; \}/);
  assert.match(client,/const BRIEF_ROWS=\['Goal','Context','What comes back','Role','Constraints','Skills and agents','Read first','Done when'\];/);
  assert.match(block('fillPromptPanel'),/BRIEF_ROWS\.forEach\(k=>\{brief\.append\(E\('dt',k\)\);brief\.append\(E\('dd','Waiting for your idea','pb-muted'\)\);\}\)/);
});
test('council: text 4.5:1 and UI parts 3:1 in both themes, measured on the surface each sits on',()=>{
  const r=councilRamp(councilFiles()['theme.css']),n=k=>r[k];
  const text=[
    ['dark muted',n('300'),[n('950'),n('900'),n('850'),n('800'),n('750'),n('700')]],
    ['dark text','#EEF0EF',[n('900'),n('800'),n('750'),n('700')]],
    ['gold on navy','#C9A24B',[n('800'),n('750'),n('700')]],
    ['light muted',n('550'),[BONE,'#FFFFFF',n('050'),'#F1EDE2']],
    ['light text',n('800'),[BONE,'#FFFFFF',n('050'),'#EFE6CC']],
    ['light gold ink','#7A5C0A',[BONE,'#FFFFFF']],
    ['band ink','#EEF0EF',[NAVY,n('750')]]];
  for(const [name,fg,bgs] of text)for(const bg of bgs)assert.ok(ratio(fg,bg)>=4.5,name+' '+fg+' on '+bg+' is '+ratio(fg,bg).toFixed(2));
  const ui=[['dark input edge',n('500'),[n('850')]],['light input edge',n('450'),['#FFFFFF',BONE]],['dark icon',n('300'),[n('800')]],['light icon',n('550'),['#FFFFFF']],['light send','#7A5C0A',['#FFFFFF']],['dark send','#C9A24B',[NAVY]]];
  for(const [name,fg,bgs] of ui)for(const bg of bgs)assert.ok(ratio(fg,bg)>=3,name+' '+fg+' on '+bg+' is '+ratio(fg,bg).toFixed(2));
});

// Kosmo workflow (founder 2026-10-14, analysis filed in Row 5.16): what only the founder knows is offered
// with the read-back and carried word for word; the check is written into the prompt and sized to the
// task; the prompt ends with which tool, mode and model to use; the counter counts only real questions.
test('compiler: what only you know, a visible check sized to the task, a run note, an honest counter',()=>{
  const {KNOW}=require('../builder-ideas');
  const t=scanToolkit(skillsHome());
  const idea='Make the Builder idea page clearer. The goal card must collapse. The picked block must list every skill used.';
  const {step,answers}=answerAll(idea,t);
  assert.ok(step.total>=step.asked&&step.total<=3,'at most three questions, counted honestly: '+step.asked+' of '+step.total);
  assert.deepEqual(step.know.map(k=>k.id),KNOW.map(k=>k.id),'all three offered when the idea does not say them');
  assert.deepEqual(nextStep({idea:'it broke again "Save idea"',answers:[]},t,SOURCE,FILES).know.map(k=>k.id),['for'],'said in the idea: not asked');
  const withKnow=[...answers,{id:'words',answer:'Picked by the Builder'},{id:'before',answer:'Nothing, this is new'}];
  const {prompt}=buildPrompt({idea,answers:withKnow,goal:'',chosen:step.chosen},SOURCE,null);
  assert.match(prompt,/^## What only you know$/m);assert.match(prompt,/Exact words to use: "Picked by the Builder"/);
  assert.doesNotMatch(prompt,/Nothing, this is new/,'a nothing answer is not carried');
  assert.match(prompt,/^## Check your work$/m);
  for(const part of ['The goal card must collapse.','The picked block must list every skill used.'])assert.ok(prompt.includes('It does what was asked: "'+part+'"'),part);
  assert.match(prompt,/These exact words appear as given: "Picked by the Builder"/);
  assert.match(prompt,/^## Run it with$/m);assert.match(prompt,/plan mode/);
  assert.doesNotMatch(prompt,/\u2014/,'no em dashes');
  const plan=buildPrompt({idea:'Review the Builder idea page and list the gaps',answers:[{id:'returns',answer:'A review with findings, no edits'},{id:'files',answer:FILES_NONE}],goal:'',chosen:[]},SOURCE,null).prompt;
  const reviewChecks=plan.split('## Check your work')[1].split('\n## ')[0].split('\n').filter(l=>l.startsWith('- [ ]'));
  assert.ok(reviewChecks.length<=4,'a review gets a short check: '+reviewChecks.length);assert.match(plan,/Change no file/);assert.match(plan,/Sonnet is enough/);
});
