import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {blankPack,validatePack,MAX_PACK_BYTES} from './dist/core.mjs';
import {createBrowserOpener} from './browser.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const assets=path.resolve(root,'../data');
const data=process.env.COMPANION_DATA_DIR || assets;
const game=process.env.BIGWALK_PATH || 'C:/Program Files (x86)/Steam/steamapps/common/Big Walk';
const telemetry=process.env.COMPANION_TELEMETRY_DIR || path.join(game,'BepInEx/companion');
const port=Number(process.env.PORT||4317);
const origin=`http://127.0.0.1:${port}`;
const openBrowser=createBrowserOpener();
await fs.mkdir(data,{recursive:true});
const packPath=path.join(data,'route-pack.json');
let state={revision:0,pack:blankPack()};
try{state.pack=validatePack(JSON.parse(await fs.readFile(path.join(root,'default-route.json'),'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}
async function mapFile(){for(const file of [path.join(assets,'map-candidates/PaperMapSaved-270.png'),path.join(telemetry,'map.png'),path.join(root,'map.png'),path.join(root,'../assets/map.png')]){try{await fs.access(file);return file;}catch(e){if(e.code!=='ENOENT')throw e;}}return null;}
try {const saved=JSON.parse(await fs.readFile(packPath,'utf8')); state={revision:saved.revision,pack:validatePack(saved.pack)};}
catch(e){if(e.code!=='ENOENT') throw new Error(`Cannot read saved route pack: ${e.message}`);}
let writeQueue=Promise.resolve();
const staticFiles=new Map([['/','index.html'],['/app.mjs','app.mjs'],['/core.mjs','core.mjs'],['/planner.mjs','planner.mjs'],['/minimap.mjs','minimap.mjs'],['/icons.mjs','icons.mjs'],['/lucide-catalog.mjs','lucide-catalog.mjs'],['/planning-data.mjs','planning-data.mjs'],['/styles.css','styles.css'],['/favicon.svg','favicon.svg'],['/notes.mjs','notes.mjs'],['/vendor.mjs','vendor.mjs'],['/markdown.mjs','markdown.mjs']]);
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
function reply(res,status,obj){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
async function body(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>MAX_PACK_BYTES)throw new Error('Route pack is too large.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
async function recordings(){try{return (await fs.readdir(telemetry)).filter(n=>/^session-[a-f0-9]+\.jsonl$/.test(n));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'");
  if(req.headers.host!==`127.0.0.1:${port}` || (req.headers.origin && req.headers.origin!==origin))return reply(res,403,{error:'Open the companion using its local address.'});
  try{
    const url=new URL(req.url,origin);
    if(req.method==='GET' && url.pathname==='/api/health')return reply(res,200,{app:'big-walk-companion',appVersion:'0.2.0',launchProtocol:1,pid:process.pid,dataDirectory:path.resolve(data),telemetryDirectory:path.resolve(telemetry)});
    if(req.method==='POST' && url.pathname==='/api/open-browser')return reply(res,200,{opened:await openBrowser(origin+'/')});
    if(req.method==='POST' && url.pathname==='/api/shutdown'){
      await writeQueue;reply(res,200,{stopped:true});server.close();server.closeIdleConnections();return;
    }
    if(req.method==='GET' && url.pathname==='/api/map-status')return reply(res,200,{available:!!(await mapFile())});
    if(req.method==='GET' && url.pathname==='/api/state')return reply(res,200,state);
    if(req.method==='PUT' && url.pathname==='/api/state'){
      if(!req.headers['content-type']?.startsWith('application/json'))return reply(res,415,{error:'JSON required.'});
      const incoming=await body(req), pack=validatePack(incoming.pack);
      const operation=writeQueue.then(async()=>{
        if(incoming.revision!==state.revision)return reply(res,409,{error:'Another window saved changes. Reload the route pack before saving.'});
        const next={revision:state.revision+1,pack};
        await fs.writeFile(packPath+'.tmp',JSON.stringify(next,null,2));
        try{await fs.copyFile(packPath,path.join(data,'route-pack.previous.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
        await fs.rename(packPath+'.tmp',packPath);state=next;reply(res,200,state);
      });writeQueue=operation.catch(()=>{});return await operation;
    }
    if(req.method==='GET' && url.pathname==='/api/live'){
      try{const frame=JSON.parse(await fs.readFile(path.join(telemetry,'positions.json'),'utf8'));
        return reply(res,200,{frame,ageMs:Math.max(0,Date.now()-frame.timestamp)});
      }catch(e){if(e.code==='ENOENT')return reply(res,200,{frame:null,ageMs:null});throw e;}
    }
    if(req.method==='GET' && url.pathname==='/api/recordings'){
      const items=await Promise.all((await recordings()).map(async id=>{const s=await fs.stat(path.join(telemetry,id));return {id,bytes:s.size,modified:s.mtimeMs}}));
      return reply(res,200,items.sort((a,b)=>b.modified-a.modified));
    }
    if(req.method==='GET' && url.pathname==='/api/recording'){
      const id=url.searchParams.get('id');if(!(await recordings()).includes(id))return reply(res,404,{error:'Recording not found.'});
      const filename=path.join(telemetry,id),stat=await fs.stat(filename);
      if(stat.size>100_000_000)return reply(res,413,{error:'This diagnostic recording exceeds the 100 MB replay limit.'});
      const lines=(await fs.readFile(filename,'utf8')).split(/\r?\n/);const frames=[];
      for(let i=0;i<lines.length;i++){if(!lines[i].trim())continue;try{const f=JSON.parse(lines[i]);if(f.players?.length)frames.push(f);}catch(e){if(i<lines.length-2)throw e;}}
      return reply(res,200,frames);
    }
    if(req.method==='GET' && (staticFiles.has(url.pathname)||url.pathname==='/map.png')){
      const file=url.pathname==='/map.png'?await mapFile():path.join(root,'dist',staticFiles.get(url.pathname));
      if(!file)return reply(res,404,{error:'Map not exported yet. Join a world with the companion mod installed.'});
      const content=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache'});return res.end(content);
    }
    reply(res,404,{error:'Not found.'});
  }catch(e){reply(res,400,{error:e.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Big Walk companion: ${origin}`));
