// Visual fixing candidate: geometry fits the existing 8 mm bores. Product,
// anchorage and fixed/sliding-point schedule remain unapproved.
export const screwSpec=Object.freeze({shaftDiameterMM:4.8,headDiameterMM:12,headHeightMM:1.8,representedLengthMM:14,approved:false});
export function panelScrewGeometry(THREE){
 const vertices=[],tri=(a,b,c)=>vertices.push(...a,...b,...c),ring=(r,z,n=12)=>Array.from({length:n},(_,i)=>[r*Math.cos(i*2*Math.PI/n),r*Math.sin(i*2*Math.PI/n),z]);
 const join=(a,b)=>{for(let i=0;i<a.length;i++){const j=(i+1)%a.length;tri(a[i],a[j],b[j]);tri(a[i],b[j],b[i]);}};
 const shaftA=ring(.0024,-.014),shaftB=ring(.0024,0),rimA=ring(.006,0),rimB=ring(.006,.0011),top=ring(.0056,.0018);
 const recess=ring(1,.0018).map((p,i)=>[p[0]*(i%2?.00125:.0021),p[1]*(i%2?.00125:.0021),p[2]]),floor=recess.map(p=>[p[0],p[1],.0009]);
 join(shaftA,shaftB);join(shaftB,rimA);join(rimA,rimB);join(rimB,top);join(top,recess);join(recess,floor);
 for(let i=0;i<12;i++){const j=(i+1)%12;tri(shaftA[j],shaftA[i],[0,0,-.014]);tri(floor[i],floor[j],[0,0,.0009]);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function addPanelScrews(THREE,parent,plan,{material,z=.029,normal=[0,0,1],centres}={}){
 if(!parent?.isObject3D||!Array.isArray(centres??plan?.points))throw Error('Invalid screw input');
 const points=centres??plan.points.map(p=>[p.x/1000-plan.width/2000,p.y/1000,z]);
 const own=!material,m=material??new THREE.MeshStandardMaterial({color:0x929797,roughness:.42,metalness:.5}),geometry=panelScrewGeometry(THREE),mesh=new THREE.InstancedMesh(geometry,m,points.length),dummy=new THREE.Object3D();if(own)m.userData={candidateScrewOwnedMaterial:true};
 dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...normal).normalize());
 points.forEach((p,i)=>{if(p.length!==3||p.some(v=>!Number.isFinite(v)))throw Error('Invalid screw centre');dummy.position.fromArray(p);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
 mesh.userData={representation:'panel-screws',spec:screwSpec,physical:false,quantityEligible:false,newStockPart:false,quantity:0,approved:false};mesh.raycast=()=>{};mesh.receiveShadow=true;mesh.castShadow=false;mesh.computeBoundingBox();mesh.computeBoundingSphere();parent.add(mesh);
 let disposed=false;return {mesh,dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geometry.dispose();mesh.dispose();if(own)m.dispose();}};
}
