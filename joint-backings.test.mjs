import test from 'node:test';
import assert from 'node:assert/strict';
import {planJointBackings} from './joint-backings.js';
import {layoutFor,initialVisualLayouts} from './facade-layouts.js';
const inside=(r,x,y)=>x>=r.x-1e-7&&x<=r.x+r.width+1e-7&&y>=r.y-1e-7&&y<=r.y+r.height+1e-7;
const overlap=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1e-6&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1e-6;
test('black footprints cover actual orthogonal panel gaps while preserving every retained aperture',()=>{
 let probes=0;
 for(const code of ['SE','NW','SW','NE']){
  const l=layoutFor(code,initialVisualLayouts[code]),bands=planJointBackings(l.parts,{openings:l.openings,bounds:{x:0,y:0,width:l.width,height:l.height}});
  for(const b of bands)for(const h of l.openings)assert(!overlap(b,h),code+' backing crosses an opening');
  for(const p of l.parts)for(const ring of [p.outer,...p.holes])for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];if(a[0]!==b[0]&&a[1]!==b[1])continue;
   const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;
   for(const offset of [-3,3]){const px=x+(a[0]===b[0]?offset:0),py=y+(a[1]===b[1]?offset:0);if(px<0||py<0||px>l.width||py>l.height||l.openings.some(h=>inside(h,px,py)))continue;assert(bands.some(r=>inside(r,px,py)),code+' uncovered joint at '+px+','+py);probes++;}
  }
 }
 assert(probes>1000);
});
