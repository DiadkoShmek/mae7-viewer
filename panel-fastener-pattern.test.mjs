import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {planUserNineHoleSupports,planPanelFasteners,pointInPanelMaterial,addPanelFastenerMarkers} from './panel-fastener-pattern.js';
import {planFacadeSystem,createFacadeSystem} from './facade-system.js';
import {layoutFor,initialVisualLayouts} from './facade-layouts.js';
const full=()=>({facade:'SW',width:2400,height:1258,joint:8,cuts:[0,1200,2400],levels:[0,1258],openings:[],parts:[{id:'P1',x:4,y:4,width:1192,height:1250},{id:'P2',x:1204,y:4,width:1192,height:1250}]});
const overlaps=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
function disjoint(rectangles){for(let i=0;i<rectangles.length;i++)for(let j=0;j<i;j++)assert(!overlaps(rectangles[i],rectangles[j]));}

test('two full1192x1250 plates have exact nine positions, independent100 boards and centred100 tapes at their shared8 seam',()=>{
 const layout=full(),supports=planUserNineHoleSupports(layout),fasteners=planPanelFasteners(layout,{supports});assert(supports.support.valid);assert.deepEqual(supports.battens.map(r=>r.axis),[50,1150,1250,2350,600,1800]);disjoint(supports.battens);disjoint(supports.tape);
 assert(supports.battens.some(r=>r.x===1100&&r.width===100));assert(supports.battens.some(r=>r.x===1200&&r.width===100));assert(supports.tape.some(r=>r.x===1100&&r.width===100));assert(supports.tape.some(r=>r.x===1200&&r.width===100));assert(!supports.battens.some(r=>r.width===200));
 for(const p of fasteners.parts){assert(p.valid);assert(p.fullPlate);assert.equal(p.points.length,9);const source=layout.parts.find(r=>r.id===p.panelId);assert.deepEqual([...new Set(p.points.map(h=>h.x-source.x))],[30,596,1162]);assert.deepEqual([...new Set(p.points.map(h=>h.y-source.y))],[60,625,1190]);for(const h of p.points){assert(pointInPanelMaterial(source,h.x,h.y));assert(supports.battens.some(r=>h.x>r.x&&h.x<r.x+r.width&&h.y>r.y&&h.y<r.y+r.height));assert.equal(h.quantityEligible,false);}}
 assert.equal(fasteners.holeDiameter,null);assert.equal(fasteners.physicalDrilledHoles,false);assert.equal(fasteners.approved,false);
});
test('notches/inner holes discard air points and HOLD the nine-hole candidate without manufacturing a screw there',()=>{
 const layout=full();layout.parts=layout.parts.slice(0,1);layout.parts[0].outer=[[4,4],[1196,4],[1196,1254],[4,1254]];layout.parts[0].holes=[[[500,500],[700,500],[700,800],[500,800]]];layout.openings=[{id:'VOID',x:500,y:500,width:200,height:300}];const supports=planUserNineHoleSupports(layout),f=planPanelFasteners(layout,{supports});assert.equal(f.parts[0].valid,false);assert(f.parts[0].invalid.some(h=>h.row===1&&h.column===1));assert(!f.points.some(h=>h.x===600&&h.y===629));for(const p of f.points)assert(pointInPanelMaterial(layout.parts[0],p.x,p.y));for(const r of [...supports.battens,...supports.tape])assert(!overlaps(r,layout.openings[0]));
 const notch=full();notch.parts=notch.parts.slice(0,1);notch.parts[0].outer=[[4,4],[1196,4],[1196,700],[900,700],[900,1254],[4,1254]];const result=planPanelFasteners(notch);assert(!result.parts[0].valid);assert(result.parts[0].invalid.some(h=>h.column===2&&h.row===2));assert(!result.points.some(h=>h.x===1166&&h.y===1194));
});
test('narrow/cropped phases cannot silently merge overlapping wood, fit repeated points or narrow aperture strips',()=>{
 const l=full();l.parts=[{id:'small',x:4,y:4,width:80,height:100}];const s=planUserNineHoleSupports(l);assert(!s.support.valid);assert(s.support.omissions.length);disjoint(s.battens);const p=planPanelFasteners(l,{supports:s});assert.equal(p.parts[0].rows,1);assert.equal(p.parts[0].columns,2);assert.equal(new Set(p.points.map(h=>`${h.x},${h.y}`)).size,p.points.length);assert.deepEqual(p.heldParts,['small']);
 const clipped=full();clipped.openings=[{x:20,y:300,width:20,height:200}];const cs=planUserNineHoleSupports(clipped);assert(!cs.support.valid);assert(cs.support.omissions.some(o=>o.reason.includes('narrower')));assert(cs.battens.every(r=>r.width===100));assert(cs.tape.every(r=>r.width===100));
});
test('local Y courses never create a full-height union of changing centres; identical continuous boards merge',()=>{
 const l=full();l.height=2516;l.levels=[0,1258,2516];l.parts.push({id:'P3',x:4,y:1262,width:1192,height:1250},{id:'P4',x:1204,y:1262,width:592,height:1250},{id:'P5',x:1804,y:1262,width:592,height:1250});const s=planUserNineHoleSupports(l);disjoint(s.battens);assert(s.segments.find(r=>r.axis===50).height===2516);assert(s.segments.find(r=>r.axis===1800).height===1258);assert(!s.segments.some(r=>r.axis===1500),'592mm blanks need two edge columns, no redundant middle board');
});
test('source420 and600 timber/bracket geometry remain exact, newstrategy is explicit and actualrendered wood is100x25',()=>{
 const layout=full(),source=planFacadeSystem('SW',{layout}),candidate=planFacadeSystem('SW',{layout,supportAlignment:'user-nine-hole'});assert.deepEqual(candidate.layers.slice(0,6),source.layers.slice(0,6));assert.deepEqual(candidate.brackets,source.brackets);assert.equal(source.support.alignment,'source-420');assert.equal(candidate.support.alignment,'user-nine-hole');assert.equal(candidate.support.approved,false);assert.equal(candidate.fasteners.points.length,18);
 const parent=new THREE.Group(),system=createFacadeSystem(THREE,parent,'SW',{layout,supportAlignment:'user-nine-hole',layerIndices:[6,7]});assert.equal(system.fasteners.points.length,18);assert.equal(system.groups.length,8);const mesh=system.groups[6].children[0];for(let i=0;i<mesh.count;i++){const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);const scale=new THREE.Vector3().setFromMatrixScale(matrix);assert(Math.abs(scale.x-.1)<1e-7);assert(Math.abs(scale.z-.025)<1e-7);}system.dispose();
});
test('display markers preserve exact plane/world points, canonicalpanel IDs and quantity0 without claiming actual holes',()=>{
 const plan=planPanelFasteners(full()),parent=new THREE.Group();parent.position.set(20.2,1,0);parent.rotation.y=-Math.PI/2;const representation=addPanelFastenerMarkers(THREE,parent,plan,{z:.030});parent.updateMatrixWorld(true);assert.equal(representation.mesh.count,18);assert.equal(representation.mesh.userData.physical,false);assert.equal(representation.mesh.userData.holeDiameter,null);
 for(let i=0;i<18;i++){const matrix=new THREE.Matrix4();representation.mesh.getMatrixAt(i,matrix);const actual=new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(representation.mesh.matrixWorld),p=plan.points[i],expected=new THREE.Vector3(p.x/1000-plan.width/2000,p.y/1000,.030).applyMatrix4(parent.matrixWorld);assert(actual.distanceTo(expected)<1e-6);assert.equal(representation.mesh.userData.components[i].representationOf,p.panelId);assert.equal(representation.mesh.userData.components[i].quantity,0);}representation.dispose();assert.equal(parent.children.length,0);
});
test('actual four facades produce disjoint full-width supports, noair markers, and explicit heldparts',()=>{
 const report=[];for(const code of ['SE','NW','SW','NE']){const layout=layoutFor(code,initialVisualLayouts[code]),s=planUserNineHoleSupports(layout),f=planPanelFasteners(layout,{supports:s});disjoint(s.battens);disjoint(s.tape);for(const r of s.battens){assert.equal(r.width,100);for(const h of layout.openings)assert(!overlaps(r,h));}for(const p of f.points){const owner=layout.parts.find(r=>r.id===p.panelId);assert(pointInPanelMaterial(owner,p.x,p.y));assert(s.battens.some(r=>contains(r,p.x,p.y)));}for(const p of f.parts.filter(p=>p.fullPlate))assert.equal(p.points.length,9,`${code}/${p.panelId}: every uncut full plate needs nine supported points`);report.push({code,parts:layout.parts.length,markers:f.points.length,held:f.heldParts.length,boards:s.battens.length,omissions:s.support.omissions.length});}console.log(JSON.stringify(report));
 function contains(r,x,y){return x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;}
});
test('a partial aperture in the lower course never removes full-width backing from an uncut upper plate',()=>{
 const l=full();l.height=2516;l.levels=[0,1258,2516];l.parts.push({id:'upper',x:4,y:1262,width:1192,height:1250});l.openings=[{id:'low',x:580,y:300,width:40,height:300}];const s=planUserNineHoleSupports(l),f=planPanelFasteners(l,{supports:s});assert(s.battens.some(r=>r.axis===600&&r.y===600&&r.y+r.height===2516&&r.width===100));assert.equal(f.parts.find(p=>p.panelId==='upper').points.length,9);assert(f.parts.find(p=>p.panelId==='upper').valid);
});
test('badfinite/joint/topology inputs fail before callerparent mutation',()=>{
 for(const l of [{...full(),joint:10},{...full(),width:Infinity},{...full(),parts:[{id:'bad',x:NaN,y:4,width:1192,height:1250}]}])assert.throws(()=>planUserNineHoleSupports(l));const l=full();l.localJointTopology={bands:[{y:0,height:1258,cuts:l.cuts}],generatedFrom:{width:l.width,height:l.height,cuts:l.cuts,levels:l.levels,openings:[{id:'stale',x:2,y:2,width:10,height:10}]}};assert.throws(()=>planUserNineHoleSupports(l),/Stale/);
});
