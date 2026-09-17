import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import os from 'node:os';
const root=path.resolve(process.argv[2]||'');
if(!process.argv[2]) throw new Error('Pass an unpacked playtest package folder.');
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
for(const entry of manifest.files) {
  const bytes=await fs.readFile(path.join(root,entry.path));
  assert.equal(bytes.length,entry.bytes,entry.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(),entry.sha256,entry.path);
}
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'bigwalk-package-test-'));
await fs.copyFile(path.join(root,'data/route-pack.json'),path.join(fixture,'route-pack.json'));
const port=4320, origin=`http://127.0.0.1:${port}`;
const server=spawn(path.join(root,'runtime/node.exe'),[path.join(root,'companion/server.mjs')],{
  cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe'],
  env:{...process.env,PORT:String(port),BIGWALK_PATH:path.join(fixture,'nonexistent-test-game'),COMPANION_DATA_DIR:fixture}
});
let output='';server.stdout.on('data',c=>output+=c);server.stderr.on('data',c=>output+=c);
try {
  let ready=false;
  for(let i=0;i<100;i++) {
    if(server.exitCode!==null) throw new Error(output);
    try { const result=await fetch(origin+'/api/state'); if(result.ok){ready=true;break;} } catch {}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.ok(ready,`Package server did not start: ${output}`);
  const state=await (await fetch(origin+'/api/state')).json();
  assert.equal(state.revision,0);
  assert.equal(state.pack.calibration.length,3);
  assert.deepEqual(state.pack.areas,[]);
  assert.ok(!state.pack.assets || Object.keys(state.pack.assets).length===0);
  assert.equal((await (await fetch(origin+'/api/live')).json()).frame,null);
  assert.deepEqual(await (await fetch(origin+'/api/recordings')).json(),[]);
  const mapStatus=await(await fetch(origin+'/api/map-status')).json();
  if(!mapStatus.available){assert.equal((await fetch(origin+'/map.png')).status,404);const folder=path.join(fixture,'nonexistent-test-game/BepInEx/companion');await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,'map.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=','base64'));assert.equal((await(await fetch(origin+'/api/map-status')).json()).available,true);}
  for(const asset of ['/','/map.png','/app.mjs','/core.mjs','/styles.css','/notes.mjs','/markdown.mjs','/vendor.mjs']) {
    const response=await fetch(origin+asset);assert.equal(response.status,200,asset);
    assert.ok((await response.arrayBuffer()).byteLength>0,asset);
  }
  state.pack.assets={pixel:{name:'test.png',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII='}};
  const saved=await fetch(origin+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
  assert.equal(saved.status,200);
  const onDisk=JSON.parse(await fs.readFile(path.join(fixture,'route-pack.json'),'utf8'));
  assert.deepEqual(onDisk.pack.assets,state.pack.assets);
  assert.equal(onDisk.revision,1);
  console.log(`PASS: ${manifest.files.length} manifest hashes, bundled Node startup, empty calibrated starter, all UI assets, no recordings, image asset persistence in isolated fixture.`);
} finally { server.kill(); }
