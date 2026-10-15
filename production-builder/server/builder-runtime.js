'use strict';
const express=require('express');
const path=require('node:path');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {createBuilderStore,BuilderError}=require('./builder-store');
const {createBuilderRouter,bootstrap}=require('./builder-data-api');
const {readBuilderContext}=require('./builder-context');
const {createProviderService}=require('./builder-providers');
const {createJobManager,createJobsRouter}=require('./builder-jobs');
const {createIdeasRouter}=require('./builder-ideas');
const {createWebReader}=require('./builder-web');
function findRepoRoot(start){let p=path.resolve(start);while(path.dirname(p)!==p){if(fs.existsSync(path.join(p,'.git'))&&fs.existsSync(path.join(p,'Foyer','FOYER.json')))return p;p=path.dirname(p);}throw new BuilderError('BUILDER_REPO_NOT_FOUND','Run the builder inside its validated Glumira-7.2 checkout.',503);}
function runOsGate(repoRoot){
  const scoped={...process.env,GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:repoRoot.replace(/\\/g,'/'),GIT_CONFIG_KEY_1:'core.longpaths',GIT_CONFIG_VALUE_1:'true'};
  try{const out=execFileSync(process.execPath,['Library/OS/CHECK.mjs','--snapshot','HEAD','--task-repo','Glumira-X-Technologies-cc/Glumira-7.2'],{cwd:repoRoot,env:scoped,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});if(!/RESULT PASS:/.test(out))return {allowed:false,reason:'OS check did not return a passing result.'};return {allowed:true,receipt:out.trim()};}catch{return {allowed:false,reason:'The current OS check failed or timed out. Inspect Debug before dispatch.'};}
}
function createBuilderRuntime({repoRoot,dataDir,getKey,env=process.env,fetchImpl,spawnImpl,osGate=runOsGate}){
  const store=createBuilderStore({dataDir:dataDir||path.join(repoRoot,'.runtime','production-builder')});
  let providers,manager;
  const getProviderStatus=async()=>({providers:providers.describe(),resources:manager.capabilities().map(c=>({...c,name:{claude:'Claude Terminal',codex:'Codex',gemini:'Gemini',hermes:'Hermes'}[c.id||c.target]||c.name}))});
  const context=()=>bootstrap({repoRoot,store,getProviderStatus,hubRoot:env.GOVERNANCE_HUB||'C:/memory-governance-archive'});
  providers=createProviderService({getKey,store,getContext:context,env,fetchImpl});
  const authorizeJob=async(input)=>{
    const receipt=store.snapshot().requests.find(r=>r.id===input.context?.dispatchReceiptId);
    if(!receipt||receipt.kind!=='compiled-instruction')return {allowed:false,reason:'Prepare the instruction through the server compiler before dispatch.'};
    if(receipt.promptHash!==createHash('sha256').update(input.prompt).digest('hex')||receipt.taskId!==input.taskId)return {allowed:false,reason:'The prompt or task changed after compilation. Recompile the current instruction.'};
    if(!receipt.readiness?.ready)return {allowed:false,reason:'The compiled instruction has unresolved blockers.'};
    const source=readBuilderContext(repoRoot,{hubRoot:env.GOVERNANCE_HUB||'C:/memory-governance-archive'});
    if(receipt.sourceCommit!==source.repo.commit)return {allowed:false,reason:'Source revision changed. Recompile against the current source.'};
    const task=source.roadmap.cards.find(c=>c.id===input.taskId);
    if(!task||task.range||task.gate||task.checkboxDpgConflict||/UNKNOWN|HOLD/i.test(task.priority||''))return {allowed:false,reason:'The canonical queue task is missing, aggregate, contradictory, held or action-gated.'};
    if(task.executionRepo!==source.repo.slug||receipt.executionRepo!==source.repo.slug)return {allowed:false,reason:'Execution repository is missing or differs from this verified checkout. Prepare the task with an explicit canonical TARGET_REPO before dispatch.'};
    if(receipt.target&&receipt.target!==input.target)return {allowed:false,reason:'The selected receiving agent differs from the compiled target.'};
    return osGate(repoRoot);
  };
  manager=createJobManager({repoRoot,store,authorizeJob,env,spawnImpl,getKey});
  const router=express.Router();
  router.get('/providers',async(req,res)=>{if(req.query.probe==='1'){await Promise.allSettled(providers.describe().filter(p=>p.configured).map(p=>providers.models(p.id,{refresh:true})));}res.json({providers:providers.describe()});});
  router.get('/providers/:id/models',async(req,res)=>res.json(await providers.models(req.params.id,{refresh:req.query.refresh==='1'})));
  router.post('/chat',async(req,res)=>providers.chat(req,res));
  router.get('/jobs/targets',async(req,res)=>res.json({targets:req.query.probe==='1'?await manager.probeCapabilities():manager.capabilities()}));
  router.use('/jobs',createJobsRouter({manager}));
  const hubRoot=env.GOVERNANCE_HUB||'C:/memory-governance-archive';
  // Web pages the Ideas page reads are saved under .runtime (gitignored), never committed.
  const web=createWebReader({dataDir:path.join(dataDir||path.join(repoRoot,'.runtime','production-builder'),'web'),getKey});
  router.use('/ideas',createIdeasRouter({skillsHome:env.BUILDER_SKILLS_HOME||path.join(hubRoot,'governance','skills','glumira-7.1'),getSource:()=>readBuilderContext(repoRoot,{hubRoot}),web}));
  router.use(createBuilderRouter({repoRoot,store,getProviderStatus,hubRoot:env.GOVERNANCE_HUB||'C:/memory-governance-archive'}));
  router.use((error,req,res,next)=>{if(res.headersSent)return next(error);res.status(error.status||500).json({error:{code:error.code||'BUILDER_OPERATION_FAILED',message:providers.scrub(error instanceof BuilderError?error.message:'Builder operation failed. Inspect the local log for a non-secret diagnostic.')}});});
  return {router,store,providers,manager,context,authorizeJob,close:()=>store.close()};
}
module.exports={createBuilderRuntime,findRepoRoot,runOsGate};
