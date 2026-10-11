import {roofSpec,roofSide,roofSurfaceY} from './roof-geometry.js';
import {roofFasciaSpec} from './roof-assembly.js';

export const roofEdgeSpec=Object.freeze({soffitThickness:.022,soffitWidth:.100,clearGap:.015,rakeFasciaWidth:.125,
 flashingThickness:.0006,source:'§5.4; PDF60 / арк12',approved:false});
// The project requires mesh but does not identify the product or open area.
// These open wire surfaces show that requirement; they are not purchased stock.
export const insectMeshDisplaySpec=Object.freeze({pitch:.002,wireWidth:.00045,source:'§5.4',product:null,approved:false,quantity:0});
const finite=(n,name)=>{if(!Number.isFinite(n)||n<=0)throw Error('Invalid '+name);return n;};
function courses(start,end,width,gap){
 const span=end-start;if(span<=0)throw Error('Roof edge extent must be positive');
 const full=Math.floor((span+gap+1e-12)/(width+gap)),covered=full?full*width+(full-1)*gap:0,remainder=span-covered;
 // Keep100mm stock. A narrow residual goes into two explicitly candidate
 // boundary ventilation gaps (each<=15mm), rather than ripping every board.
 const boundary=full&&remainder<=2*gap+1e-12?remainder/2:0,result=[];
 for(let i=0;i<full;i++)result.push([start+boundary+i*(width+gap),start+boundary+i*(width+gap)+width]);
 if(!full)result.push([start,end]);else if(!boundary&&remainder>1e-12)result.push([start+covered+gap,end]);
 if(result.some(([a,b])=>b<=a||b-a>width+1e-9))throw Error('Roof edge course cannot close');
 return {courses:result,startGap:boundary,endGap:boundary,strategy:boundary?'Full100mm stock; residual shared between two boundary ventilation gaps (candidate)':'Full100mm from start; only final remainder cut'};
}
const topY=(sign,z,normalDepth)=>roofSurfaceY(sign*z)-normalDepth/Math.cos(roofSide(sign).angle);
function ridgeJoin(depth){
 const a=roofSide(1),b=roofSide(-1),z=depth*(1/Math.cos(b.angle)-1/Math.cos(a.angle))/(a.rise/a.span+b.rise/b.span);
 return [roofSpec.ridge-a.rise/a.span*z-depth/Math.cos(a.angle),z];
}
function section(sign,z0,z1,topDepth,bottomDepth,ridge=false){
 const nearTop=ridge?ridgeJoin(topDepth):[topY(sign,z0,topDepth),sign*z0];
 const nearBottom=ridge?ridgeJoin(bottomDepth):[topY(sign,z0,bottomDepth),sign*z0];
 return [nearTop,[topY(sign,z1,topDepth),sign*z1],[topY(sign,z1,bottomDepth),sign*z1],nearBottom];
}
function foldedSection(path,thickness){
 const normals=path.slice(0,-1).map((p,i)=>{const q=path[i+1],dy=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dy,dz);return[-dz/length,dy/length];});
 const edge=sign=>path.map((p,i)=>{
  const before=normals[Math.max(0,i-1)],after=normals[Math.min(i,normals.length-1)];
  const f=sign*thickness/(2*(1+before[0]*after[0]+before[1]*after[1]));
  return[p[0]+(before[0]+after[0])*f,p[1]+(before[1]+after[1])*f];
 });
 return[...edge(1),...edge(-1).reverse()];
}
export function planRoofEdgeDetails({wallHalfLength=20.2,wallHalfDepth=5.649}={}){
 finite(wallHalfLength,'wall length');finite(wallHalfDepth,'wall depth');
 const end=roofSpec.length/2,inside=end-roofFasciaSpec.thickness,d=roofSpec.envelopeDepth,t=roofEdgeSpec.soffitThickness;
 if(wallHalfLength>=inside)throw Error('No gable soffit overhang');
 const parts=[],sides=[];
 for(const sign of [1,-1]){
  const side=roofSide(sign),back=side.span-roofFasciaSpec.centreSetback-roofFasciaSpec.thickness/2,front=back+roofFasciaSpec.thickness;
  if(wallHalfDepth>=back)throw Error('No eave soffit overhang');
  const bottom=topY(sign,back,d+t),code=sign>0?'SE':'NW';
  // Eave boards end against the two rake boards, rather than protruding past them.
  parts.push({id:'ROOF-EDGE-'+code+'-FASCIA',kind:'box',role:'eave-fascia',size:[2*inside,roofFasciaSpec.height,roofFasciaSpec.thickness],position:[0,bottom+roofFasciaSpec.height/2,sign*(back+front)/2]});
  // A thin folded sheet bridges the exposed deck-to-fascia gap. The seat is
  // under the roof pan, the downstand laps the original150mm fascia by20mm.
  // Seat120/lap20/drip10 are visible working-detail candidates, not source sizes.
  const ft=roofEdgeSpec.flashingThickness,foldZ=front+ft,fasciaTop=bottom+roofFasciaSpec.height;
  const foldPath=[[topY(sign,front-.120,ft*1.5),sign*(front-.120)],
   [topY(sign,foldZ,ft*1.5),sign*foldZ],
   [fasciaTop-.020,sign*foldZ],[fasciaTop-.025,sign*(foldZ+.010)]];
  parts.push({id:`ROOF-EDGE-${code}-EAVE-FLASHING`,kind:'prismX',role:'eave-flashing',x:-end,length:2*end,
   sectionYZ:foldedSection(foldPath,ft),foldPath,thickness:ft,material:'metal',quantityEligible:false,quantity:0,
   profileAuthority:'§5.4 PURAL0.6mm; continuous eave closure. Candidate seat120/lap20/drip10, zero-radius folds; product, fastening, end laps and drainage require confirmation.'});
  const cos=Math.cos(side.angle);
  const eaveCourses=courses(wallHalfDepth/cos,back/cos,roofEdgeSpec.soffitWidth,roofEdgeSpec.clearGap);
  for(const [i,[a,b]] of eaveCourses.courses.entries())
   parts.push({id:`ROOF-EDGE-${code}-SOFFIT-${i+1}`,kind:'prismX',role:'eave-soffit',x:-wallHalfLength,length:2*wallHalfLength,sectionYZ:section(sign,a*cos,b*cos,d,d+t),finishedWidth:b-a});
  parts.push({id:`ROOF-EDGE-${code}-INSECT-MESH`,kind:'wovenMesh',role:'soffit-insect-mesh',x:-wallHalfLength,length:2*wallHalfLength,
   sign,s0:wallHalfDepth/cos,s1:back/cos,normalDepth:d,material:'insect_mesh',physical:false,quantityEligible:false,quantity:0,
   displaySpec:insectMeshDisplaySpec,profileAuthority:'Open wire surface representation behind sourced15mm board gaps. Mesh product and ventilation performance unconfirmed.'});
  for(const endSign of [-1,1]){
   const label=endSign>0?'SW':'NE',edgeX=endSign>0?inside:-end;
   // Rake top/bottom and the soffit use the same source-normal datum.
   parts.push({id:`ROOF-EDGE-${label}-${code}-FASCIA`,kind:'prismX',role:'rake-fascia',x:edgeX,length:roofFasciaSpec.thickness,
    sectionYZ:section(sign,0,back,d+t-roofEdgeSpec.rakeFasciaWidth,d+t,true)});
   // Close the exposed upper roof package with a thin external edge flashing,
   // rather than enlarging the sourced125mm timber or filling ventilation.
   parts.push({id:`ROOF-EDGE-${label}-${code}-UPPER-FLASHING`,kind:'prismX',role:'rake-flashing',x:endSign>0?end:-end-.0006,length:.0006,
    sectionYZ:section(sign,0,front,-.0006,d+t-roofEdgeSpec.rakeFasciaWidth+.015,true),material:'metal',quantityEligible:false,quantity:0,
    profileAuthority:'0.6mm edge closure candidate; finished folds/working detail require confirmation'});
   // The corner cap occupies the eave-fascia thickness only; it closes the
   // return without an exposed board end or an overlapping soffit duplicate.
   parts.push({id:`ROOF-EDGE-${label}-${code}-CORNER`,kind:'box',role:'fascia-corner',size:[roofFasciaSpec.thickness,roofFasciaSpec.height,roofFasciaSpec.thickness],position:[endSign*(inside+roofFasciaSpec.thickness/2),bottom+roofFasciaSpec.height/2,sign*(back+front)/2]});
   const rakeCourses=courses(wallHalfLength,inside,roofEdgeSpec.soffitWidth,roofEdgeSpec.clearGap);
   for(const [i,[a,b]] of rakeCourses.courses.entries())
    parts.push({id:`ROOF-EDGE-${label}-${code}-SOFFIT-${i+1}`,kind:'prismX',role:'rake-soffit',x:endSign>0?a:-b,length:b-a,sectionYZ:section(sign,0,back,d,d+t,true),finishedWidth:b-a});
   parts.push({id:`ROOF-EDGE-${label}-${code}-INSECT-MESH`,kind:'wovenMesh',role:'soffit-insect-mesh',x:endSign>0?wallHalfLength:-inside,length:inside-wallHalfLength,
    sign,s0:sign*ridgeJoin(d)[1]/cos,s1:back/cos,normalDepth:d,material:'insect_mesh',physical:false,quantityEligible:false,quantity:0,
    displaySpec:insectMeshDisplaySpec,profileAuthority:'Open mesh display behind gable underside gaps; no stock, mounting or airflow approval.'});
  }
  sides.push({sign,fasciaBack:sign*back,fasciaFront:sign*front,soffitBottomAtFascia:bottom,eaveCourses,rakeCourses:courses(wallHalfLength,inside,roofEdgeSpec.soffitWidth,roofEdgeSpec.clearGap)});
 }
 // Close both exposed ends of the raised ridge cap. Side ventilation under
 // the cap remains open; this is an end plate, not a solid filled roof cavity.
 const leg=.200,raise=.040,front=roofSide(1),rear=roofSide(-1),zl=-leg*Math.cos(rear.angle),zr=leg*Math.cos(front.angle);
 for(const sign of [-1,1])parts.push({id:'ROOF-RIDGE-ENDCAP-'+(sign>0?'SW':'NE'),kind:'prismX',role:'ridge-endcap',x:sign>0?end:-end-.0006,length:.0006,material:'metal',quantityEligible:false,quantity:0,
  sectionYZ:[[roofSpec.ridge+raise-leg*Math.sin(rear.angle),zl],[roofSpec.ridge+raise,0],[roofSpec.ridge+raise-leg*Math.sin(front.angle),zr],[roofSurfaceY(zr)-.025,zr],[roofSpec.ridge-.025,0],[roofSurfaceY(zl)-.025,zl]],
  profileAuthority:'User visible ridge-end gap correction;0.6mm shaped end plate, folds and fixing candidate.'});
 return {parts,sides,wallHalfLength,wallHalfDepth,endInside:inside,spec:roofEdgeSpec,approved:false,
  candidate:'Roof-parallel underside/corner fit; full100mm stock, final remainder only or named boundary ventilation gap allocation; existing roof planes unchanged.',
  unknowns:['Measured soffit datum, board stock lengths, end joints, flashing folds/fasteners and mesh product/ventilation performance require design/site confirmation.']};
}
function prismGeometry(THREE,p){
 const shape=new THREE.Shape();p.sectionYZ.forEach(([y,z],i)=>i?shape.lineTo(y,z):shape.moveTo(y,z));shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:p.length,bevelEnabled:false,steps:1});
 const a=g.getAttribute('position');for(let i=0;i<a.count;i++){const y=a.getX(i),z=a.getY(i),x=a.getZ(i)+p.x;a.setXYZ(i,x,y,z);}g.computeVertexNormals();return g;
}
function meshGeometry(THREE,p){
 const {pitch,wireWidth}=p.displaySpec,positions=[],cos=Math.cos(roofSide(p.sign).angle),x1=p.x+p.length;
 const point=(x,s)=>[x,topY(p.sign,s*cos,p.normalDepth),p.sign*s*cos];
 const quad=(x0,x1,s0,s1)=>{const a=point(x0,s0),b=point(x1,s0),c=point(x1,s1),d=point(x0,s1);positions.push(...a,...b,...c,...a,...c,...d);};
 // Two continuous families of narrow strips, with real open apertures. No
 // opaque backplane or alpha texture can accidentally fill the15mm gaps.
 for(let x=Math.ceil((p.x-wireWidth/2)/pitch)*pitch;x-wireWidth/2<x1;x+=pitch){
  const low=Math.max(p.x,x-wireWidth/2),high=Math.min(x1,x+wireWidth/2);if(high>low)quad(low,high,p.s0,p.s1);
 }
 for(let s=Math.ceil((p.s0-wireWidth/2)/pitch)*pitch;s-wireWidth/2<p.s1;s+=pitch){
  const low=Math.max(p.s0,s-wireWidth/2),high=Math.min(p.s1,s+wireWidth/2);if(high>low)quad(p.x,x1,low,high);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingBox();return g;
}
export function createRoofEdgeDetails(THREE,parent,{materials={},...options}={}){
 if(!materials.timber)throw Error('Roof edge timber material required');
 const plan=planRoofEdgeDetails(options),group=new THREE.Group();group.name='roof-edge-details';parent.add(group);
 group.userData={assembly:'roof-edge',approved:false,component:{kind:'roof',title:'Підшивка і лобова дошка',source:roofEdgeSpec.source,note:plan.candidate}};
 const metal=materials.metal??new THREE.MeshStandardMaterial({color:'#444b50',roughness:.42,metalness:.65});
 const insectMesh=materials.insectMesh??new THREE.MeshStandardMaterial({color:'#292e30',roughness:.78,metalness:.12,side:THREE.DoubleSide});
 insectMesh.name='roof_insect_mesh';insectMesh.userData={...insectMesh.userData,materialFamily:'insect_mesh',source:'§5.4',approved:false,product:null,quantityEligible:false};
 for(const p of plan.parts){const g=p.kind==='box'?new THREE.BoxGeometry(...p.size):p.kind==='wovenMesh'?meshGeometry(THREE,p):prismGeometry(THREE,p),m=new THREE.Mesh(g,p.material==='metal'?metal:p.material==='insect_mesh'?insectMesh:materials.timber);if(p.position)m.position.fromArray(p.position);
  m.name=p.id;m.castShadow=p.physical!==false;m.receiveShadow=true;m.userData={partId:p.id,assembly:'roof-edge',roofEdgeRole:p.role,physical:p.physical!==false,approved:false,preservePhysicalProfile:true,authoring:p,...(p.quantityEligible===false?{quantityEligible:false,quantity:0,profileAuthority:p.profileAuthority}:{})};group.add(m);}
 return {group,plan};
}
