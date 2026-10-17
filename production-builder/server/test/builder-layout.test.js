'use strict';
// Workspace layout (founder 2026-10-15, verbatim: "add a layout icon next to scan where i can change which panes
// show in work space all 3 is default"). The page's own helpers, read from the repository root found through git.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const ROOT=require('node:child_process').execFileSync('git',['rev-parse','--show-toplevel'],{cwd:__dirname,encoding:'utf8'}).trim();
const load=()=>import(pathToFileURL(path.join(ROOT,'apps','ais-builder','src','layout.ts')).href);
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
test('layout: all three columns by default, terminal off, also for blocked or bad storage',async()=>{
  const L=await load();
  assert.deepEqual(L.readPanes(memory()),{left:true,middle:true,right:true,terminal:false});
  assert.deepEqual(L.readPanes(null),{left:true,middle:true,right:true,terminal:false});
  assert.deepEqual(L.readPanes({getItem:()=>{throw new Error('blocked');}}),{left:true,middle:true,right:true,terminal:false});
  const bad=memory();bad.setItem(L.PANES_KEY,'{not json');assert.deepEqual(L.readPanes(bad),{left:true,middle:true,right:true,terminal:false});
});
test('layout: the last shown column cannot be unticked; terminal may always flip',async()=>{
  const L=await load();
  let p=L.togglePane(L.ALL_PANES,'left');p=L.togglePane(p,'middle');
  assert.deepEqual(p,{left:false,middle:false,right:true,terminal:false});assert.equal(L.growPane(p),'right');
  assert.equal(L.togglePane(p,'right'),p,'unchanged: at least one column stays');
  assert.equal(L.growPane({left:true,middle:false,right:false,terminal:false}),'left');assert.equal(L.growPane(L.ALL_PANES),'middle');
  const withTerm=L.togglePane(L.ALL_PANES,'terminal');
  assert.equal(withTerm.terminal,true);
  assert.equal(L.togglePane(withTerm,'terminal').terminal,false);
});
test('layout: the choice survives a reload, including terminal',async()=>{
  const L=await load(),store=memory();
  L.savePanes(store,{left:true,middle:false,right:true,terminal:true});
  assert.deepEqual(L.readPanes(store),{left:true,middle:false,right:true,terminal:true});
  store.setItem(L.PANES_KEY,JSON.stringify({left:false,middle:false,right:false,terminal:true}));
  assert.deepEqual(L.readPanes(store),{left:true,middle:true,right:true,terminal:false},'none shown columns fall back to the default');
});
test('layout: a pane snapshot is capped and says when it was cut',async()=>{
  const L=await load();
  const s=L.paneSnapshot('middle','BUILD','Build list',true,'x'.repeat(L.PANE_TEXT_CAP+5));
  assert.equal(s.text.length,L.PANE_TEXT_CAP);assert.equal(s.cut,true);assert.equal(s.hidden,true);
});
