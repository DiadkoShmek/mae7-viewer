// A restored event alone does not prove a usable scene. Rebuild GPU-only
// resources, then require a completed frame. A second loss invalidates work.
export function bindContextRecovery(canvas,{isLost,rebuild,render,onState,onError=()=>{}}){
 if(!canvas?.addEventListener||[isLost,rebuild,render,onState,onError].some(f=>typeof f!=='function'))throw new TypeError('Context recovery callbacks required');
 let state='ready',generation=0,disposed=false,pending=Promise.resolve();
 const publish=next=>{state=next;onState(next);};
 const lost=event=>{event.preventDefault();if(disposed)return;generation++;publish('lost');};
 const restored=()=>{
  if(disposed||state!=='lost'||isLost())return;
  const token=++generation,isCurrent=()=>!disposed&&generation===token&&!isLost();
  publish('restoring');
  pending=(async()=>{
   try{
    await rebuild({isCurrent});if(!isCurrent())return;
    if(await render({isCurrent})!==true)throw Error('Restored context did not complete a frame');
    if(isCurrent())publish('ready');
   }catch(error){if(isCurrent()){publish('failed');onError(error);}}
  })();
 };
 canvas.addEventListener('webglcontextlost',lost);
 canvas.addEventListener('webglcontextrestored',restored);
 return {get state(){return state;},whenSettled:()=>pending,dispose(){disposed=true;generation++;canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);}};
}
