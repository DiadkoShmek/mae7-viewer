import {plinthSpec} from './plinth-plan.js';

// Ark18 / PDF66 and §5.8.2: two 1500x600x600 blocks per side,
// additional C30/37 casting, 3xM16x250 WIT NORDIC+ anchors per post.
// Absolute elevation, plate size and bolt pattern remain display fits.
export const balconyFoundationSpec=Object.freeze({block:[.600,.600,1.500],layers:2,casting:.100,
 ground:plinthSpec.groundCandidate,basePlate:.012,plateWidth:.200,anchorsPerPost:3,anchorDiameter:.016,anchorLength:.250,
 source:'§5.8.2; арк18/PDF66',approved:false});
export const balconyPostBaseY=balconyFoundationSpec.ground+balconyFoundationSpec.casting+balconyFoundationSpec.basePlate;

export function planBalconyFoundation({bay,balconyId}){
 if(bay.f!==0)throw Error('Foundation belongs to the ground-storey balcony only');
 const s=balconyFoundationSpec,postX=bay.width/2-.05,posts=[],blocks=[];
 for(const [side,x] of [['L',bay.x-postX],['R',bay.x+postX]]){
  const rear=.029+.050,front=bay.depth-.050,centre=(rear+front)/2;
  for(let layer=0;layer<s.layers;layer++)blocks.push({id:balconyId+'-FOUNDATION-'+side+'-BLOCK-'+(layer+1),
   size:[...s.block],centre:[x,s.ground-.300-layer*.600,centre],role:'precast-foundation-block'});
  blocks.push({id:balconyId+'-FOUNDATION-'+side+'-CAST',size:[.600,s.casting,1.500],
   centre:[x,s.ground+s.casting/2,centre],role:'C30-37-anchor-casting'});
  for(const [end,z] of [['REAR',rear],['FRONT',front]])posts.push({id:balconyId+'-BASE-'+side+'-'+end,x,z,
   baseY:s.ground+s.casting,plateTop:balconyPostBaseY,plateWidth:s.plateWidth,plateThickness:s.basePlate,
   anchors:[[-.065,-.065],[.065,-.065],[0,.065]].map(([dx,dz])=>({x:x+dx,z:z+dz,diameter:s.anchorDiameter,length:s.anchorLength,
    product:'WIT NORDIC+ / 3xM16x250',patternApproved:false}))});
 }
 return {balconyId,blocks,posts,spec:s,approved:false,quantityAuthority:false,
  unknown:{absoluteFoundationElevation:null,plateProduct:null,plateGaugeApproval:null,anchorPattern:null,groundBearing:null,siteFit:null}};
}
export function createBalconyFoundation(THREE,parent,{bay,balconyId,concrete,steel}){
 const plan=planBalconyFoundation({bay,balconyId}),group=new THREE.Group();group.name=balconyId+'-FOUNDATION';parent.add(group);
 const component={kind:'balcony-foundation',title:'Фундамент і опорні пластини балкона',source:plan.spec.source,
  note:'Блоки1500×600×600 у два шари; верхня заливка C30/37;3×M16×250 на стійку за арк18. Рівень закладання й пластини — показове розміщення до обміру.'};
 group.userData={assembly:'balcony-foundation',balconyId,component,approved:false};
 const add=(id,role,geo,mat,meta={})=>{const m=new THREE.Mesh(geo,mat);m.name=id;m.castShadow=m.receiveShadow=true;
  m.userData={assembly:'balcony-foundation',balconyId,partId:id,role,physical:true,preservePhysicalProfile:true,quantityEligible:false,quantity:0,approved:false,source:plan.spec.source,...meta};group.add(m);return m;};
 for(const p of plan.blocks){const m=add(p.id,p.role,new THREE.BoxGeometry(...p.size),concrete,p);m.position.set(...p.centre);}
 for(const p of plan.posts){
  const h=p.plateWidth/2,shape=new THREE.Shape();[[-h,-h],[h,-h],[h,h],[-h,h]].forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
  for(const a of p.anchors){const hole=new THREE.Path();hole.absarc(a.x-p.x,p.z-a.z,.009,0,Math.PI*2,true);shape.holes.push(hole);}
  const geo=new THREE.ExtrudeGeometry(shape,{depth:p.plateThickness,bevelEnabled:false,steps:1,curveSegments:16});geo.rotateX(-Math.PI/2);
  const plate=add(p.id+'-PLATE','post-base-plate',geo,steel,p);plate.position.set(p.x,p.baseY,p.z);
  for(const [i,a] of p.anchors.entries()){
   const rod=add(p.id+'-ANCHOR-'+(i+1),'M16x250-anchor',new THREE.CylinderGeometry(.008,.008,.250,12),steel,a);
   rod.position.set(a.x,p.plateTop+.022-.125,a.z);
   const washer=add(p.id+'-WASHER-'+(i+1),'anchor-washer',new THREE.CylinderGeometry(.018,.018,.003,20),steel);washer.position.set(a.x,p.plateTop+.0015,a.z);
   const nut=add(p.id+'-NUT-'+(i+1),'M16-anchor-nut',new THREE.CylinderGeometry(.015,.015,.013,6),steel);nut.position.set(a.x,p.plateTop+.0095,a.z);
  }
 }
 return {group,plan};
}
