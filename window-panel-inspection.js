import {panelContourGeometry} from './panel-contour-geometry.js';
import {applyFibreSurfaceUV,createInstanceFibreMaterial,setInstanceFibreGrain} from './fc-surface-uv.js';
import {mergeGeometries} from './assets/BufferGeometryUtils.js';
import {addPanelScrews} from './panel-screws.js';
import {panelDrilling} from './panel-drilling.js';

const overlaps=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
const contains=(a,b)=>b.x>=a.x-1e-7&&b.y>=a.y-1e-7&&b.x+b.width<=a.x+a.width+1e-7&&b.y+b.height<=a.y+a.height+1e-7;
const area=r=>r.width*r.height;

// This is a view of existing facade owners, never a new cutting layout. The
// opening can meet a different number of owners when the user changes phase.
export function planWindowPanelInspection(plan){
 const surrounding=plan.surroundingLayout;
 if(!surrounding)throw Error('Window panel inspection needs a whole-facade projection');
 const owners=new Map(),centre=surrounding.centre;
 for(const batch of plan.layers[8].batches)for(const rectangle of batch.rectangles){
  const part=rectangle.panelRecord;if(!part?.id)throw Error('Inspection rectangle has no source owner');
  if(!owners.has(part.id))owners.set(part.id,{part,rectangles:[],depth:batch.depth,z:batch.z,variant:batch.materialVariant});
  const owner=owners.get(part.id);owner.rectangles.push(rectangle);
 }
 for(const owner of owners.values()){
  const {part,rectangles}=owner;
  owner.bounds={x:part.x-centre.x,y:part.y-centre.y,width:part.width,height:part.height};
  owner.focus=overlaps(owner.bounds,plan.hole);
  owner.completeContour=!!part.outer?.length&&contains(plan.wall,owner.bounds)&&!rectangles.some(r=>r.profileYZ)&&Math.abs(rectangles.reduce((s,r)=>s+area(r),0)-part.areaMm2)<.01;
  owner.record={...part,detailProjection:owner.bounds,inspectionRepresentation:true,projectedOnly:true,newStockPart:false};
 }
 return {owners:[...owners.values()],focusedPartIds:[...owners].filter(([,o])=>o.focus).map(([id])=>id),sourcePartIds:[...owners.keys()],centre,wall:plan.wall,quantity:0,newStockParts:false};
}

function rectangleGeometry(THREE,r,depth,z){
 if(!r.profileYZ){const box=new THREE.BoxGeometry(r.width/1000,r.height/1000,depth),geometry=box.toNonIndexed();box.dispose();return geometry.translate((r.x+r.width/2)/1000,(r.y+r.height/2)/1000,z+depth/2);}
 const points=r.profileYZ,n=points.length,left=r.x/1000,right=(r.x+r.width)/1000,vertices=[];
 const p=(side,i)=>[side?right:left,...points[i]],triangle=(a,b,c)=>vertices.push(...a,...b,...c);
 for(let i=1;i<n-1;i++){triangle(p(0,0),p(0,i+1),p(0,i));triangle(p(1,0),p(1,i),p(1,i+1));}
 for(let i=0;i<n;i++){const j=(i+1)%n;triangle(p(0,i),p(0,j),p(1,j));triangle(p(0,i),p(1,j),p(1,i));}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry;
}

export function createWindowPanelInspection(THREE,plan,{P222,P070,contextOpacity=.10}={}){
 if(!Array.isArray(P222)||!P222.length||!P070?.isMaterial)throw Error('Source facade materials required');
 if(!Number.isFinite(contextOpacity)||contextOpacity<=0||contextOpacity>=1)throw Error('Invalid panel context opacity');
 const view=planWindowPanelInspection(plan),root=new THREE.Group(),geometries=new Set(),ownedMaterials=new Set(),contexts=new Map();
 root.userData={detailSurroundOverlay:true,windowPanelInspection:true,layer:8,system:'facade',focusedPartIds:view.focusedPartIds,sourcePartIds:view.sourcePartIds,quantity:0,physical:false,quantityEligible:false};
 const uvOrigin=[view.centre.x/1000-plan.surroundingLayout.width/2000,view.centre.y/1000,plan.layers[8].z];
 const sourceMaterial=owner=>owner.part.colour==='P070'?P070:P222[(owner.variant??owner.part.cell)%P222.length];
 function contextMaterial(source){
  if(!contexts.has(source)){const m=source.clone();m.transparent=true;m.opacity=contextOpacity;m.depthWrite=false;m.forceSinglePass=true;m.userData={...m.userData,inspectionContext:true,physical:false,quantityEligible:false};contexts.set(source,m);ownedMaterials.add(m);}
  return contexts.get(source);
 }
 for(const owner of view.owners){
  const {part,rectangles}=owner,base=sourceMaterial(owner);
  const metadata={layer:8,system:'facade',materialKind:'board',panelProjection:true,panelRecords:[owner.record],windowPanelInspection:true,inspectionFocus:owner.focus,inspectionContext:!owner.focus,physical:false,quantityEligible:false,quantity:0,approved:false};
  if(owner.focus){
   let geometry;
   if(owner.completeContour){
    const move=ring=>ring.map(([x,y])=>[x-view.centre.x+view.wall.width/2,y-view.centre.y]);
    const projected={...part,x:owner.bounds.x+view.wall.width/2,y:owner.bounds.y,outer:move(part.outer),holes:(part.holes??[]).map(move)},drilling=panelDrilling(projected,(plan.fasteners?.points??[]).filter(h=>h.panelId===part.id));
    geometry=panelContourGeometry(THREE,projected,view.wall.width,{drills:drilling.points}).translate(0,0,owner.z-.021);
    owner.record.drilling=drilling;
   }else{
    // Preserve real clipping / a sloping pocket. Joining its triangle pieces
    // changes draw ownership only; it cannot add back removed material.
    const pieces=rectangles.map(r=>{const g=rectangleGeometry(THREE,r,owner.depth,owner.z);applyFibreSurfaceUV(THREE,g,part.grain,uvOrigin);return g;});
    geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());if(!geometry)throw Error('Cannot join projected panel triangles');
   }
   applyFibreSurfaceUV(THREE,geometry,part.grain,uvOrigin);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.add(geometry);
   const mesh=new THREE.Mesh(geometry,base);mesh.receiveShadow=true;mesh.userData={...metadata,completeSourceContour:owner.completeContour};root.add(mesh);
  }else{
   const boxes=rectangles.filter(r=>!r.profileYZ),surface=contextMaterial(base);
   if(boxes.length){
    const geometry=new THREE.BoxGeometry(1,1,1);setInstanceFibreGrain(THREE,geometry,boxes.map(()=>part.grain));geometries.add(geometry);
    const material=createInstanceFibreMaterial(THREE,surface,uvOrigin);ownedMaterials.add(material);
    const mesh=new THREE.InstancedMesh(geometry,material,boxes.length),dummy=new THREE.Object3D();
    boxes.forEach((r,i)=>{dummy.position.set((r.x+r.width/2)/1000,(r.y+r.height/2)/1000,owner.z+owner.depth/2);dummy.scale.set(r.width/1000,r.height/1000,owner.depth);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.userData={...metadata,panelRecords:boxes.map(r=>r.panelRecord)};mesh.renderOrder=-1;root.add(mesh);
   }
   for(const r of rectangles.filter(r=>r.profileYZ)){
    const geometry=rectangleGeometry(THREE,r,owner.depth,owner.z);applyFibreSurfaceUV(THREE,geometry,part.grain,uvOrigin);geometries.add(geometry);
    const mesh=new THREE.Mesh(geometry,surface);mesh.userData=metadata;mesh.renderOrder=-1;root.add(mesh);
   }
  }
 }
 const centres=view.owners.filter(o=>o.focus&&o.completeContour).flatMap(o=>(o.record.drilling?.points??[]).map(p=>[p.x/1000-view.wall.width/2000,p.y/1000,o.z+o.depth]));
 const markers=centres.length?addPanelScrews(THREE,root,null,{centres}):null;
 if(markers)Object.assign(markers.mesh.userData,{layer:8,system:'facade',physical:false,quantity:0,quantityEligible:false});
 let disposed=false;
 return {root,plan:view,dispose(){
  if(disposed)return;disposed=true;markers?.dispose();root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});root.removeFromParent();root.clear();
  for(const geometry of geometries)geometry.dispose();for(const material of ownedMaterials)material.dispose();
 }};
}
