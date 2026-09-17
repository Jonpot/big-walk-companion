import {marked,DOMPurify} from './vendor.mjs';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderMarkdown(target,source,assets={},editable=false){
  const renderer=new marked.Renderer();
  renderer.image=token=>{
    const id=token.href.startsWith('asset:')?token.href.slice(6):'';
    const asset=Object.hasOwn(assets,id)?assets[id]:null;
    if(!asset)return `<span class="missing-image">[Image: ${escape(token.text)}]</span>`;
    const width=/\bwidth=(25|50|75|100)\b/.exec(token.title||'')?.[1]||'100';
    const align=/\balign=(left|center|right)\b/.exec(token.title||'')?.[1]||'center';
    return `<img src="${escape(asset.data)}" alt="${escape(token.text)}" data-asset="${escape(id)}" data-width="${width}" data-align="${align}">`;
  };
  const tokens=marked.lexer(source,{gfm:true});target.replaceChildren();let offset=0;
  for(const token of tokens){
    const start=offset;offset+=token.raw.length;if(token.type==='space'||token.type==='def')continue;
    const block=document.createElement('div');block.className='note-block';block.dataset.start=start;block.dataset.end=offset;
    const one=[token];one.links=tokens.links;
    block.innerHTML=DOMPurify.sanitize(marked.parser(one,{renderer,gfm:true}),{
      USE_PROFILES:{html:true},FORBID_TAGS:['form','button','select','textarea','iframe','video','audio','style'],FORBID_ATTR:['style','id','name'],ALLOW_DATA_ATTR:true
    });
    for(const img of block.querySelectorAll('img')){
      if(!Object.hasOwn(assets,img.dataset.asset||'')||img.getAttribute('src')!==assets[img.dataset.asset].data){img.remove();continue;}
      img.style.width=`${['25','50','75','100'].includes(img.dataset.width)?img.dataset.width:'100'}%`;
      img.style.display='block';img.style.marginLeft=img.dataset.align==='left'?'0':'auto';img.style.marginRight=img.dataset.align==='right'?'0':'auto';img.draggable=false;
    }
    for(const a of block.querySelectorAll('a')){if(!/^https?:\/\//i.test(a.getAttribute('href')||''))a.removeAttribute('href');else{a.target='_blank';a.rel='noopener noreferrer';}}
    for(const input of block.querySelectorAll('input')){if(input.type!=='checkbox')input.remove();else input.disabled=true;}
    if(editable){block.draggable=true;block.title='Drag to reorder';}
    target.append(block);
  }
}
