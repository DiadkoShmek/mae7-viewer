// Keep common desktop screens at native CSS resolution even during motion.
// Touch density remains capped at1.5/2; a phone does not allocate a desktop
// sized framebuffer. A settled presentation refines just like the normal view.
export const RENDER_PROFILES={
 motion:{pixels:2_097_152,dimension:2048,ratio:1.5},
 still:{pixels:4_194_304,dimension:3072,ratio:2},
 presentation:{pixels:2_097_152,dimension:2048,ratio:1.5}
};
export function renderPixelRatio(width,height,profile='motion',maxPixels=Infinity){
 const w=Math.max(1,width),h=Math.max(1,height);
 const limit=RENDER_PROFILES[profile];
 return Math.min(limit.ratio,Math.sqrt(Math.min(limit.pixels,maxPixels)/(w*h)),limit.dimension/Math.max(w,h));
}

const sizes=new WeakMap();
export function resizeRenderer(renderer,width,height,profile='motion',maxPixels=Infinity){
 const ratio=renderPixelRatio(width,height,profile,maxPixels),oldRatio=renderer.getPixelRatio(),oldSize=sizes.get(renderer);
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
