// Source §5.8.2 / ark16–17: welded-frame fall >=1:80, board24mm,
// tape1.5x50mm, perimeterPURAL0.6mm, non-slip coating, wall upstand >=100mm.
// Layer order, rear datum, finish thickness and folded profile are candidates.
import {balconyGuardSource} from './balcony-guard-source.js';
export const balconyFloorSource='§5.8.2; арк16–17/PDF64–65';
export const balconyFloorParameters=Object.freeze({fall:1/80,boardThickness:.024,tapeThickness:.0015,tapeWidth:.050,
 flashingThickness:.0006,finishThickness:.001,upstandHeight:.100,rear:.029,rearFinishOffset:.024,
 layerOrder:'steel / perimeter flashing / rubber tape / board / finish',perimeterCompensation:.0006,
 flashingFlange:.050,flashingDrop:.030,flashingNose:.010,doorMargin:.002});
const add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(a,t)=>a.map(x=>x*t),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mag=a=>Math.hypot(...a);
export function polygonArea(points){let a=0;for(let i=0;i<points.length;i++){const b=points[(i+1)%points.length];a+=points[i][0]*b[1]-b[0]*points[i][1];}return Math.abs(a)/2;}
export function planeY(plane,x,z){return (plane.constant-plane.normal[0]*x-plane.normal[2]*z)/plane.normal[1];}
const planeOffset=(p,t)=>({normal:[...p.normal],constant:p.constant+t});
function clipZ(poly,z,keepGreater){const out=[];for(let i=0;i<poly.length;i++){
 const a=poly[i],b=poly[(i+1)%poly.length],ia=keepGreater?a[1]>=z:a[1]<=z,ib=keepGreater?b[1]>=z:b[1]<=z;
 if(ia)out.push(a);if(ia!==ib){const t=(z-a[1])/(b[1]-a[1]);out.push([a[0]+t*(b[0]-a[0]),z]);}}return out;}
// Local front-edge recesses for the five drawing-derived guard uprights.
// 2mm clearance and weather termination are display candidates, not shop cuts.
function notchFront(poly,cuts){
 const front=Math.max(...poly.map(p=>p[1])),out=[];
 for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length];out.push([...a]);
  if(Math.abs(a[1]-front)>1e-9||Math.abs(b[1]-front)>1e-9)continue;
  const direction=Math.sign(b[0]-a[0]),lo=Math.min(a[0],b[0]),hi=Math.max(a[0],b[0]);
  const visible=cuts.filter(q=>q.x0>lo&&q.x1<hi&&q.z0<front).sort((p,q)=>direction*(p.x0-q.x0));
  for(const q of visible){const x0=direction>0?q.x0:q.x1,x1=direction>0?q.x1:q.x0;out.push([x0,front],[x0,q.z0],[x1,q.z0],[x1,front]);}
 }return out;
}
function notchSide(poly,cut){
 return notchFront(poly.map(([x,z])=>[z,cut.side*x]),[{x0:cut.z0,x1:cut.z1,z0:cut.side*cut.innerX}]).map(([z,x])=>[cut.side*x,z]);
}
export function planBalconyFloor({bay,balconyId,door=null,parameters={}}={}){
 if(!bay||!/^BAL-\d{2}$/.test(balconyId||''))throw Error('Floor needs source bay / BAL ID');
 const p={...balconyFloorParameters,...parameters},B=bay.bottom,hw=bay.width/2,x=bay.x;
 if(![B,x,bay.width,bay.depth,...Object.values(p).filter(v=>typeof v==='number')].every(Number.isFinite)||p.fall<1/80||p.finishThickness<=0||p.finishThickness>.004||p.upstandHeight<.100||p.rear>=bay.depth-.2)throw Error('Invalid floor/source minimum');
 if(p.layerOrder!==balconyFloorParameters.layerOrder||p.perimeterCompensation!==p.flashingThickness)throw Error('Unsupported candidate layer order/compensation');
 if(p.boardThickness!==.024||p.tapeThickness!==.0015||p.tapeWidth!==.050||p.flashingThickness!==.0006)throw Error('Source layer dimensions changed');
 const theta=Math.atan(p.fall),c=Math.cos(theta),s=Math.sin(theta),n=[0,c,s],d=[0,-s,c];
 const finishedPlane={normal:n,constant:c*(B+p.rearFinishOffset)+s*p.rear};
 const steelPlane=planeOffset(finishedPlane,-p.finishThickness-p.boardThickness-p.tapeThickness);
 const rimPlane=planeOffset(steelPlane,-p.perimeterCompensation);
 const at=(z,w=0)=>[0,planeY(steelPlane,0,z)+w/c,z];
 const origin=[0,planeY(steelPlane,0,p.rear),p.rear];
 const fromTN=(xx,t,w)=>add(add([xx,origin[1],origin[2]],mul(d,t)),mul(n,w));
 const tFor=(z,w)=>(z-p.rear-s*w)/c;
 const supports=[],parts=[];
 function support(suffix,role,type,section,start,end,basis,capLocalZ=null,clipPlanes=[]){
  const length=mag(end.map((v,i)=>v-start[i]));
  supports.push({suffix,role,type,section,start,end,length,basis,capLocalZ,clipPlanes});
 }
 const halfZ=.025*c+.050*s,left=x-hw+.100,right=x+hw-.100;
 const rearAxis=p.rear+halfZ,frontAxis=bay.depth-halfZ,wR=-.050-p.perimeterCompensation;
 const tR=tFor(rearAxis,wR),tF=tFor(frontAxis,wR),bx={u:mul(d,-1),v:n,d:[1,0,0]},bz={u:[1,0,0],v:n,d};
 for(const [suffix,z] of [['FLOOR-REAR',rearAxis],['FLOOR-FRONT',frontAxis]]){
  const a=at(z,wR);a[0]=left;const b=[right,a[1],a[2]];
  support(suffix,'floor-perimeter','rhs',[.050,.100,.005],a,b,bx);
 }
 for(const [suffix,xx] of [['FLOOR-L',x-hw+.050],['FLOOR-R',x+hw-.050]]){
  const z0=p.rear+.100,z1=bay.depth-.100,a=at(z0,wR),b=at(z1,wR);a[0]=b[0]=xx;
  const length=(z1-z0)/c,cap={start:{base:0,u:0,v:-p.fall},end:{base:length,u:0,v:-p.fall}};
  support(suffix,'floor-perimeter','rhs',[.050,.100,.005],a,b,bz,cap,
   [{normal:[0,0,1],offset:z0,keep:'positive'},{normal:[0,0,-1],offset:-z1,keep:'positive'}]);
 }
 for(let i=0;i<7;i++)support(`JOIST-${i+1}`,'floor-joist','rhs',[.050,.050,.005],
  fromTN(x+(i-3)*.4,tR+.025,-.025),fromTN(x+(i-3)*.4,tF-.025,-.025),bz);
 const a=at(bay.depth/2,-.075);a[0]=x-hw+.075;
 support('CENTRE-L','floor-centre-angle','angle',[.050,.050,.005],a,[x+hw-.075,a[1],a[2]],bx);
 const deck={x0:x-hw+.050,x1:x+hw-.050,z0:p.rear,z1:bay.depth-.020,innerLeft:left,innerRight:right};
 const guardNotches=balconyGuardSource.frontUprights.map(u=>({x0:x+u.localX-u.faceWidth/2-.002,x1:x+u.localX+u.faceWidth/2+.002,z0:bay.depth-u.depth-.002,z1:bay.depth+.002,clearanceCandidate:.002,approved:false}));
 const sideGuardNotches=[-1,1].map(side=>({side,innerX:x+side*(hw-.042),z0:(p.rear+bay.depth)/2-.022,z1:(p.rear+bay.depth)/2+.022,clearanceCandidate:.002,approved:false}));
 const footprint=notchFront([[left,deck.z0],[left,p.rear+.100],[deck.x0,p.rear+.100],[deck.x0,bay.depth-.100],
  [left,bay.depth-.100],[left,deck.z1],[right,deck.z1],[right,bay.depth-.100],
  [deck.x1,bay.depth-.100],[deck.x1,p.rear+.100],[right,p.rear+.100],[right,deck.z0]],guardNotches);
 const layer=(suffix,role,layer,geometry,material,normalThickness,candidate)=>{
  const id=balconyId+'-'+suffix;parts.push({id,partId:id,balconyId,assembly:'balcony-floor',floorInspectionRole:role,layer,geometry,material,normalThickness,
   physical:true,quantityEligible:true,newStockPart:true,inspectionRepresentation:false,representationOf:null,approved:false,units:'m',
   preservePhysicalProfile:true,source:balconyFloorSource,candidate,explodeDirection:n,
   floorPlane:{...finishedPlane},parameters:{...p},sourceFacts:{fallMinimum:1/80,board:.024,tape:[.0015,.050],flashing:.0006,upstandMinimum:.100},
   quantityBasis:'displayed candidate physical layer; not ordered fabrication or accepted crew quantity'});return parts.at(-1);
 };
 function slopePart(suffix,role,layer,poly,low,high,material,thickness,candidate){
  const g={kind:'planePrism',footprint:poly,bottomPlane:low,topPlane:high};
  const q=layerFn(suffix,role,layer,g,material,thickness,candidate);q.analyticVolumeM3=polygonArea(poly)*thickness/c;return q;
 }
 const layerFn=layer;
 const boardTop=planeOffset(finishedPlane,-p.finishThickness),boardBottom=planeOffset(boardTop,-p.boardThickness);
 slopePart('DECK','board',3,footprint,boardBottom,boardTop,'board',p.boardThickness,'source24mm normal board; post notches/rear datum are candidates');
 // True bearing-face footprints are shared by steel, flashing and tape.
 function topPoints(q){const [aa,bb]=q.section,v=bb/2,out=[];
  for(const [u,last] of [[-aa/2,false],[aa/2,false],[aa/2,true],[-aa/2,true]]){
   const cap=q.capLocalZ?.[last?'end':'start'],zz=cap?cap.base+cap.u*u+cap.v*v:last?q.length:0;
   out.push(add(add(add(q.start,mul(q.basis.u,u)),mul(q.basis.v,v)),mul(q.basis.d,zz)));
  }return out;
 }
 for(const q of supports.filter(q=>q.role!=='floor-centre-angle')){
  let top=topPoints(q);
  if(q.role==='floor-perimeter')top=top.map(a=>add(a,mul(n,p.flashingThickness)));
  let poly=top.map(a=>[a[0],a[2]]);
  if(q.capLocalZ){poly=clipZ(clipZ(poly,p.rear+.100,true),bay.depth-.100,false);}
  if(q.suffix==='FLOOR-FRONT')poly=notchFront(poly,guardNotches);
  if(['FLOOR-L','FLOOR-R'].includes(q.suffix))poly=notchSide(poly,sideGuardNotches[q.suffix==='FLOOR-L'?0:1]);
  slopePart('TAPE-'+q.suffix,'tape',2,poly,steelPlane,planeOffset(steelPlane,p.tapeThickness),'tape',p.tapeThickness,
   'source1.5x50mm on actual board-bearing steel; candidate square/vertical ends, no tape on centreL below joists');
  if(q.role!=='floor-perimeter')continue;
  if(q.suffix==='FLOOR-REAR'){
   slopePart('FLASHING-'+q.suffix,'flashing',1,poly,rimPlane,steelPlane,'flashing',p.flashingThickness,
    'source0.6mm perimeter metal; rear flat underboard flange only, vertical upturn/threshold termination unresolved');continue;
  }
  const outward=q.suffix==='FLOOR-FRONT'?d:q.suffix==='FLOOR-L'?[-1,0,0]:[1,0,0];
  const axis=cross(outward,n),reverse=dot(axis,q.basis.d)<0;
  // Outward edge of the compensated flange. End clipping keeps post faces clear.
  const base=reverse?q.end:q.start;
  let po=add(add(base,mul(outward,q.section[0]/2)),mul(n,q.section[1]/2+p.flashingThickness));
  let cap=null,length=q.length;
  if(q.capLocalZ){
   const zs=reverse?bay.depth-.100:p.rear+.100;
   po=add(po,mul(axis,(zs-po[2])/axis[2]));
   const vcoef=-n[2]/axis[2];cap={start:{base:0,u:0,v:vcoef},end:{base:length,u:0,v:vcoef}};
  }
  const t=p.flashingThickness,A=p.flashingFlange,H=p.flashingDrop,N=p.flashingNose;
  const profile=[[-A,0],[0,0],[0,-H+t],[N,-H+t],[N,-H],[-t,-H],[-t,-t],[-A,-t]];
  const geom={kind:'profileSweep',sectionPoints:profile,origin:po,basis:{u:outward,v:n,d:axis},length,capLocalZ:cap,
   clipPlanes:q.clipPlanes};
  // Front flashing ends either side of each through-upright, not through it.
  const frontSpans=q.suffix==='FLOOR-FRONT'?(()=>{const edges=[left,...guardNotches.flatMap(q=>[q.x0,q.x1]),right];return Array.from({length:edges.length/2},(_,i)=>[edges[2*i],edges[2*i+1]]);})():null;
  const sideCut=sideGuardNotches[q.suffix==='FLOOR-L'?0:1],sideSpans=['FLOOR-L','FLOOR-R'].includes(q.suffix)?[[p.rear+.100,sideCut.z0],[sideCut.z1,bay.depth-.100]]:null,spans=frontSpans||sideSpans;
  for(const [i,span] of (spans||[[0,length]]).entries()){
   const targetZ=sideSpans?(axis[2]>0?span[0]:span[1]):null,segmentLength=sideSpans?(span[1]-span[0])/Math.abs(axis[2]):span[1]-span[0];
   const segment=frontSpans?{...geom,origin:[span[1],po[1],po[2]],length:segmentLength}:sideSpans?{...geom,origin:add(po,mul(axis,(targetZ-po[2])/axis[2])),length:segmentLength,capLocalZ:{start:{...cap.start,base:0},end:{...cap.end,base:segmentLength}}}:geom;
   const piece=layerFn('FLASHING-'+q.suffix+(spans?'-'+(i+1):''),'flashing',1,segment,'flashing',t,'candidate50mm flange/30mm drop/10mm nose and layer order; front guard recesses2mm clearance, weather seals/folds/ends unknown');
   piece.analyticVolumeM3=polygonArea(profile)*segment.length;
  }
 }
 // Rear coating turns up only on solid-wall portions, never across the door.
 const doorRange=door?{id:door.id||null,x0:door.x-door.width/2-p.doorMargin,x1:door.x+door.width/2+p.doorMargin,
  y0:door.y-door.height/2,y1:door.y+door.height/2,margin:p.doorMargin}:null;
 const lo=doorRange?Math.max(left,Math.min(right,doorRange.x0)):right,hi=doorRange?Math.max(left,Math.min(right,doorRange.x1)):right;
 const segments=doorRange?[[left,lo],[hi,right]].filter(a=>a[1]-a[0]>1e-6):[];
 let finishFootprint=footprint.map(a=>[...a]);
 if(doorRange){finishFootprint[0][1]+=p.finishThickness;finishFootprint.at(-1)[1]+=p.finishThickness;
  finishFootprint.push([hi,p.rear+p.finishThickness],[hi,p.rear],[lo,p.rear],[lo,p.rear+p.finishThickness]);}
 slopePart('FINISH','coating',4,finishFootprint,boardTop,finishedPlane,'coating',p.finishThickness,
  'non-slip PU/analogue source requirement;1mm thickness/tint and separate rear-wall seams are candidates');
 for(let i=0;i<segments.length;i++){
  const [xl,xr]=segments[i],poly=[[xl,p.rear],[xr,p.rear],[xr,p.rear+p.finishThickness],[xl,p.rear+p.finishThickness]];
  const high={normal:[0,1,0],constant:B+p.rearFinishOffset+p.upstandHeight};
  const q=layerFn('UPSTAND-'+(i+1),'upstand',4,{kind:'planePrism',footprint:poly,bottomPlane:boardTop,topPlane:high},'coating',p.finishThickness,
   'source>=100mm wall upstand; door margin2mm and butt continuity are candidates, threshold and termination/seals unresolved');
  const centre=poly.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4],[0,0]);
  q.analyticVolumeM3=polygonArea(poly)*(planeY(high,...centre)-planeY(boardTop,...centre));q.doorRange=doorRange;
 }
 return {balconyId,bay:{...bay},parameters:p,theta,normal:n,depthDirection:d,finishedPlane,steelPlane,rimPlane,supports,parts,deck,footprint,doorRange,guardNotches,sideGuardNotches,
  guardCentre:B+p.rearFinishOffset+1-.020,source:balconyFloorSource,approved:false,
  candidate:{rearDatum:'published rear finished24mm above nominal floor retained; not surveyed source construction level',
   layerOrder:p.layerOrder,perimeterCompensation:p.perimeterCompensation,finishThickness:p.finishThickness,flashFold:[p.flashingFlange,p.flashingDrop,p.flashingNose]},
  unknown:{coatingProduct:null,coatingCertifiedThickness:null,waterproofSystem:null,layerOrderApproval:null,profileFold:null,radii:null,cornerSeals:null,
   thresholdTermination:null,doorSill21mmGluedWood:'source requirement not authored',openingFlashingProjection10mm:'source requirement not authored',
   rearMetalUpturn:'source shown; vertical return not authored',foundationConnections:null,sourceRearDatum:null,guardRecessSeal:null,guardFootWeld:null,guardRecessClearanceApproval:null}};
}

// Vertical-sided prisms between two actual planes retain NORMAL thickness.
export function balconyFloorGeometry(THREE,part){
 const q=part.geometry;
 if(q.kind==='profileSweep'){
  const shape=new THREE.Shape();q.sectionPoints.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:q.length,bevelEnabled:false,steps:1,curveSegments:1});
  const a=g.attributes.position;
  if(q.capLocalZ)for(let i=0;i<a.count;i++){const cap=q.capLocalZ[a.getZ(i)<q.length/2?'start':'end'];a.setZ(i,cap.base+cap.u*a.getX(i)+cap.v*a.getY(i));}
  const m=new THREE.Matrix4().makeBasis(new THREE.Vector3(...q.basis.u),new THREE.Vector3(...q.basis.v),new THREE.Vector3(...q.basis.d));m.setPosition(...q.origin);
  g.applyMatrix4(m);g.computeVertexNormals();g.computeBoundingBox();return g;
 }
 const points=q.footprint,xy=points.map(a=>new THREE.Vector2(...a)),caps=THREE.ShapeUtils.triangulateShape(xy,[]),coords=[];
 const bottom=points.map(([x,z])=>[x,planeY(q.bottomPlane,x,z),z]),top=points.map(([x,z])=>[x,planeY(q.topPlane,x,z),z]);
 const tri=(a,b,c)=>coords.push(...a,...b,...c);
 // ShapeUtils triangles are CCW inXZ: their world normal is -Y.
 for(const [a,b,c] of caps){tri(bottom[a],bottom[b],bottom[c]);tri(top[a],top[c],top[b]);}
 let signed=0;for(let i=0;i<points.length;i++){const j=(i+1)%points.length;signed+=points[i][0]*points[j][1]-points[j][0]*points[i][1];}
 for(let i=0;i<points.length;i++){const j=(i+1)%points.length;
  if(signed>0){tri(bottom[i],top[i],top[j]);tri(bottom[i],top[j],bottom[j]);}
  else{tri(bottom[i],top[j],top[i]);tri(bottom[i],bottom[j],top[j]);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));g.computeVertexNormals();g.computeBoundingBox();return g;
}
export function createBalconyFloorMaterials(THREE){
 const definitions={board:['FC_CEMENT_PARTICLE_24','cement_particleboard','#a1a7a3',.82],tape:['BALCONY_RUBBER_TAPE_1P5','rubber','#292d2e',.92],
  coating:['BALCONY_PU_FINISH_CANDIDATE_1MM','polyurethane','#6d7274',.67],flashing:['BALCONY_PURAL_FLASHING_0P6','coated_metal','#333d41',.46]},out={};
 for(const [key,[name,family,color,roughness]] of Object.entries(definitions)){
  const m=new THREE.MeshStandardMaterial({color,roughness,metalness:0});m.name=name;
  m.userData={materialId:name,materialFamily:family,source:balconyFloorSource,approved:false,opticalCandidate:{color,roughness},
   sourceFacts:key==='board'?{material:'cement-particleboard',thickness:.024}:key==='tape'?{material:'rubber tape',thickness:.0015,width:.050}:
    key==='flashing'?{material:'PURAL-coated steel flashing',thickness:.0006}:{material:'non-slip polyurethane coating or analogue',thicknessCandidate:.001},
   finishAuthority:'source material category; illustrative finish, no delivered product/colour or certified coating thickness',unknown:{supplier:null,product:null}};out[key]=m;
 }return out;
}
export function createBalconyFloor(THREE,parent,{plan,materials}={}){
 const group=new THREE.Group();group.name=plan.balconyId+'-FLOOR';group.userData={assembly:'balcony-floor',balconyId:plan.balconyId,floorAssembly:true,approved:false,
  floorPlan:{parameters:plan.parameters,finishedPlane:plan.finishedPlane,steelPlane:plan.steelPlane,normal:plan.normal,doorRange:plan.doorRange,unknown:plan.unknown}};parent.add(group);
 const mats=materials||createBalconyFloorMaterials(THREE);
 for(const part of plan.parts){const mesh=new THREE.Mesh(balconyFloorGeometry(THREE,part),mats[part.material]);mesh.name=part.id;mesh.castShadow=mesh.receiveShadow=true;
  mesh.userData={...part,component:{kind:'balcony-floor',title:`Підлога балкона · ${part.floorInspectionRole}`,source:part.source,note:part.candidate}};group.add(mesh);}
 return {group,plan};
}
