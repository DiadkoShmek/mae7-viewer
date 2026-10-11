import {roofExteriorTop} from './roof-geometry.js';
import {applyFibreSurfaceUV} from './fc-surface-uv.js';
import {candidateFastenerAxis} from './panel-fastener-pattern.js';
// PDF50/ark02 vector outlines, repeated PDF51/52; §5.8.2/ark17:
// retain the wall returns and use50mm insulation/deep-impregnated timber.
// The vector values are graphic candidates, not a material/height survey.
export const retainedBalconyReturnSource=Object.freeze({pdfSHA256:'fc22c9eb0964b52800a5d926fa2574b3f95654f64d1a3f17f21a0afaddd15f99',
 source:'PDF50/арк02 seq4630–4633; PDF51/52 repeat; PDF65/арк17',existingWallFace:5.405,
 graphicNormalExtension:.8001257466205568,
 // Photo-guided assembled front: finished return flush with the balcony's
 // 5.620m facade plane +1.030m projection. Graphic core depth stays separate.
 normalExtension:.748,depthAuthority:'Display fit to written11885mm full end wall; Ark02 differs5mm; core depth requires site measurement',
 insulation:.050,boardWidth:.100,boardThickness:.025,claddingThickness:.008,
 finishThickness:.083,defaultDisplayHeight:roofExteriorTop(-5.405),displayCoreBottom:-1.100,
 bottomAuthority:'Basement plan retains the returns; -1.100m is a buried display termination only, not a surveyed footing level',
 surveyedCoreBottom:null,coreMaterial:null,surveyedHeight:null,approved:false});
export const retainedBalconyReturns=Object.freeze([
 ['G01',-20.047595095881796,-19.517353033637217,[272.7,406.22,282.72,421.34]],
 ['G02',-6.8169443571203985,-6.2962276013832135,[522.72,406.22,532.56,421.34]],
 ['G03',6.283527192706696,6.8042439484438875,[770.28,406.22,780.12,421.34]],
 ['G04',19.425275070732475,19.955517132977057,[1018.62,406.22,1028.64,421.34]]
].map(([suffix,x0,x1,pdfBounds])=>Object.freeze({id:'NW-EXISTING-PROJECTION-'+suffix,x0,x1,pdfBounds:Object.freeze(pdfBounds),coordinateFrame:'world X; NW outward is world−Z',approved:false})));

export function retainedReturnFootprints({height=retainedBalconyReturnSource.defaultDisplayHeight}={}){
 if(!Number.isFinite(height)||height<=0)throw Error('Invalid retained return candidate height');
 const s=retainedBalconyReturnSource;
 return retainedBalconyReturns.map((r,i)=>({...r,min:[i===0?-20.230:r.x0-s.finishThickness,0,-s.existingWallFace-s.normalExtension-s.finishThickness],
  max:[i===3?20.230:r.x1+s.finishThickness,height,-s.existingWallFace],height,heightAuthority:'Photo-guided continuation to PP-1 underside; not a surveyed return termination',coreMaterial:null,
  cornerAuthority:'End return finish shares the end-facade plane ±20.230m; existing core is unchanged, packout/support require site detail'}));
}

// Bare retained cores, distinct from the above-grade insulated finish envelope.
export function retainedCoreFootprints(){
 const s=retainedBalconyReturnSource;
 return retainedBalconyReturns.map(r=>({...r,min:[r.x0,s.displayCoreBottom,-s.existingWallFace-s.normalExtension],
  max:[r.x1,s.defaultDisplayHeight,-s.existingWallFace],approved:false,quantityEligible:false,quantity:0}));
}

/** Smallest translation of a candidate bay, with original source openings fixed. */
export function fitBalconyReturnCentre(sourceX,{width=3.315,canopyOverhang=.060,clearance=.010}={}){
 if(![sourceX,width,canopyOverhang,clearance].every(Number.isFinite)||width<=0||canopyOverhang<0||clearance<0)throw Error('Invalid balcony return fit');
 const half=width/2+canopyOverhang;
 // assembly-geometry's NW localX is -worldX. Do not reinterpret sourceX.
 const forbidden=retainedReturnFootprints().map(r=>[-r.max[0]-half-clearance,-r.min[0]+half+clearance]);
 const choices=[sourceX,...forbidden.flat()].filter(x=>forbidden.every(([a,b])=>x<=a+1e-10||x>=b-1e-10));
 if(!choices.length)throw Error('No balcony centre clears retained return');
 const x=choices.sort((a,b)=>Math.abs(a-sourceX)-Math.abs(b-sourceX)||a-b)[0];
 // Written combined2530 assembly fits inside written3315 bay. A larger shift
 // would conceal a real source conflict; never move the actual aperture.
 if(Math.abs(x-sourceX)>(width-2.530)/2+1e-9)throw Error('HOLD: retained return fit would exclude the unchanged source doorway/window');
 return {x,sourceX,originalX:sourceX,sourceCandidateOffset:x-sourceX,approved:false,
  fitAuthority:'Minimum graphic candidate translation; unchanged3315 bay/2530 source assembly; canopy60mm overhang and return10mm clearance',clearance,canopyOverhang};
}

export function retainedReturnFacadeExclusions(height){
 return retainedReturnFootprints({height:height/1000}).map(r=>{
  // NW facade local exterior-left→right is −worldX +20.2. Round outwards
  // for integer-mm planner exclusion; these are not extra window stock.
  const x=Math.max(0,Math.floor((-r.max[0]+20.2)*1000)),right=Math.min(40400,Math.ceil((-r.min[0]+20.2)*1000));
  return {id:r.id+'-FOOTPRINT',x,y:0,width:right-x,height:Math.min(Math.ceil(r.height*1000),height),kind:'retained-wall-return-footprint',
   physicalOpening:false,quantityEligible:false,quantity:0,approved:false,dimensionSource:retainedBalconyReturnSource.source};
 });
}

export function planRetainedBalconyReturns({height}={}){
 const followRoof=height===undefined;
 const s=retainedBalconyReturnSource,footprints=retainedReturnFootprints({height:height??s.defaultDisplayHeight}),returns=[];
 for(const r of footprints){
  const height=r.height;
  const parts=[],rear=-s.existingWallFace,front=rear-s.normalExtension;
  const add=(suffix,role,material,min,max)=>{if(min.some((v,i)=>!Number.isFinite(v)||max[i]<=v))throw Error('Invalid retained return box');
   const topYAtZ=followRoof?[roofExteriorTop(min[2]),roofExteriorTop(max[2])]:[height,height];
   max[1]=Math.max(...topYAtZ);
   parts.push({id:r.id+'-'+suffix,partId:r.id+'-'+suffix,role,material,bounds:{min,max},topYAtZ,volume:(max[0]-min[0])*(max[2]-min[2])*((topYAtZ[0]+topYAtZ[1])/2-min[1]),
    physical:true,quantityEligible:false,quantity:0,newStockPart:false,approved:false,...(material==='P222'?{grain:'vertical'}:{})});};
  add('CORE','retained-core','core',[r.x0,s.displayCoreBottom,front],[r.x1,height,rear]);
  function surface(label,u0,u1,base,normal,axis){
   const length=u1-u0,axes=[u0+.050,...(length>.600?[(u0+u1)/2]:[]),u1-.050];
   if(axes.some((x,i)=>i&&x-axes[i-1]<.100-1e-9))throw Error('HOLD: return100mm candidate boards overlap');
   function bounds(a,b,n0,n1){const min=[0,0,0],max=[0,height,0];min[axis]=a;max[axis]=b;
    const other=axis===0?2:0,values=[base+normal*n0,base+normal*n1];min[other]=Math.min(...values);max[other]=Math.max(...values);return [min,max];}
   let cursor=u0;
   for(const [i,u] of axes.entries()){
    if(u-.025>cursor)add(label+'-WOOL-'+i,'source50-insulation','wool',...bounds(cursor,u-.025,0,.050));
    add(label+'-TIMBER-'+i,'treated-timber-replaces-wool','wood',...bounds(u-.025,u+.025,0,.050));
    add(label+'-BOARD-'+i,'candidate100x25-batten','wood',...bounds(u-.050,u+.050,.050,.075));cursor=u+.025;
   }
   if(cursor<u1)add(label+'-WOOL-END','source50-insulation','wool',...bounds(cursor,u1,0,.050));
  }
  // Side insulation ends at the core nose. Front insulation covers both50mm
  // side corners; the shells touch but never overlap their material volumes.
  surface('LEFT',front,rear,r.x0,-1,2);surface('RIGHT',front,rear,r.x1,1,2);
  surface('FRONT',r.x0-.050,r.x1+.050,front,-1,0);
  // The finished return is a three-sided facade, not three storey-high caps.
  // Shared 1258mm rows continue around the corners; the substrate stays bare
  // below Y=0. This visible layout is a candidate, not an ordered cut schedule.
  function finish(label,u0,u1,base,normal,axis){
   const segments=Math.ceil((u1-u0)/1.192),cuts=Array.from({length:segments+1},(_,i)=>u0+(u1-u0)*i/segments),joint=.008;
   const top=u=>followRoof?roofExteriorTop(axis===2?u:base+normal*.008):height;
   const bounds=(a,b,y0,y1,n0,n1)=>{const min=[0,y0,0],max=[0,y1,0],other=axis===0?2:0;min[axis]=a;max[axis]=b;min[other]=Math.min(base+normal*n0,base+normal*n1);max[other]=Math.max(base+normal*n0,base+normal*n1);return {min,max};};
   const piece=(id,role,material,a,b,y0,y1,n0,n1)=>{const bound=bounds(a,b,y0,y1,n0,n1),tops=[Math.min(y1,top(a)),Math.min(y1,top(b))];
    if(Math.min(...tops)<=y0)return null;
    const p={id:r.id+'-'+id,partId:r.id+'-'+id,role,material,bounds:bound,topYAtZ:axis===2?tops:[Math.min(...tops),Math.min(...tops)],volume:(b-a)*(n1-n0)*((tops[0]+tops[1])/2-y0),physical:true,quantityEligible:false,quantity:0,newStockPart:false,approved:false,surface:label};bound.max[1]=Math.max(...tops);parts.push(p);return p;};
   for(let c=1;c<segments;c++)piece('JOINT-'+label+'-V'+c,'candidate-joint-backing','EPDM',cuts[c]-joint/2,cuts[c]+joint/2,0,Math.max(top(u0),top(u1)),0,.002);
   for(let row=0;row*1.258<Math.min(top(u0),top(u1));row++){
    const y0=row*1.258,y1=y0+1.250;
    for(let c=0;c<segments;c++){
     const a=cuts[c]+(c?joint/2:0),b=cuts[c+1]-(c+1<segments?joint/2:0),p=piece('FC-'+label+'-R'+String(row+1).padStart(2,'0')+'-C'+(c+1),'candidate-fibre-cement-return','P222',a,b,y0,y1,0,.008);
     if(!p)continue;
     p.grain='vertical';p.finishAuthority='User upper facade wrap and bare lower plinth; illustrative 8mm/1250mm panel layout, not fabrication approval';
     p.profile=[[a,y0],[b,y0],[b,Math.min(y1,top(b))],[a,Math.min(y1,top(a))]];
     p.frame={axis,base,normal};p.drills=[];
     const topAt=u=>p.profile[3][1]+(p.profile[2][1]-p.profile[3][1])*(u-a)/(b-a),h=Math.min(topAt(a),topAt(b))-y0;
     for(const u of candidateFastenerAxis((b-a)*1000,30))for(const y of candidateFastenerAxis(h*1000,60)){
      if(topAt(a+u/1000)-(y0+y/1000)<.006)continue;
      p.drills.push({u:a+u/1000,y:y0+y/1000,diameterMM:8,approved:false});
     }
     if(y1<Math.min(top(a),top(b)))piece('JOINT-'+label+'-H'+(row+1)+'-C'+(c+1),'candidate-joint-backing','EPDM',a,b,y1,Math.min(y1+joint,top(a),top(b)),0,.002);
    }
   }
  }
  // The two outer skins continue the existing end facade. Stop at its
  // 11.24m rear edge: extending to the core face duplicates the end panels.
  // Outer end faces belong to the full end-wall grid, never a second skin.
  if(!r.id.endsWith('G01'))finish('LEFT',front-.075,rear,r.min[0]+.008,-1,2);
  if(!r.id.endsWith('G04'))finish('RIGHT',front-.075,rear,r.max[0]-.008,1,2);
  finish('FRONT',r.min[0],r.max[0],front-.075,-1,0);
  returns.push({...r,parts,sourceFacts:{insulationThickness:.050,treatedTimberRequired:true,coreMaterial:null,surveyedHeight:null},
   unknown:{coreCondition:null,actualHeight:null,actualCoreBottom:null,foundation:null,baseWrapDetail:null,anchors:null,fireDetail:null,boardPitchApproval:null,orderedFCParts:null},approved:false});
 }
 return {returns,source:retainedBalconyReturnSource,approved:false,quantityAuthority:false,
  note:'Чотири збережені стінові виступи є й на плані підвалу. Ядро продовжене під умовний ґрунт; матеріал, глибину та обгортання цоколя обміряти.50мм утеплення/просочена деревина за джерелом;100×25 дошки,FC8P222, крок і завершення — оглядовий кандидат.'};
}

/** Parent uses world building coordinates; existing source materials are supplied. */
export function createRetainedBalconyReturns(THREE,parent,{materials={},height}={}){
 if(!parent?.isObject3D||['core','wool','wood','P222','EPDM'].some(k=>!materials[k]?.isMaterial))throw Error('Retained returns require existing core/wool/wood/P222/EPDM materials');
 const plan=planRetainedBalconyReturns({height}),groups=[];
 for(const r of plan.returns){const group=new THREE.Group();group.name=r.id;group.userData={assembly:'retained-balcony-return',retainedWallReturnId:r.id,sourceFacts:r.sourceFacts,unknown:r.unknown,approved:false,
   component:{kind:'retained-wall-return',title:'Збережений стіновий виступ · утеплення50мм',source:plan.source.source,note:plan.note}};parent.add(group);groups.push(group);
  for(const p of r.parts){const {min,max}=p.bounds,[a,b]=p.topYAtZ;
   if(p.profile){
    const shape=new THREE.Shape();p.profile.forEach(([u,y],i)=>i?shape.lineTo(u,y):shape.moveTo(u,y));shape.closePath();
    for(const d of p.drills){const hole=new THREE.Path();hole.absarc(d.u,d.y,.004,0,Math.PI*2,true);shape.holes.push(hole);}
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:false,steps:1,curveSegments:12}),pos=geo.attributes.position,{axis,base,normal}=p.frame;
    for(let i=0;i<pos.count;i++){const u=pos.getX(i),y=pos.getY(i),n=pos.getZ(i);axis===0?pos.setXYZ(i,u,y,base+normal*n):pos.setXYZ(i,base+normal*n,y,u);}
    if((axis===0&&normal<0)||(axis===2&&normal>0))for(let i=0;i<pos.count;i+=3){const b=[pos.getX(i+1),pos.getY(i+1),pos.getZ(i+1)];pos.setXYZ(i+1,pos.getX(i+2),pos.getY(i+2),pos.getZ(i+2));pos.setXYZ(i+2,...b);}
    geo.computeVertexNormals();applyFibreSurfaceUV(THREE,geo,'vertical');
    const mesh=new THREE.Mesh(geo,materials.P222);mesh.name=p.id;mesh.castShadow=mesh.receiveShadow=true;mesh.userData={...p,assembly:'retained-balcony-return',retainedWallReturnId:r.id,source:plan.source.source,sourceFacts:r.sourceFacts,unknown:r.unknown,preservePhysicalProfile:true};group.add(mesh);continue;
   }
   const vertices=[min[0],min[1],min[2],max[0],min[1],min[2],max[0],min[1],max[2],min[0],min[1],max[2],min[0],a,min[2],max[0],a,min[2],max[0],b,max[2],min[0],b,max[2]];
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex([0,1,2,0,2,3,4,6,5,4,7,6,0,5,1,0,4,5,1,6,2,1,5,6,2,7,3,2,6,7,3,4,0,3,7,4]);
   const flat=geometry.toNonIndexed();geometry.dispose();flat.computeVertexNormals();
   const mesh=new THREE.Mesh(flat,materials[p.material]);mesh.name=p.id;mesh.castShadow=mesh.receiveShadow=true;
   mesh.userData={...p,assembly:'retained-balcony-return',retainedWallReturnId:r.id,source:plan.source.source,sourceFacts:r.sourceFacts,unknown:r.unknown,preservePhysicalProfile:true};group.add(mesh);}
 }
 return {groups,plan};
}
