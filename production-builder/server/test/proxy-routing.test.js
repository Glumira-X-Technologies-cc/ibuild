'use strict';
// The verifier endpoint routes by model name (founder 2026-10-15, verbatim: "please add grok minimax"):
// grok-* to xAI, MiniMax-* (any case) to MiniMax with reasoning_split, anything else to Gemini.
const test=require('node:test'),assert=require('node:assert/strict');
// An empty key-store folder, so the keys below are the only ones on any machine.
process.env.GOVERNANCE_HUB=require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'proxy-hub-'));
process.env.GEMINI_API_KEY='g-test';process.env.XAI_API_KEY='x-test';process.env.MINIMAX_API_KEY='m-test';
const {backendFor,prepareBody}=require('../server');
test('proxy: the model name picks the backend',()=>{
  assert.equal(backendFor('grok-4.5').name,'grok');assert.equal(backendFor('grok-4.5').base,'https://api.x.ai/v1');
  assert.equal(backendFor('MiniMax-M2.7').name,'minimax');assert.equal(backendFor('minimax-m3').base,'https://api.minimax.io/v1');
  for(const m of ['gemini-flash-latest','gemini-flash-lite-latest',''])assert.equal(backendFor(m).name,'gemini',m);
});
test('proxy: MiniMax ids are put in their own case and its thinking is split out; others pass unchanged',()=>{
  const mm=prepareBody({model:'minimax-m2.7',messages:[]});assert.equal(mm.model,'MiniMax-M2.7');assert.equal(mm.reasoning_split,true);
  assert.equal(prepareBody({model:'MiniMax-M3'}).model,'MiniMax-M3');
  const g=prepareBody({model:'models/gemini-flash-latest'});assert.equal(g.model,'gemini-flash-latest');assert.equal(g.reasoning_split,undefined);
  assert.equal(prepareBody({model:'grok-4.5'}).reasoning_split,undefined);
});
test('proxy: a missing key names the key',()=>{
  delete process.env.MINIMAX_API_KEY;
  assert.match(backendFor('MiniMax-M2.7').error||'',/MINIMAX_API_KEY/);
});
