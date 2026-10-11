import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {candidateFastenerAxis,planPanelFasteners} from './panel-fastener-pattern.js';
import {planPanelDrilling,panelDrilling} from './panel-drilling.js';
import {panelContourGeometry} from './panel-contour-geometry.js';
import {colourAlignedColumns} from './colour-aligned-columns.js';
import {layoutFor,initialVisualLayouts} from './facade-layouts.js';

test('rows follow actual dimensions; full width short blanks have3x2 and3x1, never nine',()=>{
 assert.deepEqual(candidateFastenerAxis(1192,30),[30,596,1162]);
 assert.deepEqual(candidateFastenerAxis(1250,60),[60,625,1190]);
 assert.deepEqual(candidateFastenerAxis(590,60),[60,530]);
 assert.deepEqual(candidateFastenerAxis(100,60),[50]);
 const make=h=>({facade:'F',width:1200,height:h+8,joint:8,cuts:[0,1200],levels:[0,h+8],openings:[],parts:[{id:'P',x:4,y:4,width:1192,height:h}]});
 for(const [height,expected] of [[1250,9],[590,6],[100,3]]){const plan=planPanelFasteners(make(height)),part=plan.parts[0];assert.equal(part.expectedCount,expected);assert.equal(part.points.length,expected);assert.equal(new Set(part.points.map(p=>p.x)).size,3);assert.equal(part.approved,false);}
});
test('colour boundaries replace grid slivers; six adjacent pale blanks are full1192mm and all spans fit stock',()=>{
 const layout=layoutFor('SE',initialVisualLayouts.SE),columns=colourAlignedColumns(layout);assert.deepEqual(layout.cuts,columns.cuts);
 for(const zone of columns.zones){assert(zone.spans.every(s=>s>8&&s<=1200));assert.equal(zone.spans.reduce((a,b)=>a+b,0),zone.right-zone.left);}
 for(const region of layout.colourRegions){for(const edge of [region.x,region.x+region.width])assert(layout.cuts.includes(edge));const before=layout.cuts.indexOf(region.x),after=layout.cuts.indexOf(region.x+region.width);assert.equal(region.x-layout.cuts[before-1]-8,1192);assert.equal(layout.cuts[after+1]-(region.x+region.width)-8,1192);}
 for(const p of layout.parts.filter(p=>p.colour==='P222'&&p.width<200))assert(layout.openings.some(o=>o.kind?.startsWith('VU01')&&Math.min(Math.abs(p.x+p.width-o.x),Math.abs(p.x-(o.x+o.width)))<=8&&p.y<o.y+o.height&&p.y+p.height>o.y),'Only a VU01 edge remnant may be narrower than200mm');assert(layout.parts.every(p=>p.width<=1192&&p.height<=1250));
 assert(layoutFor('SE',{...initialVisualLayouts.SE,offset:600}).cuts.includes(600),'A changed phase is preserved');
 assert.throws(()=>colourAlignedColumns({...layout,colourRegions:[{x:-1,width:3}]}));
});
test('actual8mm bores pass through8mm solids, retain side walls and cannot intersect a notch',()=>{
 const part={id:'P',x:4,y:4,width:1192,height:1250,grain:'вертикально',outer:[[4,4],[1196,4],[1196,1254],[4,1254]],holes:[]};
 const drills=panelDrilling(part,[{id:'D',panelId:'P',x:600,y:629}]);assert.equal(drills.points.length,1);assert.equal(drills.edgeReview.compliant,false);assert.equal(drills.readyToDrill,false);assert.deepEqual(drills.manufacturerComparisonRows,[84,629,1174]);
 const g=panelContourGeometry(THREE,part,1200,{drills:drills.points}),mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);
 const ray=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x,y,.2),new THREE.Vector3(0,0,-1),0,.3).intersectObject(mesh);
 assert.equal(ray(0,.629).length,0);assert.equal(ray(.0038,.629).length,0);assert(ray(.0042,.629).length>0);
 const walls=new THREE.Raycaster(new THREE.Vector3(0,.629,.025),new THREE.Vector3(1,0,0),0,.02).intersectObject(mesh);assert(walls.length);assert(Math.abs(walls[0].distance-.004)<1e-7);
 g.computeBoundingBox();assert(Math.abs(g.boundingBox.max.z-g.boundingBox.min.z-.008)<1e-7);
 const notch={...part,outer:[[4,4],[1196,4],[1196,700],[900,700],[900,1254],[4,1254]]};assert.equal(panelDrilling(notch,[{x:902,y:900}]).points.length,0);assert.throws(()=>panelContourGeometry(THREE,notch,1200,{drills:[{x:902,y:900,diameterMM:8}]}));
 g.dispose();mesh.material.dispose();
});
test('all four actual facades retain source IDs, stock area and supported bore centres; dark boards have real bores',()=>{
 let total=0,dark=0;
 for(const code of ['SE','NW','SW','NE']){const layout=layoutFor(code,initialVisualLayouts[code]),snapshot=JSON.stringify(layout),d=planPanelDrilling(layout);assert.equal(JSON.stringify(layout),snapshot);assert.equal(d.parts.length,layout.parts.length);for(const p of d.parts){const owner=layout.parts.find(o=>o.id===p.panelId);const g=panelContourGeometry(THREE,owner,layout.width,{drills:p.points});assert.equal(g.userData.drilledBores,p.points.length);total+=p.points.length;if(owner.colour==='P070')dark+=p.points.length;g.dispose();}assert(!d.approved&&!d.readyToDrill&&!d.quantityEligible);}
 assert(total>4000);assert(dark>400);console.log(JSON.stringify({bores:total,darkBores:dark,approval:false}));
});
