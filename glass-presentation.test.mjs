import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {glassDisplayMaterial,physicalGlassMaterial,configureGlassPresentation} from './glass-presentation.js';
test('glass display avoids transmission passes without altering physical source',()=>{
 const source=new THREE.MeshPhysicalMaterial({transmission:.9,ior:1.5,thickness:.032,side:THREE.DoubleSide});
 source.name='physical glass';source.userData={quantityEligible:false};
 const before=JSON.stringify(source.toJSON()),display=glassDisplayMaterial(source);
 assert.notEqual(display,source);assert.equal(JSON.stringify(source.toJSON()),before);
 assert.equal(physicalGlassMaterial(display),source);assert.equal(glassDisplayMaterial(source),display);assert.equal(glassDisplayMaterial(display),display);
 assert.equal(display.transmission,0);assert.equal(display.transparent,true);assert.equal(display.depthWrite,false);assert.equal(display.forceSinglePass,true);
 assert.ok(Math.abs(display.opacity-.1)<1e-12);assert.equal(display.ior,source.ior);assert.equal(display.thickness,source.thickness);
});
test('display preserves geometry, owners and array materials and is repeatable',()=>{
 const root=new THREE.Group(),glass=new THREE.MeshPhysicalMaterial({transmission:.98}),solid=new THREE.MeshStandardMaterial();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,.004),[solid,glass]);mesh.userData={partId:'physical-pane',quantityEligible:true};root.add(mesh);
 const geometry=mesh.geometry,metadata=JSON.stringify(mesh.userData);
 assert.equal(configureGlassPresentation(root),1);assert.equal(configureGlassPresentation(root),0);
 assert.equal(mesh.material[0],solid);assert.equal(mesh.geometry,geometry);assert.equal(mesh.parent,root);assert.equal(JSON.stringify(mesh.userData),metadata);
 assert.equal(physicalGlassMaterial(mesh.material[1]),glass);assert.equal(mesh.material[1].opacity,.04);
});
