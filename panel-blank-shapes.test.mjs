import test from 'node:test';
import assert from 'node:assert/strict';
import {blankContours,contourArea} from './panel-blank-shapes.js';
const layout=(openings=[],extra={})=>({facade:'SE',width:1000,height:1000,joint:8,cuts:[0,1000],levels:[0,1000],panelHeight:0,openings,parts:[{cell:0,floor:0,colour:'P222',grain:'вертикально'}],...extra});
function insideRing([x,y],ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [a,b]=ring[i],[c,d]=ring[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;}
const inside=(point,p)=>insideRing(point,p.outer)&&!p.holes.some(h=>insideRing(point,h));
const profileCheck=p=>{assert(contourArea(p.outer)>0);p.holes.forEach(h=>assert(contourArea(h)<0));assert.equal(contourArea(p.outer)+p.holes.reduce((a,h)=>a+contourArea(h),0),p.areaMm2);assert(p.contours.flat().every(q=>q.every(Number.isInteger)));assert.equal(p.approved,false);assert.equal(p.readyToCut,false);};
test('edge cut is one L blank; centred aperture is one blank with a clockwise hole',()=>{
 const [p]=blankContours(layout([{x:500,y:400,width:600,height:1000}]));assert.equal(p.outer.length,6);assert.equal(p.holes.length,0);assert.equal(p.areaMm2,992*992-500*600);assert.deepEqual(p.bbox,{x:4,y:4,width:992,height:992});profileCheck(p);
 const hole=blankContours(layout([{x:300,y:300,width:400,height:400}]));assert.equal(hole.length,1);assert.equal(hole[0].outer.length,4);assert.equal(hole[0].holes.length,1);assert.equal(hole[0].areaMm2,992*992-408*408);profileCheck(hole[0]);
});
test('only genuinely disconnected regions become separate physical candidates',()=>{
 const pp=blankContours(layout([{x:400,y:-100,width:200,height:1200}]));assert.equal(pp.length,2);assert.deepEqual(pp.map(p=>p.width),[392,392]);assert.equal(pp.reduce((a,p)=>a+p.areaMm2,0),2*392*992);assert.equal(new Set(pp.map(p=>p.sourceCellId)).size,1);assert.equal(new Set(pp.map(p=>p.id)).size,2);pp.forEach(profileCheck);
});
test('normal-width material runs record narrow necks; source remains comparative',()=>{
 const [p]=blankContours(layout([{x:55,y:200,width:800,height:600}]));assert.equal(p.minimumHorizontalRunMm,47);assert(p.narrowNecks.some(n=>n.axis==='x'&&n.sizeMm===47));assert(p.warnings.some(w=>w.includes('50')));assert(p.manufacturerBoundary.includes('p17'));assert.equal(p.cornerRadiusMm,null);
});
test('uses explicit grid levels/panelHeight, stable cell IDs and blank-centre colour',()=>{
 const l=layout([],{width:2400,height:2516,cuts:[0,1200,2400],levels:[0,1258,2516],panelHeight:1250,blankColourPolicy:'cell-centre',accentBands:[[0,1200]],parts:[{cell:0,floor:0,colour:'P222',grain:'вертикально'},{cell:0,floor:0,colour:'P070',grain:'вертикально'}],grain:'вертикально'});
 const pp=blankContours(l);assert.equal(pp.length,4);assert(pp.every(p=>p.height===1250&&p.width===1192));assert.deepEqual(pp.map(p=>p.colour),['P070','P070','P222','P222']);assert.deepEqual(pp[1].sourceLevelInterval,[1258,2516]);assert.equal(pp[1].sourceFloorId,'SE-GRID-R002');
 const unstyled=blankContours({...l,blankColourPolicy:undefined,accentBands:undefined});assert.equal(unstyled[0].colour,null);assert(unstyled[0].warnings.some(w=>w.includes('неоднозначний')));
});
test('joint/opening geometry changes without renderer/explode dependence or input mutation',()=>{
 const l=layout([{x:300,y:300,width:400,height:400}]),original=structuredClone(l),first=blankContours(l);assert.deepEqual(l,original);assert.deepEqual(blankContours({...l,explode:100,viewMode:'inspection'}),first);
 const changed=blankContours({...l,joint:12});assert.equal(changed[0].id,first[0].id);assert.equal(changed[0].openingClearanceMm,6);assert.equal(changed[0].areaMm2,988*988-412*412);assert.notEqual(changed[0].areaMm2,first[0].areaMm2);
 assert.throws(()=>blankContours({...l,joint:7}),/even joint/);assert.throws(()=>blankContours({...l,levels:[0,2850]}),/grid boundaries/);
});
test('independent integer-pixel oracle: unions, holes, no overlap, exact area and component count',()=>{
 let seed=190319;const rand=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let trial=0;trial<250;trial++){
  const openings=Array.from({length:rand(6)},()=>({x:rand(50)-5,y:rand(42)-5,width:1+rand(22),height:1+rand(19)}));
  const l=layout(openings,{width:40,height:32,joint:2,cuts:[0,20,40],levels:[0,16,32],panelHeight:14,colour:'P222',grain:'вертикально'}),pp=blankContours(l);pp.forEach(profileCheck);
  assert.deepEqual(blankContours({...l,openings:[...openings].reverse()}),pp);
  const expected=new Set();for(let x=0;x<40;x++)for(let y=0;y<32;y++){
   const p=[x+.5,y+.5],inBlank=(x>=1&&x<19||x>=21&&x<39)&&(y>=1&&y<15||y>=17&&y<31),inHole=openings.some(o=>p[0]>o.x-1&&p[0]<o.x+o.width+1&&p[1]>o.y-1&&p[1]<o.y+o.height+1),want=inBlank&&!inHole;
   if(want)expected.add(`${x},${y}`);assert.equal(pp.filter(part=>inside(p,part)).length,want?1:0,`trial${trial} pixel${x},${y}`);
  }
  assert.equal(pp.reduce((a,p)=>a+p.areaMm2,0),expected.size,`area${trial}`);
  let count=0;while(expected.size){count++;const queue=[expected.values().next().value];expected.delete(queue[0]);for(let i=0;i<queue.length;i++){const [x,y]=queue[i].split(',').map(Number);for(const [a,b] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(expected.delete(`${a},${b}`))queue.push(`${a},${b}`);}}
  assert.equal(pp.length,count,`positive-area components${trial}`);
 }
});
