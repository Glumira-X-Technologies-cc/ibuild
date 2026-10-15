'use strict';
// One Builder (2026-10-14): / and /builder serve only the AI Studio page (apps/ais-builder/dist) or, when it
// is not built, a notice with the build command. The old production-builder page is retired and not served.
const test=require('node:test'),assert=require('node:assert/strict'),net=require('node:net');
const freePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const {port}=s.address();s.close(()=>resolve(port));});});
test('one Builder page: / and /builder never serve the retired page',async t=>{
  const port=await freePort();process.env.PORT=String(port);
  const {app}=require('../server');
  const server=app.listen(port,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(()=>new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+port;
  for(const p of ['/','/builder']){
    const r=await fetch(base+p);const html=await r.text();
    assert.ok(r.status===200||r.status===503,p+' answers');
    if(r.status===200)assert.match(html,/id="root"/,p+' is the built AI Studio page');
    else assert.match(html,/npm run build/,p+' names the build command');
    assert.doesNotMatch(html,/builder-client\.js/,p+' is not the retired page');
  }
  assert.equal((await fetch(base+'/production-builder/index.html')).status,404);
  assert.equal((await fetch(base+'/builder-client.js')).status,404);
  assert.equal((await fetch(base+'/health')).status,200);
});
