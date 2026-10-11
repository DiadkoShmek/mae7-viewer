// Source: §5.7 / window schedule ark25 confirms three panes and ceramic
// spacers. ALL dimensions, spacer sections, seal chemistry and gas are unknown.
export const glazingSpec=Object.freeze({panes:[.004,.004,.004],gaps:[.010,.010],total:.032,
 spacerWidth:.006,secondarySealWidth:.003,primarySealThickness:.0005,gasketWidth:.002,
 source:'§5.7; арк25/PDF73: triple glazing / ceramic spacers',approved:false,
 unknown:{supplier:null,orderedComposition:null,spacerSection:null,sealChemistry:null,gas:null,coatings:null,thermalPerformance:null}});
const areaRing=(w,h,b)=>w*h-(w-2*b)*(h-2*b);
export function planGlazingUnit({windowId,leafId,width,height,back=-.084,cx=0,cy=0,variantId='source',inspectionRepresentation=false,quantityEligible=true,assemblyId=null,replacementStatus='source-scheduled',sourceFacts=null,source=glazingSpec.source,sourceConflict=null,compositionAuthority='source triple fact; exact composition candidate'}={}){
 const s=glazingSpec;
 if(!windowId||leafId===undefined||![width,height,back,cx,cy].every(Number.isFinite)||Math.min(width,height)<=.030)throw Error('Invalid canonical glazing unit');
 const unitId=`IGU-${windowId}-L${leafId}`,parts=[],voids=[];
 const add=(suffix,role,w,h,z,depth,border=0,material='glass',index=null)=>{
  const volume=(border?areaRing(w,h,border):w*h)*depth;
  parts.push({id:unitId+'-'+suffix,unitId,windowId,leafId,variantId,role,material,units:'m',geometry:{kind:border?'ring':'box',width:w,height:h,depth,border},
   position:[cx,cy,z+depth/2],assembledPosition:[cx,cy,z+depth/2],paneIndex:index,volume,area:role==='physical-pane'?w*h:null,
   physical:true,quantityEligible:quantityEligible&&!inspectionRepresentation,inspectionRepresentation,newStockPart:quantityEligible&&!inspectionRepresentation,assemblyId,replacementStatus,sourceConflict,compositionAuthority,approved:false,source,
   candidateComposition:'4/10/4/10/4mm; sections/seals display candidates, ordered composition unknown'});
 };
 let z=back;
 for(let i=0;i<3;i++){
  add('P'+(i+1),'physical-pane',width,height,z,.004,0,'glass',i);z+=.004;
  if(i===2)continue;
  const ow=width-2*s.secondarySealWidth,oh=height-2*s.secondarySealWidth,b=s.spacerWidth;
  add('SP'+(i+1),'ceramic-spacer',ow,oh,z+s.primarySealThickness,.009,b,'ceramic');
  add('SE'+(i+1)+'-INNER','primary-edge-seal',ow,oh,z,.0005,b,'seal');
  add('SE'+(i+1)+'-OUTER','primary-edge-seal',ow,oh,z+.0095,.0005,b,'seal');
  add('SE'+(i+1)+'-PERIMETER','secondary-edge-seal',width,height,z,.010,s.secondarySealWidth,'seal');
  voids.push({id:unitId+'-VOID'+(i+1),role:'cavity',physical:false,quantityEligible:false,material:null,
   bounds:{width:ow-2*b,height:oh-2*b,depth:.010},position:[cx,cy,z+.005],gas:null});z+=.010;
 }
 for(const [i,pz] of [[0,back],[1,back+.028]])add('G'+(i+1),'mount-gasket',width+.004,height+.004,pz,.004,.002,'seal');
 return {unitId,windowId,leafId,variantId,units:'m',width,height,back,front:back+s.total,parts,voids,inspectionRepresentation,quantityEligible:quantityEligible&&!inspectionRepresentation,newStockPart:quantityEligible&&!inspectionRepresentation,assemblyId,replacementStatus,sourceConflict,compositionAuthority,approved:false,
  sourceFacts:sourceFacts??{paneCount:3,spacerMaterial:'ceramic'},spec:s,glassVolume:3*width*height*.004,
  proxy:{id:unitId+'-OPTICAL',role:'runtime-proxy',physical:false,quantityEligible:false,quantity:0,representationOf:unitId,
   geometry:{kind:'box',width,height,depth:.0001},position:[cx,cy,back+s.total-.00005]}};
}

const caches=new WeakMap();
function resources(THREE){
 if(caches.has(THREE))return caches.get(THREE);
 const mats={
  glass:new THREE.MeshPhysicalMaterial({color:'#eef3f3',roughness:.025,transmission:.98,ior:1.5,thickness:.004,metalness:0,transparent:false}),
  proxy:new THREE.MeshPhysicalMaterial({color:'#e8eeee',roughness:.065,transmission:.90,ior:1.5,thickness:.032,metalness:0,transparent:false}),
  ceramic:new THREE.MeshStandardMaterial({color:'#8b8983',roughness:.94,metalness:0}),seal:new THREE.MeshStandardMaterial({color:'#283330',roughness:.88,metalness:0})};
 for(const [role,m] of Object.entries(mats)){m.name='IGU_'+role;m.userData={materialFamily:role==='proxy'?'glass':role,opticalRole:role==='glass'?'physical-pane':role==='proxy'?'runtime-proxy':null,
  source:glazingSpec.source,approved:false,candidateComposition:'4/10/4/10/4mm; optical values and seal sections unapproved'};}
 const cache={mats,geometries:new Map(),users:0};caches.set(THREE,cache);return cache;
}
export function createGlazingUnit(THREE,parent,options){
 const plan=planGlazingUnit(options),cache=resources(THREE);cache.users++;
 const group=new THREE.Group();group.name=plan.unitId;
 group.userData={glazingAssembly:true,unitId:plan.unitId,windowId:plan.windowId,leafId:plan.leafId,variantId:plan.variantId,units:'m',
  inspectionRepresentation:plan.inspectionRepresentation,quantityEligible:plan.quantityEligible,newStockPart:plan.newStockPart,assemblyId:plan.assemblyId,replacementStatus:plan.replacementStatus,sourceConflict:plan.sourceConflict,compositionAuthority:plan.compositionAuthority,sourceFacts:plan.sourceFacts,compositionCandidate:'4/10/4/10/4mm',approved:false};parent.add(group);
 const physical=new THREE.Group(),proxy=new THREE.Group();physical.name=plan.unitId+'-physical';proxy.name=plan.unitId+'-proxy';
 physical.userData={glazingRole:'physical-assembly',unitId:plan.unitId};proxy.userData={glazingRole:'runtime-proxy-group',unitId:plan.unitId};group.add(physical,proxy);
 function geometry(g){
  const key=JSON.stringify(g);if(cache.geometries.has(key))return cache.geometries.get(key);
  let geo;
  if(g.kind==='ring'){
   const path=(p,w,h)=>{p.moveTo(-w/2,-h/2);p.lineTo(w/2,-h/2);p.lineTo(w/2,h/2);p.lineTo(-w/2,h/2);p.closePath();};
   const shape=new THREE.Shape(),hole=new THREE.Path();path(shape,g.width,g.height);path(hole,g.width-2*g.border,g.height-2*g.border);shape.holes.push(hole);
   geo=new THREE.ExtrudeGeometry(shape,{depth:g.depth,bevelEnabled:false,steps:1});geo.translate(0,0,-g.depth/2);
  }else geo=new THREE.BoxGeometry(g.width,g.height,g.depth);
  geo.computeBoundingBox();cache.geometries.set(key,geo);return geo;
 }
 for(const part of plan.parts){
  const mesh=new THREE.Mesh(geometry(part.geometry),cache.mats[part.material]);mesh.position.fromArray(part.position);mesh.name=part.id;mesh.receiveShadow=part.material!=='glass';
  mesh.userData={...part,partId:part.id,glazingRole:part.role,detailRole:part.role==='mount-gasket'?'glazing-gasket':part.role,materialKind:part.material,opticalGlass:part.role==='physical-pane',explodeDirection:[0,0,1]};(part.role==='mount-gasket'?group:physical).add(mesh);
 }
 const p=plan.proxy,mesh=new THREE.Mesh(geometry(p.geometry),cache.mats.proxy);mesh.position.fromArray(p.position);mesh.name=p.id;
 mesh.userData={...p,partId:p.id,glazingRole:p.role,materialKind:'glass',opticalGlass:true,windowRole:'glazing',detailRole:'glazing',leaf:plan.leafId,
  approved:false,illustrative:true,assembledPosition:p.position};proxy.add(mesh);
 const showPhysical=options.showPhysical===true;physical.visible=showPhysical;proxy.visible=!showPhysical;
 let disposed=false;group.dispose=()=>{if(disposed)return;disposed=true;group.removeFromParent();group.clear();if(--cache.users===0){for(const g of cache.geometries.values())g.dispose();for(const m of Object.values(cache.mats))m.dispose();caches.delete(THREE);}};
 group.userData.glazingBounds={back:plan.back,front:plan.front,width:plan.width,height:plan.height};return {group,plan,physical,proxy,dispose:group.dispose};
}
export function setGlazingRepresentation(root,physical){root.traverse(o=>{if(o.userData.glazingRole==='physical-assembly')o.visible=!!physical;if(o.userData.glazingRole==='runtime-proxy-group')o.visible=!physical;});}
