'use strict';
// Card 01-29 slice B: "two debug calls on the same state return identical findings".
// The context is a fixture, not a checkout, so this test is the same on every machine and needs no
// Glumira-7.2 origin. debugResponse is exactly what GET /api/builder/debug returns.
const test=require('node:test'),assert=require('node:assert/strict');
const {debugFindings,debugResponse}=require('../builder-data-api');
const COMMIT='0'.repeat(39)+'1';
// One pinned state: a roadmap warning, an unresolved route, one unresolved estate identity and two
// unprobed resources. The order of the findings must follow this order exactly.
const context={
  repo:{slug:'Glumira-X-Technologies-cc/Glumira-7.2',commit:COMMIT},
  roadmap:{warnings:[{code:'FOYER_PIN_DIFFERS_FROM_HEAD_BLOB'}]},
  os:{jev:{unresolved:[{subject:'Widget',reason:'no vault'}]}},
  estate:[{id:1,label:'GluMira 7.2',slug:'Glumira-X-Technologies-cc/Glumira-7.2'},{id:2,label:'Foundation Archive',slug:null}],
  resources:[{id:'gemini',name:'Gemini',probed:true},{id:'hermes',name:'Hermes',probed:false},{id:'soup',name:'Soup',probed:false}],
};
// No ISO instant and no UUID may ever appear inside a finding.
const INSTANT=/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

test('two debug calls on the same state return identical findings, in the same order',()=>{
 const first=debugFindings(context),second=debugFindings(context);
 assert.deepEqual(second,first);
 assert.equal(JSON.stringify(second.findings),JSON.stringify(first.findings));
 assert.deepEqual(first.findings,[
  {code:'FOYER_PIN_DIFFERS_FROM_HEAD_BLOB'},
  {code:'UNRESOLVED_ROUTE',subject:'Widget',reason:'no vault'},
  {code:'ESTATE_IDENTITY_UNRESOLVED',subject:'Foundation Archive'},
  {code:'RESOURCE_NOT_PROBED',subject:'Hermes'},
  {code:'RESOURCE_NOT_PROBED',subject:'Soup'},
 ]);
 // A different repo state gives a different scan; the order is never re-sorted.
 const moved={...context,repo:{...context.repo,commit:'a'.repeat(40)}};
 assert.notEqual(debugFindings(moved).source,first.source);
 assert.deepEqual(debugFindings(moved).findings,first.findings);
});

test('no finding carries a timestamp or a random id',()=>{
 const {findings}=debugFindings(context);
 assert.ok(findings.length>0);
 for(const finding of findings){
  for(const value of Object.values(finding)){
   const text=Array.isArray(value)?value.join(' '):String(value);
   assert.doesNotMatch(text,INSTANT,'a finding carries no scan time');
   assert.doesNotMatch(text,UUID,'a finding carries no random id');
  }
 }
 assert.doesNotMatch(JSON.stringify(findings),INSTANT);
 assert.doesNotMatch(JSON.stringify(findings),UUID);
});

test('the scan time is one separate field and nothing else',()=>{
 const at=new Date('2026-10-17T08:00:00.000Z');
 const first=debugResponse(context,()=>at);
 const later=debugResponse(context,()=>new Date('2026-10-17T09:30:00.000Z'));
 assert.equal(first.scannedAt,'2026-10-17T08:00:00.000Z');
 assert.notEqual(first.scannedAt,later.scannedAt,'the clock is allowed to move');
 // scannedAt is the only key that differs between two scans of the same state.
 const differing=Object.keys(first).filter(k=>JSON.stringify(first[k])!==JSON.stringify(later[k]));
 assert.deepEqual(differing,['scannedAt']);
 // Stripping that one field leaves exactly the pure findings payload.
 const {scannedAt,...rest}=first;
 assert.match(scannedAt,INSTANT);
 const {scannedAt:_ignored,...restLater}=later;
 assert.deepEqual(rest,debugFindings(context));
 assert.deepEqual(rest,restLater);
});

test('the unresolved-route branch is exercised even though the pinned JEV-MAP has no such list',()=>{
 // JEV-MAP.json carries map, about, revision, vaults, records and moved. It has no `unresolved` key,
 // so this branch is empty on the live repo today. The contract is pinned here rather than invented:
 // if a future map adds unresolved entries, they appear as findings instead of being dropped.
 assert.deepEqual(debugFindings({...context,os:{jev:{}}}).findings.filter(f=>f.code==='UNRESOLVED_ROUTE'),[]);
 assert.deepEqual(debugFindings({...context,os:{jev:{unresolved:[]}}}).findings.filter(f=>f.code==='UNRESOLVED_ROUTE'),[]);
 assert.deepEqual(debugFindings({...context,os:{}}).findings.filter(f=>f.code==='UNRESOLVED_ROUTE'),[]);
 assert.equal(debugFindings({...context,os:{jev:{unresolved:[{subject:'Widget',reason:'no vault'}]}}}).findings.filter(f=>f.code==='UNRESOLVED_ROUTE').length,1);
 // A missing roadmap or estate list fails the same way as an empty one rather than throwing.
 assert.deepEqual(debugFindings({repo:context.repo,roadmap:{warnings:[]},os:{},estate:[],resources:[]}).findings,[]);
});
