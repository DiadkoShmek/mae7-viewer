import {subtractRect} from './engineering.js';
import {assertLocalJointDeclaration} from './local-joint-contract.js';

const finite=n=>typeof n==='number'&&Number.isFinite(n);
const overlap=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
const contains=(r,x,y)=>x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;
const rect=p=>({x:p.x,y:p.y,width:p.width,height:p.height});
// A1192x1250 blank gives3x3. Shorter blanks get fewer rows; never force nine.
export function candidateFastenerAxis(length,edge,maximum=600){
 if(!finite(length)||length<=0||!finite(edge)||edge<=0||!finite(maximum)||maximum<=0)throw Error('Invalid fastener axis');
 if(length<=2*edge)return [length/2];
 const intervals=Math.ceil((length-2*edge)/maximum);
 return Array.from({length:intervals+1},(_,i)=>edge+(length-2*edge)*i/intervals);
}
function checkRect(r){if(!r||![r.x,r.y,r.width,r.height].every(finite)||r.width<=0||r.height<=0)throw Error('Invalid fastener/support rectangle');}
function validate(layout){
 assertLocalJointDeclaration(layout);
 if(!layout||![layout.width,layout.height].every(finite)||layout.width<=0||layout.height<=0||layout.joint!==8||!Array.isArray(layout.parts)||!Array.isArray(layout.openings))throw Error('Nine-hole candidate requires finite facade geometry and 8 mm joints');
 for(const p of [...layout.parts,...layout.openings])checkRect(p);
 if(layout.parts.some(p=>typeof p.id!=='string'||!p.id)||new Set(layout.parts.map(p=>p.id)).size!==layout.parts.length)throw Error('Unique canonical panel IDs required');
 const t=layout.localJointTopology,r=t?.generatedFrom;
 if(t){
  const holes=list=>JSON.stringify(list.map(({id,x,y,width,height})=>({id:id??null,x,y,width,height})).sort((a,b)=>String(a.id).localeCompare(String(b.id))||a.x-b.x||a.y-b.y||a.width-b.width||a.height-b.height));
  if(!r||r.width!==layout.width||r.height!==layout.height||JSON.stringify(r.cuts)!==JSON.stringify(layout.cuts)||JSON.stringify(r.levels)!==JSON.stringify(layout.levels)||holes(r.openings??[])!==holes(layout.openings))throw Error('Stale nine-hole local support topology');
 }
}
function inRing(points,x,y){
 if(!Array.isArray(points)||points.length<3||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite)))throw Error('Invalid panel fastener contour');
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [ax,ay]=points[j],[bx,by]=points[i],cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
  if(Math.abs(cross)<1e-8&&x>=Math.min(ax,bx)&&x<=Math.max(ax,bx)&&y>=Math.min(ay,by)&&y<=Math.max(ay,by))return true;
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
export function pointInPanelMaterial(panel,x,y){
 checkRect(panel);if(!finite(x)||!finite(y))throw Error('Invalid fastener point');
 const outer=panel.outer??panel.points;
 return (outer?inRing(outer,x,y):contains(panel,x,y))&&!(panel.holes??[]).some(h=>inRing(h,x,y));
}

/** User geometry candidate only: paired100x25 boards +100 tape, not a fixing design. */
export function planUserNineHoleSupports(layout){
 validate(layout);const {width,height,parts,openings}=layout,half=layout.joint/2;
 const nominal=parts.map(p=>({partId:p.id,x:p.x-half,y:Math.max(0,p.y-half),width:p.width+2*half,height:Math.min(height,p.y+p.height+half)-Math.max(0,p.y-half)}));
 const ys=[...new Set([0,height,...nominal.flatMap(p=>[p.y,p.y+p.height])])].filter(y=>y>=0&&y<=height).sort((a,b)=>a-b);
 const bands=[],omissions=[],segments=[],lastByAxis=new Map();
 for(let i=0;i<ys.length-1;i++){
  const y=ys[i],top=ys[i+1],active=nominal.filter(p=>p.y<=y&&p.y+p.height>=top);
  const seams=[...new Set(active.flatMap(p=>[p.x,p.x+p.width]))].sort((a,b)=>a-b),candidates=new Map();
  const add=(axis,role,seam=null)=>{const previous=candidates.get(axis);if(!previous)candidates.set(axis,{axis,role,seam});};
  for(const seam of seams){if(seam>0)add(seam-50,'joint-left',seam);if(seam<width)add(seam+50,'joint-right',seam);}
  for(const p of active)if(candidateFastenerAxis(p.width-8,30).length>2||p.width<=158)add(p.x+p.width/2,'panel-centre');
  const accepted=[];
  for(const c of candidates.values()){
   const strip={x:c.axis-50,y,width:100,height:top-y};
   const conflict=accepted.find(a=>Math.abs(a.axis-c.axis)<100-1e-8);
   if(strip.x<0||strip.x+100>width||conflict){omissions.push({...c,y,height:top-y,rectangle:strip,reason:conflict?'100 mm boards would overlap':'Full100 mm board crosses facade boundary'});continue;}
   accepted.push(c);
  }
  bands.push({y,height:top-y,seams,axes:accepted.map(c=>c.axis).sort((a,b)=>a-b)});
  for(const c of accepted){const previous=lastByAxis.get(c.axis);if(previous&&previous.y+previous.height===y){previous.height+=top-y;previous.sourceBandIds.push(i);}else{const s={id:`${layout.facade??'F'}-USER-BOARD-B${i}-X${c.axis}`,axis:c.axis,y,height:top-y,role:c.role,seam:c.seam,sourceBandIds:[i]};segments.push(s);lastByAxis.set(c.axis,s);}}
 }
 const battens=[],tape=[];
 for(const s of segments){
  // Split at aperture Y edges first. A generic rectangle difference can
  // leave a narrow side strip spanning the entire board, even above the hole.
  const relevant=openings.filter(h=>h.x<s.axis+50&&h.x+h.width>s.axis-50&&h.y<s.y+s.height&&h.y+h.height>s.y);
  const edges=[...new Set([s.y,s.y+s.height,...relevant.flatMap(h=>[Math.max(s.y,h.y),Math.min(s.y+s.height,h.y+h.height)])])].sort((a,b)=>a-b),accepted=[];
  for(let i=0;i<edges.length-1;i++){
   let pieces=[{x:s.axis-50,y:edges[i],width:100,height:edges[i+1]-edges[i]}];
   for(const h of relevant)pieces=pieces.flatMap(p=>subtractRect(p,h));
   for(const p of pieces){if(p.width!==100){omissions.push({...s,rectangle:p,reason:'Aperture clips100 mm board to a narrower strip'});continue;}
    const previous=accepted.at(-1);if(previous&&previous.y+previous.height===p.y)previous.height+=p.height;else accepted.push(p);
   }
  }
  for(const p of accepted){const partId=s.id+`-Y${p.y}-H${p.height}`;battens.push({...p,partId,axis:s.axis,sourceBandIds:s.sourceBandIds});tape.push({x:s.axis-50,y:p.y,width:100,height:p.height,axis:s.axis,pairedTimberId:partId});}
 }

 const note='Кандидат за запитом: окремі дошки100×25 мм з обох боків шва, стрічка100 мм на кожній; середня дошка під середнім рядом точок. Крок420 змінено; діаметр отворів, виріб кріплення, опори й несуча здатність не погоджені.';
 const maximumAxisSpacing=Math.max(0,...bands.flatMap(b=>b.axes.slice(1).map((x,i)=>x-b.axes[i])));
 const support={alignment:'user-nine-hole',candidate:true,valid:omissions.length===0,validationScope:'geometry-only',status:omissions.length?'HOLD':'candidate-requires-approval',approved:false,sourcePitch:420,maximumAxisSpacing,boardWidth:100,boardThickness:25,tapeWidth:100,phase:'per-y-band-user-pattern',bands,omissions,note,rfi:['Отвір і кріпильний виріб','Вітровий розрахунок та опори','Крайові/кутові дошки й прорізи','Зміна джерельного кроку420']};
 return {width,height,segments,battens,tape,support,approved:false};
}

export function planPanelFasteners(layout,{supports=planUserNineHoleSupports(layout)}={}){
 validate(layout);if(supports.width!==layout.width||supports.height!==layout.height||!Array.isArray(supports.battens))throw Error('Unbound fastener supports');
 const parts=layout.parts.map(p=>{
  const xs=candidateFastenerAxis(p.width,30).map(x=>p.x+x),ys=candidateFastenerAxis(p.height,60).map(y=>p.y+y),points=[],invalid=[],seen=new Set();
  for(const [row,y] of ys.entries())for(const [column,x] of xs.entries()){
   const point={id:`${p.id}-PATTERN-R${row+1}C${column+1}`,panelId:p.id,x,y,row,column,physical:false,quantityEligible:false,quantity:0,approved:false},key=`${x},${y}`;
   const reason=seen.has(key)?'Repeated candidate point':!pointInPanelMaterial(p,x,y)?'Point outside actual panel material':layout.openings.some(h=>contains(h,x,y))?'Point inside aperture':!supports.battens.some(r=>contains(r,x,y))?'Point has no full100 mm timber support':null;
   seen.add(key);if(reason)invalid.push({...point,reason});else points.push(point);
  }
  const supportConflicts=supports.support.omissions.filter(o=>overlap(o.rectangle??{x:o.axis-50,y:o.y,width:100,height:o.height},rect(p)));
  const valid=invalid.length===0&&points.length===xs.length*ys.length&&supportConflicts.length===0;
  return {panelId:p.id,fullPlate:p.width===1192&&p.height===1250&&!(p.holes??[]).length&&(!(p.outer??p.points)||(p.outer??p.points).length===4&&(p.outer??p.points).every(([x,y])=>[p.x,p.x+p.width].includes(x)&&[p.y,p.y+p.height].includes(y))),pattern:'size-based-user-candidate',columns:xs.length,rows:ys.length,expectedCount:xs.length*ys.length,points,invalid,supportConflicts,valid,status:valid?'candidate-requires-approval':'HOLD',approved:false,holeDiameter:null,fastenerProduct:null};
 });
 return {width:layout.width,height:layout.height,alignment:'user-nine-hole',parts,points:parts.flatMap(p=>p.points),heldParts:parts.filter(p=>!p.valid).map(p=>p.panelId),approved:false,physicalDrilledHoles:false,holeDiameter:null,quantityEligible:false,note:'Точки оглядові; повна1192×1250: X30/596/1162, Y60/625/1190. Ряди/колонки менших плит рахуються за габаритом із кроком≤600мм; вирізи — окремий кандидат; точки в повітрі або без опори не показуються.'};
}

/** Display glyphs only. Circle radius is a screen-readable representation, never a hole/screw size. */
export function addPanelFastenerMarkers(THREE,parent,plan,{material,z=.030,presentationRadius=.0035}={}){
 if(!parent?.isObject3D||!Array.isArray(plan?.points)||!finite(plan.width)||!finite(z)||!finite(presentationRadius)||presentationRadius<=0)throw Error('Invalid fastener marker input');
 const ownedMaterial=!material,m=material??new THREE.MeshStandardMaterial({color:0x6c7378,roughness:.45,metalness:.6}),geometry=new THREE.CircleGeometry(presentationRadius,12),mesh=new THREE.InstancedMesh(geometry,m,plan.points.length),dummy=new THREE.Object3D();
 if(ownedMaterial)m.userData={candidateMarkerOwnedMaterial:true,materialFamily:'decorative',physical:false,quantityEligible:false,quantity:0};
 for(const [i,p] of plan.points.entries()){if(!finite(p.x)||!finite(p.y))throw Error('Invalid marker coordinate');dummy.position.set(p.x/1000-plan.width/2000,p.y/1000,z);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}
 mesh.userData={representation:'user-nine-hole-pattern-markers',physical:false,quantityEligible:false,quantity:0,approved:false,holeDiameter:null,fastenerProduct:null,presentationRadius,components:plan.points.map(p=>({...p,representationOf:p.panelId,kind:'fastener-pattern-marker',physical:false,quantityEligible:false,quantity:0}))};mesh.raycast=()=>{};mesh.receiveShadow=true;mesh.castShadow=false;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();parent.add(mesh);
 let disposed=false;return {mesh,dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geometry.dispose();mesh.dispose();if(ownedMaterial)m.dispose();}};
}
