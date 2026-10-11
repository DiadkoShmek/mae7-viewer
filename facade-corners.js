import {roofExteriorTop} from './roof-geometry.js';
import {retainedReturnFootprints} from './balcony-returns.js';
// Ark08 names an exterior corner profile and vertical50×150 backing. The
// profile product, gauge and joint fixings are unspecified. This thin folded
// envelope closes the two authored faces; it is excluded from stock quantities.
export function planFacadeCorners(){
 const returns=retainedReturnFootprints();
 return [-1,1].flatMap(sx=>[-1,1].map(sz=>{const z=sz<0?returns[sx<0?0:3].min[2]:5.650;return {id:`CORNER-${sx>0?'SW':'NE'}-${sz>0?'SE':'NW'}`,sx,sz,
  outer:[sx*20.230,z],height:roofExteriorTop(z),bottom:-.660,leg:.046,gauge:.0006,
  source:'ark08 exterior corner profile / vertical50x150 backing',approved:false,quantityEligible:false,
  unknown:{profileProduct:null,material:null,orderedGauge:null,anchors:null,fireDetail:null}};}));
}
export function createFacadeCorners(THREE,parent,{material}={}){
 if(!parent?.isObject3D||!material?.isMaterial)throw Error('Facade corners need native parent and material');
 const groups=[];
 for(const p of planFacadeCorners()){
  const l=p.leg,t=p.gauge,shape=new THREE.Shape();[[0,0],[-l,0],[-l,-t],[-t,-t],[-t,-l],[0,-l]].forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:p.height-p.bottom,bevelEnabled:false,steps:1}),a=g.attributes.position;
  // The fold sits outside both skins, rather than coplanar with the return
  // front. A1mm display clearance keeps its0.6mm gauge clear of the board.
  for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getY(i),y=a.getZ(i)+p.bottom;a.setXYZ(i,p.outer[0]+p.sx*(x+.001),y,p.outer[1]+p.sz*(z+.001));}
  // Swap ofY/Z changes handedness; restore front-facing triangles.
  if(p.sx*p.sz>0)for(let i=0;i<a.count;i+=3)for(const k of ['X','Y','Z']){const q=a['get'+k](i+1);a['set'+k](i+1,a['get'+k](i+2));a['set'+k](i+2,q);}
  g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,material);mesh.name=p.id;mesh.castShadow=mesh.receiveShadow=true;
  mesh.userData={...p,partId:p.id,system:'facade-corner',physical:true,newStockPart:false,preservePhysicalProfile:true,
   component:{kind:'facade-corner',title:'Примикання фасадів · зовнішній кут',source:'Арк.08',note:'Профіль і брус50×150 за вузлом. Переріз профілю, матеріал і кріплення — показовий варіант до звірки.'}};
  parent.add(mesh);groups.push(mesh);
 }return groups;
}
