import * as THREE from 'three';
// Reorder only the exploded presentation. The actual assembled bracket solids
// and all machining/quantity metadata remain byte-identical.
export function separatePlinthSupportInspection(cut,groups){
 cut.updateWorldMatrix(true,true);const owners=[],surfaces=[],ids=new Set();
 cut.traverse(o=>{if(o.userData.native_id&&o.userData.authoring?.kind==='supportAngleY'){owners.push(o);ids.add(o.userData.native_id);}});
 if(!owners.length)return {setSpread(){},bounds(){return new THREE.Box3();},count:0};
 cut.traverse(o=>{if(!o.isMesh||!o.userData.source_members_json)return;const members=JSON.parse(o.userData.source_members_json);if(!members.some(id=>ids.has(id)))return;if(!members.every(id=>ids.has(id)))throw Error('Plinth bracket shares a protected native bucket');surfaces.push(o);});
 const group=new THREE.Group();group.name='plinth-brackets-before-EPS';groups[0].add(group);group.updateWorldMatrix(true,false);
 const moved=new Set();for(const o of owners){group.attach(o);moved.add(o);}
 for(const mesh of surfaces){let covered=false;for(let p=mesh;p;p=p.parent)if(moved.has(p)){covered=true;break;}if(!covered)group.attach(mesh);}
 const base=group.position.clone(),localBox=new THREE.Box3(),inv=cut.matrixWorld.clone().invert();
 group.updateWorldMatrix(true,true);group.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();localBox.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld)));});
 const bounds=spread=>localBox.clone().translate(new THREE.Vector3(0,0,.08*spread/100)).applyMatrix4(cut.matrixWorld);
 return {count:owners.length,setSpread(spread){group.position.copy(base);group.position.z+=.08*spread/100;},bounds};
}
