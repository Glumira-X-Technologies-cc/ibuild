'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {resolvePageContext}=require('../builder-page-context');
// The Vault root, built at run time: this live file never holds a Vault path (Six Libraries plan, step 4).
const V5=['Vaults','5-Builder'].join('/');
function fixture(){
 const pages={'Page-Doc-Production-Builder':{layer:'Doc',kind:'folder',path:V5+'/Rows/5.13/Books/Book-Production-Builder/Page-Doc',files:['Architecture.md']},'Page-Missing':{layer:'Prog',status:'MISSING'}};
 const cabinet={name:'Cabinet-Production-Builder',file:V5+'/Rows/5.13/Cabinet.md',summary:['Read the Book if: you change the builder.','Stop here if: unrelated subject.'],summary_source:'Copied from Cabinet.md',books:{'Book-Production-Builder':{path:V5+'/Rows/5.13/Books/Book-Production-Builder',pages}}};
 const rows={'5.1':{name:'Unfiled',status:'[OPEN] NO BOOK - unaccounted for'},'5.13':{name:'Production Builder',path:V5+'/Rows/5.13',note:'Builder tool only',cabinet}};
 return {repo:{commit:'pinned-commit'},os:{documents:[{path:'Library/OS/START.md',text:'The pinned OS start instructions.'}]},foyer:{vaults:{'5':{name:'Builder',path:V5,rows}}}};
}
test('vault, row and Cabinet selections provide pinned labels and boundary summaries without bulk Book content',()=>{
 const f=fixture(),before=JSON.stringify(f);
 const vault=resolvePageContext('vault:5',f);assert.equal(vault.labels.vault,'Builder');assert.equal(vault.children[1].nodeId,'row:5.13');assert.equal(vault.contentRead,false);
 const row=resolvePageContext('row:5.13',f);assert.equal(row.labels.row,'Production Builder');assert.equal(row.summary.length,2);assert.equal(row.sourceCommit,'pinned-commit');assert.equal(row.note,'Builder tool only');
 const cabinet=resolvePageContext('cabinet:5.13',f);assert.equal(cabinet.path,V5+'/Rows/5.13/Cabinet.md');assert.equal(cabinet.children[0].nodeId,'book:Book-Production-Builder');assert.equal(cabinet.text,undefined);assert.equal(JSON.stringify(f),before);
});
test('Book and Page selections retain Cabinet gate and expose only selected Page metadata',()=>{
 const f=fixture(),book=resolvePageContext('book:Book-Production-Builder',f),page=resolvePageContext('page:Book-Production-Builder:Page-Doc-Production-Builder',f);
 assert.equal(book.children.length,2);assert.equal(book.contentRead,false);assert.equal(page.layer,'Doc');assert.deepEqual(page.files,['Architecture.md']);assert.equal(page.summary.length,2);assert.equal(page.text,undefined);assert.equal(page.contentRead,false);assert.ok(page.readPaths.includes('Foyer/FOYER.json'));
 const missing=resolvePageContext('page:Book-Production-Builder:Page-Missing',f);assert.equal(missing.status,'MISSING');assert.equal(missing.path,null);
});
test('OS selection returns only the selected already-pinned document and never resolves arbitrary paths',()=>{
 const f=fixture(),os=resolvePageContext('os:Library/OS/START.md',f);assert.equal(os.contentRead,true);assert.equal(os.text,'The pinned OS start instructions.');assert.deepEqual(os.readPaths,['Library/OS/START.md']);
 for(const id of ['os:../../keys','os:Library/OS/UNKNOWN.md','page:Unknown:Unknown',null])assert.equal(resolvePageContext(id,f).resolved,false);
});
test('unfiled Row stays unaccounted and duplicate Book identifiers fail closed',()=>{
 const f=fixture();assert.equal(resolvePageContext('row:5.1',f).status,'[OPEN] NO BOOK - unaccounted for');assert.equal(resolvePageContext('cabinet:5.1',f).resolved,false);
 f.foyer.vaults['5'].rows['5.14']=structuredClone(f.foyer.vaults['5'].rows['5.13']);const duplicate=resolvePageContext('book:Book-Production-Builder',f);assert.equal(duplicate.resolved,false);assert.match(duplicate.reason,/ambiguous/);
});
