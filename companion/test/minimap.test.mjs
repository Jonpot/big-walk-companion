import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {minimapView,renderNotesMinimap} from '../dist/minimap.mjs';
test('notes minimap follows player with independent zoom, stays inside map, and falls back to area',()=>{
  assert.deepEqual(minimapView({point:{u:.4,v:.6}}),{x:310,y:510,w:180,h:180});
  assert.deepEqual(minimapView({point:{u:.01,v:.99}}),{x:0,y:820,w:180,h:180});
  assert.deepEqual(minimapView({point:null,area:{x:.2,y:.3,w:.2,h:.4}}),{x:210.00000000000006,y:410,w:180,h:180});
});
test('open notes show selected player, routes and POIs; stale position is labeled and replay uses recorded location',async()=>{
  const dom=new JSDOM(await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8'));
  const previous=globalThis.document;globalThis.document=dom.window.document;
  try{
    const $=id=>document.getElementById(id);$('areaPopup').open=true;
    const svg=(tag,attrs,parent)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;};
    const player={id:'a',u:.4,v:.6},args={svg,pack:{areas:[],pois:[{u:.4,v:.61,color:'#ffffff'}],routes:[{points:[{u:.4,v:.6},{u:.5,v:.5}],color:'#ffd458'}]},projection:p=>p,player,players:[player],trains:[],activeArea:null,available:true,replay:false,label:'Runner',mapReady:true,mapHref:'/map.png'};
    renderNotesMinimap(args);assert.equal($('notesMiniMap').getAttribute('viewBox'),'310 510 180 180');assert.match($('notesMiniCaption').textContent,/Following · Runner/);assert.equal($('notesMiniMarkers').querySelectorAll('polyline').length,1);assert.equal($('notesMiniMarkers').querySelectorAll(':scope > circle').length,3);assert.equal($('notesMiniImage').getAttribute('href'),'/map.png');
    renderNotesMinimap({...args,available:false});assert.equal($('notesMiniCaption').textContent,'Last known position');assert.equal($('notesMiniMarkers').querySelectorAll(':scope > circle').length,1);
    renderNotesMinimap({...args,replay:true,player:{...player,u:.5}});assert.match($('notesMiniCaption').textContent,/Replay/);assert.equal($('notesMiniMap').getAttribute('viewBox'),'410 510 180 180');
  }finally{globalThis.document=previous;dom.window.close();}
});
