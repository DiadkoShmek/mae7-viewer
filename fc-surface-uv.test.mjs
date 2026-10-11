import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {gableLayout} from './gables.js';
import {fibreSurfaceUV,applyFibreSurfaceUV,setInstanceFibreGrain,createInstanceFibreMaterial,fcGrainCode} from './fc-surface-uv.js';
test('wide-short, tall-narrow and square front faces have the same metric grain',()=>{
 for(const [width,height] of [[1.192,.942],[.158,1.25],[1.192,1.192]]){
  const geometry=new THREE.BoxGeometry(width,height,.008),before=geometry.getAttribute('position').array.slice();
  applyFibreSurfaceUV(THREE,geometry,'вертикально');
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  let count=0;
  for(let i=0;i<p.count;i++)if(Math.abs(n.getZ(i))===1){assert(Math.abs(uv.getX(i)-p.getX(i)*3)<1e-6);assert(Math.abs(uv.getY(i)-p.getY(i)*.7)<1e-6);count++;}
  assert.equal(count,8);assert.deepEqual(p.array,before);geometry.dispose();
 }
 assert.deepEqual(fibreSurfaceUV([.3,.8,.004],[0,0,1],[1.192,.942,.008],'horizontal'),[2.4000000000000004,.21]);
 for(const bad of [null,'unknown','diagonal',undefined])assert.throws(()=>fcGrainCode(bad));
 assert.throws(()=>applyFibreSurfaceUV(THREE,new THREE.BoxGeometry(1,1,.008),undefined));
});
test('actual sloped gable edge retains metric grain projected into the face',()=>{
 const part=gableLayout('SW',1200,0,{panelHeight:1250}).parts.find(p=>p.id==='SWG-001');assert(part);
 const shape=new THREE.Shape();part.points.forEach((p,i)=>i?shape.lineTo(p[0]/1000-5.62,p[1]/1000+8.525):shape.moveTo(p[0]/1000-5.62,p[1]/1000+8.525));shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:false}),before=geometry.attributes.position.array.slice();applyFibreSurfaceUV(THREE,geometry,part.grain);
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;let checked=0;
 for(let i=0;i<p.count;i+=3){const normal=new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i));if(Math.abs(normal.z)>.001||Math.abs(normal.x)<.001||Math.abs(normal.y)<.001)continue;
  const tangent=new THREE.Vector3(0,1,0).addScaledVector(normal,-normal.y).normalize(),a=new THREE.Vector3().fromBufferAttribute(p,i);
  for(let j=1;j<3;j++){const delta=new THREE.Vector3().fromBufferAttribute(p,i+j).sub(a);assert(Math.abs(uv.getY(i+j)-uv.getY(i)-delta.dot(tangent)*.7)<2e-6);}
  checked++;
 }
 assert(checked>=2,'Must exercise actual sloped profile edge');assert.deepEqual(geometry.attributes.position.array,before);geometry.dispose();
 assert.throws(()=>fibreSurfaceUV([0,0,0],[0,0,0],[1,1,.008],'vertical'));
});
test('explicit horizontal cap keeps legacy across/along axes',()=>{
 const uv=fibreSurfaceUV([.596,.471,.004],[1,0,0],[1.192,.942,.008],'horizontal');assert(Math.abs(uv[0]-1.413)<1e-12);assert(Math.abs(uv[1]-.0028)<1e-12);
 const shader={uniforms:{},vertexShader:'#include <uv_vertex>'},source=new THREE.MeshStandardMaterial(),material=createInstanceFibreMaterial(THREE,source);material.onBeforeCompile(shader);
 assert(shader.vertexShader.includes('fcE.y>fcE.x&&fcE.y>=fcE.z?vec2(fcP.z*3.0,fcP.y*0.7):vec2(fcP.y*3.0,fcP.z*0.7)'));
 material.dispose();source.dispose();
});
test('candidate instancing keeps shared PBR maps and supplies all sampled UV channels',()=>{
 const source=new THREE.MeshStandardMaterial({color:'#f6f2e6',roughness:.83});
 source.name='FC_P222_0';source.map=new THREE.Texture();source.normalMap=new THREE.Texture();source.roughnessMap=new THREE.Texture();
 const material=createInstanceFibreMaterial(THREE,source,[4,2,0]);
 for(const key of ['map','normalMap','roughnessMap'])assert.equal(material[key],source[key]);
 assert(material.color.equals(source.color));assert.equal(material.roughness,source.roughness);assert.equal(material.name,source.name);
 assert.equal(source.userData.candidateMetricFibreUV,undefined);
 const shader={uniforms:{},vertexShader:'#include <uv_vertex>'};material.onBeforeCompile(shader);
 assert.deepEqual(shader.uniforms.fcUvOrigin.value.toArray(),[4,2,0]);
 for(const variable of ['vMapUv','vNormalMapUv','vRoughnessMapUv'])assert(shader.vertexShader.includes(variable));
 assert(!/\b(?:MAP_UV|NORMALMAP_UV|ROUGHNESSMAP_UV)\b/.test(shader.vertexShader),'PBR macro expansion must not keep normalized source UV');
 const geometry=new THREE.BoxGeometry(1,1,1),positions=geometry.attributes.position.array.slice();
 setInstanceFibreGrain(THREE,geometry,['вертикально','горизонтально']);assert.deepEqual([...geometry.attributes.fcUvGrain.array],[0,1]);assert.deepEqual(geometry.attributes.position.array,positions);
 material.dispose();source.dispose();geometry.dispose();
});
