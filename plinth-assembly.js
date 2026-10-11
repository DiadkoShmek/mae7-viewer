import {planPlinthAssembly,plinthFaces,plinthSpec,polygonArea,retainedCoreCutsForFace,subtractRetainedCoreSections} from './plinth-plan.js';
import {mergeGeometries} from './assets/BufferGeometryUtils.js';
import {createRetainedBasementWindow,createRetainedBasementGlassMaterial} from './basement-window.js';
import {entranceCentres,entranceSpec} from './entrance.js';
import {planJointBackings,createJointBackings} from './joint-backings.js';
import {drilledPlinthBoardGeometry} from './plinth-board-drilling.js';
export function plinthPartGeometry(THREE,p){
 if(p.layer===4)return drilledPlinthBoardGeometry(THREE,p);
 if(p.kind==='compound'){const geometries=p.geometryPieces.map(q=>{const g=plinthPartGeometry(THREE,q);if(q.kind==='profileX')g.translate(q.x0,0,0);return g;});const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!geometry)throw Error('Plinth compound geometry failed');return geometry;}
 if(p.kind==='contourZ'){const shape=new THREE.Shape();const ring=(path,ps)=>{ps.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));path.closePath();};ring(shape,p.outer);for(const ps of p.holes){const hole=new THREE.Path();ring(hole,ps);shape.holes.push(hole);}const geometry=new THREE.ExtrudeGeometry(shape,{depth:p.z1-p.z0,bevelEnabled:false,steps:1});geometry.translate(0,0,p.z0);return geometry;}
 const shape=new THREE.Shape();
 const section=p.kind==='profileX'?p.sectionYZ:p.sectionXZ;
 section.forEach(([a,b],i)=>i?shape.lineTo(a,b):shape.moveTo(a,b));shape.closePath();
 const depth=p.kind==='profileX'?p.x1-p.x0:p.y1-p.y0;
 const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});
 const pos=g.attributes.position;
 for(let i=0;i<pos.count;i++){
  const a=pos.getX(i),b=pos.getY(i),c=pos.getZ(i);
  if(p.kind==='profileX')pos.setXYZ(i,c,a,b);else pos.setXYZ(i,a,p.y0+c,b);
 }
 // X/Z -> X/Y/Z changes handedness for the vertical extrusion only.
 if(p.kind!=='profileX')for(const attribute of Object.values(g.attributes))for(let i=0;i<attribute.count;i+=3)for(let k=0;k<attribute.itemSize;k++){
  const a=attribute.array[(i+1)*attribute.itemSize+k];attribute.array[(i+1)*attribute.itemSize+k]=attribute.array[(i+2)*attribute.itemSize+k];attribute.array[(i+2)*attribute.itemSize+k]=a;
 }
 g.computeVertexNormals();return g;
}
export function createPlinthAssembly(THREE,parent,garden,{materials={},openings,height,patch}={}){
 const plan=planPlinthAssembly({openings,height,patch}),materialMap={...materials};
 for(const [role,color] of Object.entries({EPS_Perimeeter:'#edeedc',masonry:'#9b9f97',timber:'#b79362',galvanized:'#9ea9ad',FC_P070:'#676664',PURAL_dark:'#333d41'})){
  if(!materialMap[role]){const m=new THREE.MeshStandardMaterial({color,roughness:role==='galvanized'?.38:.85,metalness:role==='galvanized'?.65:0});m.name=role;materialMap[role]=m;}
 }
 const faceGroups=Object.fromEntries(plinthFaces.map(face=>{const g=new THREE.Group();g.name='plinth-'+face.code;g.position.fromArray(face.position);g.rotation.y=face.rotation;parent.add(g);return[face.code,g];}));
 function mesh(p,target,inspection=false){
  const m=new THREE.Mesh(plinthPartGeometry(THREE,p),materialMap[p.material]);m.name=p.sourcePartId+'-'+p.region;
  if(p.kind==='profileX')m.position.x=p.x0;
  if(inspection){m.position.x-=plan.patch.x;m.position.y-=plan.patch.y;m.position.z-=plan.layerOffsets[p.layer];}
  m.castShadow=m.receiveShadow=true;
  m.userData={assembly:'plinth',partId:p.id+'@'+p.region,sourcePartId:p.sourcePartId,geometryPartId:p.geometryPartId,region:p.region,layer:p.layer,system:'plinth',volume:p.volume,stockPart:false,
   authoring:{kind:p.kind,assembly:'plinth',source:p.source,approved:false,...(p.kind==='supportAngleY'?{originX:p.originX,y0:p.y0}: {})},...(p.kind==='supportAngleY'?{quantityEligible:false,quantity:0,candidate:p.candidate,rowStatus:p.rowStatus,timberId:p.timberId}:{}),sourceBlankId:p.sourceBlankId??null,sourceOriginalProfileId:p.sourceOriginalProfileId??null,apertureOperationsApproved:false,...(p.profileStatus?{profileStatus:p.profileStatus}:{}),
   component:{kind:'plinth',title:p.sourcePartId,source:p.source,note:p.kind==='supportAngleY'?'Кутик кріплення бруса. Контактний кандидат80/50/3/150мм; виріб, анкери та висотний крок потребують узгодження.':p.layer===4?'Фіброцемент8мм. Розкладка — кандидат до обміру.':p.layer===3?'Відкритий профіль25мм; точний переріз, кріплення й проходження повітря не підтверджені.':'VS-1 · номінальний пакет183мм. Графічні прорізи збережених вікон; обміри, посадку й тонку зону звірити.'}};
  target.add(m);return m;
 }
 for(const p of plan.outside)mesh(p,faceGroups[p.face]);
 const plinthCover=new THREE.Group();plinthCover.name='plinth-physical-patch';faceGroups[plan.patch.face].add(plinthCover);for(const p of plan.cover)mesh(p,plinthCover);
 const face=plinthFaces.find(f=>f.code===plan.patch.face),local=new THREE.Vector3(plan.patch.x,plan.patch.y,0).applyAxisAngle(new THREE.Vector3(0,1,0),face.rotation);
 const plinthCut=new THREE.Group();plinthCut.name='plinth-inspection';plinthCut.position.fromArray(face.position).add(local);plinthCut.rotation.y=face.rotation;plinthCut.userData.inspectionFace=face.code;parent.add(plinthCut);
 const plinthGroups=plan.layerOffsets.map((z,i)=>{const g=new THREE.Group();g.position.z=z;g.userData={layer:i,system:'plinth'};plinthCut.add(g);return g;});
 for(const p of plan.inspection)mesh(p,plinthGroups[p.layer],true);
 for(const face of plinthFaces){
  const parts=plan.physicalParts.filter(p=>p.face===face.code&&p.layer===4&&p.outer).map(p=>({outer:p.outer.map(a=>a.map(v=>v*1000)),holes:p.holes.map(r=>r.map(a=>a.map(v=>v*1000)))}));
  const openings=plan.retainedOpenings.filter(p=>p.face===face.code).map(p=>({x:p.x0*1000,y:p.y0*1000,width:(p.x1-p.x0)*1000,height:(p.y1-p.y0)*1000}));
  if(face.code==='SE')for(const x of entranceCentres)openings.push({x:(x-entranceSpec.doorWidth/2-entranceSpec.openingFit)*1000,y:(entranceSpec.threshold-entranceSpec.thresholdProfile)*1000,width:(entranceSpec.doorWidth+2*entranceSpec.openingFit)*1000,height:(entranceSpec.doorHeight+entranceSpec.thresholdProfile)*1000});
  const tape=planJointBackings(parts,{openings,bounds:{x:-(face.width/2+.175)*1000,y:-plan.spec.height*1000,width:(face.width+.350)*1000,height:(plan.spec.height-.020)*1000}});
  createJointBackings(THREE,faceGroups[face.code],tape,{z:.175,name:'plinth-'+face.code+'-black-joint-backing'});
 }
 const basementMaterials={white:new THREE.MeshStandardMaterial({color:'#e6e7e2',roughness:.42}),sideFC:materialMap.FC_P070,headInsulation:new THREE.MeshStandardMaterial({color:'#d2d2aa',roughness:1}),seal:new THREE.MeshStandardMaterial({color:'#282c2b',roughness:.8}),metal:materialMap.PURAL_dark,glass:createRetainedBasementGlassMaterial(THREE)};
 const basementWindows=plan.retainedOpenings.map(opening=>createRetainedBasementWindow(THREE,faceGroups[opening.face],opening,{materials:basementMaterials}));
 // Separate source apron from presentation ground.600mm/2%/2m are sourced;
 // concrete100mm display thickness, datum and cuts around entrances unknown.
 const s=plinthSpec,concrete=new THREE.MeshStandardMaterial({color:'#b8b5aa',roughness:.94});concrete.name='apron_concrete';
 for(const face of plinthFaces){
  const g=new THREE.Group();g.position.fromArray(face.position);g.rotation.y=face.rotation;garden.add(g);
  const inner=.183,outer=inner+s.apronWidth,length=face.width+2*outer,count=Math.ceil(length/s.apronJointPitch),pitch=length/count;
  for(let i=0;i<count;i++){
   const a=-length/2+i*pitch+(i?s.apronJointWidth/2:0),b=-length/2+(i+1)*pitch-(i<count-1?s.apronJointWidth/2:0);
   const poly=[[-face.width/2-inner,inner],[face.width/2+inner,inner],[face.width/2+outer,outer],[-face.width/2-outer,outer]];
   const clip=(ps,edge,sign,axis=0)=>{const out=[];for(let j=0;j<ps.length;j++){const p=ps[j],q=ps[(j+1)%ps.length],u=sign*(p[axis]-edge),v=sign*(q[axis]-edge);if(u<=1e-12)out.push(p);if((u<0&&v>0)||(u>0&&v<0)){const f=u/(u-v);out.push(p.map((v,k)=>v+f*(q[k]-v)));}}return out;};
   let sections=[clip(clip(poly,a,-1),b,1)];
   if(face.code==='SE')for(const cut of plan.apron.landingExclusions)sections=sections.flatMap(ps=>{
    const mid=clip(clip(ps,cut.x0,-1),cut.x1,1);
    return [clip(ps,cut.x0,1),clip(ps,cut.x1,-1),clip(mid,cut.z0,1,1),clip(mid,cut.z1,-1,1)].filter(ps=>ps.length>=3);
   });
   sections=subtractRetainedCoreSections(sections,retainedCoreCutsForFace(face));
   for(const sectionXZ of sections){if(sectionXZ.length<3||polygonArea(sectionXZ)<1e-12)continue;
   const p={kind:'prismY',sectionXZ,y0:-s.height-s.apronGap-s.apronThicknessCandidate,y1:-s.height-s.apronGap};
   const geo=plinthPartGeometry(THREE,p),pos=geo.attributes.position;
   for(let j=0;j<pos.count;j++)pos.setY(j,pos.getY(j)-(pos.getZ(j)-inner)*s.apronSlope);geo.computeVertexNormals();
   const m=new THREE.Mesh(geo,concrete);m.receiveShadow=true;m.castShadow=true;m.userData={assembly:'apron',component:{kind:'apron',title:'Відмостка · 600 мм / ≥2%',source:'§5.2; PDF58/node10',note:'Шви до 2 м; падіння 12 мм на 600. Висоти, товщина бетону та примикання до сходів — кандидат до обміру. Зазор 20 мм до FC має невирішене узгодження.'}};g.add(m);
   }
  }
 }
 for(const p of plan.apron.landingExclusions){
  const m=new THREE.Mesh(new THREE.BoxGeometry(p.x1-p.x0,p.top-p.bottom,p.z1-p.z0),concrete);
  m.position.set((p.x0+p.x1)/2,(p.bottom+p.top)/2,5.405+(p.z0+p.z1)/2);m.receiveShadow=m.castShadow=true;
  m.userData={assembly:'apron',partId:p.id,approved:false,component:{kind:'entrance-ground-contact',title:'Контакт майданчика з ґрунтом · кандидат',source:'Геометрія входу / спільний умовний репер',note:'Нижня зона до умовного ґрунту; не обмір фундаменту. Відмостка виключена з цього контуру. Основа й робоче примикання потребують огляду.'}};garden.add(m);
 }
 return {plinthCut,plinthGroups,plinthCover,plinthOffsets:plan.layerOffsets,plinthPlan:plan,basementWindows,plinthFaceGroups:faceGroups};
}
