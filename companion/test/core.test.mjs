import test from 'node:test';
import assert from 'node:assert/strict';
import {affine,activeAreas,validatePack,trainMarkers} from '../dist/core.mjs';
test('affine alignment handles rotated map and rejects collinear landmarks',()=>{
  const project=affine([{x:0,z:0,u:.1,v:.2},{x:100,z:0,u:.1,v:.8},{x:0,z:100,u:.7,v:.2}]);
  assert.ok(Math.abs(project({x:50,z:50}).u-.4)<1e-10);
  assert.ok(Math.abs(project({x:50,z:50}).v-.5)<1e-10);
  assert.throws(()=>affine([{x:0,z:0,u:0,v:0},{x:1,z:1,u:.1,v:.1},{x:2,z:2,u:.2,v:.2}]));
});
test('area entry and exit have hysteresis',()=>{
  const area={id:'a',x:.2,y:.2,w:.1,h:.1};
  assert.equal(activeAreas({u:.301,v:.25},[area]).length,0);
  assert.equal(activeAreas({u:.301,v:.25},[area],new Set(['a'])).length,1);
  assert.equal(activeAreas({u:.305,v:.25},[area],new Set(['a'])).length,0);
});
test('route imports reject malformed bounds and duplicate ids',()=>{
  const area={id:'a',name:'Puzzle',notes:'Notes',x:.9,y:0,w:.2,h:.1};
  assert.throws(()=>validatePack({version:1,name:'Route',calibration:[],areas:[area]}));
  area.x=.5;assert.throws(()=>validatePack({version:1,name:'Route',calibration:[],areas:[area,area]}));
});
test('only verified train layout becomes markers; chairlifts are excluded',()=>{
  const t={id:'train:52',identity:{path:'TrainSystem/TrainNew/TrainNetworking'},cars:Array.from({length:15},(_,i)=>({bodyPosition:{x:i,y:0,z:0}}))};
  const result=trainMarkers({trains:[t,{...t,hasCable:true}]});assert.equal(result.length,3);assert.equal(result[1].name,'Green train');assert.equal(result[1].x,5);assert.equal(result[0].provisional,false);
});
test('compact and legacy marker recordings use confirmed train identities',()=>{
  const markers=trainMarkers({trains:null,trainMarkers:[{id:'c',group:'C',x:1,y:2,z:3}]});
  assert.equal(markers[0].name,'Yellow train');assert.equal(markers[0].provisional,false);
});

