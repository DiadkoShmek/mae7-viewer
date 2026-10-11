import {retainedReturnFootprints,retainedBalconyReturnSource} from './balcony-returns.js';
import {plinthSpec} from './plinth-plan.js';
import {roofExteriorTop} from './roof-geometry.js';
import {applyFibreSurfaceUV} from './fc-surface-uv.js';

// Display continuation of the authored return envelope and the project apron.
// Lower package and grey profile product/gauge are explicit candidates.
export function rainwaterChannelPlan(rainwaterPlan){
 return rainwaterPlan.pipes.map(p=>{const outlet=p.parts.find(q=>q.role==='outlet').points.at(-1),startZ=outlet[2]-p.s*.300;
  return {id:p.id,x:p.x,s:p.s,startZ,length:2,width:.350,lipY:-.610,slope:.02,
   contour:[[p.x-.175,startZ],[p.x+.175,startZ],[p.x+.175,startZ+p.s*2],[p.x-.175,startZ+p.s*2]],
   // Ark11 depicts the hollow shape, but does not dimension its product.
   // 50mm concrete bedding and 250mm aggregate DEPTH are written below it.
   section:[[-.175,0],[-.105,0],[-.0475,-.044],[.0475,-.044],[.105,0],[.175,0],[.175,-.160],[-.175,-.160]],
   approved:false,productDimensionsApproved:false};});
}
export function createGroundJunctions(THREE,building,garden,{board,joint,grey,concrete,rainwaterPlan}){
 const groups=[];
 function group(parent,id,assembly,title,source,note){const g=new THREE.Group();g.name=id;g.userData={assembly,component:{kind:assembly,title,source,note},approved:false};parent.add(g);groups.push(g);return g;}
 function mesh(g,id,role,geo,mat,extra={}){const m=new THREE.Mesh(geo,mat);m.name=id;m.castShadow=m.receiveShadow=true;m.userData={partId:id,assembly:g.userData.assembly,role,source:g.userData.component.source,physical:true,preservePhysicalProfile:true,quantityEligible:false,quantity:0,approved:false,...extra};g.add(m);return m;}
 function box(g,id,role,min,max,mat){const size=max.map((v,i)=>v-min[i]);if(size.some(v=>v<=0))throw Error('Invalid junction box');const m=mesh(g,id,role,new THREE.BoxGeometry(...size),mat,{bounds:{min,max}});m.position.set(...min.map((v,i)=>(v+max[i])/2));return m;}
 for(const r of retainedReturnFootprints()){
  const [left,,front]=r.min,right=r.max[0],rear=-5.649;
  const g=group(building,r.id+'-BASE-AND-CORNERS','retained-base-junction','Цоколь і кути збереженого виступу','§5.3; арк08; опис Артура',
   'Обшивання P0708мм до рівня основного цоколя; сірі прямокутні профілі. Нижній пакет, відступи, виріб профілю та кріплення — оглядовий варіант до звірки. Існуюче ядро не змінене.');
  const faces=[{id:'FRONT',axis:0,a:left,b:right,base:front+.008,normal:-1},
   {id:'LEFT',axis:2,a:front+.008,b:rear,base:left+.008,normal:-1},
   {id:'RIGHT',axis:2,a:front+.008,b:rear,base:right-.008,normal:1}];
  for(const f of faces){
   if(r.id.endsWith('G01')&&f.id==='LEFT'||r.id.endsWith('G04')&&f.id==='RIGHT')continue;
   const count=Math.ceil((f.b-f.a)/1.192),bottom=-plinthSpec.height,top=-plinthSpec.boardTopClearance;
   for(let i=0;i<count;i++){
    const a=f.a+(f.b-f.a)*i/count+(i?.004:0),b=f.a+(f.b-f.a)*(i+1)/count-(i+1<count?.004:0),shape=new THREE.Shape();
    [[a,bottom],[b,bottom],[b,top],[a,top]].forEach(([u,y],j)=>j?shape.lineTo(u,y):shape.moveTo(u,y));shape.closePath();
    const drills=[];for(const u of [a+.060,(a+b)/2,b-.060])for(const y of [bottom+.060,top-.060]){const h=new THREE.Path();h.absarc(u,y,.004,0,Math.PI*2,true);shape.holes.push(h);drills.push({u,y,diameterMM:8,approved:false});}
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:false,curveSegments:12,steps:1}),pos=geo.attributes.position;
    for(let j=0;j<pos.count;j++){const u=pos.getX(j),y=pos.getY(j),n=pos.getZ(j);f.axis===0?pos.setXYZ(j,u,y,f.base+f.normal*n):pos.setXYZ(j,f.base+f.normal*n,y,u);}
    if((f.axis===0&&f.normal<0)||(f.axis===2&&f.normal>0))for(let j=0;j<pos.count;j+=3){const v=[pos.getX(j+1),pos.getY(j+1),pos.getZ(j+1)];pos.setXYZ(j+1,pos.getX(j+2),pos.getY(j+2),pos.getZ(j+2));pos.setXYZ(j+2,...v);}
    geo.computeVertexNormals();applyFibreSurfaceUV(THREE,geo,'vertical');
    mesh(g,r.id+'-PLINTH-'+f.id+'-'+(i+1),'return-plinth-panel',geo,board,{frame:f,drills,thickness:.008,panelSize:[b-a,top-bottom]});
   }
   // A continuous black backing closes bores and the panel seam, rather
   // than exposing the unverified concrete / lower insulation package.
   const min=[0,bottom,0],max=[0,0,0],other=f.axis===0?2:0;
   min[f.axis]=f.a;max[f.axis]=f.b;const z=[f.base-f.normal*.003,f.base-f.normal*.005];min[other]=Math.min(...z);max[other]=Math.max(...z);
   box(g,r.id+'-PLINTH-'+f.id+'-BACKING','plinth-joint-backing',min,max,joint);
  }
  for(const [side,x] of [[-1,left],[1,right]])for(const [end,z,sz] of [['FRONT',front,-1],['REAR',rear,1]]){
   // At the two end returns this face continues the end facade without a
   // notch. Its front profile is owned by facade-corners; no duplicate fold.
   if((r.id.endsWith('G01')&&side<0)||(r.id.endsWith('G04')&&side>0))continue;
   const leg=.040,t=.0008,points=[[0,0],[-leg,0],[-leg,-t],[-t,-t],[-t,-leg],[0,-leg]].map(([u,v])=>[x+side*u+side*.001,z+sz*v+sz*.001]);
   const sh=new THREE.Shape();points.forEach(([u,v],j)=>j?sh.lineTo(u,v):sh.moveTo(u,v));sh.closePath();
   const bottom=-plinthSpec.height,top=roofExteriorTop(z),geo=new THREE.ExtrudeGeometry(sh,{depth:top-bottom,bevelEnabled:false,steps:1});
   geo.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,-1),new THREE.Vector3(0,1,0)));
   // The matrix above maps the polygon's Y to -Z; correct its authored
   // world Z and preserve front winding with the proper rotation.
   const pos=geo.attributes.position;for(let i=0;i<pos.count;i++)pos.setXYZ(i,pos.getX(i),pos.getY(i)+bottom,-pos.getZ(i));
   for(let i=0;i<pos.count;i+=3){const v=[pos.getX(i+1),pos.getY(i+1),pos.getZ(i+1)];pos.setXYZ(i+1,pos.getX(i+2),pos.getY(i+2),pos.getZ(i+2));pos.setXYZ(i+2,...v);}geo.computeVertexNormals();
   mesh(g,r.id+'-GREY-'+side+'-'+end,'grey-corner-profile',geo,grey,{sectionXZ:points,angleDegrees:90,gaugeCandidate:t,legCandidate:leg});
  }
  const apron=group(garden,r.id+'-APRON','return-apron','Бетонне обведення виступу','§5.2; арк10/PDF58','Ширина600мм; ухил2%. Товщина100мм і прив’язка висоти — кандидат моделі.');
  const gap=.020,w=.600,x0=left-gap,x1=right+gap,z0=front-gap,join=-(5.405+.183+plinthSpec.apronGap+plinthSpec.apronWidth);
  // Only the portion outside the existing straight apron is added. Three
  // disjoint strips meet it and wrap the projection without coplanar overlap.
  const runs=[['FRONT',[x0-w,z0-w],[x1+w,z0]],['LEFT',[x0-w,z0],[x0,join]],['RIGHT',[x1,z0],[x1+w,join]]];
  for(const [id,a,b] of runs){
   const geo=new THREE.BoxGeometry(b[0]-a[0],.100,b[1]-a[1]),pos=geo.attributes.position;
   const cx=(a[0]+b[0])/2,cz=(a[1]+b[1])/2;
   for(let i=0;i<pos.count;i++){const x=pos.getX(i)+cx,z=pos.getZ(i)+cz,out=Math.max(left-x,x-right,front-z,0);pos.setXYZ(i,x,pos.getY(i)-.710-.020*out,z);}geo.computeVertexNormals();
   mesh(apron,r.id+'-APRON-'+id,'concrete-apron',geo,concrete,{width:w,slope:.02,thicknessCandidate:.100});
  }
 }
 for(const p of rainwaterChannelPlan(rainwaterPlan)){
  const g=group(garden,p.id+'-CHANNEL','rainwater-channel','Бетонний водовідвід ·2м','§5.2; арк11/PDF59',
   'Жолоб2м із заглибленим каналом і ухилом від будинку. Арк11: бетонна підготовка50мм та щебінь250мм. Поперечник виробу, абсолютні рівні й приєднання до ділянки — оглядовий варіант до обміру.');
  const shape=new THREE.Shape();p.section.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:p.length,bevelEnabled:false,steps:1}),pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){const along=pos.getZ(i);pos.setXYZ(i,pos.getX(i)+p.x,pos.getY(i)+p.lipY-p.slope*along,p.startZ+p.s*along);}
  if(p.s<0)for(let i=0;i<pos.count;i+=3){const v=[pos.getX(i+1),pos.getY(i+1),pos.getZ(i+1)];pos.setXYZ(i+1,pos.getX(i+2),pos.getY(i+2),pos.getZ(i+2));pos.setXYZ(i+2,...v);}geo.computeVertexNormals();
  mesh(g,p.id+'-CHANNEL-TROUGH','sloped-concrete-channel',geo,concrete,p);
 }
 return {groups};
}
