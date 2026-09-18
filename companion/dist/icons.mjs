import {lucideIcons,lucideVersion} from './lucide-catalog.mjs';
export {lucideVersion};
export const iconNames=Object.keys(lucideIcons).sort();
export const hasIcon=name=>typeof name==='string'&&Object.hasOwn(lucideIcons,name);
export function searchIcons(query){const words=query.toLowerCase().trim().split(/[\s_-]+/).filter(Boolean);return iconNames.filter(name=>words.every(word=>name.includes(word)));}
export function appendIcon(parent,name,{x=0,y=0,size=20,color='currentColor'}={}){
  const ns='http://www.w3.org/2000/svg',icon=document.createElementNS(ns,'svg');
  for(const [key,value]of Object.entries({x,y,width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:color,'stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true','focusable':'false','pointer-events':'none'}))icon.setAttribute(key,value);
  icon.dataset.lucide=hasIcon(name)?name:'map-pin';
  for(const [tag,attrs]of lucideIcons[icon.dataset.lucide]){const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);icon.append(node);}
  parent.append(icon);return icon;
}
export function iconContrast(hex){const parts=hex.slice(1).match(/../g)?.map(n=>parseInt(n,16))||[255,255,255];return parts[0]*.299+parts[1]*.587+parts[2]*.114>140?'#101719':'#ffffff';}
export function createIconPicker(onSelect){
  const $=id=>document.getElementById(id),pageSize=100;let matches=iconNames,limit=pageSize,selected='map-pin';
  function render(){
    const grid=$('iconGrid');grid.replaceChildren();
    for(const name of matches.slice(0,limit)){
      const button=document.createElement('button');button.type='button';button.className='icon-choice';button.title=name;button.setAttribute('aria-label',name);button.setAttribute('aria-pressed',String(name===selected));appendIcon(button,name,{size:24});const label=document.createElement('span');label.textContent=name;button.append(label);button.onclick=()=>{selected=name;onSelect(name);$('iconDialog').close();};grid.append(button);
    }
    $('iconResults').textContent=`${matches.length.toLocaleString()} icons${matches.length>limit?` · showing ${limit}`:''} · Lucide ${lucideVersion}`;
    $('moreIcons').hidden=matches.length<=limit;$('iconEmpty').hidden=matches.length!==0;
  }
  $('iconSearch').oninput=()=>{matches=searchIcons($('iconSearch').value);limit=pageSize;render();};
  $('moreIcons').onclick=()=>{limit+=pageSize;render();};$('closeIcons').onclick=()=>$('iconDialog').close();
  return {open(name){selected=hasIcon(name)?name:'map-pin';$('iconSearch').value='';matches=iconNames;limit=pageSize;render();$('iconDialog').showModal();$('iconSearch').focus();}};
}
