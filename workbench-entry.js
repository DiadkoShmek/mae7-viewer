// Drawing calculators are loaded on demand, not alongside the first 3D frame.
const drawer=document.getElementById('engineering-drawer'),app=document.getElementById('app');
const notice=document.createElement('div');notice.className='engineering';notice.hidden=true;
const message=document.createElement('p');message.setAttribute('role','status');
const retry=document.createElement('button');retry.type='button';retry.textContent='Перезавантажити';retry.hidden=true;
retry.addEventListener('click',()=>location.reload());notice.append(message,retry);drawer.prepend(notice);
let loading=null,pendingDrawing=null;app.dataset.workbenchState='idle';
const lock=enabled=>drawer.querySelectorAll('section').forEach(section=>{section.inert=enabled;});
async function ensureWorkbench(){
 if(app.dataset.workbenchState==='ready')return;
 if(loading)return loading;
 app.dataset.workbenchState='loading';notice.hidden=false;message.textContent='Готуємо креслення й таблиці…';retry.hidden=true;lock(true);
 loading=import('./workbench.js').then(async()=>{
  // A first selected-detail event must survive lazy loading and leaving the
  // presentation view. If another selection arrives, use the latest one.
  await pendingDrawing?.presentationExit;
  const detail=pendingDrawing;pendingDrawing=null;
  app.dataset.workbenchState='ready';notice.hidden=true;lock(false);
  document.removeEventListener('mae-open-drawing',openDrawing,true);
  if(detail)document.dispatchEvent(new CustomEvent('mae-open-drawing',{detail}));
 }).catch(error=>{
  app.dataset.workbenchState='failed';message.textContent='Креслення не завантажились. Перевір з’єднання й перезавантаж сторінку.';
  retry.hidden=false;console.warn('Drawing workbench unavailable',error);
 });
 return loading;
}
function openDrawing(event){pendingDrawing=event.detail;drawer.open=true;ensureWorkbench();}
document.addEventListener('mae-open-drawing',openDrawing,true);
drawer.addEventListener('toggle',()=>{if(drawer.open)ensureWorkbench();});
