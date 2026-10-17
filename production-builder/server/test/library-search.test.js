'use strict';
// Card 01-29 slice B: "search finds a known item and hides the rest".
// The filter lives in the page, but it is a pure module with no browser and no fetch, so the server
// suite imports it directly (Node strips the type annotations). No repo checkout is needed.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const fromPage=(rel)=>import(pathToFileURL(path.join(__dirname,'..','..','page','src',rel)).href);
let cached=null;
async function page(){ if(!cached){const [search,law]=await Promise.all([fromPage('library-search.ts'),fromPage('library-law.ts')]);cached={...search,...law};} return cached; }

test('search finds a known item and hides the rest',async()=>{
 const {libraryLaw,visibleNodes,visibleLeaves,subtreeMatches}=await page();
 const known='Onboarding-Insulin';
 assert.ok(subtreeMatches(libraryLaw,known),'the known item is in the committed law tree');
 // Exactly one leaf survives: the item itself. Everything else is hidden.
 const leaves=visibleLeaves(libraryLaw.children||[],known);
 assert.deepEqual(leaves.map(n=>n.name),[known]);
 // Its ancestors stay, so the path to the hit is never filtered away.
 const tops=visibleNodes(libraryLaw.children||[],known);
 assert.deepEqual(tops.map(n=>n.name),['GLUMIRA 7.2']);
 // The unfiltered tree is much larger than the filtered one: the rest really was hidden.
 assert.ok(visibleLeaves(libraryLaw.children||[],'').length>20,'the committed law tree is substantial');
 assert.equal(visibleLeaves(libraryLaw.children||[],known).length,1);
 // A term that appears in several places finds all of them, not just the first.
 assert.ok(visibleLeaves(libraryLaw.children||[],'onboarding-').length>1);
 // A term that is not on the law tree hides everything.
 assert.deepEqual(visibleNodes(libraryLaw.children||[],'no-such-place-anywhere'),[]);
 assert.deepEqual(visibleLeaves(libraryLaw.children||[],'no-such-place-anywhere'),[]);
 // An empty query is not a filter: every top-level row and every leaf is drawn.
 assert.deepEqual(visibleNodes(libraryLaw.children||[],'  '),(libraryLaw.children||[]));
});

test('search reads the title and the text, not the title alone',async()=>{
 const {libraryLaw,visibleLeaves,nodeMatches}=await page();
 // 'Subscription Tiers' never says 'unaccounted' in its title; the note is what matches.
 const byText=visibleLeaves(libraryLaw.children||[],'unaccounted for');
 assert.ok(byText.some(n=>n.name==='Subscription Tiers'),'a note match is found');
 assert.ok(!nodeMatches({name:'Subscription Tiers'},'unaccounted for'));
 assert.ok(nodeMatches({name:'Subscription Tiers',note:'NO BOOK - unaccounted for'},'unaccounted for'));
 // Matching is case- and whitespace-insensitive in both directions.
 assert.ok(nodeMatches({name:'Onboarding-Insulin'},'ONBOARDING-INSULIN'));
 assert.ok(nodeMatches({name:'Onboarding-Insulin'},'  insulin  '));
 assert.equal(nodeMatches({name:'Onboarding-Insulin'},''),true);
});

test('highlighting marks every match and never changes the text',async()=>{
 const {segments,visibleLeaves}=await page();
 const known='Onboarding-Insulin';
 const node=visibleLeaves((await page()).libraryLaw.children||[],known)[0];
 const parts=segments(node.name,known);
 assert.equal(parts.map(p=>p.text).join(''),node.name,'the text is reproduced exactly');
 assert.deepEqual(parts,[{text:known,hit:true}]);
 // Casing is preserved in the marked run, and every occurrence is marked.
 const mixed=segments('Onboarding-Insulin and Onboarding-Insulin again','insulin');
 assert.equal(mixed.map(p=>p.text).join(''),'Onboarding-Insulin and Onboarding-Insulin again');
 assert.deepEqual(mixed.filter(p=>p.hit).map(p=>p.text),['Insulin','Insulin']);
 // No query means no marks; empty text means no segments.
 assert.deepEqual(segments('Onboarding-Insulin',''),[{text:'Onboarding-Insulin',hit:false}]);
 assert.deepEqual(segments('',known),[]);
 // A query full of regex metacharacters is matched literally, never compiled.
 const odd=segments('cost: 100% (a+b) [c]','(a+b)');
 assert.deepEqual(odd.filter(p=>p.hit).map(p=>p.text),['(a+b)']);
});

test('the same query over the same tree always returns the same rows in the same order',async()=>{
 const {libraryLaw,visibleLeaves,visibleNodes}=await page();
 for(const query of ['','onboarding','insulin','glu','unaccounted for','z']) {
  assert.deepEqual(visibleLeaves(libraryLaw.children||[],query),visibleLeaves(libraryLaw.children||[],query),'query '+JSON.stringify(query));
  assert.deepEqual(visibleNodes(libraryLaw.children||[],query),visibleNodes(libraryLaw.children||[],query),'query '+JSON.stringify(query));
 }
 // Order is the law tree's own order, never re-sorted by the search.
 assert.deepEqual(visibleNodes(libraryLaw.children||[],'e').map(n=>n.name),['GLUMIRA 7.2']);
});
