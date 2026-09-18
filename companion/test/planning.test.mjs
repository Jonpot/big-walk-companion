import test from 'node:test';
import assert from 'node:assert/strict';
import {blankPack,validatePack} from '../dist/core.mjs';
import {mergePlanningPacks,removePoi,routeDistance} from '../dist/planning-data.mjs';
const poi={id:'p',name:'Station',notes:'Meet here',u:.2,v:.3,category:'transport',color:'#ffd458'};
const route={id:'r',name:'Main route',notes:'Take the train',color:'#c5f785',points:[{u:.1,v:.1},{u:.2,v:.3}],steps:[{id:'s',name:'Board',notes:'Wait for teammate',poiId:'p'}]};
const fixture=()=>({...blankPack(),pois:[structuredClone(poi)],routes:[structuredClone(route)]});
test('v1 migration preserves areas, images and alignment; v2 round-trips planning data',()=>{
  const old={version:1,name:'Old pack',calibration:[{x:2,z:4,u:.1,v:.3}],areas:[{id:'area',name:'Puzzle',notes:'![image](asset:img)',x:0,y:0,w:.1,h:.1}],assets:{img:{name:'Image',data:'data:image/png;base64,AAAA'}}};
  const next=validatePack(old);assert.equal(next.version,2);assert.deepEqual(next.areas,old.areas);assert.deepEqual(next.assets,old.assets);assert.deepEqual(next.calibration,old.calibration);assert.deepEqual(next.pois,[]);
  assert.deepEqual(validatePack(validatePack(fixture())),validatePack(fixture()));
});
test('reject malformed geometry, dangling steps, unknown categories, duplicates and oversized routes',()=>{
  for(const mutate of [p=>p.pois[0].u=NaN,p=>p.pois[0].v=1.1,p=>p.pois[0].category='script',p=>p.routes[0].id='p',p=>p.routes[0].points=[],p=>p.routes[0].points[0].u=-1,p=>p.routes[0].steps[0].poiId='missing',p=>p.routes[0].steps.push(p.routes[0].steps[0]),p=>p.routes[0].points=Array(2001).fill({u:0,v:0}),p=>p.pois[0].color='url(javascript:evil)']){const p=fixture();mutate(p);assert.throws(()=>validatePack(p));}
});
test('merging shared packs remaps collisions and image/POI links without touching current data',()=>{
  const current=validatePack(fixture());current.assets={img:{name:'Original',data:'data:image/png;base64,AAAA'}};
  current.calibration=[{x:1,z:2,u:.1,v:.2}];
  const incoming=structuredClone(current);incoming.assets.img.name='Shared';incoming.pois[0].notes='![shared](asset:img)';incoming.routes[0].notes='![shared](asset:img)';
  let n=0;const result=validatePack(mergePlanningPacks(current,incoming,()=>`new-${++n}`));
  assert.equal(result.pois.length,2);assert.equal(result.routes.length,2);assert.equal(result.routes[1].steps[0].poiId,result.pois[1].id);assert.notEqual(result.pois[1].id,'p');assert.match(result.pois[1].notes,/asset:new-/);assert.equal(result.assets.img.name,'Original');assert.deepEqual(result.calibration,current.calibration);assert.equal(current.pois.length,1);
});
test('deleting a POI retains step instructions and removes dangling links',()=>{
  const next=validatePack(removePoi(fixture(),'p'));assert.equal(next.pois.length,0);assert.equal(next.routes[0].steps[0].poiId,'');assert.equal(next.routes[0].steps[0].notes,'Wait for teammate');
});
test('route length uses inverse affine calibration and excludes elevation',()=>{
  assert.equal(routeDistance([{u:0,v:0},{u:1,v:1}],[{x:0,z:0,u:0,v:0},{x:300,z:0,u:1,v:0},{x:0,z:400,u:0,v:1}]),500);
  assert.equal(routeDistance([],[]),null);
});
