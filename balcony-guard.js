import {balconyGuardSource as source} from './balcony-guard-source.js';
import {balconyMemberGeometry,balconyMemberMatrix} from './balcony-steel.js';
import {planeY} from './balcony-floor.js';
export {balconyGuardSource} from './balcony-guard-source.js';
const sequence=(lo,hi,max)=>Array.from({length:Math.ceil((hi-lo)/max)+1},(_,i)=>lo+(hi-lo)*i/Math.ceil((hi-lo)/max));
export function planBalconyGuard({bay,balconyId,steelPlan,fullSide}={}){
 if(!bay||!steelPlan||steelPlan.balconyId!==balconyId||![-1,1].includes(fullSide))throw Error('Guard needs canonical bay/steel/full side');
 const hw=bay.width/2,base=steelPlan.floorPlan.guardCentre-1+.020+.020,guardTop=steelPlan.floorPlan.guardCentre+.020,panels=[],supports=[],pads=[],corners=[];
 const member=(suffix,width,depth,start,end,authority,slopingFoot=false)=>{
  const p={id:balconyId+'-GUARD-'+suffix,partId:balconyId+'-GUARD-'+suffix,role:'guard-upright',type:'rhs',section:{width,height:depth,thickness:.003},start,end,length:end[1]-start[1],source:source.source,authority,approved:false,physical:true,quantityEligible:true,fabricationQuantityApproved:false,volume:(width*depth-(width-.006)*(depth-.006))*(end[1]-start[1])};
  if(slopingFoot)p.capLocalZ={start:{base:0,u:0,v:steelPlan.floorPlan.parameters.fall},end:{base:p.length,u:0,v:0}};
  supports.push(p);
 };
 const railLow=steelPlan.floorPlan.guardCentre-.020,railHigh=steelPlan.floorPlan.guardCentre+.020;
 for(const [i,u] of source.frontUprights.entries()){
  const xx=bay.x+u.localX,zz=bay.depth-.020,foot=planeY(steelPlan.floorPlan.rimPlane,xx,zz);
  member('FRONT-'+(i+1),u.faceWidth,u.depth,[xx,foot,zz],[xx,railLow,zz],'Five sections/axes from PDF65; coped candidate foot contacts sloping perimeter; deck recesses, welds/weather seals require shop design',true);
 }
 function panel(id,plane,width,height,origin,u,n,columns,supportFaces){
  if(width<=.2||height<=.2||!((width<=1.25&&height<=3.05)||(height<=1.25&&width<=3.05)))throw Error('Guard blank exceeds source stock');
  const rows=sequence(.100,height-.100,source.fixingMaximum),holes=columns.flatMap(x=>rows.map(y=>({x,y,diameter:.008}))),partId=balconyId+'-FC-'+id;
  panels.push({id:partId,partId,balconyId,role:'guard-panel',plane,width,height,thickness:.008,origin,u,v:[0,1,0],normal:n,holes,grain:'vertical',colour:'P070',supportFaces,source:source.source,physical:true,quantityEligible:true,newStockPart:true,fabricationQuantityApproved:false,approved:false,area:width*height,stockFit:{width:1.250,length:3.050,rotated:width>1.250},unknown:{...source.unknown}});
 }
 const joints=source.frontUprights.filter(q=>q.faceWidth===.08).map(q=>q.localX),cuts=[-hw,...joints,hw],mid=source.frontUprights.filter(q=>q.faceWidth===.04);
 for(let i=0;i<3;i++){
  const a=cuts[i]+(i?source.jointGap/2:0),b=cuts[i+1]-(i<2?source.jointGap/2:0),width=b-a,centre=mid.find(q=>q.localX>a&&q.localX<b);
  panel('FRONT-'+(i+1),'front',width,guardTop-base,[bay.x+a,base,bay.depth+.006],[1,0,0],[0,0,1],[.030,centre.localX-a,width-.030],
   [{x:i?-source.jointGap/2:.050,width:.100},{x:centre.localX-a,width:.040},{x:i<2?width+source.jointGap/2:width-.050,width:.100}]);
 }
 const rear=.029,span=bay.depth-rear;
 for(const side of [-1,1]){
  const full=side===fullSide,low=full?bay.bottom+.035:base,high=full?bay.top-.035:guardTop;
  const xx=bay.x+side*(hw-.020),zz=(rear+bay.depth)/2,foot=planeY(steelPlan.floorPlan.rimPlane,xx,zz),name='SIDE-'+(side<0?'L':'R');
  member(name+'-LOW',.040,.040,[xx,foot,zz],[xx,railLow,zz],'Display middle side support contacts outer15mm of floor-side beam; weld/capacity unresolved',true);
  if(full)member(name+'-HIGH',.040,.040,[xx,railHigh,zz],[xx,high,zz],'Full-height side support interrupted at existing40mm rail; upper joint/capacity unresolved');
  const origin=[bay.x+side*(hw+.006),low,side<0?rear:bay.depth],u=[0,0,-side];
  panel('SIDE-'+(full?'FULL':'LOW'),'side',span,high-low,origin,u,[side,0,0],[.030,span/2,span-.030],[{x:.050,width:.100},{x:span/2,width:.040},{x:span-.050,width:.100}]);
  corners.push({id:balconyId+'-GUARD-CORNER-'+side,side,x:bay.x+side*hw,z:bay.depth,low:Math.min(low,base),high,leg:.020,thickness:.001,candidate:true,approved:false});
 }
 // One strip per support, shared by both board edges at a joint.
 const front=panels.filter(p=>p.plane==='front');
 for(const [i,s] of [{localX:-hw+.050,faceWidth:.100},...source.frontUprights,{localX:hw-.050,faceWidth:.100}].entries()){
  const width=s.faceWidth===.080?.100:s.faceWidth,x=bay.x+s.localX;
  const holes=front.flatMap(p=>p.holes.filter(h=>Math.abs(p.origin[0]+h.x-x)<=width/2-.004).map(h=>({x:p.origin[0]+h.x-(x-width/2),y:h.y,diameter:.0055})));
  pads.push({id:balconyId+'-GUARD-PAD-FRONT-'+i,plane:'front',width,height:guardTop-base,origin:[x-width/2,base,bay.depth],u:[1,0,0],v:[0,1,0],normal:[0,0,1],holes,thickness:.003,candidate:true,approved:false});
 }
 for(const p of panels.filter(p=>p.plane==='side'))for(const [i,s] of p.supportFaces.entries()){
  const offset=s.x-s.width/2,origin=p.origin.map((v,j)=>v+p.u[j]*offset-p.normal[j]*.006);
  pads.push({id:p.id+'-PAD-'+i,plane:'side',width:s.width,height:p.height,origin,u:p.u,v:p.v,normal:p.normal,holes:p.holes.filter(h=>Math.abs(h.x-s.x)<=s.width/2-.004).map(h=>({...h,x:h.x-offset,diameter:.0055})),thickness:.003,candidate:true,approved:false});
 }
 return {balconyId,panels,supports,pads,corners,source,approved:false,quantityApproval:false,conflicts:[{sourceJointFaceWidth:.080,manufacturerMinimum:.100,resolution:'100mm wide3mm adapter strips shown as candidate; attachment and guard resistance require shop design',approved:false}],limits:'Project RHS80mm joint faces conflict with manufacturer100mm minimum. Adapter/pad thickness3mm and EPDM3mm are display candidates. Hole pattern follows supported geometry; no approved guard/impact/weld/fixing calculation. Shaft threads and steel drilling/engagement are not authored.'};
}
export function guardPanelGeometry(THREE,p){
 const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(p.width,0);shape.lineTo(p.width,p.height);shape.lineTo(0,p.height);shape.closePath();
 for(const h of p.holes){const hole=new THREE.Path();hole.absarc(h.x,h.y,h.diameter/2,0,Math.PI*2,true);shape.holes.push(hole);}
 const g=new THREE.ExtrudeGeometry(shape,{depth:p.thickness,bevelEnabled:false,curveSegments:12,steps:1});
 const a=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<a.count;i++)uv.setXY(i,a.getX(i)/1.250,a.getY(i)/3.050);uv.needsUpdate=true;return g;
}
export function guardPanelMatrix(THREE,p){const m=new THREE.Matrix4().makeBasis(new THREE.Vector3(...p.u),new THREE.Vector3(...p.v),new THREE.Vector3(...p.normal));m.setPosition(...p.origin);return m;}
export function createBalconyGuard(THREE,parent,{plan,materials}={}){
 if(!plan||!materials?.board||!materials?.steel||!materials?.joint)throw Error('Guard materials required');
 const group=new THREE.Group();group.name=plan.balconyId+'-GUARD';group.userData={assembly:'balcony-guard',balconyId:plan.balconyId,conflicts:plan.conflicts,limits:plan.limits,approved:false};parent.add(group);
 const add=(geometry,id,role,material,extra={})=>{const m=new THREE.Mesh(geometry,material);m.name=id;m.castShadow=m.receiveShadow=true;m.userData={partId:id,assembly:'balcony-guard',balconyId:plan.balconyId,role,physical:true,preservePhysicalProfile:true,approved:false,...extra};group.add(m);return m;};
 for(const p of plan.supports){const m=add(balconyMemberGeometry(THREE,p),p.id,p.role,materials.steel,p);m.applyMatrix4(balconyMemberMatrix(THREE,p));}
 for(const p of plan.pads){
  const holder=new THREE.Group();holder.name=p.id;holder.applyMatrix4(guardPanelMatrix(THREE,p));holder.userData={assembly:'balcony-guard',balconyId:plan.balconyId,role:'guard-adapter-group',approved:false};group.add(holder);
  for(const [role,material,z,bore] of [['guard-adapter',materials.steel,0,.0055],['guard-EPDM',materials.joint,.003,.008]]){
   const part={...p,holes:p.holes.map(h=>({...h,diameter:bore}))},m=new THREE.Mesh(guardPanelGeometry(THREE,part),material);m.position.z=z;m.name=p.id+'-'+role;m.castShadow=m.receiveShadow=true;m.userData={...part,partId:m.name,assembly:'balcony-guard',balconyId:plan.balconyId,role,approved:false,preservePhysicalProfile:true};holder.add(m);
  }
 }
 for(const p of plan.corners){
  const sh=new THREE.Shape(),s=p.side,outer=.015,t=p.thickness,points=[[outer,outer],[outer-p.leg,outer],[outer-p.leg,outer-t],[outer-t,outer-t],[outer-t,outer-p.leg],[outer,outer-p.leg]].map(([x,z])=>[p.x+s*x,p.z+z]);if(s<0)points.reverse();
  points.forEach(([x,z],i)=>i?sh.lineTo(x,z):sh.moveTo(x,z));sh.closePath();const g=new THREE.ExtrudeGeometry(sh,{depth:p.high-p.low,bevelEnabled:false});g.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,-1,0)).setPosition(0,p.high,0));add(g,p.id,'guard-corner-profile',materials.steel,p);
 }
 for(const p of plan.panels){
  const holder=new THREE.Group();holder.name=p.id+'-ASSEMBLY';holder.applyMatrix4(guardPanelMatrix(THREE,p));holder.userData={assembly:'balcony-guard-panel',balconyId:plan.balconyId,panelId:p.id,plan:p,approved:false};group.add(holder);
  const component={kind:'balcony-guard-panel',title:`Плита P070 · ${Math.round(p.width*1000)}×${Math.round(p.height*1000)} мм`,source:'Арк16–17; Swisspearl Steel DIM02.2026',note:`FC8мм; ${p.holes.length} отворівØ8мм на показаних опорах. Поділ/адаптери100мм/кріплення — кандидати; огорожу та з’єднання ще потрібно розрахувати.`};
  const board=new THREE.Mesh(guardPanelGeometry(THREE,p),materials.board);board.name=p.id;board.castShadow=board.receiveShadow=true;board.userData={...p,assembly:'balcony-guard',component,preservePhysicalProfile:true};holder.add(board);
  const heads=new THREE.InstancedMesh(new THREE.CylinderGeometry(.006,.006,.0012,20).rotateX(Math.PI/2),materials.steel,p.holes.length),shafts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.00275,.00275,.025,12).rotateX(Math.PI/2),materials.steel,p.holes.length);
  heads.name=p.id+'-HEADS';shafts.name=p.id+'-SHAFTS';
  for(const [i,h] of p.holes.entries()){const m=new THREE.Matrix4().makeTranslation(h.x,h.y,p.thickness+.0006);heads.setMatrixAt(i,m);m.makeTranslation(h.x,h.y,p.thickness-.0125);shafts.setMatrixAt(i,m);}
  for(const [m,role] of [[heads,'guard-fastener-head'],[shafts,'guard-fastener-shaft']]){m.instanceMatrix.needsUpdate=true;m.castShadow=m.receiveShadow=true;m.userData={assembly:'balcony-guard',balconyId:plan.balconyId,panelId:p.id,role,preservePhysicalProfile:true,approved:false,candidate:true,product:source.screwDisplay,components:p.holes.map((h,i)=>({partId:p.id+'-FIX-'+(i+1),kind:'balcony-guard-fixing',boreDiameter:.008,source:source.source,approved:false,quantityEligible:true,fabricationQuantityApproved:false}))};holder.add(m);}
 }
 return {group,plan};
}
