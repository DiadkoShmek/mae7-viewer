import {subtractRect} from './engineering.js';

// Optical footprint of the black joint backing at the cladding's rear face.
// Zero thickness: tape gauge, product and horizontal joint detail are not
// ordered or added to quantities. The ventilation cavity remains empty.
export function planJointBackings(parts,{openings=[],bounds,width=90}={}){
 const result=[];
 for(const part of parts)for(const ring of [part.outer??part.points??[[part.x,part.y],[part.x+part.width,part.y],[part.x+part.width,part.y+part.height],[part.x,part.y+part.height]],...(part.holes??[])])for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];let r;
  if(Math.abs(a[0]-b[0])<1e-7)r={x:a[0]-width/2,y:Math.min(a[1],b[1]),width,height:Math.abs(a[1]-b[1])};
  else if(Math.abs(a[1]-b[1])<1e-7)r={x:Math.min(a[0],b[0]),y:a[1]-width/2,width:Math.abs(a[0]-b[0]),height:width};
  else continue;
  if(bounds){const x=Math.max(r.x,bounds.x),y=Math.max(r.y,bounds.y),x1=Math.min(r.x+r.width,bounds.x+bounds.width),y1=Math.min(r.y+r.height,bounds.y+bounds.height);r={x,y,width:x1-x,height:y1-y};}
  if(r.width<=1e-7||r.height<=1e-7)continue;
  let pieces=[r];for(const cut of [...openings,...result])pieces=pieces.flatMap(p=>subtractRect(p,cut));
  result.push(...pieces);
 }
 return result;
}
export function createJointBackings(THREE,parent,rectangles,{originX=0,originY=0,z=0,name='black-joint-backing'}={}){
 if(!rectangles.length)return null;
 const material=new THREE.MeshStandardMaterial({color:'#171b1a',roughness:1,side:THREE.DoubleSide});material.name='joint_backing_optical_footprint';
 material.userData={illustrative:true,materialFamily:'rubber',orderedProduct:null,quantityEligible:false};
 const geometry=new THREE.PlaneGeometry(1,1),mesh=new THREE.InstancedMesh(geometry,material,rectangles.length),dummy=new THREE.Object3D();
 rectangles.forEach((r,i)=>{dummy.position.set((r.x+r.width/2)/1000-originX,(r.y+r.height/2)/1000-originY,z);dummy.scale.set(r.width/1000,r.height/1000,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
 mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=true;
 mesh.userData={representation:'joint-backing-footprint',physical:false,illustrative:true,quantityEligible:false,quantity:0,newStockPart:false,approved:false,product:null,gauge:null,ventilationCavityFilled:false};
 parent.add(mesh);return mesh;
}
