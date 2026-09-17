import test from 'node:test';
import assert from 'node:assert/strict';
import {transformAreaBounds,validatePack} from '../dist/core.mjs';
const area={id:'a',name:'Puzzle',notes:'Keep these notes',x:.2,y:.3,w:.4,h:.2};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('moving bounds preserves size and notes and clamps to the map',()=>{
 const moved=transformAreaBounds(area,'move',.1,-.1);near(moved.x,.3);near(moved.y,.2);assert.equal(moved.w,area.w);assert.equal(moved.notes,area.notes);
 const clipped=transformAreaBounds(area,'move',10,-10);near(clipped.x,.6);near(clipped.y,0);
});
test('each corner and edge resizes without moving its opposite side',()=>{
 for(const handle of ['nw','n','ne','e','se','s','sw','w']){
  const a=transformAreaBounds(area,handle,.03,.04);
  near(a.x,handle.includes('w')?.23:.2);near(a.y,handle.includes('n')?.34:.3);
  near(a.x+a.w,handle.includes('e')?.63:.6);near(a.y+a.h,handle.includes('s')?.54:.5);
 }
});
test('resize handles cannot invert rectangles or leave invalid import bounds',()=>{
 for(const handle of ['nw','n','ne','e','se','s','sw','w'])for(const delta of [-100,100]){
  const a=transformAreaBounds(area,handle,delta,delta);
  assert.ok(a.w>=.001999&&a.h>=.001999);
  assert.doesNotThrow(()=>validatePack({version:1,name:'Route',calibration:[],areas:[a]}));
 }
});
