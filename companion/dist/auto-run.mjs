import {routeDistance} from './planning-data.mjs';
export function nextCheckpoint(route,done){return route?.steps.find(s=>!done.includes(s.id)&&s.poiId)||null;}
export function createArrivalTracker(){
  let candidate='',entered=0,lastStamp=0,lastFrame='',identity='',arrived=false;
  const reset=()=>{candidate='';entered=0;lastStamp=0;lastFrame='';identity='';arrived=false;};
  return {reset,update({route,pack,done,point,playerId,sessionId,timestamp,sequence,active,replay,ageMs,radius=12}){
    const step=nextCheckpoint(route,done),poi=pack.pois.find(p=>p.id===step?.poiId);
    if(!active||replay||ageMs>=3000||!Number.isFinite(timestamp)||!point||!poi){reset();return {completed:[],distance:null};}
    const distance=routeDistance([point,poi],pack.calibration);
    if(distance===null||!Number.isFinite(distance)){reset();return {completed:[],distance:null};}
    const who=`${sessionId}:${playerId}`,key=`${who}:${timestamp}:${sequence}`;
    if(identity!==who||timestamp-lastStamp>1500||timestamp<lastStamp){candidate='';entered=0;arrived=false;}
    identity=who;
    if(key===lastFrame)return {completed:[],distance,arrived};lastFrame=key;lastStamp=timestamp;
    if(arrived&&candidate===step.id){
      if(distance<=radius*1.5)return {completed:[],distance,arrived:true};
    }else{
      if(distance>radius){candidate='';arrived=false;return {completed:[],distance};}
      if(candidate!==step.id){candidate=step.id;entered=timestamp;arrived=false;return {completed:[],distance};}
      if(timestamp-entered<500)return {completed:[],distance};
      arrived=true;return {completed:[],distance,arrived:true};
    }
    // Instruction-only steps accompany the next linked checkpoint. Trailing
    // instructions finish with the last checkpoint, so no click is required.
    const end=route.steps.indexOf(step),later=route.steps.slice(end+1).some(s=>!done.includes(s.id)&&s.poiId);
    const completed=route.steps.filter((s,i)=>!done.includes(s.id)&&(i<=end||!later)).map(s=>s.id);
    reset();return {completed,distance};
  }};
}
export function guideSegment(points,from,to){
  if(!from||!to||points.length<2)return [];
  function closest(p){let best=null;for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],du=b.u-a.u,dv=b.v-a.v,l=du*du+dv*dv,t=l?Math.max(0,Math.min(1,((p.u-a.u)*du+(p.v-a.v)*dv)/l)):0,q={u:a.u+t*du,v:a.v+t*dv},distance=Math.hypot(q.u-p.u,q.v-p.v);if(!best||distance<best.distance)best={...q,at:i+t,distance};}return best;}
  const a=closest(from),b=closest(to),lo=Math.min(a.at,b.at),hi=Math.max(a.at,b.at);
  const inner=points.filter((_,i)=>i>lo&&i<hi);if(a.at>b.at)inner.reverse();
  return [{u:a.u,v:a.v},...inner,{u:b.u,v:b.v}];
}
