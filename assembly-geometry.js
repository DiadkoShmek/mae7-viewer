// Shared geometry constraints consumed by the renderer and focused clearance checks.
// Heights/width/depth are project nominal values, not site measurements.
import {floorLevels} from './engineering.js';
import {balconyOpenings} from './balcony-openings.js';
import {fitBalconyReturnCentre} from './balcony-returns.js';
export const balconySpec={width:3.315,depth:1.030,guardHeight:1.00,post:0.100,source:'Арк.16–17; висоти поверхів арк.05'};
export function balconyBays(){
 const centres=[...new Set(balconyOpenings.map(o=>o.x))];
 return centres.flatMap(sourceX=>floorLevels.slice(0,3).map((v,f)=>({...fitBalconyReturnCentre(sourceX,{width:balconySpec.width}),f,bottom:v/1000,top:floorLevels[f+1]/1000-.14,width:balconySpec.width,depth:balconySpec.depth,guardTop:v/1000+balconySpec.guardHeight})));
}
export {roofSpec,roofSurfaceY} from './roof-geometry.js';
import {roofSpec,roofSide,roofSurfaceY} from './roof-geometry.js';
export function balconyClearance(){
 const rear=roofSide(-1),roofBottomOffset=roofSpec.envelopeDepth/Math.cos(rear.angle);
 return Math.min(...balconyBays().map(b=>{
  const overlapEnd=Math.min(rear.span,5.62+b.depth);
  const underside=roofSurfaceY(-overlapEnd)-roofBottomOffset;
  const frameTop=b.top+.02;
  const canopyTop=b.f===2?b.top+.07-(overlapEnd-5.62-b.depth/2)*Math.tan(.04)+.004/Math.cos(.04):-Infinity;
  return underside-Math.max(frameTop,canopyTop);
 }));
}
// One full FC side per balcony, inferred from sheet17 + plan masonry returns.
// Local x maps to -world X on NW. Apartment mirroring still requires approval.
export function balconyFullSide(x){
 const left=[-17.8044,-4.6658,8.4347],right=[-8.514,4.5864,17.8044];
 if(left.some(v=>Math.abs(v-x)<.0001||Math.abs(fitBalconyReturnCentre(v).x-x)<.0001))return -1;
 if(right.some(v=>Math.abs(v-x)<.0001||Math.abs(fitBalconyReturnCentre(v).x-x)<.0001))return 1;
 throw Error('Unmapped source balcony');
}
