// Capability is supplied by the actual WebGL context, never inferred from UA.
export function depthBufferOptions(reversedSupported){
 if(typeof reversedSupported!=='boolean')throw new TypeError('Depth capability must be boolean');
 return {reversedDepthBuffer:reversedSupported,logarithmicDepthBuffer:false};
}

// For a convex solid, the largest normalized outside-plane distance is a
// lower bound on distance to every point of that solid. Taking the smallest
// bound across solids protects the nearest active geometry. The camera guard
// supplies an exterior pose with120mm clearance. At FOV36 and current mobile
// /desktop aspects,0.3 of radial clearance stays below axial frustum clearance.
// Use for perspective only; leave the orthographic camera's linear depth alone.
export function safePerspectiveNear(position,volumes,{min=.02,max=2,safety=.3}={}){
 const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 if(!vector(position)||!Array.isArray(volumes))throw new TypeError('Finite camera position and guard volumes required');
 if(![min,max,safety].every(Number.isFinite)||min<=0||max<min||safety<=0||safety>.35)throw new RangeError('Invalid perspective depth limits');
 let nearest=Infinity;
 for(const solid of volumes){
  if(!Array.isArray(solid)||!solid.length)throw new TypeError('Guard solid requires planes');
  let outside=0;
  for(const plane of solid){
   if(!plane||!vector(plane.n)||!Number.isFinite(plane.d))throw new TypeError('Guard plane must be finite');
   const scale=Math.max(...plane.n.map(Math.abs));
   if(scale===0)throw new RangeError('Guard plane normal must be nonzero');
   const n=plane.n.map(v=>v/scale),length=Math.hypot(...n),offset=plane.d/scale/length;
   const distance=n.reduce((sum,v,i)=>sum+v/length*position[i],0)-offset;
   if(Number.isNaN(distance))throw new RangeError('Guard distance overflow');
   outside=Math.max(outside,distance);
  }
  nearest=Math.min(nearest,outside);
 }
 return Math.max(min,Math.min(max,nearest*safety));
}
