import * as THREE from 'three';
import {mergeGeometries,deinterleaveGeometry} from './assets/BufferGeometryUtils.js';

// Exact transformed copies of static opaque triangles. No multidraw extension
// is required. Canonical meshes remain in place for quantities and selection.
const bound=new WeakMap(),displaySources=new WeakMap();
export function staticDisplaySources(display){return [...(displaySources.get(display)||[])];}
export function mergeBalconyDisplay(entries){
 let sources=0,draws=0;
 for(const entry of entries){
  const cacheOwner=entry.cacheOwner??entry.owner;
  if(bound.has(cacheOwner)){const prior=bound.get(cacheOwner);sources+=prior.sources;draws+=prior.draws;continue;}
  const owner=entry.owner;owner.updateWorldMatrix(true,true);
  const inverse=owner.matrixWorld.clone().invert(),buckets=new Map();
  owner.traverse(mesh=>{
   if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isBatchedMesh||mesh.isSkinnedMesh||Array.isArray(mesh.material)||mesh.material.transparent||mesh.material.transmission>0||mesh.raycast!==THREE.Mesh.prototype.raycast||mesh.onBeforeRender!==THREE.Object3D.prototype.onBeforeRender||mesh.onAfterRender!==THREE.Object3D.prototype.onAfterRender)return;
   let part=null,floorLayer=null;for(let p=mesh;p;p=p.parent){
    const d=p.userData;
    if(d.assembly==='balcony-floor'&&Number.isInteger(d.layer))floorLayer=d.layer;
    if(entry.excludeRoots?.includes(p)||entry.excludeDynamic&&(d.system||d.dynamicCover||d.panelFacade||d.gableFacade||d.representation==='user-nine-hole-pattern-markers'||d.glazingAssembly||d.glazingRole||['balcony','entrance','retained-wall-return','rainwater'].includes(d.component?.kind)))return;
    if(!p.visible||d.assembly==='balcony-floor'&&entry.onlyFloorLayer===undefined||d.partId===entry.id+'-FC-FRONT'||d.balconyGlazing||d.glazingRole||d.opticalGlass||d.component?.kind==='door')return;
    if(!part&&d.partId)part=p;if(p===owner)break;
   }
   if(entry.onlyFloorLayer!==undefined&&floorLayer!==entry.onlyFloorLayer)return;
   if(!part&&entry.allowRootPart)part=owner;if(!part)return;
   const g=mesh.geometry,attributes=Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b));
   if(g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.morphAttributes).length)return;
   const count=g.index?.count??g.attributes.position.count;if(count%3)return;
   const matrix=inverse.clone().multiply(mesh.matrixWorld);if(matrix.determinant()<=0)return;
   const signature=attributes.map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name].join('/')).join(',')+':'+!!g.index;
   const key=[mesh.material.uuid,signature,mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.layers.mask,mesh.frustumCulled,mesh.customDepthMaterial?.uuid,mesh.customDistanceMaterial?.uuid].join(':');
   const list=buckets.get(key)||[];list.push({mesh,part,matrix,count});buckets.set(key,list);
  });
  let n=0,b=0;
  for(const list of buckets.values()){
   if(list.length<2)continue;
   const copies=list.map(s=>{const g=s.mesh.geometry.clone();deinterleaveGeometry(g);return g.applyMatrix4(s.matrix);});
   let geometry;try{geometry=mergeGeometries(copies,false);}finally{for(const g of copies)g.dispose();}
   if(!geometry)continue;
   const first=list[0].mesh,display=new THREE.Mesh(geometry,first.material);
   display.name=entry.id+'-STATIC-DISPLAY';
   for(const flag of ['castShadow','receiveShadow','renderOrder','frustumCulled','customDepthMaterial','customDistanceMaterial'])display[flag]=first[flag];
   display.layers.mask=first.layers.mask;
   display.userData={staticDisplay:true,physical:false,quantityEligible:false,newStockPart:false,quantity:0,representationOf:list.map(s=>s.part.userData.partId||s.part.userData.native_id),...(entry.onlyFloorLayer!==undefined?{balconyFloorDisplayLayer:entry.onlyFloorLayer}:{})};
   displaySources.set(display,list.map(s=>s.mesh));
   let face=0;const ranges=list.map(s=>{const range={...s,start:face,end:face+s.count/3};face=range.end;return range;});
   display.raycast=function(raycaster,hits){
    const results=[];THREE.Mesh.prototype.raycast.call(this,raycaster,results);
    for(const hit of results){
     let low=0,high=ranges.length-1;
     while(low<=high){const mid=(low+high)>>1,r=ranges[mid];if(hit.faceIndex<r.start)high=mid-1;else if(hit.faceIndex>=r.end)low=mid+1;else{
      // Intersect the original too: local face indices/normals and UVs come
      // from its real authored geometry, including any scaled owner matrix.
      const original=[];r.mesh.raycast(raycaster,original);
      const sourceHit=original.find(h=>h.faceIndex===hit.faceIndex-r.start);
      if(sourceHit)hits.push({...sourceHit,displayObject:this});break;
     }}
    }
   };
   geometry.computeBoundingBox();geometry.computeBoundingSphere();owner.add(display);
   for(const s of list)s.mesh.visible=false;n+=list.length;b++;
  }
  owner.updateWorldMatrix(true,true);bound.set(cacheOwner,{sources:n,draws:b});sources+=n;draws+=b;
 }
 return {sources,draws,drawsSaved:sources-draws};
}

// These complete retained returns and drainage assemblies have no inspection
// motion. Each display remains under its existing assembly/visibility owner.
export function mergeFixedBuildingDisplay(root){
 const entries=[];root.traverse(owner=>{
  const d=owner.userData;
  if(!d.partId&&((d.assembly==='retained-balcony-return'&&d.component?.kind==='retained-wall-return')||(d.assembly==='rainwater'&&d.component?.kind==='rainwater')))entries.push({owner,id:d.native_id,allowRootPart:true});
 });return mergeBalconyDisplay(entries);
}

// Static window frames, room silhouettes and fixed shell details may share
// a draw while picking still returns each exact original mesh/owner.
export function mergeStaticShellDisplay(model){
 return mergeBalconyDisplay([{owner:model.building,id:'HOUSE-STATIC-SHELL',allowRootPart:true,excludeDynamic:true,
  excludeRoots:[model.patch,model.fieldPatch,model.normalPatchWindow,model.roofCut,model.roofCovers,model.plinthCut,model.plinthCover]}]);
}

export function mergeBalconyFloorDisplay(entries){
 const cuts=[];for(const e of entries)for(const layer of [1,2,3,4])cuts.push({owner:e.owner,id:e.id,onlyFloorLayer:layer,cacheOwner:{}});
 return mergeBalconyDisplay(cuts);
}
