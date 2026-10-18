// Page logic. Each tab is one colour with its own state. Light is the paint. Shadow is the same paint with Lemon
// replaced by Ochre, plus drops, and is never lighter than its light. The gradient is the light with a narrow
// shadow band blended in; gloss is a brighter colour of the same family laid over it from the top right.
const $=id=>document.getElementById(id);
const IDS=PIGMENTS.map(p=>p.id), DROPS=['C','A','O','K'];
const SHORT={C:'Cobalt',A:'Alizarin',O:'Ochre',L:'Lemon',W:'White',K:'Black'};
const z=()=>({C:0,A:0,O:0,L:0,W:0,K:0});
const G0={feather:6,yellow:0,brightness:0,body:10,bright:0,hl:40,band:26,width:26,strength:70,gloss:50};
// Starting recipes were mixed by the matcher toward each locked hex.
const TABS=[
  {key:'gold',name:'Gold',fam:'gold',target:'#E6CD32',light:{C:0.032,O:0.977,L:8.791,W:0.2},drops:{C:2,A:6},depth:60},
  {key:'goldtext',name:'Gold text',fam:'gold',target:'#C9A24B',light:{C:0.088,O:9.131,W:0.781},drops:{C:2,A:6},depth:60},
  {key:'navy',name:'Navy',fam:'blue',target:'#102347',light:{C:8.066,A:1.934},drops:{O:3},depth:0},
  {key:'lnavy',name:'Light navy',fam:'blue',target:'#647087',light:{C:6.791,O:0.478,W:2.616,K:0.115},drops:{O:3},depth:40},
  {key:'bone',name:'Bone',fam:'neutral',target:'#F7F6F1',light:{C:0.018,A:0.015,O:0.04,W:9.926},drops:{C:0.5,A:0.3,O:3},depth:0},
  {key:'blue',name:'Blue group',fam:'blue',target:'#B5C4D0',light:{C:2.295,O:0.761,W:6.944},drops:{O:3},depth:40},
  {key:'green',name:'Green group',fam:'green',target:'#C4D0BF',light:{C:1.178,O:1.68,W:7.143},drops:{A:2},depth:30},
  {key:'sapphire',name:'Sapphire sheen',fam:'blue',target:'#1160F0',light:{C:9.755,W:0.245},drops:{O:3},depth:0,form:'sheen'},
  {key:'gsheen',name:'Green sheen',fam:'green',target:'#738B6E',light:{C:3.58,O:5.032,W:1.388},drops:{A:2},depth:20,form:'sheen'}];
const TAB={};TABS.forEach(t=>TAB[t.key]=t);
const start=k=>{const t=TAB[k];return {light:{...z(),...t.light},drops:{C:0,A:0,O:0,K:0,...t.drops},depth:t.depth,...G0}};
const TS={};TABS.forEach(t=>TS[t.key]=start(t.key));
let cur='gold',ctab='light',view='kit';
const lemonOk=k=>TAB[k].fam==='gold';

// Sliders are squared so the first part of the travel gives the tiny amounts a drop needs.
const sq=(max,v)=>max*(v/1000)**2, isq=(max,x)=>Math.round(1000*Math.sqrt(Math.max(0,x)/max));
const fmt=x=>x>=1?x.toFixed(1):x>=0.1?x.toFixed(2):x>0?x.toFixed(3):'0';
const pct=x=>(x>=10?Math.round(x):x>=1?x.toFixed(1):x>0?x.toFixed(2):'0')+'%';
const sgn=x=>(x>0?'+':'')+x;
const rgba=(h,a)=>{const [r,g,b]=hexRgb(h);return `rgba(${r},${g},${b},${+a.toFixed(3)})`};
const smooth=t=>t*t*(3-2*t);
const lumH=h=>lum(hexRgb(h));

// The pigment that brightens this colour inside its own family.
function brightener(k,L){const f=TAB[k].fam;if(f==='gold')return 'L';if(f==='neutral')return 'W';if(lumH(mixHex(L))>0.4)return 'W';return f==='green'?'O':'C'}
function glossPigment(k){const f=TAB[k].fam;return f==='gold'?'L':f==='neutral'?'W':f==='green'?'O':'C'}

function compute(k){
  const s=TS[k],T=total(s.light)||1;
  const L={...z(),...s.light};
  if(lemonOk(k)){if(s.yellow>0)L.L+=s.yellow/100*T;else if(s.yellow<0)L.O+=(-s.yellow)/100*T}
  if(s.brightness>0)L.W+=s.brightness/100*T;else if(s.brightness<0)L.W*=1+s.brightness/30;
  const TL=total(L)||1;
  const H={...L};H[brightener(k,L)]+=s.hl/100*TL;
  const S={...L};S.O+=S.L;S.L=0;S.W=L.W*(1-s.depth/100);DROPS.forEach(id=>S[id]+=(s.drops[id]||0)/100*TL);
  // A shadow is never lighter than its light: take white out, then darken with the lightest touch of black.
  const lt=lumH(mixHex(L));for(let i=0;i<60&&lumH(mixHex(S))>=lt*0.96;i++){if(S.W>1e-3)S.W*=0.7;else S.K+=0.004*TL}
  const Sd=blend(L,S,s.strength/100);
  const hx={H:mixHex(H),L:mixHex(L),S:mixHex(S),D:mixHex(Sd)};
  let keys;
  if(TAB[k].form==='sheen')keys=[[0,Sd],[25,L],[50,H],[75,L],[100,Sd]];
  else{const c=s.band,w=s.width/2;const bs=Math.max(c-w,s.body+1),be=Math.min(Math.max(c+w,bs+2),99),bc=(bs+be)/2;
    keys=[[0,H]];if(s.bright>0)keys.push([s.bright,H]);keys.push([Math.max(s.body,s.bright),L],[bs,L],[bc,Sd],[be,L],[100,L])}
  const stops=[];
  for(let i=0;i<keys.length;i++){const [pa,ra]=keys[i];if(stops.length&&Math.abs(stops[stops.length-1][0]-pa)<0.05)continue;stops.push([pa,mixHex(ra)]);
    if(i<keys.length-1){const [pb,rb]=keys[i+1];if(mixHex(ra)!==mixHex(rb)&&pb>pa)for(let j=1;j<s.feather;j++){const t=j/s.feather;stops.push([pa+(pb-pa)*t,mixHex(blend(ra,rb,smooth(t)))])}}}
  const grad='linear-gradient(180deg,'+stops.map(([p,h])=>h+' '+(+p.toFixed(1))+'%').join(',')+')';
  const gp={...L};gp[glossPigment(k)]+=0.8*TL;const gh=mixHex(gp),a=s.gloss/100;
  const gloss=a>0?`radial-gradient(130% 110% at 100% 0%,${rgba(gh,a)} 0%,${rgba(gh,a*0.45)} 30%,${rgba(gh,0)} 65%),linear-gradient(215deg,${rgba(gh,a*0.55)} 0%,${rgba(gh,0)} 45%),`:'';
  return {L,H,S,hx,stops,grad,gloss,full:gloss+grad,blendMode:a>0?'screen,screen,normal':'normal',glossHex:gh};
}
const paint=(el,c)=>{el.style.backgroundImage=c.full;el.style.backgroundBlendMode=c.blendMode};

function build(){
  $('tabset').innerHTML=TABS.map(t=>`<button type="button" data-k="${t.key}">${t.name}</button>`).join('');
  $('tabset').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;cur=b.dataset.k;$('msg').textContent='';sync();render()});
  $('lightRows').innerHTML=PIGMENTS.map(p=>`<div class="row" id="lr_${p.id}"><span class="dot" style="background:${p.hex}"></span><label for="l_${p.id}">${p.name}</label><input id="l_${p.id}" type="range" min="0" max="1000"><output id="ol_${p.id}"></output></div>`).join('');
  $('shadowRows').innerHTML=DROPS.map(id=>`<div class="row"><span class="dot" style="background:${PIG[id].hex}"></span><label for="s_${id}">${PIG[id].name}</label><input id="s_${id}" type="range" min="0" max="1000"><output id="os_${id}"></output></div>`).join('');
  IDS.forEach(id=>$('l_'+id).addEventListener('input',e=>{TS[cur].light[id]=sq(10,+e.target.value);render()}));
  DROPS.forEach(id=>$('s_'+id).addEventListener('input',e=>{TS[cur].drops[id]=sq(40,+e.target.value);render()}));
  for(const k of ['depth','feather','yellow','brightness','body','bright','hl','band','width','strength','gloss'])$(k).addEventListener('input',e=>{TS[cur][k]=+e.target.value;render()});
  $('one11').addEventListener('click',()=>{TS[cur].drops={C:1,A:1,O:1,K:0};sync();render()});
  $('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;ctab=b.dataset.tab;render()});
  $('views').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;view=b.dataset.view;render()});
  $('reset').addEventListener('click',()=>{TS[cur]=start(cur);$('msg').textContent='';sync();render()});
  $('matchForm').addEventListener('submit',e=>{e.preventDefault();match($('matchHex').value)});
  $('lock').addEventListener('click',()=>copy($('code').textContent,'Copied. Paste it in the chat.'));
  $('strip').addEventListener('click',e=>{const s=e.target.closest('span');if(s)copy(s.dataset.hex,'Copied '+s.dataset.hex)});
  ['hxH','hxL','hxS'].forEach(id=>$(id).addEventListener('click',()=>copy($(id).dataset.hex,'Copied '+$(id).dataset.hex)));
  $('chart').innerHTML=CHART.map(([t,s])=>`<div class="cg"><h3>${t}</h3><div class="sws">${s.map(([n,h])=>`<span class="cs" data-hex="${h}" title="${n} ${h}" style="background:${h};color:${lumH(h)<0.25?'#F7F6F1':'#102347'}">${h.slice(1)}</span>`).join('')}</div></div>`).join('');
  $('chart').addEventListener('click',e=>{const s=e.target.closest('.cs');if(s){$('matchHex').value=s.dataset.hex;match(s.dataset.hex)}});
}
function sync(){const s=TS[cur];
  IDS.forEach(id=>$('l_'+id).value=isq(10,s.light[id]||0));DROPS.forEach(id=>$('s_'+id).value=isq(40,s.drops[id]||0));
  for(const k of ['depth','feather','yellow','brightness','body','bright','hl','band','width','strength','gloss'])$(k).value=s[k];
}
function render(){
  const s=TS[cur],c=compute(cur);
  paint($('bar'),c);paint($('b1'),c);paint($('b2'),c);
  for(const [id,h] of [['hxH',c.hx.H],['hxL',c.hx.L],['hxS',c.hx.S]]){$(id).dataset.hex=h;$(id).querySelector('span').style.background=h;$(id).querySelector('b').textContent=h}
  $('strip').innerHTML=c.stops.map(([p,h])=>`<span data-hex="${h}" style="background:${h};color:${lumH(h)<0.25?'#F7F6F1':'#102347'}" title="${h} at ${p.toFixed(1)}%">${c.stops.length>14?'':h.slice(1)}</span>`).join('');
  IDS.forEach(id=>$('ol_'+id).value=fmt(s.light[id]||0));DROPS.forEach(id=>$('os_'+id).value=pct(s.drops[id]||0));
  $('lr_L').hidden=!lemonOk(cur);$('yellowRow').hidden=!lemonOk(cur);
  const o={depth:s.depth+'%',feather:s.feather,yellow:sgn(s.yellow),brightness:sgn(s.brightness),body:s.body+'%',bright:s.bright+'%',hl:s.hl+'%',band:s.band+'%',width:s.width+'%',strength:s.strength+'%',gloss:s.gloss+'%'};
  for(const k in o)$('o'+k[0].toUpperCase()+k.slice(1)).value=o[k];
  const sheen=TAB[cur].form==='sheen';['body','bright','band','width'].forEach(id=>$(id).disabled=sheen);
  document.querySelectorAll('#tabset button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===cur));
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===ctab));
  document.querySelectorAll('.pane').forEach(p=>p.hidden=p.dataset.pane!==ctab);
  document.querySelectorAll('#views button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));
  $('kit').hidden=view!=='kit';$('chart').hidden=view!=='chart';
  board();
  const rec=r=>IDS.filter(id=>r[id]>0.0005).sort((a,b)=>r[b]-r[a]).map(id=>fmt(r[id])+' '+SHORT[id]).join(' · ');
  $('code').textContent=
`/* GluMira Colour Mixer · ${TAB[cur].name} · ${new Date().toISOString().slice(0,10)} */
--mix-highlight: ${c.hx.H}; /* ${rec(c.H)} */
--mix-light: ${c.hx.L}; /* ${rec(c.L)} */
--mix-shadow: ${c.hx.S}; /* ${rec(c.S)} */
--mix-band: ${c.hx.D}; /* centre of the shadow band, strength ${s.strength}% */
--mix-gradient: ${c.grad};
--mix-gloss: ${c.gloss?c.gloss.slice(0,-1):'none'};
/* paint as: background-image: var(--mix-gloss), var(--mix-gradient); background-blend-mode: screen, screen, normal */
/* feather ${s.feather} · more yellow ${sgn(s.yellow)} · brightness ${sgn(s.brightness)} · body at ${s.body}% · bright at ${s.bright}% · highlight ${s.hl}% · shadow at ${s.band}% · width ${s.width}% · gloss ${s.gloss}% */`;
}
// The mood board takes its colours from the tabs: navy the world, steel buttons from light navy, gold edges and
// thumbs, bone text, blue group for quiet text and glow, sapphire for live states, green for the toast.
function board(){
  const n=compute('navy'),ln=compute('lnavy'),g=compute('gold'),bo=compute('bone'),bg=compute('blue'),sp=compute('sapphire'),gr=compute('green'),gs=compute('gsheen');
  const spLift={...sp.L};spLift.W+=1.2*total(sp.L);const spl=mixHex(spLift);
  const v={'--n-page':n.hx.S,'--n-surface':n.hx.L,'--n-glow':rgba(n.hx.H,0.42),'--n-rim':rgba(n.hx.H,0.55),'--n-under':rgba(n.hx.S,0.7),'--n-drop':rgba(n.hx.S,0.95),'--n-edge':rgba(n.hx.H,0.3),
    '--s-surface':ln.hx.L,'--s-glow':rgba(ln.hx.H,0.45),'--s-grad':ln.grad,'--s-grad-hi':`linear-gradient(180deg,${ln.hx.H},${ln.hx.L})`,'--s-shadow':ln.hx.S,
    '--g-light':g.hx.L,'--g-edge':rgba(g.hx.L,0.6),'--g-grad':g.grad,
    '--b-text':bo.hx.L,'--bo-grad':`linear-gradient(180deg,${bo.hx.H},${bo.hx.L} 55%,${bo.hx.D})`,'--b-muted':bg.hx.L,'--glow-blue':rgba(bg.hx.H,0.55),
    '--sp-grad':sp.grad,'--sp-light':spl,'--gr-grad':`linear-gradient(180deg,${gr.hx.H},${gr.hx.L} 60%,${gr.hx.D})`,'--gr-shadow':gs.hx.L};
  const b=$('board');for(const k in v)b.style.setProperty(k,v[k]);
}
function match(v){
  v=(v||'').trim();if(!/^#?[0-9a-fA-F]{6}$/.test(v))return;
  const t=('#'+v.replace('#','')).toUpperCase();const f=TAB[cur].fam;
  const tries=f==='gold'?[['K'],[]]:f==='blue'?[['L','A','K'],['L','A'],['L']]:[['L','K'],['L']];
  let r=null;for(const ex of tries){const x=solve(t,ex);if(!r||x.dE<r.dE-1)r=x;if(r.dE<=3)break}
  TS[cur].light={...z(),...r.recipe};sync();render();
}
function copy(t,ok){
  const fall=()=>{const r=document.createRange();r.selectNodeContents($('code'));const s=getSelection();s.removeAllRanges();s.addRange(r);$('msg').textContent='Selected. Press Ctrl+C.'};
  try{navigator.clipboard.writeText(t).then(()=>{$('msg').textContent=ok},fall)}catch(e){fall()}
}
// One design, scaled whole to the window: same order and alignment on every screen, nothing to scroll.
function fit(){const c=$('canvas');c.style.zoom=1;const w=c.offsetWidth,h=c.offsetHeight;
  c.style.zoom=Math.max(0.4,Math.min(1.6,(document.documentElement.clientWidth-24)/w,(innerHeight-6)/h))}
addEventListener('resize',fit);
build();sync();render();fit();
