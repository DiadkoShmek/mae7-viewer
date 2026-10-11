// Exterior camera body, in metres. These conservative envelopes cover the
// nominal renderer geometry; they are navigation bounds, not surveyed solids.
import {balconyBays} from './assembly-geometry.js';
import {roofSpec,roofSlope} from './roof-geometry.js';
import {entranceParts} from './entrance.js';
const EPS=1e-9,SKIN=.005;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add=(p,n,t)=>p.map((v,i)=>v+n[i]*t);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const box=(min,max)=>[{n:[1,0,0],d:max[0]},{n:[-1,0,0],d:-min[0]},{n:[0,1,0],d:max[1]},{n:[0,-1,0],d:-min[1]},{n:[0,0,1],d:max[2]},{n:[0,0,-1],d:-min[2]}];
const expanded=(planes,margin)=>planes.map(({n,d})=>{const length=Math.hypot(...n);return {n:n.map(v=>v/length),d:d/length+margin};});
const contains=(p,planes)=>planes.every(({n,d})=>dot(n,p)<d-EPS);
// Pure source-plan bounds; newer parts supply their own exact bounds. The
// descriptor fallback covers the existing box/prism/tube source API only.
export function entranceNavigationBounds(){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const part of entranceParts()){
  let points;
  if(part.bounds)points=[part.bounds.min,part.bounds.max];
  else{
   if(part.kind==='box')points=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[x*part.size[0]/2,y*part.size[1]/2,z*part.size[2]/2])));
   else if(part.kind==='prismX')points=[-1,1].flatMap(sign=>part.profile.map(([z,y])=>[part.x+sign*part.width/2,y,z]));
   else if(part.kind==='tubeY')points=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[x*part.radius,y*part.length/2,z*part.radius])));
   else throw Error('Missing entrance navigation bounds: '+part.id);
   const [a,b,c]=part.rotation||[0,0,0],position=part.position||[0,0,0];
   points=points.map(([x,y,z])=>{
    const u=x*Math.cos(c)-y*Math.sin(c),v=x*Math.sin(c)+y*Math.cos(c);
    const w=u*Math.cos(b)+z*Math.sin(b),t=-u*Math.sin(b)+z*Math.cos(b);
    return [w+position[0],v*Math.cos(a)-t*Math.sin(a)+position[1],v*Math.sin(a)+t*Math.cos(a)+position[2]];
   });
  }
  for(const p of points){if(!p||p.length!==3||!p.every(Number.isFinite))throw Error('Invalid entrance navigation bounds: '+part.id);for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}}
 }
 return {min,max};
}
export function houseVolumes(){
 const front=roofSlope(1),back=roofSlope(-1),roofHalf=roofSpec.length/2;
 // The shared roof skin is the datum. Seams, ridge cap and the nominal PV
 // plates project above it, so reserve 200 mm along each roof normal before
 // adding the camera's separate 120 mm body clearance.
 const projection=Math.max(.20,roofSpec.profileHeight);
 const capFront=roofSpec.ridge+projection*Math.hypot(1,front),capBack=roofSpec.ridge+projection*Math.hypot(1,back);
 const upper=[{n:[0,1,front],d:capFront},{n:[0,1,-back],d:capBack}];
 // Window frames and flashings project beyond the opaque walls. The roof is
 // a separate finite wedge: its overhang must not extend down the whole wall.
 // +8.525 is the attic floor; the upper facade band belongs to the body too.
 const top=Math.max(capFront,capBack);
 const main=[...box([-20.55,-.76,-5.97],[20.55,top,5.97]),...upper];
 // The0.6mm skin sits above the actual timber/underlay stack. Its lowest
 // normal offset is shared with the roof plan, not the retired65mm shell.
 const bottom=Math.min(roofSpec.frontEdgeY-roofSpec.envelopeDepth/Math.hypot(1,front),roofSpec.backEdgeY-roofSpec.envelopeDepth/Math.hypot(1,back))-.06;
 const roof=[...box([-roofHalf-.06,bottom,-roofSpec.backSpan-.06],[roofHalf+.06,top,roofSpec.frontSpan+.06]),...upper];
 const entrance=entranceNavigationBounds();
 const porches=[-13.1846,-.0889,13.1211].map(x=>box(entrance.min.map((v,i)=>v+(i===0?x:i===2?5.62:0)-SKIN),entrance.max.map((v,i)=>v+(i===0?x:i===2?5.62:0)+SKIN)));
 const balconies=balconyBays().map(b=>box([-b.x-b.width/2-.06,b.bottom-.12,-5.62-b.depth-.07],[-b.x+b.width/2+.06,b.top+.12,-5.56]));
 return [main,roof,...porches,...balconies];
}
export function inVolume(p,planes,margin=.12){return contains(p,expanded(planes,margin));}
function interval(a,velocity,planes){
 let enter=-Infinity,exit=Infinity;
 for(const {n,d} of planes){
  const start=dot(n,a)-d,delta=dot(n,velocity);
  // A segment lying on an exterior face can slide along it or away from it.
  if(delta===0){if(start>=-EPS)return null;continue;}
  const t=-start/delta;
  if(delta<0)enter=Math.max(enter,t);else exit=Math.min(exit,t);
  if(enter>=exit)return null;
 }
 return [enter,exit];
}
export function segmentEntry(a,b,planes,margin=.12){
 const hit=interval(a,b.map((v,i)=>v-a[i]),expanded(planes,margin));
 if(!hit||hit[1]<=0||hit[0]>=1)return null;
 return Math.max(0,hit[0]);
}
function recover(p,volumes,margin){
 // The closest point outside a union may be on a face, edge or vertex of
 // several overlapping volumes. Enumerate these tiny 3D plane arrangements
 // only during recovery, pruning with a finite ray escape distance first.
 const solids=volumes.map(v=>expanded(v,margin+SKIN));
 const planes=[...new Map(solids.flat().map(v=>[`${v.n.join(',')}:${v.d}`,v])).values()];
 let best=null,bestDistance=Infinity;
 const consider=q=>{
  const distance=Math.hypot(...q.map((v,i)=>v-p[i]));
  if(distance<bestDistance&&solids.every(v=>!contains(q,v))){best=q;bestDistance=distance;}
 };
 for(const direction of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
  const hits=solids.map(v=>interval(p,direction,v)).filter(v=>v&&v[1]>=0).sort((a,b)=>a[0]-b[0]);
  let exit=0;
  for(const hit of hits){if(hit[0]>exit+EPS)break;exit=Math.max(exit,hit[1]);}
  if(Number.isFinite(exit))consider(add(p,direction,exit+SKIN));
 }
 const nearby=planes.filter(({n,d})=>Math.abs(d-dot(n,p))<=bestDistance+EPS);
 for(let i=0;i<nearby.length;i++){
  const a=nearby[i],da=a.d-dot(a.n,p);consider(add(p,a.n,da));
  for(let j=0;j<i;j++){
   const b=nearby[j],db=b.d-dot(b.n,p),ab=dot(a.n,b.n),det=1-ab*ab;
   if(det<=1e-12)continue;
   const u=(da-ab*db)/det,v=(db-ab*da)/det;
   consider(p.map((x,k)=>x+u*a.n[k]+v*b.n[k]));
   for(let k=0;k<j;k++){
    const c=nearby[k],bc=cross(b.n,c.n),det3=dot(a.n,bc);
    if(Math.abs(det3)<=1e-12)continue;
    const dc=c.d-dot(c.n,p),ca=cross(c.n,a.n),ac=cross(a.n,b.n);
    consider(p.map((x,l)=>x+(da*bc[l]+db*ca[l]+dc*ac[l])/det3));
   }
  }
 }
 // houseVolumes and inspectionVolume are bounded, so an axis escape exists.
 if(!best)throw Error('Camera collision volumes must have a finite exterior');
 return best;
}
export function constrainCamera(previous,desired,volumes=houseVolumes(),margin=.12){
 const solids=volumes.map(v=>expanded(v,margin));
 if(!previous||solids.some(v=>contains(previous,v)))return solids.some(v=>contains(desired,v))?recover(desired,volumes,margin):[...desired];
 let t=1;
 const velocity=desired.map((v,i)=>v-previous[i]);
 for(const v of solids){const hit=interval(previous,velocity,v);if(hit&&hit[1]>0&&hit[0]<1)t=Math.min(t,Math.max(0,hit[0]));}
 const distance=Math.hypot(...velocity);
 if(t<1)t=Math.max(0,t-SKIN/Math.max(distance,SKIN));
 return add(previous,velocity,t);
}
export const inspectionVolume=(x,y,z,w,h,depth)=>box([x-w/2,y-h/2,z-.02],[x+w/2,y+h/2,z+depth]);
export const boundsVolume=(min,max)=>box(min,max);
