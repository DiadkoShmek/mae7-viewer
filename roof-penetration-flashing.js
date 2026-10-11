import {roofSurfaceY} from './roof-geometry.js';
// A reviewable metal apron/boot candidate, not a specified manufacturer kit.
// Keep existing vertical pipes, roof holes and clear air passages unchanged.
export const penetrationFlashingPlan=[
 {id:'ROOF-EXHAUST',x:18.6,z:-3.3,pipeRadius:.2,footRadius:.285,halfWidth:.38,height:.22},
 ...[-15,-8.5,-2.8,5,10.5,17].map((x,i)=>({id:'ROOF-VENT-'+(i+1),x,z:5.4,pipeRadius:.06,footRadius:.092,halfWidth:.16,height:.10}))
];
export function createPenetrationFlashing(T,p){
 const t=.0006,r=p.pipeRadius+.0005,n=64,positions=[],indices=[];
 for(const inside of [false,true])for(const top of [false,true])for(let i=0;i<n;i++){
  const a=i*2*Math.PI/n,radius=top?r+(inside?0:t):p.footRadius-(inside?t:0),x=p.x+radius*Math.cos(a),z=p.z+radius*Math.sin(a);
  positions.push(x,top?roofSurfaceY(p.z)+p.height:roofSurfaceY(z)+.0014,z);
 }
 for(let i=0;i<n;i++){
  const j=(i+1)%n;indices.push(i,n+i,j,j,n+i,n+j,2*n+i,2*n+j,3*n+i,2*n+j,3*n+j,3*n+i);
  indices.push(n+i,3*n+i,n+j,n+j,3*n+i,3*n+j,i,j,2*n+i,j,2*n+j,2*n+i);
 }
 const boot=new T.BufferGeometry();boot.setAttribute('position',new T.Float32BufferAttribute(positions,3));boot.setIndex(indices);boot.computeVertexNormals();
 const shape=new T.Shape();const h=p.halfWidth;shape.moveTo(-h,-h);shape.lineTo(h,-h);shape.lineTo(h,h);shape.lineTo(-h,h);shape.closePath();
 const hole=new T.Path();hole.absarc(0,0,p.footRadius-t,0,2*Math.PI,true);shape.holes.push(hole);
 const apron=new T.ExtrudeGeometry(shape,{depth:t,bevelEnabled:false,curveSegments:32}),a=apron.attributes.position;
 for(let i=0;i<a.count;i++){const x=a.getX(i)+p.x,z=-a.getY(i)+p.z,depth=a.getZ(i);a.setXYZ(i,x,roofSurfaceY(z)+.0008+depth,z);}apron.computeVertexNormals();
 return [{id:p.id+'-FLASHING-APRON',role:'roof-penetration-apron',geometry:apron},{id:p.id+'-FLASHING-BOOT',role:'roof-penetration-boot',geometry:boot}];
}
