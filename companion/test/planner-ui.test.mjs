import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {blankPack,validatePack} from '../dist/core.mjs';
import {createPlanner} from '../dist/planner.mjs';
test('planner UI creates, edits, shares and runs routes; failed saves keep draft',async()=>{
  const dom=new JSDOM(await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8'),{url:'http://127.0.0.1:4391'});
  const old={};for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,confirm:()=>true,setInterval:()=>0})){old[key]=globalThis[key];globalThis[key]=value;}
  const $=id=>document.getElementById(id);let pack=validatePack(blankPack()),fail=false,lastMessage='',planner;
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  const input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
  const pointer=(target,type,x,y)=>{const e=new dom.window.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});Object.defineProperty(e,'pointerId',{value:1});target.dispatchEvent(e);};
  try{
    for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;}
    $('map').setPointerCapture=()=>{};
    planner=createPlanner({getPack:()=>pack,savePack:async value=>{if(fail)return false;pack=validatePack(value);return true;},prepare:()=>true,redraw:()=>planner?.renderMap(1),focusMap:()=>{},mapPoint:e=>({x:e.clientX,y:e.clientY}),message:text=>lastMessage=text});planner.ready();
    $('addPoi').click();pointer($('map'),'pointerdown',250,300);input('planName','Station');input('planNotes','Meet the team');input('poiCategory','transport');$('savePlan').click();await tick();
    assert.equal(pack.pois[0].name,'Station');assert.equal(pack.pois[0].u,.25);assert.equal($('planEditor').hidden,true);
    $('addRoute').click();pointer($('map'),'pointerdown',100,100);pointer($('map'),'pointerdown',250,300);pointer($('map'),'pointerdown',400,350);$('undoPoint').click();assert.equal($('finishPath').disabled,false);$('finishPath').click();input('planName','Island sprint');$('stepPoi').value=pack.pois[0].id;$('addStep').click();$('stepPoi').value='';$('addStep').click();$('savePlan').click();await tick();
    assert.equal(pack.routes[0].points.length,2);assert.equal(pack.routes[0].steps.length,2);assert.equal(pack.routes[0].steps[0].poiId,pack.pois[0].id);
    // Editing a saved route supports vertex dragging, insertion and cancel without mutating saved geometry.
    $('routeList').querySelector('.plan-item').click();$('adjustPath').click();const handle=$('planningMap').querySelector('[data-vertex="0"]');pointer(handle,'pointerdown',100,100);pointer($('map'),'pointermove',120,140);pointer($('map'),'pointerup',120,140);
    const segment=$('planningMap').querySelector('[data-segment="0"]');pointer(segment,'pointerdown',180,220);$('savePlan').click();await tick();assert.deepEqual(pack.routes[0].points[0],{u:.12,v:.14});assert.equal(pack.routes[0].points.length,3);
    $('routeList').querySelector('.plan-item').click();input('planName','Unsaved rename');fail=true;$('savePlan').click();await tick();assert.equal($('planEditor').hidden,false);assert.equal(pack.routes[0].name,'Island sprint');assert.match(localStorage.getItem('bigwalk-planner-draft-v2'),/Unsaved rename/);fail=false;$('cancelPlan').click();assert.equal(pack.routes[0].name,'Island sprint');
    input('planSearch','missing');assert.equal($('poiList').querySelectorAll('.plan-row').length,0);input('planSearch','');
    planner.offerImport(validatePack(JSON.parse(JSON.stringify(pack))));assert.equal($('importDialog').open,true);$('mergePack').click();await tick();assert.equal(pack.routes.length,2);assert.equal(pack.pois.length,2);assert.notEqual(pack.routes[1].steps[0].poiId,pack.routes[0].steps[0].poiId);
    $('routeList').querySelector('.plan-row').lastElementChild.click();assert.equal($('runPanel').hidden,false);$('startRun').click();assert.equal($('startRun').textContent,'Pause timer');$('runSteps').querySelector('input').click();assert.match($('nextObjective').textContent,/New step/);$('startRun').click();assert.equal(JSON.parse(localStorage.getItem('bigwalk-run-v2')).started,null);assert.match(lastMessage,/imported/);
  }finally{for(const [key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}dom.window.close();}
});

test('hands-free run follows live player, advances under notes, stops at finish and never writes the plan',async()=>{
  const dom=new JSDOM(await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8'),{url:'http://127.0.0.1:4393'});
  const old={};for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,confirm:()=>true,setInterval:()=>0})){old[key]=globalThis[key];globalThis[key]=value;}
  try{
    const $=id=>document.getElementById(id),pack=validatePack({...blankPack(),calibration:[{x:0,z:0,u:0,v:0},{x:1000,z:0,u:1,v:0},{x:0,z:1000,u:0,v:1}],pois:[{id:'p',name:'First',notes:'',color:'#ffffff',category:'landmark',u:.2,v:.2},{id:'q',name:'Second',notes:'',color:'#ffffff',category:'landmark',u:.8,v:.8}],routes:[{id:'r',name:'Run',notes:'',color:'#ffffff',points:[{u:.2,v:.2},{u:.8,v:.8}],steps:[{id:'a',name:'First',notes:'Instructions',poiId:'p'},{id:'b',name:'Second',notes:'Finish',poiId:'q'}]}]}),before=JSON.stringify(pack);let follows=0;
    const planner=createPlanner({getPack:()=>pack,savePack:()=>{throw new Error('Attempt must not rewrite plan');},prepare:()=>true,redraw:()=>{},focusMap:()=>{},mapPoint:()=>{},message:()=>{},followMap:()=>follows++});planner.ready();
    $('routeList').querySelector('.plan-row').lastElementChild.click();$('startRun').click();
    const update=(u,t,extra={})=>planner.updateTracking({player:{id:'runner',local:true,u,v:u},frame:{runId:'game',timestamp:t,sequence:t},projection:p=>p,replay:false,ageMs:0,...extra});
    update(.2,1000);$('areaPopup').open=true;planner.renderFocus();assert.equal($('runFocus').parentElement,$('areaPopup'));assert.equal($('runFocus').hidden,false);
    update(.2,1600);assert.match($('focusTitle').textContent,/First/);assert.match($('focusStatus').textContent,/instructions stay/);update(.23,1800);assert.match($('focusTitle').textContent,/Second/);assert.equal($('runSteps').querySelectorAll('.run-step').length,1);assert.ok(follows>0);
    update(.8,2200,{replay:true});update(.8,2800);assert.match($('focusTitle').textContent,/Second/);update(.8,3400);assert.match($('focusTitle').textContent,/Second/);update(.83,4000);
    assert.equal($('focusTitle').textContent,'Route complete');assert.equal($('runSteps').children.length,0);const saved=JSON.parse(localStorage.getItem('bigwalk-run-v2'));assert.equal(saved.started,null);assert.deepEqual(saved.done,['a','b']);assert.equal(JSON.stringify(pack),before);
  }finally{for(const [key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}dom.window.close();}
});
