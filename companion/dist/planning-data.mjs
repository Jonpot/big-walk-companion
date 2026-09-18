import {hasIcon} from './icons.mjs';
export const POI_CATEGORIES=['landmark','puzzle','collectible','transport','shortcut','hazard'];
export function validatePlanning(pack){
  const pois=pack.pois??[],routes=pack.routes??[];
  if(!Array.isArray(pois)||pois.length>1000||!Array.isArray(routes)||routes.length>100)throw new Error('Limit: 1,000 POIs and 100 routes per pack.');
  const unit=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1;
  const ids=new Set((pack.areas||[]).map(a=>a.id));
  function item(a){
    if(!a||typeof a.id!=='string'||!a.id||a.id.length>150||ids.has(a.id)||typeof a.name!=='string'||!a.name.trim()||a.name.length>150||typeof a.notes!=='string'||a.notes.length>200000||!/^#[0-9a-f]{6}$/i.test(a.color))throw new Error('Invalid or duplicate planning item.');
    ids.add(a.id);return {id:a.id,name:a.name,notes:a.notes,color:a.color};
  }
  const cleanPois=pois.map(p=>{const a=item(p);if(!unit(p.u)||!unit(p.v)||!POI_CATEGORIES.includes(p.category)||!hasIcon(p.icon??'map-pin'))throw new Error('Invalid POI location or category.');return {...a,u:p.u,v:p.v,category:p.category,icon:p.icon??'map-pin'};});
  let total=0;
  const cleanRoutes=routes.map(r=>{
    const a=item(r);
    if(!Array.isArray(r.points)||r.points.length<2||r.points.length>2000||!Array.isArray(r.steps)||r.steps.length>1000)throw new Error('A route needs 2–2,000 points and at most 1,000 steps.');
    total+=r.points.length;if(total>20000)throw new Error('Route pack exceeds 20,000 path points.');
    const points=r.points.map(p=>{if(!p||!unit(p.u)||!unit(p.v))throw new Error('Route point is outside the map.');return {u:p.u,v:p.v};});
    const stepIds=new Set();
    const steps=r.steps.map(s=>{
      if(!s||typeof s.id!=='string'||!s.id||s.id.length>150||stepIds.has(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>150||typeof s.notes!=='string'||s.notes.length>2000||typeof s.poiId!=='string'||(s.poiId&&!cleanPois.some(p=>p.id===s.poiId)))throw new Error('Invalid route step or missing linked POI.');
      stepIds.add(s.id);return {id:s.id,name:s.name,notes:s.notes,poiId:s.poiId};
    });
    return {...a,points,steps};
  });
  return {pois:cleanPois,routes:cleanRoutes};
}

// Add a shared pack as independent copies, preserving the recipient's alignment.
// Every imported id is remapped, including image references and linked steps.
export function mergePlanningPacks(current,incoming,newId=()=>crypto.randomUUID()){
  const result=structuredClone(current),other=structuredClone(incoming),poiIds=new Map(),assetIds=new Map();
  result.pois??=[];result.routes??=[];result.assets??={};
  const used=new Set([...result.areas,...result.pois,...result.routes].map(a=>a.id));
  for(const id of Object.keys(result.assets))used.add(id);
  const fresh=()=>{let id;do{id=newId();}while(used.has(id));used.add(id);return id;};
  for(const [id,asset]of Object.entries(other.assets||{})){const next=fresh();assetIds.set(id,next);result.assets[next]=asset;}
  const notes=s=>s.replace(/asset:([a-zA-Z0-9-]+)/g,(all,id)=>assetIds.has(id)?`asset:${assetIds.get(id)}`:all);
  for(const a of other.areas)result.areas.push({...a,id:fresh(),notes:notes(a.notes)});
  for(const p of other.pois||[]){const id=fresh();poiIds.set(p.id,id);result.pois.push({...p,id,notes:notes(p.notes)});}
  for(const r of other.routes||[])result.routes.push({...r,id:fresh(),notes:notes(r.notes),steps:r.steps.map(s=>({...s,id:fresh(),notes:notes(s.notes),poiId:poiIds.get(s.poiId)||''}))});
  return result;
}

export function removePoi(pack,id){
  const next=structuredClone(pack);next.pois=next.pois.filter(p=>p.id!==id);
  // Keep the instruction when its marker is removed.
  for(const r of next.routes)for(const s of r.steps)if(s.poiId===id)s.poiId='';
  return next;
}

export function routeDistance(points,calibration){
  if(calibration.length!==3)return null;
  const [a,b,c]=calibration,du=b.u-a.u,dv=b.v-a.v,eu=c.u-a.u,ev=c.v-a.v,det=du*ev-eu*dv;
  if(Math.abs(det)<1e-12)return null;
  const world=p=>{const s=((p.u-a.u)*ev-(p.v-a.v)*eu)/det,t=(du*(p.v-a.v)-dv*(p.u-a.u))/det;return {x:a.x+s*(b.x-a.x)+t*(c.x-a.x),z:a.z+s*(b.z-a.z)+t*(c.z-a.z)};};
  return points.slice(1).reduce((sum,p,i)=>{const x=world(points[i]),y=world(p);return sum+Math.hypot(y.x-x.x,y.z-x.z);},0);
}
