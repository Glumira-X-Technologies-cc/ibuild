'use strict';
// Reads Git objects as data. Never checks out or runs programs from a fetched tree.
const {execFile,execFileSync}=require('node:child_process');
const {promisify}=require('node:util');
const {readBuilderContext,originIdentity,EXPECTED_REPO}=require('./builder-context');
const {BuilderError}=require('./builder-store');
const CHECKPOINT='Vaults/5-Production-Builder/Rows/5.16-Build-Audits-Documents/Books/Book-Jev-Scan/Page-Doc-Jev-Scan/document-checkpoint.json';
function git(root,args){return execFileSync('git',['-c','safe.directory='+root.replace(/\\/g,'/'),'-C',root,...args],{encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']}).trim();}
async function fetchMain(root){
  await promisify(execFile)('git',['-c','safe.directory='+root.replace(/\\/g,'/'),'-C',root,'fetch','--no-tags','origin','+refs/heads/main:refs/remotes/origin/main'],{encoding:'utf8',windowsHide:true,timeout:45000,maxBuffer:1024*1024});
}
function readCheckpoint(root,commit){
  try{
    const data=JSON.parse(git(root,['show',commit+':'+CHECKPOINT]));
    // Version 2 adds the path-level review columns and the review record sets; version 1 stays readable.
    if(![1,2].includes(data.schemaVersion)||!Array.isArray(data.repositories)||!data.generatedAt)throw new Error('schema');
    // The file's own stamp status (DONE) must not replace the read status.
    return {...data,stampStatus:data.status,status:'available',path:CHECKPOINT,sourceCommit:commit};
  }catch{return {status:'unavailable',path:CHECKPOINT,sourceCommit:commit,reason:'No readable document checkpoint at this main commit. Publish the audit and scan again.'};}
}
function createScanService({repoRoot,hubRoot,fetchOrigin=fetchMain,readContext=readBuilderContext,getEstateReport,clock=()=>new Date().toISOString()}){
  let latest=null,inFlight=null;
  const runtime={commit:git(repoRoot,['rev-parse','HEAD']),dirty:!!git(repoRoot,['status','--porcelain']),startedAt:clock()};
  async function load(refresh){
    // Validate identity before contacting a remote, including when the configured remote changed.
    if(originIdentity(git(repoRoot,['remote','get-url','origin'])).toLowerCase()!==EXPECTED_REPO.toLowerCase())throw new BuilderError('SOURCE_ORIGIN_MISMATCH','The Builder origin does not match its registered repository.',503);
    const attemptedAt=clock(),warnings=[];let fetchStatus=refresh?'fresh':'cached';
    if(refresh){try{await fetchOrigin(repoRoot);}catch{fetchStatus='stale';warnings.push({code:'FETCH_FAILED',note:'Fetch failed. Showing the last available origin/main commit. Retry Scan when the remote is reachable.'});}}
    let commit;
    try{commit=git(repoRoot,['rev-parse','--verify','refs/remotes/origin/main^{commit}']);}catch{throw new BuilderError('MAIN_UNAVAILABLE','origin/main is unavailable. Restore remote access and scan again.',503);}
    if(!/^[0-9a-f]{40}$/.test(commit))throw new BuilderError('SOURCE_HEAD_INVALID','Main returned an invalid commit.',503);
    const source=readContext(repoRoot,{hubRoot,sourceCommit:commit});
    let checkout={branch:source.repo.branch,head:null,ahead:null,behind:null,dirty:source.repo.dirty};
    try{
      checkout.head=git(repoRoot,['rev-parse','HEAD']);
      const counts=git(repoRoot,['rev-list','--left-right','--count','HEAD...'+commit]).split(/\s+/).map(Number);
      [checkout.ahead,checkout.behind]=counts;
    }catch{warnings.push({code:'CHECKOUT_STATUS_UNAVAILABLE',note:'Local checkout comparison failed. Inspect its Git status.'});}
    if(checkout.branch!=='main')warnings.push({code:'CHECKOUT_NOT_MAIN',note:'Local checkout is on '+(checkout.branch||'detached HEAD')+'. Scan reads origin/main. Keep branch work isolated.'});
    if(checkout.behind>0)warnings.push({code:'CHECKOUT_BEHIND',note:'Local checkout is '+checkout.behind+' commits behind main. Review its work before updating it.'});
    let estateSync={status:'unavailable',rows:[],warnings:['Estate sync report is unavailable. Check the governance hub installation.']};
    if(getEstateReport){try{estateSync=await getEstateReport({refresh});}catch{ /* Explicit unavailable is retained. */ }}
    const scan={source:'origin/main',commit,runtime,attemptedAt,scannedAt:clock(),fetchStatus,checkout,warnings};
    latest={...source,scan,estateSync,documentCheckpoint:readCheckpoint(repoRoot,commit)};
    return latest;
  }
  function begin(refresh){if(inFlight)return inFlight;inFlight=load(refresh).finally(()=>{inFlight=null;});return inFlight;}
  return {scan:()=>begin(true),get:()=>inFlight||(latest?Promise.resolve(latest):begin(false))};
}
module.exports={createScanService,fetchMain,readCheckpoint,CHECKPOINT};
