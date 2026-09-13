// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
import test from 'node:test';
import assert from 'node:assert/strict';
import { equivalentPDFLayouts } from '../src/pdf/pdf-layout-equivalence.js';
import { extractMarkdownAssetOutline } from '../src/markdown/markdown-asset-outline.js';

function document() {
    return {pages:[{normalizedText:'Text',viewport:{width:600,height:800,transform:[1,0,0,-1,0,800]},items:[{text:'Text',direction:'ltr',width:30,height:10,transform:[10,0,0,10,50,700],fontName:'font1'}]}]};
}
test('matches page text geometry despite regenerated PDF font IDs',()=>{
    const left=document(),right=document();right.pages[0].items[0].fontName='font2';
    assert.equal(equivalentPDFLayouts(left,right),true);
});
for(const [name,change] of [
    ['different page counts',d=>d.pages.push(structuredClone(d.pages[0]))],
    ['different text',d=>d.pages[0].normalizedText='Other'],
    ['different coordinates',d=>d.pages[0].items[0].transform[4]+=20],
    ['different page size',d=>d.pages[0].viewport.height=840],
    ['blank scanned pages',d=>d.pages[0].normalizedText=''],
]) test('rejects '+name,()=>{const right=document();change(right);assert.equal(equivalentPDFLayouts(document(),right),false);});

test('Figures finds GPU OCR captions split into letters without changing source offsets',()=>{
    const md='# Heading\n\n![](images/a.jpg)\n\nF I G U RE 1 Legend on next page.\n';
    const items=extractMarkdownAssetOutline(md);
    assert.equal(items.length,1);assert.equal(items[0].imageSource,'images/a.jpg');
    assert.ok(items[0].offset>=0);assert.ok(items[0].text.startsWith('Figure 1.'));
});
test('does not turn ordinary figure prose or code into a Figures entry',()=>{
    assert.equal(extractMarkdownAssetOutline('Figure 1 shows results.').length,0);
    assert.equal(extractMarkdownAssetOutline('```\n![](images/a.jpg)\n\nF I G U RE 1 fake\n```').length,0);
});
