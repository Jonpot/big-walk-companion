import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root=path.dirname(fileURLToPath(import.meta.url));
const data=path.resolve(process.env.COMPANION_DATA_DIR||path.join(root,'../data'));
const game=process.env.BIGWALK_PATH||'C:/Program Files (x86)/Steam/steamapps/common/Big Walk';
const telemetry=path.resolve(process.env.COMPANION_TELEMETRY_DIR||path.join(game,'BepInEx/companion'));
const port=Number(process.env.PORT||4317);
const origin=`http://127.0.0.1:${port}`;
const samePath=(a,b)=>typeof a==='string'&&path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function health(){
  let response;
  try{response=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(600)});}
  catch{return null;}
  if(!response.ok)throw new Error(`Another app or an older companion uses port ${port}. Close it, then start the companion again.`);
  const value=await response.json();
  if(value.app!=='big-walk-companion'||value.launchProtocol!==1)
    throw new Error(`Port ${port} is occupied by an incompatible app.`);
  if(!samePath(value.dataDirectory,data)||!samePath(value.telemetryDirectory,telemetry))
    throw new Error(`Another companion copy or profile is running on port ${port}. Close that copy before opening this one.`);
  return value;
}

async function main(){
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid companion port.');
  await fs.mkdir(data,{recursive:true});
  let active=await health();
  if(process.argv.includes('--stop')){
    if(active){
      const response=await fetch(origin+'/api/shutdown',{method:'POST',signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw new Error('Could not stop the companion.');
    }
    console.log(active?'Companion stopped.':'Companion is not running.');
    return;
  }
  if(active&&active.appVersion!=='0.3.1'){
    const response=await fetch(origin+'/api/shutdown',{method:'POST',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('Could not stop the previous companion version.');
    const deadline=Date.now()+5000;
    do{await pause(100);active=await health();}while(active&&Date.now()<deadline);
    if(active)throw new Error('The previous companion is still closing. Start again in a moment.');
  }
  if(!active){
    const log=await fs.open(path.join(data,'server.log'),'a');
    let spawnError;
    try{
      const child=spawn(process.execPath,[path.join(root,'server.mjs')],{
        cwd:root,windowsHide:true,detached:true,stdio:['ignore',log.fd,log.fd],
        env:{...process.env,COMPANION_DATA_DIR:data,COMPANION_TELEMETRY_DIR:telemetry,PORT:String(port)}
      });
      child.once('error',error=>{spawnError=error;});
      child.unref();
    }finally{await log.close();}
    const deadline=Date.now()+15000;
    while(Date.now()<deadline){
      if(spawnError)throw spawnError;
      await pause(200);
      active=await health();
      if(active)break;
    }
    if(!active)throw new Error('The companion did not start within 15 seconds. See data/server.log.');
  }
  if(process.env.COMPANION_OPEN_BROWSER!=='0'){
    const response=await fetch(origin+'/api/open-browser',{method:'POST',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error(`Companion is running at ${origin}, but the browser could not open.`);
  }
  const message=`Companion ready at ${origin} (server ${active.pid}).`;
  await fs.appendFile(path.join(data,'launcher.log'),`${new Date().toISOString()} ${message}\n`);
  console.log(message);
}
main().catch(async error=>{
  const message=`Companion startup failed: ${error.message}`;
  console.error(message);
  try{await fs.mkdir(data,{recursive:true});await fs.appendFile(path.join(data,'launcher.log'),`${new Date().toISOString()} ${message}\n`);}catch{}
  process.exitCode=1;
});
