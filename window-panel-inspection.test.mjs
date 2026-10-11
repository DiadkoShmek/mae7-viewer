import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {layoutFor,initialVisualLayouts} from './facade-layouts.js';
import {planWindowDetail} from './window-detail.js';
import {createWindowPanelInspection,planWindowPanelInspection} from './window-panel-inspection.js';
import {nativePanelRecord,nativePanelBounds} from './native-model.js';

const material=name=>Object.assign(new THREE.MeshStandardMaterial(),{name});
const materials={P222:Array.from({length:6},(_,i)=>material('FC_P222_'+i)),P070:material('FC_P070')};
const prepare=(options=initialVisualLayouts.SE,revealMode='field',revealDepth=.150)=>{
 const layout=layoutFor('SE',options),o=layout.openings.find(o=>o.id==='SE-W07'),centre={x:o.x+o.width/2,y:o.y+o.height/2};
 return {layout,plan:planWindowDetail({revealMode,revealDepth,surroundingLayout:{layout,centre}})};
};
const inside=(ring,x,y)=>{let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};

test('SE-W07 shows four complete source L plates; independent contour probes preserve voids, seams, area and picking',()=>{
 const {layout,plan}=prepare(),before=JSON.stringify({layout,plan}),view=createWindowPanelInspection(THREE,plan,materials);
 const focused=view.root.children.filter(o=>o.userData.inspectionFocus),context=view.root.children.filter(o=>o.userData.inspectionContext);
 assert.equal(focused.length,4);assert.equal(context.length,12);
 assert.equal(view.plan.sourcePartIds.length,16);assert.equal(new Set(focused.map(m=>m.userData.panelRecords[0].id)).size,4);
 assert(focused.every(m=>m.userData.completeSourceContour&&!m.isInstancedMesh));
 const host=new THREE.Group(),layer=new THREE.Group();host.position.set(7,3,5.62);host.rotation.y=.83;layer.position.z=.021;layer.userData={layer:8,system:'facade'};host.add(layer);layer.add(view.root);host.updateMatrixWorld(true);
 let probes=0,frontArea=0,removedArea=0;
 for(const mesh of focused){
  const record=mesh.userData.panelRecords[0],part=layout.parts.find(p=>p.id===record.id),position=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal,uv=mesh.geometry.attributes.uv;
  assert.equal(part.outer.length,6);assert.equal(part.width,1192);assert.equal(part.height,1250);assert.equal(mesh.material,materials[part.colour][part.cell%6]);
  for(const key of Object.keys(part))assert.deepEqual(record[key],part[key]);
  assert.equal(record.newStockPart,false);assert.equal(mesh.userData.quantity,0);assert.equal(mesh.userData.physical,false);
  let area=0;for(let i=0;i<position.count;i+=3){
   const a=new THREE.Vector3().fromBufferAttribute(position,i),b=new THREE.Vector3().fromBufferAttribute(position,i+1),c=new THREE.Vector3().fromBufferAttribute(position,i+2);
   if([a,b,c].every(p=>Math.abs(p.z-.008)<1e-7))area+=b.sub(a).cross(c.sub(a)).length()/2;
  }
  const drilledArea=record.drilling.points.length*24/2*16*Math.sin(2*Math.PI/24);assert(Math.abs(area*1e6-(part.areaMm2-drilledArea))<.3);frontArea+=area;removedArea+=drilledArea/1e6;
  for(let i=0;i<position.count;i++)if(normal.getZ(i)>.9){
   const x=position.getX(i)+plan.surroundingLayout.centre.x/1000-layout.width/2000,y=position.getY(i)+plan.surroundingLayout.centre.y/1000;
   assert(Math.abs(uv.getX(i)-x*3)<2e-6);assert(Math.abs(uv.getY(i)-y*.7)<1e-6);
  }
  for(let x=part.x+13;x<part.x+part.width;x+=47)for(let y=part.y+17;y<part.y+part.height;y+=43){
   const local=new THREE.Vector3((x-view.plan.centre.x)/1000,(y-view.plan.centre.y)/1000,.2),point=local.clone().applyMatrix4(layer.matrixWorld),direction=new THREE.Vector3(0,0,-1).transformDirection(layer.matrixWorld);
   const hits=new THREE.Raycaster(point,direction,0,.3).intersectObject(mesh),expected=inside(part.outer,x,y)&&!(part.holes??[]).some(h=>inside(h,x,y));
   assert.equal(hits.length>0,expected,part.id+' contour at '+x+','+y);probes++;
   if(hits.length){assert.equal(nativePanelRecord(hits[0]).id,part.id);const bounds=nativePanelBounds(hits[0]);assert(bounds&&!bounds.isEmpty());}
  }
 }
 assert(probes>2500);assert(Math.abs(frontArea+removedArea-view.plan.owners.filter(o=>o.focus).reduce((sum,o)=>sum+o.part.areaMm2/1e6,0))<1e-6);
 const seamX=layout.cuts.find(x=>Math.abs(x-view.plan.centre.x)<900);const gapProbes=[[(seamX-view.plan.centre.x)/1000,-1],[(seamX-view.plan.centre.x)/1000,1],[-1,.0835],[1,.0835],[0,0]];
 for(const [x,y] of gapProbes){const point=new THREE.Vector3(x,y,.2).applyMatrix4(layer.matrixWorld),direction=new THREE.Vector3(0,0,-1).transformDirection(layer.matrixWorld);assert.equal(new THREE.Raycaster(point,direction,0,.3).intersectObjects(focused).length,0,'8mm joint / opening remains empty');}
 assert(context.every(m=>m.material.transparent&&m.material.opacity===.1&&!m.material.depthWrite));
 const markers=view.root.children.find(o=>o.userData.representation==='user-nine-hole-pattern-markers');assert(markers);assert(markers.userData.components.every(p=>view.plan.focusedPartIds.includes(p.panelId)));
 assert.equal(JSON.stringify({layout,plan}),before,'Presentation cannot rewrite stock or source plans');view.dispose();view.dispose();assert.equal(layer.children.length,0);
});

test('changed layout reports actual owner count; view disposal never disposes shared manufacturer materials',()=>{
 let views=0;
 for(const options of [initialVisualLayouts.SE,{module:600,offset:300},{...initialVisualLayouts.SE,offset:883}])for(const mode of ['source','field']){
  const {plan}=prepare(options,mode,.2),view=createWindowPanelInspection(THREE,plan,materials),focused=view.root.children.filter(o=>o.userData.inspectionFocus);
  assert.equal(focused.length,planWindowPanelInspection(plan).focusedPartIds.length);
  if(options.module===600)assert.notEqual(focused.length,4,'Do not fake four plates after the source phase changes');
  const geos=new Set(),mats=new Set();view.root.traverse(o=>{if(o.isMesh){geos.add(o.geometry);mats.add(o.material);}});
  const shared=new Set([...materials.P222,materials.P070]);let gd=0,md=0,sd=0;
  for(const g of geos)g.addEventListener('dispose',()=>gd++);for(const m of mats)m.addEventListener('dispose',()=>shared.has(m)?sd++:md++);
  view.dispose();view.dispose();assert.equal(gd,geos.size);assert.equal(md,[...mats].filter(m=>!shared.has(m)).length);assert.equal(sd,0);views++;
 }
 assert.equal(views,6);
});
