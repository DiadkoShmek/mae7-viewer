import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {blankContours} from './panel-blank-shapes.js';
import {panelContourGeometry} from './panel-contour-geometry.js';
test('actual triangulated front preserves hole and exact area, not the envelope',()=>{
 const layout={width:1200,height:1258,joint:8,cuts:[0,1200],levels:[0,1258],openings:[{x:300,y:300,width:400,height:500}],colour:'P222',grain:'вертикально'};
 const p=blankContours(layout)[0],g=panelContourGeometry(THREE,p,1200),v=g.attributes.position;
 let front=0;for(let i=0;i<v.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(v,i),b=new THREE.Vector3().fromBufferAttribute(v,i+1),c=new THREE.Vector3().fromBufferAttribute(v,i+2);if([a,b,c].every(q=>Math.abs(q.z-.029)<1e-6))front+=new THREE.Vector3().crossVectors(b.sub(a),c.sub(a)).length()/2;}
 assert(Math.abs(front*1e6-p.areaMm2)<.2);
 const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
 const ray=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x/1000-.6,y/1000,1),new THREE.Vector3(0,0,-1)).intersectObject(mesh);
 assert.equal(ray(500,500).length,0,'No triangles fill the aperture');assert(ray(100,100).length>0);
 g.computeBoundingBox();assert(Math.abs(g.boundingBox.max.z-g.boundingBox.min.z-.008)<1e-7);g.dispose();
});
