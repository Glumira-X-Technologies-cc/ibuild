// Spectral Kubelka-Munk. Wavelengths 380-730 nm in 10 nm steps. CIE 1931 2-degree observer from the
// Wyman, Sloan and Shirley (2013) multi-lobe fit. Pigment spectra are smooth sigmoid-quadratics.
const WL=[];for(let l=380;l<=730;l+=10)WL.push(l);
const g=(l,m,a,b)=>{const s=l<m?a:b;return Math.exp(-0.5*((l-m)/s)**2)};
const CMF=WL.map(l=>[1.056*g(l,599.8,37.9,31.0)+0.362*g(l,442.0,16.0,26.7)-0.065*g(l,501.1,20.4,26.2),
  0.821*g(l,568.8,46.9,40.5)+0.286*g(l,530.9,16.3,31.1),1.217*g(l,437.0,11.8,36.0)+0.681*g(l,459.0,26.0,13.8)]);
const M=[[3.2406,-1.5372,-0.4986],[-0.9689,1.8758,0.0415],[0.0557,-0.2040,1.0570]];
function xyzLin(R){let X=0,Y=0,Z=0;for(let i=0;i<WL.length;i++){X+=R[i]*CMF[i][0];Y+=R[i]*CMF[i][1];Z+=R[i]*CMF[i][2]}
  return M.map(r=>r[0]*X+r[1]*Y+r[2]*Z)}
const WHITE=xyzLin(WL.map(()=>1));
const linOf=R=>xyzLin(R).map((v,i)=>v/WHITE[i]);
const l2s=v=>{v=Math.max(0,Math.min(1,v));return 255*(v<=0.0031308?12.92*v:1.055*v**(1/2.4)-0.055)};
const s2l=v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4};
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const rgbHex=c=>'#'+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('').toUpperCase();
const sig=x=>0.5+x/(2*Math.sqrt(1+x*x));
const spectrum=c=>WL.map(l=>{const t=(l-555)/175;return Math.min(0.995,Math.max(0.002,sig(c[0]+c[1]*t+c[2]*t*t)))});
function lab(rgb){const [r,g2,b]=rgb.map(s2l);const X=(0.4124*r+0.3576*g2+0.1805*b)/0.95047,Y=0.2126*r+0.7152*g2+0.0722*b,Z=(0.0193*r+0.1192*g2+0.9505*b)/1.08883;
  const f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;const fx=f(X),fy=f(Y),fz=f(Z);return[116*fy-16,500*(fx-fy),200*(fy-fz)]}
function dE(a,b){const A=lab(a),B=lab(b);return Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2])}
const KS=R=>(1-R)**2/(2*R);
function mixSpec(pig,parts){const n=WL.length;const k=new Array(n).fill(0);let t=0;
  for(const id in parts){const v=parts[id];if(!(v>0))continue;const p=pig[id];const w=v*p.w;t+=w;for(let i=0;i<n;i++)k[i]+=w*p.ks[i]}
  if(!t)return null;return k.map(x=>{x/=t;return 1+x-Math.sqrt(x*x+2*x)})}
function mixRgbP(pig,parts){const R=mixSpec(pig,parts);if(!R)return[0,0,0];return linOf(R).map(l2s)}
module.exports={WL,spectrum,linOf,l2s,hexRgb,rgbHex,dE,lab,KS,mixSpec,mixRgbP};
