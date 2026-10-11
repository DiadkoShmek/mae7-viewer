// One scalar, one pending frame. Construction does not call apply: callers
// can finish their own setup, then use to(value, {immediate:true}) to render.
export function createScalarMotion({
 value=0,apply,duration=600,reduced=false,
 schedule=callback=>requestAnimationFrame(callback),
 cancel=handle=>cancelAnimationFrame(handle),
 now=()=>performance.now()
}={}){
 const finite=(number,name)=>{if(!Number.isFinite(number))throw new TypeError(`${name} must be finite`);};
 finite(value,'value');finite(duration,'duration');
 if(duration<0)throw new RangeError('duration must be non-negative');
 if(typeof apply!=='function'||typeof schedule!=='function'||typeof cancel!=='function'||typeof now!=='function')throw new TypeError('Motion callbacks must be functions');
 if(typeof reduced!=='boolean')throw new TypeError('reduced must be boolean');
 let current=value,from=value,target=value,started=0,progress=0,active=false,frame=null,generation=0;
 const clock=()=>{const time=now();finite(time,'clock');return time;};
 const stop=()=>{
  generation++;active=false;
  if(frame!==null){const pending=frame;frame=null;cancel(pending);}
  return api;
 };
 const enqueue=token=>{
  try{frame=schedule(()=>tick(token));}catch(error){stop();throw error;}
 };
 const tick=token=>{
  if(token!==generation||!active)return;
  frame=null;
  try{
   // A monotonic clock is expected; an injected clock moving backwards must
   // still never move the displayed scalar back along the current tween.
   progress=Math.max(progress,Math.min(1,Math.max(0,(clock()-started)/duration)));
   const eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
   // A weighted sum remains finite even when target-from would overflow.
   current=progress===1?target:from*(1-eased)+target*eased;
   if(progress===1)active=false;
   apply(current);
  }catch(error){stop();throw error;}
  // apply may stop or retarget this very motion; leave its new frame intact.
  if(token===generation&&active)enqueue(token);
 };
 const api={
  to(next,{immediate=false}={}){
   finite(next,'target');
   if(typeof immediate!=='boolean')throw new TypeError('immediate must be boolean');
   const instant=immediate||reduced||duration===0;
   if(!instant&&active&&next===target)return api;
   if(!instant&&!active&&next===current)return api;
   const time=instant?0:clock();
   stop();target=next;
   if(instant){current=next;apply(current);return api;}
   from=current;started=time;progress=0;active=true;enqueue(generation);
   return api;
  },
  stop,
  get value(){return current;},
  get moving(){return active;}
 };
 return api;
}
