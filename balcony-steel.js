// Ark16–17/PDF64–65 and §5.8.2. Ideal sharp sections, no invented radii,
// anchors, weld beads or manufacturing cope. Layout and joints are candidates.
import {planBalconyFloor,planeY,balconyFloorGeometry} from './balcony-floor.js';
import {balconyCanopySpec,canopyUnderside} from './balcony-canopy.js';
import {balconyPostBaseY} from './balcony-foundation.js';
export const balconySteelSource='§5.8.2; арк16–17/PDF64–65';
export const balconySteelSpec=Object.freeze({grade:'S355JR',finish:'C3 painted steel',post:Object.freeze([.100,.100,.005]),
 perimeter:Object.freeze([.050,.100,.005]),joist:Object.freeze([.050,.050,.005]),joistPitch:.400,joistAxes:7,angle:Object.freeze([.050,.050,.005]),guard:Object.freeze([.040,.040,.003]),
 facadeOuter:.029,interfaceClearance:.002,approved:false});
export function planBalconySteel({bay,balconyId,floorPlan}={}){
 if(!bay||!/^BAL-\d{2}$/.test(balconyId||''))throw Error('Balcony steel needs canonical bay and BAL ID');
 const {x,f,bottom,top,width,depth,guardTop}=bay;
 if(![x,f,bottom,top,width,depth,guardTop].every(Number.isFinite)||!Number.isInteger(f)||f<0||f>2||width<2.6||depth<.4||top<=guardTop)throw Error('Invalid balcony envelope');
 const s=balconySteelSpec,hw=width/2,postX=hw-.05,rear=s.facadeOuter,front=depth;
 const floor=floorPlan||planBalconyFloor({bay,balconyId});
 if(floor.balconyId!==balconyId||floor.bay.x!==x||floor.bay.bottom!==bottom)throw Error('Floor/steel source bay mismatch');
 const parts=[],postBottom=f===0?balconyPostBaseY:bottom-.140;
 const railCentre=floor.guardCentre; // highest actual finished surface +source minimum guard height
 const unknown={cornerRadii:null,welds:null,anchors:null,cope:null,approvedFabricationCuts:null,sectionSupplier:null};
 function add(suffix,role,type,section,start,end,candidate){
  const length=Math.hypot(...end.map((v,i)=>v-start[i])),[a,b,t]=section;
  const sectionArea=type==='rhs'?a*b-(a-2*t)*(b-2*t):t*(a+b-t);
  parts.push({id:`${balconyId}-STEEL-${suffix}`,partId:`${balconyId}-STEEL-${suffix}`,balconyId,logicalMemberId:`${balconyId}-STEEL-${suffix}`,
   assemblyId:balconyId,postLineId:role==='vertical-post'?`BAL-STACK-${String(Math.floor((Number(balconyId.slice(4))-1)/3)+1).padStart(2,'0')}-${suffix}`:null,
   role,type,section:{width:a,height:b,thickness:t},start,end,length,sectionArea,volume:sectionArea*length,units:'m',
   physical:true,quantityEligible:true,newStockPart:true,inspectionRepresentation:false,representationOf:null,fabricationQuantityApproved:false,approved:false,
   source:balconySteelSource,material:'S355JR-C3',candidate,unknown:{...unknown},
   quantityBasis:'one displayed candidate member; source topology is not an approved fabrication cut count; source welded structure is delivered whole'});
 }
 for(const [side,xx] of [['L',x-postX],['R',x+postX]]){
  for(const [end,z] of [['REAR',rear+.050],['FRONT',front-.050]])
   add(`POST-${side}-${end}`,'vertical-post','rhs',s.post,[xx,postBottom,z],[xx,f===2?canopyUnderside(bay,z)-balconyCanopySpec.tape-.050/Math.cos(balconyCanopySpec.angle):top,z],
    f===0?'Four source corner lines; ground-storey posts seat on the ark18 foundation base plates. Absolute foundation datum and per-storey joints remain display fits.':'Four source corner lines; per-storey butt segmentation and facade-face fit are candidates. Foundation continuation withheld.');
 }
 const left=x-hw+.100,right=x+hw-.100;
 for(const q of floor.supports){
  add(q.suffix,q.role,q.type,q.section,q.start,q.end,
   'Source>=1:80 welded-frame fall; orthonormal sections. Rear finished datum, perimeter0.6mm compensation, phase/end planes and centreL elevation remain candidates');
  Object.assign(parts.at(-1),{basis:q.basis,capLocalZ:q.capLocalZ,clipPlanes:q.clipPlanes,
   floorInspectionRole:'steel',layer:0,floorFall:floor.parameters.fall,floorPlane:floor.steelPlane});
 }
 for(const [name,xx] of [['L',x-hw+.020],['R',x+hw-.020]])
  add(`GUARD-${name}`,'guard-side-rail','rhs',s.guard,[xx,railCentre,rear+.100],[xx,railCentre,front-.100],'Centre derived from highest candidate finished surface +source1000mm minimum guard height; full guard frame/track design unresolved');
 for(const [name,y] of [['LOW',railCentre],['TOP',top]])
  add(`GUARD-FRONT-${name}`,'guard-front-rail','rhs',s.guard,[left,y,depth-.020],[right,y,depth-.020],
   '40x40x3 section; lower rail follows displayed deck +source1000mm minimum; glass tracks and upper50x50x3 source supports withheld');
 if(f===2){
  const a=balconyCanopySpec.angle,c=Math.cos(a),sn=Math.sin(a),frontZ=front-.050,rearZ=rear+.050;
  const y=z=>canopyUnderside(bay,z)-balconyCanopySpec.tape-.025/c;
  const candidate='Ark16 upper50x50x3 source section; five-member pitched canopy support and2mm seating are display candidates; fixings/welds require supplier design';
  for(const [name,z] of [['REAR',rearZ],['FRONT',frontZ]]){
   add('CANOPY-'+name,'canopy-frame','rhs',balconyCanopySpec.section,[x-postX-.025,y(z),z],[x+postX+.025,y(z),z],candidate);
   parts.at(-1).basis={u:[0,sn,-c],v:[0,c,sn],d:[1,0,0]};
  }
  // Depth members meet the perpendicular faces, not their centres; exact
  // pitched end planes prevent hidden steel volume at the two corner joints.
  for(const [name,xx] of [['L',x-postX],['M',x],['R',x+postX]]){
   const z0=rearZ+.025/c,z1=frontZ-.025/c;
   add('CANOPY-'+name,'canopy-frame','rhs',balconyCanopySpec.section,[xx,y(z0),z0],[xx,y(z1),z1],candidate);
   parts.at(-1).basis={u:[1,0,0],v:[0,c,sn],d:[0,-sn,c]};
  }
 }
 return {balconyId,bay:{...bay},parts,source:balconySteelSource,approved:false,
  sourceTopology:{postLinesPerStack:4,perimeterMembersPerFloor:4,joistAxesPerFloor:7,joistPitch:.400,centreAnglesPerFloor:1},
  candidate:{topology:'four corner posts / sloping closed floor perimeter / seven cross-depth joists / centre angle below joists',
   alternativeRejected:'two front posts and three-sided perimeter omit wall-side posts and floor structure visible on ark17',
   rearPostBack:rear,sourceNominalDepth:depth,fittedFloorDepth:depth-rear,joistPhase:'symmetric around bay centre',
   flatFloor:false,requiredSourceFall:'at least1:80 outward; implemented on actual frame and all floor layers',
   requiredGuardHeightFromFinishedFloor:1,displayRailHeightFrom24mmDeck:1,guardRailCentre:railCentre,
   guardHeightResidual:'minimum relative to highest candidate finished surface; source datum/product not approved'},
  skin:{back:rear+.100+s.interfaceClearance,front:depth-.100-s.interfaceClearance,
   clearance:s.interfaceClearance,basis:'candidate clear of actual rear/front post surfaces'},
  deck:{x0:x-hw+.050,x1:x+hw-.050,z0:rear,z1:depth-.020,y:bottom,thickness:.024,
   basis:'source24mm normal cement-particleboard with candidate post notches; canonical floorPlan includes pitched frame, tape, metal, finish and partial upstands'},
  floorPlan:floor,unknown:{...unknown,foundationConnections:null,floorFallDatum:null,rubberTapeProduct:null,flashFoldApproval:null,glassTracks:null,guardUprights:null,
   postContinuousStockLengths:null,approvedCutCount:null}};
}

// One closed extruded ring per RHS, one concave closed polygon per angle.
export function balconyMemberGeometry(THREE,part){
 const {width:a,height:b,thickness:t}=part.section;
 if(!(part.length>0&&t>0&&2*t<Math.min(a,b)))throw Error('Invalid physical balcony section');
 const shape=new THREE.Shape();
 if(part.type==='rhs'){
  shape.moveTo(-a/2,-b/2);shape.lineTo(a/2,-b/2);shape.lineTo(a/2,b/2);shape.lineTo(-a/2,b/2);shape.closePath();
  const hole=new THREE.Path();hole.moveTo(-a/2+t,-b/2+t);hole.lineTo(-a/2+t,b/2-t);hole.lineTo(a/2-t,b/2-t);hole.lineTo(a/2-t,-b/2+t);hole.closePath();shape.holes.push(hole);
 }else if(part.type==='angle'){
  shape.moveTo(-a/2,-b/2);shape.lineTo(-a/2+t,-b/2);shape.lineTo(-a/2+t,b/2-t);
  shape.lineTo(a/2,b/2-t);shape.lineTo(a/2,b/2);shape.lineTo(-a/2,b/2);shape.closePath();
 }else throw Error('Unknown balcony section');
 const g=new THREE.ExtrudeGeometry(shape,{depth:part.length,bevelEnabled:false,steps:1,curveSegments:1});
 if(part.capLocalZ){const a=g.attributes.position;for(let i=0;i<a.count;i++){
  const cap=part.capLocalZ[a.getZ(i)<part.length/2?'start':'end'];a.setZ(i,cap.base+cap.u*a.getX(i)+cap.v*a.getY(i));
 }a.needsUpdate=true;g.computeVertexNormals();}
 g.computeBoundingBox();return g;
}
export function balconyMemberMatrix(THREE,part){
 if(part.basis){const m=new THREE.Matrix4().makeBasis(new THREE.Vector3(...part.basis.u),new THREE.Vector3(...part.basis.v),new THREE.Vector3(...part.basis.d));m.setPosition(...part.start);return m;}
 const direction=new THREE.Vector3(...part.end).sub(new THREE.Vector3(...part.start)).normalize();
 // All current source axes are orthogonal. Right-handed basis preserves winding.
 const u=Math.abs(direction.y)>.99?new THREE.Vector3(1,0,0):Math.abs(direction.x)>.99?new THREE.Vector3(0,0,-1):new THREE.Vector3(1,0,0);
 const v=new THREE.Vector3().crossVectors(direction,u),m=new THREE.Matrix4().makeBasis(u,v,direction);
 m.setPosition(...part.start);return m;
}
export function createBalconySteelMaterial(THREE){
 const m=new THREE.MeshStandardMaterial({color:'#333d41',roughness:.46,metalness:0});
 m.name='paintedMetal'; // Existing Blender role contract: coated_metal, no PURAL claim.
 m.userData={materialId:'BALCONY_STEEL_S355JR_C3',materialFamily:'coated_metal',source:balconySteelSource,approved:false,
  sourceFacts:{grade:'S355JR',environmentClass:'C3',primerMinimumMicrons:60,twoLayerTopcoatMicrons:160},
  opticalCandidate:{color:'#333d41',roughness:.46,metalness:0},unknown:{paintProduct:null,deliveredColor:null},
  finishAuthority:'source painted C3 steel identity; display tint and sharp section corners are candidates'};return m;
}
export function createBalconyDeckMaterial(THREE){
 const m=new THREE.MeshStandardMaterial({color:'#a1a7a3',roughness:.82,metalness:0});m.name='FC_CEMENT_PARTICLE_24';
 m.userData={materialId:'BALCONY_CEMENT_PARTICLEBOARD_24MM',materialFamily:'cement_particleboard',source:balconySteelSource,approved:false,
  sourceFacts:{material:'cement-particleboard',thickness:.024,requiredFinish:'slip-resistant polyurethane coating or analogue',
   rubberTape:[.0015,.050],edgeFlashingThickness:.0006},
  legacyUnusedHelper:true,canonicalFloorOwner:'balcony-floor.js',
  opticalCandidate:{color:'#a1a7a3',roughness:.82,basis:'illustrative board surface; completed coating appearance unresolved'},
  unknown:{boardProduct:null,coatingProduct:null,coatingThickness:null,orderedBoardCuts:null},
  finishAuthority:'source24mm cement-particleboard identity; illustrative unfinished display surface, no ordered product claim'};return m;
}
export function createBalconySteel(THREE,parent,{bay,balconyId,material,floorPlan}={}){
 const plan=planBalconySteel({bay,balconyId,floorPlan}),group=new THREE.Group();group.name=balconyId+'-STEEL';
 group.userData={balconySteel:true,balconyId,source:plan.source,sourceTopology:plan.sourceTopology,candidate:plan.candidate,unknown:plan.unknown,approved:false};parent.add(group);
 const mat=material||createBalconySteelMaterial(THREE);
 for(const part of plan.parts){
  const mesh=new THREE.Mesh(balconyMemberGeometry(THREE,part),mat);mesh.name=part.id;mesh.applyMatrix4(balconyMemberMatrix(THREE,part));
  mesh.castShadow=mesh.receiveShadow=true;mesh.userData={...part,balconySteel:true,materialKind:'coated_metal',
   preservePhysicalProfile:true,analyticVolumeM3:part.volume,sectionRadiiUnknown:true,
   component:{kind:'balcony-steel',title:`Сталь балкона · ${part.role}`,source:part.source,
    note:`S355JR / C3; ${Math.round(part.section.width*1000)}×${Math.round(part.section.height*1000)}×${Math.round(part.section.thickness*1000)}мм. ${part.candidate}`}};group.add(mesh);
 }
 return {group,plan};
}

// Candidate single deck mesh: notch post corners instead of allowing steel to
// occupy the24mm board. This does not dimension approved board manufacture.
export function balconyDeckGeometry(THREE,plan){
 return balconyFloorGeometry(THREE,plan.floorPlan.parts.find(p=>p.floorInspectionRole==='board'));
}
