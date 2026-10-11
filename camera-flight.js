// Camera transitions reuse the scalar scheduler/easing. The caller supplies
// its live, collision-protected pose as `from` whenever it changes the target.
import {createScalarMotion} from './motion.js';
const finiteVector=value=>Array.isArray(value)&&value.length===3&&[...value].every(Number.isFinite);
const copyPose=(pose,name)=>{
 if(!pose||!finiteVector(pose.position)||!finiteVector(pose.target)||!Number.isFinite(pose.zoom))throw new TypeError(`${name} must contain finite position[3], target[3] and zoom`);
 if(pose.zoom<=0)throw new RangeError(`${name} zoom must be positive`);
 return {position:[...pose.position],target:[...pose.target],zoom:pose.zoom};
};
const samePose=(a,b)=>a.zoom===b.zoom&&a.position.every((v,i)=>v===b.position[i])&&a.target.every((v,i)=>v===b.target[i]);
const blend=(a,b,t)=>t===1?b:a*(1-t)+b*t;
export function createCameraFlight({apply,duration=850,reduced=false,schedule,cancel,now}={}){
 if(typeof apply!=='function')throw new TypeError('Camera apply must be a function');
 let flight=null,generation=0,silenced=false;
 const motion=createScalarMotion({duration,reduced,schedule,cancel,now,apply:progress=>{
  if(silenced||!flight)return;
  const current=flight,pose={
   position:current.from.position.map((v,i)=>blend(v,current.to.position[i],progress)),
   target:current.from.target.map((v,i)=>blend(v,current.to.target[i],progress)),
   zoom:blend(current.from.zoom,current.to.zoom,progress)
  };
  try{apply(pose,progress);}catch(error){stop();throw error;}
  // A renderer may stop or retarget during apply. Its replacement owns both
  // the scheduled frame and the completion callback from this point onward.
  if(progress===1&&flight===current&&generation===current.generation){
   flight=null;
   current.onComplete?.();
  }
 }});
 const stop=()=>{generation++;flight=null;motion.stop();return api;};
 const api={
  to(from,to,{immediate=false,onComplete}={}){
   const start=copyPose(from,'from'),end=copyPose(to,'to');
   if(typeof immediate!=='boolean')throw new TypeError('immediate must be boolean');
   if(onComplete!==undefined&&typeof onComplete!=='function')throw new TypeError('onComplete must be a function');
   stop();
   // Reset just the progress clock without rendering an extra start frame.
   // Never replace `from` with an unprotected, internally interpolated pose.
   silenced=true;
   try{motion.to(0,{immediate:true});}finally{silenced=false;}
   flight={from:start,to:end,onComplete,generation};
   try{motion.to(1,{immediate:immediate||samePose(start,end)});}catch(error){stop();throw error;}
   return api;
  },
  stop,
  get moving(){return motion.moving;}
 };
 return api;
}
