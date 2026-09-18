import {appendIcon,iconContrast} from './icons.mjs';
// A separate viewBox keeps the notes map zoomed in without changing the main map.
export function minimapView({point,area,size=180}){
  const valid=point&&Number.isFinite(point.u)&&Number.isFinite(point.v);
  const center=valid?point:area?{u:area.x+area.w/2,v:area.y+area.h/2}:{u:.5,v:.5};
  return {x:Math.max(0,Math.min(1000-size,center.u*1000-size/2)),y:Math.max(0,Math.min(1000-size,center.v*1000-size/2)),w:size,h:size};
}
export function renderNotesMinimap({svg,pack,projection,player,players,trains,activeArea,available,replay,label,mapReady,mapHref}){
  const $=id=>document.getElementById(id),root=$('notesMiniMap'),layer=$('notesMiniMarkers');
  if(!$('areaPopup').open)return;
  const point=projection&&player?projection(player):null;
  const view=minimapView({point,area:activeArea});root.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);
  if(mapHref)$('notesMiniImage').setAttribute('href',mapHref);
  const scale=view.w/220;
  layer.replaceChildren();
  for(const a of pack.areas)svg('rect',{x:a.x*1000,y:a.y*1000,width:a.w*1000,height:a.h*1000,fill:a.id===activeArea?.id?'#c5f78533':'#c5f78511',stroke:'#c5f78577','stroke-width':scale},layer);
  for(const r of pack.routes)svg('polyline',{points:r.points.map(p=>`${p.u*1000},${p.v*1000}`).join(' '),fill:'none',stroke:r.color,'stroke-width':2*scale,'stroke-linejoin':'round'},layer);
  for(const p of pack.pois){svg('circle',{cx:p.u*1000,cy:p.v*1000,r:9*scale,fill:p.color,stroke:'#111','stroke-width':scale},layer);appendIcon(layer,p.icon,{x:p.u*1000-6*scale,y:p.v*1000-6*scale,size:12*scale,color:iconContrast(p.color)});}
  if(projection&&available){
    for(const t of trains){const p=projection(t);svg('rect',{x:p.u*1000-3*scale,y:p.v*1000-3*scale,width:6*scale,height:6*scale,rx:scale,fill:t.color,stroke:'#111','stroke-width':scale},layer);}
    for(const other of players){const p=projection(other),selected=other.id===player?.id;svg('circle',{cx:p.u*1000,cy:p.v*1000,r:(selected?6:4)*scale,fill:selected?'#c5f785':'#8be7ff',stroke:'#080e11','stroke-width':2*scale},layer);if(selected)svg('circle',{cx:p.u*1000,cy:p.v*1000,r:9*scale,fill:'none',stroke:'#fff','stroke-width':scale},layer);}
  }
  $('notesMiniCaption').textContent=!mapReady?'Map unavailable':!point?'Area overview':!available?'Last known position':`${replay?'Replay':'Following'} · ${label}`;
}
