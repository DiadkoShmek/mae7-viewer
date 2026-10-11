// Presentation details share the real entrance owner. Interior layout and
// accessory dimensions remain candidates, excluded from material quantities.
import {planEntranceHall} from './entrance-access.js';
export function addEntranceContext(THREE,group,plan,materials){
 const s=plan.spec,add=(name,geometry,material,position=[0,0,0],extra={})=>{
  const m=new THREE.Mesh(geometry,material);m.name=name;m.position.fromArray(position);m.castShadow=m.receiveShadow=true;
  m.userData={assembly:'entrance-context',physical:false,illustrative:true,approved:false,quantityEligible:false,quantity:0,newStockPart:false,...(extra.authoring?{partId:name}:{}),...extra};group.add(m);return m;
 };
 const box=(name,size,pos,mat,extra)=>add(name,new THREE.BoxGeometry(...size),mat,pos,extra);
 const wall=new THREE.MeshStandardMaterial({color:'#c4bda9',roughness:.96}),floor=new THREE.MeshStandardMaterial({color:'#817c71',roughness:.9});wall.name='entrance_interior_plaster';floor.name='entrance_interior_floor';
 const inside={layoutAuthority:'Illustrative stair hall; floor plan/finishes require survey',quantityEligible:false};
 const hall=planEntranceHall(s);inside.accessAuthority=hall.authority;
 box('stair-hall-floor',[hall.width,hall.floor.thickness,hall.floor.length],[0,hall.threshold-hall.floor.thickness/2,hall.floor.centreZ],floor,inside);
 for(const side of [-1,1]){
  box('stair-hall-side-'+side,[.035,2.05,2.50],[side*(hall.openingWidth/2+.0175),hall.threshold+1.025,-1.55],wall,inside);
 }
 const shadow=new THREE.MeshStandardMaterial({color:'#4d4e48',roughness:1});shadow.name='entrance_stair_hall_depth';
 box('stair-hall-depth',[hall.openingWidth,2.0,.035],[0,hall.threshold+1.0,hall.flightBack-.65],shadow,inside);
 box('stair-hall-upper-landing',[hall.width,.080,.600],[0,hall.upperFloor-.040,hall.flightBack-.300],floor,inside);
 for(let i=0;i<hall.steps;i++){
  const height=(i+1)*hall.rise;
  box('stair-hall-step-'+i,[hall.width,height,hall.tread],[0,hall.threshold+height/2,hall.flightFront-(i+.5)*hall.tread],floor,inside);
 }
 // Close the light-looking cladding joint optically at its rear face; no
 // invented solid fills the source canopy's ventilation space.
 const black=new THREE.MeshStandardMaterial({color:'#171b1a',roughness:1,side:THREE.DoubleSide});black.name='entrance_joint_backing';
 for(const side of [-1,1]){
  const face=plan.parts.find(p=>p.id==='entrance-canopy-side-'+side),z0=face.profile[0][0],z1=face.profile[1][0],x=side*(s.width/2-s.board+.0005);
  const extra={canopyPart:true,representationOf:face.id,backingAuthority:'§5.6.1 joint tape; strip width/offset illustrative, product and ventilation acceptance unknown',authoring:{kind:'display',assembly:'canopy',layer:'fascia',explodeDirection:[side,0,0],approved:false,quantityEligible:false,quantity:0}};
  const m=add('canopy-side-joint-backing-'+side,new THREE.PlaneGeometry(z1-z0,.040),black,[x,plan.datums.soffitLower+.014,(z0+z1)/2],extra);m.rotation.y=side*Math.PI/2;
  const low=face.profile[3][1],high=face.profile[2][1],positions=[x,low-.010,z0,x,high-.010,z1,x,high+.020,z1,x,low+.020,z0];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
  add('canopy-side-upper-joint-backing-'+side,geometry,black,[0,0,0],extra);
 }
 // Classic profile appearance follows the selected node, while the source
 // SBS/Classic conflict stays recorded on the entrance owner.
 const roof=plan.parts.find(p=>p.id==='entrance-roof-skin'),run=(s.canopyFront-s.canopyBack)/Math.cos(s.pitch);
 for(let x=-s.width/2+.235;x<s.width/2-.10;x+=.475){
  const m=box('canopy-standing-seam',[.0006,.025,run],[x,roof.position[1]+.0128/Math.cos(s.pitch),roof.position[2]],materials.metal,{representationOf:'entrance-roof-skin',profilePitch:.475,profileHeight:.025,profileAuthority:'Classic appearance candidate; entrance pitch/profile not specified',canopyPart:true,layer:'roof',explodeDirection:[0,Math.cos(s.pitch),Math.sin(s.pitch)]});m.rotation.x=s.pitch;
 }
 const pipe=plan.parts.find(p=>p.id==='entrance-downpipe'),[x,,z]=pipe.position;
 for(const y of [pipe.bounds.min[1]+.30,pipe.bounds.max[1]-.25]){
  const ring=add('entrance-pipe-clamp',new THREE.TorusGeometry(pipe.radius+.002,.0025,6,32),materials.frame,[x,y,z],{clampApproval:false});ring.rotation.x=Math.PI/2;
  box('entrance-pipe-clamp-stand-off',[.015,.025,z-s.depth-pipe.radius],[x,y,(z-pipe.radius+s.depth)/2],materials.frame,{clampApproval:false});
 }
 return {wall,floor,shadow,black};
}
