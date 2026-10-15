'use strict';
// Pure projection of the already pinned bootstrap. This module never reads files,
// opens a Book, executes a Page's run field, or promotes metadata into authority.
function resolvePageContext(nodeId,bootstrap) {
  const base={nodeId:typeof nodeId==='string'?nodeId:null,sourceCommit:bootstrap?.repo?.commit||null,resolved:false,path:null,readPaths:[],labels:{},summary:[],contentRead:false,boundary:'Cabinet summary governs whether a Book may be opened. Metadata is not execution authority.'};
  const unresolved=reason=>({...base,status:'unresolved',reason});
  if(typeof nodeId!=='string'||nodeId.length>1000)return unresolved('No valid selected node');
  const safe=p=>typeof p==='string'&&/^(Library|Foyer|Vaults)\//.test(p)&&!p.includes('\\')&&!p.includes(':')&&!p.split('/').some(s=>!s||s==='.'||s==='..');
  const paths=(...values)=>[...new Set(values.filter(safe))];
  if(nodeId.startsWith('os:')){
    const p=nodeId.slice(3),document=bootstrap?.os?.documents?.find(d=>d.path===p);
    if(!safe(p)||!document||typeof document.text!=='string')return unresolved('Selected OS document is not present in the pinned bootstrap');
    return {...base,resolved:true,kind:'os',path:p,readPaths:[p],labels:{os:p.split('/').at(-1)},status:'pinned document',text:document.text,contentRead:true,boundary:'This is the selected OS document already loaded in the pinned bootstrap; no additional files were read.'};
  }
  const parts=nodeId.split(':'),kind=parts[0],key=parts[1];
  if(!['vault','row','cabinet','book','page'].includes(kind)||parts.length!==(kind==='page'?3:2)||!key)return unresolved('Unsupported selected node identifier');
  const matches=[];
  for(const [vaultId,vault] of Object.entries(bootstrap?.foyer?.vaults||{})){
    if(kind==='vault'&&vaultId===key)matches.push({vaultId,vault});
    for(const [rowId,row] of Object.entries(vault.rows||{})){
      if((kind==='row'||kind==='cabinet')&&rowId===key)matches.push({vaultId,vault,rowId,row,cabinet:row.cabinet});
      for(const [bookId,book] of Object.entries(row.cabinet?.books||{}))if((kind==='book'||kind==='page')&&bookId===key){
        if(kind==='book')matches.push({vaultId,vault,rowId,row,cabinet:row.cabinet,bookId,book});
        else if(Object.hasOwn(book.pages||{},parts[2]))matches.push({vaultId,vault,rowId,row,cabinet:row.cabinet,bookId,book,pageId:parts[2],page:book.pages[parts[2]]});
      }
    }
  }
  if(matches.length!==1)return unresolved(matches.length?'The selected identifier is ambiguous in the pinned Foyer':'Selected node is not filed in the pinned Foyer');
  const m=matches[0];
  if(kind==='cabinet'&&!m.cabinet)return unresolved('Selected Row has no Cabinet in the pinned Foyer');
  const labels={vault:m.vault.name||m.vaultId};
  if(m.row)labels.row=m.row.name||m.rowId;if(m.cabinet)labels.cabinet=m.cabinet.name||m.rowId;if(m.book)labels.book=m.bookId;if(m.page)labels.page=m.pageId;
  const selected=kind==='vault'?m.vault:kind==='row'?m.row:kind==='cabinet'?m.cabinet:kind==='book'?m.book:m.page;
  const selectedPath=kind==='cabinet'?m.cabinet.file:selected.path;
  const summary=Array.isArray(m.cabinet?.summary)?m.cabinet.summary.filter(s=>typeof s==='string'):[];
  const result={...base,resolved:true,kind,labels,path:safe(selectedPath)?selectedPath:null,readPaths:paths('Foyer/FOYER.json',m.vault.path,m.row?.path,m.cabinet?.file,selectedPath),status:selected.status||'filed metadata',summary:[...summary],summarySource:m.cabinet?.summary_source||null,note:m.row?.note||selected.note||null};
  if(kind==='vault')result.children=Object.entries(m.vault.rows||{}).map(([id,r])=>({nodeId:'row:'+id,label:r.name||id,status:r.status||'filed metadata'}));
  if(kind==='row'||kind==='cabinet')result.children=Object.keys(m.cabinet?.books||{}).map(id=>({nodeId:'book:'+id,label:id}));
  if(kind==='book')result.children=Object.entries(m.book.pages||{}).map(([id,p])=>({nodeId:'page:'+m.bookId+':'+id,label:id,layer:p.layer||null,status:p.status||'filed metadata'}));
  if(kind==='page'){result.layer=m.page.layer||null;result.pageKind=m.page.kind||null;result.files=Array.isArray(m.page.files)?m.page.files.filter(f=>typeof f==='string'):[];result.entry=m.page.entry||null;result.blob=m.page.blob||null;}
  return result;
}
// The chat reads the founder's other two panes (founder 2026-10-15, verbatim: "Add function to chat that can read
// the other 2 panes"). The page sends what the left and middle panes show; this projection keeps only the
// known fields, caps each pane and the total, passes all text through the credential scrubber, and says when
// a pane is hidden or was cut. It never reads files.
const PANE_CAP=12000,PANES_TOTAL_CAP=24000;
function resolvePanes(panes,scrub=t=>String(t)){
  if(!Array.isArray(panes))return [];
  let room=PANES_TOTAL_CAP;
  return panes.filter(p=>p&&typeof p==='object'&&['left','middle'].includes(p.pane)).slice(0,2).map(p=>{
    const raw=scrub(typeof p.text==='string'?p.text:''),keep=Math.max(0,Math.min(PANE_CAP,room,raw.length));room-=keep;
    const cut=Boolean(p.cut)||raw.length>keep;
    const out={pane:p.pane,tab:scrub(String(p.tab||'')).slice(0,40),title:scrub(String(p.title||'')).slice(0,120),hidden:p.hidden===true,cut,text:raw.slice(0,keep)};
    out.note=[out.hidden?'This pane is hidden on the founder\'s screen; say so when you use it.':'',cut?'This pane was cut to fit; say so when it matters.':''].filter(Boolean).join(' ')||undefined;
    return out;
  });
}
// What is stored with a chat message: the pane titles only, never the pane text.
function storedContext(context){
  if(!context||!Array.isArray(context.panes))return context;
  return {...context,panes:context.panes.filter(p=>p&&typeof p==='object').slice(0,2).map(p=>({pane:String(p.pane||'').slice(0,10),title:String(p.title||'').slice(0,120),hidden:p.hidden===true}))};
}
module.exports={resolvePageContext,resolvePanes,storedContext,PANE_CAP,PANES_TOTAL_CAP};
