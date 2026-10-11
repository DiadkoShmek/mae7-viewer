import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {basementOpenings} from './basement-openings.js';
import {planPlinthAssembly,rectangleContours} from './plinth-plan.js';
import {createPlinthAssembly} from './plinth-assembly.js';
import {createRetainedBasementWindow} from './basement-window.js';
const near=(a,b,t=1e-10)=>assert(Math.abs(a-b)<t,`${a} != ${b}`);
const area=ps=>Math.abs(ps.reduce((sum,p,i)=>{const q=ps[(i+1)%ps.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2);
const vol=ps=>ps.reduce((sum,p)=>sum+p.volume,0),layer=(p,n)=>p.physicalParts.filter(p=>p.layer===n);
const raw=planPlinthAssembly({openings:[]}),cut=planPlinthAssembly();

test('shared and standalone retained optics explicitly export glass without a new IGU inventory',()=>{
 const assembly=createPlinthAssembly(THREE,new THREE.Group(),new THREE.Group()),standalone=createRetainedBasementWindow(THREE,new THREE.Group(),basementOpenings[0]);
 const optics=[...assembly.basementWindows,standalone].map(w=>w.group.children.find(m=>m.userData.role==='optical-proxy'));
 for(const mesh of optics){const m=mesh.material;assert.equal(m.userData.materialFamily,'glass');assert.equal(m.userData.opticalRole,'existing-unknown-glazing-representation');near(m.transmission,.9);near(m.ior,1.5);near(m.roughness,.14);assert.equal(m.thickness,0);assert.equal(m.userData.glazingComposition,null);assert.equal(m.userData.glassThickness,null);assert.equal(m.userData.quantityEligible,false);assert.equal(m.userData.newStockPart,false);assert.equal(mesh.userData.quantity,0);assert.equal(mesh.userData.glazingComposition,null);assert.equal(mesh.userData.glassThickness,null);assert.equal(mesh.userData.representationOnly,true);}
 assert.equal(new Set(optics.slice(0,12).map(m=>m.material)).size,1);assert.notEqual(optics[0].material,optics[12].material);
});

test('12 raw graphic retained envelopes are not a replacement specification or A07 schedule',()=>{
 assert.equal(basementOpenings.length,12);
 for(const face of ['SE','NW'])assert.equal(basementOpenings.filter(o=>o.face===face).length,6);
 const k=40.4/763.44;
 for(const o of basementOpenings){near(o.y1,0);near(o.y0,-11.16*k);near(o.x,(o.sourceProof.outerBBoxPt[0]+o.sourceProof.outerBBoxPt[2]-2*651.54)*k/2);
  assert(o.retained);assert.equal(o.replacement,false);assert.equal(o.quantityEligible,false);assert.equal(o.surveyVerified,false);assert.equal(o.unknown.existingGlazing,null);assert.match(o.dimensionAuthority,/not measured rough opening/);
 }
 near(.660+basementOpenings[0].y0,.069430996541968);
 assert.equal(cut.sourceQuantities.FC_m2,76);assert.equal(cut.sourceQuantities.spatiallyLocated,false);
 assert.throws(()=>planPlinthAssembly({openings:[...basementOpenings,basementOpenings[0]]}),/Invalid basement/);
});

test('independent source-area and original stock intersections prove removed volume in every layer',()=>{
 const k=40.4/763.44,totalArea=(9*33.66+3*33.60)*11.16*k*k;
 near(vol(layer(raw,0))-vol(layer(cut,0)),totalArea*.220);
 const absent=raw.physicalParts.filter(p=>p.kind==='supportAngleY').length-cut.physicalParts.filter(p=>p.kind==='supportAngleY').length;
 near(vol(layer(raw,1))-vol(layer(cut,1))+absent*.080*(.050*.003+.003*.097),totalArea*.100);
 const withoutAngles=p=>layer(p,2).filter(q=>q.kind!=='supportAngleY');
 near(vol(withoutAngles(raw))-vol(withoutAngles(cut))+absent*.080*.003*.050,totalArea*.050);
 let removedFC=0,removedProfiles=0;
 for(const p of raw.physicalParts){const holes=basementOpenings.filter(o=>o.face===p.face);
  if(p.layer===4){const xs=p.sectionXZ.map(v=>v[0]);for(const o of holes){const w=Math.max(0,Math.min(Math.max(...xs),o.x1)-Math.max(Math.min(...xs),o.x0)),h=Math.max(0,Math.min(p.y1,o.y1)-Math.max(p.y0,o.y0));removedFC+=w*h*.008;}}
  if(p.kind==='profileX'){const ys=p.sectionYZ.map(v=>v[0]);for(const o of holes)if(o.y0<=Math.min(...ys)&&o.y1>=Math.max(...ys))removedProfiles+=Math.max(0,Math.min(p.x1,o.x1)-Math.max(p.x0,o.x0))*area(p.sectionYZ);}
 }
 near(vol(layer(raw,4))-vol(layer(cut,4)),removedFC);near(vol(layer(raw,3))-vol(layer(cut,3)),removedProfiles);
 for(const p of layer(cut,4)){assert(p.sourcePartId);if(p.kind==='contourZ'){near(p.volume,p.netAreaM2*.008);assert.equal(p.outer.length>=4,true);assert.equal(p.apertureOperationsApproved,false);assert.equal(p.sourceBlankId,p.sourcePartId);}}
 assert.equal(new Set(cut.physicalParts.map(p=>p.sourcePartId)).size,cut.physicalParts.length);
 for(const p of cut.physicalParts.filter(p=>p.sourceOriginalProfileId))assert.match(p.id,/-RUN\d+/);
});

test('perforated projections conserve each canonical owner across patches cutting directly through windows',()=>{
 for(const o of [basementOpenings[1],basementOpenings[7]]){
  const p=planPlinthAssembly({patch:{face:o.face,x:o.x,width:.9}});
  for(const part of p.physicalParts)near(part.volume,vol([...p.outside,...p.cover].filter(q=>q.sourcePartId===part.id)));
  near(vol(p.cover),vol(p.inspection));near(vol(p.physicalParts),vol(p.outside)+vol(p.cover));
  for(const q of [...p.outside,...p.cover,...p.inspection]){assert(q.projection);assert.equal(q.stockPart,false);}
 }
});

test('overlapping apertures are order-independent union contours; disconnected pieces are explicit',()=>{
 const r={x0:0,x1:2,y0:0,y1:1},holes=[{x0:.5,x1:1.1,y0:.3,y1:1},{x0:.9,x1:1.5,y0:.4,y1:1}];
 const a=rectangleContours(r,holes),b=rectangleContours(r,[holes[1],holes[0],holes[0]]);assert.deepEqual(a,b);near(a.reduce((sum,p)=>sum+p.netAreaM2,0),2-(.6*.7+.6*.6-.2*.6));
 assert.equal(a.length,1);assert.equal(a[0].holes.length,0);
 const closed=rectangleContours(r,[{x0:.5,x1:1.5,y0:.3,y1:.7}]);assert.equal(closed[0].holes.length,1);near(closed[0].netAreaM2,1.6);
 const split=rectangleContours(r,[{x0:.5,x1:1.5,y0:0,y1:1}]);assert.equal(split.length,2);
});

test('actual meshes leave all five-layer apertures open and retain recessed frames/optical candidates',()=>{
 const building=new THREE.Group(),garden=new THREE.Group(),api=createPlinthAssembly(THREE,building,garden);building.updateMatrixWorld(true);
 assert.equal(api.basementWindows.length,12);
 let rays=0;for(const o of basementOpenings){const face=api.plinthFaceGroups[o.face],meshes=[];face.traverse(m=>{if(m.isMesh&&m.userData.assembly==='plinth')meshes.push(m);});
  for(const dx of [-.65,0,.65])for(const y of [o.y-.2,o.y,o.y+.2,-.540,-.120]){
   const start=face.localToWorld(new THREE.Vector3(o.x+dx,y,.4)),direction=new THREE.Vector3(0,0,-1).transformDirection(face.matrixWorld),ray=new THREE.Raycaster(start,direction,0,.8);
   assert.equal(ray.intersectObjects(meshes,false).length,0,o.id+' aperture body obstruction');rays++;
  }
  const window=api.basementWindows.find(w=>w.opening.id===o.id);assert.equal(window.group.parent,face);assert.equal(window.group.userData.replacement,false);
  window.group.traverse(mesh=>{if(mesh.isMesh){assert.equal(mesh.userData.quantityEligible,false);assert.equal(mesh.userData.newStockPart,false);assert.equal(mesh.userData.approved,false);}});
  const frame=window.group.children.find(m=>m.userData.role==='existing-frame-candidate');frame.geometry.computeBoundingBox();near(frame.position.z+frame.geometry.boundingBox.max.z,-.03,1e-8);
  const optic=window.group.children.find(m=>m.userData.role==='optical-proxy');assert.equal(optic.userData.glazingComposition,null);assert.equal(optic.userData.glassThickness,null);
 }
 assert.equal(rays,180);
 // Positive control: every complete material slab remains below the aperture.
 const face=api.plinthFaceGroups.SE,o=basementOpenings[1];for(const n of [0,1,2,4]){const meshes=[];face.traverse(m=>{if(m.isMesh&&m.userData.assembly==='plinth'&&m.userData.layer===n)meshes.push(m);});const ray=new THREE.Raycaster(face.localToWorld(new THREE.Vector3(o.x,-.63,.4)),new THREE.Vector3(0,0,-1));assert(ray.intersectObjects(meshes,false).length>0,'Material layer'+n+' below aperture remains');}
 const profiles=[];face.traverse(m=>{if(m.isMesh&&m.userData.assembly==='plinth'&&m.userData.layer===3)profiles.push(m);});
 for(const y of [-.540,-.120])assert(new THREE.Raycaster(face.localToWorld(new THREE.Vector3(0,y,.4)),new THREE.Vector3(0,0,-1)).intersectObjects(profiles,false).length>0,'Independent original profile-height positive control');
 // Stored POSITION/indices prove actual exterior+cover material volumes.
 // Inspection copies are excluded; the tolerance covers Float32 coordinates.
 const stored=Array(5).fill(0);building.traverse(mesh=>{if(!mesh.isMesh||mesh.userData.assembly!=='plinth'||mesh.userData.region==='inspection')return;const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;let signed=0;for(let i=0;i<(idx?.count??p.count);i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i):i),b=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+1):i+1),c=new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+2):i+2);signed+=a.dot(b.cross(c))/6;}assert(signed>0,'Outward stored triangle winding');stored[mesh.userData.layer]+=signed;});
 for(let n=0;n<5;n++)near(stored[n],vol(layer(cut,n)),1e-5);
});
