const S=require('./spec.js');const curves=require('./curves.json');
const hue=c=>{const [r,g,b]=c.map(v=>v/255);const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;if(!d)return 0;let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;return h<0?h+360:h};
const cob=q=>S.WL.map(l=>Math.min(0.99,Math.max(0.003,q.a+q.b*Math.exp(-0.5*((l-q.m)/q.s)**2)+q.c/(1+Math.exp(-(l-q.r)/18)))));
const mk=(q,w)=>{const p={};for(const k in curves){const R=k==='C'?cob(q):S.spectrum(curves[k]);p[k]={w:w[k],ks:R.map(S.KS)}}return p};
const targets=[[{C:3,O:1,W:16},'#DCE2E6'],[{C:4,O:1,W:13},'#C6D2DA'],[{C:4,O:1,W:10},'#B5C4D0'],[{C:4,O:1,W:8},'#A3B6C6'],[{C:5,O:1,W:7},'#93A8BC'],[{C:5,O:1,W:5},'#8499AE'],
 [{O:6,W:2},'#E3C45B'],[{A:8,O:1,C:0.3},'#6B2A2C'],[{C:8,A:2,O:0.5},'#102347',3],[{C:1},'#1D4FA1',4]];
let st={q:{a:0.02,b:0.45,m:460,s:35,c:0.15,r:680},w:{C:0.3,A:0.3,O:0.5,L:0.5,W:1,K:0.5}};
const cost=s=>{if(s.q.s<12||s.q.s>80||s.q.m<430||s.q.m>490||s.q.r<620||s.q.r>740)return 1e9;const p=mk(s.q,s.w);let e=0;for(const [r,t,k] of targets)e+=(k||1)*S.dE(S.mixRgbP(p,r),S.hexRgb(t))**2;
  const h=hue(S.mixRgbP(p,{C:1,W:3}));if(h<212||h>222)e+=Math.min((h-212)**2,(h-222)**2)*3;return e};
let bc=cost(st);const N=12000;
for(let it=0;it<N;it++){const s=JSON.parse(JSON.stringify(st));const f=1.2*(1-it/N)+0.03;
 if(it%2){const k=['a','b','m','s','c','r'][Math.floor(Math.random()*6)];const sc={a:0.02,b:0.1,m:10,s:8,c:0.08,r:20}[k];s.q[k]+= (Math.random()-0.5)*sc*f*2;if(['a','b','c'].includes(k))s.q[k]=Math.max(0,s.q[k])}
 else{const k='CAOK'[Math.floor(Math.random()*4)];s.w[k]*=Math.exp((Math.random()-0.5)*f)}
 const c=cost(s);if(c<bc){bc=c;st=s}}
st.w.L=st.w.O;console.log('cost',bc.toFixed(0),JSON.stringify(st));const p=mk(st.q,st.w);
for(const [r,t] of targets){const m=S.mixRgbP(p,r);console.log(' ',JSON.stringify(r),t,S.rgbHex(m),S.dE(m,S.hexRgb(t)).toFixed(1))}
for(const r of [{C:1,W:1},{C:1,W:3},{C:1,W:8},{C:1,L:1},{C:1,O:1},{A:1,W:3},{C:2,A:1,W:3},{L:1,A:0.1},{O:1,A:0.2,C:0.05},{C:1,A:1,O:1},{L:7.4,W:2,A:0.5}])console.log(JSON.stringify(r),S.rgbHex(S.mixRgbP(p,r)),hue(S.mixRgbP(p,r)).toFixed(0));
require('fs').writeFileSync('cobalt.json',JSON.stringify(st));
