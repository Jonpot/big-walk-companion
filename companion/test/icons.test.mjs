import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {iconNames,hasIcon,searchIcons,appendIcon,createIconPicker} from '../dist/icons.mjs';
import {blankPack,validatePack} from '../dist/core.mjs';
test('the offline catalog includes every canonical icon in the pinned Lucide library',async()=>{
  const names=(await fs.readdir(new URL('../node_modules/lucide/dist/esm/icons/',import.meta.url))).filter(n=>n.endsWith('.mjs')).map(n=>n.slice(0,-4)).sort();
  assert.deepEqual(iconNames,names);assert.ok(iconNames.length>1800);assert.ok(hasIcon('train-front'));assert.ok(searchIcons('train front').includes('train-front'));assert.ok(searchIcons('mountain').length>0);assert.deepEqual(searchIcons('no-such-icon-fixture'),[]);
});
test('icons persist in route packs, old POIs get a default, and unknown names are rejected',()=>{
  const pack={...blankPack(),pois:[{id:'p',name:'Pin',notes:'Notes',color:'#ffd458',category:'landmark',u:.1,v:.2}]};
  assert.equal(validatePack(pack).pois[0].icon,'map-pin');pack.pois[0].icon='train-front';assert.equal(validatePack(JSON.parse(JSON.stringify(pack))).pois[0].icon,'train-front');pack.pois[0].icon='javascript:bad';assert.throws(()=>validatePack(pack));
});
test('searchable grid expands through the catalog and applies the chosen icon',async()=>{
  const dom=new JSDOM(await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8'));const before=globalThis.document;globalThis.document=dom.window.document;
  try{const $=id=>document.getElementById(id);$('iconDialog').showModal=()=>$('iconDialog').open=true;$('iconDialog').close=()=>$('iconDialog').open=false;let selected;const picker=createIconPicker(name=>selected=name);picker.open('map-pin');assert.equal($('iconGrid').children.length,100);$('moreIcons').click();assert.equal($('iconGrid').children.length,200);$('iconSearch').value='train front';$('iconSearch').dispatchEvent(new dom.window.Event('input'));const choice=$('iconGrid').querySelector('[aria-label="train-front"]');assert.ok(choice.querySelector('svg path'));choice.click();assert.equal(selected,'train-front');assert.equal($('iconDialog').open,false);const rendered=appendIcon(document.body,selected);assert.equal(rendered.dataset.lucide,selected);assert.equal(rendered.getAttribute('viewBox'),'0 0 24 24');}
  finally{globalThis.document=before;dom.window.close();}
});
