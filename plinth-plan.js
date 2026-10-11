// VS-1: one physical inventory and cropped display projections. Metres.
// PDF57/node09 and §5.3 give nominal layers, not surveyed heights or anchors.
import {perforatePlinthHat} from './plinth-ventilation.js';
import {entranceSpec,entranceCentres} from './entrance.js';
import {basementOpenings} from './basement-openings.js';
import {planPlinthSupports,recessPlinthEPS} from './plinth-supports.js';
import {retainedCoreFootprints} from './balcony-returns.js';
export const plinthSpec=Object.freeze({height:.660,existingHalfLength:19.985,existingHalfDepth:5.405,existingThickness:.220,
 eps100:.100,eps50:.050,timberWidth:.075,timberPitch:.600,hatDepth:.025,hatPitch:.420,board:.008,joint:.008,
 maximumCandidatePanelWidth:1.192,boardTopClearance:.020,apronWidth:.600,apronSlope:.02,apronGap:.020,apronJointPitch:2,apronJointWidth:.008,
 apronThicknessCandidate:.100,aggregate:.200,groundCandidate:-.705,approved:false,
 unknown:{surveyHeight:null,basementOpenings:null,thinEPS50Zone:null,orderedStock:null,hatSection:null,hatSteelThickness:null,anchors:null,ventilationContinuity:null,flashingWorkingDetail:null,angleProduct:null,angleGeometry:null,angleVerticalPitch:null}});
export const plinthOffsets=Object.freeze([-.220,0,.100,.150,.175]);
export const plinthFaces=Object.freeze([
 {code:'SE',width:39.970,position:[0,0,5.405],rotation:0},
 {code:'NW',width:39.970,position:[0,0,-5.405],rotation:Math.PI},
 {code:'SW',width:10.810,position:[19.985,0,0],rotation:Math.PI/2},
 {code:'NE',width:10.810,position:[-19.985,0,0],rotation:-Math.PI/2}
]);
export const polygonArea=ps=>Math.abs(ps.reduce((v,p,i)=>{const q=ps[(i+1)%ps.length];return v+p[0]*q[1]-q[0]*p[1];},0))/2;
function clip(ps,axis,edge,sign){const result=[];for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],u=sign*(a[axis]-edge),v=sign*(b[axis]-edge);if(u<=1e-12)result.push(a);if((u<0&&v>0)||(u>0&&v<0)){const f=u/(u-v);result.push(a.map((n,k)=>n+f*(b[k]-n)));}}return result;}
export function retainedCoreCutsForFace(face){
 const c=Math.round(Math.cos(face.rotation)),sn=Math.round(Math.sin(face.rotation));
 return retainedCoreFootprints().map(r=>{
  const points=[r.min[0],r.max[0]].flatMap(x=>[r.min[2],r.max[2]].map(z=>[c*(x-face.position[0])-sn*(z-face.position[2]),sn*(x-face.position[0])+c*(z-face.position[2])]));
  return {id:r.id,x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),z0:Math.min(...points.map(p=>p[1])),z1:Math.max(...points.map(p=>p[1]))};
 });
}
export function subtractRetainedCoreSections(sections,cuts){
 for(const r of cuts)sections=sections.flatMap(ps=>{
  const xx=ps.map(p=>p[0]),zz=ps.map(p=>p[1]);
  if(r.x0>=Math.max(...xx)-1e-12||r.x1<=Math.min(...xx)+1e-12||r.z0>=Math.max(...zz)-1e-12||r.z1<=Math.min(...zz)+1e-12)return [ps];
  const mid=clip(clip(ps,0,r.x0,-1),0,r.x1,1);
  return [clip(ps,0,r.x0,1),clip(ps,0,r.x1,-1),clip(mid,1,r.z0,1),clip(mid,1,r.z1,-1)].filter(q=>q.length>=3&&polygonArea(q)>1e-12);
 });
 return sections;
}
function cutRetainedCores(p,cuts){
 if(p.layer===0)return [p]; // Retain the main existing substrate.
 if(p.kind==='profileX'){
  const zz=p.sectionYZ.map(q=>q[1]),relevant=cuts.filter(r=>r.x0<p.x1&&r.x1>p.x0&&r.z0<Math.max(...zz)&&r.z1>Math.min(...zz));if(!relevant.length)return [p];
  const xs=[...new Set([p.x0,p.x1,...relevant.flatMap(r=>[Math.max(p.x0,r.x0),Math.min(p.x1,r.x1)])])].sort((a,b)=>a-b),runs=[];
  for(let i=0;i<xs.length-1;i++){
   let sections=[p.sectionYZ];const x=(xs[i]+xs[i+1])/2;
   for(const r of relevant.filter(r=>r.x0<x&&r.x1>x))sections=sections.flatMap(ps=>[clip(ps,1,r.z0,1),clip(ps,1,r.z1,-1)].filter(q=>q.length>=3&&polygonArea(q)>1e-12));
   for(const sectionYZ of sections)runs.push(finish({...p,sectionYZ,x0:xs[i],x1:xs[i+1]}));
  }
  return runs.map((q,i)=>({...q,id:p.id+'-RETURN-RUN'+(i+1),sourcePartId:p.id+'-RETURN-RUN'+(i+1),sourceOriginalProfileId:p.id}));
 }
 const sections=subtractRetainedCoreSections([p.sectionXZ],cuts);
 if(sections.length===1&&JSON.stringify(sections[0])===JSON.stringify(p.sectionXZ))return [p];
 return sections.map((sectionXZ,i)=>finish({...p,sectionXZ,id:p.id+'-RETURN-C'+(i+1),sourcePartId:p.id+'-RETURN-C'+(i+1),sourceBlankId:p.id,retainedCoreCut:true,apertureOperationsApproved:false}));
}
const hash=value=>{let n=2166136261;for(const c of JSON.stringify(value))n=Math.imul(n^c.charCodeAt(0),16777619);return(n>>>0).toString(16);};
export function hatSection(){
 // Generic open hat. ONLY the25mm depth is a source dimension. Crown38,
 // total74 and steel1 are explicit display candidates, not ordered MP25/38.
 return [[-.037,0],[-.018,0],[-.018,.024],[.018,.024],[.018,0],[.037,0],[.037,.001],[.019,.001],[.019,.025],[-.019,.025],[-.019,.001],[-.037,.001]];
}
function ringSection(width,z0,z1,x0=-Infinity,x1=Infinity){
 const ps=[[-width/2-z0,z0],[width/2+z0,z0],[width/2+z1,z1],[-width/2-z1,z1]];
 return clip(clip(ps,0,x0,-1),0,x1,1);
}
// Aperture union on an exact floating-point boundary lattice. No extra seam.
export function rectangleContours(rectangle,openings=[]){
 const {x0,x1,y0,y1}=rectangle;if(x1<=x0||y1<=y0)return [];
 const holes=openings.filter(o=>o.x0<x1&&o.x1>x0&&o.y0<y1&&o.y1>y0);
 const xs=[...new Set([x0,x1,...holes.flatMap(o=>[Math.max(x0,o.x0),Math.min(x1,o.x1)])])].sort((a,b)=>a-b);
 const ys=[...new Set([y0,y1,...holes.flatMap(o=>[Math.max(y0,o.y0),Math.min(y1,o.y1)])])].sort((a,b)=>a-b);
 const remaining=new Set();for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++)if(!holes.some(o=>(xs[i]+xs[i+1])/2>o.x0&&(xs[i]+xs[i+1])/2<o.x1&&(ys[j]+ys[j+1])/2>o.y0&&(ys[j]+ys[j+1])/2<o.y1))remaining.add(`${i},${j}`);
 const results=[],key=p=>p.join(','),signed=ps=>ps.reduce((a,p,i)=>{const q=ps[(i+1)%ps.length];return a+p[0]*q[1]-q[0]*p[1];},0)/2;
 while(remaining.size){
  const seed=remaining.values().next().value,queue=[seed],set=new Set([seed]);remaining.delete(seed);
  for(let q=0;q<queue.length;q++){const [i,j]=queue[q].split(',').map(Number);for(const [a,b] of [[i-1,j],[i+1,j],[i,j-1],[i,j+1]]){const k=`${a},${b}`;if(remaining.delete(k)){set.add(k);queue.push(k);}}}
  const edges=[];for(const cell of queue){const [i,j]=cell.split(',').map(Number),a=xs[i],b=xs[i+1],c=ys[j],d=ys[j+1];for(const [neighbor,u,v] of [[`${i},${j-1}`,[a,c],[b,c]],[`${i+1},${j}`,[b,c],[b,d]],[`${i},${j+1}`,[b,d],[a,d]],[`${i-1},${j}`,[a,d],[a,c]]])if(!set.has(neighbor))edges.push({u,v,used:false});}
  const rings=[];for(const first of edges){if(first.used)continue;const ring=[];let edge=first;for(let guard=0;;guard++){
   if(guard>edges.length)throw Error('Unclosed plinth contour');edge.used=true;ring.push(edge.u);if(key(edge.v)===key(first.u))break;
   const candidates=edges.filter(e=>!e.used&&key(e.u)===key(edge.v)),dx=edge.v[0]-edge.u[0],dy=edge.v[1]-edge.u[1];
   candidates.sort((a,b)=>Math.atan2(dx*(b.v[1]-b.u[1])-dy*(b.v[0]-b.u[0]),dx*(b.v[0]-b.u[0])+dy*(b.v[1]-b.u[1]))-Math.atan2(dx*(a.v[1]-a.u[1])-dy*(a.v[0]-a.u[0]),dx*(a.v[0]-a.u[0])+dy*(a.v[1]-a.u[1])));if(!candidates.length)throw Error('Broken plinth contour');edge=candidates[0];
  }
  let clean=ring,changed=true;while(changed&&clean.length>3){changed=false;clean=clean.filter((b,i)=>{const a=clean[(i+clean.length-1)%clean.length],c=clean[(i+1)%clean.length];if(Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))<1e-15){changed=true;return false;}return true;});}rings.push(clean);}
  const outer=rings.filter(p=>signed(p)>0),inner=rings.filter(p=>signed(p)<0);if(outer.length!==1)throw Error('Ambiguous plinth component');
  const points=outer[0],netAreaM2=signed(points)+inner.reduce((a,p)=>a+signed(p),0),xx=points.map(p=>p[0]),yy=points.map(p=>p[1]);
  results.push({outer:points,holes:inner,contours:[points,...inner],netAreaM2,blankBBox:{x0:Math.min(...xx),x1:Math.max(...xx),y0:Math.min(...yy),y1:Math.max(...yy)}});
 }
 return results.sort((a,b)=>a.blankBBox.x0-b.blankBBox.x0||a.blankBBox.y0-b.blankBBox.y0);
}
function contourPieces(p,rectangle,z0,z1,cutouts){return rectangleContours(rectangle,cutouts).map(c=>({...p,...c,kind:'contourZ',z0,z1,rectangleXY:rectangle,cutouts,volume:c.netAreaM2*(z1-z0),blank:{width:Math.ceil((c.blankBBox.x1-c.blankBBox.x0)*1000),height:Math.ceil((c.blankBBox.y1-c.blankBBox.y0)*1000),unit:'mm'},apertureOperationsApproved:false}));}
function compound(p,pieces){return {...p,kind:'compound',geometryPieces:pieces,volume:pieces.reduce((a,q)=>a+q.volume,0)};}
function perforate(p,cutouts){
 if(!cutouts.length)return [p];
 if(p.kind==='profileX'){
  const ys=p.sectionYZ.map(q=>q[0]),lo=Math.min(...ys),hi=Math.max(...ys),relevant=cutouts.filter(o=>o.x0<p.x1&&o.x1>p.x0&&o.y0<hi&&o.y1>lo);if(!relevant.length)return [p];
  const xs=[...new Set([p.x0,p.x1,...relevant.flatMap(o=>[Math.max(p.x0,o.x0),Math.min(p.x1,o.x1)])])].sort((a,b)=>a-b),runs=[];
  for(let i=0;i<xs.length-1;i++){const mid=(xs[i]+xs[i+1])/2;let sections=[p.sectionYZ];for(const o of relevant.filter(o=>mid>o.x0&&mid<o.x1))sections=sections.flatMap(ps=>[clip(ps,0,o.y0,1),clip(ps,0,o.y1,-1)].filter(ps=>ps.length>=3&&polygonArea(ps)>1e-12));
   for(const sectionYZ of sections){const last=runs.at(-1);if(last&&last.x1===xs[i]&&JSON.stringify(last.sectionYZ)===JSON.stringify(sectionYZ)){last.x1=xs[i+1];last.volume=polygonArea(sectionYZ)*(last.x1-last.x0);}else runs.push(finish({...p,sectionYZ,x0:xs[i],x1:xs[i+1]}));}
  }
  return runs.map((q,i)=>({...finish(q),id:p.id+'-RUN'+String(i+1).padStart(2,'0'),sourcePartId:p.id+'-RUN'+String(i+1).padStart(2,'0'),sourceOriginalProfileId:p.id}));
 }
 const xs=p.sectionXZ.map(q=>q[0]),zs=p.sectionXZ.map(q=>q[1]),xmin=Math.min(...xs),xmax=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
 const relevant=cutouts.filter(o=>o.x0<xmax&&o.x1>xmin&&o.y0<p.y1&&o.y1>p.y0);if(!relevant.length)return [p];
 // Each cut is away from the corner miters. Preserve wedges as real pieces
 // under the one existing non-FC logical owner; never replace them by a box.
 const at=z=>p.sectionXZ.filter(q=>Math.abs(q[1]-z)<1e-12).map(q=>q[0]);
 const left=Math.max(Math.min(...at(z0)),Math.min(...at(z1))),right=Math.min(Math.max(...at(z0)),Math.max(...at(z1)));
 if(relevant.some(o=>o.x0<left-1e-10||o.x1>right+1e-10)&&p.sectionXZ.some(([x,z])=>x<left-1e-10||x>right+1e-10))throw Error('Basement aperture intersects an unresolved corner miter');
 const central=contourPieces(p,{x0:left,x1:right,y0:p.y0,y1:p.y1},z0,z1,relevant),wedges=[finish(p,'physical',-Infinity,left),finish(p,'physical',right,Infinity)].filter(Boolean);
 if(wedges.length)return [compound(p,[...wedges,...central])];
 return central.map((q,i)=>({...q,id:p.id+(central.length>1?'-C'+String(i+1).padStart(2,'0'):''),sourcePartId:p.id+(central.length>1?'-C'+String(i+1).padStart(2,'0'):''),sourceBlankId:p.id}));
}
function finish(p,region='physical',x0=-Infinity,x1=Infinity){
 if(p.kind==='compound'){const pieces=p.geometryPieces.map(q=>finish(q,region,x0,x1)).filter(Boolean);if(!pieces.length)return null;return {...compound(p,pieces),region,projection:region!=='physical',stockPart:region==='physical'&&p.quantityEligible!==false};}
 if(p.kind==='contourZ'){const r={...p.rectangleXY,x0:Math.max(p.rectangleXY.x0,x0),x1:Math.min(p.rectangleXY.x1,x1)},pieces=contourPieces(p,r,p.z0,p.z1,p.cutouts);if(!pieces.length)return null;const q=pieces.length===1?pieces[0]:compound(p,pieces);return {...q,region,projection:region!=='physical',stockPart:region==='physical'&&p.quantityEligible!==false};}
 if(p.kind==='profileX'){
  const lo=Math.max(p.x0,x0),hi=Math.min(p.x1,x1);if(hi<=lo+1e-10)return null;
  const section=p.sectionYZ,length=hi-lo;
  return {...p,x0:lo,x1:hi,volume:polygonArea(section)*length,geometryPartId:'PLINTH-G-'+hash([section,length]),region,projection:region!=='physical',stockPart:region==='physical'&&p.quantityEligible!==false};
 }
 const sectionXZ=clip(clip(p.sectionXZ,0,x0,-1),0,x1,1);if(sectionXZ.length<3||polygonArea(sectionXZ)<1e-12)return null;
 const native=p.kind==='supportAngleY'?{geometryPartId:'PLINTH-ANGLE-'+hash([sectionXZ.map(([x,z])=>[Math.round((x-p.originX)*1e12)/1e12,z]),p.y1-p.y0])}:{};
 return {...p,...native,sectionXZ,volume:polygonArea(sectionXZ)*(p.y1-p.y0),region,projection:region!=='physical',stockPart:region==='physical'&&p.quantityEligible!==false};
}
export function planPlinthAssembly({patch={face:'SW',x:0,width:2.4},height=plinthSpec.height,openings=basementOpenings}={}){
 if(!Number.isFinite(height)||height<=.074)throw Error('Plinth height must exceed generic profile width');
 if(!plinthFaces.some(f=>f.code===patch.face)||![patch.x,patch.width].every(Number.isFinite)||patch.width<=0)throw Error('Invalid plinth patch');
 const s=plinthSpec,faces=[],parts=[],unresolvedSupports=[];
 if(!Array.isArray(openings)||new Set(openings.map(o=>o.id)).size!==openings.length||openings.some(o=>!o.id||!plinthFaces.some(f=>f.code===o.face)||![o.x0,o.x1,o.y0,o.y1].every(Number.isFinite)||o.x1<=o.x0||o.y1<=o.y0))throw Error('Invalid basement opening candidates');
 for(const face of plinthFaces){
  const list=[],slab=(id,layer,material,z0,z1,x0=-Infinity,x1=Infinity)=>{
   const sectionXZ=ringSection(face.width,z0,z1,x0,x1);if(sectionXZ.length<3||polygonArea(sectionXZ)<1e-12)return;
   list.push(finish({id:`VS1-${face.code}-${id}`,sourcePartId:`VS1-${face.code}-${id}`,face:face.code,layer,material,kind:'prismY',sectionXZ,y0:-height,y1:layer===4?-s.boardTopClearance:0,
    source:'PDF57/node09; §5.3',approved:false,quantityStatus:'illustrative geometry; height/aperture sizes/thin zone not surveyed'}));
  };
  slab('EXISTING',0,'masonry',-s.existingThickness,0);
  slab('EPS100',1,'EPS_Perimeeter',0,.100);
  const edge=face.width/2+.100;let cursor=-Infinity,index=0;
  // Preserve600mm source centres and75mm timber face. End/corner support
  // treatment is withheld; the complementary EPS never counts timber twice.
  for(let x=Math.ceil((-edge+.0375)/.600)*.600;x<edge-.0375;x+=.600){
   slab('EPS50-'+(++index),2,'EPS_Perimeeter',.100,.150,cursor,x-.0375);
   slab('TIMBER-'+index,2,'timber',.100,.150,x-.0375,x+.0375);cursor=x+.0375;
  }
  slab('EPS50-END',2,'EPS_Perimeeter',.100,.150,cursor,Infinity);
  const rows=Math.floor((height-.074)/.420)+1,margin=(height-(rows-1)*.420)/2;
  for(let i=0;i<rows;i++){
   const sectionYZ=hatSection().map(([y,z])=>[y-height+margin+i*.420,z+.150]);
   list.push(finish({id:`VS1-${face.code}-HAT-${i+1}`,sourcePartId:`VS1-${face.code}-HAT-${i+1}`,face:face.code,layer:3,kind:'profileX',material:'galvanized',x0:-face.width/2+.004,x1:face.width/2-.004,sectionYZ,
    source:'PDF57:25mm;§5.3:420mm',approved:false,profileStatus:'open generic hat; crown38/total74/steel1 display candidates; MP25/38 ordered section unknown',ventilationApproved:false}));
  }
  // Source0.6PURAL waternose; developed width, slope, fold and corner/end
  // closures are candidate geometry. The required transition timber/mesh/
  // tapes have no resolved placement and are not fabricated by this model.
  const path=[[.150,-.0006],[.264,-.0066],[.274,-.0166]],t=.0006;
  const normals=path.slice(0,-1).map((p,i)=>{const q=path[i+1],dx=q[0]-p[0],dy=q[1]-p[1],n=Math.hypot(dx,dy);return[-dy/n,dx/n];});
  const side=sign=>path.map((p,i)=>{if(!i||i===path.length-1){const n=normals[i?i-1:0];return[p[0]+sign*t/2*n[0],p[1]+sign*t/2*n[1]];}const a=normals[i-1],b=normals[i],f=sign*t/(2*(1+a[0]*b[0]+a[1]*b[1]));return[p[0]+(a[0]+b[0])*f,p[1]+(a[1]+b[1])*f];});
  const sectionYZ=[...side(1),...side(-1).reverse()].map(([z,y])=>[y,z]);
  list.push(finish({id:`VS1-${face.code}-TRANSITION-DRIP`,sourcePartId:`VS1-${face.code}-TRANSITION-DRIP`,face:face.code,layer:3,kind:'profileX',material:'PURAL_dark',x0:-face.width/2+.004,x1:face.width/2-.004,sectionYZ,
   source:'PDF58/node10:0.6PURAL waternose',approved:false,profileStatus:'candidate developed width/slope/fold;20mm upper board clearance; source50×175/RKL31/mesh/tape placement unresolved'}));
  const total=face.width+.350,n=Math.ceil(total/(s.maximumCandidatePanelWidth+s.joint)),pitch=total/n;
  for(let i=0;i<n;i++)slab('FC-'+String(i+1).padStart(3,'0'),4,'FC_P070',.175,.183,-total/2+i*pitch+(i?s.joint/2:0),-total/2+(i+1)*pitch-(i<n-1?s.joint/2:0));
  const entranceCuts=face.code==='SE'?entranceCentres.map((x,i)=>({id:'SE-D'+(i+1),x0:x-entranceSpec.doorWidth/2-entranceSpec.openingFit,x1:x+entranceSpec.doorWidth/2+entranceSpec.openingFit,y0:entranceSpec.threshold-entranceSpec.thresholdProfile,y1:entranceSpec.threshold+entranceSpec.doorHeight,source:'Ark20/27 VU01; fitting/threshold candidate',approved:false})):[];
  const coreCuts=retainedCoreCutsForFace(face),cutouts=[...openings.filter(o=>o.face===face.code),...entranceCuts];
  const supportCuts=[...cutouts,...coreCuts.filter(r=>r.z0<.150&&r.z1>0).map(r=>({...r,y0:-height,y1:0}))];
  const support=planPlinthSupports(face,list.filter(p=>p.material==='timber'),Array.from({length:rows},(_,i)=>-height+margin+i*.420),height,supportCuts);
  const recesses=support.parts.flatMap(p=>p.recesses),perforated=list.flatMap(p=>cutRetainedCores(p,coreCuts)).flatMap(p=>perforate(p,cutouts)).map(p=>p.material==='EPS_Perimeeter'?recessPlinthEPS(p,recesses,{finish,rectangleContours}):perforatePlinthHat(p));
  perforated.push(...support.parts.map(p=>finish(p)));unresolvedSupports.push(...support.unresolved);
  faces.push({...face,parts:perforated,retainedCoreCuts:coreCuts,panelCount:n,panelPitch:pitch,boardHeight:height-s.boardTopClearance});parts.push(...perforated);
 }
 const low=patch.x-patch.width/2,high=patch.x+patch.width/2,outside=[],cover=[],inspection=[];
 for(const part of parts){
  if(part.face!==patch.face){outside.push({...part,region:'outside',projection:true,stockPart:false});continue;}
  for(const [region,a,b] of [['outside',-Infinity,low],['outside',high,Infinity],['cover',low,high],['inspection',low,high]]){
   const p=finish(part,region,a,b);if(p)(region==='outside'?outside:region==='cover'?cover:inspection).push(p);
  }
 }
 const patchFace=plinthFaces.find(f=>f.code===patch.face),c=Math.cos(patchFace.rotation),sn=Math.sin(patchFace.rotation);
 const worldPosition=[patchFace.position[0]+c*patch.x,-height/2,patchFace.position[2]-sn*patch.x],worldNormal=[sn,0,c];
 const totals={};for(const p of parts){const row=totals[p.material]??={parts:0,volume:0};row.parts++;row.volume+=p.volume;}
 return {schema:'mae7-plinth-plan-v3',units:'m',approved:false,spec:{...s,height},faces,retainedCoreStatus:{approved:false,wrapDetail:null,foundation:null,scope:'New straight plinth layers stop at retained cores; wrapping the projections needs a surveyed working detail. Existing base and source gross quantities retained.'},retainedOpenings:structuredClone(openings),physicalParts:parts,outside,cover,inspection,patch:{...patch,y:-height/2,z:worldPosition[2],coordinateFrame:'face-local exterior left-to-right',worldPosition,worldNormal},layerOffsets:[...plinthOffsets],totals,
  envelope:{new:.183,sourceVS2Nominal:.242,sourceNominalStep:.059,modelVS2WithTape:.244,modelStep:.061},
  apron:{width:s.apronWidth,slope:s.apronSlope,gap:s.apronGap,jointMaximum:s.apronJointPitch,concreteThicknessCandidate:s.apronThicknessCandidate,groundCandidate:s.groundCandidate,
   landingExclusions:entranceCentres.map((x,i)=>({id:'ENTRANCE-'+(i+1)+'-GROUND-CONTACT',x0:x-(entranceSpec.width+.120)/2,x1:x+(entranceSpec.width+.120)/2,z0:5.620-5.405,z1:5.620-5.405+entranceSpec.depth+.300,
    bottom:s.groundCandidate,top:entranceSpec.ground,approved:false,source:null,scope:'candidate ground-facing landing support and apron exclusion; footprint follows existing entrance plan, not a surveyed foundation'}))},
  sourceQuantities:{EPS150_m2:71,EPS50_m2:5,FC_m2:76,source:'Hanketabel74–76',spatiallyLocated:false},
  supportStatus:{approved:false,quantityEligible:false,product:null,anchors:null,verticalPitch:null,unresolvedContacts:unresolvedSupports,scope:'Ark09 nominal angle150x150x60x2.5mm; square L geometry, not an ordered product. Bends/holes/anchors/pitch unresolved; local EPS recesses are geometry only'},
  metadata:{heightStatus:'660mm presentation candidate; source preserves existing plinth height',openingsStatus:openings.length?'retained graphic aperture candidates; no replacement procurement; actual sizes/recess require survey':'explicit no-opening baseline; no claim of net quantity',cornerFit:'45degree ring partition only; actual corner profile/50×100 timber/return details RFI',panelStock:'balanced ≤1192mm demonstration; ordered stock and texture direction unknown',
   conflicts:['PDF43 historical EPS100/U0.271 not adopted into current EPS150 assembly','20mm project FC-apron gap vs manufacturer reference50mm requires system reconciliation','horizontal hat has30x18mm two-web slots at60mm; open free area and supplier capacity require confirmation','71m²150+5m²50 thinzone cannot be located from current extracts'],foundation:'EPS100 to footing from§5.2; footing level and geometry unknown, not extrapolated belowground'}};
}
