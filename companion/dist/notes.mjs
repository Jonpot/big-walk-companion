import {EditorView,basicSetup,markdown,oneDark} from './vendor.mjs';
import {renderMarkdown} from './markdown.mjs';
import {moveMarkdownBlock,popupTransition,validateAssets} from './core.mjs';
const $=id=>document.getElementById(id);
export function createNotesUI({getPack,savePack,onClose,isMapEditing=()=>false}){
  let area=null,assets={},original='',generation=0,uploads=0,selectedImage=null;
  let popup={ids:[],minimized:false},active=[],selectedArea='',popupKey='',popupAssets=null,returnFocus=null;
  const error=text=>{$('editorError').textContent=text;$('editorError').hidden=!text;};
  const source=()=>editor.state.doc.toString();
  const replace=(from,to,insert)=>{editor.dispatch({changes:{from,to,insert},selection:{anchor:from+insert.length}});editor.focus();};
  function format(kind){
    const {from,to}=editor.state.selection.main,s=source().slice(from,to),sample=s||'text';
    const wrap={bold:['**','**'],italic:['*','*'],strike:['~~','~~'],code:['`','`']};
    if(wrap[kind]){const [a,b]=wrap[kind];replace(from,to,a+sample+b);return;}
    const prefixes={heading:'## ',list:'- ',ordered:'1. ',task:'- [ ] ',quote:'> '};
    if(prefixes[kind]){const line=editor.state.doc.lineAt(from),end=editor.state.doc.lineAt(to);replace(line.from,end.to,source().slice(line.from,end.to).split('\n').map(t=>prefixes[kind]+t).join('\n'));return;}
    if(kind==='codeblock')replace(from,to,'\n```\n'+sample+'\n```\n');
    if(kind==='table')replace(from,to,'\n| Step | Notes |\n| --- | --- |\n| 1 |  |\n');
    if(kind==='link'){const url=prompt('Link URL','https://');if(url&&/^https?:\/\//i.test(url))replace(from,to,`[${sample}](${url.replace(/[()\s]/g,c=>encodeURIComponent(c))})`);}
  }
  const editorExtensions=[basicSetup,markdown(),oneDark,EditorView.lineWrapping,
    EditorView.contentAttributes.of({'aria-label':'Markdown',spellcheck:'true'}),
    EditorView.theme({'&':{height:'100%',backgroundColor:'#0d1011'},'.cm-scroller':{overflow:'auto',fontFamily:'Consolas, monospace',fontSize:'14px'},'.cm-content':{padding:'20px'},'.cm-gutters':{backgroundColor:'#0b0d0e',borderRight:'1px solid #ffffff0d'}}),
    EditorView.updateListener.of(update=>{if(update.docChanged){renderPreview();error('');}}),
    EditorView.domEventHandlers({paste(event){const files=[...(event.clipboardData?.files||[])];if(files.length){event.preventDefault();void addImages(files);return true;}},drop(event,view){const files=[...(event.dataTransfer?.files||[])];if(files.length){event.preventDefault();const at=view.posAtCoords({x:event.clientX,y:event.clientY});if(at!==null)view.dispatch({selection:{anchor:at}});void addImages(files);return true;}const raw=event.dataTransfer?.getData('application/x-bigwalk-block');if(raw){event.preventDefault();moveBlock(raw,view.posAtCoords({x:event.clientX,y:event.clientY})??source().length);return true;}},keydown(event){if((event.ctrlKey||event.metaKey)&&['b','i'].includes(event.key.toLowerCase())){event.preventDefault();format(event.key.toLowerCase()==='b'?'bold':'italic');return true;}}})];
  const editor=new EditorView({parent:$('markdownEditor'),extensions:editorExtensions});
  function renderPreview(){renderMarkdown($('notePreview'),source(),assets,true);}
  function dirty(){return area&&JSON.stringify([$ ('areaName').value,source(),assets])!==original;}
  function close(force=false){if(!force&&dirty()&&!confirm('Discard unsaved note changes?'))return false;generation++;area=null;selectedImage=null;$('editor').close();$('imageFormatting').hidden=true;error('');onClose();syncPopup();return true;}
  function open(value){
    if(area&&!close())return false;
    area={...value};assets=structuredClone(getPack().assets||{});generation++;selectedImage=null;uploads=0;
    $('areaName').value=area.name;$('deleteArea').hidden=!getPack().areas.some(a=>a.id===area.id);$('saveArea').disabled=false;$('imageFormatting').hidden=true;
    // A new state prevents undo from revealing another area's previous content.
    editor.setState(editor.state.constructor.create({doc:area.notes||'',extensions:editorExtensions}));
    original=JSON.stringify([$ ('areaName').value,source(),assets]);error('');
    if($('areaPopup').open)$('areaPopup').close();if($('settingsDialog').open)$('settingsDialog').close();
    $('editor').showModal();renderPreview();editor.requestMeasure();$('areaName').focus();return true;
  }
  async function save(){if(!area||uploads)return;error('');const pack=structuredClone(getPack()),updated={...area,name:$('areaName').value.trim(),notes:source()};if(!updated.name){error('Enter an area name.');$('areaName').focus();return;}const i=pack.areas.findIndex(a=>a.id===area.id);if(i<0)pack.areas.push(updated);else pack.areas[i]=updated;
    const used=new Set([...pack.areas,...(pack.pois||[]),...(pack.routes||[]),...(pack.routes||[]).flatMap(r=>r.steps)].flatMap(a=>[...a.notes.matchAll(/asset:([a-zA-Z0-9-]+)/g)].map(m=>m[1])));pack.assets=Object.fromEntries(Object.entries(assets).filter(([id])=>used.has(id)));
    $('saveArea').disabled=true;try{if(await savePack(pack))close(true);else error('Could not save. Your edits are still open.');}catch(e){error(e.message);}finally{$('saveArea').disabled=false;}}
  async function addImages(files){const current=generation;uploads++;$('saveArea').disabled=true;try{
    for(const file of files){if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw new Error('Choose a PNG, JPEG, WebP, or GIF image.');if(file.size>5_000_000)throw new Error('Each image must be smaller than 5 MB.');
      const bitmap=await createImageBitmap(file);const pixels=bitmap.width*bitmap.height;bitmap.close();if(pixels>30_000_000)throw new Error('This image is too large. Resize it below 30 megapixels.');
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Could not read image.'));r.readAsDataURL(file);});
      if(current!==generation||!area)return;const id=crypto.randomUUID(),name=(file.name||'Pasted image').slice(0,200);validateAssets({...assets,[id]:{name,data}});assets[id]={name,data};
      const {from,to}=editor.state.selection.main;replace(from,to,`\n\n![${name.replace(/[\[\]\\\r\n]/g,'')}](${`asset:${id}`} "width=100 align=center")\n\n`);
    }
  }catch(e){if(current===generation)error(e.message);}finally{if(current===generation){uploads--;$('saveArea').disabled=uploads>0;}}}
  function moveBlock(raw,destination){try{const block=JSON.parse(raw);if(block.source!==source())return;const next=moveMarkdownBlock(source(),block.from,block.to,destination);replace(0,source().length,next);}catch(e){error('Could not move this block.');}}
  $('notePreview').ondragstart=e=>{const block=e.target.closest('.note-block');if(!block)return;e.dataTransfer.setData('application/x-bigwalk-block',JSON.stringify({source:source(),from:Number(block.dataset.start),to:Number(block.dataset.end)}));e.dataTransfer.effectAllowed='move';};
  $('notePreview').ondragover=e=>{e.preventDefault();};
  $('notePreview').ondrop=e=>{e.preventDefault();if(e.dataTransfer.files.length){void addImages([...e.dataTransfer.files]);return;}const block=e.target.closest('.note-block');const dest=block?(e.clientY>block.getBoundingClientRect().top+block.getBoundingClientRect().height/2?Number(block.dataset.end):Number(block.dataset.start)):source().length;moveBlock(e.dataTransfer.getData('application/x-bigwalk-block'),dest);};
  $('notePreview').onclick=e=>{const image=e.target.closest('img[data-asset]');if(!image)return;selectedImage={id:image.dataset.asset,blockStart:Number(image.closest('.note-block').dataset.start)};$('imageAlt').value=image.alt;$('imageWidth').value=image.dataset.width;$('imageAlign').value=image.dataset.align;$('imageFormatting').hidden=false;};
  function modifyImage(remove){if(!selectedImage)return;const text=source(),pattern=/!\[([^\]]*)\]\(asset:([a-zA-Z0-9-]+)(?:\s+"[^"]*")?\)/g;const match=[...text.matchAll(pattern)].find(m=>m[2]===selectedImage.id&&m.index>=selectedImage.blockStart);if(!match){error('Select the image again.');return;}const alt=$('imageAlt').value.replace(/[\[\]\\\r\n]/g,'');replace(match.index,match.index+match[0].length,remove?'':`![${alt}](asset:${selectedImage.id} "width=${$('imageWidth').value} align=${$('imageAlign').value}")`);if(remove){selectedImage=null;$('imageFormatting').hidden=true;}}
  $('applyImageFormat').onclick=()=>modifyImage(false);$('removeImage').onclick=()=>modifyImage(true);
  $('formatToolbar').onclick=e=>{const button=e.target.closest('[data-format]');if(button)format(button.dataset.format);};
  $('editor').addEventListener('paste',e=>{if(e.defaultPrevented)return;const files=[...(e.clipboardData?.files||[])];if(files.length){e.preventDefault();void addImages(files);}});
  $('uploadImage').onclick=()=>$('imageFile').click();$('imageFile').onchange=()=>{void addImages([...$('imageFile').files]);$('imageFile').value='';};
  $('editorLayout').onchange=()=>{$('editorPanes').dataset.layout=$('editorLayout').value;editor.requestMeasure();};
  $('editor').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void save();}});
  $('saveArea').onclick=save;$('cancelArea').onclick=()=>close();$('editor').addEventListener('cancel',e=>{e.preventDefault();close();});
  $('deleteArea').onclick=async()=>{if(!area||!confirm(`Delete “${area.name}”?`))return;const pack=structuredClone(getPack());pack.areas=pack.areas.filter(a=>a.id!==area.id);if(await savePack(pack))close(true);};
  window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
  function syncPopup(){
    const full=active.length&&!popup.minimized&&!area&&!$('settingsDialog').open&&!$('renameDialog').open&&!isMapEditing();
    if(full&&!$('areaPopup').open){returnFocus=document.activeElement;$('areaPopup').showModal();}
    else if(!full&&$('areaPopup').open){$('areaPopup').close();if(returnFocus?.isConnected)returnFocus.focus();}
    $('restoreNotes').hidden=!active.length||(!popup.minimized&&!area);$('restoreNotes').textContent=active.length===1?active[0].name:`Notes (${active.length})`;
  }
  function update(areas){
    active=areas;popup=popupTransition(popup,areas.map(a=>a.id));if(!areas.some(a=>a.id===selectedArea))selectedArea=areas[0]?.id||'';
    const key=JSON.stringify([selectedArea,areas.map(a=>[a.id,a.name,a.notes])]);
    if(key!==popupKey||popupAssets!==getPack().assets){popupKey=key;popupAssets=getPack().assets;$('popupTabs').replaceChildren();for(const a of areas){const b=document.createElement('button');b.textContent=a.name;b.classList.toggle('active',a.id===selectedArea);b.onclick=()=>{selectedArea=a.id;popupKey='';update(active);};$('popupTabs').append(b);}
      $('popupTabs').hidden=areas.length<2;const selected=areas.find(a=>a.id===selectedArea);$('popupTitle').textContent=selected?.name||'Notes';renderMarkdown($('popupContent'),selected?.notes||'',getPack().assets||{});
    }syncPopup();
  }
  const minimize=()=>{popup.minimized=true;syncPopup();};$('minimizeNotes').onclick=minimize;$('areaPopup').addEventListener('cancel',e=>{e.preventDefault();minimize();});$('restoreNotes').onclick=()=>{popup.minimized=false;syncPopup();};$('editPopupArea').onclick=()=>{const value=active.find(a=>a.id===selectedArea);if(value)open(value);};
  return {open,close,update,syncPopup,minimize,render:renderMarkdown,isOpen:()=>!!area};
}
