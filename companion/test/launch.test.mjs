import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {createBrowserOpener} from '../browser.mjs';

test('browser requests share a pending open, suppress repeats, and recover from failure',async()=>{
  let calls=0,time=0,release;
  const open=createBrowserOpener(()=>{calls++;return new Promise(resolve=>{release=resolve;});},()=>time);
  const first=open('http://127.0.0.1:4317/'),second=open('http://127.0.0.1:4317/');
  await Promise.resolve();release();
  assert.deepEqual(await Promise.all([first,second]),[true,false]);
  assert.equal(await open('http://127.0.0.1:4317/'),false);assert.equal(calls,1);
  time=10001;const next=open('http://127.0.0.1:4317/');await Promise.resolve();release();assert.equal(await next,true);
  let attempts=0;const flaky=createBrowserOpener(async()=>{if(++attempts===1)throw new Error('fixture failure');});
  await assert.rejects(flaky('url'),/fixture failure/);assert.equal(await flaky('url'),true);
});

async function freePort(){const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
function run(env,args=[]){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[fileURLToPath(new URL('../launch.mjs',import.meta.url)),...args],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);
  child.on('error',reject);child.on('exit',code=>resolve({code,output}));
});}

test('concurrent launchers reuse one matching server; wrong profiles are rejected; stop works',async()=>{
  const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'bigwalk-launch-test-'));
  const port=await freePort(),origin=`http://127.0.0.1:${port}`;
  const env={...process.env,PORT:String(port),COMPANION_DATA_DIR:path.join(fixture,'notes'),COMPANION_TELEMETRY_DIR:path.join(fixture,'profile [test]','companion'),COMPANION_OPEN_BROWSER:'0'};
  let pid;
  try{
    const attempts=await Promise.all([run(env),run(env)]);
    for(const attempt of attempts)assert.equal(attempt.code,0,attempt.output);
    const health=await(await fetch(origin+'/api/health')).json();pid=health.pid;
    for(const attempt of attempts)assert.ok(attempt.output.includes(`server ${pid}`),attempt.output);
    assert.equal((await run(env)).code,0);
    assert.equal((await(await fetch(origin+'/api/health')).json()).pid,pid);
    const wrong=await run({...env,COMPANION_TELEMETRY_DIR:path.join(fixture,'other-profile')});
    assert.equal(wrong.code,1);assert.match(wrong.output,/Another companion copy or profile/);
    assert.equal((await fetch(origin+'/api/shutdown',{method:'POST',headers:{Origin:'https://example.com'}})).status,403);
    assert.equal((await fetch(origin+'/api/open-browser',{method:'POST',headers:{Origin:'https://example.com'}})).status,403);
    assert.equal((await run(env,['--stop'])).code,0);
    for(let i=0;i<50;i++){try{await fetch(origin+'/api/health');await new Promise(r=>setTimeout(r,100));}catch{pid=null;break;}}
    assert.equal(pid,null,'Stopped server remained available');
  }finally{if(pid){try{process.kill(pid);}catch{}}}
});

test('an unrelated service is not reused or stopped',async()=>{
  const service=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end('{}');});
  service.listen(0,'127.0.0.1');await once(service,'listening');
  const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'bigwalk-port-test-'));
  try{
    const result=await run({...process.env,PORT:String(service.address().port),COMPANION_DATA_DIR:fixture,COMPANION_OPEN_BROWSER:'0'},['--stop']);
    assert.equal(result.code,1);assert.match(result.output,/incompatible app/);
  }finally{await new Promise(resolve=>service.close(resolve));}
});
