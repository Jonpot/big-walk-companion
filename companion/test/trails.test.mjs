import test from 'node:test';
import assert from 'node:assert/strict';
import {fadedTrailPaths} from '../dist/core.mjs';
const project=p=>({u:p.x/1000,v:p.z/1000});
const p=(x,t)=>({x,z:0,timestamp:t*1000});
test('trail window clips old segments and fades toward the cutoff',()=>{
 const paths=fadedTrailPaths([p(0,0),p(10,30),p(20,60),p(30,90)],project,90000,45);
 assert.equal(paths.length,2);
 assert.equal(paths[0].d,'M15,0L20,0');assert.equal(paths[1].d,'M20,0L30,0');
 assert.ok(paths[0].opacity<paths[1].opacity);
 assert.deepEqual(fadedTrailPaths([p(0,0),p(10,30)],project,90000,45),[]);
});
test('paused replay stays deterministic and future points are clipped',()=>{
 const points=[p(0,0),p(10,30),p(20,60)];
 const result=fadedTrailPaths(points,project,45000,60);
 assert.equal(result.at(-1).d,'M10,0L15,0');
 assert.deepEqual(result,fadedTrailPaths(points,project,45000,60));
});
test('teleports do not create connecting trails and slider changes reveal retained history',()=>{
 assert.deepEqual(fadedTrailPaths([p(0,0),p(500,30)],project,30000,60),[]);
 const points=[p(0,0),p(10,30),p(20,60),p(30,90)];
 assert.ok(fadedTrailPaths(points,project,90000,120).length>fadedTrailPaths(points,project,90000,30).length);
});
