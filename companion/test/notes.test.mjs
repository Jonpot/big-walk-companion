import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {validatePack,moveMarkdownBlock,popupTransition} from '../dist/core.mjs';
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
test('embedded note images survive pack validation and reject active content/oversize',()=>{
 const pack={version:1,name:'Test',calibration:[],areas:[{id:'a',name:'Area',notes:'![Image](asset:abc "width=50 align=right")',x:0,y:0,w:.1,h:.1}],assets:{abc:{name:'Image',data:pixel}}};
 assert.deepEqual(validatePack(pack).assets,pack.assets);
 assert.throws(()=>validatePack({...pack,assets:{abc:{name:'bad',data:'data:image/svg+xml;base64,PHN2Zz4='}}}));
 assert.throws(()=>validatePack({...pack,assets:{abc:{name:'huge',data:'data:image/png;base64,'+'A'.repeat(7_000_001)}}}));
 assert.equal(validatePack({...pack,assets:undefined}).areas[0].notes,pack.areas[0].notes);
});
test('area popups preserve minimization until exit or new area entry',()=>{
 let p=popupTransition({ids:[],minimized:false},['a']);assert.equal(p.minimized,false);
 p.minimized=true;p=popupTransition(p,['a']);assert.equal(p.minimized,true);
 p=popupTransition(p,['a','b']);assert.equal(p.minimized,false);
 p.minimized=true;p=popupTransition(p,[]);assert.equal(p.minimized,false);
 p=popupTransition(p,['a']);assert.equal(p.minimized,false);
});
test('dragging Markdown blocks preserves images and surrounding text',()=>{
 const a='First\n\n',b='![Image](asset:abc)\n\n',c='Last\n\n',s=a+b+c;
 assert.equal(moveMarkdownBlock(s,a.length,a.length+b.length,s.length),a+c+b);
 assert.equal(moveMarkdownBlock(s,a.length,a.length+b.length,0),b+a+c);
 assert.equal(moveMarkdownBlock(s,a.length,a.length+b.length,a.length+2),s);
});
test('Markdown supports formatting and local images without executable HTML or remote image loads',async()=>{
 const dom=new JSDOM('<div id="target"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;
 const {renderMarkdown}=await import('../dist/markdown.mjs');const target=document.getElementById('target');
 renderMarkdown(target,'## Puzzle\n\n- [x] Done\n\n| Role | Task |\n| --- | --- |\n| A | **Go** |\n\n![Route](asset:abc "width=50 align=right")\n\n<script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">bad</a>',{abc:{name:'x',data:pixel}});
 assert.equal(target.querySelector('h2').textContent,'Puzzle');assert.ok(target.querySelector('table'));assert.ok(target.querySelector('strong'));
 assert.equal(target.querySelectorAll('img').length,1);assert.equal(target.querySelector('img').style.width,'50%');assert.equal(target.querySelector('img').style.marginLeft,'auto');
 assert.equal(target.querySelectorAll('script,[onerror],a[href^="javascript:"]').length,0);assert.equal(target.querySelector('input').disabled,true);
});
