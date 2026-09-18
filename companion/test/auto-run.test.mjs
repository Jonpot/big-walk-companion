import test from 'node:test';
import assert from 'node:assert/strict';
import {createArrivalTracker,guideSegment} from '../dist/auto-run.mjs';
const pack={calibration:[{x:0,z:0,u:0,v:0},{x:1000,z:0,u:1,v:0},{x:0,z:1000,u:0,v:1}],pois:[{id:'p',u:.2,v:.2},{id:'q',u:.8,v:.8}]};
const route={steps:[{id:'a',poiId:'p'},{id:'b',poiId:'q'}]};
const sample=(more={})=>({pack,route,done:[],point:{u:.2,v:.2},playerId:'one',sessionId:'game',timestamp:1000,sequence:1,active:true,replay:false,ageMs:0,radius:12,...more});
test('arrival requires consecutive fresh samples and completes only the next POI',()=>{
  const t=createArrivalTracker();assert.deepEqual(t.update(sample()).completed,[]);
  assert.equal(t.update(sample({timestamp:1600,sequence:2})).arrived,true);
  assert.deepEqual(t.update(sample({point:{u:.217,v:.2},timestamp:1900,sequence:3})).completed,[]);
  assert.deepEqual(t.update(sample({point:{u:.22,v:.2},timestamp:2000,sequence:4})).completed,['a']);
  assert.deepEqual(t.update(sample({done:['a'],timestamp:2200,sequence:3})).completed,[]);
  assert.deepEqual(t.update(sample({done:['a'],point:{u:.8,v:.8},timestamp:2800,sequence:4})).completed,[]);
  assert.equal(t.update(sample({done:['a'],point:{u:.8,v:.8},timestamp:3400,sequence:5})).arrived,true);
  assert.deepEqual(t.update(sample({done:['a'],point:{u:.83,v:.8},timestamp:4000,sequence:6})).completed,['b']);
});
test('duplicate frames, stale data, replay, pause and player changes cannot complete a step',()=>{
  for(const invalid of [{ageMs:3000},{replay:true},{active:false},{playerId:'two'}]){const t=createArrivalTracker();t.update(sample());assert.deepEqual(t.update(sample({...invalid,timestamp:1700})).completed,[]);}
  const t=createArrivalTracker();t.update(sample());assert.deepEqual(t.update(sample()).completed,[]);assert.deepEqual(t.update(sample({timestamp:4000})).completed,[]);
});
test('leaving the arrival radius resets dwell; map calibration measures world units',()=>{
  const t=createArrivalTracker();t.update(sample());const result=t.update(sample({point:{u:.22,v:.2},timestamp:1300}));assert.ok(Math.abs(result.distance-20)<.001);assert.deepEqual(result.completed,[]);assert.deepEqual(t.update(sample({timestamp:1600})).completed,[]);assert.equal(t.update(sample({timestamp:2200})).arrived,true);assert.deepEqual(t.update(sample({timestamp:2800,point:{u:.23,v:.2}})).completed,['a']);
});
test('instruction-only steps accompany checkpoints without blocking hands-free progress',()=>{
  const r={steps:[{id:'intro',poiId:''},{id:'a',poiId:'p'},{id:'outro',poiId:''}]},t=createArrivalTracker();t.update(sample({route:r}));assert.equal(t.update(sample({route:r,timestamp:1600})).arrived,true);assert.deepEqual(t.update(sample({route:r,timestamp:2200,point:{u:.23,v:.2}})).completed,['intro','a','outro']);
});
test('guidance traces the drawn bends between player and target in either direction',()=>{
  const points=[{u:0,v:0},{u:1,v:0},{u:1,v:1}];
  assert.deepEqual(guideSegment(points,{u:.5,v:0},{u:1,v:.5}),[{u:.5,v:0},{u:1,v:0},{u:1,v:.5}]);
  assert.deepEqual(guideSegment(points,{u:1,v:.5},{u:.5,v:0}),[{u:1,v:.5},{u:1,v:0},{u:.5,v:0}]);
});
