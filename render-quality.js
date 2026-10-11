// Motion retains the repaired GPU budget. A single settled frame samples
// fine roof ribs / facade joints more densely, without an extra render target.
export const RENDER_PROFILES={
 motion:{pixels:2_097_152,dimension:2048,ratio:1.5},
 still:{pixels:4_194_304,dimension:2560,ratio:2}
};
export function renderPixelRatio(width,height,profile='motion'){
 const w=Math.max(1,width),h=Math.max(1,height);
 const limit=RENDER_PROFILES[profile];
 return Math.min(limit.ratio,Math.sqrt(limit.pixels/(w*h)),limit.dimension/Math.max(w,h));
}

const sizes=new WeakMap();
export function resizeRenderer(renderer,width,height,profile='motion'){
 const ratio=renderPixelRatio(width,height,profile),oldRatio=renderer.getPixelRatio(),oldSize=sizes.get(renderer);
 const changedSize=!oldSize||oldSize[0]!==width||oldSize[1]!==height;
 // Three.setPixelRatio immediately reallocates at the OLD logical size.
 // Shrink first when increasing density, so even the intermediate buffer
 // stays within the larger of the two endpoint budgets.
 if(ratio>oldRatio){if(changedSize)renderer.setSize(width,height);renderer.setPixelRatio(ratio);}
 else {if(ratio!==oldRatio)renderer.setPixelRatio(ratio);if(changedSize)renderer.setSize(width,height);}
 sizes.set(renderer,[width,height]);
 return ratio;
}

export function createRenderQuality({refine,canRefine=()=>true,delay=400,setTimer=setTimeout,clearTimer=clearTimeout}){
 let profile='motion',timer=null,generation=0;
 function suspend(){generation++;if(timer!==null)clearTimer(timer);timer=null;profile='motion';}
 return {
  get profile(){return profile;},
  activity(){
   suspend();const token=generation;
   timer=setTimer(()=>{if(token!==generation)return;timer=null;if(!canRefine())return;profile='still';refine();},delay);
  },
  suspend
 };
}
