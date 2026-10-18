// Paint engine: spectral Kubelka-Munk, 380-730 nm in 10 nm steps. CIE 1931 observer from the Wyman, Sloan and
// Shirley (2013) fit. Each pigment is a smooth reflectance curve fitted to its paint colour; Cobalt Blue has its own
// curve (blue peak and a small deep-red rise) so its tints stay a clean sky blue. Strengths were fitted 2026-10-15 to
// the written recipes in App-Locked-Palette_v1.0.md and the navy recipe (Cobalt + Alizarin, Ochre to warm).
const PIGMENTS=[
  {id:'C',name:'Cobalt Blue',hex:'#1D4FA1'},{id:'A',name:'Alizarin Crimson',hex:'#7E232D'},{id:'O',name:'Yellow Ochre',hex:'#C8963E'},
  {id:'L',name:'Lemon Yellow',hex:'#F3DE1A'},{id:'W',name:'White',hex:'#FAFAF6'},{id:'K',name:'Ivory Black',hex:'#1C1B1A'}];
const PIG={};PIGMENTS.forEach(p=>PIG[p.id]=p);
const WL=[];for(let l=380;l<=730;l+=10)WL.push(l);
const gl=(l,m,a,b)=>{const s=l<m?a:b;return Math.exp(-0.5*((l-m)/s)**2)};
const CMF=WL.map(l=>[1.056*gl(l,599.8,37.9,31.0)+0.362*gl(l,442.0,16.0,26.7)-0.065*gl(l,501.1,20.4,26.2),
  0.821*gl(l,568.8,46.9,40.5)+0.286*gl(l,530.9,16.3,31.1),1.217*gl(l,437.0,11.8,36.0)+0.681*gl(l,459.0,26.0,13.8)]);
const XM=[[3.2406,-1.5372,-0.4986],[-0.9689,1.8758,0.0415],[0.0557,-0.2040,1.0570]];
function linOfRaw(R){let X=0,Y=0,Z=0;for(let i=0;i<WL.length;i++){X+=R[i]*CMF[i][0];Y+=R[i]*CMF[i][1];Z+=R[i]*CMF[i][2]}return XM.map(r=>r[0]*X+r[1]*Y+r[2]*Z)}
const WHITE=linOfRaw(WL.map(()=>1));
const linOf=R=>linOfRaw(R).map((v,i)=>v/WHITE[i]);
const s2l=v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4};
const l2s=v=>{v=Math.max(0,Math.min(1,v));return 255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055)};
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const rgbHex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('').toUpperCase();
const sig=x=>0.5+x/(2*Math.sqrt(1+x*x));
const clampR=v=>Math.min(0.99,Math.max(0.003,v));
const curveOf=id=>id==='C'?WL.map(l=>clampR(COBALT.a+COBALT.b*Math.exp(-0.5*((l-COBALT.m)/COBALT.s)**2)+COBALT.c/(1+Math.exp(-(l-COBALT.r)/18))))
  :WL.map(l=>{const t=(l-555)/175,c=CURVES[id];return clampR(sig(c[0]+c[1]*t+c[2]*t*t))});
PIGMENTS.forEach(p=>{p.w=WEIGHTS[p.id];p.ks=curveOf(p.id).map(R=>(1-R)**2/(2*R))});
const cache=new Map();
function mixRgb(r){let t=0;const n=WL.length,k=new Array(n).fill(0);
  for(const id in r){const v=r[id];if(!(v>0))continue;const p=PIG[id];const w=v*p.w;t+=w;for(let i=0;i<n;i++)k[i]+=w*p.ks[i]}
  if(!t)return[0,0,0];return linOf(k.map(x=>{x/=t;return 1+x-Math.sqrt(x*x+2*x)})).map(l2s)}
function mixHex(r){const key=PIGMENTS.map(p=>(r[p.id]||0).toFixed(4)).join(',');let h=cache.get(key);if(!h){h=rgbHex(mixRgb(r));if(cache.size>5000)cache.clear();cache.set(key,h)}return h}
function lab(rgb){const [r,g,b]=rgb.map(s2l);const X=(0.4124*r+0.3576*g+0.1805*b)/0.95047,Y=0.2126*r+0.7152*g+0.0722*b,Z=(0.0193*r+0.1192*g+0.9505*b)/1.08883;
  const f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;const fx=f(X),fy=f(Y),fz=f(Z);return[116*fy-16,500*(fx-fy),200*(fy-fz)]}
function dE(a,b){const A=lab(a),B=lab(b);return Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2])}
function total(r){let t=0;for(const id in r)t+=r[id]>0?r[id]:0;return t}
function norm(r){const t=total(r)||1;const o={};PIGMENTS.forEach(p=>o[p.id]=(r[p.id]>0?r[p.id]:0)/t);return o}
function blend(a,b,t){a=norm(a);b=norm(b);const o={};PIGMENTS.forEach(p=>o[p.id]=(1-t)*a[p.id]+t*b[p.id]);return o}
function lum(rgb){const [r,g,b]=rgb.map(s2l);return 0.2126*r+0.7152*g+0.0722*b}
// Seeded search for the recipe that mixes closest to a target hex, so a target gives the same recipe every time.
function solve(target,exclude=[],seed=7){let s=seed;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;const T=hexRgb(target);const ids=PIGMENTS.map(p=>p.id).filter(id=>!exclude.includes(id));
  let best=null,be=1e9;for(let run=0;run<6;run++){let p={};ids.forEach(id=>p[id]=rnd()<0.5?0:rnd()*5);if(!total(p))p[ids[0]]=1;let e=dE(mixRgb(p),T);
    for(let it=0;it<2500;it++){const q={...p};const id=ids[Math.floor(rnd()*ids.length)];const st=3*(1-it/2500)+0.02;
      q[id]=Math.max(0,(q[id]||0)*Math.exp((rnd()-0.5)*st)+(rnd()<0.2?(rnd()-0.5)*st:0));if(rnd()<0.04)q[id]=0;
      const t=total(q);if(!t)continue;for(const k in q)q[k]*=10/t;const ee=dE(mixRgb(q),T);if(ee<e){p=q;e=ee}}
    if(e<be){be=e;best=p}}
  const o={};PIGMENTS.forEach(p=>o[p.id]=Math.round((best[p.id]||0)*1000)/1000);return {recipe:o,dE:dE(mixRgb(o),T)}}
if(typeof module!=='undefined')module.exports={PIGMENTS,mixRgb,mixHex,solve,dE,hexRgb,rgbHex,blend,norm,total,lum,lab};
