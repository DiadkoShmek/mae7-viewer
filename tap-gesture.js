// Feed canvas Pointer Events in order: down -> zero or more moves -> up/cancel.
// Only a primary single-pointer tap is eligible. Once a gesture drags, gains
// another pointer or is cancelled, suppression lasts until every pointer ends.
// cancel returns whether this gate owned that id; capture loss after a normal
// up/cancel therefore cannot cancel a later gesture or produce a second tap.
export function createTapGesture({threshold=7}={}){
 if(!Number.isFinite(threshold)||threshold<0)throw Error('Tap threshold must be finite and nonnegative');
 const pointers=new Map();let suppressed=false;
 const hasId=e=>Number.isInteger(e?.pointerId);
 const hasPoint=e=>Number.isFinite(e?.clientX)&&Number.isFinite(e?.clientY);
 const primary=e=>e.isPrimary!==false&&(e.button===undefined||e.button===0);
 function moved(e,start){return !hasPoint(e)||Math.hypot(e.clientX-start.x,e.clientY-start.y)>threshold;}
 function finish(e,cancelled){
  if(!hasId(e)||!pointers.has(e.pointerId))return false;
  const start=pointers.get(e.pointerId);
  if(cancelled||moved(e,start)||!primary(e))suppressed=true;
  const tap=!suppressed&&pointers.size===1;
  pointers.delete(e.pointerId);
  if(pointers.size===0)suppressed=false;
  return tap;
 }
 return {
  down(e){
   if(!hasId(e))return;
   if(pointers.size===0)suppressed=false;
   if(pointers.has(e.pointerId)){suppressed=true;return;}
   pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(pointers.size>1||!hasPoint(e)||!primary(e))suppressed=true;
  },
  move(e){if(hasId(e)&&pointers.has(e.pointerId)&&moved(e,pointers.get(e.pointerId)))suppressed=true;},
  up(e){return finish(e,false);},
  cancel(e){const owned=hasId(e)&&pointers.has(e.pointerId);finish(e,true);return owned;},
  reset(){pointers.clear();suppressed=false;}
 };
}
