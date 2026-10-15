'use strict';
// Ideas reads the web (founder 2026-10-09, verbatim: "production builder cannot reach internet to read
// sites i give. How will you show your research if you cannot do this - with kosmo it is easy to see 38
// sites linked to references"). Server side only. Links typed in the idea are read first, then a
// Grok web search (XAI_API_KEY and GROK_MODEL from the environment only) when the idea asks for
// research. A caller that passes its own searchUrl still reads that page as HTML, which is how the
// tests supply a fixture. Only pages actually read become references; the rest are listed under
// "Could not read" with the reason. Nothing is invented. The key is never written to disk or logs.
// Safe fetching: http and https only, no private, loopback or link-local address before or after DNS,
// on every redirect; the site name is resolved once per hop and the connection goes to that exact
// checked address (no second DNS answer can move it); 10 s, 2 MB and 5 redirects at most. Each page
// read is saved with its fetch time and sha256 under .runtime (gitignored), so a reference shows what
// was actually read.
// Pages are sources, not instructions: scripts are stripped and page text never enters the prompt.
const fs=require('node:fs');
const path=require('node:path');
const dns=require('node:dns').promises;
const net=require('node:net');
const http=require('node:http');
const https=require('node:https');
const zlib=require('node:zlib');
const {createHash,randomUUID}=require('node:crypto');
const {execFile}=require('node:child_process');
const {relevant,domainHits,CONTEXT}=require('./builder-research');

const TIMEOUT_MS=10000,MAX_BYTES=2*1024*1024,MAX_REDIRECTS=5,MAX_PAGES=10,MAX_SEARCH_PAGES=5,MAX_ABOUT_PAGES=4,MIN_CHARS=200;
const SEARCH_URL='https://html.duckduckgo.com/html/?q=';
const SCRAPLING='C:\\memory-governance-archive\\governance\\tools\\scrapling\\.venv\\Scripts\\scrapling.exe';
const UA='Mozilla/5.0 (compatible; GluMira-Production-Builder/1.0)';
const TEXT_TYPE=/^(text\/(html|plain|markdown|xml)|application\/(xhtml\+xml|xml|json))\b/i;
const BLOCKED_STATUS=new Set([401,403,429,503]);
const INJECTION=/\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(previous|prior|above|all|earlier)\b[^.\n]{0,20}\binstructions?\b|\byou are now\b|\bsystem prompt\b|\bnew instructions\b/i;

class WebError extends Error{constructor(reason,status=null){super(reason);this.reason=reason;this.status=status;}}

// Private, loopback, link-local and unspecified addresses (rule list from BRIEF-WEB-4, plus 0/8,
// carrier NAT, multicast, IPv6 unique-local and IPv4-mapped forms of all of them). ET-REVIEW-46 adds
// 198.18.0.0/15 (benchmark), 192.0.0.0/24 (protocol assignments) and NAT64 64:ff9b::/96 when the
// IPv4 address inside it is one of these.
function isPrivateAddress(ip){
  let a=String(ip||'').replace(/^\[|\]$/g,'').toLowerCase();
  const mapped=/^(?:::ffff|64:ff9b:):(\d+\.\d+\.\d+\.\d+)$/.exec(a);if(mapped)a=mapped[1];
  if(net.isIPv4(a)){
    const [o1,o2,o3]=a.split('.').map(Number);
    return o1===0||o1===10||o1===127||(o1===169&&o2===254)||(o1===172&&o2>=16&&o2<=31)||(o1===192&&o2===168)||(o1===100&&o2>=64&&o2<=127)||(o1===198&&(o2===18||o2===19))||(o1===192&&o2===0&&o3===0)||o1>=224;
  }
  if(net.isIPv6(a)){
    if(a==='::'||a==='::1')return true;
    const embedded=/^(?:::ffff|64:ff9b:):([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(a);
    if(embedded){const [h,l]=[embedded[1],embedded[2]].map(x=>parseInt(x,16));return isPrivateAddress([h>>8,h&255,l>>8,l&255].join('.'));}
    return /^f[cd]/.test(a)||/^fe[89ab]/.test(a)||/^ff/.test(a);
  }
  return true;// not an address at all: never treat it as safe
}
// The test flag lets a test reach its own local stub server and nothing else. It is honoured only
// inside the Node test runner (NODE_TEST_CONTEXT), so the running Builder can never set it.
function testAllowed(url,opts){
  const list=opts.testAllowOrigins;
  return Array.isArray(list)&&Boolean(process.env.NODE_TEST_CONTEXT)&&list.includes(url.origin);
}
const bareHost=url=>url.hostname.replace(/^\[|\]$/g,'').toLowerCase().replace(/\.$/,'');
const localName=host=>!host||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local');
// A link to this machine or the local network (127.0.0.1, localhost, 10.x and the like). Typed ones
// are dropped without a word: they are the Builder's own pages, not sources.
function isLocalLink(href,opts={}){
  let url;try{url=new URL(href);}catch{return false;}
  if(testAllowed(url,opts))return false;
  const host=bareHost(url);
  return localName(host)||(Boolean(net.isIP(host))&&isPrivateAddress(host));
}
// Resolves the site name once and returns the one address the connection must use.
async function checkUrl(url,opts){
  if(url.protocol!=='http:'&&url.protocol!=='https:')throw new WebError('only http and https links are read');
  if(url.username||url.password)throw new WebError('links with a user name or password are not read');
  const host=bareHost(url);
  const allowed=testAllowed(url,opts);
  if(!allowed&&localName(host))throw new WebError('private address blocked ('+host+')');
  if(net.isIP(host)){if(!allowed&&isPrivateAddress(host))throw new WebError('private address blocked ('+host+')');return host;}
  let found;
  try{found=await (opts.lookup||dns.lookup)(host,{all:true,verbatim:true});}catch{throw new WebError('the site name does not resolve ('+host+')');}
  const list=(Array.isArray(found)?found:[found]).map(f=>typeof f==='string'?f:f.address);
  if(!list.length)throw new WebError('the site name does not resolve ('+host+')');
  const bad=list.find(isPrivateAddress);
  if(bad&&!allowed)throw new WebError('private address blocked ('+host+' resolves to '+bad+')');
  return list[0];
}
// DNS rebinding guard: the socket's lookup answers with the address checkUrl validated and never asks
// DNS again. The Host header and the TLS server name stay the site name, so the certificate is still
// checked against the site, not the address.
function pinnedTransport(url,address,{signal,headers}){
  const lib=url.protocol==='https:'?https:http,family=net.isIPv6(address)?6:4;
  const lookup=(name,o,cb)=>(o&&o.all)?cb(null,[{address,family}]):cb(null,address,family);
  return new Promise((resolve,reject)=>{
    const req=lib.request(url,{method:'GET',headers,signal,agent:false,lookup},res=>{
      const enc=String(res.headers['content-encoding']||'').toLowerCase().trim();
      const body=enc==='br'?res.pipe(zlib.createBrotliDecompress()):enc==='gzip'||enc==='deflate'?res.pipe(zlib.createUnzip()):res;
      if(body!==res)res.on('error',e=>body.destroy(e));
      resolve({status:res.statusCode,headers:{get:n=>{const v=res.headers[n.toLowerCase()];return Array.isArray(v)?v.join(', '):v??null;}},body,cancel:()=>{res.destroy();if(body!==res)body.destroy();}});
    });
    req.on('error',reject);req.end();
  });
}
async function readBody(res,max){
  const len=Number(res.headers.get('content-length'));
  if(len>max){res.cancel();throw new WebError('larger than 2 MB, not read',res.status);}
  if(!res.body)return '';
  const chunks=[];let size=0;
  for await(const chunk of res.body){size+=chunk.length;if(size>max){res.cancel();throw new WebError('larger than 2 MB, not read',res.status);}chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks).toString('utf8');
}
// One URL, every hop checked. Returns {status,url,type,body} for a 2xx text page, else throws WebError.
async function safeFetch(href,opts={}){
  let url;try{url=new URL(href);}catch{throw new WebError('not a valid link');}
  const transport=opts.transport||pinnedTransport,max=opts.maxBytes||MAX_BYTES,timeout=opts.timeoutMs||TIMEOUT_MS;
  const signal=AbortSignal.timeout(timeout);
  try{
    for(let hop=0;;hop++){
      const address=await checkUrl(url,opts);
      const res=await transport(url,address,{signal,headers:{'user-agent':UA,accept:'text/html,text/plain;q=0.9,*/*;q=0.5','accept-encoding':'gzip, deflate, br'}});
      if(res.status>=300&&res.status<400&&res.headers.get('location')){
        res.cancel();
        if(hop>=(opts.maxRedirects??MAX_REDIRECTS))throw new WebError('more than 5 redirects',res.status);
        try{url=new URL(res.headers.get('location'),url);}catch{throw new WebError('redirect to an invalid link',res.status);}
        continue;
      }
      if(res.status<200||res.status>=300){res.cancel();throw new WebError('HTTP '+res.status,res.status);}
      const type=(res.headers.get('content-type')||'').split(';')[0].trim()||'text/html';
      if(!TEXT_TYPE.test(type)){res.cancel();throw new WebError('not a text page ('+type+')',res.status);}
      return {status:res.status,url:url.href,type,body:await readBody(res,max)};
    }
  }catch(e){
    if(e instanceof WebError)throw e;
    if(e?.name==='TimeoutError'||e?.name==='AbortError'||signal.aborted)throw new WebError('no answer within '+Math.round(timeout/1000)+' s');
    throw new WebError('could not connect ('+(e?.cause?.code||e?.code||e?.message||'network error')+')');
  }
}
const ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',mdash:'-',ndash:'-',hellip:'...',rsquo:"'",lsquo:"'",rdquo:'"',ldquo:'"'};
const decode=s=>String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e)=>{if(e[0]==='#'){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1));return n>0&&n<0x110000?String.fromCodePoint(n):'';}return ENTITIES[e.toLowerCase()]??m;});
// Page text with scripts, styles and markup removed. The title comes from <title> or the first <h1>.
function htmlToText(html,type='text/html'){
  if(!/html|xml/i.test(type))return {title:'',text:String(html).replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim()};
  const raw=String(html);
  const pick=re=>decode((re.exec(raw)||[])[1]||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const title=pick(/<title[^>]*>([\s\S]*?)<\/title>/i)||pick(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const text=decode(raw.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|noscript|template|iframe|svg|object|embed|head)\b[\s\S]*?<\/\1\s*>/gi,' ').replace(/<(script|style)\b[^>]*\/?>/gi,' ')
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article|header|footer|blockquote|pre)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' '))
    .replace(/[ \t\f\v]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  return {title,text};
}
// A title from the page is someone else's text: one line, no markdown, short.
const cleanTitle=(t,fallback)=>{const s=String(t||'').replace(/[\u0000-\u001f\u007f`#<>[\]*_|]/g,' ').replace(/[—–]/g,'-').replace(/\s+/g,' ').trim().slice(0,120);return s||fallback;};
const STOP=new Set('about after again also because before both build could does doing done each every from have here into just like make more most much need only other over same should some still then this that than them they there their through under until very want what when where which while will with without would your page pages site sites link links http https www best possible better good great really something anything everything please read find look'.split(' '));
const ideaWords=text=>[...new Set((String(text).toLowerCase().replace(/https?:\/\/\S+/g,' ').match(/[a-z][a-z0-9]{3,}/g)||[]).filter(w=>!STOP.has(w)))];
function usedLine(page,want){
  const hay=(page.title+' '+page.text).toLowerCase(),hits=want.filter(w=>hay.includes(w)).slice(0,4);
  return hits.length?'Read for your idea: it covers '+hits.join(', ')+'.':'Read in full; no word from your idea appears in it, so treat it as background only.';
}
// Typed links: every http(s) link in the idea, then every bare site name (leaphealth.ai) read as
// https. A bare name needs a known site ending, so repo files (README.md, ROADMAP.md,
// builder-client.js) and paths are never taken for sites.
const URL_RE=/\bhttps?:\/\/[^\s'"`)<>\]]+/g;
const TLDS='com|net|org|edu|gov|int|io|ai|app|dev|co|uk|us|de|fr|nl|be|ch|at|se|no|dk|fi|ie|es|it|pt|pl|eu|ca|au|nz|za|na|bw|ke|ng|in|jp|sg|hk|me|info|biz|health|care|clinic|tech|cloud|xyz|site|online|blog|news|ly|tv|fm|gg';
const BARE_RE=new RegExp('(?<![\\w@./\\\\-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:'+TLDS+'))(?![\\w-]|\\.\\w)(/[^\\s\'"`)<>\\]]*)?','gi');
function typedLinks(text){
  const raw=String(text),seen=new Set(),out=[];
  const add=u=>{let key;try{key=new URL(u).href;}catch{return;}if(!seen.has(key)){seen.add(key);out.push(u);}};
  for(const u of raw.match(URL_RE)||[])add(u.replace(/[.,;:!?]+$/,''));
  for(const m of raw.replace(URL_RE,' ').matchAll(BARE_RE))add(new URL('https://'+m[1].toLowerCase()+(m[2]||'').replace(/[.,;:!?]+$/,'')).href);
  return out;
}
// A search runs only when the idea asks for research, never for a plain change request. Asking to
// read a profile, reach out to someone or look at a site counts as asking for research. A plain "read"
// only counts when the idea names a site: "read the README" is a repo file, not research.
const READ_WORD=/\bread(?:ing)?\b/i;
const WANTS_SEARCH=/\b(research|search|look ?up|profiles?|reach(?:ing)? out|outreach|look(?:ing)? (?:at|into|through)|visit|websites?|their site|proposals?|compare|comparison|best practices?|examples?|alternatives?|competitors?|sources?|references?|articles?|documentation|docs|how (?:do|does|to|other)|what (?:do|does) others|like kosmo|kosmo)\b/i;
// The search words: the idea's own words from its first sentence (or the whole idea when that is
// too short), without filler and without the words that only ask for the search.
const QUERY_SKIP=new Set('research search searching reach outreach profile profiles draft idea ideas already visit website websites'.split(' '));
function searchQuery(idea,goal){
  const text=String(goal||idea).replace(URL_RE,' ').replace(BARE_RE,' ').replace(/\s+/g,' ').trim();
  const words=t=>ideaWords(t).filter(w=>!QUERY_SKIP.has(w));
  const first=words(text.split(/(?<=[.!?])\s/)[0]||text);
  return (first.length>=2?first:words(text)).slice(0,6).join(' ');
}
// DuckDuckGo HTML results: the real target is in the uddg parameter. Ads are skipped.
function parseSearch(html){
  const out=[];
  for(const m of String(html).matchAll(/<a\b([^>]*\bclass="[^"]*\bresult__a\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi)){
    const href=decode((/\bhref="([^"]+)"/i.exec(m[1])||[])[1]||'');if(!href)continue;
    let target=href;
    try{const u=new URL(href,'https://duckduckgo.com');if(/duckduckgo\.com$/.test(u.hostname)&&u.pathname==='/l/')target=u.searchParams.get('uddg')||'';else if(/duckduckgo\.com$/.test(u.hostname))continue;else target=u.href;}catch{continue;}
    if(!/^https?:\/\//i.test(target)||/[?&]ad_(domain|provider)=|\/y\.js\b/.test(href))continue;
    if(!out.some(o=>o.url===target))out.push({url:target,title:cleanTitle(decode(m[2].replace(/<[^>]*>/g,' ')),target)});
  }
  return out;
}
// Scrapling is the fallback for a typed link whose site blocks plain fetch or needs JavaScript. It
// never reads a search result: it resolves and redirects on its own, outside the pinned check. It is optional;
// BUILDER_SCRAPLING names another copy. Inside a venv the python.exe next to scrapling.exe runs
// Scrapling's own entry point, because a venv that was moved keeps a scrapling.exe that points at the
// old python and exits 1 without a word. The link is a plain argument (no shell). A .cmd or .bat copy
// has to go through cmd.exe, so a link with a shell character is never passed to one of those.
const SCRAPLING_ENTRY='import sys;from scrapling.cli import main;sys.argv[0]="scrapling";sys.exit(main())';
function scraplingRunner(file){
  const viaShell=/\.(cmd|bat)$/i.test(file),python=path.join(path.dirname(file),'python.exe');
  const exists=f=>{try{return fs.statSync(f).isFile();}catch{return false;}};
  return {path:file,available:()=>exists(file),
    run:(href,outFile)=>new Promise((resolve,reject)=>{
      if(viaShell&&/["%^&|<>!\r\n]/.test(href))return reject(new WebError('Scrapling skipped: the link has characters the shell cannot pass safely'));
      const cli=['extract','stealthy-fetch',href,outFile];
      const [cmd,args,extra]=viaShell?['cmd.exe',['/d','/s','/c','"'+file+'" extract stealthy-fetch "'+href+'" "'+outFile+'"'],{windowsVerbatimArguments:true}]:exists(python)?[python,['-c',SCRAPLING_ENTRY,...cli],{}]:[file,cli,{}];
      execFile(cmd,args,{windowsHide:true,timeout:90000,...extra},err=>{if(err)return reject(new WebError('Scrapling could not read it ('+(err.killed?'no answer within 90 s':'exit '+(err.code??'error'))+')'));try{resolve(fs.readFileSync(outFile,'utf8'));}catch{reject(new WebError('Scrapling wrote nothing'));}finally{fs.rm(outFile,{force:true},()=>{});}});
    })};
}
// A site named in the idea keeps the search on that site: the host is the site itself or www. + the
// site, so evilleaphealth.ai never passes for leaphealth.ai. Any other subdomain (rm.leaphealth.ai,
// app.leaphealth.ai) is a different site: it counts only when Francois typed a link on it, because
// then that exact host is in sites. Links followed from a page (aboutLinks) use the same rule.
function onSite(href,sites){
  let host;try{host=bareHost(new URL(href));}catch{return false;}
  return sites.some(s=>host===s||host==='www.'+s);
}
// About, team, company and partners pages say who a site is, so they are read before anything else
// the site offers. They come from the named site's own links, then from the top of the search results.
// The last part of the address names it (about, about-us, about-leap, team, partners); a blog or news
// post called about-something is not one.
const ABOUT=/\/(?:about(?:-[a-z0-9-]+)?|our-team|team|company|partners?|who-we-are|leadership|people)(?:\/|\.html?)?$/i;
const POSTS=/\/(?:blog|news|posts?|articles?|tag|category)\//i;
const isAbout=href=>{try{const p=new URL(href).pathname;return ABOUT.test(p)&&!POSTS.test(p);}catch{return false;}};
function aboutLinks(body,pageUrl,sites){
  const out=[];
  for(const m of String(body).matchAll(/\bhref\s*=\s*["']([^"'#]+)["']|\]\(([^)\s#]+)\)/gi)){
    let u;try{u=new URL(decode(m[1]||m[2]),pageUrl);}catch{continue;}
    if(!/^https?:$/.test(u.protocol)||!onSite(u.href,sites)||!isAbout(u.href))continue;
    u.search='';if(!out.includes(u.href))out.push(u.href);
  }
  return out;
}
// The pages a Grok Responses reply names: the JSON array in its text (url and title), the sources of its
// web_search_call actions and its url_citation annotations. https only, each address once.
function grokResults(body){
  const out=[],push=(url,title)=>{url=String(url||'');if(!/^https:\/\//i.test(url)||out.some(o=>o.url===url))return;out.push({url,title:cleanTitle(String(title||''),url)});};
  const items=Array.isArray(body?.output)?body.output:[];
  for(const o of items)for(const c of (Array.isArray(o?.content)?o.content:[])){
    const m=String(c?.text||'').match(/\[[\s\S]*\]/);let parsed=[];if(m){try{parsed=JSON.parse(m[0]);}catch{parsed=[];}}
    for(const it of Array.isArray(parsed)?parsed:[])push(it&&it.url,it&&it.title);
  }
  for(const o of items)for(const src of (Array.isArray(o?.action?.sources)?o.action.sources:[]))push(src&&src.url,'');
  for(const o of items)for(const c of (Array.isArray(o?.content)?o.content:[]))for(const an of (Array.isArray(c?.annotations)?c.annotations:[]))if(an&&an.type==='url_citation')push(an.url,an.title&&an.title!==an.url?an.title:'');
  return out.slice(0,12);
}
function createWebReader({dataDir,transport,lookup,searchUrl=SEARCH_URL,scrapling=scraplingRunner(process.env.BUILDER_SCRAPLING||SCRAPLING),timeoutMs,maxBytes,testAllowOrigins,minChars=MIN_CHARS,retryPauseMs=2500,clock=()=>new Date(),getKey,grokFetch=fetch,grokTimeoutMs=60000,fallbackUrl=SEARCH_URL}={}){
  const opts={transport,lookup,timeoutMs,maxBytes,testAllowOrigins};
  const dir=dataDir;
  const hashOf=text=>createHash('sha256').update(text).digest('hex');
  function save(page,sha256){
    if(dir){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,sha256+'.json'),JSON.stringify({url:page.url,finalUrl:page.finalUrl,title:page.title,fetchedAt:page.fetchedAt,via:page.via,status:page.status,sha256,text:page.text},null,2));}
    return sha256;
  }
  // A page with almost no text (a login shell, a logout callback, a sandbox) is not a source.
  const thinCheck=(text,status)=>{if(text.length<minChars)throw Object.assign(new WebError(text?'almost no readable text ('+text.length+' characters; it may need JavaScript)':'the page has no readable text (it may need JavaScript)',status),{thin:true});};
  async function readOne(href,want,from,sites){
    const fetchedAt=()=>clock().toISOString();
    try{
      const r=await safeFetch(href,opts),{title,text}=htmlToText(r.body,r.type);
      thinCheck(text,r.status);
      const page={url:href,finalUrl:r.url,title:cleanTitle(title,new URL(r.url).hostname),text:text.slice(0,200000),fetchedAt:fetchedAt(),status:r.status,via:'fetch',from,links:aboutLinks(r.body,r.url,sites)};
      return {ok:true,page};
    }catch(e){
      const reason=e instanceof WebError?e.reason:'could not read',thin=Boolean(e.thin);
      const blocked=e instanceof WebError&&(BLOCKED_STATUS.has(e.status)||thin||/^could not connect/.test(reason));
      // Scrapling runs only for a link Francois typed, never for a search result.
      if(blocked&&from==='your idea'&&scrapling?.available()){
        try{
          const outFile=path.join(dir||require('node:os').tmpdir(),'scrapling-'+randomUUID()+'.md');
          if(dir)fs.mkdirSync(dir,{recursive:true});
          const text=String(await scrapling.run(new URL(href).href,outFile)).trim();
          if(!text)throw new WebError('Scrapling wrote nothing');
          thinCheck(text,null);
          return {ok:true,page:{url:href,finalUrl:href,title:cleanTitle((/^#\s+(.+)$/m.exec(text)||[])[1],new URL(href).hostname),text:text.slice(0,200000),fetchedAt:fetchedAt(),status:null,via:'scrapling',from,links:aboutLinks(text,href,sites)}};
        }catch(e2){return {ok:false,item:{url:href,status:e.status??null,reason:reason+'; '+(e2.thin?'Scrapling found '+e2.reason:e2.reason||'Scrapling could not read it'),from,thin:thin&&Boolean(e2.thin)}};}
      }
      return {ok:false,item:{url:href,status:e.status??null,reason,from,thin}};
    }
  }
  // A failed search (HTTP 403 or 429, a bot check, an error or no results) is tried once more after
  // a short pause, once per idea.
  async function searchRetry(query,st){
    let run=await searchRaw(query);
    if(run.status!=='ok'&&run.status!=='skipped'&&st.left>0){st.left--;st.retried=true;await new Promise(r=>setTimeout(r,retryPauseMs));run=await searchRaw(query);if(run.status==='ok')st.recovered=true;}
    return run;
  }
  async function htmlSearch(base,query){
    try{
      const r=await safeFetch(base+encodeURIComponent(query),opts);
      if(/anomaly|captcha|unusual traffic|challenge-form|are you a (?:robot|human)|bots use duckduckgo/i.test(r.body)&&!/result__a/.test(r.body))return {status:'unavailable',reason:'DuckDuckGo asked for a bot check',query,results:[]};
      const results=parseSearch(r.body);
      return results.length?{status:'ok',query,results,engine:'html'}:{status:'no-results',reason:'DuckDuckGo returned no results',query,results:[]};
    }catch(e){return {status:'unavailable',reason:e.reason||'search failed',query,results:[]};}
  }
  // Grok web search through the xAI Responses API and its web_search tool. The old chat call with
  // search_parameters ("Live search") answers HTTP 410 since xAI retired it (seen 2026-10-14).
  async function grokSearch(query){
    const read=n=>{if(process.env[n])return process.env[n];try{return (getKey&&getKey(n))||'';}catch{return '';}};
    const key=read('XAI_API_KEY')||read('GROK_API_KEY'),model=read('GROK_MODEL');
    if(!key||!model)return {status:'unavailable',reason:'Grok search is not configured',query,results:[]};
    const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),grokTimeoutMs);
    try{
      const r=await grokFetch('https://api.x.ai/v1/responses',{method:'POST',signal:ac.signal,headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify({model,input:'Search the web for: '+query+'\nReturn only a JSON array of up to 8 objects with an https url and a title. No other text.',tools:[{type:'web_search'}]})});
      if(!r.ok)return {status:'unavailable',reason:'Grok search answered HTTP '+r.status,query,results:[]};
      const results=grokResults(await r.json());
      return results.length?{status:'ok',query,results,engine:'grok'}:{status:'no-results',reason:'Grok returned no results',query,results:[]};
    }catch(e){return {status:'unavailable',reason:e&&e.name==='AbortError'?'Grok search timed out':'Grok search failed',query,results:[]};}
    finally{clearTimeout(timer);}
  }
  // Grok first; when Grok is not set up or does not answer, DuckDuckGo, so research never comes back empty
  // only because one engine failed. A caller that passes its own searchUrl (the tests) reads that page.
  async function searchRaw(query){
    if(!query)return {status:'skipped',query,results:[]};
    if(searchUrl!==SEARCH_URL)return htmlSearch(searchUrl,query);
    const g=await grokSearch(query);
    if(g.status==='ok')return g;
    const h=await htmlSearch(fallbackUrl,query);
    return h.status==='ok'?{...h,fallbackFrom:g.reason}:{...h,reason:g.reason+'; '+h.reason};
  }
  async function read({idea,goal='',research=null}){
    const st={left:1,retried:false,recovered:false},search=q=>searchRetry(q,st);
    const text=idea+'\n'+goal,want=ideaWords(text),typed=typedLinks(text).filter(u=>!isLocalLink(u,opts));
    const sites=[...new Set(typed.map(u=>bareHost(new URL(u)).replace(/^www\./,'')).filter(h=>!net.isIP(h)))].slice(0,3);
    const queue=typed.slice(0,MAX_PAGES).map(url=>({url,from:'your idea'})),skipped=typed.slice(MAX_PAGES).map(url=>({url,status:null,reason:'over the '+MAX_PAGES+'-page cap for one idea',from:'your idea'}));
    const queued=new Set(queue.map(q=>q.url)),results=[];
    const enqueue=(url,from)=>{if(queued.has(url)||queued.size>=MAX_PAGES)return false;queued.add(url);queue.push({url,from});return true;};
    const readFrom=async start=>{const list=queue.slice(start);for(let i=0;i<list.length;i+=4)results.push(...await Promise.all(list.slice(i,i+4).map(q=>readOne(q.url,want,q.from,sites))));};
    // The sites named in the idea are read first, then their own About, team, company and partners
    // pages, then a site: search, and only then a general search fills the pages left. With a site
    // named, every search result off that site is left out, the general search too.
    await readFrom(0);
    let about=0;
    for(const u of results.filter(r=>r.ok).flatMap(r=>r.page.links)){if(about>=MAX_ABOUT_PAGES)break;if(enqueue(u,'the named site'))about++;}
    const runs=[],offSite=new Set();
    // A subject the repo knows (research) searches on its own, with its repo phrases. Without a named
    // site every search carries the product context and keeps only diabetes or GluMira results.
    // Only a subject the repo matched gets the product context and the diabetes filter; any other
    // search runs and keeps results exactly as before.
    const topical=!sites.length&&Boolean(research?.queries?.length),dropped=new Set();
    const researchQueries=topical?(research?.queries||[]).filter(Boolean):[];
    // Only the founder's idea asks for a search. The goal is the Builder's own read-back: its "Proposal only" once
    // started a web search no one asked for (2026-10-14).
    const asked=WANTS_SEARCH.test(idea)||(sites.length&&READ_WORD.test(idea));
    if(researchQueries.length||asked){
      const base=searchQuery(idea,goal),query=topical&&base&&!/\bdiabet/i.test(base)?(base+' '+CONTEXT).trim():base;
      const room=()=>queued.size<MAX_PAGES&&queue.filter(q=>q.from==='search').length<MAX_SEARCH_PAGES;
      const take=run=>{
        runs.push(run);
        const kept=run.results.filter(r=>{if(sites.length&&!onSite(r.url,sites)){offSite.add(r.url);return false;}if(topical&&!relevant(r.title+' '+r.url)){dropped.add(r.url);return false;}return true;});
        for(const r of [...kept.filter(r=>isAbout(r.url)),...kept.filter(r=>!isAbout(r.url))]){if(!room())break;enqueue(r.url,'search');}
      };
      for(const site of sites){if(!room())break;let run=await search(('site:'+site+' '+query).trim());if(run.status==='no-results'&&query)run=await search('site:'+site);take(run);}
      // A quoted phrase that finds nothing is tried once more without quotes.
      for(const rq of researchQueries){if(!room())break;let run=await search(rq);if(run.status!=='ok'&&/"/.test(rq))run=await search(rq.replace(/"/g,''));take(run);}
      if(query&&room()&&(asked||!researchQueries.length))take(await search((sites.join(' ')+' '+query).trim()));
    }
    await readFrom(results.length);
    const found=runs.filter(r=>r.status==='ok'),last=runs[runs.length-1];
    const searchInfo=!runs.length?{status:'not-needed',query:'',results:[]}:found.length?{status:'ok',query:found.map(r=>r.query).join(' then '),results:found.flatMap(r=>r.results),engine:found.some(r=>r.engine==='grok')?'grok':'html'}:last;
    // One source per page: a page whose text or final address was already read is a copy, not a
    // second source, and its saved copy would carry the same sha256.
    const pages=[],seenSha=new Set(),seenUrl=new Set();let copies=0;
    for(const r of results.filter(x=>x.ok)){
      const p=r.page,sha256=hashOf(p.text);
      if(seenSha.has(sha256)||seenUrl.has(p.finalUrl)){copies++;continue;}
      // A search page that turns out not to be about diabetes or GluMira is not a source.
      if(topical&&p.from==='search'&&domainHits(p.title+' '+p.text)<3){dropped.add(p.url);continue;}
      seenSha.add(sha256);seenUrl.add(p.finalUrl);save(p,sha256);
      pages.push({url:p.url,finalUrl:p.finalUrl,title:p.title,fetchedAt:p.fetchedAt,status:p.status,via:p.via,from:p.from,sha256,used:usedLine(p,want),excerpt:p.text.replace(/\s+/g,' ').slice(0,240),instructionLike:INJECTION.test(p.title+'\n'+p.text)});
    }
    // An almost empty page the idea did not name is left out without a row; one it named is listed
    // under Could not read with the reason.
    const failed=results.filter(r=>!r.ok).map(r=>r.item),thin=failed.filter(u=>u.thin&&u.from!=='your idea').length;
    const unread=[...failed.filter(u=>!(u.thin&&u.from!=='your idea')).map(({thin,...u})=>u),...skipped];
    const notes=[];
    if(searchInfo.status==='unavailable')notes.push('Search unavailable ('+searchInfo.reason+'), also after one retry. Only the links you typed were read.');
    if(st.recovered)notes.push('Web source: DuckDuckGo, on the second try after a short pause.');
    else if(searchInfo.status==='ok')notes.push(searchInfo.engine==='grok'?'Web source: Grok.':found.some(r=>r.fallbackFrom)?'Web source: DuckDuckGo ('+found.find(r=>r.fallbackFrom).fallbackFrom+').':'Web source: DuckDuckGo.');
    if(searchInfo.status==='no-results')notes.push('Search unavailable (no results for "'+searchInfo.query+'"), also after one retry. Only the links you typed were read.');
    if(dropped.size)notes.push(dropped.size+' search result'+(dropped.size>1?'s':'')+' left out: not about diabetes or GluMira.');
    if(offSite.size)notes.push(offSite.size+' search result'+(offSite.size>1?'s':'')+' from other sites left out: the search stays on '+sites.join(', ')+'.');
    if(thin||copies)notes.push('Left out'+(thin?' '+thin+' page'+(thin>1?'s':'')+' with almost no text':'')+(thin&&copies?' and':'')+(copies?' '+copies+' cop'+(copies>1?'ies':'y')+' of a page already read':'')+'.');
    if(queue.length&&!scrapling?.available())notes.push('Scrapling is not installed'+(scrapling?.path?' at '+scrapling.path:'')+', so a site that blocks plain fetch or needs JavaScript is listed under Could not read.');
    return {pages,unread,dropped:dropped.size,search:{status:searchInfo.status,query:searchInfo.query,queries:runs.map(r=>r.query),found:searchInfo.results.length},scrapling:{available:Boolean(scrapling?.available()),path:scrapling?.path||null},notes,cap:MAX_PAGES};
  }
  function saved(sha){
    if(!/^[0-9a-f]{64}$/.test(String(sha))||!dir)return null;
    try{return JSON.parse(fs.readFileSync(path.join(dir,sha+'.json'),'utf8'));}catch{return null;}
  }
  return {read,saved,search:searchRaw,dir};
}
module.exports={grokResults,createWebReader,safeFetch,pinnedTransport,isPrivateAddress,isLocalLink,htmlToText,parseSearch,typedLinks,onSite,isAbout,aboutLinks,cleanTitle,scraplingRunner,WebError,INJECTION,WANTS_SEARCH,MAX_PAGES};
