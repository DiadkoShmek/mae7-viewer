import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionCell,partitionLayout} from './panel-rectangle-partition.js';
import {buildHouseReport} from './house-report.js';
import {makeLayout} from './engineering.js';
import {facades} from './facade-layouts.js';
const overlap=(a,b)=>Math.max(a.x,b.x)<Math.min(a.x+a.width,b.x+b.width)&&Math.max(a.y,b.y)<Math.min(a.y+a.height,b.y+b.height);
const signature=r=>JSON.stringify(r.rectangles);
function check(cell,holes,r,joint){
 const occupied=new Set();let retained=0;
 // Independent unit-square union oracle, not the producer's compressed grid.
 for(let y=cell.y;y<cell.y+cell.height;y++)for(let x=cell.x;x<cell.x+cell.width;x++)if(!holes.some(h=>x>=h.x&&x<h.x+h.width&&y>=h.y&&y<h.y+h.height))retained++;
 for(const p of r.rectangles){for(let y=p.y;y<p.y+p.height;y++)for(let x=p.x;x<p.x+p.width;x++){
  const k=`${x},${y}`;assert(!occupied.has(k),'double-covered unit square');assert(x>=cell.x&&x<cell.x+cell.width&&y>=cell.y&&y<cell.y+cell.height);assert(!holes.some(h=>x>=h.x&&x<h.x+h.width&&y>=h.y&&y<h.y+h.height),'covered opening');occupied.add(k);
 }}
 assert.equal(occupied.size,retained);assert.equal(r.nominalMaterialAreaMm2,retained);assert.equal(r.finishedAreaMm2+r.jointLossAreaMm2+r.consumedNominalAreaMm2,retained);
 for(const p of r.parts){assert.equal(p.x,p.nominal.x+joint/2);assert.equal(p.y,p.nominal.y+joint/2);assert.equal(p.width,p.nominal.width-joint);assert.equal(p.height,p.nominal.height-joint);assert(p.width>0&&p.height>0);assert.equal(p.areaMm2,p.width*p.height);assert.equal(p.readyToCut,false);
  for(const h of holes)assert(!overlap(p,{x:h.x-joint/2,y:h.y-joint/2,width:h.width+joint,height:h.height+joint}),'opening half-joint lost');
 }
 for(let i=0;i<r.parts.length;i++)for(let j=0;j<i;j++){
  const a=r.parts[i],b=r.parts[j];assert(!overlap(a,b));
  const dx=Math.max(0,a.x-b.x-b.width,b.x-a.x-a.width),dy=Math.max(0,a.y-b.y-b.height,b.y-a.y-a.height);
  assert(Math.max(dx,dy)>=joint,'inter-piece joint smaller than declared joint');
 }
 assert.equal(r.approved,false);assert.equal(r.readyToCut,false);
}
test('union partition: notch/hole/separator/outside/fully cut; exact half-joints',()=>{
 const cell={x:-3,y:2,width:16,height:18},cases=[[],[{x:7,y:2,width:6,height:8}],[{x:2,y:7,width:5,height:6}],[{x:3,y:0,width:3,height:30}],[{x:-30,y:-30,width:40,height:80}],[{x:-4,y:1,width:30,height:30}]];
 for(const holes of cases)for(const strategy of ['vertical-first','horizontal-first','global-cell']){const r=partitionCell(cell,holes,{joint:2,minWidth:3,minHeight:4,strategy});check(cell,holes,r,2);}
 const hole=partitionCell(cell,cases[2],{joint:0,minWidth:0,minHeight:0});assert.equal(hole.rectangleCount,4);
 const notch=partitionCell(cell,cases[1],{joint:0,minWidth:0,minHeight:0});assert.equal(notch.rectangleCount,2);
});
test('opening order, duplicates and UNION decomposition cannot change canonical output',()=>{
 const cell={x:0,y:0,width:100,height:120},holes=[{x:20,y:10,width:60,height:40},{x:30,y:30,width:40,height:50}];
 const r=partitionCell(cell,holes);assert.equal(signature(r),signature(partitionCell(cell,[...holes].reverse())));assert.equal(signature(r),signature(partitionCell(cell,[holes[0],holes[0],holes[1]])));
 const union=[{x:20,y:10,width:60,height:40},{x:30,y:50,width:40,height:30}];assert.equal(signature(r),signature(partitionCell(cell,union)));
 const full={x:0,y:0,width:100,height:120};assert.equal(signature(partitionCell(cell,[full])),signature(partitionCell(cell,[{x:0,y:0,width:50,height:120},{x:50,y:0,width:50,height:120}])));
 const big=Number.MAX_SAFE_INTEGER-20,large=partitionCell({x:big,y:0,width:10,height:10},[{x:big+1,y:0,width:1,height:10}],{joint:0,minWidth:0,minHeight:0});assert.equal(large.nominalMaterialAreaMm2,90);assert.equal(large.parts.length,2);
});
test('deterministic adversarial pixel union covers; clearance loss never hidden',()=>{
 let seed=912751;const rnd=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let sample=0;sample<300;sample++){
  const cell={x:-2,y:-1,width:6+rnd(15),height:6+rnd(15)},holes=Array.from({length:rnd(5)},()=>({x:-5+rnd(25),y:-5+rnd(25),width:1+rnd(18),height:1+rnd(18)}));
  const r=partitionCell(cell,holes,{joint:2,minWidth:3,minHeight:4});assert(r.search.complete);check(cell,holes,r,2);assert.equal(signature(r),signature(partitionCell(cell,[...holes].reverse(),{joint:2,minWidth:3,minHeight:4})));
 }
});
// Exhaustive unit-grid tiling oracle: considers rectangles at EVERY integer
// coordinate, including positions not present in the producer's arrangement.
function minimumRects(width,height,holes){
 let target=0n;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(!holes.some(h=>x>=h.x&&x<h.x+h.width&&y>=h.y&&y<h.y+h.height))target|=1n<<BigInt(y*width+x);
 const rects=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let h=1;y+h<=height;h++)for(let w=1;x+w<=width;w++){
  let mask=0n;for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)mask|=1n<<BigInt(j*width+i);if((target&mask)===mask)rects.push(mask);
 }
 const memo=new Map();function solve(m){if(m===0n)return 0;if(memo.has(m))return memo.get(m);const first=m&-m;let best=Infinity;for(const mask of rects)if((mask&first)&&(mask&m)===mask)best=Math.min(best,1+solve(m^mask));memo.set(m,best);return best;}return solve(target);
}
test('small minimum-count exact cover compared with independent unrestricted integer tilings',()=>{
 const cases=[[],[{x:1,y:1,width:2,height:2}],[{x:0,y:1,width:2,height:2}],[{x:1,y:0,width:1,height:4}],[{x:1,y:1,width:2,height:1},{x:2,y:2,width:1,height:1}],[{x:0,y:1,width:3,height:1},{x:2,y:2,width:1,height:2}]];
 for(const holes of cases){const r=partitionCell({x:0,y:0,width:4,height:4},holes,{joint:0,minWidth:0,minHeight:0});assert(r.search.complete);assert.equal(r.rectangleCount,minimumRects(4,4,holes));}
});
test('intrinsic strip retained and held; no warning win by consumed material; bounded fallback honest',()=>{
 const cell={x:0,y:0,width:1200,height:1258},holes=[{x:31,y:0,width:1169,height:1258}];
 const r=partitionCell(cell,holes);assert.equal(r.parts.length,1);assert.equal(r.parts[0].width,23);assert.equal(r.warningPartCount,1);assert.equal(r.consumedNominalAreaMm2,0);assert.equal(r.finishedAreaMm2,23*1250);
 const consumed=partitionCell(cell,[{x:5,y:0,width:1195,height:1258}]);assert.equal(consumed.parts.length,0);assert.equal(consumed.consumedNominalAreaMm2,5*1258);assert.equal(consumed.jointLossAreaMm2,0);
 const limited=partitionCell(cell,[{x:300,y:300,width:500,height:500}],{maxStates:1});assert.equal(limited.search.complete,false);assert.equal(limited.optimalOnApertureBoundaryLattice,undefined);assert.equal(limited.alternatives.length,2);assert.throws(()=>partitionCell(cell,[],{joint:3}));assert.throws(()=>partitionCell(cell,[],{maxAtoms:0}));
});
test('actual four facades unchanged grid/union, stable IDs/style, area ledger, persistent warnings',()=>{
 const expected={SE:[449,36,303148272],NW:[419,55,254090072],SW:[80,8,87865204],NE:[80,2,87863828]},report=buildHouseReport();
 // Historical V19 fixture is explicit. Current E defaults now use common V20
 // courses, so this pure partition comparison must not follow report defaults.
 const layouts=Object.keys(facades).map(facade=>{const source=facades[facade],height=source.height,rowLevels=[0,...Array.from({length:Math.ceil(height/1258)-1},(_,i)=>(i+1)*1258),height];return makeLayout({...source,facade,module:1200,offset:0,panelHeight:1250,rowLevels});});
 for(const layout of layouts){
  const before=JSON.stringify(layout),r=partitionLayout(layout);assert.equal(JSON.stringify(layout),before);assert.deepEqual([r.summary.parts,r.summary.warningParts,r.summary.finishedAreaMm2],expected[layout.facade]);assert(r.summary.allCellSearchesComplete);
  assert.equal(r.summary.finishedAreaMm2+r.summary.jointLossAreaMm2+r.summary.consumedNominalAreaMm2,r.summary.nominalMaterialAreaMm2);assert.deepEqual(r.cuts,layout.cuts);assert.deepEqual(r.levels,layout.levels);
  assert.equal(new Set(r.parts.map(p=>p.id)).size,r.parts.length);assert(r.parts.every(p=>p.width<=1192&&p.height<=1250&&p.stockFit&&!p.approved&&!p.readyToCut));
  const repeated=partitionLayout({...layout,openings:[...layout.openings].reverse(),explode:100});assert.deepEqual(repeated.parts,r.parts);
  for(const p of r.parts){const old=layout.parts.find(q=>q.cell===p.cell&&q.floor===p.floor);assert(old);assert.equal(p.colour,old.colour);assert.equal(p.grain,old.grain);}
  const rawSum=layout.parts.reduce((s,p)=>s+(p.width+8)*(p.height+8),0)+layout.jointClearances.reduce((s,p)=>s+p.rectangle.width*p.rectangle.height,0);assert.equal(rawSum,r.summary.nominalMaterialAreaMm2);
 }
 assert.throws(()=>partitionLayout(report.layouts.find(l=>l.facade==='SWG')),/roof\/gable\/profile/);
 const se=layouts.find(l=>l.facade==='SE'),mutated=partitionLayout({...se,joint:6});assert.notEqual(mutated.summary.finishedAreaMm2,expected.SE[2]);
});
