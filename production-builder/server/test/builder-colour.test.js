'use strict';
// Colour carries meaning (founder 2026-10-12, verbatim: "more color better design", "better visual").
// By the GluMira colour method: navy is the world, gold is the light, bone is the neutral. Merged with the council
// design for card 01-29 (one navy ramp from #102347): the cool group is written as navy ramp steps, never a second
// blue; the warm group is yellow ochre and alizarin crimson for accents.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..','production-builder');
const theme=fs.readFileSync(path.join(dir,'theme.css'),'utf8');
const base=fs.readFileSync(path.join(dir,'builder-client.css'),'utf8');
const client=fs.readFileSync(path.join(dir,'builder-client.js'),'utf8');
const section=theme.slice(theme.indexOf('/* Colour carries meaning'));
const RAMP={};for(const [,k,v] of theme.matchAll(/--pb-navy-(\d{3}): (#[0-9A-Fa-f]{6})/g))RAMP[k]=v.toUpperCase();
const resolve=v=>{const r=/^var\(--pb-navy-(\d{3})\)$/.exec(v);return r?RAMP[r[1]]:v.toUpperCase();};
const raw=sel=>{const out={};const re=new RegExp(sel.replace(/[[\]()".*]/g,'\\$&')+' \\{([^}]*)\\}','g');for(const m of section.matchAll(re))for(const [,k,v] of m[1].matchAll(/(--[\w-]+):\s*(#[0-9A-Fa-f]{6}|var\(--pb-navy-\d{3}\))/g))out[k]=v;return out;};
const resolved=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,resolve(v)]));
const rawDark=raw(':root'),rawLight=raw(':root[data-theme="light"]'),dark=resolved(rawDark),light=resolved(rawLight);
const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
const ratio=(a,b)=>{const [x,y]=[L(a),L(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};
const hsl=h=>{const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let hh=0;if(d){hh=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;hh*=60;if(hh<0)hh+=360;}return [hh,d?d/(1-Math.abs(2*l-1)):0,l];};
const blueFamily=h=>{const [hue,s]=hsl(h);return s>0.08&&hue>=190&&hue<=250;};
const NAMES=['--pb-accent','--pb-accent-ink','--pb-accent-wash','--pb-ring','--pb-ochre','--pb-alizarin','--pb-emerald','--pb-tab-ink','--pb-tab-active-ink','--pb-tab-line','--pb-menu-ink','--pb-menu-active-ink','--pb-menu-line','--pb-head-ink','--pb-head-rule','--pb-head-mark','--pb-chat-you','--pb-chat-you-edge','--pb-chat-you-label','--pb-chat-model','--pb-chat-model-edge','--pb-chat-model-label','--pb-note-info','--pb-note-info-bar','--pb-note-ok','--pb-note-ok-bar','--pb-note-warn','--pb-note-warn-bar','--pb-note-error','--pb-note-error-bar','--pb-empty-ink','--pb-empty-icon','--pb-dot-claude','--pb-dot-gemini','--pb-dot-deepseek'];
const COOL=['--pb-accent','--pb-accent-ink','--pb-accent-wash','--pb-ring','--pb-head-rule','--pb-chat-model','--pb-chat-model-edge','--pb-chat-model-label','--pb-note-info','--pb-note-info-bar','--pb-dot-gemini'];
// Surfaces and ink of each theme. The title band is navy in both themes (council rule 1); the tab menu opens on the
// panel colour. The first test below checks this table against theme.css and index.html.
const SURF={dark:{text:'#E8E4DC',muted:RAMP['300'],s1:'#102347',s2:RAMP['750'],base:RAMP['900'],bar:'#102347',barActive:RAMP['750'],menu:RAMP['900'],menuActive:RAMP['700']},light:{text:RAMP['800'],muted:RAMP['550'],s1:'#FFFFFF',s2:'#FFFFFF',base:'#F7F6F1',bar:'#102347',barActive:RAMP['750'],menu:'#FFFFFF',menuActive:'#EFE6CC'}};

test('colour: every new token exists in dark and in light; the surface table matches the theme',()=>{
  for(const n of NAMES){assert.ok(dark[n],'dark '+n);assert.ok(light[n],'light '+n);}
  const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
  assert.match(html,/--text: #e8e4dc;/i);assert.match(html,/--bg-panel: var\(--pb-navy-900\);/);assert.match(html,/--bg-active: var\(--pb-navy-700\);/);
  assert.match(theme,/:root \{ --pb-surface-base: var\(--pb-navy-900\); --pb-surface-1: #102347; --pb-surface-2: var\(--pb-navy-750\);/);
  assert.match(theme,/:root\[data-theme="light"\] \{ --pb-surface-base: #F7F6F1; --pb-surface-1: #FFFFFF; --pb-surface-2: #FFFFFF;/);
  assert.match(theme,/:root\[data-theme="light"\] \{ --bar-bg: #102347; --bar-ink: #EEF0EF; --bar-line: var\(--pb-navy-600\); --bar-active: var\(--pb-navy-750\); \}/);
  assert.match(theme,/--text: var\(--pb-navy-800\); --text-dim: var\(--pb-navy-550\); --text-muted: var\(--pb-navy-550\);/);
  assert.match(theme,/--bg-deep: #F7F6F1; --bg-panel: #FFFFFF; --bg-card: #FFFFFF;\s*--bg-hover: #F1EDE2; --bg-active: #EFE6CC;/);
});
test('colour: the locked hues are unchanged',()=>{
  assert.match(theme,/--gm-navy: #102347; --gm-navy-deep: #09152A; --gm-gold: #C9A24B; --gm-bone: #F7F6F1;/);
  assert.equal(RAMP['800'],'#102347','the ramp is built on the locked navy');
  assert.equal(dark['--pb-head-mark'],'#C9A24B','gold is the light');assert.equal(dark['--pb-tab-line'],'#C9A24B');
  assert.equal(dark['--pb-emerald'],'#2ECC71','the What-If emerald, exact');assert.equal(light['--pb-emerald'],'#2ECC71');
  assert.equal(light['--gold'],undefined,'the light gold stays in its own rule');assert.match(theme,/--gold: #7A5C0A;/,'one light-mode gold');
  assert.ok(!/#1A5FB4/i.test(section),'the glucose data line never becomes chrome');
});
test('colour: no periwinkle-family hex and none of the banned outside palette, no black shadows in the colour section',()=>{
  for(const css of [theme,base])for(const [h] of css.matchAll(/#[0-9A-Fa-f]{6}\b/g)){const [hue,s,l]=hsl(h);assert.ok(!(hue>=220&&hue<=265&&s>=0.35&&l>=0.62),h+' is in the periwinkle family');}
  assert.doesNotMatch(theme+base,/#B2C6F8|#CCCCFF|#8C9EFF/i,'named periwinkles');
  for(const src of [theme,base,client])assert.doesNotMatch(src,/#0a0a0a|#1456f0|DM Sans/i,'no outside audit palette or fonts');
  assert.doesNotMatch(section,/rgba\(0,\s*0,\s*0/,'shadows lean navy, never black');assert.doesNotMatch(section,/gradient\(/,'no new gradients');
  for(const [,r,g,b] of section.matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),/g)){const h='#'+[r,g,b].map(x=>(+x).toString(16).padStart(2,'0')).join('').toUpperCase();assert.ok(!blueFamily(h)||Object.values(RAMP).includes(h),'shadow '+h+' is a ramp step');}
});
test('colour: the cool group is the navy ramp, written as ramp steps, never a second blue',()=>{
  for(const [name,t] of [['dark',rawDark],['light',rawLight]])for(const n of COOL)assert.match(t[n],/^var\(--pb-navy-\d{3}\)$/,name+' '+n+' is a ramp step');
  assert.match(rawDark['--pb-chat-you'],/^var\(--pb-navy-\d{3}\)$/,'dark: your messages sit one ramp step lighter than the model');
  for(const [h] of section.matchAll(/#[0-9A-Fa-f]{6}\b/g))assert.ok(!blueFamily(h),h+' would be a blue outside the ramp');
});
test('colour: text is at least 4.5:1 on its surface, and accents at least 3:1, dark and light',()=>{
  for(const [name,t] of [['dark',dark],['light',light]]){const s=SURF[name],ok=(fg,bg,need,what)=>assert.ok(ratio(fg,bg)>=need,name+' '+what+' '+fg+' on '+bg+' = '+ratio(fg,bg).toFixed(2));
    for(const bg of [t['--pb-chat-you'],t['--pb-chat-model'],t['--pb-note-info'],t['--pb-note-ok'],t['--pb-note-warn'],t['--pb-note-error'],t['--pb-accent-wash']])ok(s.text,bg,4.5,'text');
    ok(s.muted,t['--pb-chat-model'],4.5,'muted text in a reply');ok(s.muted,t['--pb-chat-you'],4.5,'muted text in your message');
    ok(t['--pb-chat-you-label'],t['--pb-chat-you'],4.5,'your label');ok(t['--pb-chat-model-label'],t['--pb-chat-model'],4.5,'model label');
    for(const bg of [s.s1,s.s2])ok(t['--pb-head-ink'],bg,4.5,'heading');ok(t['--pb-accent-ink'],s.s1,4.5,'sub-heading');
    ok(t['--pb-tab-ink'],s.bar,4.5,'inactive tab');ok(t['--pb-tab-active-ink'],s.barActive,4.5,'active tab');ok(t['--pb-menu-ink'],s.menu,4.5,'menu item');ok(t['--pb-menu-active-ink'],s.menuActive,4.5,'active menu item');
    ok(t['--pb-empty-ink'],s.s1,4.5,'empty state text');ok(t['--pb-empty-ink'],s.base,4.5,'empty state on the ground');
    for(const [k,bg] of [['--pb-accent',s.s1],['--pb-accent',s.s2],['--pb-ring',s.s1],['--pb-dot-claude',s.s1],['--pb-dot-gemini',s.s1],['--pb-dot-deepseek',s.s1],['--pb-tab-line',s.bar],['--pb-tab-line',s.barActive],['--pb-menu-line',s.menuActive],['--pb-chat-you-edge',t['--pb-chat-you']],['--pb-chat-model-edge',t['--pb-chat-model']]])ok(t[k],bg,3,k+' on '+bg);
  }
});
test('colour: the seven meanings are wired in the page',()=>{
  assert.match(section,/\.pb-work > \.nav-tabs > \.nav-tab\.active, \.pb-work > \.nav-tabs \.nav-group\.active > \.nav-group-btn \{\s*color: var\(--pb-tab-active-ink\); box-shadow: inset 0 -2px 0 0 var\(--pb-tab-line\);/,'1 active tab gold text and underline');
  assert.match(section,/\.pb-work > \.nav-tabs \.nav-menu \.nav-tab\.active \{ color: var\(--pb-menu-active-ink\); box-shadow: inset 2px 0 0 0 var\(--pb-menu-line\); \}/,'1 the open tab menu has its own inks');
  assert.match(section,/\.pb-panel > h2, \.pb-flow-head > strong, \.pb-dock-head > strong, \.pb-saved > summary \{ color: var\(--pb-head-ink\); \}/,'2 panel headings');
  assert.match(section,/\.pb-bubble\.user, \[data-theme="light"\] \.pb-bubble\.user \{ background: var\(--pb-chat-you\);/,'3 your messages');
  assert.match(section,/\.pb-bubble\.assistant, \[data-theme="light"\] \.pb-bubble\.assistant \{ background: var\(--pb-chat-model\);/,'3 model messages');
  assert.match(section,/:is\(html, html\[data-theme="light"\]\) \.pb-bubble\.user \{ border-left-color: var\(--pb-chat-you-edge\); background: var\(--pb-chat-you\); \}/,'3 the council left rule draws the same tokens');
  assert.match(client,/m\.role==='assistant'\?m\.provider:''/,'3 a reply carries its model');assert.match(client,/\$\('#pb-model-dot'\)\.dataset\.model=draft\.provider/,'3 the picker dot follows the model');
  assert.match(section,/\.pb-model-dot \{ flex: 0 0 auto; order: 1;/,'3 the head dot sits after the model picker');
  for(const k of ['ok','warn','error'])assert.match(section,new RegExp('\\.pb-notice\\.is-'+k+'[^{]*\\{ background: var\\(--pb-note-'+k+'\\); border-left-color: var\\(--pb-note-'+k+'-bar\\); \\}'),'4 notice '+k);
  assert.match(client,/'pb-notice is-warn'/,'4 a stale idea is a warning');assert.match(client,/toast\(message,'error'\)/,'4 errors are error toasts');assert.match(client,/toast\('Copied\.','ok'\)/,'4 success');
  assert.match(client,/function toast\(text,kind\)\{const box=toastBox\(\);box\.dataset\.kind=kind\|\|'info';/,'4 the toast in the tab row keeps its kind');
  assert.match(section,/\.pb-btn, \[data-theme="light"\] \.pb-btn \{ background: transparent; border-color: var\(--pb-accent\);/,'5 secondary outlined in a ramp step');
  assert.match(section,/\.pb-btn\.pb-icon:focus-visible \{ border-color: var\(--pb-ring\); box-shadow: 0 0 0 2px var\(--pb-ring\); outline: none; \}/,'5 icon ring on keyboard focus');
  assert.doesNotMatch(section,/\.pb-btn\.pb-icon:hover[^{]*\{[^}]*box-shadow: 0 0 0 2px/,'5 no ring on hover (council: no circles)');
  assert.match(theme,/\.pb-btn\.primary \{\s*background: var\(--gm-gold-button\);\s*color: var\(--gm-navy\);/,'5 primary gold fill, navy text');
  assert.match(section,/--pb-lift: inset 0 1px 0 var\(--pb-highlight\), 0 1px 2px var\(--pb-shade\)/,'6 top highlight and navy shadow');
  assert.match(section,/\.pb-empty::before \{[^}]*background: var\(--pb-empty-icon\);/,'7 gold empty-state icon');assert.match(client,/fills in here\.','pb-empty'\)/,'7 the prompt empty state');
});
