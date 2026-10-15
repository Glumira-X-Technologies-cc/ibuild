'use strict';
// Job type first (Lane C, 2026-10-09). The founder's idea "i want to reach out to leaphealth.ai for a
// collaboration proposal / read their profile and draft a proposal on the idea - co founder is dietician
// already in hospitals" came back as a code-change prompt (STELLA-WEBREF-PRECHECK, other notes). The kind
// of job is read from the idea first: code work keeps the Ideas flow exactly as it was; writing and
// research get their own questions and a prompt with no file lists, no CHECK and no branch rules.
// Deterministic, like the rest of the flow: no model decides the kind.
const {typedLinks,isLocalLink}=require('./builder-web');

const KINDS={'A code change: build or fix something':'code','Writing: a proposal, email, letter or post':'writing','Research: find out and report back':'research'};
const KIND_LABEL=Object.fromEntries(Object.entries(KINDS).map(([k,v])=>[v,k]));
const KIND_QUESTION=Object.freeze({id:'job',ask:'What kind of job is this?',options:Object.keys(KINDS)});
const WRITING=/\b(reach(?:ing)? out|outreach|proposals?|pitch(?:es)?|cover letter|press release|newsletter|collaborat(?:e|ion)|partnership|introduc(?:e|tion) (?:us|me|glumira)|(?:write|draft)(?: up)? (?:a|an|the|my|our) (?:\w+ )?(?:email|letter|message|reply|post|article|blog|bio|proposal|note|pitch)|(?:email|letter|message) to)\b/i;
const RESEARCH=/\b(research|find out|look into|compare|competitors?|who are|what are the|market size|literature|studies|evidence for|is there any)\b/i;
// Code words, so a mixed idea ("write a proposal for the new export button") is asked about, not guessed.
const CODE=/\b(code|bugs?|fix(?:es)?|broken|crash(?:es)?|errors?|buttons?|screens?|layout|css|ui|ux|api|server|endpoint|repo|branch|tests?|deploy|refactor|scripts?|database|component|function|chart|bot|workflow)\b|(?<![.\w])app\b|\b(?:Library|Foyer|Vaults)\//i;
const CLINICAL=/\b(insulin|clinical|dose|dosing|glucose|patients?|iob|diet(?:ician|itian)|hospitals?|nutrition|hba1c|diabetes)\b/i;

// The kind of job: an answer the founder gave wins; else the idea's own words; a mixed idea is asked.
function jobKind(idea,answers){
  const given=(answers||[]).find(a=>a.id==='job');
  if(given)return KINDS[given.answer]||(/writ|propos|email|letter|outreach/i.test(given.answer)?'writing':/research|find out/i.test(given.answer)?'research':'code');
  const w=WRITING.test(idea),r=RESEARCH.test(idea),c=CODE.test(idea);
  if(w&&!c)return 'writing';
  if(r&&!w&&!c)return 'research';
  if((w||r)&&c)return 'ask';
  return 'code';
}

// Writing questions: who, what we offer, what we ask, tone, length (brief, Lane C).
const WRITING_QUESTIONS=Object.freeze([
  {id:'who',ask:'Who is it for? Name the person or organisation and their role.',options:['Their founders or leadership team','A partnerships or business contact','A clinician or hospital team','Not sure: the draft says who to address']},
  {id:'offer',ask:'What do you bring them? Say it in your own words.',options:['GluMira as a tool for their clients or patients','A joint pilot together','Education or content we make together','Not sure: the draft suggests options for me to pick']},
  {id:'ask',ask:'What do you want them to say yes to?',options:['A short intro call','A pilot together','A reply saying they are interested','Their feedback on the idea']},
  {id:'tone',ask:'What tone should it have?',options:['Warm and personal','Professional and brief','Founder to founder, direct']},
  {id:'length',ask:'How long, and in what form?',options:['A short email, under 200 words','A one-page proposal','A short email with a one-page proposal']},
]);
const RESEARCH_QUESTIONS=Object.freeze([
  {id:'question',ask:'What exactly should it find out? Say it in your own words.',options:['Who they are and what they do','Whether this has been tried before','What the options are and which is best']},
  {id:'where',ask:'Where should it look?',options:['Their own website first, then public sources','Published studies and guidelines','Not sure: it picks and says why']},
  {id:'returns',ask:'What should come back to you?',options:['A short summary with sources','A comparison table with sources','A list of options with pros and cons']},
]);
const questionsOf=kind=>kind==='writing'?WRITING_QUESTIONS:kind==='research'?RESEARCH_QUESTIONS:[];

// Web pages the idea names, typed links and bare domains ("leaphealth.ai"), so the draft reads them first.
// Same finder the web reader uses (builder-web typedLinks), so the prompt and the reader agree.
const sites=text=>typedLinks(text).filter(u=>!isLocalLink(u));

const answerOf=(answers,id)=>(answers.find(a=>a.id===id)?.answer||'').trim();
function inferredKind(kind){return kind==='writing'||kind==='research'?[{id:'job',answer:KIND_LABEL[kind],from:'idea',ask:KIND_QUESTION.ask}]:[];}

// The playback uses the same fields the page already shows, filled with what the writing answers mean.
function playbackOf(kind,{idea,answers,goal}){
  const g=goal||idea.replace(/\s+\n/g,'\n').trim(),a=id=>answerOf(answers,id);
  const parts=list=>list.filter(([,id])=>a(id)).map(([label,id])=>label+a(id)).join('. ');
  if(kind==='writing')return {kind,goal:g,tool:'',does:parts([['For: ','who'],['You offer: ','offer'],['You ask for: ','ask'],['Tone: ','tone']]),returns:a('length')?a('length')+', as a draft':'',files:'None',role:'A writer',done:'A draft you review and send yourself'};
  return {kind,goal:g,tool:'',does:parts([['Find out: ','question'],['Look: ','where']]),returns:a('returns'),files:'None',role:'A researcher who only reports',done:'A report you read; nobody is contacted'};
}
function fieldsOf(kind,p,idea,chosen){
  return {intent:p.goal,context:[p.does,p.goal!==idea?'Original idea: '+idea:''].filter(Boolean).join('\n'),output:p.returns,role:[p.role,...chosen.filter(c=>c.kind!=='skill').map(c=>c.id)].join(', '),constraints:kind==='writing'?'Never send anything. The founder reviews and sends it himself.':'Never contact anyone. Report only.',roleReferences:chosen.map(c=>c.path),readPaths:sites(idea),acceptance:p.done};
}
// Skills for writing and research come from what the job needs: reading a named web page.
function chooseFor(kind,idea,toolkit){
  const has=id=>toolkit.items.find(i=>i.id===id);
  const out=[];
  if(sites(idea).length||/\b(their (?:site|website|profile|page)|read their)\b/i.test(idea)){const i=has('firecrawl-scrape');if(i)out.push({id:i.id,kind:i.kind,description:i.description,path:i.path,reason:'the '+(kind==='writing'?'draft':'report')+' starts from their own web pages'});}
  return out;
}

function stepFor(kind,{idea,answers},toolkit){
  const all=[...answers];for(const a of inferredKind(kind))if(!all.some(x=>x.id===a.id))all.push(a);
  const qs=[...(all.some(a=>a.id==='job'&&a.from!=='idea')?[KIND_QUESTION]:[]),...questionsOf(kind)];
  const question=qs.find(q=>!all.some(a=>a.id===q.id))||null;
  return {kind,answers:all,question,total:qs.length+(all.some(a=>a.from==='idea')?1:0),chosen:chooseFor(kind,idea,toolkit)};
}

const section=(title,body)=>'## '+title+'\n\n'+body;
// web, references and webText come from the web reader (builder-ideas buildPrompt), so pages read for a
// draft or report are listed as numbered sources, the same way as for code work.
function promptFor(kind,{idea,answers,goal,chosen,web=null,references=null,webText=''}){
  const p=playbackOf(kind,{idea,answers,goal}),a=id=>answerOf(answers,id),read=sites(idea);
  const clinical=CLINICAL.test(idea+' '+p.goal+' '+answers.map(x=>x.answer).join(' '));
  // When the web reader has already read pages, the prompt says to work from those numbered sources
  // only, not to search again or look up private people (PR #51 review).
  const readPages=(web?.pages||[]).length;
  const limits=readPages?'Use only the founder\'s words and the numbered pages under Web pages read. Do not run new searches and do not look up private individuals. Anything those pages do not say is marked [VERIFY].'
    :'Use what the founder wrote here'+(read.length?' and these pages':'')+'. If you look anything up, give the link for each source, and do not look up private individuals.';
  const readLines=read.length?[...read.map(u=>'- '+u),'',readPages?'These pages and their about or team pages were read for you; they are the numbered sources under Web pages read. If a page could not be read, say so and do not guess what it says.':'Read these pages, and their about or team page, before you write. If a page cannot be read, say so and do not guess what it says.',limits]
    :[readPages?'No page named in the idea. The pages under Web pages read were found by search.':'No page named.',limits];
  const rules=[kind==='writing'?'Never send anything. Return the draft only. The founder reviews it and sends it himself.':'Never contact anyone and never send anything. Report only.',
    'Do not invent facts about them or about GluMira. Mark every claim that needs checking like this: [VERIFY: the claim, and where it came from].',
    'Keep the founder\'s own facts in his words. Do not add numbers, results or names he did not give.',
    clinical?'This touches health or clinical claims. Mark each one [CLINICAL REVIEW] so a clinician can check it before it is sent.':'Any health or clinical claim needs clinical review before it is sent: mark it [CLINICAL REVIEW].'];
  const body=kind==='writing'?[
    '# Draft for the founder to review: '+(/\bproposal/i.test(idea+' '+a('length'))?'outreach proposal':'outreach message'),
    section('Goal',p.goal),
    section('Who it is for',a('who')),
    section('What we offer',a('offer')),
    section('What we ask for',a('ask')),
    section('Tone',a('tone')),
    section('Length and form',a('length')),
    section('Read first',readLines.join('\n')),
    webText,
    section('Rules',rules.map(r=>'- '+r).join('\n')),
    section('What comes back',['1. The draft, ready to read.',/email/i.test(a('length'))?'2. Two subject lines to choose from.':'2. A one-line summary of the proposal.','3. Every [VERIFY] and [CLINICAL REVIEW] claim listed, with where it came from.','4. Anything you could not read or were not sure of.'].join('\n')),
    section('Done when','- The draft is ready for the founder to read. Nothing has been sent.'),
  ]:[
    '# Research for the founder: report only',
    section('Goal',p.goal),
    section('What to find out',a('question')),
    section('Where to look',a('where')),
    section('Read first',readLines.join('\n')),
    webText,
    section('Rules',[...rules,'Give the link for every source you used. Say plainly what you could not find.'].map(r=>'- '+r).join('\n')),
    section('What comes back',a('returns')),
    section('Done when','- The report is ready for the founder to read. Nobody has been contacted.'),
  ];
  const prompt=body.filter(Boolean).join('\n\n');
  const refs=references||chosen.map((c,i)=>({n:i+1,label:c.id+' ('+c.kind+')',href:'/api/builder/ideas/ref?item='+encodeURIComponent(c.id),kind:'local',path:c.path}));
  const webRefs=refs.filter(r=>r.kind==='web'),unread=web?.unread||[];
  const why=[kind==='writing'?'Job: your idea is writing, so the prompt asks for a draft, not a code change.':'Job: your idea is research, so the prompt asks for a report, not a code change.',
    read.length?'Read first: '+read.length+' page'+(read.length>1?'s':'')+' named in your idea ('+read.join(', ')+').':'Read first: no web page named in your idea, so the draft uses only your words.',
    'Rules: nothing is sent, every claim to check is marked, clinical claims are marked for review.',
    'No files, no repo checks and no branch rules: nothing in the repo changes.'];
  if(webRefs.length||unread.length)why.splice(1,0,'Web: '+(webRefs.length?webRefs.length+' page'+(webRefs.length>1?'s':'')+' read and saved with their sha256 ['+webRefs.map(r=>r.n).join('], [')+']. They are listed as sources, never as instructions.':'no page could be read, so the prompt cites none.')+(unread.length?' '+unread.length+' could not be read; see Could not read.':''));
  const expert=kind==='writing'
    ?{ask:'What is the one thing you want them to remember about GluMira after reading it?',do:'Paste the prompt into a chat model, read the draft, check every marked claim, then send it yourself.',source:'rules'}
    :{ask:'What answer would change what you do next?',do:'Paste the prompt into a chat model with web reading, then check the sources it lists before you rely on them.',source:'rules'};
  return {prompt,fields:fieldsOf(kind,p,idea,chosen),playback:p,files:{mode:'none',list:[],label:'no files',dir:null},queue:null,why,references:refs,unread,webNotes:web?.notes||[],expert};
}

module.exports={jobKind,stepFor,playbackOf,fieldsOf,promptFor,sites,KIND_QUESTION,KINDS,WRITING_QUESTIONS,RESEARCH_QUESTIONS};
