'use strict';
// Repo research before the web (founder 2026-10-10, verbatim: "i ask to improve iob engine / your builder
// wants to read diesel engines"). An idea is matched against what the repo already knows: the subject
// names in Library/OS/JEV-MAP.json, the rows of the function register (TREE.json) and the engine
// standards E01 to E05. A short form is expanded only to a phrase the repo itself defines, for example
// "insulin on board" (IOB) in E01. Nothing is hard-coded per subject. The web search then carries
// that subject, its repo phrases and the product context, and only GluMira or diabetes pages are kept.
const {execFileSync,execFile}=require('node:child_process');
const fs=require('node:fs'),nodePath=require('node:path');

const JEV_MAP='Library/OS/JEV-MAP.json';
const REGISTRY='Library/OS/REPO-REGISTRY.json';
// The engine standards Row (5.14) and the function register Row (5.16) are found by name through the
// routing map on every run, so a moved or renamed folder follows the map. Only the Book inside the Row
// is named here. A Library/<Name>/ in front of the path is allowed, from the map (a vault's library
// field or the record's own path) or from the files themselves.
const ROWS={
  docSet:{name:'Build Plan',row:'5.14',book:'Books/Book-Document-Set/Page-Doc-Document-Set/'},
  tree:{name:'All Build Audits and Documents',row:'5.16',book:'Books/Book-Function-Register/Page-Doc-Function-Register/TREE.json'},
};
const escRe=t=>String(t).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function rowPath(map,want,files=[]){
  const recs=map?.records||[];
  // Two records with the same name: the Row number decides, and loadKnowledge says so in a note.
  const named=recs.filter(r=>norm(r.subject)===norm(want.name));
  const rec=named.length===1?named[0]:(recs.find(r=>String(r.row||'')===want.row)||named[0]);
  if(!rec||!rec.path)return null;
  let p=String(rec.path).replace(/\\/g,'/').replace(/\/+$/,'');
  const vaults=map?.vaults||{},vault=Array.isArray(vaults)?vaults.find(v=>String(v.vault??v.id??'')===String(rec.vault)):vaults[rec.vault];
  const lib=String(vault?.library||'').replace(/^Library\//,'').replace(/\/+$/,'');
  if(lib&&!/^Library\//.test(p))p='Library/'+lib+'/'+p;
  if(files.length&&!files.some(f=>f.startsWith(p+'/'))){
    const re=new RegExp('^(Library/[^/]+/)'+escRe(p)+'/'),hit=files.map(f=>re.exec(f)).find(Boolean);
    if(hit)p=hit[1]+p;
  }
  return p+'/';
}
const FOYER='Foyer/FOYER.json';
const ENGINE_DOC=/^E\d\d-Engine-[^/]+\.md$/;
// Product context every web search carries. GluMira is a diabetes product.
const CONTEXT='diabetes';
// A page is about the product's world when it uses these words. Only for keeping or dropping a web
// result, never for expanding the idea.
const DOMAIN=/\b(diabet\w*|insulin\w*|glucose|glyc(?:a)?em\w*|hypoglyc\w*|hyperglyc\w*|bolus|basal|cgm|glumira|endocrin\w*|carbohydrate|a1c|hba1c)\b/gi;
// Words that say nothing about which subject is meant.
const GENERIC=new Set('a an and the of to for in on at by with from or not is it be as this that my our your engine engines page pages book books row rows vault vaults program system score rate hour new old fix fixes improve improves improved make build add update change work works better best'.split(' '));
const norm=t=>String(t||'').toLowerCase().replace(/[-_/]+/g,' ').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
const tokens=t=>norm(t).split(' ').filter(Boolean);

function safeJson(text){try{return JSON.parse(text);}catch{return null;}}
// Short forms the repo defines: "insulin on board" (IOB), "Food on Board"/FOB. Only from the
// documents, never from this file.
function glossaryOf(text){
  const out=[];const add=(abbr,phrase)=>{phrase=phrase.trim();if(phrase.length<4||phrase.length>48)return;if(!out.some(g=>g.abbr===abbr&&norm(g.phrase)===norm(phrase)))out.push({abbr,phrase});};
  for(const m of String(text).matchAll(/["\u201c]([A-Za-z][A-Za-z -]{2,46})["\u201d]\s*(?:\(|\/)([A-Z][A-Z0-9]{1,5})\b/g))add(m[2],m[1]);
  return out;
}
// Other names a standard gives its engine in its purpose section: ("Meal-to-Curve", formerly "Food on Board").
function aliasesOf(text){
  const out=[];
  for(const m of String(text).matchAll(/\(["\u201c]([A-Za-z][A-Za-z -]{2,40})["\u201d]/g))out.push(m[1]);
  for(const m of String(text).matchAll(/formerly ["\u201c]([A-Za-z][A-Za-z -]{2,40})["\u201d]/g))out.push(m[1]);
  return [...new Set(out)];
}
// The named but missing tests in an engine standard's tests section.
const missingTests=text=>[...new Set([...String(text).matchAll(/Missing test `([^`]+)`/g)].map(m=>m[1]))];
const sectionOne=text=>{const m=/\n## 1\.[^\n]*\n([\s\S]*?)\n## /.exec(String(text));return m?m[1]:'';};

// What the repo knows, read once per commit.
const cache=new Map(),CACHE_MAX=3;
function loadKnowledge(source,{listFiles,readRepoFile}){
  const key=source?.repo?.commit||'';if(key&&cache.has(key))return cache.get(key);
  const read=p=>{try{return String(readRepoFile(source,p)||'');}catch{return '';}};
  const files=(()=>{try{return listFiles(source)||[];}catch{return [];}})();
  const subjects=[];const addSubject=(name,from,extra={})=>{if(!name||subjects.some(s=>norm(s.name)===norm(name)&&s.from===from))return;subjects.push({name,from,...extra});};
  const map=safeJson(read(JEV_MAP));
  const docRow=rowPath(map,ROWS.docSet,files),treeRow=rowPath(map,ROWS.tree,files);
  const DOC_SET=docRow?docRow+ROWS.docSet.book:null,TREE=treeRow?treeRow+ROWS.tree.book:null;
  for(const r of map?.records||[])addSubject(r.subject,'JEV-MAP',{path:r.path||null,vault:r.vault,row:r.row||null});
  const tree=TREE?safeJson(read(TREE)):null;
  for(const v of tree?.vaults||[])for(const r of v.rows||[])addSubject(r.row,'function register',{vault:v.vault,count:r.count});
  const engines=!DOC_SET?[]:files.filter(f=>f.startsWith(DOC_SET)&&ENGINE_DOC.test(f.slice(DOC_SET.length))).sort().map(path=>{
    const text=read(path),title=(/^#\s+(.+)$/m.exec(text)||[])[1]||'',name=title.replace(/^.*Engine:\s*/,'').trim(),purpose=sectionOne(text);
    return {id:path.slice(DOC_SET.length,DOC_SET.length+3),path,name,aliases:aliasesOf(purpose),glossary:glossaryOf(text).map(g=>({...g,source:path})),purpose,missing:missingTests(text)};
  });
  for(const e of engines)addSubject(e.name,'engine standard',{path:e.path});
  // A moved or renamed source is said out loud in the prompt, never skipped in silence.
  const notes=[];
  if(!map)notes.push('Routing map not found at '+JEV_MAP+': subjects from it were not used.');
  const rowNote=w=>'Row '+w.row+' ('+w.name+') not found in '+JEV_MAP;
  if(!TREE)notes.push(rowNote(ROWS.tree)+': the function register rows were not used.');
  else if(!tree)notes.push('Function register not found at '+TREE+': its rows were not used.');
  if(!DOC_SET)notes.push(rowNote(ROWS.docSet)+': no engine standard or missing tests were used.');
  else if(!engines.length)notes.push('Engine standards not found under '+DOC_SET+' (E01 to E05): no engine standard or missing tests were used.');
  for(const w of [ROWS.docSet,ROWS.tree])if((map?.records||[]).filter(r=>norm(r.subject)===norm(w.name)).length>1)notes.push('More than one record in '+JEV_MAP+' is named "'+w.name+'": Row '+w.row+' was taken by its number. Fix the duplicate name in the map.');
  const registry=safeJson(read(REGISTRY));
  const memory=memoryRoot(map,files),stale=staleMap(map,files,source?.foyer);
  const foyer=(()=>{const f=safeJson(read(FOYER));return f&&typeof f==='object'?f:null;})();
  const value={stale,memory,commit:key,foyer,subjects,engines,glossary:engines.flatMap(e=>e.glossary),notes,paths:{tree:TREE,docSet:DOC_SET},files,registry};
  // Keep the last three commits only.
  if(key){cache.set(key,value);while(cache.size>CACHE_MAX)cache.delete(cache.keys().next().value);}
  return value;
}
// How strongly an idea names a subject: its whole name in the idea counts most, then every word of
// the name that says something (not "engine"), then a phrase the repo defines for one of its words.
// A score of 2 needs every telling word of the name, and either two or more of them, a name made of
// joined parts (What-If), or a name that is an engine standard title. One matching word stays at 1.
function scoreSubject(idea,name,glossary=[],{standard=false}={}){
  const text=' '+norm(idea)+' ',words=new Set(tokens(idea)),n=norm(name);if(!n)return 0;
  const own=tokens(name).filter(w=>!GENERIC.has(w)&&w.length>=2);
  // A name of two or more telling words typed whole ("production builder") outranks one word that is also
  // a Row name ("skills"): founder 2026-10-14, a Builder idea routed to Row 4.1 Skills was "useless".
  let score=text.includes(' '+n+' ')?(own.length>=2?4:3):0;
  const whole=own.length>=2||/\w-\w/.test(name)||standard;
  if(!score&&own.length&&whole&&own.every(w=>words.has(w)))score=2;
  else if(!score)score=Math.min(1,own.filter(w=>w.length>=3&&words.has(w)).length);
  for(const g of glossary)if(tokens(name).includes(g.abbr.toLowerCase())&&text.includes(' '+norm(g.phrase)+' '))score=Math.max(score,3);
  return score;
}
// A short form counts as typed only if it is not a common word, and is in capitals in the idea or is
// three or more letters long.
function shortFormTyped(abbr,idea){
  const a=String(abbr||'').replace(/[^A-Za-z0-9]/g,'');if(!a||GENERIC.has(a.toLowerCase()))return false;
  if(!new RegExp('\\b'+a+'\\b','i').test(idea))return false;
  return a.length>=3||new RegExp('\\b'+a+'\\b').test(idea);
}
function engineFor(name,engines){const n=norm(name);return engines.find(e=>norm(e.name)===n||e.aliases.some(a=>norm(a)===n))||null;}
function grepRepo(source,phrase){
  if(!source?.repo?.root||!/^[0-9a-f]{40}$/.test(source.repo.commit||''))return [];
  try{return execFileSync('git',['-c','safe.directory='+source.repo.root.replace(/\\/g,'/'),'-c','core.longpaths=true','-C',source.repo.root,'grep','-l','-i','-F','-e',phrase,source.repo.commit,'--','*.md'],{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}).split(/\r?\n/).filter(Boolean).map(l=>l.replace(/^[0-9a-f]{40}:/,''));}catch{return [];}
}
// The repo grep without blocking the server (Ruflo card 2): git runs as a child process under the
// caller's AbortSignal, so it shares the other-repo search's 20 second limit. A cut grep rejects with
// code TIME_RAN_OUT so the caller can name it; no match is an empty list. Any other git error (exit
// code above 1, git missing, a bad commit) rejects with code GIT_FAILED and a short reason, so the
// notes say the search failed instead of reading as "no mentions" (Engineering Team, 2026-10-13).
const gitReason=(e,se)=>{const line=String(se||'').split(/\r?\n/).map(l=>l.trim()).find(Boolean)||e?.message||'git error';return line.replace(/^(fatal|error):\s*/i,'').slice(0,120);};
function grepRepoAsync(source,phrase,{signal=null,limitMs=OTHER_LIMIT_MS}={}){
  if(!source?.repo?.root||!/^[0-9a-f]{40}$/.test(source.repo.commit||''))return Promise.resolve([]);
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),Math.max(0,limitMs));timer.unref?.();
  const stop=()=>ac.abort();if(signal){if(signal.aborted)ac.abort();else signal.addEventListener('abort',stop,{once:true});}
  const args=['-c','safe.directory='+source.repo.root.replace(/\\/g,'/'),'-c','core.longpaths=true','-C',source.repo.root,'grep','-l','-i','-F','-e',phrase,source.repo.commit,'--','*.md'];
  return new Promise((ok,no)=>execFile('git',args,{encoding:'utf8',windowsHide:true,signal:ac.signal,maxBuffer:8*1024*1024},(e,so,se)=>{
    clearTimeout(timer);signal?.removeEventListener?.('abort',stop);
    if(ac.signal.aborted){const err=new Error('time ran out');err.code='TIME_RAN_OUT';return no(err);}
    // git grep exits 1 with no output when nothing matches: that is an empty list, not a failure.
    if(e&&!(e.code===1&&!String(so||'').trim())){const err=new Error(gitReason(e,se));err.code='GIT_FAILED';return no(err);}
    ok(e?[]:String(so).split(/\r?\n/).filter(Boolean).map(l=>l.replace(/^[0-9a-f]{40}:/,'')));
  }));
}
const MAX_DOCS=6;
// The other repos in REPO-REGISTRY, searched when the subject's own 7.2 Row has no files (founder
// 2026-10-11: "giving a half baked something"). Each repo is looked for by its name under the folders
// in BUILDER_REPO_ROOTS (separated like PATH) and read at the commit the registry pins, else HEAD.
// Read-only: git grep, nothing is checked out or changed.
const CODE_FILE=/\.(m?js|cjs|ts|tsx|py)$/;
// One limit for the whole search, not one per repo: whatever it skips is named in the prompt.
const OTHER_LIMIT_MS=20000;
function searchOtherRepos(registry,terms,{roots=process.env.BUILDER_REPO_ROOTS||'',limitMs=OTHER_LIMIT_MS}={}){
  const out={searched:[],unavailable:[],hits:[]},end=Date.now()+limitMs,left=()=>end-Date.now();
  const dirs=String(roots).split(nodePath.delimiter).filter(Boolean);
  for(const r of registry?.repos||[]){
    if(r.active||!r.repo||r.status==='MISSING')continue;
    const name=r.repo.split('/').pop();
    const dir=dirs.map(d=>nodePath.join(d,name)).find(d=>{try{return fs.existsSync(nodePath.join(d,'.git'));}catch{return false;}});
    if(!dir){out.unavailable.push((r.label||r.repo)+' (no local copy)');continue;}
    if(left()<500){out.unavailable.push((r.label||r.repo)+' (time ran out)');continue;}
    const git=(ref,t)=>execFileSync('git',['-c','safe.directory='+dir.replace(/\\/g,'/'),'-c','core.longpaths=true','-C',dir,'grep','-l','-i','-F','-e',t,ref,'--','*.md','*.js','*.mjs','*.cjs','*.ts','*.tsx','*.py'],{encoding:'utf8',windowsHide:true,timeout:Math.max(500,left()),maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
    let ref=/^[0-9a-f]{40}$/.test(r.commit||'')?r.commit:'HEAD';
    // The pinned commit may not be in this clone yet: read HEAD then, and say which was read.
    if(ref!=='HEAD'){try{execFileSync('git',['-c','safe.directory='+dir.replace(/\\/g,'/'),'-C',dir,'cat-file','-e',ref+'^{commit}'],{windowsHide:true,timeout:5000,stdio:'ignore'});}catch{ref='HEAD';}}
    const found=new Map();let cut=false;
    for(const t of terms.filter(Boolean)){if(left()<500){cut=true;break;}let lines=[];try{lines=git(ref,t).split(/\r?\n/).filter(Boolean);}catch(e){if(left()<500)cut=true;}for(const l of lines){const p=l.slice(l.indexOf(':')+1);if(!FILING_INDEX.test(p)&&!INDEX_FILE.test(p))found.set(p,(found.get(p)||0)+1);}}
    if(cut)out.unavailable.push((r.label||r.repo)+' (time ran out)');else out.searched.push(r.label||r.repo);
    [...found].sort((a,b)=>(CODE_FILE.test(b[0])-CODE_FILE.test(a[0]))||b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,4).forEach(([p])=>out.hits.push({repo:r.repo,label:r.label||r.repo,commit:ref,path:p}));
  }
  return out;
}
// The same search without blocking the server: git runs as a child process the event loop waits on,
// and one AbortSignal ends every git call when the 20 second limit runs out (Engineering Team, 2026-10-11).
function searchOtherReposAsync(registry,terms,{roots=process.env.BUILDER_REPO_ROOTS||'',limitMs=OTHER_LIMIT_MS,signal=null}={}){
  const out={searched:[],unavailable:[],hits:[]},end=Date.now()+limitMs,left=()=>end-Date.now();
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),Math.max(0,limitMs));timer.unref?.();
  // A caller's signal (the router's one limit for every search of a step) ends this search too.
  if(signal){if(signal.aborted)ac.abort();else signal.addEventListener('abort',()=>ac.abort(),{once:true});}
  const run=(dir,args)=>new Promise((ok,no)=>execFile('git',['-c','safe.directory='+dir.replace(/\\/g,'/'),'-c','core.longpaths=true','-C',dir,...args],{encoding:'utf8',windowsHide:true,signal:ac.signal,maxBuffer:8*1024*1024},(e,so)=>e?no(e):ok(so)));
  const dirs=String(roots).split(nodePath.delimiter).filter(Boolean);
  const one=async r=>{
    const name=r.repo.split('/').pop();
    const dir=dirs.map(d=>nodePath.join(d,name)).find(d=>{try{return fs.existsSync(nodePath.join(d,'.git'));}catch{return false;}});
    if(!dir)return {r,skip:'no local copy'};
    if(left()<500)return {r,skip:'time ran out'};
    let ref=/^[0-9a-f]{40}$/.test(r.commit||'')?r.commit:'HEAD';
    if(ref!=='HEAD'){try{await run(dir,['cat-file','-e',ref+'^{commit}']);}catch{if(ac.signal.aborted)return {r,skip:'time ran out'};ref='HEAD';}}
    const found=new Map();
    for(const t of terms.filter(Boolean)){
      if(ac.signal.aborted)return {r,skip:'time ran out'};
      let lines=[];try{lines=(await run(dir,['grep','-l','-i','-F','-e',t,ref,'--','*.md','*.js','*.mjs','*.cjs','*.ts','*.tsx','*.py'])).split(/\r?\n/).filter(Boolean);}catch{if(ac.signal.aborted)return {r,skip:'time ran out'};}
      for(const l of lines){const p=l.slice(l.indexOf(':')+1);if(!FILING_INDEX.test(p)&&!INDEX_FILE.test(p))found.set(p,(found.get(p)||0)+1);}
    }
    return {r,ref,found};
  };
  const repos=(registry?.repos||[]).filter(r=>!r.active&&r.repo&&r.status!=='MISSING');
  // The repos are searched side by side; the results keep the registry's order.
  return Promise.all(repos.map(one)).then(rs=>{clearTimeout(timer);
    for(const x of rs){const label=x.r.label||x.r.repo;
      if(x.skip){out.unavailable.push(label+' ('+x.skip+')');continue;}
      out.searched.push(label);
      [...x.found].sort((a,b)=>(CODE_FILE.test(b[0])-CODE_FILE.test(a[0]))||b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,4).forEach(([p])=>out.hits.push({repo:x.r.repo,label,commit:x.ref,path:p}));}
    return out;});
}
// Two or three concrete goals from what exists and what is missing, for the founder to pick one before
// any prompt is written. Built from repo facts only: the standard's missing tests, the Row's files and
// what the other repos hold. Nothing here is invented.
const CHART=/\b(chart|charts|curve|curves|graph|plot|series)\b/i;
// A Row with files and no engine standard (Ruflo card 3, "improve the build plan"): the goals come from
// the Row's own files, a review of the whole Row first, then the files whose names share the most
// words with the subject. Every path is a real file in the Row; nothing is a made-up default.
const ROW_GOAL_FILE=/\.(md|json|m?js)$/;
function rowGoals({subject,row,files=[]}){
  const dir=String(row.path).replace(/\/+$/,'')+'/',own=tokens(subject).filter(w=>!GENERIC.has(w)&&w.length>=3);
  const list=files.filter(f=>f.startsWith(dir)&&ROW_GOAL_FILE.test(f)&&!FILING_INDEX.test(f)&&!/(^|\/)PROVENANCE\.json$|SUPERSEDED/i.test(f));
  const score=f=>{const base=new Set(tokens(f.split('/').pop().replace(/\.[^.]+$/,''))),rest=new Set(tokens(f.slice(dir.length)));return own.filter(w=>base.has(w)).length*2+own.filter(w=>rest.has(w)).length;};
  const top=list.map(f=>({f,s:score(f)})).sort((a,b)=>b.s-a.s||a.f.localeCompare(b.f)).slice(0,2).map(x=>x.f);
  const goals=[{id:'row-review',text:'Check the '+row.files+' file'+(row.files===1?'':'s')+' in Row '+row.row+' '+subject+' and list what is missing or out of date, each with its file. Review only, no edits.',review:true,chart:false,returns:'A list of what is missing or out of date, each with its file',done:'Each gap is listed with the file it belongs in.'}];
  for(const f of top)goals.push({id:'row-file',text:'Improve '+f+' in Row '+row.row+' '+subject+': list the changes it needs first, then make them on a branch after your yes.',review:false,chart:false,files:[f],returns:'The list of changes to '+f+', then the edited file on a branch',done:f+' carries the changes you approved, and the tests still pass.'});
  return goals;
}
// A Row with no files, no engine standard and nothing in the other repos (Ruflo card, Row 4.1 Skills):
// the goals come only from what the repo says about the Row: its JEV-MAP record, its Foyer entry and
// its Cabinet file if it has one, and the fact that it is empty. No file is made up.
function emptyRowGoals({subject,row,other}){
  const where=['JEV-MAP: '+row.name+', Row '+row.row+(row.vault?', Vault '+row.vault+(row.vaultName?' '+row.vaultName:''):'')+', '+String(row.path).replace(/\/+$/,'')];
  if(row.foyer?.status)where.push('Foyer: '+row.foyer.status);
  if(row.foyer?.note)where.push('Foyer note: '+row.foyer.note);
  const from=where.join('; ');
  const goals=[{id:'row-start',text:'Start Row '+row.row+' '+subject+': it has no '+(row.cabinet?'files besides '+row.cabinet:'files')+' yet. Propose its first Book and Pages from its routing entry ('+from+'). Proposal only, no files made.',review:true,chart:false,returns:'A proposed first Book and its Pages for Row '+row.row+' '+subject+', each with the routing entry it comes from',done:'Each proposed Book and Page names the routing entry it comes from, and nothing is filed before your yes.'}];
  if(row.cabinet)goals.push({id:'row-cabinet',text:'Check '+row.cabinet+' against the routing entry of Row '+row.row+' '+subject+' ('+from+') and list what does not match. Review only, no edits.',review:true,chart:false,files:[row.cabinet],returns:'A list of what in '+row.cabinet+' does not match the routing entry',done:'Each line of the routing entry is marked matched or not, with the line of '+row.cabinet+'.'});
  const searched=other?.searched?.length&&!other?.hits?.length?' (the other repos searched: '+other.searched.join(', ')+', nothing found)':'';
  goals.push({id:'row-sources',text:'Find what Glumira-7.2 already says about '+subject+' outside Row '+row.row+searched+' and list where each piece is, so the Row can be started from it. Review only, no edits.',review:true,chart:false,returns:'A list of mentions of '+subject+', each with its file and line',done:'Every mention is listed with its file and line, or the list says there are none.'});
  return goals;
}
function goalsFor({subject,engine,row,other,files=[]}){
  const goals=[],add=g=>{if(goals.length<3)goals.push(g);};
  const std=engine?engine.id+' ('+engine.name+')':'its standard';
  const hit=other?.hits?.find(h=>CODE_FILE.test(h.path))||other?.hits?.[0];
  for(const t of (engine?.missing||[]).slice(0,1))add({id:'missing-test',text:'Write the missing test '+t+' that '+engine.id+' names, with the input and expected result the standard gives.',review:false,chart:CHART.test(t.replace(/-/g,' ')),returns:'The new test, committed on a branch',done:'The test '+t+' runs and passes, and the existing tests still pass.'});
  if((row?.empty||row?.onlyIndex)&&hit){
    add({id:'bring-in',text:'Bring the '+subject+' code from '+hit.label+' ('+hit.path+') into Row '+row.row+' unchanged, pinned in a PROVENANCE.json, so Glumira-7.2 has the engine.',review:false,chart:false,returns:'The copied files and their PROVENANCE.json, on a branch',done:'The copied files match '+hit.label+' byte for byte, PROVENANCE.json pins them, and any tests that came with them pass.'});
    add({id:'gap-review',text:'Compare the '+subject+' code in '+hit.label+' with '+std+' and list every gap. Review only, no edits.',review:true,chart:false,returns:'A list of gaps, each with its file and line',done:'Every requirement in '+std+' is marked met, partly met or missing, with the file and line.'});
  }else if(row&&!engine&&(row.empty||row.onlyIndex))emptyRowGoals({subject,row,other}).forEach(add);
  else if(row&&!row.empty&&!engine)rowGoals({subject,row,files}).forEach(add);
  else if(row&&!row.empty)add({id:'row-review',text:'Check the files in Row '+row.row+' '+subject+' against '+std+' and list what is missing. Review only, no edits.',review:true,chart:false,returns:'A list of what is missing, each with its file',done:'Each gap is listed with the file it belongs in.'});
  if(engine&&!(engine.missing||[]).length)add({id:'tests-from-standard',text:'Write a test for each '+engine.id+' requirement that has none yet, with the inputs and outputs the standard gives. Tests only, no engine code.',review:false,chart:false,returns:'The new tests, committed on a branch',done:'Each new test names its '+engine.id+' requirement, and all tests pass.'});
  if(engine&&goals.length<3)add({id:'standard-review',text:'Check '+engine.id+' itself: list each requirement with no test, and each test with no requirement. Review only, no edits.',review:true,chart:false,returns:'A list of requirements without tests and tests without requirements',done:'Every requirement and every test in '+engine.id+' is on one of the two lists or marked covered.'});
  return goals;
}
// Filing indexes list every name in the repo, so a mention there says nothing: the OS library,
// cabinet files, the filing law and real Archive or Superseded folders and Rows are left out of the
// repo grep. A page that only has "archive" in its own name (archive-retention-spec.md) is still read.
const FILING_INDEX=/^Library\/OS\/|(^|\/)Cabinet-[^/]*$|FILING-LAW|(^|\/)GUIDE\.md$|(^|\/)(?:\d+(?:\.\d+)*-|Book-|Row-)?(?:archive|superseded)(?:[-_ ][^/]*)?\//i;
// The Memory Vault is found by name through the routing map, like rowPath, never by a hard-coded
// folder: with no map entry, any top Vault named Memory (with or without a number prefix) counts.
function memoryRoot(map,files=[]){
  const vaults=map?.vaults||{},list=Array.isArray(vaults)?vaults:Object.values(vaults);
  const v=list.find(x=>norm(x?.name||'')==='memory');
  if(v?.path)return String(v.path).replace(/\/+$/,'')+'/';
  const f=files.find(p=>/^Vaults\/(?:\d+-)?Memory\//i.test(p));
  return f?f.split('/').slice(0,2).join('/')+'/':null;
}
// The routing map must match the repo (Ruflo card 1, 2026-10-13): every Row folder the repo has and
// every route the Foyer names must be in JEV-MAP. When one is missing the Builder stops and says
// STALE_MAP; it never falls back to the OS boot files as sources. A map that cannot be read at all is
// named in the notes instead, as before. A Library/<Name>/ in front of a Vault path is allowed.
const STALE_MAP='Routing map out of date, regenerate JEV-MAP';
const noLib=p=>String(p||'').replace(/\\/g,'/').replace(/\/+$/,'').replace(/^Library\/[^/]+\/(?=Vaults\/)/,'');
function staleMap(map,files=[],foyer=null){
  if(!map)return [];
  const out=[],recs=new Set((map.records||[]).map(r=>noLib(r.path)).filter(Boolean));
  const rows=[...new Set((files||[]).map(f=>(/^(.+?\/Rows\/[^/]+)\//.exec(f)||[])[1]).filter(Boolean))].sort();
  for(const r of rows)if(!recs.has(noLib(r)))out.push('Row folder '+r+' is not in '+JEV_MAP+'.');
  const vaults=map.vaults||{},ids=new Set(Array.isArray(vaults)?vaults.map(v=>String(v?.vault??v?.id??'')):Object.keys(vaults));
  for(const [name,id] of Object.entries(foyer?.routes||{}))if(!ids.has(String(id)))out.push('Foyer route "'+name+'" (Vault '+id+') is not in '+JEV_MAP+'.');
  return out;
}
const LOW_DOC=/Superseded|Archive|FILING-LAW|Handover/i;
// Index files that list every subject say nothing about this one.
// Filing and tracker documents (the plan, asks, covered list, tracker, prompts, cards, dropped list)
// mention every subject too, so they are not sources for one (Stella's live check, 2026-10-11).
const INDEX_FILE=/\/(TRACE|TRACE-MATRIX|SUMMARY|DOC-SET|COVERAGE|UNPLACED|TREE|PLAN|ASK|COVERED|TRACKER|PROMPTS|CARDS|DROPPED|ROADMAP)\.md$|^README\.md$/;
// The research for one idea: the subject, its repo phrases, the repo documents to read first, the
// engine standard and its missing tests, and the web queries. Null when the idea names nothing the
// repo knows.
function researchFor(idea,knowledge,{source=null,grep=grepRepo,others=searchOtherRepos}={}){
  const k=knowledge||{subjects:[],engines:[],glossary:[]};
  const words=new Set(tokens(idea));
  const ranked=k.subjects.map(s=>({...s,score:scoreSubject(idea,s.name,k.glossary,{standard:s.from==='engine standard'})})).filter(s=>s.score>=1).sort((a,b)=>b.score-a.score||(a.from==='engine standard'?-1:b.from==='engine standard'?1:0)||(b.row?1:0)-(a.row?1:0));
  const typed=k.glossary.filter(g=>shortFormTyped(g.abbr,idea));
  if(!ranked.length&&!typed.length)return null;
  // A Vault-level winner hands the idea to its own Row when that Row matches too (Production Builder ->
  // Row 5.13 Builder App, the Builder's code), so the goals and files are the Row's, not the whole Vault's.
  const inRow=ranked[0]&&!ranked[0].row&&ranked[0].vault?ranked.find(s=>s.row&&s.vault===ranked[0].vault&&s.score>=2):null;
  const top=inRow||ranked[0]||null,engine=top?engineFor(top.name,k.engines):null;
  const subject=engine?engine.name:top?top.name:typed[0].phrase;
  const routed=k.subjects.find(s=>s.from==='JEV-MAP'&&norm(s.name)===norm(subject))||null;
  // The repo phrases for this subject: short forms typed in the idea or in its name, then the other
  // names its standard gives it. A short form the purpose section only mentions (What-If uses IOB) is
  // not the subject, so it stays out of the queries, the repo grep and the prompt.
  const nameAbbr=tokens(subject).map(w=>w.toUpperCase());
  const phrases=[];const addPhrase=g=>{if(norm(g.phrase)!==norm(subject)&&!phrases.some(p=>norm(p.phrase)===norm(g.phrase)))phrases.push(g);};
  typed.forEach(addPhrase);
  k.glossary.filter(g=>nameAbbr.includes(g.abbr)).forEach(addPhrase);
  if(engine)for(const a of engine.aliases)addPhrase({abbr:'',phrase:a,source:engine.path});
  const docs=[];const addDoc=(path,why)=>{if(path&&!docs.some(d=>d.path===path)&&docs.length<MAX_DOCS)docs.push({path,why});};
  if(engine)addDoc(engine.path,'the engine standard '+engine.id+' for '+engine.name);
  // The subject's own Row: its files come straight after the standard, ahead of any mention elsewhere.
  // An empty Row is said plainly, and the other repos are searched for the real code and evidence.
  const rowDir=routed?.path?String(routed.path).replace(/\/+$/,'')+'/':null;
  const rowFiles=rowDir?(k.files||[]).filter(f=>f.startsWith(rowDir)):[];
  const row=routed&&routed.row?{row:routed.row,name:routed.name,path:routed.path,files:rowFiles.length,empty:!rowFiles.length}:null;
  if(row){
    // What the routing says about the Row, for a Row with nothing in it yet: the Foyer entry (the
    // server's, else the repo's own Foyer/FOYER.json) and its Cabinet file if that is all it holds.
    // Vaults and rows may be objects keyed by number or arrays of entries with an id or row field.
    const pick=(set,key,fields)=>{if(!set||typeof set!=='object')return null;if(Array.isArray(set))return set.find(e=>e&&fields.some(f=>e[f]!=null&&String(e[f])===String(key)))||null;return set[key]||Object.values(set).find(e=>e&&typeof e==='object'&&fields.some(f=>e[f]!=null&&String(e[f])===String(key)))||null;};
    const fv=pick(source?.foyer?.vaults,routed.vault,['id','vault'])||pick(k.foyer?.vaults,routed.vault,['id','vault']),fr=pick(fv?.rows,row.row,['row','id']);
    row.vault=routed.vault||null;row.vaultName=fv?.name||null;
    row.foyer=fr?{status:fr.status||null,note:fr.note||fr.purpose||null}:null;
    row.cabinet=rowFiles.find(f=>/(^|\/)Cabinet-[^/]*\.md$/i.test(f)&&f.slice(rowDir.length).indexOf('/')<0)||null;
    row.onlyIndex=!row.empty&&rowFiles.every(f=>FILING_INDEX.test(f));
  }
  rowFiles.filter(f=>/\.(md|json|m?js)$/.test(f)&&!FILING_INDEX.test(f)).sort().slice(0,4).forEach(f=>addDoc(f,'a file in Row '+routed.row+' '+routed.name));
  const hits=new Map();
  // Agent memory notes are hints, never sources: a feedback note that says "build plan" in passing
  // is a keyword hit, not a document about the subject (Stella's live check, 2026-10-11).
  for(const term of [subject,...phrases.slice(0,2).map(p=>p.phrase)])for(const f of grep(source,term))if(!INDEX_FILE.test(f)&&!FILING_INDEX.test(f)&&!(k.memory&&f.startsWith(k.memory)))hits.set(f,(hits.get(f)||0)+1);
  // Docs from the engine's own row (or the routed subject's row) come first; archived, superseded,
  // filing-law and handover files that only mention the name come last.
  // The Row folder by its filing shape, so a Vault under a Library/<Name>/ keeps its own row first.
  const homeRows=[engine&&engine.path,routed&&routed.path].filter(Boolean).map(p=>(/^(.+?\/Rows\/[^/]+\/)/.exec(p+'/')||[])[1]).filter(Boolean);
  const tier=f=>homeRows.some(r=>f.startsWith(r))?0:LOW_DOC.test(f)?2:1;
  [...hits].sort((a,b)=>tier(a[0])-tier(b[0])||b[1]-a[1]||a[0].localeCompare(b[0])).forEach(([f])=>addDoc(f,'mentions '+subject+(phrases[0]?' or '+phrases[0].phrase:'')));
  const queries=[];const q=parts=>{const s=parts.filter(Boolean).join(' ').trim();if(s&&!queries.includes(s))queries.push(s);};
  // A short form in the idea or the subject's name leads with its repo phrase; otherwise the subject
  // leads, with its first repo phrase beside it.
  const lead=phrases.find(p=>p.abbr&&(nameAbbr.includes(p.abbr)||words.has(p.abbr.toLowerCase())));
  if(lead)q(['"'+lead.phrase+'"',lead.abbr,CONTEXT]);
  // GluMira's own names are not on the open web as exact phrases, so they go in unquoted.
  q([subject,(lead||phrases[0])?(lead||phrases[0]).phrase:'',CONTEXT]);
  q(['GluMira',subject]);
  // The estate's own Vaults (1 to 6: Operating System, Memory, Archive, Governance, Production Builder,
  // Insulin-Lock) are not on the open web: "Skills diabetes" read diabetes skills pages for a Builder job
  // (founder 2026-10-14: "research missing the mark"). They get no subject search; an idea that asks for
  // research still searches on its own words.
  if(routed&&Number(routed.vault)>=1&&Number(routed.vault)<=6)queries.length=0;
  // Strong: the whole name, every telling word of it, or a short form the repo defines. Only a strong
  // match skips the goal read-back.
  const strong=Boolean(typed.length)||Boolean(top&&top.score>=2);
  let other=null;
  if(row&&(row.empty||row.onlyIndex)){try{other=others(k.registry,[subject,...phrases.slice(0,1).map(p=>p.phrase)]);}catch{other={searched:[],unavailable:[],hits:[]};}}
  const goals=goalsFor({subject,engine,row,other,files:k.files||[]});
  // The founder's own idea, word for word, is the first goal to choose (founder 2026-10-14, on a goal list
  // of Row templates: "useless"). Only a described idea (12 words or more): a short one such as "improve
  // skills" gets the Row's concrete goals. Engine ideas keep the goals their standard gives first.
  const asWritten=String(idea||'').replace(/\s+/g,' ').trim();
  if(!engine&&asWritten.split(' ').length>=12&&!goals.some(g=>g.text===asWritten))goals.unshift({id:'as-written',text:asWritten,review:false,chart:false});
  return {strong,score:top?top.score:0,subject,from:top?top.from:'glossary',routed:routed?{subject:routed.name,vault:routed.vault,row:routed.row,path:routed.path}:null,phrases:phrases.slice(0,4).map(p=>({abbr:p.abbr,phrase:p.phrase,source:p.source,typed:Boolean(p.abbr)&&shortFormTyped(p.abbr,idea)})),engine:engine?{id:engine.id,name:engine.name,path:engine.path,missing:engine.missing}:null,docs,queries:queries.slice(0,3),keep:[subject,...phrases.map(p=>p.phrase)],row,other,goals};
}
// A web page or search result is kept only when it is about diabetes or GluMira.
const domainHits=text=>(String(text).match(DOMAIN)||[]).length;
const relevant=text=>domainHits(text)>=1;
module.exports={STALE_MAP,staleMap,grepRepoAsync,rowGoals,OTHER_LIMIT_MS,searchOtherReposAsync,memoryRoot,cacheSize:()=>cache.size,shortFormTyped,loadKnowledge,researchFor,glossaryOf,aliasesOf,missingTests,scoreSubject,relevant,domainHits,grepRepo,searchOtherRepos,goalsFor,CONTEXT,JEV_MAP,REGISTRY,ROWS,rowPath,FILING_INDEX,norm};