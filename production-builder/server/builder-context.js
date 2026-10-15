'use strict';
const path = require('node:path');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
const {BuilderError} = require('./builder-store');
const EXPECTED_REPO = 'Glumira-X-Technologies-cc/Glumira-7.2';
// The Article 1 reading list of Library/OS/START.md; indices 2 and 3 are read as JSON below.
const OS_PATHS = ['Library/OS/START.md','Library/OS/PROTOCOL.md','Library/OS/REPO-REGISTRY.json','Library/OS/JEV-MAP.json','Library/OS/GUIDE.md','Library/OS/MEMORY-GUARD.md'];
// The ROADMAP version line before and after the naming sweep (Six Libraries plan, step 13).
const COMPATIBLE_ROADMAP_VERSIONS = ['72-roadmap-1','roadmap-1'];
// The Foyer route to the Vault that files the one queue. It is a Vault-level record in JEV-MAP.json.
const QUEUE_ROUTE = 'Production Builder';
const fail = code => { throw new BuilderError(code,code,503); };
function git(root,args) { try {return execFileSync('git',['-c','safe.directory='+root.replace(/\\/g,'/'),'-c','core.longpaths=true','-C',root,...args],{encoding:'utf8',windowsHide:true,timeout:10000,maxBuffer:12*1024*1024,stdio:['ignore','pipe','pipe']});} catch {fail('SOURCE_GIT_READ_FAILED');} }
function originIdentity(url) {
  const s = String(url).trim(), ssh = /^(?:ssh:\/\/)?git@github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(s);
  if (ssh) return ssh[1]+'/'+ssh[2];
  try { const u = new URL(s); if(u.protocol!=='https:'||u.hostname.toLowerCase()!=='github.com'||u.username||u.password||u.search||u.hash||u.port) return ''; const m=/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(u.pathname); return m?m[1]+'/'+m[2]:''; } catch{return '';}
}
const safeSegments=p=>!p.includes('\\') && !p.includes(':') && !p.split('/').some(s=>!s||s==='.'||s==='..');
function validSourcePath(p) {return typeof p==='string' && /^(Library|Foyer|Vaults)\//.test(p) && safeSegments(p);}
// apps/ files are readable by /ideas/ref only, with the same guards; callers must also check the
// path is one the server lists for the pinned commit. Compile readPaths stay on validSourcePath.
function validAppsPath(p) {return typeof p==='string' && /^apps\//.test(p) && safeSegments(p);}
// One step of Article 1 of PROTOCOL.md, word for word. The Builder quotes the law, it never keeps a copy.
function article1Step(protocolText,n) {
  const text=String(protocolText).replace(/\r\n/g,'\n'),start=text.search(/^ARTICLE 1\b/m);if(start<0)return null;
  const rest=text.slice(start),end=rest.slice(1).search(/^ARTICLE \d/m),body=end<0?rest:rest.slice(0,end+1);
  const m=new RegExp('^[ \\t]*'+n+'\\.[ \\t]+(.+?)[ \\t]*$','m').exec(body);return m?m[1]:null;
}
// The Page in a Vault of the Foyer whose path is the one queue named by REPO-REGISTRY.json.
function queuePage(vault,builderPath) {
  const hits=[];
  for(const row of Object.values(vault?.rows||{}))for(const book of Object.values(row?.cabinet?.books||{}))for(const page of Object.values(book?.pages||{}))if(page?.path===builderPath)hits.push(page);
  return hits.length===1?hits[0]:null;
}
function parseRoadmap(text) {
  const phases=[], ids=new Set(), slots=new Set(), warnings=[]; let phase=null,previous=null;
  String(text).replace(/^\uFEFF/,'').split(/\r?\n/).forEach((line,index)=>{
    const heading=/^### Phase (\d+): (.+)$/.exec(line);
    if(heading){phase={n:+heading[1],name:heading[2],sourceLine:index+1,cards:[]};phases.push(phase);previous=null;return;}
    if(/^## /.test(line)){phase=null;previous=null;return;} if(!phase)return;
    const row=/^- \[( |x|X)\] (\d{2}-\d{2})(?: to (\d{2}-\d{2}))?: (.+)$/.exec(line);
    if(!row){if(previous&&/^\s+\S/.test(line))previous.fullText+='\n'+line.trim();else if(line.trim())previous=null;return;}
    const start=row[2],end=row[3],body=row[4],id=end?start+' to '+end:start,p=+start.split('-')[0],a=+start.split('-')[1],z=end?+end.split('-')[1]:a;
    if(ids.has(id))fail('ROADMAP_DUPLICATE_ROW_ID');ids.add(id);
    if(p!==phase.n||(end&&+end.split('-')[0]!==p)||z<a)fail('ROADMAP_INVALID_RANGE');
    for(let n=a;n<=z;n++){const key=p+'-'+n;if(slots.has(key))fail('ROADMAP_OVERLAPPING_IDS');slots.add(key);}
    const d=/D☑/.test(body),pr=/P☑/.test(body),g=/G☑/.test(body),checked=row[1]!==' ';
    const card={id,title:body.split(' · ')[0],fullText:body,sourceLine:index+1,sourceLineText:line,d,p:pr,g,sourceChecked:checked,checkboxDpgConflict:checked!==(d&&pr&&g),strictDone:false,receiptKnown:false,verificationStatus:'receipt not inspected',reportedStatus:checked?'checked':'open',displayStatus:checked!==(d&&pr&&g)?'Source contradiction':checked?'Receipt unknown':'Open',lane:(body.match(/\bLANE:([^\s·]+)/)||[])[1]||null,priority:(body.match(/\bPRIORITY:([^\s·]+)/)||[])[1]||null,gate:(body.match(/\bGATE:(FOUNDER(?:\([^)]*\))?)/)||[])[1]||null,sourceOrder:ids.size};
    const executionMarker=body.match(/\bTARGET_REPO:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?=\s|$)/);
    card.executionRepo=executionMarker?executionMarker[1]:null;
    card.writeScope=(body.match(/\bWRITE_SCOPE:([^\s;]+)/)||[])[1]||null;
    if(end)card.range={start,end,count:z-a+1,childDetailsKnown:false};phase.cards.push(card);previous=card;
  });
  if(!phases.length||!ids.size)fail('ROADMAP_NO_CARDS');
  const cards=phases.flatMap(p=>p.cards),conflicts=cards.filter(c=>c.checkboxDpgConflict).map(c=>c.id);
  // A warning shows only when it has a fix (founder 2026-10-15): the contradiction names its rows and its fix.
  if(conflicts.length)warnings.push({code:'CHECKBOX_DPG_CONTRADICTIONS',ids:conflicts,note:'The row tick does not match its D, P and G marks. Fix: tick D, P and G when the work is merged, or untick the row.'});
  // Standing facts about every ROADMAP, not problems with this one: notes, shown as one grey line, never warnings.
  const notes=[{code:'RECEIPTS_NOT_INSPECTED',note:'A source tick is not independent acceptance.'},{code:'RANGE_DETAILS_NOT_EXPANDED',note:'Range positions are not independently specified child tasks.'}];
  return {phases,cards,notes,counts:{rows:cards.length,singleRows:cards.filter(c=>!c.range).length,rangeRows:cards.filter(c=>c.range).length,declaredIdSlots:slots.size,checkedRows:cards.filter(c=>c.sourceChecked).length,checkboxDpgConflicts:conflicts.length,strictDoneRows:0},warnings};
}
function profileMetadata(hubRoot) {
  const agents=['architect-alphonso','curator-carla','debugger-debbie','designer-dagmar','doctrine-daphne'].map(name=>({id:name.split('-')[1],path:'governance/skills/.skills-source/'+name+'.md',kind:'agent'}));
  const councils=['dsmes','schoolsafe','repotruth','endo','educator','caregiver','patient','systems'].map(name=>({id:name,path:'governance/skills/glumira-7.1/council-'+name+'.md',kind:'council',clinical:!['repotruth','systems'].includes(name)}));
  const inspect = item=>{const sourcePath=path.resolve(hubRoot,item.path);try{const body=fs.readFileSync(sourcePath,'utf8');return {...item,path:sourcePath,label:(body.match(/^# (.+)$/m)||[])[1]||item.id,description:(body.match(/^description:\s*"?(.+?)"?\r?$/m)||[])[1]||'',hash:createHash('sha256').update(body).digest('hex'),status:'reference located',authority:'Metadata only. Effective instructions are not loaded; current OS wins.'};}catch{return {...item,path:sourcePath,label:item.id,status:'reference unavailable',authority:'No execution authority'};}};
  return {agents:agents.map(inspect),councils:councils.map(inspect)};
}
function readBuilderContext(repoRoot,{hubRoot='C:/memory-governance-archive'}={}) {
  const root=path.resolve(repoRoot);
  if(originIdentity(git(root,['remote','get-url','origin'])).toLowerCase()!==EXPECTED_REPO.toLowerCase())fail('SOURCE_ORIGIN_MISMATCH');
  const commit=git(root,['rev-parse','HEAD']).trim();if(!/^[0-9a-f]{40}$/.test(commit))fail('SOURCE_HEAD_INVALID');
  const read=p=>{if(!validSourcePath(p))fail('SOURCE_PATH_INVALID');return git(root,['show',commit+':'+p]);};
  const json=p=>{try{return JSON.parse(read(p));}catch(e){if(e instanceof BuilderError)throw e;fail('SOURCE_JSON_INVALID');}};
  const registry=json(OS_PATHS[2]),jev=json(OS_PATHS[3]),foyer=json('Foyer/FOYER.json');
  if(registry.active?.toLowerCase()!==EXPECTED_REPO.toLowerCase()||!Array.isArray(registry.repos)||typeof registry.builder!=='string'||!Array.isArray(jev.records)||!jev.revision||!foyer.vaults)fail('SOURCE_SCHEMA_INVALID');
  if(jev.revision!==foyer.jev_revision)fail('ROUTING_REVISION_MISMATCH');
  const route=foyer.routes?.[QUEUE_ROUTE];
  const page=queuePage(foyer.vaults?.[route],registry.builder);
  if(page?.kind!=='file'||page.status==='MISSING'||page.path!==registry.builder||!validSourcePath(page.path))fail('FOYER_ROADMAP_ROUTE_INVALID');
  const roadmapText=read(page.path),version=(roadmapText.match(/^version:\s*(\S+)/m)||[])[1];
  if(!COMPATIBLE_ROADMAP_VERSIONS.includes(version))fail('OS_BUILDER_VERSION_MISMATCH');
  const blob=git(root,['rev-parse',commit+':'+page.path]).trim(),roadmap={...parseRoadmap(roadmapText),version,source:{repo:EXPECTED_REPO,path:page.path,commit,blob,readMode:'committed HEAD; working edits excluded',url:'https://github.com/'+EXPECTED_REPO+'/blob/'+commit+'/'+page.path}};
  if(page.blob&&page.blob!==blob)roadmap.warnings.push({code:'FOYER_PIN_DIFFERS_FROM_HEAD_BLOB'});
  const specs=[['GluMira 7.2','glumira-7.2','Current build and the one ROADMAP.'],['GluMira 7.1','glumira-7.1','The CONDUCTOR · WRITER · ARCHITECT. Version control.'],['Memory Governance Archive','memory-governance-archive','Operational live copies + 2 previous versions. The READ FIRST AND TRUE engine.'],['GluMira Archive','glumira-archive','Build from sorting station. Canonical structure — literally the files and folders. Index-card filing system.'],['Sorting Station','glumira-document-sorting-station','Source and evidence reconciliation station.'],['Foundation Archive',null,'Founding work. Institutional memory. Source and original intent.'],['GluMira 7.2.1','glumira-7.2.1','Planned build']];
  const estate=specs.map(([label,name,role],i)=>{const entry=registry.repos.find(r=>name&&typeof r.repo==='string'&&r.repo.toLowerCase().endsWith('/'+name));return {id:i+1,label,name:label,role,slug:entry?.repo||null,status:entry?(entry.active===true?'active':entry.frozen===true?'frozen':'registered'):'identity unresolved in current OS registry',executionAuthority:entry?.active===true?'current task source':'reference only; no writes authorized',registryRole:entry?.label||null};});
  // The hub roster establishes a declared archive identity only. It is not a
  // source of task authority, and this read does not validate that checkout.
  const rosterPath=path.resolve(hubRoot,'governance/agent-os/live-roster.json');
  try {
    const rosterBytes=fs.readFileSync(rosterPath,'utf8'),roster=JSON.parse(rosterBytes),foundation=roster.repos?.['glumira-foundation-archive'];
    if(foundation?.originMustContain?.toLowerCase()==='glumira-x-technologies-cc/foundation-archive'&&typeof foundation.path==='string')Object.assign(estate[5],{slug:foundation.originMustContain,path:foundation.path,status:'hub roster-declared identity; checkout unvalidated',checkoutVerified:false,executionAuthority:'reference only; no writes authorized',executionAuthorized:false,provenance:{path:rosterPath,key:'repos.glumira-foundation-archive',sha256:createHash('sha256').update(rosterBytes).digest('hex'),scope:'Identity metadata only; not the current OS task-source registry'}});
  } catch { /* Keep the explicit unresolved identity when source is unavailable. */ }
  const resources=['Claude Terminal','Codex','Gemini','Hermes','OmniRoute','Deepseek Nvidia','Soup','Cloudflare','Cerebras','Kaggle'].map(name=>({id:name.toLowerCase().replace(/\s+/g,'-'),name,declared:true,discovered:false,configured:false,probed:false,status:'not probed',evidence:'Requested resource; discovery and runtime configuration not yet inspected'}));
  const texts=OS_PATHS.map(p=>({path:p,text:read(p)}));
  // The law the prompts quote, read at the pinned commit: Article 1 step 10 and the Foyer law string.
  const step10=article1Step(texts[1].text,10);if(!step10||typeof foyer.law!=='string'||!foyer.law.trim())fail('OS_LAW_UNREADABLE');
  const law={step10,step10Source:OS_PATHS[1]+' Article 1 step 10',chain:foyer.law,chainSource:'Foyer/FOYER.json law'};
  return {law,repo:{slug:EXPECTED_REPO,root,commit,branch:git(root,['branch','--show-current']).trim(),dirty:!!git(root,['status','--porcelain']).trim(),source:'committed HEAD'},os:{version:registry.as_of,routingRevision:jev.revision,registry,jev,readPaths:OS_PATHS,documents:texts,fingerprint:createHash('sha256').update(texts.map(t=>t.path+'\n'+t.text).join('\n')+JSON.stringify(foyer)+roadmapText).digest('hex'),gateStatus:'not run by bootstrap'},foyer,roadmap,estate,resources,profiles:profileMetadata(hubRoot)};
}
module.exports={validAppsPath,readBuilderContext,parseRoadmap,originIdentity,validSourcePath,article1Step,queuePage,EXPECTED_REPO,OS_PATHS,QUEUE_ROUTE,COMPATIBLE_ROADMAP_VERSIONS};
