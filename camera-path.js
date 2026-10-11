// Exterior flight path. Straight clear flights stay straight; obstructed ones
// escape to a circle enclosing the house footprint, orbit, then approach.
import {houseVolumes,segmentEntry,constrainCamera} from './camera-clearance.js';
const MARGIN=.12,PAD=.25;
const length=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const blend=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
const vector=p=>Array.isArray(p)&&p.length===3&&[...p].every(Number.isFinite);
const clear=(a,b,volumes)=>volumes.every(v=>segmentEntry(a,b,v,MARGIN)===null);
const radius=p=>Math.hypot(p[0],p[2]);
const polar=(r,theta,y)=>[r*Math.sin(theta),y,r*Math.cos(theta)];
const ease=t=>t<.5?4*t**3:1-(-2*t+2)**3/2;
let cachedKey=null,cachedPath=null;
function makePath(from,to){
 const volumes=houseVolumes(),start=constrainCamera(null,from,volumes),end=constrainCamera(null,to,volumes);
 if(clear(start,end,volumes))return t=>blend(start,end,t);
 // Include the broad bottom porch steps, not just the masonry or roof. The
 // footprint padding exceeds the separate camera margin, including corners.
 let halfX=21.1,halfZ=7.3;
 for(const volume of volumes)for(const {n,d} of volume){
  if(n[0]!==0&&n[1]===0&&n[2]===0)halfX=Math.max(halfX,Math.abs(d/n[0]));
  if(n[2]!==0&&n[0]===0&&n[1]===0)halfZ=Math.max(halfZ,Math.abs(d/n[2]));
 }
 halfX+=PAD;halfZ+=PAD;
 const outsideRadius=Math.hypot(halfX,halfZ);
 const exitRoute=p=>{
  const r=radius(p);
  if(r>=outsideRadius)return [p];
  if(r>0){
   const outer=[p[0]*outsideRadius/r,p[1],p[2]*outsideRadius/r];
   if(clear(p,outer,volumes))return [p,outer];
  }
  // In the gap beside a balcony, a diagonal radial exit can cross its side.
  // Try clear axis exits first; once on the enclosing rectangle, the radial
  // continuation to the circle stays wholly outside that rectangle.
  const x=Math.max(-halfX,Math.min(halfX,p[0])),z=Math.max(-halfZ,Math.min(halfZ,p[2]));
  const candidates=[[x,p[1],halfZ],[x,p[1],-halfZ],[halfX,p[1],z],[-halfX,p[1],z],
   ...[-halfX,halfX].flatMap(cx=>[-halfZ,halfZ].map(cz=>[cx,p[1],cz]))];
  let best=null,cost=Infinity;
  for(const corner of candidates){
   if(!clear(p,corner,volumes))continue;
   const r=radius(corner),outer=[corner[0]*outsideRadius/r,p[1],corner[2]*outsideRadius/r];
   const distance=length(p,corner)+length(corner,outer);
   if(distance<cost){best=[p,corner,outer];cost=distance;}
  }
  if(!best)throw Error('No clear exterior camera exit');
  return best;
 };
 const a=exitRoute(start),b=exitRoute(end),outerA=a.at(-1),outerB=b.at(-1);
 const angleA=Math.atan2(outerA[0],outerA[2]),angleB=Math.atan2(outerB[0],outerB[2]);
 // atan2 gives a deterministic shortest turn, including wraparound at ±PI.
 const delta=Math.atan2(Math.sin(angleB-angleA),Math.cos(angleB-angleA));
 const rA=radius(outerA),rB=radius(outerB),segments=[];
 const appendLine=(p,q)=>{const distance=length(p,q);if(distance>1e-12)segments.push({length:distance,at:t=>blend(p,q,t)});};
 for(let i=1;i<a.length;i++)appendLine(a[i-1],a[i]);
 const arcLength=Math.hypot((rA+rB)/2*delta,rB-rA,outerB[1]-outerA[1]);
 // Ease the height separately at orbit joins. The radial approach holds its
 // endpoint height; changing height abruptly can cut a displayed frame chord
 // through the underside when departing a close camera below the foundation.
 if(arcLength>1e-12)segments.push({length:arcLength,at:t=>{const height=ease(t);return polar(rA*(1-t)+rB*t,angleA+delta*t,outerA[1]*(1-height)+outerB[1]*height);}});
 for(let i=b.length-1;i>0;i--)appendLine(b[i],b[i-1]);
 const total=segments.reduce((sum,s)=>sum+s.length,0);
 return t=>{
  if(t<=0)return [...start];if(t>=1)return [...end];
  let distance=t*total;
  for(const segment of segments){if(distance<=segment.length)return segment.at(distance/segment.length);distance-=segment.length;}
  return [...end];
 };
}
export function interpolateCameraPosition(from,to,t){
 if(!vector(from)||!vector(to)||!Number.isFinite(t))throw new TypeError('Camera path needs finite position[3] endpoints and progress');
 const key=`${from.join(',')}:${to.join(',')}`;
 if(key!==cachedKey){const path=makePath([...from],[...to]);cachedPath=path;cachedKey=key;}
 return cachedPath(Math.max(0,Math.min(1,t)));
}
export function createCameraPath(from,to){
 if(!vector(from)||!vector(to))throw new TypeError('Camera path needs finite position[3] endpoints');
 const at=makePath([...from],[...to]);
 return progress=>{
  if(!Number.isFinite(progress))throw new TypeError('Camera path progress must be finite');
  return at(Math.max(0,Math.min(1,progress)));
 };
}
