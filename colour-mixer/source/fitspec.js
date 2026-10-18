const S=require('./spec.js');
function fitCurve(hex){const T=S.hexRgb(hex);let c=[0,0,0],best=1e9;
  const err=c=>S.dE(S.linOf(S.spectrum(c)).map(S.l2s),T);best=err(c);
  for(let it=0;it<40000;it++){const st=8*(1-it/40000)+0.01;const q=c.map(v=>v+(Math.random()-0.5)*st*(Math.random()<0.5?1:0.2));const e=err(q);if(e<best){best=e;c=q}}
  return {c,best,hex:S.rgbHex(S.linOf(S.spectrum(c)).map(S.l2s))}}
const want={C:process.argv[2]||'#1D4FA1',A:'#7E232D',O:'#C8963E',L:'#F3DE1A',W:'#FAFAF6',K:'#1C1B1A'};
const out={};for(const k in want){const r=fitCurve(want[k]);out[k]=r.c.map(v=>+v.toFixed(3));console.log(k,want[k],r.hex,r.best.toFixed(2),JSON.stringify(out[k]))}
require('fs').writeFileSync('curves.json',JSON.stringify(out));
