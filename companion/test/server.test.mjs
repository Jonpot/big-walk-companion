import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
test('route saves persist, conflicts are rejected, and foreign origins cannot write',async()=>{
  const data=await fs.mkdtemp(path.join(os.tmpdir(),'bigwalk-companion-test-'));
  const root=fileURLToPath(new URL('..',import.meta.url));
  const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'4318',COMPANION_DATA_DIR:data},stdio:['ignore','pipe','pipe']});
  try{
    await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw new Error('Test server exited early');}),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Startup timed out')),10000);timer.unref();})]);
    const base='http://127.0.0.1:4318';
    const state=await(await fetch(base+'/api/state')).json();
    state.pack.areas.push({id:'fixture',name:'Test area',notes:'Line 1\nLine 2',x:.2,y:.2,w:.1,h:.1});
    const options={method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)};
    assert.equal((await fetch(base+'/api/state',options)).status,200);
    assert.equal((await fetch(base+'/api/state',options)).status,409);
    assert.equal((await fetch(base+'/api/state',{...options,headers:{...options.headers,Origin:'https://example.com'}})).status,403);
    assert.equal((await fetch(base+'/api/recording?id=../../README.md')).status,404);
    const saved=JSON.parse(await fs.readFile(path.join(data,'route-pack.json'),'utf8'));
    assert.equal(saved.pack.areas[0].notes,'Line 1\nLine 2');
    assert.equal(saved.revision,1);
    const invalid={...saved,pack:{...saved.pack,calibration:[{x:0,z:0,u:2,v:0}]}};
    assert.equal((await fetch(base+'/api/state',{...options,body:JSON.stringify(invalid)})).status,400);
  }finally{const exited=once(child,'exit');child.kill();await exited;}
});
