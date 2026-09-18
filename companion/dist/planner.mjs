import {createArrivalTracker,nextCheckpoint,guideSegment} from './auto-run.mjs';
import {appendIcon,createIconPicker,iconContrast} from './icons.mjs';
import {POI_CATEGORIES,mergePlanningPacks,removePoi,routeDistance} from './planning-data.mjs';
import {validatePack} from './core.mjs';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const clone=value=>structuredClone(value),uid=()=>crypto.randomUUID();
export function createPlanner({getPack,savePack,prepare,redraw,focusMap,mapPoint,message,followMap=()=>{}}){
  let draft=null,original='',tool='',drag=null,selectedRoute='',busy=false,history=[],future=[],pendingImport=null;
  let run={routeId:'',done:[],elapsed:0,started:null},recovery=null;
  const arrival=createArrivalTracker();let tracking=null,guide=null,runStatus='Start the timer to follow this route automatically.';let focusKey='',focusSince=0;
  const iconPicker=createIconPicker(name=>{if(draft?.kind!=='poi'||busy)return;snapshot();draft.icon=name;updateIcon();changed();});
  function updateIcon(){$('poiIconPreview').replaceChildren();appendIcon($('poiIconPreview'),draft?.icon||'map-pin');$('poiIconName').textContent=draft?.icon||'map-pin';}
  $('choosePoiIcon').onclick=()=>{if(draft?.kind==='poi'&&!busy)iconPicker.open(draft.icon);};
  const storageKey='bigwalk-planner-draft-v2',runKey='bigwalk-run-v2';
  const element=(tag,text,parent,attrs={})=>{const e=document.createElement(tag);if(text!==null)e.textContent=text;Object.assign(e,attrs);parent?.append(e);return e;};
  const button=(text,parent,action,attrs={})=>{const b=element('button',text,parent,{type:'button',...attrs});b.onclick=action;return b;};
  const draw=(tag,attrs,parent=$('planningMap'))=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;};
  const unit=p=>({u:Math.min(1,Math.max(0,p.x/1000)),v:Math.min(1,Math.max(0,p.y/1000))});
  const dirty=()=>!!draft&&JSON.stringify(draft)!==original;
  function persistDraft(){try{if(draft)localStorage.setItem(storageKey,JSON.stringify({draft,original,tool}));else localStorage.removeItem(storageKey);}catch{message('Browser draft backup is unavailable. Use Save plan to keep your changes.');}}
  function persistRun(){try{localStorage.setItem(runKey,JSON.stringify(run));}catch{}}
  function snapshot(){history.push(clone(draft));if(history.length>60)history.shift();future=[];}
  function changed(){persistDraft();updateEditButtons();redraw();}
  function setTool(value){tool=value;$('plannerHint').textContent=value==='poi'?'Click the map to place a POI. Escape cancels.':value==='route'?'Click to add route points. Finish path when ready. Escape cancels.':value==='adjust'?'Drag a point to move it. Click the map to extend; click a segment to insert. Right-click a point to remove it.':'';$('plannerHint').hidden=!value;$('map').classList.toggle('planning',!!value);$('addPoi').classList.toggle('active',value==='poi');$('addRoute').classList.toggle('active',value==='route');$('pathActions').hidden=value!=='route';persistDraft();}
  function clearDraft(){draft=null;original='';history=[];future=[];drag=null;setTool('');$('planEditor').hidden=true;$('planningLibrary').hidden=$('plannerMode').value==='run';persistDraft();redraw();}
  function leave(){if(busy)return false;if(dirty()&&!confirm('Discard unsaved planning changes?'))return false;clearDraft();return true;}
  function start(kind){if(!leave()||!prepare())return;setTool(kind);if(kind==='route'){draft={kind:'route',id:uid(),name:'New route',notes:'',color:'#ffd458',points:[],steps:[]};original='';changed();}renderList();}
  function begin(item,kind){if(!leave()||!prepare())return;$('plannerMode').value='plan';switchMode();draft={...clone(item),kind};original=JSON.stringify(draft);if(kind==='route')selectedRoute=item.id;setTool('');showEditor();redraw();renderRun();}
  function showEditor(){
    if(!draft)return;$('planEditor').hidden=false;$('planningLibrary').hidden=true;$('planEditorTitle').textContent=draft.kind==='poi'?'Edit POI':'Edit route';
    $('planName').value=draft.name;$('planNotes').value=draft.notes;$('planColor').value=draft.color;
    $('poiFields').hidden=draft.kind!=='poi';$('poiIconFields').hidden=draft.kind!=='poi';if(draft.kind==='poi')updateIcon();$('routeFields').hidden=draft.kind!=='route';
    if(draft.kind==='poi')$('poiCategory').value=draft.category;
    $('deletePlan').hidden=!(draft.kind==='poi'?getPack().pois:getPack().routes).some(x=>x.id===draft.id);
    $('adjustPath').textContent=draft.kind==='poi'?'Move pin on map':'Adjust path on map';
    renderSteps();updateEditButtons();$('planName').focus();
  }
  function updateEditButtons(){$('planEditor').inert=busy;$('planTools').inert=busy;$('undoPlan').disabled=busy||!history.length;$('redoPlan').disabled=busy||!future.length;$('finishPath').disabled=!draft||draft.points?.length<2;$('undoPoint').disabled=!history.length;$('savePlan').disabled=busy;$('cancelPlan').disabled=busy;$('deletePlan').disabled=busy;}
  for(const [id,key]of [['planName','name'],['planNotes','notes'],['planColor','color'],['poiCategory','category']])$(id).oninput=()=>{if(!draft||busy)return;snapshot();draft[key]=$(id).value;changed();};
  function stepChanged(){renderSteps();changed();}
  function renderSteps(){
    $('stepList').replaceChildren();$('stepPoi').replaceChildren();element('option','Choose a POI…',$('stepPoi'),{value:''});
    for(const p of getPack().pois)element('option',p.name,$('stepPoi'),{value:p.id});
    if(draft?.kind!=='route')return;
    draft.steps.forEach((s,i)=>{
      const row=element('div',null,$('stepList'),{className:'step-edit'});
      element('span',String(i+1),row,{className:'step-number'});
      const fields=element('div',null,row,{className:'step-fields'});
      const name=element('input',null,fields,{value:s.name,maxLength:150,placeholder:'Step name'});name.setAttribute('aria-label',`Step ${i+1} name`);
      name.oninput=()=>{if(busy)return;snapshot();s.name=name.value;changed();};
      const notes=element('textarea',null,fields,{value:s.notes,maxLength:2000,rows:2,placeholder:'Instructions / assigned player'});notes.setAttribute('aria-label',`Step ${i+1} instructions`);notes.oninput=()=>{if(busy)return;snapshot();s.notes=notes.value;changed();};
      if(s.poiId)element('small',`Linked to ${getPack().pois.find(p=>p.id===s.poiId)?.name||'POI'}`,fields);
      const actions=element('div',null,row,{className:'step-actions'});
      for(const [text,delta]of [['↑',-1],['↓',1]]){const b=button(text,actions,()=>{snapshot();[draft.steps[i],draft.steps[i+delta]]=[draft.steps[i+delta],draft.steps[i]];stepChanged();},{disabled:i+delta<0||i+delta>=draft.steps.length});b.setAttribute('aria-label',`Move step ${i+1} ${delta<0?'up':'down'}`);}
      button('×',actions,()=>{snapshot();draft.steps.splice(i,1);stepChanged();}).setAttribute('aria-label',`Remove step ${i+1}`);
    });
  }
  $('addStep').onclick=()=>{if(draft?.kind!=='route'||busy)return;const p=getPack().pois.find(p=>p.id===$('stepPoi').value);snapshot();draft.steps.push({id:uid(),name:p?.name||'New step',notes:'',poiId:p?.id||''});stepChanged();};
  $('adjustPath').onclick=()=>{if(!draft||busy)return;setTool(tool?'':draft.kind==='poi'?'move':'adjust');$('plannerHint').hidden=false;if(tool==='move')$('plannerHint').textContent='Click the new position for this POI.';changed();};
  $('undoPlan').onclick=()=>{if(!history.length||busy)return;future.push(clone(draft));draft=history.pop();if(!$('planEditor').hidden)showEditor();changed();};
  $('redoPlan').onclick=()=>{if(!future.length||busy)return;history.push(clone(draft));draft=future.pop();if(!$('planEditor').hidden)showEditor();changed();};
  $('cancelDrawing').onclick=()=>leave();$('undoPoint').onclick=()=>$('undoPlan').click();
  $('cancelPlan').onclick=()=>leave();$('cancelPath').onclick=()=>leave();
  $('finishPath').onclick=()=>{if(draft?.points.length>=2){setTool('');showEditor();changed();}};
  $('savePlan').onclick=async()=>{
    if(!draft||busy)return;const pack=clone(getPack()),kind=draft.kind,record=clone(draft);delete record.kind;record.name=record.name.trim();record.steps?.forEach(s=>s.name=s.name.trim());
    const list=kind==='poi'?pack.pois:pack.routes,i=list.findIndex(p=>p.id===record.id);if(i<0)list.push(record);else list[i]=record;
    try{validatePack(pack);}catch(e){message(e.message);return;}
    busy=true;updateEditButtons();
    try{if(await savePack(pack)){if(kind==='route')selectedRoute=record.id;clearDraft();renderList();renderRun();message('Plan saved. Export pack to share your POIs, routes, steps, and notes.',{timeout:6000});}}finally{busy=false;updateEditButtons();}
  };
  $('deletePlan').onclick=async()=>{
    if(!draft||busy||!confirm(`Delete “${draft.name}”? Linked step instructions will be kept.`))return;
    const pack=draft.kind==='poi'?removePoi(getPack(),draft.id):clone(getPack());if(draft.kind==='route')pack.routes=pack.routes.filter(r=>r.id!==draft.id);
    busy=true;updateEditButtons();try{if(await savePack(pack)){clearDraft();renderList();renderRun();}}finally{busy=false;updateEditButtons();}
  };
  function matches(item){const q=$('planSearch').value.trim().toLowerCase();return !q||`${item.name} ${item.notes} ${item.category||''} ${(item.steps||[]).map(s=>s.name+' '+s.notes).join(' ')}`.toLowerCase().includes(q);}
  function visiblePoi(p){return $('layerPois').checked&&(!$('filterCategory').value||p.category===$('filterCategory').value)&&matches(p);}
  function visibleRoute(r){return $('layerRoutes').checked&&matches(r);}
  function renderList(){
    const pack=getPack();if(!pack)return;
    $('poiList').replaceChildren();$('routeList').replaceChildren();$('poiCount').textContent=pack.pois.length;$('routeCount').textContent=pack.routes.length;
    for(const [items,target,kind,visible]of [[pack.pois,'poiList','poi',visiblePoi],[pack.routes,'routeList','route',visibleRoute]]){
      const shown=items.filter(visible);
      for(const item of shown){
        const row=element('div',null,$(target),{className:'plan-row'});
        const open=button(item.name,row,()=>{focusItem(item,kind);begin(item,kind);},{className:'plan-item'});open.style.borderLeftColor=item.color;if(kind==='poi')open.prepend(appendIcon(open,item.icon,{size:18}));
        const locate=button('⌖',row,()=>focusItem(item,kind));locate.setAttribute('aria-label',`Locate ${item.name}`);
        if(kind==='route')button('Run',row,()=>selectRun(item.id));
      }
      if(!shown.length)element('p',items.length?'No matches. Change the search or layers.':kind==='poi'?'Mark puzzles, transport, shortcuts, and hazards.':'Draw a path, then add its steps in order.',$(target),{className:'muted'});
    }
    $('routePicker').replaceChildren();element('option','Choose a route',$('routePicker'),{value:''});for(const r of pack.routes)element('option',r.name,$('routePicker'),{value:r.id});
    if(!pack.routes.some(r=>r.id===selectedRoute))selectedRoute=pack.routes[0]?.id||'';$('routePicker').value=selectedRoute;
    renderRun();
  }
  function focusItem(item,kind){const points=kind==='poi'?[item]:item.points;focusMap(points);}
  for(const id of ['planSearch','filterCategory','layerPois','layerRoutes'])$(id).addEventListener('input',()=>{renderList();redraw();});
  for(const c of POI_CATEGORIES){element('option',c[0].toUpperCase()+c.slice(1),$('poiCategory'),{value:c});element('option',c[0].toUpperCase()+c.slice(1),$('filterCategory'),{value:c});}
  $('addPoi').onclick=()=>start('poi');$('addRoute').onclick=()=>start('route');
  function renderMap(scale){
    const group=$('planningMap');group.replaceChildren();const pack=getPack();if(!pack)return;
    const routes=pack.routes.filter(r=>r.id!==draft?.id&&visibleRoute(r));if(draft?.kind==='route')routes.push(draft);
    for(const r of routes){
      const points=r.points.map(p=>`${p.u*1000},${p.v*1000}`).join(' '),attrs={'data-plan-id':r.id,'data-plan-kind':'route'};
      draw('polyline',{points,fill:'none',stroke:'#050a0d','stroke-width':7*scale,'stroke-linejoin':'round','stroke-linecap':'round',...attrs});
      draw('polyline',{points,fill:'none',stroke:r.color,'stroke-width':3*scale,'stroke-linejoin':'round','stroke-linecap':'round',...attrs});
      r.points.slice(1).forEach((p,i)=>{const a=r.points[i],dx=(p.u-a.u)*1000,dy=(p.v-a.v)*1000,length=Math.hypot(dx,dy);if(length<32*scale)return;const x=(a.u+.65*(p.u-a.u))*1000,y=(a.v+.65*(p.v-a.v))*1000,ux=dx/length,uy=dy/length;draw('polygon',{points:`${x+6*scale*ux},${y+6*scale*uy} ${x-5*scale*ux-4*scale*uy},${y-5*scale*uy+4*scale*ux} ${x-5*scale*ux+4*scale*uy},${y-5*scale*uy-4*scale*ux}`,fill:r.color,stroke:'#111','stroke-width':scale,'pointer-events':'none'});});
      if(draft?.id===r.id&&tool==='adjust')r.points.slice(1).forEach((p,i)=>draw('line',{x1:r.points[i].u*1000,y1:r.points[i].v*1000,x2:p.u*1000,y2:p.v*1000,stroke:'transparent','stroke-width':15*scale,'data-segment':i}));
      r.points.forEach((p,i)=>{
        if(draft?.id===r.id||i===0||i===r.points.length-1){const editable=draft?.id===r.id;draw('circle',{cx:p.u*1000,cy:p.v*1000,r:(editable?6:4)*scale,fill:i===0?'#fff':r.color,stroke:'#111','stroke-width':2*scale,...attrs,...(editable?{'data-vertex':i}:{})});}
      });
      if(r.points.length){const p=r.points[0],label=draw('text',{x:p.u*1000+9*scale,y:p.v*1000-9*scale,'font-size':12*scale,'paint-order':'stroke',stroke:'#000','stroke-width':3*scale});label.style.stroke='#000';label.textContent=r.name;}
    }
    const pois=pack.pois.filter(p=>p.id!==draft?.id&&visiblePoi(p));if(draft?.kind==='poi')pois.push(draft);
    for(const p of pois){const attrs={'data-plan-id':p.id,'data-plan-kind':'poi'};const g=draw('g',attrs);draw('path',{d:`M${p.u*1000},${p.v*1000} l${-7*scale},${-10*scale} h${14*scale} Z`,fill:p.color,...attrs},g);draw('circle',{cx:p.u*1000,cy:p.v*1000-17*scale,r:12*scale,fill:p.color,stroke:'#101719','stroke-width':2*scale,...attrs},g);appendIcon(g,p.icon,{x:p.u*1000-8*scale,y:p.v*1000-25*scale,size:16*scale,color:iconContrast(p.color)});const title=draw('title',{},g);title.textContent=`${p.name} (${p.category})`;const t=draw('text',{x:p.u*1000+17*scale,y:p.v*1000-12*scale,'font-size':12*scale,'paint-order':'stroke','stroke-width':3*scale},g);t.style.stroke='#000';t.textContent=p.name;}
    if(guide?.segment?.length&&run.started){draw('polyline',{points:guide.segment.map(p=>`${p.u*1000},${p.v*1000}`).join(' '),fill:'none',stroke:'#ffffff','stroke-width':7*scale,'stroke-linecap':'round','stroke-linejoin':'round','pointer-events':'none',class:'route-guide'});if(guide.poi)draw('circle',{cx:guide.poi.u*1000,cy:guide.poi.v*1000,r:19*scale,fill:'none',stroke:'#fff','stroke-width':3*scale,'pointer-events':'none',class:'route-guide'});}
    const r=pack.routes.find(r=>r.id===selectedRoute);if(r&&visibleRoute(r))r.steps.forEach((s,i)=>{const p=pack.pois.find(p=>p.id===s.poiId);if(!p||!visiblePoi(p))return;draw('circle',{cx:p.u*1000+10*scale,cy:p.v*1000-28*scale,r:7*scale,fill:'#131a15',stroke:r.color,'stroke-width':scale,'pointer-events':'none'});const t=draw('text',{x:p.u*1000+10*scale,y:p.v*1000-25*scale,'text-anchor':'middle','font-size':9*scale});t.textContent=i+1;});
  }
  const map=$('map');
  function down(e){
    if(e.button!==0)return;const vertex=e.target.closest('[data-vertex]'),segment=e.target.closest('[data-segment]'),item=e.target.closest('[data-plan-id]');
    if(!tool&&!item)return;if(busy){e.stopImmediatePropagation();return;}
    e.preventDefault();e.stopImmediatePropagation();const p=unit(mapPoint(e));
    if(tool==='poi'){draft={kind:'poi',id:uid(),name:'New POI',notes:'',color:'#c5f785',category:'landmark',icon:'map-pin',...p};original='';setTool('');showEditor();changed();return;}
    if((tool==='adjust'||tool==='route')&&draft?.kind==='route'){
      snapshot();if(vertex){drag={id:e.pointerId,index:Number(vertex.getAttribute('data-vertex')),before:clone(draft)};map.setPointerCapture(e.pointerId);}
      else{if(draft.points.length>=2000){history.pop();message('A route can have up to 2,000 points.');return;}const index=segment?Number(segment.getAttribute('data-segment'))+1:draft.points.length;draft.points.splice(index,0,p);changed();}return;
    }
    if(tool==='move'&&draft?.kind==='poi'){snapshot();Object.assign(draft,p);changed();return;}
    if(item&&!tool){const kind=item.getAttribute('data-plan-kind'),id=item.getAttribute('data-plan-id');const target=(kind==='poi'?getPack().pois:getPack().routes).find(x=>x.id===id);if(target)begin(target,kind);}
  }
  map.addEventListener('pointerdown',down,true);
  map.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;e.stopImmediatePropagation();draft.points[drag.index]=unit(mapPoint(e));redraw();},true);
  map.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;e.stopImmediatePropagation();draft.points[drag.index]=unit(mapPoint(e));drag=null;changed();},true);
  map.addEventListener('pointercancel',()=>{if(!drag)return;draft=drag.before;drag=null;history.pop();changed();},true);
  map.addEventListener('contextmenu',e=>{const v=e.target.closest('[data-vertex]');if(!v||!draft||!['adjust','route'].includes(tool))return;e.preventDefault();if(draft.points.length<=2){message('Keep at least two points in a route.');return;}snapshot();draft.points.splice(Number(v.getAttribute('data-vertex')),1);changed();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tool){e.preventDefault();e.stopImmediatePropagation();if(tool==='route'||tool==='poi')leave();else{setTool('');redraw();}}},true);
  window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});

  function elapsed(){return run.elapsed+(run.started?Math.max(0,Date.now()-run.started):0);}
  function clock(ms){const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
  function selectRun(id){if(!leave()||!prepare())return;selectedRoute=id;$('plannerMode').value='run';switchMode();renderList();redraw();}
  function switchMode(){const running=$('plannerMode').value==='run';$('planTools').hidden=running;$('planningLibrary').hidden=running;$('runPanel').hidden=!running;if(running)renderRun();}
  $('plannerMode').onchange=()=>{if(!leave()){$('plannerMode').value='plan';return;}switchMode();};
  $('routePicker').onchange=()=>{selectedRoute=$('routePicker').value;renderRun();redraw();};
  function renderRun(){
    const r=getPack()?.routes.find(r=>r.id===selectedRoute);$('runSteps').replaceChildren();$('runEmpty').hidden=!!r;
    $('runControls').hidden=!r;$('runDetails').hidden=!r;$('routePicker').value=selectedRoute;if(!r){renderFocus();return;}
    const active=run.routeId===r.id,done=active?run.done:[],next=nextCheckpoint(r,done)||r.steps.find(s=>!done.includes(s.id));
    $('nextObjective').textContent=next?`Next: ${next.name}`:r.steps.length?'All steps complete':'Add steps in Plan mode to create a checklist.';
    $('objectiveNotes').textContent=next?.notes||'';$('routeNotes').textContent=r.notes;
    const distance=routeDistance(r.points,getPack().calibration);$('routeStats').textContent=`${r.steps.length} ${r.steps.length===1?'step':'steps'} · ${r.points.length} path points${distance===null?'':` · ≈ ${Math.round(distance).toLocaleString()} world units (horizontal)`}`;
    $('runTimer').textContent=clock(active?elapsed():0);$('startRun').textContent=active&&run.started?'Pause timer':active&&run.elapsed?'Resume timer':'Start timer';
    r.steps.forEach((s,i)=>{if(done.includes(s.id))return;const row=element('div',null,$('runSteps'),{className:'run-step'}),label=element('label',null,row,{className:'check'}),check=element('input',null,label,{type:'checkbox',checked:done.includes(s.id)});element('span',`${i+1}. ${s.name}`,label);check.onchange=()=>{if(!activateRun()){check.checked=!check.checked;return;}run.done=check.checked?[...run.done,s.id]:run.done.filter(id=>id!==s.id);persistRun();renderRun();};if(s.poiId){const p=getPack().pois.find(p=>p.id===s.poiId);if(p)button('⌖',row,()=>focusItem(p,'poi')).setAttribute('aria-label',`Locate step ${i+1}`);}if(s.notes)element('p',s.notes,row);});renderFocus();
  }
  function activateRun(){if(run.routeId===selectedRoute)return true;if(run.routeId&&(run.elapsed||run.started||run.done.length)&&!confirm('Start a new checklist for this route? This resets the previous attempt.'))return false;run={routeId:selectedRoute,done:[],elapsed:0,started:null};return true;}
  $('startRun').onclick=()=>{
    if(!selectedRoute||!activateRun())return;
    if(run.started){run.elapsed=elapsed();run.started=null;runStatus='Paused';}
    else{
      const route=getPack().routes.find(r=>r.id===selectedRoute);
      if(!nextCheckpoint(route,run.done)){message(route.steps.length?'This attempt is complete. Reset it to run again.':'Add POI-linked steps before starting a hands-free run.');return;}
      run.started=Date.now();run.finished=false;run.playerId=tracking?.player?.id||null;run.sessionId=tracking?.frame?.runId||null;
      run.radius=Math.max(2,Math.min(100,Number($('arrivalRadius').value)||12));runStatus='Waiting for fresh player position…';
      $('plannerMode').value='run';switchMode();
    }
    arrival.reset();persistRun();renderRun();redraw();
  };
  $('focusPause').onclick=()=>$('startRun').click();
  $('resetRun').onclick=()=>{if(!selectedRoute||!confirm('Reset this attempt’s timer and checklist?'))return;run={routeId:selectedRoute,done:[],elapsed:0,started:null};arrival.reset();guide=null;runStatus='Start the timer to follow this route automatically.';persistRun();renderRun();};
  $('locateNext').onclick=()=>{const r=getPack().routes.find(r=>r.id===selectedRoute),s=r?.steps.find(s=>!(run.routeId===r.id&&run.done.includes(s.id))),p=getPack().pois.find(p=>p.id===s?.poiId);if(p)focusItem(p,'poi');else message('The next step has no linked POI. Link one when editing the route.');};
  setInterval(()=>{if(run.routeId===selectedRoute){$('runTimer').textContent=clock(elapsed());$('focusTime').textContent=clock(elapsed());}},250);
  try{const value=JSON.parse(localStorage.getItem(runKey));if(value&&typeof value.routeId==='string'&&Array.isArray(value.done)&&value.done.every(s=>typeof s==='string')&&Number.isFinite(value.elapsed)&&value.elapsed>=0&&(value.started===null||Number.isFinite(value.started)))run=value;recovery=JSON.parse(localStorage.getItem(storageKey));}catch{}
  $('restorePlan').onclick=()=>{if(!recovery||!leave()||!prepare())return;try{const d=recovery.draft,pack=clone(getPack());const record=clone(d);delete record.kind;if(typeof record.name==='string'&&!record.name.trim())record.name='Recovered draft';for(const step of record.steps||[])if(typeof step.name==='string'&&!step.name.trim())step.name='Recovered step';if(d.kind==='route'&&d.points.length<2){if(!d.points.every(p=>Number.isFinite(p.u)&&Number.isFinite(p.v)&&p.u>=0&&p.u<=1&&p.v>=0&&p.v<=1))throw new Error('Invalid draft');const first=d.points[0]||{u:0,v:0};record.points=[first,first];}const list=d.kind==='poi'?pack.pois:pack.routes;const i=list.findIndex(p=>p.id===d.id);if(i<0)list.push(record);else list[i]=record;validatePack(pack);draft=d;original=recovery.original;setTool(d.kind==='route'&&d.points.length<2?'route':'');if(tool!=='route')showEditor();changed();$('draftRecovery').hidden=true;}catch{message('The saved draft cannot be restored to this pack.');}};
  $('discardPlan').onclick=()=>{recovery=null;$('draftRecovery').hidden=true;try{localStorage.removeItem(storageKey);}catch{}};
  $('draftRecovery').hidden=!recovery?.draft;
  function renderFocus(){
    const r=getPack()?.routes.find(r=>r.id===selectedRoute),active=run.routeId===selectedRoute;
    const visible=$('plannerMode').value==='run'&&r&&active&&(run.started||run.elapsed||run.finished);
    const card=$('runFocus');card.hidden=!visible;document.body.classList.toggle('running-route',!!visible);
    if(!visible)return;
    const parent=$('areaPopup').open?$('areaPopup'):$('focusDock');if(card.parentElement!==parent)parent.append(card);
    const next=nextCheckpoint(r,run.done),index=r.steps.findIndex(s=>s.id===next?.id);
    $('focusRoute').textContent=r.name;$('focusTitle').textContent=next?.name||'Route complete';
    const key=`${r.id}:${next?.id||'complete'}`;if(key!==focusKey){focusKey=key;focusSince=Date.now();}
    const lastLinked=next&&!r.steps.slice(index+1).some(s=>s.poiId&&!run.done.includes(s.id));
    const text=r.steps.filter((s,i)=>!run.done.includes(s.id)&&(i<=index||(lastLinked&&!s.poiId))).map(s=>s.notes||getPack().pois.find(p=>p.id===s.poiId)?.notes||'').filter(Boolean).join(' ');
    const words=text.split(/\s+/).filter(Boolean),pages=Math.max(1,Math.ceil(words.length/45)),page=Math.floor((Date.now()-focusSince)/15000)%pages;
    $('focusInstructions').textContent=words.slice(page*45,(page+1)*45).join(' ');
    $('focusPage').textContent=pages>1?`Instructions ${page+1}/${pages} · changes every 15 seconds`:'';
    $('focusProgress').textContent=next?`Step ${index+1} of ${r.steps.length}`:`${r.steps.length} steps complete`;
    $('focusStatus').textContent=runStatus;$('focusTime').textContent=clock(elapsed());
    $('focusPause').textContent=run.started?'Pause':'Resume';$('focusPause').hidden=!!run.finished;
    $('focusDistance').textContent=guide?.distance!=null?`${Math.round(guide.distance)} units to POI`:'';
    $('focusArrow').hidden=!guide?.point||!guide?.poi||!run.started||guide.distance<1;
    if(guide?.point&&guide?.poi){const degrees=Math.atan2(guide.poi.u-guide.point.u,guide.point.v-guide.poi.v)*180/Math.PI;$('focusArrowShape').setAttribute('transform',`rotate(${degrees} 24 24)`);}
    const upcoming=r.steps.slice(index+1).find(s=>!run.done.includes(s.id)&&s.poiId);$('focusUpcoming').textContent=next&&upcoming?`Then: ${upcoming.name}`:'';
  }
  function updateTracking(value){
    tracking=value;const r=getPack()?.routes.find(r=>r.id===run.routeId);
    if(!run.started||!r||selectedRoute!==run.routeId||$('plannerMode').value!=='run'){arrival.reset();renderFocus();return;}
    const {player,frame,projection,replay,ageMs}=value;
    if(replay||ageMs>=3000||!player||!projection){arrival.reset();guide=null;runStatus=replay?'Replay — automatic progress suspended':!projection?'Map alignment required for auto-advance':'Waiting for fresh player position…';renderFocus();return;}
    if(run.sessionId&&run.sessionId!==frame.runId){run.elapsed=elapsed();run.started=null;arrival.reset();guide=null;runStatus='Game session changed — timer paused';persistRun();renderRun();return;}
    if(run.playerId&&run.playerId!==player.id){arrival.reset();guide=null;runStatus='Select the player this attempt started with';renderFocus();return;}
    if(!run.playerId){run.playerId=player.id;run.sessionId=frame.runId;persistRun();}
    const point=projection(player),pack=getPack();
    const result=arrival.update({route:r,pack,done:run.done,point,playerId:player.id,sessionId:frame.runId,timestamp:frame.timestamp,sequence:frame.sequence,active:true,replay,ageMs,radius:run.radius||12});
    if(result.completed.length){run.done=[...new Set([...run.done,...result.completed])];if(!nextCheckpoint(r,run.done)){run.elapsed=elapsed();run.started=null;run.finished=true;runStatus='Route complete — timer stopped';}persistRun();renderRun();}
    const next=nextCheckpoint(r,run.done),poi=pack.pois.find(p=>p.id===next?.poiId);
    guide={point,poi,distance:poi?routeDistance([point,poi],pack.calibration):null,segment:poi?guideSegment(r.points,point,poi):[]};
    if(run.started){runStatus=result.arrived&&!result.completed.length?`At this POI — instructions stay until you leave ${Math.round((run.radius||12)*1.5)} world units`:`Following ${player.local?'you':player.name||'player'} · arrive within ${run.radius||12} units, leave to advance`;followMap(point);}
    renderFocus();
  }
  function offerImport(pack){if(!leave()||!prepare())return;pendingImport=pack;$('importSummary').textContent=`${pack.name}: ${pack.pois.length} POIs, ${pack.routes.length} routes, ${pack.areas.length} areas. Add keeps your current alignment; replace uses the imported alignment.`;$('importDialog').showModal();}
  for(const [id,merge]of [['mergePack',true],['replacePack',false]])$(id).onclick=async()=>{if(!pendingImport||busy)return;busy=true;$('mergePack').disabled=$('replacePack').disabled=true;try{const pack=merge?mergePlanningPacks(getPack(),pendingImport):pendingImport;if(await savePack(pack)){pendingImport=null;$('importDialog').close();renderList();message('Shared pack imported and saved.');}}catch(e){message(e.message);}finally{busy=false;$('mergePack').disabled=$('replacePack').disabled=false;}};
  $('cancelImport').onclick=()=>$('importDialog').close();
  return {renderMap,renderList,leave,offerImport,updateTracking,renderFocus,getGuide:()=>run.started?guide:null,isEditing:()=>!!draft||!!tool||$('importDialog').open,ready(){selectedRoute=run.routeId;renderList();switchMode();}};
}
