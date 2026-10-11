import {subtractRect} from './engineering.js';

// Millimetres in the facade plane; metres in depth. The source angle has
// two150mm legs,60mm width,2.5mm steel. Its rotation/hand/vertical stations
// below are display fits, NOT a fixing design or an anchor schedule.
export const bracketSpec=Object.freeze({leg:150,width:60,steel:2.5,backZ:-.215,stationPitch:600,stationPhase:300,approved:false,
 source:'§5.5; арк08/PDF56:150×150×60×2.5',unknown:{verticalPitch:null,anchorType:null,anchorCount:null,substrateResistance:null,structuralApproval:null,bendRadius:null}});
const intersect=(a,b)=>{const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),w=Math.min(a.x+a.width,b.x+b.width)-x,h=Math.min(a.y+a.height,b.y+b.height)-y;return w>1e-9&&h>1e-9?{x,y,width:w,height:h}:null;};
const inside=(a,b)=>a.x>=b.x-1e-8&&a.y>=b.y-1e-8&&a.x+a.width<=b.x+b.width+1e-8&&a.y+a.height<=b.y+b.height+1e-8;
const number=n=>String(Math.round(n*1e6)/1e6);
export const timberPartId=(facade,r)=>`VS2-${facade}-V50-${[r.x,r.y,r.width,r.height].map(number).join('_')}`;

export function planBracketContacts({facade,width,height,openings=[],timber}){
 if(!facade||![width,height].every(n=>Number.isFinite(n)&&n>0)||!Array.isArray(timber))throw Error('Invalid bracket contact input');
 const s=bracketSpec,bounds={x:0,y:0,width,height},parts=[],omissions=[];
 for(const r of timber){
  const pairedTimberId=r.partId??timberPartId(facade,r),axis=r.x+r.width/2;
  for(let y=s.stationPhase;y<height;y+=s.stationPitch){
   if(y<r.y||y>=r.y+r.height)continue;
   const id=`VS2-${facade}-BRACKET-${number(axis)}-${number(y)}`;
   if(Math.abs(r.width-50)>1e-8||y-30<r.y||y+30>r.y+r.height){omissions.push({id,pairedTimberId,reason:'incomplete timber/contact station',approved:false});continue;}
   let chosen;
   for(const side of [-1,1]){
    const plane=side<0?r.x:r.x+r.width;
    const back={x:side<0?plane-s.leg:plane,y:y-s.width/2,width:s.leg,height:s.width};
    const leg={x:side<0?plane-s.steel:plane,y:y-s.width/2,width:s.steel,height:s.width};
    if(!inside(back,bounds)||openings.some(h=>intersect(back,h)||intersect(leg,h)))continue;
    // Steel is exterior to the timber side; the complete150mm normal leg
    // includes the2.5mm back plate. No material slit or invented screw hole.
    const solids=[{role:'back',rectangle:back,z:s.backZ,depth:s.steel/1000},{role:'leg',rectangle:leg,z:s.backZ+s.steel/1000,depth:(s.leg-s.steel)/1000}];
    const contactZ=[-.115,-.065],contact={axis:'x',plane,side,rectangleYZ:{y:y-s.width/2,height:s.width,z:contactZ[0],depth:contactZ[1]-contactZ[0]},areaM2:s.width/1000*.05};
    chosen={id,pairedTimberId,pairedTimberBounds:{rectangle:{...r},z:-.115,depth:.05},sourceDimensions:[s.leg,s.leg,s.width,s.steel],solids,contact,source:s.source,approved:false,
     quantityStatus:'display candidate; vertical stations/anchors not approved',orientation:'L-section inXZ,60mm alongY; side-contact display fit',bendRadius:null};break;
   }
   if(chosen)parts.push(chosen);else omissions.push({id,pairedTimberId,reason:'whole angle would cross an opening or facade boundary',approved:false});
  }
 }
 return {facade,parts,omissions,spec:s,approved:false};
}

// A detail is a projection of canonical physical parts. Incomplete angles
// are withheld, never presented as sawed fragments or new stock parts.
export function projectBracketContacts(plan,{bounds,centre,availableTimber}){
 const parts=[],omissions=[];
 for(const part of plan.parts){
  const solids=part.solids.map(s=>({...s,rectangle:{...s.rectangle,x:s.rectangle.x-centre.x,y:s.rectangle.y-centre.y}}));
  const plane=part.contact.plane-centre.x,y=part.contact.rectangleYZ.y-centre.y;
  if(!solids.some(s=>intersect(s.rectangle,bounds)))continue;
  if(!solids.every(s=>inside(s.rectangle,bounds))){omissions.push({id:part.id,reason:'incomplete detail projection'});continue;}
  const paired=availableTimber.find(r=>r.partId===part.pairedTimberId&&Math.abs((part.contact.side<0?r.x:r.x+r.width)-plane)<1e-7&&y>=r.y-1e-7&&y+60<=r.y+r.height+1e-7);
  if(!paired){omissions.push({id:part.id,reason:'candidate opening support replaces canonical paired timber here'});continue;}
  parts.push({...part,solids,sourcePartId:part.id,newStockPart:false,projectedOnly:true,canonicalPairedTimberBounds:part.pairedTimberBounds,pairedTimberBounds:{...part.pairedTimberBounds,rectangle:{...paired}},contact:{...part.contact,plane,rectangleYZ:{...part.contact.rectangleYZ,y}}});
 }
 return {...plan,parts,omissions,canonicalOmissions:plan.omissions,projection:true};
}

// Exclusive steel/insulation volumes, preserving exact positive-depth boxes.
// Returned displaced volume is geometry, not extra purchased insulation.
export function pocketBatch(batch,layerZ,parts){
 if(batch.kind!=='wool'||!parts.length)return [batch];
 let boxes=batch.rectangles.map(r=>({rectangle:r,z:layerZ+batch.z,depth:batch.depth})),removed=0;
 for(const solid of parts.flatMap(p=>p.solids)){
  const next=[];
  for(const box of boxes){
   const hit=intersect(box.rectangle,solid.rectangle),z=Math.max(box.z,solid.z),top=Math.min(box.z+box.depth,solid.z+solid.depth);
   if(!hit||top-z<1e-12){next.push(box);continue;}
   removed+=hit.width*hit.height/1e6*(top-z);
   if(z-box.z>1e-12)next.push({...box,depth:z-box.z});
   if(box.z+box.depth-top>1e-12)next.push({...box,z:top,depth:box.z+box.depth-top});
   for(const r of subtractRect(box.rectangle,hit))next.push({rectangle:{...box.rectangle,...r},z,depth:top-z});
  }boxes=next;
 }
 const groups=new Map();for(const b of boxes){const key=b.z.toFixed(12)+'/'+b.depth.toFixed(12);if(!groups.has(key))groups.set(key,{...batch,rectangles:[],z:b.z-layerZ,depth:b.depth,removedVolume:0});groups.get(key).rectangles.push(b.rectangle);}
 const result=[...groups.values()];if(result.length){result[0].removedVolume=(batch.removedVolume??0)+removed;result[0].bracketDisplacementVolume=removed;}return result;
}

export function bracketBatches(plan,layerZ=-.215){
 return ['back','leg'].map(role=>({kind:'steel',rectangles:plan.parts.map(p=>({...p.solids.find(s=>s.role===role).rectangle,partId:p.id,pairedTimberId:p.pairedTimberId,bracketRecord:p,solidRole:role})),
  z:role==='back'?0:.0025,depth:role==='back'?.0025:.1475,source:'nominal150×150×60×2.5; side-contact orientation candidate'}));
}
