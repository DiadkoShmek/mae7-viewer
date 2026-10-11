import {addPanelFastenerMarkers} from './panel-fastener-pattern.js';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import * as THREE from 'three';
import {GLTFLoader} from './assets/GLTFLoader.js';
import {nativePanelRecord,nativeLayerRecord,nativePanelBounds,nativeEntranceRecord,nativeBalconyRecord,bindBalconyInspection,batchBalconyStatic,batchGlazingMountGaskets,nativeGlazingPartRecord,bindEntranceInspection,bindRoofInspection,setNativeGlazingInspection} from './native-model.js';
import {createGlazingUnit} from './glazing-unit.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createEntrance,planEntrance} from './entrance.js';
import {boundsVolume,constrainCamera,inVolume} from './camera-clearance.js';
import {createScalarMotion} from './motion.js';
import {layoutFor} from './facade-layouts.js';
import {layoutOptions} from './layout-options.js';
import {visualPanelLayout,samePanelLayout,samePanelPart} from './visual-panel-layout.js';
import {gableLayout} from './gables.js';
import {origin} from './model.js';
import {createFacadeSystem} from './facade-system.js';
import {planWindowDetail} from './window-detail.js';
import {blankContours,panelMaterialRectangles} from './panel-blank-shapes.js';
import {panelDrilling} from './panel-drilling.js';
import {panelContourGeometry} from './panel-contour-geometry.js';
import {fcGrainCode,applyFibreSurfaceUV,setInstanceFibreGrain,createInstanceFibreMaterial} from './fc-surface-uv.js';
import {planRoofAssembly,roofLayerOffsets} from './roof-assembly.js';
import {readNativeGLB} from '../scripts/read-native-asset.mjs';
import {basementOpenings} from './basement-openings.js';
import {createInspectionStage} from './inspection-stage.js';
import {createWindowPanelInspection} from './window-panel-inspection.js';

// Real GLB geometry, transforms and extras. Texture decoding is omitted only
// because Node has no DOM image decoder; no geometry or node is fabricated.
const bytes=await readNativeGLB(new URL('./assets/mae7.gltf',import.meta.url));
const jsonLength=bytes.readUInt32LE(12),asset=JSON.parse(bytes.subarray(20,20+jsonLength));
const binary=bytes.subarray(28+jsonLength);
asset.images=[];asset.textures=[];asset.samplers=[];
asset.materials=asset.materials.map(m=>({name:m.name,doubleSided:m.doubleSided,pbrMetallicRoughness:{baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor,metallicFactor:m.pbrMetallicRoughness?.metallicFactor,roughnessFactor:m.pbrMetallicRoughness?.roughnessFactor}}));
const json=Buffer.from(JSON.stringify(asset)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
const buffer=Buffer.alloc(28+padded.length+binary.length);buffer.writeUInt32LE(0x46546c67,0);buffer.writeUInt32LE(2,4);buffer.writeUInt32LE(buffer.length,8);buffer.writeUInt32LE(padded.length,12);buffer.writeUInt32LE(0x4e4f534a,16);padded.copy(buffer,20);buffer.writeUInt32LE(binary.length,20+padded.length);buffer.writeUInt32LE(0x004e4942,24+padded.length);binary.copy(buffer,28+padded.length);
const parsed=await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
parsed.scene.updateMatrixWorld(true);
const entranceSnapshots=[];parsed.scene.traverse(owner=>{const extra=owner.userData.source_extras_json?JSON.parse(owner.userData.source_extras_json):owner.userData;if(extra.component?.kind==='entrance'){const meshes=[];owner.traverse(mesh=>{if(mesh.isMesh)meshes.push({mesh,matrix:mesh.matrixWorld.clone()});});entranceSnapshots.push({owner,bounds:new THREE.Box3().setFromObject(owner),meshes});}});
const balconySnapshots=[];parsed.scene.traverse(owner=>{const extra=owner.userData.source_extras_json?JSON.parse(owner.userData.source_extras_json):owner.userData;if(extra.component?.kind==='balcony'){const meshes=[];owner.traverse(mesh=>{if(mesh.isMesh)meshes.push({mesh,matrix:mesh.matrixWorld.clone(),parent:mesh.parent});});balconySnapshots.push({owner,id:extra.balconyId,meshes});}});
const originalMeshes=[];
parsed.scene.traverse(mesh=>{if(!mesh.isMesh)return;let component=null;for(let owner=mesh;owner;owner=owner.parent){const extra=owner.userData.source_extras_json?JSON.parse(owner.userData.source_extras_json):owner.userData;if(extra.component){component=extra.component;break;}}originalMeshes.push({mesh,matrix:mesh.matrixWorld.clone(),component});});
const data=JSON.parse(await readFile(new URL('./assets/mae7-bindings.json',import.meta.url),'utf8'));
const source=await readFile(new URL('./native-model.js',import.meta.url),'utf8');
const context=vm.createContext({THREE,addPanelFastenerMarkers,createInspectionStage,createWindowPanelInspection,loadNativeTransport:async()=>parsed,GLTFLoader:class{loadAsync(){return Promise.resolve(parsed);}},fetch:async()=>({ok:true,json:async()=>structuredClone(data)}),layoutFor,layoutOptions,visualPanelLayout,samePanelLayout,samePanelPart,gableLayout,origin,createFacadeSystem,planWindowDetail,blankContours,panelMaterialRectangles,panelContourGeometry,panelDrilling,fcGrainCode,applyFibreSurfaceUV,setInstanceFibreGrain,createInstanceFibreMaterial,requestAsset:async()=>new TextEncoder().encode(JSON.stringify(data)),TextDecoder,structuredClone,console});
vm.runInContext(source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'')+'\nglobalThis.load=loadNativeModel;globalThis.batch=batchNativeComponents;globalThis.hydrate=readNativeObjects;',context);
const scene=new THREE.Scene(),model=await context.load(scene),objects=new Map();
scene.traverse(o=>{if(o.userData.native_id)objects.set(o.userData.native_id,o);});
const visible=o=>{for(let a=o;a;a=a.parent)if(!a.visible)return false;return true;};
const meshCount=o=>{let n=0;o.traverse(x=>{if(x.isMesh)n++;});return n;};
const facade=code=>objects.get(data.bindings.facadeGroups[code]);
const panels=code=>facade(code).children.filter(o=>o.userData.panelFacade===code);

test('assembled roof and plinth draw batches retain all native vertex attributes, indices and world positions',()=>{
 const batches=model.staticLayerBatches;assert(batches.length>0);assert(model.nativeAsset.staticLayerBatchResult.drawsSaved>700);
 const authored=new Map(originalMeshes.map(s=>[s.mesh,s]));let vertices=0;
 const instance=new THREE.Matrix4(),point=new THREE.Vector3(),expected=new THREE.Vector3();
 for(const {batch,sources} of batches){
  assert.equal(batch.userData.quantity,0);assert.equal(batch.userData.physical,false);assert.equal(batch.userData.quantityEligible,false);
  assert(batch.isBatchedMesh);assert(sources.length>1);
  for(const s of sources){
   const original=authored.get(s.mesh);assert(original);assert.equal(s.mesh.visible,false);assert.equal(batch.material,s.mesh.material);
   assert.equal(batch.userData.representationOf[s.batchId],s.partId);assert.equal(batch.userData.components[s.batchId],s.component);
   const range=batch.getGeometryRangeAt(s.geometryId);batch.getMatrixAt(s.batchId,instance);const world=batch.matrixWorld.clone().multiply(instance);
   for(const [name,sourceAttribute] of Object.entries(s.mesh.geometry.attributes)){
    const target=batch.geometry.attributes[name];assert.equal(target.itemSize,sourceAttribute.itemSize);assert.equal(target.normalized,sourceAttribute.normalized);
    const offset=range.vertexStart*target.itemSize;
    assert.deepEqual(target.array.subarray(offset,offset+sourceAttribute.array.length),sourceAttribute.array,name+' bytes remain exact');
   }
   assert.equal(range.vertexCount,s.mesh.geometry.attributes.position.count);
   if(s.mesh.geometry.index){assert.equal(range.indexCount,s.mesh.geometry.index.count);for(let i=0;i<range.indexCount;i++)assert.equal(batch.geometry.index.getX(range.indexStart+i)-range.vertexStart,s.mesh.geometry.index.getX(i));}
   const p=s.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){
    expected.fromBufferAttribute(p,i).applyMatrix4(original.matrix);point.fromBufferAttribute(batch.geometry.attributes.position,range.vertexStart+i).applyMatrix4(world);
    assert(point.distanceTo(expected)<2e-6,s.partId+' exact native position '+JSON.stringify({point:point.toArray(),expected:expected.toArray(),matrixLive:s.mesh.matrixWorld.elements,matrixOriginal:original.matrix.elements}));vertices++;
   }
  }
 }
 assert(vertices>20000);
});

test('actual static batch rays preserve layer selection and isolated views hide every assembled batch',()=>{
 model.setInspection('building');model.setFacadeLayers('building',0,Array(9).fill(true));scene.updateMatrixWorld(true);
 let rays=0;const position=new THREE.Vector3(),normal=new THREE.Vector3();
 for(const {batch,sources} of model.staticLayerBatches){
  for(const s of [sources[0],sources[sources.length-1]]){
   const g=s.mesh.geometry,p=g.attributes.position,n=g.attributes.normal,ids=[0,1,2].map(i=>g.index?g.index.getX(i):i);
   position.set(0,0,0);normal.set(0,0,0);for(const i of ids){position.add(new THREE.Vector3().fromBufferAttribute(p,i));normal.add(new THREE.Vector3().fromBufferAttribute(n,i));}
   position.multiplyScalar(1/3).applyMatrix4(s.mesh.matrixWorld);normal.normalize().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(s.mesh.matrixWorld));
   const ray=new THREE.Raycaster(position.clone().addScaledVector(normal,.01),normal.clone().negate(),0,.03);
   const nativeHits=ray.intersectObject(s.mesh,false),batchedHits=ray.intersectObject(batch,false).filter(h=>h.batchId===s.batchId);
   assert(nativeHits.length&&batchedHits.length,s.partId+' native and batched triangle witness');
   assert(Math.abs(nativeHits[0].distance-batchedHits[0].distance)<2e-6);assert.deepEqual(nativeLayerRecord(batchedHits[0]),{layer:s.part.userData.layer,system:s.part.userData.system});rays++;
  }
 }
 assert(rays>20);
 for(const mode of ['detail','roof','plinth','layers','building']){
  model.setInspection(mode);model.setFacadeLayers(mode,0,Array(9).fill(true));
  for(const {batch,sources} of model.staticLayerBatches){if(mode==='building')assert(visible(batch));else if(visible(batch))assert(batch.material.transparent&&batch.material.userData.inspectionContext);assert(sources.every(s=>!s.mesh.visible),'Canonical hidden draws never reappear beside the batch');}
 }
});

test('actual retained basement-window picks restore after isolated inspection without new stock',()=>{
 const owners=[...objects.values()].filter(o=>o.userData.component?.kind==='basement-window');
 assert.equal(owners.length,12);
 const component=hit=>{
  const instance=hit.object.userData.components?.[hit.instanceId];if(instance)return instance;
  for(let o=hit.object;o;o=o.parent)if(o.userData.component)return o.userData.component;
  return null;
 };
 for(const owner of owners){
  assert.equal(owner.userData.retained,true);assert.equal(owner.userData.replacement,false);
  assert.equal(owner.userData.newStockPart,false);assert.equal(owner.userData.quantityEligible,false);
  assert.equal(owner.userData.quantity,0);assert.equal(owner.userData.sourceOpening.surveyVerified,false);
  assert.equal(owner.userData.candidate.unknown.existingGlassLayers,null);
 }
 let picks=0;
 for(const mode of ['building','plinth','roof','detail','layers','building']){
  model.setInspection(mode);model.setFacadeLayers(mode,0,Array(9).fill(true));
  model.setPlinthSpread(mode==='plinth'?82:0,Array(5).fill(true));scene.updateMatrixWorld(true);
  for(const opening of basementOpenings){
   const owner=owners.find(o=>o.userData.basementOpeningId===opening.id);assert(owner);
   const face=owner.parent,point=new THREE.Vector3(opening.x,opening.y,.4).applyMatrix4(face.matrixWorld);
   const direction=new THREE.Vector3(0,0,-1).transformDirection(face.matrixWorld);
   const hits=new THREE.Raycaster(point,direction,0,1).intersectObject(model.building,true).filter(h=>visible(h.object));
   if(mode!=='building'){assert(visible(owner),'Retained basement remains in situ: '+mode);owner.traverse(o=>{if(o.isMesh)assert(o.material.transparent&&o.userData.inspectionContext,'Context is transparent, never an extra physical window');});continue;}
   assert(hits.length,opening.id+' retains a selectable actual surface in '+mode);
   const c=component(hits[0]);assert.equal(c?.kind,'basement-window',opening.id+' nearest visible hit');
   assert(c.title.startsWith(opening.id),opening.id+' instance preserves its own source identity');
   assert.match(c.note,/не замовляється/);picks++;
  }
 }
 assert.equal(picks,24);model.setPlinthSpread(0,Array(5).fill(true));
});

function glazingFixture(){
 const root=new THREE.Group(),window=new THREE.Group(),other=new THREE.Group();root.add(window,other);
 window.position.set(8,4,5.62);window.rotation.y=Math.PI;window.userData.component={kind:'window',title:'SE-W07'};
 const units=[0,1].map(leafId=>createGlazingUnit(THREE,window,{windowId:'SE-W07',leafId,width:.61,height:1.18,cx:leafId?.38:-.38,inspectionRepresentation:true}));
 const neighbour=createGlazingUnit(THREE,other,{windowId:'SE-W08',leafId:0,width:.61,height:1.18});
 root.updateMatrixWorld(true);return {root,window,units,neighbour};
}

test('glazing selection scope, idempotent spacing and clones preserve canonical physical IDs',()=>{
 const {root,window,units,neighbour}=glazingFixture();
 const stationary=[];window.traverse(o=>{if(o.userData.glazingRole&&o.userData.glazingRole!=='physical-pane')stationary.push([o,o.position.clone()]);});
 const geometry=new Map();window.traverse(o=>{if(o.isMesh)geometry.set(o,o.geometry);});
 const overview=setNativeGlazingInspection(root,false,{window});assert(overview&&!overview.isEmpty());
 for(let spread=0;spread<=100;spread++){
  const box=setNativeGlazingInspection(root,true,{window,spread});assert(box&&!box.isEmpty());
  for(const {group,physical,proxy,plan} of units){assert(physical.visible&&!proxy.visible);for(const part of plan.parts){let pane;group.traverse(o=>{if(o.userData.partId===part.id)pane=o;});assert(pane);assert.equal(pane.geometry,geometry.get(pane));assert.equal(pane.userData.quantityEligible,false);if(part.role==='physical-pane'){const expected=new THREE.Vector3(...part.position).add(new THREE.Vector3(0,0,part.paneIndex*.18*spread/100));assert(pane.position.distanceTo(expected)<1e-12);pane.geometry.computeBoundingBox();assert(box.clone().expandByScalar(1e-7).containsBox(pane.geometry.boundingBox.clone().applyMatrix4(pane.matrixWorld)));}}}
  assert.equal(neighbour.physical.visible,false,'Selected detail cannot expose the neighbouring house IGU');
 }
 for(const [o,p] of stationary)assert(o.position.equals(p),'Spacers/seals/proxy/group positions stay assembled');
 const clone=window.clone(true);root.add(clone);setNativeGlazingInspection(root,true,{window:clone,spread:0});
 clone.traverse(o=>{if(o.userData.glazingRole==='physical-pane')assert(o.position.distanceTo(new THREE.Vector3(...o.userData.assembledPosition))<1e-12);});
 assert(units[0].physical.children.some(o=>o.userData.paneIndex===2&&Math.abs(o.position.z-o.userData.assembledPosition[2]-.36)<1e-12),'Clone reset cannot move the original');
 setNativeGlazingInspection(root,false,{window});setNativeGlazingInspection(root,false,{window});
 for(const {physical,proxy} of units){assert(!physical.visible&&proxy.visible);physical.traverse(o=>{if(o.userData.glazingRole==='physical-pane')assert(o.position.distanceTo(new THREE.Vector3(...o.userData.assembledPosition))<1e-12);});}
 const ray=new THREE.Raycaster(window.localToWorld(new THREE.Vector3(-.38,0,.5)),new THREE.Vector3(0,0,-1).transformDirection(window.matrixWorld));
 const hit=ray.intersectObject(window,true).find(h=>visible(h.object));assert(hit);assert.equal(hit.object.userData.glazingRole,'runtime-proxy');assert.equal(hit.object.userData.quantity,0);assert.equal(hit.object.userData.representationOf,units[0].plan.unitId);
});

test('disputed A07 renders without stock and rejects untyped inventory exclusions atomically',()=>{
 const {root,window,units}=glazingFixture();
 const disputed=createGlazingUnit(THREE,root,{windowId:'SE-W20',leafId:0,width:.92,height:.31,
  quantityEligible:false,replacementStatus:'disputed',compositionAuthority:'disputed source candidate',
  sourceConflict:'Ark26 basement schedule versus §5.7 retained basement',sourceFacts:{type:'A-07',paneCount:null,spacerMaterial:null}});
 const box=setNativeGlazingInspection(root,true,{spread:82});assert(box&&!box.isEmpty());
 disputed.physical.traverse(o=>{if(o.userData.physical)assert(!o.userData.quantityEligible&&!o.userData.newStockPart);});
 setNativeGlazingInspection(root,false);const pose=units[0].physical.children[0].position.clone();
 disputed.group.userData.sourceConflict=null;
 assert.throws(()=>setNativeGlazingInspection(root,true,{spread:100}),/Invalid native glazing inventory policy/);
 assert(!units[0].physical.visible&&units[0].proxy.visible);assert(units[0].physical.children[0].position.equals(pose));
 disputed.group.userData.sourceConflict='restored';disputed.group.userData.replacementStatus='source-scheduled';
 assert.throws(()=>setNativeGlazingInspection(root,true,{spread:100}),/Invalid native glazing inventory policy/);
});

test('glazing rejects malformed state atomically and remains outside native static batches',()=>{
 const {root,window,units}=glazingFixture();
 const material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry(.1,.1,.1);
 for(let i=0;i<2;i++){const mesh=new THREE.Mesh(geometry,material);mesh.position.x=i;root.add(mesh);}
 const snapshots=[];window.traverse(o=>snapshots.push({o,parent:o.parent,position:o.position.clone(),visible:o.visible,geometry:o.geometry}));
 const batch=context.batch(root,[]);assert.equal(batch.removedMeshes,2);assert.equal(batch.instanceBatches,1);
 for(const s of snapshots){assert.equal(s.o.parent,s.parent);assert.equal(s.o.geometry,s.geometry);}
 for(const state of [{enabled:1,spread:0},{enabled:true,spread:NaN},{enabled:true,spread:-1},{enabled:true,spread:101}])assert.throws(()=>setNativeGlazingInspection(root,state.enabled,{window,spread:state.spread}),/Invalid/);
 const bad=units[1].physical.children.find(o=>o.userData.paneIndex===2),original=bad.userData.assembledPosition;bad.userData.assembledPosition=[0,NaN,0];
 assert.throws(()=>setNativeGlazingInspection(root,true,{window,spread:80}),/Invalid native glazing pane/);bad.userData.assembledPosition=original;
 for(const s of snapshots){assert.equal(s.o.visible,s.visible);assert(s.o.position.equals(s.position));}
 assert.throws(()=>setNativeGlazingInspection(root,true,{window:new THREE.Group()}),/outside/);
 assert.equal(setNativeGlazingInspection(new THREE.Group(),false),null,'Older assets remain loadable until the paired glazing asset is rebuilt');
});

test('glazing glTF extras/index readback activates hidden native surfaces without quantity duplication',async()=>{
 const {root,window}=glazingFixture();
 // Reproduce the native authoring wrapper: semantic owner plus an initially
 // hidden indexed NativeSurface. Its extras survive the real glTF codec below.
 root.traverse(o=>{if(o.userData.glazingRole==='physical-pane')o.visible=false;});
 const meshes=[];root.traverse(o=>{if(o.isMesh)meshes.push(o);});
 for(const mesh of meshes){const owner=new THREE.Group();owner.position.copy(mesh.position);owner.quaternion.copy(mesh.quaternion);owner.scale.copy(mesh.scale);owner.name=mesh.name;owner.userData={source_extras_json:JSON.stringify(mesh.userData),native_visible:mesh.visible};mesh.parent.add(owner);owner.add(mesh);mesh.position.set(0,0,0);mesh.quaternion.identity();mesh.scale.set(1,1,1);mesh.userData={native_visible:mesh.visible};}
 root.traverse(o=>{if(!o.isMesh&&!o.userData.source_extras_json)o.userData={source_extras_json:JSON.stringify(o.userData),native_visible:o.visible};});
 const reader=globalThis.FileReader;
 globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
 let bytes;try{bytes=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:false});}finally{if(reader===undefined)delete globalThis.FileReader;else globalThis.FileReader=reader;}
 const gltf=await new GLTFLoader().parseAsync(bytes,'');context.hydrate(gltf.scene);
 const selected=[];gltf.scene.traverse(o=>{if(o.userData.component?.title==='SE-W07')selected.push(o);});assert.equal(selected.length,1);
 const imported=selected[0],ids=[];imported.traverse(o=>{if(o.userData.partId)ids.push(o.userData.partId);});assert.equal(new Set(ids).size,ids.length);
 const before=new Map();imported.traverse(o=>{if(o.isMesh)before.set(o,{positions:Array.from(o.geometry.attributes.position.array),indices:o.geometry.index?Array.from(o.geometry.index.array):null});});
 setNativeGlazingInspection(gltf.scene,false,{window:imported});
 imported.traverse(o=>{if(o.userData.glazingRole==='physical-pane')assert(!visible(o));});
 const bounds=setNativeGlazingInspection(gltf.scene,true,{window:imported,spread:82});assert(bounds&&!bounds.isEmpty());let panes=0;
 imported.traverse(o=>{if(o.userData.glazingRole==='physical-pane'){panes++;assert(visible(o));assert.equal(o.userData.quantityEligible,false);assert(o.scale.equals(new THREE.Vector3(1,1,1)));o.traverse(mesh=>{if(mesh.isMesh){assert(visible(mesh),'Previously hidden NativeSurface must really render');assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),before.get(mesh).positions);assert(mesh.geometry.index,"Metric pane must retain its indexed triangles");assert.deepEqual(Array.from(mesh.geometry.index.array),before.get(mesh).indices);}});}if(o.userData.glazingRole==='runtime-proxy')assert(!visible(o));});assert.equal(panes,6);
 const batch=context.batch(gltf.scene,[]);assert.equal(batch.removedMeshes,0,'Read-back metadata protects the complete authored assembly');
});

test('actual native glazing asset retains 36 canonical A01 windows plus quantity-free inspection projections',t=>{
 const units=[];scene.traverse(o=>{if(o.userData.glazingAssembly===true)units.push(o);});
 if(!units.length){t.skip('Current paired asset predates glazing; final Blender rebuild/readback remains required');return;}
 const whole=units.filter(o=>!o.userData.inspectionRepresentation),projections=units.filter(o=>o.userData.inspectionRepresentation);
 const expected=Array.from({length:18},(_,i)=>String(i+1).padStart(2,'0')).flatMap(n=>['SE-W'+n,'NW-W'+n]);
 const stock=whole.filter(o=>expected.includes(o.userData.windowId));
 assert.equal(whole.length,157);assert.equal(whole.filter(o=>o.userData.quantityEligible).length,151);
 assert.equal(whole.filter(o=>o.userData.replacementStatus==='disputed'&&!o.userData.quantityEligible).length,6);
 assert.deepEqual([...new Set(stock.map(o=>o.userData.windowId))].sort(),expected.sort());assert.equal(stock.length,72);assert.equal(projections.length,4);
 for(const unit of units){
  const within=o=>{for(let a=o;a&&a!==unit.parent;a=a.parent)if(!a.visible)return false;return true;};
  const panes=[],proxies=[];unit.traverse(o=>{if(o.userData.glazingRole==='physical-pane')panes.push(o);if(o.userData.glazingRole==='runtime-proxy')proxies.push(o);});
  assert.equal(panes.length,3);assert.equal(proxies.length,1);assert.equal(proxies[0].userData.quantity,0);assert.equal(proxies[0].userData.quantityEligible,false);assert.equal(proxies[0].userData.representationOf,unit.userData.unitId);
  assert.equal(proxies[0].userData.partId,unit.userData.unitId+'-OPTICAL');
  for(const pane of panes){assert.equal(pane.userData.partId,unit.userData.unitId+'-P'+(pane.userData.paneIndex+1));assert.equal(pane.userData.quantityEligible,unit.userData.quantityEligible);assert(pane.scale.distanceTo(new THREE.Vector3(1,1,1))<1e-7);assert(meshCount(pane)>0,'Physical native pane cannot be an empty authoring owner');}
  model.setGlazingInspection(false,{window:unit});
  const original=panes.map(pane=>({centre:new THREE.Box3().setFromObject(pane).getCenter(new THREE.Vector3()),auto:pane.matrixAutoUpdate}));
  for(const pane of panes)pane.matrixAutoUpdate=false;
  const box=model.setGlazingInspection(true,{window:unit,spread:82});assert(box&&!box.isEmpty());
  for(const [i,pane] of panes.entries()){
   const expected=new THREE.Vector3(...pane.userData.explodeDirection).applyMatrix3(new THREE.Matrix3().setFromMatrix4(pane.parent.matrixWorld)).multiplyScalar(pane.userData.paneIndex*.18*.82);
   const actual=new THREE.Box3().setFromObject(pane).getCenter(new THREE.Vector3()).sub(original[i].centre);
   assert(actual.distanceTo(expected)<2e-6,'Actual indexed world geometry must separate, even with matrixAutoUpdate=false: '+pane.userData.partId);
  }
  for(const pane of panes){assert(within(pane));pane.traverse(mesh=>{if(mesh.isMesh){assert(within(mesh));assert(!mesh.isInstancedMesh);assert(box.clone().expandByScalar(1e-6).containsBox(new THREE.Box3().setFromObject(mesh)));}});}
  assert(!within(proxies[0]));model.setGlazingInspection(false,{window:unit});
  for(const [i,pane] of panes.entries()){
   assert(new THREE.Box3().setFromObject(pane).getCenter(new THREE.Vector3()).distanceTo(original[i].centre)<2e-6,'Reset must restore actual geometry, not only the position property');
   pane.matrixAutoUpdate=original[i].auto;
  }
 }
});

test('actual native gasket instances retain unit visibility, canonical parts, world triangles and inspection reset',t=>{
 const metrics=model.nativeAsset.glazingGasketBatchResult;
 assert(metrics.drawsSaved>=157,'Negative control: omitted gasket batching must fail this gate');
 const units=[];scene.traverse(o=>{if(o.userData.glazingAssembly)units.push(o);});
 let represented=0,batches=0,visibleSaving=0,maxDrift=0,picks=0;
 for(const unit of units){
  const records=unit.staticGlazingGaskets;assert.equal(records.length,1,unit.userData.unitId);const b=records[0],instance=b.instance;batches++;
  assert.equal(instance.parent,unit);assert.equal(instance.count,2);assert.equal(instance.userData.quantity,0);assert.equal(instance.userData.quantityEligible,false);assert.equal(instance.userData.physical,false);assert.equal(instance.userData.partId,undefined);
  if(visible(unit))visibleSaving+=b.sources.length-1;
  const originalMatrix=instance.instanceMatrix.array.slice(),stock=[];unit.traverse(o=>{if(o.userData.physical)stock.push(o.userData.partId);});
  for(const [i,r] of b.sources.entries()){
   represented++;assert.equal(r.partOwner.parent,unit);assert.equal(r.partOwner.userData.glazingRole,'mount-gasket');assert(!r.mesh.visible);assert(r.mesh.matrixWorld.equals(r.matrix));assert.equal(instance.geometry,r.mesh.geometry);assert.equal(instance.material,r.mesh.material);
   for(const flag of ['castShadow','receiveShadow','renderOrder','frustumCulled','customDepthMaterial','customDistanceMaterial'])assert.equal(instance[flag],r.mesh[flag]);assert.equal(instance.layers.mask,r.mesh.layers.mask);
   const matrix=new THREE.Matrix4();instance.getMatrixAt(i,matrix);matrix.premultiply(instance.matrixWorld);const pos=instance.geometry.attributes.position;
   for(let v=0;v<pos.count;v++){const a=new THREE.Vector3().fromBufferAttribute(pos,v).applyMatrix4(matrix),b=new THREE.Vector3().fromBufferAttribute(pos,v).applyMatrix4(r.matrix),error=a.distanceTo(b);assert(error<2e-6);maxDrift=Math.max(maxDrift,error);}
   const index=instance.geometry.index,triangle=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(pos,index?index.getX(j):j).applyMatrix4(matrix)),centre=triangle[0].clone().add(triangle[1]).add(triangle[2]).multiplyScalar(1/3),normal=triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).normalize();
   const ray=new THREE.Raycaster(centre.clone().addScaledVector(normal,.0001),normal.clone().negate(),0,.0002),hit=ray.intersectObject(instance,false).find(h=>h.instanceId===i);assert(hit,'Actual indexed gasket triangle must be pickable');const record=nativeGlazingPartRecord(hit);assert.equal(record.owner,r.partOwner);assert.equal(record.partId,r.partId);assert.equal(record.assembly,unit);assert.equal(record.role,'mount-gasket');picks++;
  }
  const wasVisible=unit.visible;unit.visible=false;assert(!visible(instance));unit.visible=wasVisible;
  const neighbour=units.find(o=>o!==unit),neighbourVisible=neighbour.visible;neighbour.visible=false;assert.equal(visible(instance),visible(unit),'Another IGU must not control this batch');neighbour.visible=neighbourVisible;
  for(const spread of [0,82,100]){model.setGlazingInspection(true,{window:unit,spread});assert.deepEqual(instance.instanceMatrix.array,originalMatrix);assert(b.sources.every(r=>!r.mesh.visible));assert.equal(instance.visible,true);}
  model.setGlazingInspection(false,{window:unit});assert.deepEqual(instance.instanceMatrix.array,originalMatrix);assert(b.sources.every(r=>!r.mesh.visible));assert(b.sources.every(r=>r.mesh.matrixWorld.equals(r.matrix)));
  const after=[];unit.traverse(o=>{if(o.userData.physical)after.push(o.userData.partId);});assert.deepEqual(after,stock,'Virtual representations cannot add physical stock');
  const cloned=unit.clone(true),cloneInstance=cloned.children.find(o=>o.userData.staticGlazingGasketInstances);assert.equal(nativeGlazingPartRecord({object:cloneInstance,instanceId:1}).partId,b.sources[1].partId);
  assert.equal(nativeGlazingPartRecord({object:instance,instanceId:2}),null);assert.equal(nativeGlazingPartRecord({object:instance,instanceId:-1}),null);
 }
 assert.equal(represented,metrics.representedMeshes);assert.equal(batches,metrics.instanceBatches);assert.equal(metrics.drawsSaved,represented-batches);assert.equal(visibleSaving,157);
 assert.deepEqual(batchGlazingMountGaskets(scene),JSON.parse(JSON.stringify(metrics)),'Repeated binding must neither duplicate instances nor resurface canonical meshes');
 t.diagnostic(JSON.stringify({represented,instanceBatches:batches,allUnitsDrawsSaved:metrics.drawsSaved,wholeBuildingVisibleDrawsSaved:visibleSaving,actualIndexedTrianglePicks:picks,maxWorldVertexDriftM:maxDrift}));
});

test('gasket batching rejects role, ancestry, visibility, render hooks and mismatched geometry without touching panes or proxies',()=>{
 for(const scenario of ['good','role','physical','ancestor','hidden','raycast','hook','flags','material','color']){
  const {root,units,window,neighbour}=glazingFixture(),unit=units[0].group,gaskets=unit.children.filter(o=>o.userData.glazingRole==='mount-gasket');assert.equal(gaskets.length,2);
  const before=[];unit.traverse(o=>{if(o.userData.glazingRole==='physical-pane'||o.userData.glazingRole==='runtime-proxy')before.push({o,parent:o.parent,matrix:o.matrix.clone(),visible:o.visible});});
  if(scenario==='role')gaskets[0].userData.glazingRole='physical-pane';
  if(scenario==='physical')gaskets[0].userData.physical=false;
  if(scenario==='ancestor'){const wrapper=new THREE.Group();unit.add(wrapper);wrapper.add(gaskets[0]);}
  if(scenario==='hidden')gaskets[0].visible=false;
  if(scenario==='raycast')gaskets[0].raycast=()=>{};
  if(scenario==='hook')gaskets[0].onBeforeRender=()=>{};
  if(scenario==='flags')gaskets[0].castShadow=!gaskets[1].castShadow;
  if(scenario==='material')gaskets[0].material=gaskets[0].material.clone();
  if(scenario==='color'){gaskets[0].geometry=gaskets[0].geometry.clone();gaskets[0].geometry.setAttribute('color',new THREE.Float32BufferAttribute(Array(gaskets[0].geometry.attributes.position.count*3).fill(1),3));}
  const metric=batchGlazingMountGaskets(unit);
  assert.equal(metric.drawsSaved,scenario==='good'?1:0,scenario);assert.equal(unit.staticGlazingGaskets.length,scenario==='good'?1:0);
  for(const snap of before){assert.equal(snap.o.parent,snap.parent);assert(snap.o.matrix.equals(snap.matrix));assert.equal(snap.o.visible,snap.visible);}
  assert.equal(neighbour.group.staticGlazingGaskets,undefined);assert.equal(units[1].group.staticGlazingGaskets,undefined,'Selected unit scope must not batch another leaf');
  if(scenario==='good'){const instance=unit.staticGlazingGaskets[0].instance;instance.userData.unitId='forged-other-unit';assert.equal(nativeGlazingPartRecord({object:instance,instanceId:0}),null);}
 }
});

test('actual selected glazing contours cache once and follow indexed pane geometry without adding stock',()=>{
 const window=model.fieldWindow,originalMeshCount=meshCount(window),panes=[],meshes=[],partIds=[];
 window.traverse(o=>{if(o.userData.partId)partIds.push(o.userData.partId);if(o.userData.glazingRole==='physical-pane')panes.push(o);});
 assert.equal(panes.length,6);for(const pane of panes)pane.traverse(o=>{if(o.isMesh)meshes.push(o);});assert.equal(meshes.length,6);
 const source=meshes.map(mesh=>({mesh,geometry:mesh.geometry,material:mesh.material,position:mesh.geometry.getAttribute('position').array.slice(),indices:mesh.geometry.index.array.slice()}));
 let cached;
 for(const spread of [82,27,0,100,82]){
  model.setGlazingInspection(true,{window,spread});window.updateWorldMatrix(true,true);
  const edges=[];window.traverse(o=>{if(o.userData.inspectionEdge===true)edges.push(o);});assert.equal(edges.length,6);
  if(!cached)cached=edges;else assert.deepEqual(edges,cached,'Retargets cannot create duplicate contours');
  for(const [i,mesh] of meshes.entries()){
   const edge=mesh.children.find(o=>o.userData.inspectionEdge===true);assert(edge?.isLineSegments);assert.equal(edge.visible,spread>0,'Assembled physical inspection at zero has no presentation contours');
   assert.equal(edge.parent,mesh);assert.equal(edge.userData.type,'inspection-edge');assert.equal(edge.userData.physical,false);assert.equal(edge.userData.quantityEligible,false);assert.equal(edge.userData.quantity,0);
   assert.equal(edge.userData.representationOf,panes[i].userData.partId);assert.equal(edge.userData.partId,undefined);
   assert.equal(edge.material.opacity,.65);assert.equal(edge.material.depthWrite,false);
   assert(edge.matrixWorld.elements.every((v,j)=>Math.abs(v-mesh.matrixWorld.elements[j])<1e-12),'Contours inherit the exact native mesh world transform');
   const a=new THREE.Box3().setFromObject(edge),b=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);assert(a.min.distanceTo(b.min)<1e-6&&a.max.distanceTo(b.max)<1e-6,'Edge bounds are the actual exported pane bounds');
   const hits=[];edge.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0,'Presentation contours cannot steal physical selection');
  }
 }
 model.setGlazingInspection(false,{window});for(const edge of cached)assert.equal(edge.visible,false);
 const after=[];window.traverse(o=>{if(o.userData.partId)after.push(o.userData.partId);});assert.deepEqual(after,partIds,'Contours never become physical stock parts');assert.equal(meshCount(window),originalMeshCount,'Presentation lines never add native meshes');
 for(const {mesh,geometry,material,position,indices} of source){assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.deepEqual(mesh.geometry.attributes.position.array,position);assert.deepEqual(mesh.geometry.index.array,indices);}
});

function actualVertexBounds(root){
 root.updateWorldMatrix(true,true);const box=new THREE.Box3(),point=new THREE.Vector3(),instance=new THREE.Matrix4();
 root.traverse(mesh=>{const p=mesh.geometry?.attributes.position;if(!mesh.isMesh||!p)return;for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++){if(mesh.isInstancedMesh)mesh.getMatrixAt(i,instance);else instance.identity();const matrix=mesh.matrixWorld.clone().multiply(instance);for(let j=0;j<p.count;j++)box.expandByPoint(point.fromBufferAttribute(p,j).applyMatrix4(matrix));}});return box;
}
test('actual native roof bounds preserve five source phases and cover every animated profile',()=>{
 const plan=planRoofAssembly(1),partIds=new Set();
 model.roofCut.traverse(o=>{if(o.userData.partId){partIds.add(o.userData.partId);assert(meshCount(o)>0,'Every moving roof part owns actual native geometry: '+o.userData.partId);}});
 assert.deepEqual([...partIds].sort(),plan.inspection.map(p=>p.partId).sort(),'Every current roof inspection source part must have a real native owner');
 for(const [i,group] of model.roofGroups.entries()){
  assert.equal(group.userData.roofLayer.id,plan.layers[i].id);
  assert(Math.abs(group.position.y-roofLayerOffsets[i])<1e-6,'Assembled native layer retains the current source phase');
 }
 const original=model.roofGroups.map(group=>({position:group.position.clone(),quaternion:group.quaternion.clone(),scale:group.scale.clone()}));
 const api=bindRoofInspection(model.roofCut,model.roofGroups),forecast=api.getRoofBounds(100).union(api.getRoofBounds(0));
 const normal=new THREE.Vector3(0,1,0).transformDirection(model.roofCut.matrixWorld);
 for(let spread=0;spread<=100;spread++){
  api.setRoofSpread(spread);
  const layerBounds=api.getRoofLayerBounds();
  for(const [i,group] of model.roofGroups.entries()){
   const actual=actualVertexBounds(group),delta=group.position.clone().sub(original[i].position);
   assert(layerBounds[i].clone().expandByScalar(1e-6).containsBox(actual),`Source layer ${i}, spread ${spread}`);
   assert(forecast.clone().expandByScalar(1e-6).containsBox(actual));
   assert(Math.abs(delta.y-i*.36*spread/100)<1e-9&&delta.x===0&&delta.z===0);
   assert.equal(group.quaternion.angleTo(original[i].quaternion),0);assert.equal(group.scale.distanceTo(original[i].scale),0);
   let mesh;group.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});assert(mesh);assert.deepEqual(nativeLayerRecord({object:mesh}),{layer:i,system:'roof'});
   const centre=actual.getCenter(new THREE.Vector3()),volume=boundsVolume(layerBounds[i].min.toArray(),layerBounds[i].max.toArray()),start=[layerBounds[i].max.x+1,centre.y,centre.z],near=[layerBounds[i].max.x+.075,centre.y,centre.z],safe=constrainCamera(start,near,[volume]);
   assert(inVolume(near,volume));assert(!inVolume(safe,volume));assert(safe[0]-layerBounds[i].max.x>=.12);
  }
 }
 const parent=model.roofCut.parent,before=parent.quaternion.clone();parent.rotation.y+=.27;parent.updateMatrixWorld(true);
 assert(api.getRoofBounds().expandByScalar(1e-6).containsBox(actualVertexBounds(model.roofCut)),'Bounds follow the live parent world transform');parent.quaternion.copy(before);parent.updateMatrixWorld(true);
 assert(normal.y>.9&&normal.z>0,'Positive parent Y is the front roof outward normal');
 const poses=model.roofGroups.map(g=>g.position.toArray());for(const value of [NaN,-1,101])assert.throws(()=>api.setRoofSpread(value));assert.throws(()=>api.setRoofSpread(5,[true]));assert.deepEqual(model.roofGroups.map(g=>g.position.toArray()),poses,'Invalid roof commands cannot partly mutate the imported assembly');
 api.setRoofSpread(0,[false,true,true,true,true]);assert.equal(model.roofGroups[0].visible,false);assert(!api.getRoofBounds().isEmpty(),'Hidden layers retain a stable assembly frame');
 api.setRoofSpread(0);for(const [i,g] of model.roofGroups.entries())assert.equal(g.position.distanceTo(original[i].position),0);
 const empty=new THREE.Group();assert.throws(()=>bindRoofInspection(empty,Array.from({length:5},()=>new THREE.Group())),/no geometry/);
});

test('actual app roof range retargets smoothly and fits current plus target geometry on resize',async()=>{
 const appSource=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const fn=name=>{const start=appSource.indexOf('function '+name+'('),brace=appSource.indexOf('{',appSource.indexOf(')',start));let depth=1;for(let i=brace+1;i<appSource.length;i++){if(appSource[i]==='{')depth++;if(appSource[i]==='}'&&!--depth)return appSource.slice(start,i+1);}throw Error(name);};
 let time=0,next=0,frames=new Map(),handler,lastPose,flights=0,resizes=0,ctx;
 const elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{value:0,addEventListener(kind,callback){if(id==='explode')handler=callback;}});return elements.get(id);};
 const roofAPI=bindRoofInspection(model.roofCut,model.roofGroups),nativeModel={...roofAPI,setPlinthSpread(){},setFacadeSpread(){},getInspectionBounds:spread=>roofAPI.getRoofBounds(spread),getInspectionLayerBounds:spread=>roofAPI.getRoofLayerBounds(spread)};
 const camera=new THREE.PerspectiveCamera(36,1280/598,.1,450);camera.position.set(35,22,55);const controls={target:new THREE.Vector3(0,4.3,1),update(){camera.lookAt(this.target);lastPose={position:camera.position.toArray(),target:this.target.toArray(),zoom:camera.zoom};resizes++;}};
 const glazingFixture={balconyFocus:null,selectedBalcony:null,balconyAmount:0,balconyTarget:0,balconyManual:false,balconyMotion:{stop(){}},resetBalconyFocus(){},nativeBalconyRecord:()=>null,glazingInspect:false,glazingSpread:0,glazingClosures:[],glazingStops:0,glazingMotion:{stop(){ctx.glazingStops++;}},setGlazingView(enabled,options){assert.equal(enabled,false);ctx.glazingInspect=false;ctx.glazingSpread=0;ctx.glazingClosures.push({enabled,options:JSON.parse(JSON.stringify(options))});}};
 ctx=vm.createContext({...glazingFixture,THREE,nativeModel,$,document:{querySelectorAll:()=>[]},mode:'roof',amount:0,roofTarget:82,entranceFocus:null,entranceAmount:0,entranceTarget:0,entranceManual:false,pendingMode:null,pendingNavigation:null,framingBox:null,app:{dataset:{}},viewer:{clientWidth:1280,clientHeight:598},perspectiveCamera:camera,camera,controls,orthographic:false,cameraManual:false,navigationCompletion:null,lastSafeCamera:null,dimensionVisible:false,renderer:null,visibility:{facade:Array(9).fill(true),roof:Array(5).fill(true),plinth:Array(5).fill(true)},visible:Array(5).fill(true),layerGroups:[],plinthGroups:[],pins:[],layerZ:[],plinthOffsets:[],setFacadeLayers(){},invalidateShadows(){},protectCamera(){},draw(){},entranceMotion:{stop(){}},cameraFlight:{stop(){}},createScalarMotion:options=>createScalarMotion({...options,now:()=>time,schedule:cb=>{frames.set(++next,cb);return next;},cancel:id=>frames.delete(id)}),reduced:false,flyTo(pose,options={}){lastPose=pose;camera.position.fromArray(pose.position);controls.target.fromArray(pose.target);camera.zoom=pose.zoom;ctx.cameraManual=false;controls.update();flights++;options.onComplete?.();},setMode(){throw Error('Roof input must keep the selected mode');}});
 ctx.facadeLayers=Array(9).fill({title:'facade'});
 const motion=appSource.slice(appSource.indexOf('const layerMotion='),appSource.indexOf('\nconst cameraFlight='));
 vm.runInContext(motion+'\n'+['updateLayers','bounds','viewBounds','fittedPose','home','fit','resizeView','stopNavigation','afterClosing'].map(fn).join('\n'),ctx);
 vm.runInContext(appSource.slice(appSource.indexOf("$('explode').addEventListener('input'"),appSource.indexOf("$('dimensions').addEventListener")),ctx);
 const step=ms=>{time+=ms;const current=[...frames.values()];frames.clear();current.forEach(cb=>cb());};
 ctx.home({immediate:true});const originalPose=camera.position.clone(),originalTarget=controls.target.clone(),originalFlights=flights;
 $('explode').value=82;handler();assert.equal(ctx.glazingInspect,false);assert(ctx.glazingStops>0);assert.equal(ctx.amount,82);assert.equal(ctx.roofTarget,82);assert.equal(frames.size,0);
 $('explode').value=27;handler();assert.equal(ctx.amount,27,'The native roof follows input before release');assert.equal(frames.size,0);assert.equal(flights,originalFlights,'Dragging never steals camera ownership');assert(camera.position.equals(originalPose)&&controls.target.equals(originalTarget));
 for(const [w,h] of [[384,600],[1280,598],[1920,900]]){ctx.viewer.clientWidth=w;ctx.viewer.clientHeight=h;ctx.resizeView();assert.equal(ctx.roofTarget,27);assert.equal(ctx.amount,27);assert.equal(frames.size,0);assert(camera.position.equals(originalPose)&&controls.target.equals(originalTarget),'Manual camera stays free across resize');}
 assert.equal(ctx.mode,'roof');
 ctx.stopNavigation();assert.equal(ctx.roofTarget,27);
 let restored;ctx.afterClosing(value=>{restored=value;});assert.equal(ctx.roofTarget,0);step(180);assert(ctx.amount>0&&ctx.amount<27);
 ctx.resizeView();step(450);
 assert.equal(ctx.amount,0);assert.equal(restored,27,'A resize while closing cannot resurrect the old roof target or lose pending navigation');assert.equal(ctx.pendingNavigation,null);
 nativeModel.setRoofSpread(0);
});

test('entrance hits frame the whole imported assembly and preserve every source part before batching',()=>{
 assert.equal(model.entrances.length,3);assert.equal(entranceSnapshots.length,3);
 for(const [i,entry] of model.entrances.entries()){
  const original=entranceSnapshots.find(e=>e.owner===entry.owner);assert(original);assert.equal(entry.index,i+1);
  assert(entry.bounds.min.distanceTo(original.bounds.min)<1e-6&&entry.bounds.max.distanceTo(original.bounds.max)<1e-6);
  const size=entry.bounds.getSize(new THREE.Vector3());assert(size.x>2.7&&size.y>2&&size.z>1.3,'Focus must include door, canopy and landing');
  assert(original.meshes.length>2,'Imported material surfaces must stay below the entrance owner');
  for(const {mesh,matrix} of original.meshes){
   const record=nativeEntranceRecord({object:mesh});assert(record);assert.equal(record.owner,entry.owner);assert.equal(record.id,entry.id);assert.equal(record.index,entry.index);
   assert(record.bounds.min.distanceTo(original.bounds.min)<1e-6&&record.bounds.max.distanceTo(original.bounds.max)<1e-6,'Small handles and flashing cannot become the whole focus bounds');
   assert(mesh.matrixWorld.elements.every((v,k)=>Math.abs(v-matrix.elements[k])<1e-6),'Native entrance world transform survives loading');
   assert.equal(nativeLayerRecord({object:mesh}),null);
  }
  const centre=entry.bounds.getCenter(new THREE.Vector3()),ray=new THREE.Raycaster(new THREE.Vector3(centre.x,.8,entry.bounds.max.z+2),new THREE.Vector3(0,0,-1));
  const hits=ray.intersectObject(model.building,true).filter(h=>visible(h.object));assert(hits.length);
  assert.equal(nativeEntranceRecord(hits[0])?.id,entry.id,'Nearest visible front hit must select this entrance, not the facade behind it');
 }
 assert.equal(nativeEntranceRecord({object:panels('SE')[0]}),null);
});

test('all 18 native BAL owners retain their exact source meshes, ancestry and selection before batching',()=>{
 assert.equal(model.balconies.length,18);assert.equal(balconySnapshots.length,18);
 assert.deepEqual(Array.from(model.balconies,e=>e.id).sort(),Array.from({length:18},(_,i)=>'BAL-'+String(i+1).padStart(2,'0')));
 for(const entry of model.balconies){
  const original=balconySnapshots.find(e=>e.id===entry.id);assert.equal(entry.owner,original.owner);assert.equal(meshCount(entry.owner)-entry.staticBatches.length,original.meshes.length,'All canonical meshes remain; only quantity-free draw instances are added');
  for(const {mesh,matrix,parent} of original.meshes){
   assert.equal(mesh.parent,parent,'BAL parts cannot be detached into unrelated static instances');
   assert.equal(nativeBalconyRecord({object:mesh})?.id,entry.id);assert.equal(nativeLayerRecord({object:mesh}),null,'Floor layer numbers never select facade layers');
   assert(mesh.matrixWorld.elements.every((v,i)=>Math.abs(v-matrix.elements[i])<1e-6));
  }
  const floor=model.getBalconyFloorBounds(entry.id);assert(!floor.isEmpty());assert(floor.getSize(new THREE.Vector3()).y<.6,'Focus must frame the floor, not the three-metre post/glass assembly');
  const front=[];entry.owner.traverse(o=>{if(o.userData.partId===entry.id+'-FC-FRONT')front.push(o);});assert.equal(front.length,1);
  const before=front[0].visible;model.setBalconyInspection(entry.id,{enabled:true});assert.equal(front[0].visible,false);model.setBalconyInspection(null,{enabled:false});assert.equal(front[0].visible,before);
 }
 assert.equal(nativeBalconyRecord({object:panels('SE')[0]}),null);
});

test('actual BAL static batches reduce visible draws while preserving exact source geometry, material/flags and native instance picking',t=>{
 const metrics=model.nativeAsset.balconyBatchResult;assert(metrics.drawsSaved>=180,'Negative control: omitting BAL batching must fail this performance gate');assert.equal(metrics.drawsSaved,metrics.representedMeshes-metrics.instanceBatches);
 let drawsBefore=0,drawsAfter=0,maxVertexError=0,instanceHits=0;
 for(const entry of model.balconies){
  const original=balconySnapshots.find(e=>e.id===entry.id),sourceIds=[];entry.owner.traverse(o=>{if(o.userData.partId)sourceIds.push(o.userData.partId);});assert.equal(new Set(sourceIds).size,sourceIds.length);
  drawsBefore+=original.meshes.filter(s=>visible(s.mesh)||entry.staticBatches.some(b=>b.sources.some(r=>r.mesh===s.mesh))).length;
  entry.owner.traverse(o=>{if(o.isMesh&&visible(o))drawsAfter++;});assert(entry.staticBatches.length>0);
  for(const {instance,sources} of entry.staticBatches){
   assert.equal(instance.parent,entry.owner);assert.equal(instance.userData.physical,false);assert.equal(instance.userData.quantityEligible,false);assert.equal(instance.userData.quantity,0);assert.equal(instance.userData.newStockPart,false);assert.equal(instance.userData.partId,undefined);
   assert.deepEqual(Array.from(instance.userData.representationOf),Array.from(sources,s=>s.partId));assert.equal(instance.count,sources.length);
   for(const [i,s] of sources.entries()){
    assert.equal(s.mesh.visible,false,'No visible canonical copy may duplicate the static instance');assert.equal(s.mesh.geometry,original.meshes.find(r=>r.mesh===s.mesh).mesh.geometry);
    assert(s.mesh.matrixWorld.equals(s.matrix),'Canonical source matrices remain bit-for-bit unchanged');assert.equal(instance.material,s.mesh.material);
    for(const flag of ['castShadow','receiveShadow','renderOrder','frustumCulled','customDepthMaterial','customDistanceMaterial'])assert.equal(instance[flag],s.mesh[flag]);assert.equal(instance.layers.mask,s.mesh.layers.mask);
    assert.equal(s.partOwner.userData.assembly==='balcony-floor',false);assert.notEqual(s.partId,entry.id+'-FC-FRONT');assert(!s.mesh.material.transparent&&!s.mesh.material.transmission);
    const matrix=new THREE.Matrix4();instance.getMatrixAt(i,matrix);matrix.premultiply(instance.matrixWorld);
    const a=instance.geometry.getAttribute('position'),b=s.mesh.geometry.getAttribute('position');assert.equal(a.count,b.count);
    for(let k=0;k<a.count;k++){const left=new THREE.Vector3().fromBufferAttribute(a,k).applyMatrix4(matrix),right=new THREE.Vector3().fromBufferAttribute(b,k).applyMatrix4(s.matrix);maxVertexError=Math.max(maxVertexError,left.distanceTo(right));assert(left.distanceTo(right)<2e-6,'World vertices retain source coverage within measured Float32 instance-matrix precision');}
    // Shoot at an actual exported triangle, not an envelope or metadata point.
    const index=instance.geometry.index,ids=[0,1,2].map(k=>index?index.getX(k):k),p=ids.map(k=>new THREE.Vector3().fromBufferAttribute(a,k).applyMatrix4(matrix)),centre=p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1/3),normal=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).normalize();
    const ray=new THREE.Raycaster(centre.clone().addScaledVector(normal,.02),normal.clone().negate()),hits=ray.intersectObject(instance);assert(hits.some(h=>h.instanceId===i));assert.equal(nativeBalconyRecord(hits[0])?.id,entry.id);instanceHits++;
   }
  }
  const originalInstanceMatrices=entry.staticBatches.map(b=>b.instance.instanceMatrix.array.slice());
  for(const spread of [0,82,100]){model.setBalconyInspection(entry.id,{enabled:true,spread});for(const [i,b] of entry.staticBatches.entries()){assert.deepEqual(b.instance.instanceMatrix.array,originalInstanceMatrices[i]);assert(b.sources.every(s=>!s.mesh.visible));}assert(model.getBalconyFloorBounds(entry.id,100).union(model.getBalconyFloorBounds(entry.id,0)).expandByScalar(1e-6).containsBox(model.getBalconyFloorBounds(entry.id)));}
  model.setBalconyInspection(null,{enabled:false});assert(entry.staticBatches.every(b=>b.sources.every(s=>!s.mesh.visible)),'Exit cannot resurface duplicate static originals');
 }
 assert.equal(drawsBefore-drawsAfter,metrics.drawsSaved);assert(instanceHits>=300);const count=model.balconies.reduce((sum,e)=>sum+meshCount(e.owner),0);assert.equal(batchBalconyStatic(model.balconies).drawsSaved,metrics.drawsSaved);assert.equal(model.balconies.reduce((sum,e)=>sum+meshCount(e.owner),0),count,'Repeated binding is idempotent');
 t.diagnostic(JSON.stringify({eligibleStaticSources:metrics.sourceMeshes,representedMeshes:metrics.representedMeshes,staticBatches:metrics.instanceBatches,drawsBefore,drawsAfter,drawsSaved:metrics.drawsSaved,maxVertexErrorMetres:maxVertexError,actualTriangleInstancePicks:instanceHits}));
});

test('BAL batching rejects custom raycasts/render hooks, mismatched render flags/attributes and moving or hidden source parts',()=>{
 const cases=['good','raycast','hook','flags','color','material','floor','hidden','reflection','glass'];
 for(const name of cases){
  const owner=new THREE.Group();owner.userData={balconyId:'BAL-01',component:{kind:'balcony'}};owner.rotation.y=Math.PI;owner.position.set(4,3,-5.62);
  const material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry(.1,.2,.3),meshes=[];
  for(let i=0;i<2;i++){
   const part=new THREE.Group();part.userData={partId:'BAL-01-'+name+'-'+i};owner.add(part);
   const g=name==='color'?geometry.clone():geometry,m=name==='material'?material.clone():material,mesh=new THREE.Mesh(g,m);part.add(mesh);mesh.position.x=i*.5;meshes.push(mesh);
   if(name==='raycast')mesh.raycast=()=>{};
   if(name==='hook')mesh.onBeforeRender=()=>{};
   if(name==='flags')mesh.castShadow=i===0;
   if(name==='color')g.setAttribute('color',new THREE.Float32BufferAttribute(Array(g.attributes.position.count*3).fill(i),3));
   if(name==='floor')part.userData.assembly='balcony-floor';
   if(name==='hidden')part.visible=false;
   if(name==='reflection')mesh.scale.x=-1;
   if(name==='glass')material.transmission=.98;
  }
  owner.updateWorldMatrix(true,true);const entry={id:'BAL-01',owner},metrics=batchBalconyStatic([entry]);
  if(name==='good'){assert.equal(metrics.drawsSaved,1);assert(meshes.every(m=>!m.visible));assert.equal(entry.staticBatches.length,1);assert.equal(entry.staticBatches[0].instance.parent,owner);}else{assert.equal(metrics.instanceBatches,0,name+' is not safe to replace with default static instances');assert(meshes.every(m=>m.visible),'Rejected sources keep original visibility');}
 }
});

async function appPickRay(){
 const appSource=await readFile(new URL('./app.js',import.meta.url),'utf8'),start=appSource.indexOf('  function setPickRay('),end=appSource.indexOf('\n  }',start)+4;assert(start>=0&&end>start);
 const ctx=vm.createContext({THREE});vm.runInContext(appSource.slice(start,end)+'\nglobalThis.pick=setPickRay;',ctx);return ctx.pick;
}
test('actual app orthographic picking repairs reversed-depth ray origin without changing camera projection',async()=>{
 const pick=await appPickRay(),poses=[[0,5.3,-65],[0,5.3,65],[65,5.3,0],[-65,5.3,0]],target=new THREE.Vector3(0,5.3,0);
 for(const pose of poses)for(const reversed of [false,true])for(const zoom of [.5,1,2]){
  const camera=new THREE.OrthographicCamera(-25,25,15,-15,.1,450);camera.position.fromArray(pose);camera.lookAt(target);camera._reversedDepth=reversed;camera.zoom=zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const right=new THREE.Vector3(1,0,0).transformDirection(camera.matrixWorld),forward=camera.getWorldDirection(new THREE.Vector3());
  const centre=camera.position.clone().addScaledVector(forward,58.2).addScaledVector(right,2).add(new THREE.Vector3(0,.7,0));
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4,4),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.position.copy(centre);mesh.quaternion.copy(camera.quaternion);mesh.updateMatrixWorld(true);
  const ndc=centre.clone().project(camera),coords=new THREE.Vector2(ndc.x,ndc.y),legacy=new THREE.Raycaster();legacy.setFromCamera(coords,camera);
  if(reversed)assert.equal(legacy.intersectObject(mesh).length,0,'Negative control: upstream0.180 ortho ray starts behind the visible triangle');else assert(legacy.intersectObject(mesh).length>0);
  const projection=camera.projectionMatrix.clone(),inverse=camera.projectionMatrixInverse.clone(),ray=new THREE.Raycaster();pick(ray,coords,camera);
  const hits=ray.intersectObject(mesh);assert(hits.length>0);assert(hits[0].point.distanceTo(centre)<1e-8);
  assert(Math.abs(ray.ray.origin.clone().sub(camera.position).dot(forward))<1e-8,'Origin must remain in the camera plane, not900m behind it');assert(ray.ray.direction.distanceTo(forward)<1e-12);assert.equal(ray.camera,camera);
  assert(camera.projectionMatrix.equals(projection)&&camera.projectionMatrixInverse.equals(inverse));assert.equal(camera.reversedDepth,reversed);
 }
 const perspective=new THREE.PerspectiveCamera(36,1920/900,.12,450);perspective.position.set(25,15,-40);perspective.lookAt(target);perspective.updateMatrixWorld(true);perspective._reversedDepth=true;perspective.updateProjectionMatrix();
 const ray=new THREE.Raycaster(),expected=new THREE.Raycaster(),coords=new THREE.Vector2(.3,-.2);expected.setFromCamera(coords,perspective);pick(ray,coords,perspective);assert(ray.ray.origin.equals(expected.ray.origin)&&ray.ray.direction.equals(expected.ray.direction),'Perspective picking remains upstream behavior');
});
test('actual reversed-depth NW pick selects each preserved native BAL owner through real exported triangles',async()=>{
 const pick=await appPickRay();
 for(const entry of model.balconies){
  const centre=entry.bounds.getCenter(new THREE.Vector3()),camera=new THREE.OrthographicCamera(-25,25,15,-15,.1,450);camera.position.copy(centre).add(new THREE.Vector3(0,0,-65));camera.lookAt(centre);camera._reversedDepth=true;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const legacy=new THREE.Raycaster();legacy.setFromCamera(new THREE.Vector2(),camera);assert.equal(legacy.intersectObject(entry.owner,true).filter(h=>visible(h.object)).length,0);
  const ray=new THREE.Raycaster();pick(ray,new THREE.Vector2(),camera);const hits=ray.intersectObject(model.building,true).filter(h=>visible(h.object));assert(hits.length>0);assert.equal(nativeBalconyRecord(hits[0])?.id,entry.id,'Nearest visible real triangle must retain its source BAL selection');
 }
});

function balconyFixture(){
 const root=new THREE.Group();root.rotation.y=Math.PI;root.position.z=-5.62;
 const entries=[0,5].map((x,i)=>{
  const id='BAL-'+String(i+1).padStart(2,'0'),owner=new THREE.Group();owner.userData={balconyId:id,component:{kind:'balcony'}};owner.position.x=x;root.add(owner);
  const steel=new THREE.Mesh(new THREE.BoxGeometry(3,.1,1));steel.userData={partId:id+'-STEEL-FLOOR',role:'floor-perimeter'};owner.add(steel);
  const door=new THREE.Mesh(new THREE.BoxGeometry(.72,2.2,.05));door.position.z=-.1;door.userData={partId:id+'-DOOR'};owner.add(door);
  const cover=new THREE.Mesh(new THREE.BoxGeometry(3,.94,.008));cover.position.set(0,.49,1.036);cover.userData.partId=id+'-FC-FRONT';cover.visible=i===0;owner.add(cover);
  const floor=new THREE.Group();owner.add(floor);floor.rotation.x=.1;
  for(const [role,layer] of [['flashing',1],['tape',2],['board',3],['coating',4],['upstand',4]]){
   const part=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(3,role==='board'?.024:.001,1));part.add(mesh);part.position.y=layer*.03;part.updateMatrix();part.matrixAutoUpdate=false;
   part.userData={assembly:'balcony-floor',balconyId:id,partId:id+'-'+role,physical:true,quantityEligible:true,newStockPart:true,inspectionRepresentation:false,layer,floorInspectionRole:role,explodeDirection:[0,Math.cos(Math.atan(1/80)),Math.sin(Math.atan(1/80))]};floor.add(part);
  }
  return {id,owner};
 });root.updateWorldMatrix(true,true);return {root,entries,api:bindBalconyInspection(entries)};
}
test('BAL floor reveal uses authored directions through frozen imported matrices; steel/door/counts and reset remain exact',()=>{
 const {root,entries,api}=balconyFixture(),snapshot=[];root.traverse(o=>snapshot.push({o,position:o.position.clone(),matrix:o.matrixWorld.clone(),visible:o.visible,geometry:o.geometry,metadata:JSON.stringify(o.userData)}));
 const forecast=api.getBalconyFloorBounds(entries[0].id,100).union(api.getBalconyFloorBounds(entries[0].id,0));
 for(const spread of [0,1,37,82,100,27,82]){
  const actual=api.setBalconyInspection(entries[0].id,{enabled:true,spread});assert(forecast.clone().expandByScalar(1e-6).containsBox(actual));
  for(const s of snapshot){const d=s.o.userData;if(d.assembly==='balcony-floor'&&d.balconyId===entries[0].id){
   const expected=new THREE.Vector3(...d.explodeDirection).transformDirection(entries[0].owner.matrixWorld).multiplyScalar(.18*d.layer*spread/100),movement=s.o.getWorldPosition(new THREE.Vector3()).sub(new THREE.Vector3().setFromMatrixPosition(s.matrix));
   assert(movement.distanceTo(expected)<1e-9,'Actual world matrices, not just position properties, must follow BAL-local normals');
  }else assert(s.o.position.equals(s.position),'Steel, posts, door and other balconies remain fixed');
  assert.equal(s.o.geometry,s.geometry);assert.equal(JSON.stringify(s.o.userData),s.metadata,'No stock metadata is added or changed');}
  const volume=boundsVolume(actual.min.toArray(),actual.max.toArray()),c=actual.getCenter(new THREE.Vector3()),safe=constrainCamera([actual.max.x+1,c.y,c.z],[actual.max.x+.075,c.y,c.z],[volume]);assert(!inVolume(safe,volume));assert(safe[0]-actual.max.x>=.12);
 }
 const before=snapshot.map(s=>[s.o.position.toArray(),s.o.visible]);for(const args of [['missing',{enabled:true,spread:82}],['BAL-01',{enabled:1}],['BAL-01',{spread:NaN}],['BAL-01',{spread:101}],[null,{enabled:true}]])assert.throws(()=>api.setBalconyInspection(...args));assert.deepEqual(snapshot.map(s=>[s.o.position.toArray(),s.o.visible]),before);
 api.setBalconyInspection(entries[1].id,{enabled:true,spread:37});assert.equal(entries[0].spread,0);assert.equal(entries[0].covers[0].node.visible,true);assert.equal(entries[1].covers[0].node.visible,false);
 api.setBalconyInspection(null,{enabled:false});api.setBalconyInspection(null,{enabled:false});for(const s of snapshot){assert(s.o.position.equals(s.position));assert.equal(s.o.visible,s.visible);assert(s.o.matrixWorld.elements.every((v,i)=>Math.abs(v-s.matrix.elements[i])<1e-9));}
 const bad=entries[0].movingParts[0].node;bad.userData.floorInspectionRole='steel';const unavailable=bindBalconyInspection([entries[0]]);assert.equal(entries[0].canInspect,false);assert.throws(()=>unavailable.setBalconyInspection(entries[0].id,{enabled:true,spread:82}),/not available/);
});

test('actual V15 native floor roles contain geometry and whole-house ID/quantity preservation at every spread',t=>{
 let authored=false;model.balconies.forEach(e=>e.owner.traverse(o=>{if(o.userData.assembly==='balcony-floor')authored=true;}));
 if(!authored&&process.env.MAE_REQUIRE_V15!=='1'){t.skip('V15 authored floor asset not exported yet; V14 owner/picking baseline is tested separately');return;}
 assert(model.balconies.every(e=>e.canInspect),'Every final V15 balcony needs all contracted floor roles with actual native geometry');
 for(const entry of model.balconies){
  const snapshot=[];entry.owner.traverse(o=>snapshot.push({o,matrix:o.matrixWorld.clone(),geometry:o.geometry,metadata:JSON.stringify(o.userData),visible:o.visible}));
  const forecast=model.getBalconyFloorBounds(entry.id,100).union(model.getBalconyFloorBounds(entry.id,0));
  for(const fraction of [0,1,27,50,82,100]){
   const actual=model.setBalconyInspection(entry.id,{enabled:true,spread:fraction});assert(forecast.clone().expandByScalar(1e-6).containsBox(actual));
   for(const p of entry.floorParts)assert(actual.clone().expandByScalar(1e-6).containsBox(new THREE.Box3().setFromObject(p.node)));
   for(const s of snapshot){assert.equal(s.o.geometry,s.geometry);assert.equal(JSON.stringify(s.o.userData),s.metadata);if(!entry.movingParts.some(p=>p.node===s.o||p.node.getObjectById(s.o.id))){assert(s.o.matrixWorld.elements.every((v,i)=>Math.abs(v-s.matrix.elements[i])<1e-6),'Actual posts/steel remain at authored positions');}}
  }
  model.setBalconyInspection(null,{enabled:false});for(const s of snapshot){assert.equal(s.o.visible,s.visible);assert(s.o.matrixWorld.elements.every((v,i)=>Math.abs(v-s.matrix.elements[i])<1e-6));}
 }
});

test('actual app BAL focus/range fits current and future floor, survives resize and cancels stale reveal on view changes',async()=>{
 const appSource=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const fn=name=>{const start=appSource.indexOf('function '+name+'('),brace=appSource.indexOf('{',appSource.indexOf(')',start));let depth=1;for(let i=brace+1;i<appSource.length;i++){if(appSource[i]==='{')depth++;if(appSource[i]==='}'&&!--depth)return appSource.slice(start,i+1);}throw Error(name);};
 const {entries,api}=balconyFixture(),nativeModel={balconies:entries,...api};let time=0,next=0,frames=new Map(),callbacks=[],handler,ctx,pose;
 const label={},elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{hidden:false,value:0,setAttribute(){},addEventListener(kind,cb){if(id==='explode')handler=cb;}});return elements.get(id);};
 const camera=new THREE.PerspectiveCamera(36,1280/598,.1,450);camera.position.set(35,22,55);const controls={target:new THREE.Vector3(),update(){camera.lookAt(this.target);camera.updateMatrixWorld(true);}},selectionBox=new THREE.Box3Helper(new THREE.Box3());selectionBox.visible=false;
 const inert={stop(){}},modeCalls=[];const layerMotion={stop(){},to(value){ctx.amount=value;const next=ctx.pendingNavigation;ctx.pendingNavigation=null;next?.();}};
 const homeCalls=[],cameraFlight={moving:false,stop(){this.moving=false;callbacks=[];}};let completions=0;
 ctx=vm.createContext({THREE,nativeModel,nativeBalconyRecord,nativeEntranceRecord,nativePanelBounds:()=>null,controls,camera,perspectiveCamera:camera,selectionBox,app:{dataset:{}},viewer:{clientWidth:1280,clientHeight:598},document:{querySelector:()=>label},$,mode:'building',amount:0,selectedBalcony:null,balconyFocus:null,balconyAmount:0,balconyTarget:0,balconyManual:false,balconyLabels:null,selectedEntrance:null,entranceFocus:null,entranceAmount:0,entranceTarget:0,entranceManual:false,glazingInspect:false,glazingSpread:0,glazingMotion:inert,entranceMotion:inert,pendingMode:null,pendingNavigation:null,framingBox:null,selectionDirection:null,reduced:false,layerMotion,cameraFlight,renderer:null,orthographic:false,dimensionVisible:false,cameraManual:false,navigationCompletion:null,lastSafeCamera:null,invalidateShadows(){},protectCamera(){},draw(){},home(options){homeCalls.push({...options});},createScalarMotion:options=>createScalarMotion({...options,now:()=>time,schedule:cb=>{frames.set(++next,cb);return next;},cancel:id=>frames.delete(id)}),flyTo(p,options={}){pose=p;camera.position.fromArray(p.position);controls.target.fromArray(p.target);ctx.cameraManual=false;const complete=()=>{if(options.onComplete){completions++;options.onComplete();}};ctx.navigationCompletion=complete;cameraFlight.moving=!options.immediate;if(options.immediate){ctx.navigationCompletion=null;complete();}else callbacks.push(complete);},setMode(mode,immediate){modeCalls.push([mode,immediate]);ctx.mode=mode;}});
 const motion=appSource.slice(appSource.indexOf('const balconyMotion='),appSource.indexOf('const entranceMotion='));
 vm.runInContext(motion+'\n'+['fittedPose','fit','resizeView','resetBalconyFocus','frameBalcony','focusSelection','outline','afterClosing','stopNavigation'].map(fn).join('\n'),ctx);
 vm.runInContext(appSource.slice(appSource.indexOf("$('explode').addEventListener('input'"),appSource.indexOf("$('dimensions').addEventListener")),ctx);
 const step=ms=>{time+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb());};
 for(const [id,text] of Object.entries({'view-title':'ПнЗх · балкони','view-description':'Ортогональний фасад','model-tag-text':'Плита до1250мм'}))$(id).textContent=text;
 ctx.outline({object:entries[0].owner.children[0]});assert.equal($('focus-component').textContent,'Наблизити підлогу');assert.equal(ctx.app.dataset.component,'balcony');ctx.focusSelection();assert.equal(ctx.balconyTarget,82);assert.equal(label.textContent,'Розкрити підлогу');assert.equal(entries[0].spread,0);assert.equal(entries[0].covers[0].node.visible,false);assert.equal($('view-title').textContent,'Підлога балкона');assert.equal($('view-description').textContent,'Сталь · стрічки · плита · покриття');assert.equal($('model-tag-text').textContent,'BAL-01 · оглядове розсування');
 // Replay the actual resize owner: retain direction/component framing and
 // complete the pending construction stage once, without navigating Home.
 assert.match(appSource,/if\(changed\)resizeView\(\)/);
 const resizeDirection=camera.position.clone().sub(controls.target).normalize();
 for(const [w,h] of [[384,600],[1280,598],[1920,900]]){
  ctx.viewer.clientWidth=w;ctx.viewer.clientHeight=h;ctx.resizeView();assert(ctx.framingBox.containsBox(nativeModel.getBalconyFloorBounds(entries[0].id,82)));assert(ctx.framingBox.containsBox(nativeModel.getBalconyFloorBounds(entries[0].id)));assert.equal(ctx.app.dataset.view,'component');assert(camera.position.clone().sub(controls.target).normalize().distanceTo(resizeDirection)<1e-9);
  const view=camera.clone();view.lookAt(controls.target);view.updateMatrixWorld(true);
  for(const x of [ctx.framingBox.min.x,ctx.framingBox.max.x])for(const y of [ctx.framingBox.min.y,ctx.framingBox.max.y])for(const z of [ctx.framingBox.min.z,ctx.framingBox.max.z]){const p=new THREE.Vector3(x,y,z).project(view);assert(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z> -1&&p.z<1);}
 }
 assert.equal(completions,1);assert.equal(ctx.navigationCompletion,null);assert.equal(cameraFlight.moving,false);assert.equal(homeCalls.length,0);step(425);assert(entries[0].spread>0&&entries[0].spread<82);assert.equal(ctx.amount,0);const current=entries[0].spread,stale=[...frames.values()];$('explode').value='27';handler();assert.equal(entries[0].spread,27,'Floor follows input before release');assert.equal(ctx.balconyTarget,27);assert.equal($('explode').value,27);stale.forEach(cb=>cb());assert.equal(entries[0].spread,27,'Cancelled animation cannot overwrite a drag');step(850);assert.equal(entries[0].spread,27);assert.equal(ctx.mode,'building');
 ctx.outline({object:entries[1].owner.children[0]});assert.equal(entries[0].spread,0);assert.equal(entries[0].covers[0].node.visible,true);ctx.focusSelection();const cancelled=callbacks.at(-1);ctx.resetBalconyFocus();cancelled();step(1000);assert(entries.every(e=>e.spread===0));assert.equal(label.textContent,'Розсунути шари');assert.equal($('view-title').textContent,'ПнЗх · балкони');assert.equal($('view-description').textContent,'Ортогональний фасад');assert.equal($('model-tag-text').textContent,'Плита до1250мм');
 for(const name of ['home','showElevation','setMode'])assert.match(fn(name),/resetBalconyFocus\(\)/,name+' must restore the selected balcony before changing view');
 $('explode').value='61';handler();assert.deepEqual(modeCalls,[['layers',true]]);assert.equal(ctx.amount,61,'Ordinary facade slider retains its original meaning');assert.deepEqual(homeCalls,[],'Dragging layers preserves the manually controlled camera');
});

test('loaded native canopy roles contain CAD steel geometry and retain clearance throughout reveal',()=>{
 const expectedSteel=planEntrance().totals.steelParts;
 for(const entry of model.entrances){
  assert(entry.canExplode,'The final GLB must contain actual geometry for every authored canopy role');
  const steel=[];entry.owner.traverse(o=>{if(o.userData.authoring?.kind==='rhs')steel.push(o);});assert.equal(steel.length,expectedSteel,'Every current source-plan RHS must exist in the final native asset');
  for(const part of steel){assert(meshCount(part)>0,part.userData.partId);assert.match(part.userData.geometryAuthoring,/^FreeCAD native/);assert.match(part.userData.canopyCADPlanSHA256,/^[a-f0-9]{64}$/);}
  const forecast=model.getEntranceBounds(entry.id,100);
  for(let fraction=0;fraction<=100;fraction++){
   const actual=model.setEntranceSpread(entry.id,fraction);assert(forecast.clone().expandByScalar(1e-6).containsBox(actual));
   const centre=actual.getCenter(new THREE.Vector3()),volume=boundsVolume(actual.min.toArray(),actual.max.toArray()),start=[actual.max.x+1,centre.y,centre.z],near=[actual.max.x+.075,centre.y,centre.z],safe=constrainCamera(start,near,[volume]);assert(inVolume(near,volume));assert(!inVolume(safe,volume));assert(safe[0]-actual.max.x>=.12);
  }
 }
 model.setEntranceSpread(null);
});

test('authored canopy inspection moves only actual canopy layers and resets atomically',()=>{
 // Source geometry proof is separate from the loaded GLB proof above: a
 // pending export cannot silently turn empty native nodes into moving layers.
 const front=new THREE.Group();front.position.z=5.62;
 const entries=[-13.1846,-.0889,13.1211].map((x,i)=>{const owner=createEntrance(THREE,front,{x});return {id:'source-'+i,owner};});front.updateMatrixWorld(true);
 for(const entry of entries)entry.bounds=new THREE.Box3().setFromObject(entry.owner);
 const original=new Map(entries.flatMap(e=>e.owner.children.map(o=>[o,{position:o.position.clone(),matrix:o.matrixWorld.clone(),geometry:o.geometry}]))),api=bindEntranceInspection(entries);
 assert(entries.every(e=>e.canExplode),'Every moving source role needs its own actual geometry');
 let stationary=0,moving=0;
 const forecast=api.getEntranceBounds(entries[0].id,100);api.setEntranceSpread(entries[0].id,100);
 for(const mesh of entries[0].owner.children){
  const part=mesh.userData.authoring,delta=mesh.position.clone().sub(original.get(mesh).position);
  if(part.assembly!=='canopy'||['steel','steel-support','rainwater'].includes(part.layer)){
   assert.equal(delta.length(),0,part.id+' must remain fixed');stationary++;
  }else{assert(delta.length()>.2,part.id+' must separate visibly');assert(delta.clone().cross(new THREE.Vector3(...part.explodeDirection)).length()<1e-8,part.id+' follows the source role direction');moving++;}
  assert.equal(mesh.geometry,original.get(mesh).geometry,'Inspection changes transforms, not construction geometry');
 }
 assert(stationary>20&&moving>10);assert(forecast.clone().expandByScalar(1e-6).containsBox(api.getEntranceBounds(entries[0].id)));
 for(let fraction=0;fraction<=100;fraction++){
  const actual=api.setEntranceSpread(entries[0].id,fraction);assert(forecast.clone().expandByScalar(1e-6).containsBox(actual));
  const centre=actual.getCenter(new THREE.Vector3()),volume=boundsVolume(actual.min.toArray(),actual.max.toArray()),start=[actual.max.x+1,centre.y,centre.z],near=[actual.max.x+.075,centre.y,centre.z],safe=constrainCamera(start,near,[volume]);
  assert(inVolume(near,volume),'75mm approach must fail at every animated fraction');assert(!inVolume(safe,volume));assert(safe[0]-actual.max.x>=.12,'Dynamic native assembly retains120mm sweep clearance');
 }
 const dynamic=entries[0].currentBounds,point=dynamic.getCenter(new THREE.Vector3()).toArray(),volume=boundsVolume(dynamic.min.toArray(),dynamic.max.toArray()),safe=constrainCamera(point,point,[volume]);assert(!inVolume(safe,volume),'A growing native canopy bound recovers a swallowed camera');
 api.setEntranceSpread(entries[1].id,37);assert.equal(entries[0].spread,0);assert.equal(entries[2].spread,0);
 for(const mesh of entries[0].owner.children)assert.equal(mesh.position.distanceTo(original.get(mesh).position),0,'Changing entrances restores the first source transform');
 const before=entries.map(e=>e.owner.children.map(o=>o.position.toArray()));for(const args of [[entries[1].id,NaN],[entries[1].id,101],['missing',50]])assert.throws(()=>api.setEntranceSpread(...args));
 assert.deepEqual(entries.map(e=>e.owner.children.map(o=>o.position.toArray())),before,'Invalid retarget leaves the current entrance untouched');
 api.setEntranceSpread(null);for(const [mesh,state] of original){assert.equal(mesh.position.distanceTo(state.position),0);assert(mesh.matrixWorld.elements.every((v,i)=>Math.abs(v-state.matrix.elements[i])<1e-8));}
 const broken=entries[2].owner.children.find(o=>o.userData.authoring.layer==='roof');broken.removeFromParent();
 const empty=new THREE.Mesh(new THREE.BufferGeometry(),broken.material);empty.userData.authoring=broken.userData.authoring;entries[2].owner.add(empty);
 const unavailable=bindEntranceInspection([entries[2]]);assert.equal(entries[2].canExplode,false);assert.throws(()=>unavailable.setEntranceSpread(entries[2].id,82),/not available/,'A semantic empty is never animated as though its roof existed');
});

test('actual app entrance range stages smoothly and cancels stale completion without changing facade slider semantics',async()=>{
 const appSource=await readFile(new URL('./app.js',import.meta.url),'utf8');
 const fn=name=>{const start=appSource.indexOf('function '+name+'('),brace=appSource.indexOf('{',appSource.indexOf(')',start));let depth=1;for(let i=brace+1;i<appSource.length;i++){if(appSource[i]==='{')depth++;if(appSource[i]==='}'&&!--depth)return appSource.slice(start,i+1);}throw Error(name);};
 const front=new THREE.Group();front.position.z=5.62;
 const entries=[-13.1846,-.0889,13.1211].map((x,i)=>{const owner=createEntrance(THREE,front,{x});owner.userData.native_id='entry'+i;owner.userData.entranceIndex=i+1;return {id:'entry'+i,index:i+1,owner};});front.updateMatrixWorld(true);entries.forEach(e=>e.bounds=new THREE.Box3().setFromObject(e.owner));
 const nativeModel={entrances:entries,...bindEntranceInspection(entries)};
 let time=0,next=0,frames=new Map(),callbacks=[],sliderHandler,modeCalls=[];
 const label={textContent:'Розсунути шари'},elements=new Map(),$=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,value:0,textContent:'',setAttribute(k,v){this[k]=v;},addEventListener(kind,cb){if(id==='explode'&&kind==='input')sliderHandler=cb;}});return elements.get(id);};
 const camera=new THREE.PerspectiveCamera(36,1280/598,.1,450);camera.position.set(35,22,55);const controls={target:new THREE.Vector3(),update(){camera.lookAt(this.target);camera.updateMatrixWorld(true);}},selectionBox=new THREE.Box3Helper(new THREE.Box3());selectionBox.visible=false;
 let ctx;const layerMotion={stop(){},to(value){ctx.amount=value;const pending=ctx.pendingNavigation;if(pending){ctx.pendingNavigation=null;pending();}}};
 const homeCalls=[],cameraFlight={moving:false,stop(){this.moving=false;callbacks=[];}};let completions=0;
 const glazingFixture={balconyFocus:null,selectedBalcony:null,balconyAmount:0,balconyTarget:0,balconyManual:false,balconyMotion:{stop(){}},resetBalconyFocus(){},nativeBalconyRecord:()=>null,glazingInspect:false,glazingSpread:0,glazingClosures:[],glazingStops:0,glazingMotion:{stop(){ctx.glazingStops++;}},setGlazingView(enabled,options){assert.equal(enabled,false);ctx.glazingInspect=false;ctx.glazingSpread=0;ctx.glazingClosures.push({enabled,options:JSON.parse(JSON.stringify(options))});}};
 ctx=vm.createContext({...glazingFixture,THREE,nativeModel,nativeEntranceRecord,nativePanelBounds:()=>null,camera,perspectiveCamera:camera,controls,selectionBox,viewer:{clientWidth:1280,clientHeight:598},app:{dataset:{}},document:{querySelector(){return label;}},$,createScalarMotion:options=>createScalarMotion({...options,now:()=>time,schedule:cb=>{frames.set(++next,cb);return next;},cancel:id=>frames.delete(id)}),layerMotion,cameraFlight,renderer:null,orthographic:false,dimensionVisible:false,cameraManual:false,navigationCompletion:null,lastSafeCamera:null,home(options){homeCalls.push({...options});},flyTo(pose,opts={}){camera.position.fromArray(pose.position);controls.target.fromArray(pose.target);ctx.cameraManual=false;const complete=()=>{if(opts.onComplete){completions++;opts.onComplete();}};ctx.navigationCompletion=complete;cameraFlight.moving=!opts.immediate;if(opts.immediate){ctx.navigationCompletion=null;complete();}else callbacks.push(complete);},invalidateShadows(){},protectCamera(){},draw(){},reduced:false,mode:'building',amount:0,pendingMode:null,pendingNavigation:null,framingBox:null,selectionDirection:null,selectedEntrance:null,entranceFocus:null,entranceAmount:0,entranceTarget:0,entranceManual:false,setMode(mode,immediate){modeCalls.push([mode,immediate]);ctx.mode=mode;}});
 const motion=appSource.slice(appSource.indexOf('const entranceMotion='),appSource.indexOf('\nfunction updateLayers'));
 vm.runInContext(motion+'\n'+['fittedPose','fit','resizeView','resetEntranceFocus','frameEntrance','focusSelection','outline','afterClosing','stopNavigation'].map(fn).join('\n'),ctx);
 vm.runInContext(appSource.slice(appSource.indexOf("$('explode').addEventListener('input'"),appSource.indexOf("$('dimensions').addEventListener")),ctx);
 const step=ms=>{time+=ms;const current=[...frames.values()];frames.clear();current.forEach(cb=>cb());};
 ctx.outline({object:entries[0].owner.children.find(o=>o.name==='entrance-handle-left')});ctx.focusSelection();assert.equal(ctx.entranceTarget,82);assert.equal(entries[0].spread,0);assert.equal(label.textContent,'Розкрити навіс');
 // Execute the actual resize owner while the focus flight is pending. The
 // first resize completes its construction callback; repeats retain direction.
 const resizeDirection=camera.position.clone().sub(controls.target).normalize();
 for(const [w,h] of [[384,600],[1280,598],[1920,900]]){
  ctx.viewer.clientWidth=w;ctx.viewer.clientHeight=h;ctx.resizeView();assert(ctx.framingBox.containsBox(nativeModel.getEntranceBounds(entries[0].id,82)));assert(ctx.framingBox.containsBox(nativeModel.getEntranceBounds(entries[0].id)));assert.equal(ctx.app.dataset.view,'component');assert(camera.position.clone().sub(controls.target).normalize().distanceTo(resizeDirection)<1e-9);
  const view=camera.clone();view.lookAt(controls.target);view.updateMatrixWorld(true);
  for(const x of [ctx.framingBox.min.x,ctx.framingBox.max.x])for(const y of [ctx.framingBox.min.y,ctx.framingBox.max.y])for(const z of [ctx.framingBox.min.z,ctx.framingBox.max.z]){const p=new THREE.Vector3(x,y,z).project(view);assert(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z> -1&&p.z<1);}
 }
 assert.equal(completions,1);assert.equal(ctx.navigationCompletion,null);assert.equal(cameraFlight.moving,false);assert.equal(homeCalls.length,0);step(425);assert(entries[0].spread>0&&entries[0].spread<82);assert.equal(ctx.amount,0);
 const stale=[...frames.values()],current=entries[0].spread;$('explode').value='27';sliderHandler();assert.equal(ctx.glazingInspect,false);assert(ctx.glazingStops>0,'Entrance navigation must stop pending glazing motion');assert.equal(entries[0].spread,27,'Entrance follows input before release');assert.equal($('explode').value,27);assert.equal(ctx.entranceTarget,27);assert.equal(ctx.mode,'building');stale.forEach(cb=>cb());assert.equal(entries[0].spread,27,'Cancelled entrance tween cannot overwrite the drag');step(425);assert.equal(entries[0].spread,27);assert.equal($('explode').value,27,'Thumb stays at the human target');step(425);assert.equal(entries[0].spread,27);
 ctx.outline({object:entries[1].owner.children.find(o=>o.name==='entrance-handle-left')});assert.equal(entries[0].spread,0);ctx.focusSelection();const cancelled=callbacks.at(-1);ctx.resetEntranceFocus();cancelled();step(1000);assert(entries.every(e=>e.spread===0));assert.equal(label.textContent,'Розсунути шари');assert.equal(ctx.pendingNavigation,null);assert.equal(ctx.entranceFocus,null);
 $('explode').value='61';sliderHandler();assert.deepEqual(modeCalls,[['layers',true]]);assert.equal(ctx.amount,61,'Ordinary building slider retains its original immediate facade meaning');assert.deepEqual(homeCalls,[],'Dragging layers preserves the manually controlled camera');
});

let spatial=0;
test('native spatial panel records preserve four facade world transforms and exploded normals',()=>{
 for(const spread of [0,1.5744]){
  model.setFacadeLayers('layers',spread/1.92*100,Array(9).fill(true));scene.updateMatrixWorld(true);
  for(const code of ['SE','NW','SW','NE'])for(const owner of panels(code)){
   let child;owner.traverse(o=>{if(o.isMesh&&!child)child=o;});assert(child,`${owner.name} native panel geometry`);
   const width=['SW','NE'].includes(code)?11.24:40.4;
   for(const record of owner.userData.panelRecords){
    const point=new THREE.Vector3((record.x+record.width/2)/1000-width/2,(record.y+record.height/2)/1000,spread+.025).applyMatrix4(facade(code).matrixWorld);
    const hit={object:child,point};assert.equal(nativePanelRecord(hit)?.id,record.id,`${code} ${record.id}`);
    const expected=new THREE.Box3(new THREE.Vector3(record.x/1000-width/2,record.y/1000,spread+.021),new THREE.Vector3((record.x+record.width)/1000-width/2,(record.y+record.height)/1000,spread+.029)).applyMatrix4(facade(code).matrixWorld),actual=nativePanelBounds(hit,record);
    assert(actual.min.distanceTo(expected.min)<1e-6&&actual.max.distanceTo(expected.max)<1e-6,`${code} ${record.id} single-tile bounds with independent facade basis`);spatial++;
   }
  }
 }
 assert.equal(spatial,2*data.panelRecords.length,'Every native panel was checked at both exploded positions');
});
test('every actual native wall board follows the confirmed1192×1250/right-remainder grid',()=>{
 model.setInspection('building');model.setFacadeLayers('building',0,Array(9).fill(true));scene.updateMatrixWorld(true);
 let hitsChecked=0;const rightDirections={SE:[1,0,0],NW:[-1,0,0],SW:[0,0,-1],NE:[0,0,1]};
 for(const code of ['SE','NW','SW','NE']){
  const options=data.defaultLayouts[code];assert.equal(options.module,1200);assert.equal(options.panelHeight,1250);assert.equal(options.offset,0);
  const source=layoutFor(code,options),records=data.panelRecords.filter(p=>p.facade===code);
  assert.deepEqual(records.map(p=>[p.id,p.x,p.y,p.width,p.height]),source.parts.map(p=>[p.id,p.x,p.y,p.width,p.height]));
  const right=new THREE.Vector3(1,0,0).transformDirection(facade(code).matrixWorld);
  assert(right.distanceTo(new THREE.Vector3(...rightDirections[code]))<1e-6,'Actual external-view handedness');
  const normal=new THREE.Vector3(0,0,1).transformDirection(facade(code).matrixWorld);
  for(const owner of panels(code))for(const record of owner.userData.panelRecords){
   // Independent rectangular arrangement chooses material inside a whole
   // U/C blank. Its bounding-box centre may be an actual window opening.
   const rings=[record.outer,...(record.holes??[])],inside=(px,py,ring)=>{let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>py)!==(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};
   const cuts=axis=>[...new Set(rings.flat().map(p=>p[axis]))].sort((a,b)=>a-b),xs=cuts(0),ys=cuts(1);let point;
   for(let x=1;x<xs.length&&!point;x++)for(let y=1;y<ys.length&&!point;y++){
    if(xs[x]-xs[x-1]<1||ys[y]-ys[y-1]<1)continue;const px=(xs[x]+xs[x-1])/2,py=(ys[y]+ys[y-1])/2;
    if(inside(px,py,record.outer)&&!(record.holes??[]).some(r=>inside(px,py,r)))point=[px,py];
   }
   assert(point,record.id+' needs a material interior outside source openings');
   const target=new THREE.Vector3(point[0]/1000-source.width/2000,point[1]/1000,.025).applyMatrix4(facade(code).matrixWorld);
   const ray=new THREE.Raycaster(target.clone().addScaledVector(normal,1),normal.clone().negate());
   const hits=ray.intersectObject(owner,true).filter(h=>visible(h.object));assert(hits.length,record.id+' must have actual exported geometry');
   assert.equal(nativePanelRecord(hits[0])?.id,record.id,'Actual triangle ray, not a synthetic hit');hitsChecked++;
  }
 }
 assert.equal(hitsChecked,data.panelRecords.length);assert.equal(hitsChecked,['SE','NW','SW','NE'].reduce((n,code)=>n+layoutFor(code,data.defaultLayouts[code]).parts.length,0));
});

test('source layer ownership is found on actual imported descendant mesh',()=>{
 for(const code of ['SE','NW','SW','NE'])for(const [i,id] of data.bindings.facadeSystems[code].entries()){
  const owner=objects.get(id);let mesh;owner.traverse(o=>{if(o.isMesh&&!mesh)mesh=o;});assert(mesh);
  assert.deepEqual(nativeLayerRecord({object:mesh}),{layer:i,system:'facade'});
 }
});
test('actual quiet inspection context preserves focused cut surfaces and restores native materials and shadow flags',()=>{
 model.setInspection('building');
 const original=[];scene.traverse(o=>{if(o.isMesh)original.push({o,material:o.material,cast:o.castShadow,receive:o.receiveShadow,order:o.renderOrder,context:o.userData.inspectionContext});});
 for(const mode of ['layers','roof','plinth']){
  model.setInspection(mode);const target=model.inspectionStage.targets[0];let contextCount=0,cutCount=0;
  scene.traverse(o=>{if(!o.isMesh)return;
   let parent=o;while(parent&&parent!==target)parent=parent.parent;
   if(o.userData.inspectionContext&&parent!==target){contextCount++;for(const m of Array.isArray(o.material)?o.material:[o.material]){assert.equal(m.opacity,.025);assert.equal(m.depthWrite,false);assert.equal(m.transparent,true);}assert.equal(o.castShadow,false);assert.equal(o.receiveShadow,false);}
  });
  target.traverse(o=>{if(o.isMesh){cutCount++;if(o.userData.windowPanelInspection&&!o.userData.inspectionFocus){assert.equal(o.material.opacity,.1,'Nearby window boards retain their separate review context');}else assert(!o.userData.inspectionContext,'Focused cut is not ghosted');}});
  assert(contextCount>0);assert(cutCount>0);
 }
 model.setInspection('building');
 for(const {o,material,cast,receive,order,context} of original){assert.equal(o.material,material);assert.equal(o.castShadow,cast);assert.equal(o.receiveShadow,receive);assert.equal(o.renderOrder,order);assert.equal(o.userData.inspectionContext,context);}
});
test('visibility and reset isolate current inspection geometry and restore the whole house',()=>{
 model.setInspection('building');model.setFacadeLayers('building',0,Array(9).fill(true));
 const original=[];model.building.traverse(o=>{if(o.isMesh)original.push({o,visible:visible(o)});});
 for(const mode of ['layers','detail','roof','plinth']){
  model.setInspection(mode);model.setFacadeLayers(mode,82,Array(9).fill(true));
  assert.equal(model.inspectionStage.active,true);assert.equal(model.inspectionStage.targets.length,1);
  const target=model.inspectionStage.targets[0];assert.equal(target,mode==='roof'?model.roofCut:mode==='plinth'?model.plinthCut:model.fieldPatch);
  let rendered=0;target.traverse(o=>{if(o.isMesh&&visible(o))rendered++;});assert(rendered>0,mode+' has actual visible geometry');
  for(const {o} of original)if(visible(o)){let parent=o;while(parent&&parent!==target)parent=parent.parent;assert.equal(parent,target,mode+' hides every whole-house neighbour');}
 }
 model.setInspection('building');model.setFacadeLayers('building',0,Array(9).fill(true));
 assert.equal(model.inspectionStage.active,false);for(const p of original)assert.equal(visible(p.o),p.visible,'Returning to the house restores each authored visible surface');
});
test('layout overlays use instance metadata and never reveal replaced native panels',()=>{
 const layout=layoutFor('SE',{module:600,offset:300});model.updateFacade(layout);
 for(const mode of ['layers','detail','roof','building']){model.setInspection(mode);model.setFacadeLayers(mode,82,Array(9).fill(true));for(const panel of panels('SE'))assert.equal(panel.visible,false);}
 const overlay=facade('SE').children.find(g=>g.children.some(o=>o.userData.candidateOverlay));assert(overlay);
 for(const mesh of overlay.children.filter(o=>o.isInstancedMesh&&o.userData.panelRecords))for(let i=0;i<mesh.count;i++)assert.equal(nativePanelRecord({object:mesh,instanceId:i})?.id,mesh.userData.panelRecords[i].id);
 for(const mesh of overlay.children.filter(o=>o.isInstancedMesh&&o.userData.panelRecords)){
  assert.equal(mesh.geometry.attributes.fcUvGrain.count,mesh.count);
  assert.equal(mesh.material.userData.candidateMetricFibreUV,true);
  assert([...mesh.geometry.attributes.fcUvGrain.array].every(v=>v===0));
 }
 assert.equal(nativePanelRecord({object:overlay.children[0],instanceId:999999}),undefined);
});
test('overlay focus bounds match actual instance geometry, including split inspection pieces',()=>{
 let checked=0,split=0;for(const mode of ['building','detail']){
  model.setInspection(mode);model.setFacadeLayers(mode,82,Array(9).fill(true));scene.updateMatrixWorld(true);
  const overlay=facade('SE').children.find(g=>g.children.some(o=>o.userData.candidateOverlay));assert(overlay);
  for(const mesh of overlay.children.filter(o=>o.isInstancedMesh&&o.userData.panelRecords)){
   mesh.geometry.computeBoundingBox();for(let i=0;i<mesh.count;i++){
    const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);const expected=mesh.geometry.boundingBox.clone().applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld),actual=nativePanelBounds({object:mesh,instanceId:i});
    assert(actual.min.distanceTo(expected.min)<2e-5&&actual.max.distanceTo(expected.max)<2e-5,`${mode} ${mesh.userData.panelRecords[i].id} piece ${i} bounds`);
    if(mode==='detail'&&Math.abs(expected.getSize(new THREE.Vector3()).x-mesh.userData.panelRecords[i].width/1000)>.001)split++;checked++;
   }
  }
 }
 assert(checked>100&&split>0,'The test must exercise actual clipped inspection pieces');
});
test('restoring the authored grid restores actual bevelled native boards, not a box replacement',()=>{
 model.setInspection('building');
 const layout=layoutFor('SE',data.defaultLayouts.SE);model.updateFacade(layout);model.setFacadeLayers('building',0,Array(9).fill(true));scene.updateMatrixWorld(true);
 assert(panels('SE').every(o=>o.visible));assert(!facade('SE').children.some(g=>g.children.some(o=>o.userData.candidateOverlay)));
 // A changed review grid still uses an overlay, and restoring remains exact.
 model.updateFacade(layoutFor('SE',{module:600,offset:300}));assert(panels('SE').every(o=>!o.visible));
 model.updateFacade(layout);assert(panels('SE').every(o=>o.visible));
 assert(!facade('SE').children.some(g=>g.children.some(o=>o.userData.candidateOverlay)));
});
test('grain-only candidate survives inspection and restores the native grid',()=>{
 model.setInspection('building');const base=layoutFor('SE',data.defaultLayouts.SE),candidate=structuredClone(base);
 candidate.parts[0].grain='горизонтально';const id=candidate.parts[0].id;model.updateFacade(candidate);
 // Caller changes after update cannot silently replace the retained candidate.
 candidate.parts[0].grain='вертикально';
 for(const mode of ['building','detail','building']){
  model.setInspection(mode);model.setFacadeLayers(mode,0,Array(9).fill(true));
  const overlay=facade('SE').children.find(g=>g.children.some(o=>o.userData.candidateOverlay));assert(overlay,mode+' must not restore a grain-different native board');
  let matched=0;for(const mesh of overlay.children.filter(o=>o.isInstancedMesh&&o.userData.panelRecords))for(const [i,record] of mesh.userData.panelRecords.entries())if(record.id===id){assert.equal(mesh.geometry.attributes.fcUvGrain.getX(i),1);matched++;}
  for(const mesh of overlay.children.filter(o=>o.userData.notchedStudy))for(const record of mesh.userData.panelRecords)if(record.id===id){assert.equal(record.grain,'горизонтально');assert(mesh.geometry.getAttribute('uv'));matched++;}
  assert(matched>0,mode+' preserves the horizontal candidate');
 }
 model.updateFacade(base);assert(panels('SE').every(o=>o.visible));assert(!facade('SE').children.some(g=>g.children.some(o=>o.userData.candidateOverlay)));
});
test('batching preserves native component metadata and world matrices',()=>{
 assert(model.nativeAsset.batchResult.instanceBatches>0);
 // Blender may emit separate accessors/UUIDs for byte-identical geometry.
 // A material/byte bucket is only an index; every match below still checks
 // every attribute byte, the full world matrix and source component metadata.
 const fields=['position','normal','uv','index'],cache=new WeakMap();
 const attributes=g=>{if(!cache.has(g))cache.set(g,fields.map(name=>{const a=name==='index'?g.index:g.getAttribute(name);return a?{tag:a.array.constructor.name+':'+a.itemSize+':'+a.normalized,bytes:new Uint8Array(a.array.buffer,a.array.byteOffset,a.array.byteLength)}:null;}));return cache.get(g);};
 const geometryKey=g=>attributes(g).map(a=>{if(!a)return '-';let hash=2166136261;for(const byte of a.bytes)hash=Math.imul(hash^byte,16777619)>>>0;return a.tag+':'+a.bytes.length+':'+hash;}).join('|');
 const exactGeometry=(a,b)=>attributes(a).every((field,i)=>{const other=attributes(b)[i];return !field&&!other||!!field&&!!other&&field.tag===other.tag&&field.bytes.length===other.bytes.length&&field.bytes.every((byte,j)=>byte===other.bytes[j]);});
 const byGeometry=new Map();for(const item of originalMeshes){const key=geometryKey(item.mesh.geometry)+':'+item.mesh.material.uuid;const list=byGeometry.get(key)||[];list.push(item);byGeometry.set(key,list);}
 const close=(a,b)=>a.elements.every((v,i)=>Math.abs(v-b.elements[i])<2e-5);
 let n=0;model.building.traverse(o=>{if(o.isInstancedMesh&&o.userData.nativeImported){assert.equal(o.userData.components.length,o.count);const candidates=byGeometry.get(geometryKey(o.geometry)+':'+o.material.uuid);assert(candidates);for(let i=0;i<o.count;i++){const matrix=new THREE.Matrix4();o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);assert(matrix.elements.every(Number.isFinite));const original=candidates.find(r=>exactGeometry(o.geometry,r.mesh.geometry)&&close(matrix,r.matrix));assert(original,'Native instance world transform must match an actual pre-batch source mesh');assert.equal(JSON.stringify(o.userData.components[i]),JSON.stringify(original.component));n++;}}});assert(n>100);
});
test('gable source owners retain renderable descendants for picking, hiding and explosion',()=>{
 const missing=[];let owners=0;for(const code of ['SW','NE'])for(const node of facade(code).children.filter(o=>o.userData.gableFacade===code)){owners++;if(!meshCount(node))missing.push(node.name);}const expected=['SW','NE'].reduce((n,code)=>n+gableLayout(code,data.defaultLayouts[code].module,data.defaultLayouts[code].offset,{panelHeight:data.defaultLayouts[code].panelHeight}).parts.length,0);assert.equal(owners,expected,'Native gable owners must match the actual authored endwall grid');
 assert.deepEqual(missing,[],'Gable semantic empties cannot move/hide/pick geometry consolidated at facade level');
});
test('nearest visible native panel ray is distinguishable from the masonry hit behind it',()=>{
 // Fresh NW stays native despite the SE overlay test above.
 model.setInspection('building');model.setFacadeLayers('building',0,Array(9).fill(true));scene.updateMatrixWorld(true);
 const owner=panels('NW')[0],record=owner.userData.panelRecords.find(r=>r.y>0),target=new THREE.Vector3((record.x+record.width/2)/1000-20.2,(record.y+record.height/2)/1000,.025).applyMatrix4(facade('NW').matrixWorld),normal=new THREE.Vector3(0,0,1).transformDirection(facade('NW').matrixWorld);
 const ray=new THREE.Raycaster(target.clone().addScaledVector(normal,2),normal.clone().negate());
 const hits=ray.intersectObject(facade('NW'),true).filter(h=>visible(h.object));assert(hits.length);
 assert.equal(nativePanelRecord(hits[0])?.id,record.id);assert.equal(nativeLayerRecord(hits[0]),null);
 assert(hits.some(h=>nativeLayerRecord(h)?.layer===0),'This real ray catches the app bug if it scans through the front panel for any deeper layer');
});

test('field and public window assemblies switch real geometry without duplicate visible surfaces',()=>{
 model.setInspection('detail');const field=model.setRevealMode('field');
 assert.equal(model.fieldPatch.visible,true);assert.equal(model.patch.visible,false);
 assert.equal(field.groups.length,9);assert.equal(field.window,model.fieldWindow);
 const boards=[];field.window.traverse(o=>{if(o.userData.detailRole==='side-board'||o.userData.detailRole==='head-board')boards.push(o);});
 assert.equal(boards.length,4);assert.equal(boards.filter(o=>o.userData.detailRole==='side-board').length,2);
 assert(boards.every(o=>meshCount(o)>0));assert(boards.every(o=>o.userData.cutPlan.approved===false));
 const source=model.setRevealMode('source');assert.equal(source.window,model.patchWindow);assert.equal(model.patch.visible,true);assert.equal(model.fieldPatch.visible,false);
 model.setInspection('building');assert.equal(model.patch.visible,false);assert.equal(model.fieldPatch.visible,false);model.setRevealMode('field');
});

test('actual consolidated presentation ground stays hidden beneath the runtime relief through inspection reset',()=>{
 const ground=[];scene.traverse(o=>{if(o.isMesh&&o.userData.presentationGround)ground.push(o);});assert.equal(ground.length,1);
 for(const mode of ['building','layers','roof','plinth','building']){model.setInspection(mode);assert(ground.every(o=>!visible(o)),'No flat helper reappears in '+mode);}
});
test('actual native size-based bores pass through dark and pale plates and retain drilled side walls',()=>{
 model.setInspection('building');model.setFacadeLayers('building',0,Array(9).fill(true));scene.updateMatrixWorld(true);
 let checked=0,dark=0;
 for(const code of ['SE','NW','SW','NE']){
  const width=['SW','NE'].includes(code)?11.24:40.4;
  for(const colour of ['P222','P070']){
   let n=0;
   for(const owner of panels(code).filter(o=>o.userData.representation!=='user-nine-hole-pattern-markers')){
    for(const record of owner.userData.panelRecords){
     if(record.colour!==colour||!record.drilling?.points.length||n>=3)continue;
     const bore=record.drilling.points[0],x=bore.x/1000-width/2,y=bore.y/1000;
     const world=v=>v.applyMatrix4(facade(code).matrixWorld),normal=new THREE.Vector3(0,0,-1).transformDirection(facade(code).matrixWorld);
     const centre=new THREE.Raycaster(world(new THREE.Vector3(x,y,.050)),normal,0,.040).intersectObject(owner,true);
     assert.equal(centre.length,0,record.id+' actual hole centre is empty');
     const solid=new THREE.Raycaster(world(new THREE.Vector3(x+.0045,y,.050)),normal,0,.040).intersectObject(owner,true);
     assert(solid.length,record.id+' surrounding plate remains solid');
     const wall=new THREE.Raycaster(world(new THREE.Vector3(x,y,.025)),new THREE.Vector3(1,0,0).transformDirection(facade(code).matrixWorld),0,.012).intersectObject(owner,true);
     assert(wall.length,record.id+' bore wall exists');assert(Math.abs(wall[0].distance-.004)<2e-5);
     checked++;if(colour==='P070')dark++;n++;
    }
   }
  }
 }
 assert(checked>=15&&dark>=3);console.log({actualNativeBoreWitnesses:checked,dark});
});
test('actual facade layers step downward while opening and predicted bounds match their native poses',()=>{
 const stock=JSON.stringify(model.panelRecords),all=Array(9).fill(true);
 for(const variant of ['field','source']){
  model.setInspection('layers');const {groups}=model.setRevealMode(variant);model.setFacadeSpread(0,all);
  const origins=groups.map(g=>g.position.clone());
  for(const amount of [82,21,100,0]){
   const predicted=model.getInspectionLayerBounds(amount);model.setFacadeSpread(amount,all);scene.updateMatrixWorld(true);
   const actual=model.getInspectionLayerBounds(amount);
   groups.forEach((group,i)=>{assert(group.position.distanceTo(origins[i].clone().add(new THREE.Vector3(0,-i*.1*amount/100,i*.43*amount/100)))<1e-8);if(!actual[i].isEmpty()){assert(predicted[i].min.distanceTo(actual[i].min)<2e-5);assert(predicted[i].max.distanceTo(actual[i].max)<2e-5);}});
  }
  groups.forEach((group,i)=>assert(group.position.distanceTo(origins[i])<1e-8));
 }
 assert.throws(()=>model.setFacadeSpread(101,all));assert.throws(()=>model.setFacadeSpread(10,[]));assert.equal(JSON.stringify(model.panelRecords),stock);
 model.setRevealMode('field');model.setFacadeSpread(0,all);model.setInspection('building');
});
test('actual native window inspection preserves the four source contours through spread and restores whole building stock',()=>{
 const layout=layoutFor('SE',data.defaultLayouts.SE);model.setInspection('building');model.updateFacade(layout);model.setFacadeLayers('building',0,Array(9).fill(true));scene.updateMatrixWorld(true);
 const stock=JSON.stringify(model.panelRecords),nativeBoards=panels('SE').filter(o=>o.userData.panelFacade==='SE'&&o.userData.representation!=='user-nine-hole-pattern-markers');
 assert(nativeBoards.length>0);let witnesses=0;
 for(const mode of ['field','source']){
  model.setInspection('detail');const {groups}=model.setRevealMode(mode),layer=groups[8];
  const view=layer.children.find(o=>o.userData.windowPanelInspection),focus=view.children.filter(o=>o.userData.inspectionFocus);
  assert.equal(focus.length,4);assert.equal(view.userData.sourcePartIds.length,16);
  assert(focus.every(m=>m.userData.completeSourceContour&&!m.userData.inspectionContext));
  for(const amount of [0,45,82,0]){
   model.setFacadeSpread(amount,Array(9).fill(true));scene.updateMatrixWorld(true);
   for(const mesh of focus){
    const record=mesh.userData.panelRecords[0],p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    // A real front triangle centroid is inside the L, unlike its bbox centre.
    let centre=null;for(let i=0;i<p.count;i+=3)if([i,i+1,i+2].every(j=>n.getZ(j)>.9)){
     centre=new THREE.Vector3().fromBufferAttribute(p,i).add(new THREE.Vector3().fromBufferAttribute(p,i+1)).add(new THREE.Vector3().fromBufferAttribute(p,i+2)).multiplyScalar(1/3);break;
    }
    assert(centre);const start=centre.clone().add(new THREE.Vector3(0,0,.03)).applyMatrix4(layer.matrixWorld),direction=new THREE.Vector3(0,0,-1).transformDirection(layer.matrixWorld);
    const hits=new THREE.Raycaster(start,direction,0,.04).intersectObject(mesh);assert(hits.length);assert.equal(nativePanelRecord(hits[0])?.id,record.id);assert.equal(nativeLayerRecord(hits[0]),null);
    assert(Math.abs(nativePanelBounds(hits[0]).getSize(new THREE.Vector3()).y-1.25)<2e-5);
    const nativePoint=new THREE.Vector3(origin.x+centre.x,origin.y+centre.y,.06).applyMatrix4(facade('SE').matrixWorld),nativeDirection=new THREE.Vector3(0,0,-1).transformDirection(facade('SE').matrixWorld);
    const nativeHits=new THREE.Raycaster(nativePoint,nativeDirection,0,.06).intersectObjects(nativeBoards,true);
    assert(nativeHits.some(h=>nativePanelRecord(h)?.id===record.id),'The focused surface belongs to an actual authored facade plate: '+record.id);witnesses++;
   }
  }
 }
 model.setFacadeSpread(0,Array(9).fill(true));model.setRevealMode('field');model.setFacadeSpread(0,Array(9).fill(true));
 model.setInspection('building');model.setRevealMode('field');scene.updateMatrixWorld(true);
 assert.equal(JSON.stringify(model.panelRecords),stock);assert(nativeBoards.every(visible));assert.equal(model.patch.visible,false);assert.equal(model.fieldPatch.visible,false);assert.equal(witnesses,32);
});

test('window surroundings retain whole-facade IDs and materials through native and changed layout phases',()=>{
 let checked=0;
 for(const options of [data.defaultLayouts.SE,{module:600,offset:300},data.defaultLayouts.SE]){
  const layout=layoutFor('SE',options);model.updateFacade(layout);model.setInspection('detail');model.setFacadeLayers('detail',0,Array(9).fill(true));
  for(const mode of ['field','source']){
   const {groups}=model.setRevealMode(mode),cladding=groups[8];scene.updateMatrixWorld(true);
   const projected=[];cladding.traverse(o=>{if(o.isMesh&&visible(o)){for(let a=o;a;a=a.parent)if(a.userData.representation==='user-nine-hole-pattern-markers')return;let owner=o;while(owner&&!owner.userData.panelRecords)owner=owner.parent;assert(owner?.userData.panelProjection,'Visible native detail boards must bind the whole-facade projection');projected.push({mesh:o,owner});}});
   assert(projected.length>0);
   for(const {mesh,owner} of projected)for(const [i,record] of owner.userData.panelRecords.entries()){
    assert(layout.parts.some(p=>p.id===record.id),'No new stock part is invented by an inspection clip');assert.equal(record.module,layout.module);
    assert(mesh.material.name.includes(record.colour==='P070'?'FC_P070':'FC_P222_'+record.cell%6),'Detail and house finish: '+mesh.material.name+' / '+record.id+' / cell '+record.cell);
    const r=record.detailProjection;assert(r&&r.width>0&&r.height>0);
    const point=new THREE.Vector3((r.x+r.width/2)/1000,(r.y+r.height/2)/1000,.004).applyMatrix4(cladding.matrixWorld);
    const hit={object:mesh,point,...(mesh.isInstancedMesh?{instanceId:i}:{})};
    assert.equal(nativePanelRecord(hit)?.id,record.id);assert.equal(nativeLayerRecord(hit),null);
    const bounds=nativePanelBounds(hit);assert(bounds&&!bounds.isEmpty());checked++;
   }
  }
 }
 assert(checked>20,'Exercise actual native data and regenerated phases in both variants');model.setInspection('building');model.setRevealMode('field');
});

test('rejected window projection preserves the current visible facade and record binding',()=>{
 const before=[...facade('SE').children],states=before.map(o=>o.visible),records=JSON.stringify(model.panelRecords);
 const bad=layoutFor('SE',{module:1258,offset:555});bad.cuts[1]=30;
 assert.throws(()=>model.updateFacade(bad),/Projected support axes would overlap/);
 assert.deepEqual(facade('SE').children,before);assert.deepEqual(before.map(o=>o.visible),states);assert.equal(JSON.stringify(model.panelRecords),records);
});

 test('notched study uses real contour triangles, survives inspection/explode and restores native boards',()=>{
  for(const code of ['SE','NW','SW','NE']){
   model.setInspection('building');const authored=layoutFor(code,data.defaultLayouts[code]);
   const originalOwners=panels(code),originals=[];
   for(const owner of originalOwners)owner.traverse(mesh=>{if(mesh.isMesh)originals.push({mesh,geometry:mesh.geometry});});
   assert(originals.length>0,'Exercise actual native mesh geometry, not only group visibility');
   // Authored merged contour meshes and computational contour overlays share
   // notchedStudy. Observe the representation, then prove originals separately.
   const studyMeshes=()=>{const meshes=[];facade(code).traverse(o=>{if(o.isMesh&&o.userData.notchedStudy&&o.userData.candidateOverlay)meshes.push(o);});return meshes;};
   if(authored.cutPolicy==='notched-study'){
    model.updateFacade(authored);assert(panels(code).every(visible));
    assert(originalOwners.some(owner=>owner.userData.notchedStudy),'Exercise actual authored contour surfaces');
    assert.equal(studyMeshes().length,0,'Matching authored contours retain actual native boards');
   }
   // A changed contour must exercise the overlay even after native authoring
   // adopts whole boards as its default policy.
   const layout=visualPanelLayout(authored.cutPolicy==='notched-study'?{...authored,openings:[...authored.openings,{x:100,y:100,width:100,height:100}]}:authored),expected=layout.parts;
   const ids=model.updateFacade(layout);assert.deepEqual(Array.from(ids),expected.map(p=>p.id));
   const study=studyMeshes();assert.equal(study.length,expected.length);
   assert.deepEqual(study.flatMap(mesh=>mesh.userData.panelRecords.map(p=>p.id)),expected.map(p=>p.id));
   assert(originals.every(({mesh,geometry})=>!visible(mesh)&&mesh.geometry===geometry),'Overlay hides actual originals without changing their geometry');
   for(const mesh of study){assert(mesh.geometry.attributes.position.count>0);assert.equal(mesh.userData.quantityEligible,false);assert.equal(mesh.userData.readyToCut,false);}
   for(const amount of [0,82,0]){model.setFacadeLayers('layers',amount,Array(9).fill(true));scene.updateMatrixWorld(true);assert(study.every(visible));assert(originals.every(({mesh})=>!visible(mesh)),'No duplicate original visibility during explode');}
   model.setInspection('detail');
   const detailStudy=studyMeshes();
   const clipped=code==='SE'?blankContours({...layout,openings:[...layout.openings,{x:Math.round((origin.x-1.75)*1000+layout.width/2),y:Math.round((origin.y-1.425)*1000),width:3500,height:2850}]}):expected;
   assert.equal(detailStudy.length,clipped.length,'Inspection must preserve actual notched policy and clip its geometry');
   model.setInspection('building');model.setFacadeLayers('building',0,Array(9).fill(true));
   assert.equal(studyMeshes().length,expected.length,'Exit inspection must retain notched study');
   model.updateFacade(authored);scene.updateMatrixWorld(true);assert.equal(studyMeshes().length,0);assert(panels(code).every(visible));
   assert(originals.every(({mesh,geometry})=>visible(mesh)&&mesh.geometry===geometry),'Restore reuses original native contour geometry');
  }
 });

 test('actual native inspection retains a custom variable course plan and restores canonical boards',()=>{
  model.setInspection('building');
  const canonical=layoutFor('SE',data.defaultLayouts.SE),levels=[...canonical.levels];
  levels[1]+=20;
  const changed=layoutFor('SE',{...data.defaultLayouts.SE,rowLevels:levels});
  assert.notDeepEqual(changed.levels,canonical.levels);
  model.updateFacade(changed);
  const expected=changed.parts.map(p=>[p.id,p.x,p.y,p.width,p.height]);
  for(const mode of ['detail','building','detail','building']){
   model.setInspection(mode);model.setFacadeLayers(mode,0,Array(9).fill(true));
   assert.deepEqual(model.panelRecords.filter(p=>p.facade==='SE').map(p=>[p.id,p.x,p.y,p.width,p.height]),expected,'Inspection cannot silently return to1258 or canonical courses');
   if(mode==='building'){
    scene.updateMatrixWorld(true);const owner=facade('SE'),normal=new THREE.Vector3(0,0,1).transformDirection(owner.matrixWorld);
    for(const row of new Set(changed.parts.map(p=>p.floor))){
     const p=changed.parts.find(p=>p.floor===row&&p.width>100&&p.height>100);
     const target=new THREE.Vector3((p.x+p.width/2)/1000-changed.width/2000,(p.y+p.height/2)/1000,.025).applyMatrix4(owner.matrixWorld);
     const ray=new THREE.Raycaster(target.clone().addScaledVector(normal,1),normal.clone().negate()),hits=ray.intersectObject(owner,true).filter(h=>visible(h.object)&&nativePanelRecord(h));
     assert(hits.length,'Custom course has actual visible triangles');assert.equal(nativePanelRecord(hits[0]).id,p.id,'Ray hits the actual custom-course part');
    }
   }
  }
  model.updateFacade(canonical);model.setInspection('building');model.setFacadeLayers('building',0,Array(9).fill(true));
  assert(panels('SE').every(visible),'Canonical bevelled native boards restored');
  assert.deepEqual(model.panelRecords.filter(p=>p.facade==='SE').map(p=>[p.id,p.x,p.y,p.width,p.height]),canonical.parts.map(p=>[p.id,p.x,p.y,p.width,p.height]));
 });
