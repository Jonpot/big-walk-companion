import {spawn} from 'node:child_process';
import path from 'node:path';

function systemBrowser(url){
  if(process.platform!=='win32')throw new Error('Automatic browser opening is supported on Windows.');
  return new Promise((resolve,reject)=>{
    const child=spawn(path.join(process.env.SystemRoot||'C:/Windows','System32','rundll32.exe'),
      ['url.dll,FileProtocolHandler',url],{windowsHide:true,detached:true,stdio:'ignore'});
    child.once('error',reject);
    child.once('spawn',()=>{child.unref();resolve();});
  });
}

// Share the in-flight request and suppress simultaneous installer/mod launches.
export function createBrowserOpener(open=systemBrowser,now=Date.now){
  let pending=null,lastOpened=-Infinity;
  return async url=>{
    if(pending){await pending;return false;}
    if(now()-lastOpened<10000)return false;
    pending=Promise.resolve().then(()=>open(url));
    try{await pending;lastOpened=now();return true;}
    finally{pending=null;}
  };
}
