import {renderNotesMinimap} from './minimap.mjs';
import {createPlanner} from './planner.mjs';
import {createNotesUI} from './notes.mjs';
import {affine,activeAreas,validatePack,trainMarkers,fadedTrailPaths,transformAreaBounds} from './core.mjs';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
let state,projection=null,frame=null,frames=[],replay=false,index=0,playing=false,lastTick=0;
let view={x:0,y:0,w:1000,h:1000},mode='pan',pointer=null,edit=null,anchorWorld=null,previousAreas=new Set();
let trainTrails=new Map(),notesKey='',trails=new Map(),lastSequence='',lastRun='',saving=false,liveAge=Infinity;
let mapReady=false,nextMapCheck=0;
let boundsEdit=null,boundsOriginal=null,boundsSaving=false,planner=null;
const palette=['#8be7ff','#ec9aff','#ffffff','#ffac6b'];
async function api(url,options){const res=await fetch(url,options);const result=await res.json();if(!res.ok)throw new Error(result.error||'Request failed');return result;}
function message(text){$('message').textContent=text;$('message').hidden=!text;}
function svg(tag,attrs,parent){const el=document.createElementNS(NS,tag);for(const [key,val]of Object.entries(attrs))el.setAttribute(key,val);parent.append(el);return el;}
function textNode(tag,text,parent){const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;}
let playerAliases=new Map(),renameTarget=null;
try{const stored=JSON.parse(localStorage.getItem('playerAliases')||'{}');playerAliases=new Map(Object.entries(stored).filter(([key,value])=>key.length<200&&typeof value==='string'&&value.trim()&&value.length<=60).slice(-500));}catch{}
function aliasKey(player){return `${frame?.runId||''}:${player.id}`;}
function defaultLabel(player){return player.local?'You':(/^\d{10,}/.test(player.name)?`Player ${player.id}`:player.name||`Player ${player.id}`);}
function label(player){return playerAliases.get(aliasKey(player))||defaultLabel(player);}

function selected(){return frame?.players?.find(p=>p.id===$('player').value)||frame?.players?.find(p=>p.local)||frame?.players?.[0];}
function setMode(value){mode=value;$('draw').classList.toggle('active',value==='draw');$('map').classList.toggle('drawing',value!=='pan');$('modeLabel').textContent=value==='draw'?'Drag a rectangle around a puzzle':value==='anchor'?'Click this landmark on the map':'';}
function applyView(){$('map').setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);renderOverlay();}
function mapPoint(event){const p=$('map').createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform($('map').getScreenCTM().inverse());}
function clamp(n){return Math.min(1,Math.max(0,n));}
function updateProjection(){try{projection=affine(state.pack.calibration);}catch(e){projection=null;message(e.message);} $('anchorCount').textContent=state.pack.alignmentMethod==='train-track-fit'?'Aligned from train tracks (estimated). Reset to replace with manual landmarks.':`${state.pack.calibration.length} of 3 landmarks placed`;renderOverlay();}
async function savePack(pack){
  if(saving){message('Please wait for the current save.');return false;}
  saving=true;
  try{state=await api('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:state.revision,pack:validatePack(pack)})});message('');updateProjection();renderAreaList();planner?.renderList();return true;}
  catch(e){message(e.message);return false;}finally{saving=false;}
}
function renderAreaList(){
  $('areaList').replaceChildren();$('areaCount').textContent=state.pack.areas.length;$('areaEmpty').hidden=state.pack.areas.length>0;
  for(const a of state.pack.areas){const row=textNode('div','',$('areaList'));row.className='areaRow';const b=textNode('button',a.name,row);b.className='areaButton';b.onclick=()=>openEditor({...a});const resize=textNode('button','↔',row);resize.className='boundsButton';resize.title=`Move or resize ${a.name}`;resize.setAttribute('aria-label',`Move or resize ${a.name}`);resize.onclick=()=>beginBounds(a);}
}
const notesUI=createNotesUI({getPack:()=>state.pack,savePack,isMapEditing:()=>!!boundsEdit||!!planner?.isEditing(),onClose:()=>{edit=null;$('draft').replaceChildren();renderOverlay();}});
function openEditor(area){if(!planner?.leave()||!leaveBounds())return;if(notesUI.open(area)){edit=area;renderOverlay();}}
function closeEditor(){return notesUI.close();}
function renderPlayers(){
  const old=$('player').value, people=frame?.players||[];
  $('renamePlayer').disabled=!people.length;
  $('player').replaceChildren();
  for(const p of people){const option=document.createElement('option');option.value=p.id;option.textContent=label(p);$('player').append(option);}
  if(people.some(p=>p.id===old))$('player').value=old;else if(people.some(p=>p.local))$('player').value=people.find(p=>p.local).id;
  if(!people.length){const o=textNode('option','No active players',$('player'));o.value='';}
  $('playerList').replaceChildren();
  people.forEach((p,i)=>{const row=textNode('div','',$('playerList'));row.className='playerRow';const name=textNode('span',label(p),row);name.style.color=palette[i%palette.length];textNode('small',`X ${p.x.toFixed(1)} · Z ${p.z.toFixed(1)}`,row);});
}
function renderNotes(){
  const player=selected(),point=projection&&player?projection(player):null;
  const available=replay||liveAge<3000;
  const areas=available?activeAreas(point,state.pack.areas,previousAreas):[];previousAreas=new Set(areas.map(a=>a.id));
  const key=JSON.stringify([!!projection,available,areas.map(a=>[a.id,a.name,a.notes])]);
  notesUI.update(areas);
  if(key===notesKey)return;notesKey=key;
  $('notes').replaceChildren();
  for(const a of areas){const article=textNode('article','',$('notes'));textNode('h3',a.name,article);const b=textNode('button','Open notes',article);b.onclick=()=>$('restoreNotes').click();}
}
function renderOverlay(){
  if(!state)return;
  const scale=1/($('map').getScreenCTM()?.a||1);
  $('areas').replaceChildren();$('markerLabels').replaceChildren();$('markers').replaceChildren();$('trails').replaceChildren();$('anchors').replaceChildren();$('boundsControls').replaceChildren();
  for(const savedArea of state.pack.areas){const a=boundsEdit?.id===savedArea.id?boundsEdit:savedArea;const rect=svg('rect',{x:a.x*1000,y:a.y*1000,width:a.w*1000,height:a.h*1000,class:'areaShape'},$('areas'));if(previousAreas.has(a.id))rect.setAttribute('fill','#8be7d155');if(boundsEdit?.id===a.id){rect.setAttribute('data-bound-handle','move');rect.classList.add('bounds-selected');}}
  if(boundsEdit){const a=boundsEdit;for(const [handle,u,v]of [['nw',0,0],['n',.5,0],['ne',1,0],['e',1,.5],['se',1,1],['s',.5,1],['sw',0,1],['w',0,.5]]){svg('rect',{x:(a.x+a.w*u)*1000-6*scale,y:(a.y+a.h*v)*1000-6*scale,width:12*scale,height:12*scale,rx:2*scale,class:'bounds-handle','data-bound-handle':handle,style:`cursor:${handle}-resize`},$('boundsControls'));}}
  if($('settingsDialog').open&&!$('alignment').hidden)state.pack.calibration.forEach((a,i)=>{svg('circle',{cx:a.u*1000,cy:a.v*1000,r:5*scale,fill:'#ffd458'},$('anchors'));const t=svg('text',{x:a.u*1000+8*scale,y:a.v*1000,'font-size':16*scale},$('anchors'));t.textContent=i+1;});
  $('mapNotice').hidden=!!projection&&mapReady;$('mapNotice').textContent=!mapReady?'Bundled map image is missing. Extract the complete companion package again.':'Map alignment needed to place players and trains.';
  if(projection){
    const trailTime=replay?frame?.timestamp:Date.now(),seconds=Number($('trailDuration').value);
    const drawTrail=(points,color,width)=>{for(const path of fadedTrailPaths(points,projection,trailTime,seconds))svg('path',{d:path.d,fill:'none',stroke:color,'stroke-width':width*scale,opacity:path.opacity*.9,'stroke-linecap':'round'},$('trails'));};
    if($('showTrainTrails').checked)for(const {points,color} of trainTrails.values())drawTrail(points,color,1.6);
    if($('showTrails').checked){let i=0;for(const points of trails.values())drawTrail(points,palette[i++%palette.length],2.4);}
    const current=replay||liveAge<3000;
    if(current){
      const items=[...(frame?.players||[]).map((p,i)=>({...projection(p),title:label(p),color:palette[i%palette.length],kind:'player'})),
        ...trainMarkers(frame).map(t=>({...projection(t),title:t.name,color:t.color,kind:'train'}))];
      const occupied=items.map(p=>({x:p.u*1000-10*scale,y:p.v*1000-10*scale,w:20*scale,h:20*scale}));
      const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
      for(const item of items){
        const x=item.u*1000,y=item.v*1000,w=(item.title.length*6.5+18)*scale,h=24*scale;
        const offsets=[[16,-12],[16,-36],[-w/scale-16,-12],[16,14],[-w/scale-16,14],[16,-62],[-w/scale-16,-62]];
        const candidates=offsets.map(([dx,dy])=>({x:x+dx*scale,y:y+dy*scale,w,h}));
        const box=candidates.find(a=>!occupied.some(b=>overlaps(a,b)));
        if(box){occupied.push(box);svg('rect',{x:box.x,y:box.y,width:w,height:h,rx:7*scale,fill:'#080b0eea',stroke:'#ffffff24','stroke-width':scale},$('markerLabels'));
          const t=svg('text',{x:box.x+9*scale,y:box.y+16*scale,'font-size':11*scale,'font-weight':500},$('markerLabels'));t.textContent=item.title;}
        if(item.kind==='player'){
          svg('circle',{cx:x,cy:y,r:9*scale,fill:'#0008'},$('markers'));
          svg('circle',{cx:x,cy:y,r:5.5*scale,fill:item.color,stroke:'#efffff','stroke-width':1.2*scale},$('markers'));
        }else{
          svg('rect',{x:x-7*scale,y:y-7*scale,width:14*scale,height:14*scale,rx:4*scale,fill:'#080b0e',stroke:item.color,'stroke-width':1.5*scale},$('markers'));
          svg('rect',{x:x-3*scale,y:y-4*scale,width:6*scale,height:8*scale,rx:1*scale,fill:item.color},$('markers'));
        }
      }
    }
  }
  planner?.renderMap(scale);renderNotes();planner?.renderFocus();renderNotesMinimap({guidance:planner?.getGuide(),svg,pack:state.pack,projection,player:selected(),players:frame?.players||[],trains:trainMarkers(frame),activeArea:state.pack.areas.find(a=>previousAreas.has(a.id)),available:replay||liveAge<3000,replay,label:selected()?label(selected()):'',mapReady,mapHref:$('mapImage').getAttribute('href')});
}
function addTrail(f){
  const append=(points,p)=>{if(points.at(-1)?.timestamp===f.timestamp)return;points.push({x:p.x,y:p.y,z:p.z,timestamp:f.timestamp});if(points.length>10000)points.shift();};
  for(const t of trainMarkers(f)){if(!trainTrails.has(t.id))trainTrails.set(t.id,{color:t.color,points:[]});append(trainTrails.get(t.id).points,t);}
  for(const p of f.players||[]){if(!trails.has(p.id))trails.set(p.id,[]);append(trails.get(p.id),p);}
}
function showFrame(f){frame=f;renderPlayers();planner?.updateTracking({player:selected(),frame,projection,replay,ageMs:liveAge});renderOverlay();}
function setReplayIndex(value){index=Math.max(0,Math.min(frames.length-1,value));trails=new Map();trainTrails=new Map();for(let i=0;i<=index;i++)addTrail(frames[i]);$('timeline').value=index;showFrame(frames[index]);const seconds=(frames[index].timestamp-frames[0].timestamp)/1000;$('time').textContent=`${seconds.toFixed(1)}s`;}
async function poll(){
  if(!mapReady&&Date.now()>nextMapCheck){nextMapCheck=Date.now()+5000;try{const status=await api('/api/map-status');if(status.available){mapReady=true;$('mapImage').setAttribute('href',`/map.png?t=${Date.now()}`);renderOverlay();}}catch{}}
  try{if(!replay){const live=await api('/api/live');liveAge=live.ageMs??Infinity;$('connection').textContent=liveAge<3000?'Game connected':live.frame?'Game feed paused':'Waiting for game';
      
      if(live.frame){const key=`${live.frame.runId}:${live.frame.sequence}`;if(live.frame.runId!==lastRun){trails=new Map();trainTrails=new Map();previousAreas.clear();lastRun=live.frame.runId;}if(key!==lastSequence){lastSequence=key;addTrail(live.frame);}showFrame(live.frame);}else showFrame(null);
    }
  }catch(e){liveAge=Infinity;planner?.updateTracking({player:null,frame,projection,replay,ageMs:Infinity});$('connection').textContent='Companion disconnected';renderOverlay();}
  setTimeout(poll,300);
}
async function loadRecordings(){const value=$('recordings').value;const items=await api('/api/recordings');$('recordings').replaceChildren();const live=textNode('option','Live session',$('recordings'));live.value='live';for(const item of items){const o=textNode('option',new Date(item.modified).toLocaleString(),$('recordings'));o.value=item.id;}if([...$('recordings').options].some(o=>o.value===value))$('recordings').value=value;}
$('recordings').onchange=async()=>{
  playing=false;$('play').textContent='Play';previousAreas.clear();trails=new Map();trainTrails=new Map();
  if($('recordings').value==='live'){replay=false;$('timeline').disabled=true;$('play').disabled=true;$('time').textContent='Live';lastSequence='';return;}
  replay=true;$('connection').textContent='Recording playback';
  try{frames=await api(`/api/recording?id=${encodeURIComponent($('recordings').value)}`);if(!frames.length)throw new Error('This recording has no player movement.');$('timeline').max=frames.length-1;$('timeline').disabled=false;$('play').disabled=false;message('');setReplayIndex(0);}
  catch(e){frames=[];$('timeline').disabled=true;$('play').disabled=true;showFrame(null);message(e.message);}
};
$('timeline').oninput=()=>{playing=false;$('play').textContent='Play';previousAreas.clear();setReplayIndex(Number($('timeline').value));};
$('play').onclick=()=>{playing=!playing;lastTick=performance.now();if(playing&&index===frames.length-1)setReplayIndex(0);$('play').textContent=playing?'Pause':'Play';};
setInterval(()=>{if(!playing||!frames.length)return;const now=performance.now();if(now-lastTick>=frames[Math.min(index+1,frames.length-1)].timestamp-frames[index].timestamp){lastTick=now;if(index<frames.length-1)setReplayIndex(index+1);else{playing=false;$('play').textContent='Play';}}},40);
$('refreshRecordings').onclick=()=>loadRecordings().catch(e=>message(e.message));
$('fit').onclick=()=>{view={x:0,y:0,w:1000,h:1000};applyView();};
function zoom(factor,center={x:view.x+view.w/2,y:view.y+view.h/2}){const w=Math.max(70,Math.min(1400,view.w*factor)),ratio=w/view.w;view={x:center.x-(center.x-view.x)*ratio,y:center.y-(center.y-view.y)*ratio,w,h:w};applyView();}
$('zoomIn').onclick=()=>zoom(.75);$('zoomOut').onclick=()=>zoom(1.333);
$('map').addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1.12:.89,mapPoint(e));},{passive:false});
$('map').onpointerdown=e=>{
  if(e.button!==0)return;
  e.preventDefault(); // Panning/drawing must not start the browser's text selection.
  const p=mapPoint(e);
  if(boundsSaving)return;
  const handle=e.target.closest('[data-bound-handle]')?.getAttribute('data-bound-handle');
  if(boundsEdit&&handle){pointer={id:e.pointerId,start:p,handle,original:{...boundsEdit}};$('map').setPointerCapture(e.pointerId);return;}
  if(mode==='anchor'){
    if(p.x<0||p.x>1000||p.y<0||p.y>1000){message('Choose a point inside the map.');return;}
    const pack=structuredClone(state.pack);pack.alignmentMethod='manual';pack.calibration.push({...anchorWorld,u:p.x/1000,v:p.y/1000});
    savePack(pack).then(ok=>{if(ok)setMode('pan');});return;
  }
  pointer={id:e.pointerId,start:p,clientX:e.clientX,clientY:e.clientY,view:{...view},current:p};$('map').setPointerCapture(e.pointerId);
};
$('map').onpointermove=e=>{if(!pointer||pointer.id!==e.pointerId)return;const p=mapPoint(e);pointer.current=p;if(pointer.handle){boundsEdit=transformAreaBounds(pointer.original,pointer.handle,(p.x-pointer.start.x)/1000,(p.y-pointer.start.y)/1000);renderOverlay();return;}if(mode==='pan'){
    const matrix=$('map').getScreenCTM();view.x=pointer.view.x-(e.clientX-pointer.clientX)/matrix.a;view.y=pointer.view.y-(e.clientY-pointer.clientY)/matrix.d;applyView();
  }else if(mode==='draw'){$('draft').replaceChildren();svg('rect',{x:Math.min(p.x,pointer.start.x),y:Math.min(p.y,pointer.start.y),width:Math.abs(p.x-pointer.start.x),height:Math.abs(p.y-pointer.start.y),class:'areaShape'},$('draft'));}};
$('map').onpointerup=e=>{if(!pointer||pointer.id!==e.pointerId)return;if(pointer.handle){const p=mapPoint(e);boundsEdit=transformAreaBounds(pointer.original,pointer.handle,(p.x-pointer.start.x)/1000,(p.y-pointer.start.y)/1000);pointer=null;renderOverlay();return;}const p=mapPoint(e),start=pointer.start;pointer=null;if(mode==='draw'){
  const x=clamp(Math.min(p.x,start.x)/1000),y=clamp(Math.min(p.y,start.y)/1000),w=clamp(Math.max(p.x,start.x)/1000)-x,h=clamp(Math.max(p.y,start.y)/1000)-y;
  if(w>.002&&h>.002)openEditor({id:crypto.randomUUID(),name:'',notes:'',x,y,w,h});else $('draft').replaceChildren();setMode('pan');}};
$('map').onpointercancel=()=>{if(pointer?.handle)boundsEdit=pointer.original;pointer=null;renderOverlay();$('draft').replaceChildren();};
$('draw').onclick=()=>{if(!planner.leave()||!leaveBounds())return;if(notesUI.isOpen()&&!closeEditor())return;setMode(mode==='draw'?'pan':'draw');};
$('align').onclick=()=>{$('alignment').hidden=!$('alignment').hidden;$('align').classList.toggle('active',!$('alignment').hidden);if($('alignment').hidden)setMode('pan');renderOverlay();};
$('usePlayer').onclick=()=>{const p=selected();if(!p||(!replay&&liveAge>3000)){message('Choose an active player or a frame in a recording.');return;}$('worldX').value=p.x;$('worldZ').value=p.z;};
$('captureAnchor').onclick=()=>{if(!planner.leave())return;if(state.pack.calibration.length>=3){message('Three landmarks are already saved. Reset alignment to replace them.');return;}if(!$('worldX').value||!$('worldZ').value){message('Enter both world coordinates first.');return;}anchorWorld={x:Number($('worldX').value),z:Number($('worldZ').value)};if(!Number.isFinite(anchorWorld.x)||!Number.isFinite(anchorWorld.z))return;message('');notesUI.minimize();$('settingsDialog').close();setMode('anchor');};
$('resetAlignment').onclick=()=>{if(confirm('Reset the three map alignment landmarks?')){const pack=structuredClone(state.pack);pack.calibration=[];pack.alignmentMethod='manual';savePack(pack);setMode('pan');}};
$('player').onchange=()=>{previousAreas.clear();renderOverlay();};$('showTrails').onchange=renderOverlay;$('showTrainTrails').onchange=renderOverlay;
$('export').onclick=()=>{if(planner.isEditing()||boundsEdit){message('Save or cancel your map edits before exporting.');return;}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state.pack,null,2)],{type:'application/json'}));a.download='big-walk-route.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
$('import').onclick=()=>{if(leaveBounds())$('importFile').click();};
$('importFile').onchange=async()=>{const file=$('importFile').files[0];if(!file)return;try{if(file.size>32_000_000)throw new Error('Route pack is too large.');const pack=validatePack(JSON.parse(await file.text()));planner.offerImport(pack);}catch(e){message(e.message);}finally{$('importFile').value='';}};
new ResizeObserver(()=>renderOverlay()).observe($('mapWrap'));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!notesUI.isOpen()&&!$('areaPopup').open){if(boundsEdit){e.preventDefault();if(!boundsSaving)endBounds();return;}setMode('pan');pointer=null;$('draft').replaceChildren();}});
planner=createPlanner({getPack:()=>state?.pack,savePack,message,mapPoint,redraw:renderOverlay,
  followMap:point=>{const rect=$('map').getBoundingClientRect(),panel=document.querySelector('aside').getBoundingClientRect(),pixels=Math.min(rect.width,rect.height),available=panel.top<rect.bottom?Math.max(200,panel.left-rect.left-24):rect.width;view={x:point.u*1000-110+(rect.width-available)*220/(2*pixels),y:point.v*1000-110,w:220,h:220};$('map').setAttribute('viewBox',`${view.x} ${view.y} 220 220`);},
  prepare:()=>{if(!leaveBounds()||(notesUI.isOpen()&&!closeEditor()))return false;notesUI.minimize();setMode('pan');return true;},
  focusMap:points=>{
    const xs=points.map(p=>p.u*1000),ys=points.map(p=>p.v*1000),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const rect=$('map').getBoundingClientRect(),panel=document.querySelector('aside').getBoundingClientRect(),unitPixels=Math.min(rect.width,rect.height);
    const available=panel.top<rect.bottom?Math.max(200,panel.left-rect.left-24):rect.width;
    const size=Math.max(140,(maxX-minX)*unitPixels/available*1.3,(maxY-minY)*unitPixels/Math.max(200,rect.height-210)*1.3);
    view={x:(minX+maxX-size)/2+(rect.width-available)*size/(2*unitPixels),y:(minY+maxY-size)/2,w:size,h:size};applyView();
  }
});
try{state=await api('/api/state');state.pack=validatePack(state.pack);updateProjection();renderAreaList();planner.ready();await loadRecordings();poll();}catch(e){message(`Could not load companion: ${e.message}`);}
$('findPlayer').onclick=()=>{const p=selected();if(!projection||!p||(!replay&&liveAge>=3000)){message('Choose a recording or connect a live player first.');return;}const pos=projection(p);view.x=pos.u*1000-view.w/2;view.y=pos.v*1000-view.h/2;applyView();};

$('settingsButton').onclick=()=>{if($('areaPopup').open)$('areaPopup').close();$('settingsDialog').showModal();renderOverlay();};
$('closeSettings').onclick=()=>{$('settingsDialog').close();setMode('pan');renderOverlay();};
$('settingsDialog').addEventListener('close',()=>{notesUI.syncPopup();renderOverlay();});
for(const id of ['showTrails','showTrainTrails']){try{const saved=localStorage.getItem(id);if(saved!==null)$(id).checked=saved==='true';}catch{}$(id).onchange=()=>{try{localStorage.setItem(id,$(id).checked);}catch{}renderOverlay();};}

function updateTrailDuration(){const seconds=Number($('trailDuration').value);$('trailDurationValue').textContent=`Last ${seconds} seconds`;$('trailDuration').setAttribute('aria-valuetext',`Last ${seconds} seconds`);renderOverlay();}
try{const saved=Number(localStorage.getItem('trailDuration'));if(saved>=10&&saved<=300)$('trailDuration').value=String(saved);}catch{}
$('trailDuration').oninput=()=>{try{localStorage.setItem('trailDuration',$('trailDuration').value);}catch{}updateTrailDuration();};updateTrailDuration();

$('mapWrap').addEventListener('selectstart',e=>e.preventDefault());
$('map').addEventListener('dragstart',e=>e.preventDefault());

$('renamePlayer').onclick=()=>{const p=selected();if(!p)return;renameTarget=aliasKey(p);$('playerName').value=label(p);$('renameDialog').showModal();$('playerName').focus();$('playerName').select();};
function savePlayerAlias(reset=false){if(!renameTarget)return;const name=$('playerName').value.trim();if(!reset&&!name){$('playerName').setCustomValidity('Enter a name.');$('playerName').reportValidity();return;}
  playerAliases.delete(renameTarget);if(!reset)playerAliases.set(renameTarget,name);while(playerAliases.size>500)playerAliases.delete(playerAliases.keys().next().value);
  try{localStorage.setItem('playerAliases',JSON.stringify(Object.fromEntries(playerAliases)));}catch{message('Name changed, but browser storage is unavailable. It will reset on reload.');}
  $('renameDialog').close();renameTarget=null;renderPlayers();renderOverlay();
}
$('renameForm').onsubmit=e=>{e.preventDefault();savePlayerAlias();};$('playerName').oninput=()=>$('playerName').setCustomValidity('');
$('resetPlayerName').onclick=()=>savePlayerAlias(true);$('cancelRename').onclick=()=>$('renameDialog').close();

$('renameDialog').addEventListener('close',()=>{renameTarget=null;notesUI.syncPopup();});

function boundsDirty(){return boundsEdit&&['x','y','w','h'].some(k=>boundsEdit[k]!==boundsOriginal[k]);}
function endBounds(){boundsEdit=null;boundsOriginal=null;pointer=null;$('boundsBar').hidden=true;setMode('pan');renderOverlay();}
function leaveBounds(){if(boundsSaving)return false;if(boundsDirty()&&!confirm('Discard unsaved area bounds?'))return false;if(boundsEdit)endBounds();return true;}
function beginBounds(area){if(!planner.leave())return;if(boundsEdit?.id===area.id||!leaveBounds())return;if(notesUI.isOpen()&&!closeEditor())return;boundsEdit={...area};boundsOriginal={...area};notesUI.minimize();setMode('pan');$('boundsName').textContent=area.name;$('boundsBar').hidden=false;const size=Math.max(100,Math.min(1000,Math.max(area.w,area.h)*2800));view={x:(area.x+area.w/2)*1000-size/2,y:(area.y+area.h/2)*1000-size/2,w:size,h:size};applyView();}
$('cancelBounds').onclick=()=>{if(!boundsSaving)endBounds();};
$('saveBounds').onclick=async()=>{if(!boundsEdit||boundsSaving)return;boundsSaving=true;$('saveBounds').disabled=true;$('cancelBounds').disabled=true;const pack=structuredClone(state.pack),area=pack.areas.find(a=>a.id===boundsEdit.id);if(area)for(const k of ['x','y','w','h'])area[k]=boundsEdit[k];try{if(area&&await savePack(pack))endBounds();}finally{boundsSaving=false;$('saveBounds').disabled=false;$('cancelBounds').disabled=false;}};
window.addEventListener('beforeunload',e=>{if(boundsDirty()){e.preventDefault();e.returnValue='';}});
