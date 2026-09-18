import {validatePlanning} from './planning-data.mjs';
export const blankPack = () => ({version:2, name:'Our island route', calibration:[], areas:[],pois:[],routes:[]});
export function validatePack(pack) {
  if (!pack || ![1,2].includes(pack.version) || typeof pack.name !== 'string' || pack.name.length > 150 ||
      !Array.isArray(pack.areas) || pack.areas.length > 500 || !Array.isArray(pack.calibration) || pack.calibration.length > 3)
    throw new Error('This is not a supported route pack.');
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const unit = n => finite(n) && n >= 0 && n <= 1;
  const ids = new Set();
  for (const a of pack.areas) {
    if (!a || typeof a.id !== 'string' || !a.id || ids.has(a.id) || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 150 ||
        typeof a.notes !== 'string' || a.notes.length > 200000 || ![a.x,a.y,a.w,a.h].every(unit) || a.w <= 0 || a.h <= 0 || a.x+a.w > 1.000001 || a.y+a.h > 1.000001)
      throw new Error('An area has invalid bounds or notes.');
    ids.add(a.id);
  }
  for (const p of pack.calibration)
    if (!p || !finite(p.x) || !finite(p.z) || !unit(p.u) || !unit(p.v)) throw new Error('Invalid map alignment point.');
  if(pack.calibration.length===3) affine(pack.calibration);
  if(pack.alignmentMethod !== undefined && !['manual','train-track-fit'].includes(pack.alignmentMethod)) throw new Error('Unknown alignment method.');
  const assets=validateAssets(pack.assets || {});
  return {version:2,...validatePlanning(pack),assets,name:pack.name,calibration:pack.calibration.map(p=>({x:p.x,z:p.z,u:p.u,v:p.v})),
    alignmentMethod:pack.alignmentMethod || 'manual',
    areas:pack.areas.map(a=>({id:a.id,name:a.name,notes:a.notes,x:a.x,y:a.y,w:a.w,h:a.h}))};
}
export function affine(points) {
  if(points.length !== 3) return null;
  const [a,b,c] = points;
  const dx=b.x-a.x,dz=b.z-a.z,ex=c.x-a.x,ez=c.z-a.z,det=dx*ez-ex*dz;
  if(Math.abs(det)<0.01) throw new Error('Choose three landmarks that form a triangle, not a straight line.');
  const ux=((b.u-a.u)*ez-(c.u-a.u)*dz)/det, uz=(dx*(c.u-a.u)-ex*(b.u-a.u))/det;
  const vx=((b.v-a.v)*ez-(c.v-a.v)*dz)/det, vz=(dx*(c.v-a.v)-ex*(b.v-a.v))/det;
  if(Math.abs(ux*vz-uz*vx)<1e-12) throw new Error('Choose three distinct map landmarks that form a triangle.');
  return p=>({u:a.u+ux*(p.x-a.x)+uz*(p.z-a.z),v:a.v+vx*(p.x-a.x)+vz*(p.z-a.z)});
}
export function inArea(p,a,margin=0) {
  return p && p.u>=a.x-margin && p.u<=a.x+a.w+margin && p.v>=a.y-margin && p.v<=a.y+a.h+margin;
}
export function activeAreas(point,areas,previous=new Set()) {
  return areas.filter(a=>inArea(point,a,previous.has(a.id)?0.003:0));
}
export function trainMarkers(frame) {
  if(frame?.trainMarkers?.length) return frame.trainMarkers.map(t=>{
    const group=['A','B','C'].indexOf(t.group);
    return {...t,name:['Red train','Green train','Yellow train'][group]||t.name,
      color:['#ff696d','#5be2a0','#ffd458'][group]||'#ffffff',provisional:false};
  });
  // Legacy recordings precede normalized train markers. Only use verified hierarchy/layout.
  return (frame?.trains||[]).filter(t=>!t.hasCable && t.identity?.path==='TrainSystem/TrainNew/TrainNetworking' && t.cars?.length===15)
    .flatMap(t=>[0,5,10].flatMap((i,g)=> {
      const p=t.cars[i]?.bodyPosition;
      if(!p) return [];
      return [{id:`${t.id}:${g}`,name:['Red train','Green train','Yellow train'][g],
        color:['#ff696d','#5be2a0','#ffd458'][g],provisional:false,...p}];
    }));
}

export const MAX_PACK_BYTES=32_000_000;
export function validateAssets(assets){
  if(!assets||typeof assets!=='object'||Array.isArray(assets)||Object.keys(assets).length>200)throw new Error('Invalid note images.');
  const clean={};let total=0;
  for(const [id,a] of Object.entries(assets)){
    if(!/^[a-zA-Z0-9-]{1,80}$/.test(id)||!a||typeof a.name!=='string'||a.name.length>200||typeof a.data!=='string'||!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(a.data)||a.data.length>7_000_000)throw new Error('Unsupported or oversized note image.');
    total+=a.data.length;if(total>28_000_000)throw new Error('Note images exceed the 28 MB route limit.');
    clean[id]={name:a.name,data:a.data};
  }
  return clean;
}
export function moveMarkdownBlock(source,start,end,destination){
  if(![start,end,destination].every(Number.isInteger)||start<0||end>source.length||end<=start||destination<0||destination>source.length)throw new Error('Invalid block move.');
  if(destination>=start&&destination<=end)return source;
  const block=source.slice(start,end).trimEnd()+'\n\n';
  const remaining=source.slice(0,start)+source.slice(end);
  const at=destination>end?destination-(end-start):destination;
  return remaining.slice(0,at)+block+remaining.slice(at);
}
export function popupTransition(previous,ids){
  const entered=ids.some(id=>!previous.ids.includes(id));
  return {ids:[...ids],minimized:!ids.length?false:entered?false:previous.minimized};
}

// Batch adjacent age bands into at most 16 SVG paths per trail.
export function fadedTrailPaths(points,project,now,seconds,bands=16){
  if(!Number.isFinite(now)||!Number.isFinite(seconds)||seconds<=0)return [];
  const cutoff=now-seconds*1000,paths=Array.from({length:bands},()=>[]);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(!Number.isFinite(a.timestamp)||!Number.isFinite(b.timestamp)||b.timestamp<cutoff||a.timestamp>now||b.timestamp<a.timestamp)continue;
    let p=project(a),q=project(b);if(Math.hypot(q.u-p.u,q.v-p.v)>.1)continue;
    const span=b.timestamp-a.timestamp,lo=span?Math.max(0,(cutoff-a.timestamp)/span):0,hi=span?Math.min(1,(now-a.timestamp)/span):1;
    if(lo>hi)continue;
    const lerp=t=>({u:p.u+(q.u-p.u)*t,v:p.v+(q.v-p.v)*t});
    const start=lerp(lo),end=lerp(hi),mid=a.timestamp+span*(lo+hi)/2;
    const age=Math.min(1,Math.max(0,(mid-cutoff)/(seconds*1000))),band=Math.min(bands-1,Math.floor(age*bands));
    paths[band].push(`M${start.u*1000},${start.v*1000}L${end.u*1000},${end.v*1000}`);
  }
  return paths.flatMap((parts,i)=>parts.length?[{d:parts.join(' '),opacity:(i+.5)/bands}]:[]);
}

export function transformAreaBounds(area,handle,dx,dy,minSize=.002){
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  if(handle==='move')return {...area,x:clamp(area.x+dx,0,1-area.w),y:clamp(area.y+dy,0,1-area.h)};
  let left=area.x,right=area.x+area.w,top=area.y,bottom=area.y+area.h;
  if(handle.includes('w'))left=clamp(left+dx,0,right-minSize);
  if(handle.includes('e'))right=clamp(right+dx,left+minSize,1);
  if(handle.includes('n'))top=clamp(top+dy,0,bottom-minSize);
  if(handle.includes('s'))bottom=clamp(bottom+dy,top+minSize,1);
  return {...area,x:left,y:top,w:right-left,h:bottom-top};
}
