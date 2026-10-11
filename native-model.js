import {separatePlinthSupportInspection} from './plinth-support-inspection.js';
import {addPanelScrews} from './panel-screws.js';
import * as THREE from 'three';
import {GLTFLoader} from './assets/GLTFLoader.js';
import {loadNativeTransport} from './native-transport.js';
import {requestAsset,decodeAsset} from './asset-request.js';
import {layoutFor} from './facade-layouts.js';
import {gableLayout} from './gables.js';
import {origin} from './model.js';
import {createFacadeSystem} from './facade-system.js';
import {planWindowDetail} from './window-detail.js';
import {panelContourGeometry} from './panel-contour-geometry.js';
import {panelDrilling,planPanelDrilling} from './panel-drilling.js';
import {panelMaterialRectangles} from './panel-blank-shapes.js';
import {layoutOptions} from './layout-options.js';
import {visualPanelLayout,samePanelLayout,samePanelPart} from './visual-panel-layout.js';
import {fcGrainCode,applyFibreSurfaceUV,setInstanceFibreGrain,createInstanceFibreMaterial} from './fc-surface-uv.js';
import {createInspectionStage} from './inspection-stage.js';
import {createWindowPanelInspection} from './window-panel-inspection.js';
import {planPlinthAssembly} from './plinth-plan.js';
import {resolvePlinthSelection,collectNativePlinthBores} from './plinth-selection.js';
import {resolveRetainedReturnSelection} from './retained-return-drawing.js';
import {resolveRoofEdgeSelection} from './roof-edge-drawing.js';
import {resolveRoofLathSelection} from './roof-lath-review.js';
import {resolveBalconyGuardSelection} from './balcony-cut-report.js';
import {resolveOpeningDimensions,resolveBalconyOpeningPair} from './opening-dimensions.js';
import {endWallSpec,endWallFrame} from './end-wall-plan.js';

const staticLayerOwners=new WeakMap();
const staticBalconyOwners=new WeakMap();
const componentInstanceOwners=new WeakMap();
const openingOwnerBounds=new WeakMap();
const nativePlinthBores=new WeakMap();
let physicalPlinthPlan;

// The site consumes Blender's exported model. Only changing layout candidates
// produces a computational overlay; it does not redefine the native building.
export async function loadNativeModel(scene,{assetVersion='',onProgress=()=>{}}={}){
 const suffix=assetVersion?'?v='+encodeURIComponent(assetVersion):'';
 const bindings=requestAsset('./assets/mae7-bindings.json.gz'+suffix).then(decodeAsset).catch(error=>{
  if(error.status!==404)throw error;return requestAsset('./assets/mae7-bindings.json'+suffix);
 });
 const [gltf,bindingBytes]=await Promise.all([loadNativeTransport(new GLTFLoader(),{suffix,compressedBuffers:true,onProgress}),bindings]);
 const nativeScene=gltf.scene;
 // Retain the authored scene, not GLTFParser and its decoded source caches.
 // Inspection closures otherwise keep every import buffer/JSON alive forever.
 const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bindingBytes)),objects=readNativeObjects(nativeScene);
 physicalPlinthPlan??=planPlinthAssembly();
 const plinthBores=collectNativePlinthBores([...objects.values()].map(o=>o.userData),physicalPlinthPlan);
 for(const owner of objects.values())if(plinthBores.has(owner.userData.sourcePartId))nativePlinthBores.set(owner,plinthBores.get(owner.userData.sourcePartId));
 // The native export contains the same solid geometry. On screen, repeated
 // screws use GPU instances under the identical visibility/motion owner.
 for(const id of data.screwBatches??[]){const owner=objects.get(id);if(!owner?.userData.screwCentres)throw Error('Missing native screw batch '+id);
  const surfaces=owner.children.filter(o=>o.isMesh);if(surfaces.length!==1)throw Error('Ambiguous native screw surface '+id);
  const source=surfaces[0];if(source.isInstancedMesh){source.raycast=()=>{};source.castShadow=false;continue;}addPanelScrews(THREE,owner,null,{centres:owner.userData.screwCentres,normal:owner.userData.screwNormal,material:source.material});source.removeFromParent();source.geometry.dispose();
 }
 const screwSurfaces=[];nativeScene.traverse(o=>{if(o.isMesh&&o.parent?.userData.representation==='panel-screws'){o.computeBoundingBox?.();screwSurfaces.push({mesh:o,bounds:o.boundingBox?.clone()??o.geometry.boundingBox.clone()});}});
 const screwWorldBox=new THREE.Box3(),screwCamera=new THREE.Vector3(),screwNearest=new THREE.Vector3();
 // Runtime yard replaces only the auxiliary presentation plane.
 const groundOwners=new Set([...objects].filter(([,o])=>o.userData.presentationGround).map(([id])=>id));
 for(const id of groundOwners)objects.get(id).visible=false;
 // Blender consolidates this two-triangle helper under the scene root. The
 // semantic empty alone cannot hide its actual draw surface.
 nativeScene.traverse(o=>{
  if(!o.isMesh||!o.userData.source_members_json)return;
  const members=JSON.parse(o.userData.source_members_json);
  if(members.length&&members.every(id=>groundOwners.has(id))){o.visible=false;o.userData.presentationGround=true;}
 });
 const get=id=>{const o=objects.get(id);if(!o)throw Error('Missing native binding '+id);return o;},b=data.bindings;
 const model={};for(const key of ['building','garden','patch','patchWindow','fieldPatch','fieldWindow','roofCut','plinthCut','normalPatchWindow','roofCovers','plinthCover'])model[key]=get(b[key]);
 model.updateScrewVisibility=camera=>{camera.getWorldPosition(screwCamera);let visible=0;for(const {mesh,bounds} of screwSurfaces){mesh.updateWorldMatrix(true,false);screwWorldBox.copy(bounds).applyMatrix4(mesh.matrixWorld);screwWorldBox.clampPoint(screwCamera,screwNearest);mesh.visible=screwNearest.distanceToSquared(screwCamera)<=144&&!mesh.userData.inspectionContext;if(mesh.visible)visible++;}return visible;};
 for(const key of ['layerGroups','fieldLayerGroups','roofGroups','plinthGroups'])model[key]=b[key].map(get);
 model.plinthGroups.forEach((group,i)=>Object.assign(group.userData,{layer:i,system:'plinth'}));
 Object.assign(model,{panelRecords:data.panelRecords,roofOffsets:data.roofOffsets,plinthOffsets:data.plinthOffsets});
 const facades=Object.fromEntries(Object.entries(b.facadeGroups).map(([code,id])=>[code,get(id)]));
 const systems=Object.fromEntries(Object.entries(b.facadeSystems).map(([code,ids])=>[code,ids.map(get)]));
 const nativePanels=Object.fromEntries(Object.entries(facades).map(([code,g])=>[code,g.children.filter(o=>o.userData.panelFacade||o.userData.gableFacade||o.userData.representation==='user-nine-hole-pattern-markers'||o.userData.representation==='panel-screws')]));
 const overlays=new Map(),supportOverlays=new Map(),materials=new Map();
 const canonicalLayouts=Object.fromEntries(Object.keys(facades).map(code=>[code,layoutFor(code,data.defaultLayouts[code])]));
 const authoredPanelRecords=structuredClone(data.panelRecords);
 const activeLayouts=structuredClone(canonicalLayouts);
 const nativeWholePanels=new Map(),nativeGableOwners=new Map();
 for(const [code,list] of Object.entries(nativePanels))for(const owner of list){
  if(owner.userData.panelFacade===code&&!owner.userData.panelProjection)for(const p of owner.userData.panelRecords??[]){
   if(nativeWholePanels.has(p.id))throw Error('Duplicate native whole panel '+p.id);
   nativeWholePanels.set(p.id,{...structuredClone(p),ownerId:owner.userData.native_id,ownerKind:'native',approved:false,quantityEligible:false});
  }
  if(owner.userData.component?.kind==='gable-panel'){
   const id=owner.userData.component.title.split(' ')[0];
   if(nativeGableOwners.has(id))throw Error('Duplicate native gable '+id);
   nativeGableOwners.set(id,owner.userData.native_id);
  }
 }
 let facadeRevision=0;
 model.getFacadeModelSnapshot=()=>{
  const parts=[],gableLayouts={};
  for(const [code,layout] of Object.entries(activeLayouts)){
   const native=isNativeLayout(code,layout);
   const drilling=native?null:layout.cutPolicy==='notched-study'?new Map(planPanelDrilling(layout).parts.map(({panelId,...p})=>[panelId,p])):null;
   for(const p of layout.parts){
    const actual=native?nativeWholePanels.get(p.id):null;
    if(native&&(!actual||!samePanelPart(p,actual)))throw Error('Native whole panel binding changed '+p.id);
    parts.push(actual?structuredClone(actual):{...structuredClone(p),...(drilling?{drilling:drilling.get(p.id)}:{}),ownerId:'runtime-'+code+'-'+facadeRevision+'-'+p.id,ownerKind:'runtime-layout',approved:false,quantityEligible:false});
   }
   if(['SW','NE'].includes(code)&&!layout.fullEndWall){
    const gable=gableLayout(code,layout.module,layout.offset,{panelHeight:layout.panelHeight});gableLayouts[code]=gable;
    for(const p of gable.parts){
     const ownerId=native?nativeGableOwners.get(p.id):'runtime-'+code+'-'+facadeRevision+'-'+p.id;
     if(!ownerId)throw Error('Native gable owner missing '+p.id);
     parts.push({...structuredClone(p),gable:true,ownerId,ownerKind:native?'native':'runtime-layout',approved:false,quantityEligible:false});
    }
   }
  }
  return {schema:'mae7-current-facade-panels-v1',revision:facadeRevision,layouts:structuredClone(activeLayouts),gableLayouts,parts,approved:false,quantityAuthority:false};
 };

 function isNativeLayout(code,layout){
  const native=canonicalLayouts[code];
  if(!samePanelLayout(layout,native))return false;
  if(native.cutPolicy==='notched-study'){
   const authored=authoredPanelRecords.filter(p=>p.facade===code);
   if(authored.length!==native.parts.length||!native.parts.every((p,i)=>samePanelPart(p,authored[i])))return false;
  }
  return true;
 }
 nativeScene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.set(m.name,m);});
 const p222=[...materials.values()].filter(m=>/FC_P222_\d+(?:$|_)/i.test(m.name)).sort((a,b)=>Number(a.name.match(/FC_P222_(\d+)/)?.[1]||0)-Number(b.name.match(/FC_P222_(\d+)/)?.[1]||0)),p070=[...materials.values()].find(m=>/FC_P070/i.test(m.name));
 if(!p222.length||!p070)throw Error('Native panel material roles missing');
 const detailOverlays=new Map();
 function clearDetailOverlay(group){
  const state=detailOverlays.get(group);if(!state)return;
  for(const child of state.original)child.visible=state.visibility.get(child);
  if(state.dispose){state.dispose();detailOverlays.delete(group);return;}
  const ownedMaterials=new Set();state.overlay.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.dispose?.();if(o.material.userData.candidateMetricFibreUV||o.material.userData.candidateMarkerOwnedMaterial||o.material.userData.candidateScrewOwnedMaterial)ownedMaterials.add(o.material);}});for(const m of ownedMaterials)m.dispose();state.overlay.removeFromParent();detailOverlays.delete(group);
 }
 function detailPrism(r){
  const points=r.profileYZ,n=points.length,left=r.x/1000,right=(r.x+r.width)/1000,vertices=[];
  const p=(side,i)=>[side?right:left,...points[i]],triangle=(a,b,c)=>vertices.push(...a,...b,...c);
  for(let i=1;i<n-1;i++){triangle(p(0,0),p(0,i+1),p(0,i));triangle(p(1,0),p(1,i),p(1,i+1));}
  for(let i=0;i<n;i++){const j=(i+1)%n;triangle(p(0,i),p(0,j),p(1,j));triangle(p(0,i),p(1,j),p(1,i));}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
 }
 function prepareDetailSurround(layout){
  const options={surroundingLayout:{layout,centre:{x:origin.x*1000+layout.width/2,y:origin.y*1000}}};
  return [planWindowDetail({...options,revealMode:'source'}),planWindowDetail({...options,revealMode:'field'})];
 }
 function updateDetailSurround(layout,plans){
  const isDefault=isNativeLayout('SE',layout);
  for(const [index,groups] of [model.layerGroups,model.fieldLayerGroups].entries())for(const i of [6,7,8]){
   const group=groups[i];clearDetailOverlay(group);if(isDefault&&i!==8)continue;
   const original=[...group.children],visibility=new Map(original.map(o=>[o,o.visible]));let nativeMaterial;
   if(i===8){
    const view=createWindowPanelInspection(THREE,plans[index],{P222:p222,P070:p070});
    original.filter(o=>!o.element).forEach(o=>o.visible=false);group.add(view.root);
    detailOverlays.set(group,{original,visibility,overlay:view.root,dispose:view.dispose});continue;
   }
   group.traverse(o=>{if(o.isMesh&&!nativeMaterial)nativeMaterial=o.material;});
   const overlay=new THREE.Group();overlay.userData={detailSurroundOverlay:true,layer:i,system:'facade'};
   for(const batch of plans[index].layers[i].batches){
    if(!batch.rectangles.length)continue;
    const variant=batch.materialVariant??((batch.panelRecords?.[0]?.cell??0)%p222.length);
    const material=i===8?createInstanceFibreMaterial(THREE,batch.colour==='P070'?p070:p222[variant],[origin.x,origin.y,0]):nativeMaterial;
    const boxes=batch.rectangles.filter(r=>!r.profileYZ),dummy=new THREE.Object3D();
    const metadata={layer:i,system:'facade',materialKind:batch.kind,candidateOverlay:true,approved:false,...(i===8?{panelProjection:true}:{})};
    const records=rs=>rs.map(r=>({...r.panelRecord,detailProjection:{x:r.x,y:r.y,width:r.width,height:r.height}}));
    if(boxes.length){const geometry=new THREE.BoxGeometry(1,1,1);if(i===8)setInstanceFibreGrain(THREE,geometry,boxes.map(r=>r.panelRecord.grain));const mesh=new THREE.InstancedMesh(geometry,material,boxes.length);boxes.forEach((r,j)=>{dummy.position.set((r.x+r.width/2)/1000,(r.y+r.height/2)/1000,batch.z+batch.depth/2);dummy.scale.set(r.width/1000,r.height/1000,batch.depth);dummy.updateMatrix();mesh.setMatrixAt(j,dummy.matrix);});mesh.userData={...metadata,...(i===8?{panelRecords:records(boxes)}:{})};mesh.receiveShadow=true;overlay.add(mesh);}
    for(const r of batch.rectangles.filter(r=>r.profileYZ)){const geometry=detailPrism(r);if(i===8)applyFibreSurfaceUV(THREE,geometry,r.panelRecord.grain,[origin.x,origin.y,0]);const mesh=new THREE.Mesh(geometry,material);mesh.userData={...metadata,...(i===8?{panelRecords:records([r])}:{})};mesh.receiveShadow=true;overlay.add(mesh);}
   }
   if(i===8&&plans[index].fasteners)addPanelScrews(THREE,overlay,plans[index].fasteners,{z:.008});
   original.filter(o=>!o.element).forEach(o=>o.visible=false);group.add(overlay);detailOverlays.set(group,{original,visibility,overlay});
  }
 }
 updateDetailSurround(activeLayouts.SE,prepareDetailSurround(activeLayouts.SE));
 model.getWindowPanelInspection=()=>{
  const view=model.layerGroups[8].children.find(o=>o.userData.windowPanelInspection);
  return {focusedPartIds:[...view.userData.focusedPartIds],sourcePartIds:[...view.userData.sourcePartIds],newStockParts:false,quantity:0};
 };
 let inspecting=false,revealMode='field',inspectionMode='building';
 const inspectionStage=createInspectionStage(nativeScene,{context:true,opacity:.025});
 const inspectionRoot=()=>inspectionMode==='roof'?model.roofCut:inspectionMode==='plinth'?model.plinthCut:revealMode==='field'?model.fieldPatch:model.patch;
 const refreshStage=()=>{if(inspectionMode!=='building')inspectionStage.refresh();};
 model.setRevealMode=mode=>{if(!['source','field'].includes(mode))throw Error('Unknown reveal mode');inspectionStage.restore();revealMode=mode;model.patch.visible=inspecting&&mode==='source';model.fieldPatch.visible=inspecting&&mode==='field';if(inspectionMode!=='building')inspectionStage.show([inspectionRoot()]);return {patch:mode==='field'?model.fieldPatch:model.patch,window:mode==='field'?model.fieldWindow:model.patchWindow,groups:mode==='field'?model.fieldLayerGroups:model.layerGroups};};
 function clearOverlay(code){supportOverlays.get(code)?.dispose();supportOverlays.delete(code);const group=overlays.get(code);if(!group)return;const ownedMaterials=new Set();group.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.dispose?.();if(o.material.userData.candidateMetricFibreUV||o.material.userData.candidateMarkerOwnedMaterial||o.material.userData.candidateScrewOwnedMaterial)ownedMaterials.add(o.material);}});for(const m of ownedMaterials)m.dispose();group.removeFromParent();overlays.delete(code);}
 function overlay(code,layout){
  for(const part of layout.parts)fcGrainCode(part.grain);
  // Reviewing the authored grid retains Blender's actual bevelled boards and
  // supports. Only an explicitly changed whole-facade layout needs overlays.
  if(isNativeLayout(code,layout)){clearOverlay(code);nativePanels[code].forEach(o=>o.visible=true);return;}
  // Reject an impossible support phase before discarding the visible model.
  const supports=createFacadeSystem(THREE,facades[code],code,{layout,supportAlignment:layout.cutPolicy==='notched-study'?'user-nine-hole':'panel-joints',layerIndices:[6,7]});
  clearOverlay(code);nativePanels[code].forEach(o=>o.visible=false);for(const g of supports.groups)if(g)g.position.x=layout.localCentre??0;supportOverlays.set(code,supports);
  const group=new THREE.Group();group.position.x=layout.localCentre??0;facades[code].add(group);overlays.set(code,group);
  if(layout.cutPolicy==='notched-study'){
   const study=layout.parts; // The native inspection bay owns its own cut geometry.
   const screwPoints=[];
   for(const part of study){const drilling=panelDrilling(part,(supports.fasteners?.points??[]).filter(h=>h.panelId===part.id));screwPoints.push(...drilling.points);const mesh=new THREE.Mesh(panelContourGeometry(THREE,part,layout.width,{drills:drilling.points}),part.colour==='P070'?p070:p222[part.cell%p222.length]);mesh.userData={panelFacade:code,panelRecords:[{...part,drilling}],candidateOverlay:true,notchedStudy:true,approved:false,readyToCut:false,quantityEligible:false};mesh.receiveShadow=true;group.add(mesh);}
   if(screwPoints.length)addPanelScrews(THREE,group,{width:layout.width,points:screwPoints});
  }
  const batches=new Map();
  for(const part of layout.cutPolicy==='notched-study'?[]:layout.parts){const original=[part.x/1000-layout.width/2000,part.y/1000,(part.x+part.width)/1000-layout.width/2000,(part.y+part.height)/1000];const pieces=[original];const material=part.colour==='P070'?p070:p222[part.cell%p222.length];const list=batches.get(material)||[];for(const r of pieces)list.push({r,record:{...part,module:layout.module,scope:layout.scope}});batches.set(material,list);}
  const dummy=new THREE.Object3D();
  for(const [material,list] of batches){const geometry=new THREE.BoxGeometry(1,1,1);setInstanceFibreGrain(THREE,geometry,list.map(p=>p.record.grain));const mesh=new THREE.InstancedMesh(geometry,createInstanceFibreMaterial(THREE,material),list.length);list.forEach(({r},i)=>{dummy.position.set((r[0]+r[2])/2,(r[1]+r[3])/2,.025);dummy.scale.set(r[2]-r[0],r[3]-r[1],.008);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.userData={panelFacade:code,panelRecords:list.map(p=>p.record),candidateOverlay:true};mesh.receiveShadow=true;group.add(mesh);}
  if((code==='SW'||code==='NE')&&!layout.fullEndWall)for(const p of gableLayout(code,layout.module,layout.offset,{panelHeight:layout.panelHeight}).parts){const shape=new THREE.Shape();p.points.forEach((v,i)=>i?shape.lineTo(v[0]/1000-5.62,v[1]/1000+8.525):shape.moveTo(v[0]/1000-5.62,v[1]/1000+8.525));shape.closePath();for(const ring of p.holes??[]){const h=new THREE.Path();ring.forEach((v,i)=>i?h.lineTo(v[0]/1000-5.62,v[1]/1000+8.525):h.moveTo(v[0]/1000-5.62,v[1]/1000+8.525));h.closePath();shape.holes.push(h);}const mesh=new THREE.Mesh(applyFibreSurfaceUV(THREE,new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:false}).translate(0,0,.021),p.grain),p222[p.cell%p222.length]);mesh.userData={gableFacade:code,component:{kind:'gable-panel',title:p.id,source:'Арк.06 / варіант розкладки',note:'Профільована заготовка; перевірити робочий вузол і крайові відстані.'}};mesh.receiveShadow=true;group.add(mesh);}
 }
 model.updateFacade=layout=>{const code=layout.facade||'SE';if(!facades[code])throw Error('Unknown facade');layout=structuredClone(layout);if(layout.cutPolicy==='notched-study'&&(!layout.visualPanelAccounting||layout.localJointTopology))layout=visualPanelLayout(layout);const detailPlans=code==='SE'?prepareDetailSurround(layout):null;overlay(code,layout);if(detailPlans)updateDetailSurround(layout,detailPlans);activeLayouts[code]=structuredClone(layout);facadeRevision++;for(let i=model.panelRecords.length-1;i>=0;i--)if(model.panelRecords[i].facade===code)model.panelRecords.splice(i,1);model.panelRecords.push(...layout.parts.map(p=>({...p,module:layout.module,scope:layout.scope})));return layout.parts.map(p=>p.id);};
 model.setInspection=mode=>{
  if(!['building','layers','detail','roof','plinth'].includes(mode))throw Error('Unknown inspection mode');
  inspectionStage.restore();inspectionMode=mode;
  const next=mode==='detail'||mode==='layers';inspecting=next;
  // Mode changes move only the authored inspection bay. The complete facade
  // is translucent context; rebuilding hundreds of drilled boards is unused.
  for(const {id,x,s} of b.rainwaterGroups)get(id).visible=!(next&&s===1&&Math.abs(x-origin.x)<1.9);
  model.patch.visible=next&&revealMode==='source';model.fieldPatch.visible=next&&revealMode==='field';model.normalPatchWindow.visible=!next;model.roofCut.visible=mode==='roof';model.roofCovers.visible=mode!=='roof';model.plinthCut.visible=mode==='plinth';model.plinthCover.visible=mode!=='plinth';model.building.traverse(o=>{if(o.userData.plinthFullEnd==='SW')o.visible=mode!=='plinth';});
  if(mode!=='building')inspectionStage.show([inspectionRoot()]);
 };
 model.setFacadeLayers=(mode,amount,visible)=>{
  // Only the source-bound inspection bay moves. The surrounding house stays
  // assembled and is rendered as transparent context by inspectionStage.
  const full=false;
  for(const [code,groups] of Object.entries(systems)){
   groups.forEach((g,i)=>{g.visible=mode!=='detail'&&(full?visible[i]:i===0||i===7)&&!(i>=6&&supportOverlays.has(code));g.position.z=g.userData.nominalZ+i*.24*(full?amount/100:0);});
   supportOverlays.get(code)?.setState({enabled:mode!=='detail',explode:full?amount/100:0,visible:full?visible.slice(0,8):Array.from({length:8},(_,i)=>i===0||i===7)});
   const panelObjects=overlays.has(code)?[overlays.get(code)]:nativePanels[code];
   for(const mesh of panelObjects){mesh.visible=full?visible[8]:true;mesh.position.z=full?8*.24*amount/100:0;}
  }
  refreshStage();
 };
 scene.add(nativeScene);scene.updateMatrixWorld(true);
 // Keep each entrance as one selectable source assembly, including small
 // handles and flashing. Its parts may later need their original transforms.
 model.entrances=[...objects.values()].filter(o=>o.userData.component?.kind==='entrance')
  .sort((a,c)=>a.getWorldPosition(new THREE.Vector3()).x-c.getWorldPosition(new THREE.Vector3()).x)
  .map((owner,i)=>{owner.userData.entranceIndex=i+1;return {id:owner.userData.native_id,index:i+1,owner,bounds:new THREE.Box3().setFromObject(owner)};});
 // Keep the canonical floor parts beneath their BAL owner for picking and
 // inspection. Static instances cannot retain a moving assembly's subtree.
 model.balconies=[...objects.values()].filter(o=>o.userData.component?.kind==='balcony'&&/^BAL-\d{2}$/.test(o.userData.balconyId))
  .map(owner=>({id:owner.userData.balconyId,owner,bounds:new THREE.Box3().setFromObject(owner)}));
 // Physical glazing survives as its authored subtree, including hidden panes.
 // A proxy is an optical representation, never an extra stock assembly.
 setNativeGlazingInspection(nativeScene,false);
 const glazingGasketBatchResult=batchGlazingMountGaskets(nativeScene);
 model.setGlazingInspection=(enabled,options={})=>setNativeGlazingInspection(nativeScene,enabled,options);
 const batchResult=batchNativeComponents(model.building,[model.patch,model.normalPatchWindow,model.roofCut,model.roofCovers,model.plinthCut,model.plinthCover,...model.entrances.map(e=>e.owner),...model.balconies.map(e=>e.owner),...b.rainwaterGroups.map(({id})=>get(id))]);
 const staticLayerBatchResult=batchNativeStaticLayers(model.building,[model.roofCut,model.plinthCut]);
 model.staticLayerBatches=staticLayerBatchResult.batches;
 Object.assign(model,bindEntranceInspection(model.entrances));
 Object.assign(model,bindBalconyInspection(model.balconies));
 const balconyBatchResult={sourceMeshes:0,representedMeshes:0,instanceBatches:0,drawsSaved:0};
 Object.assign(model,bindRoofInspection(model.roofCut,model.roofGroups));
 Object.assign(model,bindPlinthInspection(model.plinthCut,model.plinthGroups));
 const facadePoses=new Map([...model.layerGroups,...model.fieldLayerGroups].map(g=>[g,g.position.clone()]));
 const facadePose=(group,index,spread)=>facadePoses.get(group).clone().add(new THREE.Vector3(0,-index*.10*spread/100,index*.43*spread/100));
 model.setFacadeSpread=(spread,visible)=>{
  if(!Number.isFinite(spread)||spread<0||spread>100||visible?.length!==9)throw Error('Invalid facade spread');
  const groups=revealMode==='field'?model.fieldLayerGroups:model.layerGroups;
  groups.forEach((group,i)=>{group.position.copy(facadePose(group,i,spread));group.visible=!!visible[i];});
 };
 const meshBounds=(group,excluded=[])=>{
  group.updateWorldMatrix(true,true);const result=new THREE.Box3();
  group.traverse(mesh=>{
   if(!mesh.isMesh)return;for(let p=mesh;p&&p!==group;p=p.parent)if(!p.visible||excluded.includes(p))return;
   if(mesh.isInstancedMesh)mesh.computeBoundingBox();else mesh.geometry.computeBoundingBox();
   const box=mesh.isInstancedMesh?mesh.boundingBox:mesh.geometry.boundingBox;if(box)result.union(box.clone().applyMatrix4(mesh.matrixWorld));
  });return result;
 };
 model.getInspectionLayerBounds=(spread=0)=>{
  if(!Number.isFinite(spread)||spread<0||spread>100)throw Error('Inspection spread must be 0..100');
  if(inspectionMode==='roof')return model.getRoofLayerBounds(spread);
  if(inspectionMode==='plinth')return model.getPlinthLayerBounds(spread);
  const groups=revealMode==='field'?model.fieldLayerGroups:model.layerGroups;
  const boxes=groups.map((g,i)=>{const box=meshBounds(g),desired=facadePose(g,i,spread);const delta=desired.sub(g.position);g.parent.updateWorldMatrix(true,false);const worldDelta=delta.clone().applyMatrix4(g.parent.matrixWorld).sub(new THREE.Vector3().applyMatrix4(g.parent.matrixWorld));return box.translate(worldDelta);});
  // Window/reveal siblings are stationary. They still belong to the isolated
  // detail and its camera envelope; they must not vanish from the fit/guard.
  const stationary=meshBounds(inspectionRoot(),groups);if(!stationary.isEmpty())boxes.push(stationary);
  return boxes;
 };
 model.getInspectionBounds=(spread=0)=>model.getInspectionLayerBounds(spread).reduce((box,layer)=>box.union(layer),new THREE.Box3());
 model.inspectionStage=inspectionStage;
 model.nativeAsset={format:'gltf',authoring:'Blender native glTF',exporter:gltf.asset?.generator||null,nodeCount:objects.size,batchResult,staticLayerBatchResult:{sourceMeshes:staticLayerBatchResult.sourceMeshes,batches:staticLayerBatchResult.batches.length,drawsSaved:staticLayerBatchResult.drawsSaved},balconyBatchResult,glazingGasketBatchResult,approved:false};return model;
}

export function readNativeObjects(root){
 const objects=new Map();root.traverse(o=>{
  const extra=o.userData||{},id=extra.native_id||o.name.match(/^N\d+/)?.[0];
  if(extra.source_extras_json){const source=JSON.parse(extra.source_extras_json);o.userData={...source,...extra};}
  if(extra.native_visible!==undefined)o.visible=extra.native_visible!==false&&extra.native_visible!==0;
  if(id&&!objects.has(id))objects.set(id,o);
  if(o.isMesh){o.castShadow=!(o.material.transmission>0||o.userData.opticalGlass);o.receiveShadow=true;for(let a=o;a;a=a.parent)if(a.userData.representation==='user-nine-hole-pattern-markers'){o.raycast=()=>{};break;}}
 });
 // Blender may consolidate glyph triangles under their layer while preserving
 // their semantic owner by native_owner_id. Retain the display-only role there.
 root.traverse(o=>{if(!o.isMesh)return;const owner=objects.get(o.userData.native_owner_id);if(owner?.userData.representation==='user-nine-hole-pattern-markers'){o.userData.representation=owner.userData.representation;o.raycast=()=>{};}});
 return objects;
}

const glazingEdgeMaterial=new THREE.LineBasicMaterial({color:0x4b857d,transparent:true,opacity:.65,depthWrite:false});
function showGlazingEdges(pane,enabled){
 const meshes=[];pane.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const mesh of meshes){
  let edge=mesh.children.find(o=>o.userData.inspectionEdge===true);
  if(enabled&&!edge){
   edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),glazingEdgeMaterial);
   edge.name='inspection-pane-edges';
   edge.userData={type:'inspection-edge',inspectionEdge:true,physical:false,quantityEligible:false,quantity:0,representationOf:pane.userData.partId};
   mesh.add(edge);
  }
  if(edge){edge.visible=enabled;edge.raycast=()=>{};}
 }
}

// Inspection spacing is display geometry only. Three's transmission pass does
// not recursively solve the optical transport through three nested panes.
export function setNativeGlazingInspection(root,enabled,{window=root,spread=0}={}){
 if(typeof enabled!=='boolean'||!Number.isFinite(spread)||spread<0||spread>100)throw Error('Invalid glazing inspection state');
 if(!root?.isObject3D||!window?.isObject3D)throw Error('Invalid glazing inspection root');
 let ancestor=window;while(ancestor&&ancestor!==root)ancestor=ancestor.parent;
 if(!ancestor)throw Error('Glazing window is outside the native model');
 const assemblies=[];window.traverse(o=>{if(o.userData.glazingAssembly===true)assemblies.push(o);});
 const states=assemblies.map(assembly=>{
  if(assembly.userData.units!=='m')throw Error('Native glazing geometry must use metres');
  const a=assembly.userData,disputed=a.replacementStatus==='disputed',eligible=!a.inspectionRepresentation&&!disputed;
  if(typeof a.quantityEligible!=='boolean'||a.quantityEligible!==eligible||
   (disputed&&(a.sourceFacts?.type!=='A-07'||a.sourceFacts.paneCount!==null||!a.sourceConflict||a.compositionAuthority!=='disputed source candidate')))
   throw Error('Invalid native glazing inventory policy '+a.unitId);
  const panes=[],physical=[],proxies=[],proxyGroups=[];
  assembly.traverse(o=>{
   const d=o.userData;
   if(d.glazingRole==='physical-assembly')physical.push(o);
   if(d.glazingRole==='runtime-proxy-group')proxyGroups.push(o);
   if(d.glazingRole==='runtime-proxy')proxies.push(o);
   if(d.glazingRole==='physical-pane')panes.push(o);
  });
  const finiteVector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
  if(physical.length!==1||proxyGroups.length!==1||proxies.length!==1||panes.length!==3||new Set(panes.map(o=>o.userData.paneIndex)).size!==3)throw Error('Incomplete native glazing assembly '+assembly.userData.unitId);
  for(const pane of panes){
   const d=pane.userData;
   if(![0,1,2].includes(d.paneIndex)||!finiteVector(d.assembledPosition)||!finiteVector(d.explodeDirection)||!d.partId||d.physical!==true||d.quantityEligible!==eligible)throw Error('Invalid native glazing pane '+d.partId);
   let geometry=false;pane.traverse(o=>{if(o.isMesh){geometry=true;if(o.isInstancedMesh)throw Error('Glazing pane cannot be a static instance batch');}});
   if(!geometry)throw Error('Native glazing pane has no geometry '+d.partId);
  }
  const proxy=proxies[0].userData;
  if(proxy.physical!==false||proxy.quantityEligible!==false||proxy.quantity!==0||proxy.representationOf!==assembly.userData.unitId)throw Error('Native glazing proxy cannot count as stock');
  return {assembly,panes,physical:physical[0],proxy:proxyGroups[0]};
 });
 // Validate every selected assembly before changing any visibility or pose.
 const show=(owner,visible)=>owner.traverse(o=>{o.visible=visible;});
 for(const state of states){
  show(state.physical,enabled);show(state.proxy,!enabled);
  for(const pane of state.panes){
   const d=pane.userData;pane.position.fromArray(d.assembledPosition).addScaledVector(new THREE.Vector3(...d.explodeDirection),enabled?d.paneIndex*.18*spread/100:0);
   // Explicit pose updates also work when a consumer freezes local matrices.
   pane.updateMatrix();
   showGlazingEdges(pane,enabled&&spread>0);
  }
 }
 window.updateWorldMatrix(true,true);
 const bounds=new THREE.Box3();
 for(const {physical,proxy} of states)(enabled?physical:proxy).traverse(o=>{
  if(!o.isMesh)return;let visible=true;for(let a=o;a&&a!==window;a=a.parent)if(!a.visible){visible=false;break;}if(!visible)return;
  o.geometry.computeBoundingBox();if(o.geometry.boundingBox)bounds.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
 });
 return bounds.isEmpty()?null:bounds;
}

// The authored layer transforms define the assembled roof. Inspection adds
// display spacing along its outward local normal; it never changes the parts.
export function bindRoofInspection(cut,groups){
 const api=bindLayerInspection(cut,groups,'roof',1,.36);
 return {getRoofLayerBounds:api.layerBounds,getRoofBounds:api.bounds,setRoofSpread:api.setSpread};
}

// Plinth layers follow their authored local Z datum, including the existing
// substrate. Display spacing is independent of the project's layer thickness.
export function bindPlinthInspection(cut,groups){
 const supports=separatePlinthSupportInspection(cut,groups),api=bindLayerInspection(cut,groups,'plinth',2,.28);
 let current=0;const layerBounds=(spread=current)=>{const boxes=api.layerBounds(spread);boxes[0].union(supports.bounds(spread));return boxes;};
 return {getPlinthLayerBounds:layerBounds,getPlinthBounds:(spread=current)=>layerBounds(spread).reduce((b,q)=>b.union(q),new THREE.Box3()),setPlinthSpread(spread=0,visible){const result=api.setSpread(spread,visible);supports.setSpread(spread);cut.updateWorldMatrix(true,true);current=spread;return layerBounds();}};
}

function bindLayerInspection(cut,groups,system,axis,distance){
 const label=system[0].toUpperCase()+system.slice(1);
 if(groups.length!==5)throw Error('Native '+system+' requires five source layers');
 cut.updateWorldMatrix(true,true);
 const layers=groups.map((group,i)=>{
  const points=[],inverse=group.matrixWorld.clone().invert(),instance=new THREE.Matrix4(),localBox=new THREE.Box3();
  group.traverse(mesh=>{
   const position=mesh.geometry?.getAttribute('position');if(!mesh.isMesh||!position||position.count<3)return;
   const relative=inverse.clone().multiply(mesh.matrixWorld);
   for(let n=0;n<(mesh.isInstancedMesh?mesh.count:1);n++){
    if(mesh.isInstancedMesh)mesh.getMatrixAt(n,instance);else instance.identity();
    const transform=relative.clone().multiply(instance);
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    localBox.union(mesh.geometry.boundingBox.clone().applyMatrix4(transform));
   }
  });
  if(localBox.isEmpty())throw Error('Native '+system+' layer has no geometry: '+i);
  // A conservative layer box includes transformed mesh and instance boxes.
  // Eight corners replace repeated scans of every authored triangle during
  // animation, including rotated circular fastener heads.
  for(const x of [localBox.min.x,localBox.max.x])for(const y of [localBox.min.y,localBox.max.y])for(const z of [localBox.min.z,localBox.max.z])points.push(x,y,z);
  return {group,position:group.position.clone(),quaternion:group.quaternion.clone(),scale:group.scale.clone(),points:Float64Array.from(points),spacing:i*distance};
 });
 let current=0;
 const validate=value=>{if(!Number.isFinite(value)||value<0||value>100)throw Error(label+' spread must be0..100');};
 const layerBounds=(spread=current)=>{
  validate(spread);cut.updateWorldMatrix(true,false);
  return layers.map(({group,position,quaternion,scale,points,spacing})=>{
   group.parent.updateWorldMatrix(true,false);
   const shift=new THREE.Vector3().setComponent(axis,spacing*spread/100);
   const pose=new THREE.Matrix4().compose(position.clone().add(shift),quaternion,scale);
   const predicted=group.parent.matrixWorld.clone().multiply(pose),box=new THREE.Box3(),point=new THREE.Vector3();
   for(let j=0;j<points.length;j+=3)box.expandByPoint(point.set(points[j],points[j+1],points[j+2]).applyMatrix4(predicted));return box;
  });
 };
 return {
  layerBounds,
  bounds(spread=current){return layerBounds(spread).reduce((box,layer)=>box.union(layer),new THREE.Box3());},
  setSpread(spread=0,visible=groups.map(()=>true)){
   validate(spread);if(!Array.isArray(visible)||visible.length!==5||!visible.every(v=>typeof v==='boolean'))throw Error(label+' visibility requires five boolean values');
   for(const [i,{group,position,spacing}] of layers.entries()){group.position.copy(position).setComponent(axis,position.getComponent(axis)+spacing*spread/100);group.visible=visible[i];}
   cut.updateWorldMatrix(true,true);current=spread;return layerBounds();
  }
 };
}

// Display spacing only: roles/directions come from the authored canopy plan.
// No door, landing or steel member is displaced by this inspection view.
export function bindEntranceInspection(entries){
 const spacing={underlay:.24,counter:.48,'roof-lath':.72,roof:.96,'soffit-batten':.24,soffit:.48,fascia:.65,flashing:.4,steel:0,'steel-support':0,rainwater:0};
 for(const entry of entries){
  entry.owner.updateMatrixWorld(true);entry.currentBounds=entry.bounds.clone();entry.spread=0;entry.movingParts=[];
  const canopy=[];entry.owner.traverse(node=>{const part=node.userData.authoring;if(part?.assembly==='canopy')canopy.push({node,part});});
  const rendered=node=>{let yes=false;node.traverse(o=>{if(o.isMesh&&o.geometry.getAttribute('position')?.count>=3)yes=true;});return yes;};
  entry.canExplode=canopy.some(({node,part})=>part.layer==='steel'&&rendered(node))&&canopy.every(({node,part})=>Object.hasOwn(spacing,part.layer)&&Array.isArray(part.explodeDirection)&&part.explodeDirection.length===3&&part.explodeDirection.every(Number.isFinite)&&rendered(node));
  if(entry.canExplode)for(const {node,part} of canopy){
   if(!spacing[part.layer]||!part.explodeDirection.some(v=>v!==0))continue;
   const direction=new THREE.Vector3(...part.explodeDirection),parentBasis=new THREE.Matrix3().setFromMatrix4(node.parent.matrixWorld.clone().invert().multiply(entry.owner.matrixWorld));
   entry.movingParts.push({node,position:node.position.clone(),localShift:direction.clone().applyMatrix3(parentBasis).multiplyScalar(spacing[part.layer]),worldShift:direction.applyMatrix3(new THREE.Matrix3().setFromMatrix4(entry.owner.matrixWorld)).multiplyScalar(spacing[part.layer]),bounds:new THREE.Box3().setFromObject(node)});
  }
 }
 const get=id=>{const entry=entries.find(e=>e.id===id);if(!entry)throw Error('Unknown entrance');return entry;};
 const validate=spread=>{if(!Number.isFinite(spread)||spread<0||spread>100)throw Error('Entrance spread must be0..100');};
 return {
  getEntranceBounds(id,spread){
   const entry=get(id);if(spread===undefined)return entry.currentBounds.clone();validate(spread);
   const box=entry.bounds.clone();for(const part of entry.movingParts)box.union(part.bounds.clone().translate(part.worldShift.clone().multiplyScalar(spread/100)));return box;
  },
  setEntranceSpread(id,spread=0){
   validate(spread);const selected=id===null?null:get(id);
   if(selected&&spread>0&&!selected.canExplode)throw Error('Native canopy layers are not available in this asset');
   for(const entry of entries){
    const value=entry===selected?spread:0;
    for(const part of entry.movingParts)part.node.position.copy(part.position).addScaledVector(part.localShift,value/100);
    entry.owner.updateMatrixWorld(true);entry.spread=value;entry.currentBounds=new THREE.Box3().setFromObject(entry.owner);
   }
   return selected?.currentBounds.clone()||null;
  }
 };
}

export function nativeEntranceRecord(hit){
 for(let owner=hit.object;owner;owner=owner.parent){
  if(owner.userData.component?.kind==='entrance')return {owner,id:owner.userData.native_id,index:owner.userData.entranceIndex,component:owner.userData.component,bounds:new THREE.Box3().setFromObject(owner)};
 }
 return null;
}

export function nativeBalconyRecord(hit){
 for(let owner=hit.object;owner;owner=owner.parent){
  if(owner.userData.component?.kind==='balcony'&&/^BAL-\d{2}$/.test(owner.userData.balconyId))return {owner,id:owner.userData.balconyId,component:owner.userData.component,bounds:new THREE.Box3().setFromObject(owner)};
 }
 return null;
}

// Keep the physical guard panel selectable through draw-only static batches.
// Its BAL ancestor is still available for ordinary glass/frame/floor hits.
export function nativeBalconyGuardRecord(hit){
 const mesh=hit.object,index=hit.instanceId,c=mesh.userData.components?.[index];
 if(mesh.userData.staticBalconyInstances&&Number.isInteger(index)&&c?.kind==='balcony-guard-panel'){
  const owner=staticBalconyOwners.get(mesh)?.[index];
  if(index<0||index>=mesh.count||!owner||owner.userData.partId!==mesh.userData.representationOf[index])return null;
  const selection=resolveBalconyGuardSelection(owner.userData);if(!selection)return null;
  const matrix=new THREE.Matrix4();mesh.getMatrixAt(index,matrix);mesh.geometry.computeBoundingBox();
  return {owner,partId:selection.id,selection,component:c,bounds:mesh.geometry.boundingBox.clone().applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld)};
 }
 for(let owner=mesh;owner;owner=owner.parent)if(owner.userData.component?.kind==='balcony-guard-panel'&&owner.userData.partId){
  const selection=resolveBalconyGuardSelection(owner.userData);if(!selection)return null;
  return {owner,partId:selection.id,selection,component:owner.userData.component,bounds:new THREE.Box3().setFromObject(owner)};
 }
 return null;
}

// Display separation of the original authored floor skins. The seven joists,
// central angle, posts, guard and neighbouring door are never displaced.
export function bindBalconyInspection(entries){
 const roles={flashing:1,tape:2,board:3,coating:4,upstand:4};
 for(const entry of entries){
  entry.owner.updateWorldMatrix(true,true);entry.spread=0;entry.inspection=false;
  const floor=[],moving=[],covers=[];
  entry.owner.traverse(node=>{
   const d=node.userData;if(d.partId===entry.id+'-FC-FRONT')covers.push({node,visible:node.visible});
   if(d.assembly==='balcony-floor'&&d.partId){floor.push(node);moving.push(node);}
   else if(['floor-perimeter','floor-joist','floor-centre-angle'].includes(d.role)||d.partId===entry.id+'-DECK')floor.push(node);
  });
  const rendered=node=>{let yes=false;node.traverse(o=>{if(o.isMesh&&o.geometry.getAttribute('position')?.count>=3)yes=true;});return yes;};
  entry.canInspect=moving.length>0&&moving.every(node=>{const d=node.userData;return d.balconyId===entry.id&&roles[d.floorInspectionRole]===d.layer&&d.physical===true&&d.inspectionRepresentation===false&&Array.isArray(d.explodeDirection)&&d.explodeDirection.length===3&&d.explodeDirection.every(Number.isFinite)&&Math.abs(Math.hypot(...d.explodeDirection)-1)<1e-6&&rendered(node);})&&['flashing','tape','board','coating'].every(role=>moving.some(n=>n.userData.floorInspectionRole===role));
  entry.floorParts=floor.map(node=>({node,bounds:new THREE.Box3().setFromObject(node)}));
  if(!floor.length||entry.floorParts.some(p=>p.bounds.isEmpty()))throw Error('Native balcony floor has no geometry: '+entry.id);
  entry.movingParts=entry.canInspect?moving.map(node=>{
   const direction=new THREE.Vector3(...node.userData.explodeDirection).multiplyScalar(.18*node.userData.layer),basis=new THREE.Matrix3().setFromMatrix4(node.parent.matrixWorld.clone().invert().multiply(entry.owner.matrixWorld));
   return {node,position:node.position.clone(),localShift:direction.clone().applyMatrix3(basis),worldShift:direction.applyMatrix3(new THREE.Matrix3().setFromMatrix4(entry.owner.matrixWorld)),bounds:new THREE.Box3().setFromObject(node)};
  }):[];
  entry.covers=covers;entry.currentBounds=new THREE.Box3().setFromObject(entry.owner);
 }
 const get=id=>{const e=entries.find(e=>e.id===id);if(!e)throw Error('Unknown balcony');return e;};
 const validate=spread=>{if(!Number.isFinite(spread)||spread<0||spread>100)throw Error('Balcony spread must be0..100');};
 return {
  getBalconyFloorBounds(id,spread){
   const entry=get(id);if(spread!==undefined)validate(spread);
   const box=new THREE.Box3();for(const p of entry.floorParts)box.union(spread===undefined?new THREE.Box3().setFromObject(p.node):p.bounds);
   if(spread!==undefined)for(const p of entry.movingParts)box.union(p.bounds.clone().translate(p.worldShift.clone().multiplyScalar(spread/100)));
   return box;
  },
  setBalconyInspection(id,{enabled=true,spread=0}={}){
   if(typeof enabled!=='boolean')throw Error('Balcony inspection enabled must be boolean');validate(spread);
   const selected=id===null?null:get(id);if(id===null&&enabled)throw Error('Balcony inspection needs a selected owner');
   if(selected&&enabled&&spread>0&&!selected.canInspect)throw Error('Native balcony floor layers are not available in this asset');
   for(const entry of entries){
    const active=entry===selected&&enabled,value=active?spread:0;
    for(const p of entry.movingParts){p.node.position.copy(p.position).addScaledVector(p.localShift,value/100);p.node.updateMatrix();}
    const basis=entry.movingParts.find(p=>p.node.userData.layer===1)?.worldShift;
    if(basis){const shift=basis.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(entry.owner.matrixWorld.clone().invert()));for(const d of entry.owner.children)if(d.userData.balconyFloorDisplayLayer!==undefined){d.position.copy(shift).multiplyScalar(d.userData.balconyFloorDisplayLayer*value/100);d.updateMatrix();}}
    for(const cover of entry.covers)cover.node.visible=active?false:cover.visible;
    entry.owner.updateWorldMatrix(true,true);entry.spread=value;entry.inspection=active;entry.currentBounds=new THREE.Box3().setFromObject(entry.owner);
   }
   return selected?this.getBalconyFloorBounds(selected.id):null;
  }
 };
}

export function nativePanelRecord(hit){
 let owner=hit.object;while(owner&&!owner.userData.panelRecords)owner=owner.parent;if(!owner)return null;
 const data=owner.userData;
 if(Number.isInteger(hit.instanceId))return data.panelRecords?.[hit.instanceId];
 if(!hit.point)return null;
 if(data.panelProjection){
  let frame=owner;while(frame.parent&&!(frame.userData.layer===8&&frame.userData.system==='facade'))frame=frame.parent;
  const point=hit.point.clone().applyMatrix4(frame.matrixWorld.clone().invert());
  return data.panelRecords.find(r=>{const p=r.detailProjection;return p&&point.x*1000>=p.x-.05&&point.x*1000<=p.x+p.width+.05&&point.y*1000>=p.y-.05&&point.y*1000<=p.y+p.height+.05;})||null;
 }
 let facade=owner.parent;while(facade?.parent&&!facade.userData.component?.kind?.includes('facade'))facade=facade.parent;
 if(!facade)return null;
 const p=hit.point.clone().applyMatrix4(facade.matrixWorld.clone().invert()),full=Boolean(data.fullEndWall&&['SW','NE'].includes(data.panelFacade)),width=full?endWallSpec.widthMM/1000:['SW','NE'].includes(data.panelFacade)?11.24:40.4,centre=full?endWallFrame(data.panelFacade).centre:0,x=(p.x-centre+width/2)*1000,y=p.y*1000;
 return data.panelRecords.find(r=>x>=r.x-.05&&x<=r.x+r.width+.05&&y>=r.y-.05&&y<=r.y+r.height+.05)||null;
}

export function nativeLayerRecord(hit){
 for(let owner=hit.object;owner;owner=owner.parent)if(owner.userData.component?.kind==='balcony'&&owner.userData.balconyId)return null;
 for(let owner=hit.object;owner;owner=owner.parent)if(owner.userData.panelProjection)return null;
 for(let owner=hit.object;owner;owner=owner.parent){
  if(Number.isInteger(owner.userData.layer))return {layer:owner.userData.layer,system:owner.userData.system||'facade'};
 }
 return null;
}

export function nativePlinthRecord(hit){
 if(!hit?.object)return null;
 let owner;
 if(hit.object.userData.nativeStaticLayerBatch){
  if(!Number.isInteger(hit.batchId))return null;
  owner=staticLayerOwners.get(hit.object)?.[hit.batchId];
 }else for(let node=hit.object;node;node=node.parent){
  if(node.userData.assembly==='plinth'&&node.userData.partId){owner=node;break;}
 }
 if(!owner||owner.userData.layer!==4)return null;
 physicalPlinthPlan??=planPlinthAssembly();
 const selection=resolvePlinthSelection(owner.userData,physicalPlinthPlan,nativePlinthBores.get(owner));
 return selection?{owner,selection,bounds:new THREE.Box3().setFromObject(owner)}:null;
}

export function nativeRoofEdgeRecord(hit){
 if(!hit?.object)return null;
 let owner=hit.object.isInstancedMesh&&Number.isInteger(hit.instanceId)?componentInstanceOwners.get(hit.object)?.[hit.instanceId]:null;
 if(!owner)for(let node=hit.object;node;node=node.parent)if(node.userData?.assembly==='roof-edge'&&node.userData.partId){owner=node;break;}
 if(!owner||owner.userData.assembly!=='roof-edge')return null;
 const selection=resolveRoofEdgeSelection(owner.userData);
 if(!selection)return null;
 let bounds=new THREE.Box3().setFromObject(owner);
 if(hit.object.isInstancedMesh){
  const matrix=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,matrix);hit.object.geometry.computeBoundingBox();
  bounds=hit.object.geometry.boundingBox.clone().applyMatrix4(matrix).applyMatrix4(hit.object.matrixWorld);
 }
 return {owner,selection,bounds};
}

export function nativeRoofLathRecord(hit){
 if(!hit?.object)return null;
 let owner;
 if(hit.object.userData.nativeStaticLayerBatch){
  if(!Number.isInteger(hit.batchId))return null;
  owner=staticLayerOwners.get(hit.object)?.[hit.batchId];
 }else for(let node=hit.object;node;node=node.parent)if(node.userData?.assembly==='roof'&&node.userData.partId){owner=node;break;}
 if(!owner)return null;
 const selection=resolveRoofLathSelection(owner.userData);
 return selection?{owner,selection,bounds:new THREE.Box3().setFromObject(owner)}:null;
}

export function nativeOpeningRecord(hit){
 if(!hit?.object)return null;
 let owner=hit.object.isInstancedMesh&&Number.isInteger(hit.instanceId)?componentInstanceOwners.get(hit.object)?.[hit.instanceId]:null;
 if(!owner)for(let node=hit.object;node;node=node.parent)if(node.userData?.component?.kind==='window'&&node.userData.windowProfilePlan){owner=node;break;}
 const selection=owner?resolveOpeningDimensions(owner.userData):null;
 if(!selection)return null;
 owner.updateWorldMatrix(true,false);selection.apertureMatrix=owner.matrixWorld.toArray();
 return {owner,selection,bounds:(openingOwnerBounds.get(owner)||new THREE.Box3().setFromObject(owner)).clone()};
}

export function nativeBalconyOpeningRecords(balcony,building){
 if(!balcony?.owner||!building)return null;
 const floors=[],windows=[];
 balcony.owner.traverse(node=>{if(node.userData?.floorAssembly)floors.push(node.userData);});
 building.traverse(node=>{if(node.userData?.component?.kind==='window'&&node.userData.windowProfilePlan)windows.push(node);});
 const pair=resolveBalconyOpeningPair(balcony.owner.userData,floors,windows.map(node=>node.userData));
 if(!pair)return null;
 return Object.fromEntries(Object.entries(pair).map(([role,selection])=>[role,nativeOpeningRecord({object:windows.find(node=>node.userData.windowId===selection.nativeWindowId)})]));
}

export function nativeRetainedReturnRecord(hit){
 if(!hit?.object)return null;
 let owner=hit.object.isInstancedMesh&&Number.isInteger(hit.instanceId)?componentInstanceOwners.get(hit.object)?.[hit.instanceId]:null;
 if(!owner)for(let node=hit.object;node;node=node.parent)if(node.userData?.assembly==='retained-balcony-return'&&node.userData.partId){owner=node;break;}
 if(!owner)return null;
 const selection=resolveRetainedReturnSelection(owner.userData);
 if(!selection)return null;
 const ps=selection.physicalReturn.parts,bounds=new THREE.Box3();
 for(const p of ps){bounds.expandByPoint(new THREE.Vector3(...p.bounds.min));bounds.expandByPoint(new THREE.Vector3(...p.bounds.max));}
 return {owner,selection,bounds};
}

// Native surfaces may share one material batch. Selection still frames the
// individual source tile, including the owner's animated outward offset.
export function nativePanelBounds(hit,record=nativePanelRecord(hit)){
 if(!record)return null;
 if(hit.object.isInstancedMesh&&Number.isInteger(hit.instanceId)){
  const matrix=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,matrix);hit.object.geometry.computeBoundingBox();
  return hit.object.geometry.boundingBox.clone().applyMatrix4(matrix).applyMatrix4(hit.object.matrixWorld);
 }
 let owner=hit.object;while(owner&&!owner.userData.panelRecords)owner=owner.parent;if(!owner)return null;
 if(owner.userData.panelProjection&&record.detailProjection){
  let frame=owner;while(frame.parent&&!(frame.userData.layer===8&&frame.userData.system==='facade'))frame=frame.parent;
  const r=record.detailProjection;return new THREE.Box3(new THREE.Vector3(r.x/1000,r.y/1000,0),new THREE.Vector3((r.x+r.width)/1000,(r.y+r.height)/1000,.008)).applyMatrix4(frame.matrixWorld);
 }
 const full=Boolean(owner.userData.fullEndWall&&['SW','NE'].includes(owner.userData.panelFacade)),width=full?endWallSpec.widthMM/1000:['SW','NE'].includes(owner.userData.panelFacade)?11.24:40.4,centre=full?endWallFrame(owner.userData.panelFacade).centre:0;
 return new THREE.Box3(new THREE.Vector3(record.x/1000-width/2+centre,record.y/1000,.021),new THREE.Vector3((record.x+record.width)/1000-width/2+centre,(record.y+record.height)/1000,.029)).applyMatrix4(owner.matrixWorld);
}

function geometryFingerprint(g){
 let hash=2166136261,bytes=0;
 for(const name of ['position','normal','uv','index']){const a=name==='index'?g.index:g.getAttribute(name);if(!a)continue;const data=new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength);bytes+=data.length;for(const byte of data)hash=Math.imul(hash^byte,16777619)>>>0;}
 return bytes+':'+hash;
}
function sameGeometry(a,b){
 for(const name of ['position','normal','uv','index']){const x=name==='index'?a.index:a.getAttribute(name),y=name==='index'?b.index:b.getAttribute(name);if(!x!==!y)return false;if(!x)continue;if(x.itemSize!==y.itemSize||x.array.length!==y.array.length)return false;for(let i=0;i<x.array.length;i++)if(x.array[i]!==y.array[i])return false;}return true;
}
function sameStaticGeometry(a,b){
 const names=Object.keys(a.attributes).sort();if(names.join()!==Object.keys(b.attributes).sort().join())return false;
 for(const name of [...names,'index']){
  const x=name==='index'?a.index:a.getAttribute(name),y=name==='index'?b.index:b.getAttribute(name);if(!x!==!y)return false;if(!x)continue;
  if(x.isInterleavedBufferAttribute||y.isInterleavedBufferAttribute||x.itemSize!==y.itemSize||x.normalized!==y.normalized||x.array.constructor!==y.array.constructor||x.array.byteLength!==y.array.byteLength)return false;
  const left=new Uint8Array(x.array.buffer,x.array.byteOffset,x.array.byteLength),right=new Uint8Array(y.array.buffer,y.array.byteOffset,y.array.byteLength);if(!left.every((v,i)=>v===right[i]))return false;
 }
 return a.drawRange.start===b.drawRange.start&&a.drawRange.count===b.drawRange.count&&JSON.stringify(a.groups)===JSON.stringify(b.groups);
}

// Mount gaskets stay fixed while panes spread. Batch only direct canonical
// siblings inside one IGU: hiding that unit must also hide its representation.
export function batchGlazingMountGaskets(root){
 const assemblies=[];root.traverse(o=>{if(o.userData.glazingAssembly===true)assemblies.push(o);});
 const result={sourceMeshes:0,representedMeshes:0,instanceBatches:0,drawsSaved:0};
 for(const assembly of assemblies){
  if(!assembly.staticGlazingGaskets){
   assembly.updateWorldMatrix(true,true);const inverse=assembly.matrixWorld.clone().invert(),buckets=new Map();
   assembly.traverse(mesh=>{
    if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.transmission>0||Object.keys(mesh.geometry.morphAttributes).length||mesh.raycast!==THREE.Mesh.prototype.raycast||mesh.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender||mesh.onAfterRender!==THREE.Object3D.prototype.onAfterRender)return;
    let partOwner=null,component=null;
    for(let node=mesh;node&&node!==assembly;node=node.parent){
     if(!node.visible)return;
     if(node.userData.glazingRole){if(node.userData.glazingRole!=='mount-gasket'||partOwner)return;partOwner=node;}
    }
    if(!partOwner||partOwner.parent!==assembly||!partOwner.userData.partId||partOwner.userData.physical!==true)return;
    for(let node=partOwner;node;node=node.parent)if(node.userData.component){component=node.userData.component;break;}
    const matrix=inverse.clone().multiply(mesh.matrixWorld);if(matrix.determinant()<=0)return;
    const axes=[0,1,2].map(i=>new THREE.Vector3().setFromMatrixColumn(matrix,i).normalize());if(Math.abs(axes[0].dot(axes[1]))>1e-6||Math.abs(axes[0].dot(axes[2]))>1e-6||Math.abs(axes[1].dot(axes[2]))>1e-6)return;
    const key=[mesh.material.uuid,geometryFingerprint(mesh.geometry),mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.layers.mask,mesh.frustumCulled,mesh.customDepthMaterial?.uuid,mesh.customDistanceMaterial?.uuid].join(':');
    const list=buckets.get(key)||[];list.push({mesh,partOwner,partId:partOwner.userData.partId,component,matrix:mesh.matrixWorld.clone(),visible:mesh.visible});buckets.set(key,list);
   });
   assembly.staticGlazingGaskets=[];assembly.staticGlazingGasketSources=[...buckets.values()].flat().length;
   for(const sources of buckets.values()){
    if(sources.length<2||sources.some(({mesh})=>!sameStaticGeometry(sources[0].mesh.geometry,mesh.geometry)))continue;
    const first=sources[0].mesh,instance=new THREE.InstancedMesh(first.geometry,first.material,sources.length);instance.name=assembly.userData.unitId+'-GASKETS';
    sources.forEach((s,i)=>instance.setMatrixAt(i,inverse.clone().multiply(s.matrix)));
    for(const key of ['castShadow','receiveShadow','renderOrder','frustumCulled','customDepthMaterial','customDistanceMaterial'])instance[key]=first[key];instance.layers.mask=first.layers.mask;
    instance.userData={staticGlazingGasketInstances:true,glazingRole:'mount-gasket-instance',physical:false,quantityEligible:false,newStockPart:false,quantity:0,representationOf:sources.map(s=>s.partId),components:sources.map(s=>s.component),unitId:assembly.userData.unitId};
    instance.computeBoundingBox();instance.computeBoundingSphere();assembly.add(instance);for(const s of sources)s.mesh.visible=false;
    assembly.staticGlazingGaskets.push({instance,sources});
   }
   assembly.updateWorldMatrix(true,true);
  }
  result.sourceMeshes+=assembly.staticGlazingGasketSources;
  for(const b of assembly.staticGlazingGaskets){result.representedMeshes+=b.sources.length;result.instanceBatches++;}
 }
 result.drawsSaved=result.representedMeshes-result.instanceBatches;return result;
}

// Resolve presentation instances back to the retained canonical part owner.
// The mapping lives in serialisable extras, so native hierarchy clones work.
export function nativeGlazingPartRecord(hit){
 let part=hit?.object;if(!part)return null;
 if(part.userData.staticGlazingGasketInstances){
  const ids=part.userData.representationOf;if(!Number.isInteger(hit.instanceId)||hit.instanceId<0||hit.instanceId>=ids?.length)return null;
  const assembly=part.parent;if(!assembly?.userData.glazingAssembly||assembly.userData.unitId!==part.userData.unitId)return null;
  part=assembly.children.find(o=>o.userData.partId===ids[hit.instanceId]&&o.userData.glazingRole==='mount-gasket');if(!part)return null;
 }else{while(part&&!part.userData.glazingRole)part=part.parent;}
 if(!part?.userData.partId)return null;
 let assembly=part;while(assembly&&!assembly.userData.glazingAssembly)assembly=assembly.parent;if(!assembly)return null;
 return {owner:part,partId:part.userData.partId,role:part.userData.glazingRole,assembly,unitId:assembly.userData.unitId};
}

// Static draw representations stay inside their BAL owner. Canonical source
// meshes keep their geometry, ancestry, matrices and quantity metadata; only
// their visibility changes. Moving skins and the reveal cover are excluded.
export function batchBalconyStatic(entries){
 let sourceMeshes=0,representedMeshes=0,instanceBatches=0;
 for(const entry of entries){
  if(entry.staticBatches){sourceMeshes+=entry.staticBatching.sourceMeshes;representedMeshes+=entry.staticBatching.representedMeshes;instanceBatches+=entry.staticBatching.instanceBatches;continue;}
  entry.owner.updateWorldMatrix(true,true);const buckets=new Map(),inverse=entry.owner.matrixWorld.clone().invert();
  entry.owner.traverse(mesh=>{
   if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.transmission>0||Object.keys(mesh.geometry.morphAttributes).length||mesh.raycast!==THREE.Mesh.prototype.raycast||mesh.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender||mesh.onAfterRender!==THREE.Object3D.prototype.onAfterRender)return;
   let partOwner=null,component=null;
   for(let node=mesh;node;node=node.parent){const d=node.userData;
    if(!node.visible||d.assembly==='balcony-floor'||d.partId===entry.id+'-FC-FRONT'||d.balconyGlazing||d.glazingRole||d.opticalGlass||d.component?.kind==='door')return;
    if(!partOwner&&d.partId)partOwner=node;if(!component&&d.component)component=d.component;if(node===entry.owner)break;
   }
   if(!partOwner)return;
   const matrix=inverse.clone().multiply(mesh.matrixWorld);if(matrix.determinant()<=0)return;
   const axes=[0,1,2].map(i=>new THREE.Vector3().setFromMatrixColumn(matrix,i).normalize());if(Math.abs(axes[0].dot(axes[1]))>1e-6||Math.abs(axes[0].dot(axes[2]))>1e-6||Math.abs(axes[1].dot(axes[2]))>1e-6)return;
   const key=[mesh.material.uuid,geometryFingerprint(mesh.geometry),mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.layers.mask,mesh.frustumCulled,mesh.customDepthMaterial?.uuid,mesh.customDistanceMaterial?.uuid].join(':');
   const list=buckets.get(key)||[];list.push({mesh,partOwner,partId:partOwner.userData.partId,component,matrix:mesh.matrixWorld.clone(),visible:mesh.visible});buckets.set(key,list);sourceMeshes++;
  });
  entry.staticBatches=[];
  for(const sources of buckets.values()){
   if(sources.length<2||sources.some(({mesh})=>!sameStaticGeometry(sources[0].mesh.geometry,mesh.geometry)))continue;
   const first=sources[0].mesh,instance=new THREE.InstancedMesh(first.geometry,first.material,sources.length);instance.name=entry.id+'-STATIC';
   sources.forEach((s,i)=>instance.setMatrixAt(i,inverse.clone().multiply(s.matrix)));
   instance.castShadow=first.castShadow;instance.receiveShadow=first.receiveShadow;instance.renderOrder=first.renderOrder;instance.layers.mask=first.layers.mask;instance.frustumCulled=first.frustumCulled;instance.customDepthMaterial=first.customDepthMaterial;instance.customDistanceMaterial=first.customDistanceMaterial;
   instance.userData={staticBalconyInstances:true,balconyId:entry.id,physical:false,quantityEligible:false,newStockPart:false,quantity:0,representationOf:sources.map(s=>s.partId),components:sources.map(s=>s.component)};
   staticBalconyOwners.set(instance,sources.map(s=>s.partOwner));
   instance.computeBoundingBox();instance.computeBoundingSphere();entry.owner.add(instance);for(const s of sources)s.mesh.visible=false;
   entry.staticBatches.push({instance,sources});representedMeshes+=sources.length;instanceBatches++;
  }
  entry.owner.updateWorldMatrix(true,true);
  entry.staticBatching={sourceMeshes:[...buckets.values()].reduce((sum,list)=>sum+list.length,0),representedMeshes:entry.staticBatches.reduce((sum,b)=>sum+b.sources.length,0),instanceBatches:entry.staticBatches.length};
 }
 return {sourceMeshes,representedMeshes,instanceBatches,drawsSaved:representedMeshes-instanceBatches};
}
// Optimize imported native geometry only. No new architectural shapes appear
// here; dynamic groups and selectable panel IDs remain in their source tree.
// Draw-only batches of the assembled roof/plinth. The inspection counterparts
// and canonical physical owners retain their authored geometry and transforms.
export function batchNativeStaticLayers(building,excluded=[]){
 const stop=new Set(excluded),buckets=new Map(),batches=[];building.updateWorldMatrix(true,true);
 building.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isBatchedMesh||mesh.isSkinnedMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.transmission>0||Object.keys(mesh.geometry.morphAttributes).length||mesh.raycast!==THREE.Mesh.prototype.raycast||mesh.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender||mesh.onAfterRender!==THREE.Object3D.prototype.onAfterRender)return;
  let part=null;for(let o=mesh;o;o=o.parent){if(stop.has(o)||!o.visible)return;if(!part&&['roof-part','plinth'].includes(o.userData.component?.kind)&&o.userData.partId)part=o;if(o===building)break;}
  if(!part||!['roof','plinth'].includes(part.userData.system)||!Number.isInteger(part.userData.layer))return;
  const parent=part.parent;if(!parent)return;const geometry=mesh.geometry;
  if(geometry.drawRange.start!==0||geometry.drawRange.count!==Infinity||geometry.groups.length)return;
  const attrs=Object.entries(geometry.attributes).sort(([a],[b])=>a.localeCompare(b));
  if(attrs.some(([,a])=>a.isInterleavedBufferAttribute))return;
  const signature=attrs.map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name].join('/')).join(',')+':'+!!geometry.index;
  const matrix=parent.matrixWorld.clone().invert().multiply(mesh.matrixWorld);if(matrix.determinant()<=0)return;
  const key=[parent.uuid,part.userData.system,part.userData.layer,mesh.material.uuid,signature,mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.layers.mask,mesh.frustumCulled,mesh.customDepthMaterial?.uuid,mesh.customDistanceMaterial?.uuid].join(':');
  const list=buckets.get(key)||[];list.push({mesh,part,parent,matrix,partId:part.userData.partId,component:part.userData.component});buckets.set(key,list);
 });
 for(const sources of buckets.values()){
  if(sources.length<2)continue;
  const first=sources[0].mesh,unique=[...new Set(sources.map(s=>s.mesh.geometry))];
  const vertices=unique.reduce((n,g)=>n+g.attributes.position.count,0),indices=unique.reduce((n,g)=>n+(g.index?.count||0),0);
  const batch=new THREE.BatchedMesh(sources.length,vertices,indices,first.material),geometries=new Map();
  for(const g of unique)geometries.set(g,batch.addGeometry(g));
  for(const s of sources){s.geometryId=geometries.get(s.mesh.geometry);s.batchId=batch.addInstance(s.geometryId);batch.setMatrixAt(s.batchId,s.matrix);}
  batch.name='native_static_'+sources[0].part.userData.system+'_'+sources[0].part.userData.layer;
  batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;batch.layers.mask=first.layers.mask;batch.frustumCulled=first.frustumCulled;batch.customDepthMaterial=first.customDepthMaterial;batch.customDistanceMaterial=first.customDistanceMaterial;
  batch.userData={nativeStaticLayerBatch:true,physical:false,quantityEligible:false,newStockPart:false,quantity:0,system:sources[0].part.userData.system,layer:sources[0].part.userData.layer,representationOf:sources.map(s=>s.partId),components:sources.map(s=>s.component)};
  staticLayerOwners.set(batch,sources.map(s=>s.part));
  batch.computeBoundingBox();batch.computeBoundingSphere();sources[0].parent.add(batch);for(const s of sources)s.mesh.visible=false;batches.push({batch,sources});
 }
 building.updateWorldMatrix(true,true);
 return {batches,sourceMeshes:batches.reduce((n,b)=>n+b.sources.length,0),drawsSaved:batches.reduce((n,b)=>n+b.sources.length-1,0)};
}

export function batchNativeComponents(building,excluded=[]){
 const stop=new Set(excluded),batches=new Map(),fingerprints=new WeakMap();building.updateMatrixWorld(true);
 building.traverse(node=>{if(node.userData?.component?.kind==='window'&&node.userData.windowProfilePlan)openingOwnerBounds.set(node,new THREE.Box3().setFromObject(node));});
 building.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||Array.isArray(mesh.material))return;
  let owner=null;for(let a=mesh;a;a=a.parent){if(stop.has(a)||a.userData.system||a.userData.dynamicCover||a.userData.panelFacade||a.userData.gableFacade||a.userData.representation==='user-nine-hole-pattern-markers'||a.userData.glazingAssembly||a.userData.glazingRole)return;if(!owner&&a.userData.component)owner=a.userData.component;if(a===building)break;}
  let fingerprint=fingerprints.get(mesh.geometry);if(!fingerprint){fingerprint=geometryFingerprint(mesh.geometry);fingerprints.set(mesh.geometry,fingerprint);}
  const key=mesh.material.uuid+':'+fingerprint,list=batches.get(key)||[];list.push({mesh,component:owner});batches.set(key,list);
 });
 const inverse=building.matrixWorld.clone().invert();let removed=0,created=0;
 for(const list of batches.values()){
  if(list.length<2)continue;const first=list[0].mesh;
  if(list.some(({mesh})=>!sameGeometry(first.geometry,mesh.geometry)))continue;
  const instance=new THREE.InstancedMesh(first.geometry,first.material,list.length);instance.name='native_component_instances';
  list.forEach(({mesh},i)=>instance.setMatrixAt(i,inverse.clone().multiply(mesh.matrixWorld)));
  instance.userData.components=list.map(r=>r.component);instance.userData.nativeImported=true;instance.castShadow=first.castShadow;instance.receiveShadow=first.receiveShadow;instance.computeBoundingBox();instance.computeBoundingSphere();building.add(instance);
  componentInstanceOwners.set(instance,list.map(({mesh})=>{for(let node=mesh;node;node=node.parent)if((['retained-balcony-return','roof-edge'].includes(node.userData.assembly)&&node.userData.partId)||(node.userData.component?.kind==='window'&&node.userData.windowProfilePlan))return node;return null;}));
  for(const {mesh} of list)mesh.removeFromParent();removed+=list.length;created++;
 }
 return {removedMeshes:removed,instanceBatches:created};
}
