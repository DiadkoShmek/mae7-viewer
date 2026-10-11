import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPixelRatio,resizeRenderer,RENDER_PROFILES,createRenderQuality} from './render-quality.js';
const sizes=[[766,691],[1920,1080],[2560,1440],[3840,2160],[4096,2160],[7680,4320],[430,700],[8000,1]];
function bounded(w,h,r){assert.ok(r>0&&r<=1.5);assert.ok(w*h*r*r<=2_097_152+.001);assert.ok(Math.max(w,h)*r<=2048+.001);}
test('facade retains 1.5x detail while large frames respect the mobile GPU budget',()=>{
 assert.equal(renderPixelRatio(766,691),1.5);
 for(const [w,h] of sizes)bounded(w,h,renderPixelRatio(w,h));
});
test('still sampling improves detail without exceeding its own bounded framebuffer',()=>{
 for(const [w,h] of sizes){const r=renderPixelRatio(w,h,'still'),p=RENDER_PROFILES.still;
  assert.ok(r>=renderPixelRatio(w,h));assert.ok(w*h*r*r<=p.pixels+.001);assert.ok(Math.max(w,h)*r<=p.dimension+.001);
 }
 assert.equal(renderPixelRatio(766,691,'still'),2);
});
test('profile switches and viewport resizes bound EVERY allocation; unchanged frames allocate nothing',()=>{
 for(const start of sizes)for(const target of sizes)for(const from of ['motion','still'])for(const to of ['motion','still']){
  let [w,h]=start,r=renderPixelRatio(w,h,from),allocations=0;
  const limit={pixels:Math.max(RENDER_PROFILES[from].pixels,RENDER_PROFILES[to].pixels),dimension:Math.max(RENDER_PROFILES[from].dimension,RENDER_PROFILES[to].dimension)};
  const check=()=>{assert.ok(w*h*r*r<=limit.pixels+.001);assert.ok(Math.max(w,h)*r<=limit.dimension+.001);allocations++;};
  const renderer={getPixelRatio:()=>r,setSize(nw,nh){w=nw;h=nh;check();},setPixelRatio(nr){r=nr;check();}};
  resizeRenderer(renderer,...start,from);resizeRenderer(renderer,...target,to);
  assert.deepEqual([w,h],target);assert.equal(r,renderPixelRatio(...target,to));
  const count=allocations;resizeRenderer(renderer,...target,to);assert.equal(allocations,count);
 }
});
test('activity postpones refinement, rejects stale timers and pauses on hidden/lost context',()=>{
 let timers=[],refinements=0,available=true;
 const quality=createRenderQuality({refine:()=>refinements++,canRefine:()=>available,setTimer:f=>(timers.push(f),timers.length),clearTimer:()=>{}});
 quality.activity();quality.activity();timers[0]();assert.equal(refinements,0);assert.equal(quality.profile,'motion');
 timers[1]();assert.equal(refinements,1);assert.equal(quality.profile,'still');
 quality.activity();assert.equal(quality.profile,'motion');quality.suspend();timers[2]();assert.equal(refinements,1);
 quality.activity();available=false;timers[3]();assert.equal(quality.profile,'motion');assert.equal(refinements,1);
 available=true;quality.activity();timers[4]();assert.equal(refinements,2);
});
test('every resize intermediate stays bounded, including large-to-small density increase',()=>{
 for(const start of sizes)for(const target of sizes){
  let [w,h]=start,r=renderPixelRatio(w,h),allocations=0;
  // Public Three API semantics: both setters immediately allocate a buffer.
  const renderer={getPixelRatio:()=>r,setSize(nw,nh){w=nw;h=nh;bounded(w,h,r);allocations++;},setPixelRatio(nr){r=nr;bounded(w,h,r);allocations++;}};
  const finalRatio=resizeRenderer(renderer,...target);
  assert.deepEqual([w,h],target);assert.equal(r,finalRatio);assert.ok(allocations>=1);
 }
});
