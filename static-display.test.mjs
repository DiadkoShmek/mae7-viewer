import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mergeBalconyDisplay} from './static-display.js';
test('static display keeps exact triangles and picks the canonical part across unequal shapes',()=>{
 const owner=new THREE.Group();owner.position.set(3,2,4);owner.rotation.y=.45;
 const material=new THREE.MeshStandardMaterial({side:THREE.DoubleSide}),meshes=[];
 for(let i=0;i<3;i++){
  const part=new THREE.Group();part.userData={partId:'PART-'+i,component:{kind:'balcony-guard-panel'}};
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.25+i*.15,.4,.008),material);mesh.geometry.clearGroups();mesh.position.x=i;mesh.rotation.z=i*.12;part.add(mesh);owner.add(part);meshes.push(mesh);
 }
 owner.updateWorldMatrix(true,true);const before=meshes.map(mesh=>({geometry:mesh.geometry,matrix:mesh.matrixWorld.clone(),parent:mesh.parent,metadata:JSON.stringify(mesh.parent.userData)}));
 const result=mergeBalconyDisplay([{id:'BAL-01',owner}]);assert.equal(result.drawsSaved,2);assert.deepEqual(mergeBalconyDisplay([{id:'BAL-01',owner}]),result);
 const display=owner.children.find(o=>o.userData.staticDisplay);assert(display);assert.equal(display.userData.quantityEligible,false);assert.equal(display.userData.quantity,0);
 let vertexOffset=0;
 for(const [i,mesh] of meshes.entries()){
  assert.equal(mesh.visible,false);assert.equal(mesh.geometry,before[i].geometry);assert.equal(mesh.parent,before[i].parent);assert.equal(JSON.stringify(mesh.parent.userData),before[i].metadata);assert(mesh.matrixWorld.equals(before[i].matrix));
  const a=display.geometry.attributes.position,b=mesh.geometry.attributes.position;
  for(let k=0;k<b.count;k++){const original=new THREE.Vector3().fromBufferAttribute(b,k).applyMatrix4(mesh.matrixWorld),merged=new THREE.Vector3().fromBufferAttribute(a,vertexOffset+k).applyMatrix4(display.matrixWorld);assert(original.distanceTo(merged)<2e-6);}
  vertexOffset+=b.count;
  const centre=new THREE.Vector3(0,0,.008).applyMatrix4(mesh.matrixWorld),normal=new THREE.Vector3(0,0,1).transformDirection(mesh.matrixWorld),ray=new THREE.Raycaster(centre.clone().addScaledVector(normal,.05),normal.clone().negate());
  const hits=ray.intersectObject(display);assert(hits.some(h=>h.object===mesh&&h.displayObject===display));assert(hits.every(h=>Number.isInteger(h.faceIndex)&&h.faceIndex<mesh.geometry.index.count/3));
 }
});
test('moving floor, front cover, optical glass and custom picking remain unmerged',()=>{
 const owner=new THREE.Group(),material=new THREE.MeshStandardMaterial();
 for(const [i,data] of [{assembly:'balcony-floor',partId:'FLOOR'},{partId:'BAL-01-FC-FRONT'},{opticalGlass:true,partId:'GLASS'},{partId:'PICK'}].entries()){
  const part=new THREE.Group();part.userData=data;owner.add(part);
  for(let j=0;j<2;j++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);if(i===3)mesh.raycast=()=>{};part.add(mesh);}
 }
 assert.equal(mergeBalconyDisplay([{id:'BAL-01',owner}]).drawsSaved,0);owner.traverse(o=>assert.equal(o.visible,true));
});
