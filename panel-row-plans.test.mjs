import test from 'node:test';
import assert from 'node:assert/strict';
import {commonPanelCourses,commonRowLevels,commonRowPlan,validateRowLevels} from './panel-row-plans.js';
import {makeLayout} from './engineering.js';
import {facades,initialLayouts,layoutFor} from './facade-layouts.js';
const overlap=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
function openingUnionArea(width,height,holes){
 const clipped=holes.map(h=>({x:Math.max(0,h.x),y:Math.max(0,h.y),r:Math.min(width,h.x+h.width),t:Math.min(height,h.y+h.height)})).filter(h=>h.r>h.x&&h.t>h.y);
 const ys=[...new Set([0,height,...clipped.flatMap(h=>[h.y,h.t])])].sort((a,b)=>a-b);let area=0;
 for(let i=0;i<ys.length-1;i++){
  const spans=clipped.filter(h=>h.y<=ys[i]&&h.t>=ys[i+1]).map(h=>[h.x,h.r]).sort((a,b)=>a[0]-b[0]);let from=null,to=null,length=0;
  for(const [a,b] of spans){if(from===null){from=a;to=b;}else if(a<=to)to=Math.max(to,b);else{length+=to-from;from=a;to=b;}}if(from!==null)length+=to-from;area+=length*(ys[i+1]-ys[i]);
 }return area;
}
test('row API rejects endpoints, inversion, nonintegers, consumed courses and oversized finished heights',()=>{
 const valid={height:2500,panelHeight:1250,joint:8},rows=[0,1250,2500];assert.deepEqual(validateRowLevels(rows,valid),rows);assert.notEqual(validateRowLevels(rows,valid),rows);
 for(const input of [[],[1,1250,2500],[0,1250,2499],[0,1250,1250,2500],[0,1250.5,2500],[0,8,1250,2500],[0,1259,2500]])assert.throws(()=>validateRowLevels(input,valid));
 assert.throws(()=>validateRowLevels(rows,{...valid,panelHeight:0}));assert.throws(()=>validateRowLevels(rows,{...valid,joint:7}));assert.throws(()=>commonRowLevels(9000));
 const r=makeLayout({width:1200,height:2500,module:1200,openings:[],panelHeight:1250,rowLevels:rows,levels:[0,2500],rectanglePartition:'best'});assert.deepEqual(r.levels,rows);assert.deepEqual(r.rowLevels,rows);assert.equal(r.rectanglePartition,'best');assert(r.parts.every(p=>p.height===1242));
 assert.throws(()=>makeLayout({width:1200,height:2500,module:1200,openings:[],panelHeight:1250,rowLevels:[0,1259,2500]}));assert.throws(()=>makeLayout({rectanglePartition:'unknown'}));
 const custom=layoutFor('SE',{module:1200,panelHeight:1250,width:1200,height:2500,openings:[],rowLevels:rows});assert.deepEqual(custom.rowLevels,rows);assert.equal(custom.rectanglePartition,'best');
});
test('standard E defaults and serialized native options share common corner courses',()=>{
 const counts={SE:[424,10,10,2],NW:[391,6,6,0],SW:[80,6,6,0],NE:[80,0,0,0]};
 for(const code of Object.keys(facades)){
  const options=structuredClone(initialLayouts[code]),l=layoutFor(code,options),defaultE=layoutFor(code,{module:1200,panelHeight:1250,offset:0});assert.deepEqual(l.parts,defaultE.parts);
  assert.deepEqual(l.levels,commonRowLevels(l.height));assert.deepEqual(l.rowLevels,l.levels);assert.equal(l.rectanglePartition,'best');assert.equal(options.rectanglePartition,'best');assert.deepEqual(options.rowLevels,l.rowLevels);
  assert.deepEqual(l.levels.slice(0,8),commonPanelCourses);assert.equal(l.grain,'вертикально');assert(l.parts.every(p=>p.grain==='вертикально'));
  assert.deepEqual([l.parts.length,l.warningParts.length,l.validity.errors.filter(e=>e.kind==='piece-width').length,l.validity.errors.filter(e=>e.kind==='piece-height').length],counts[code]);
  assert.equal(l.validity.valid,l.warningParts.length===0);assert.equal(l.validity.visualizable,true);
  for(let i=0;i<l.parts.length;i++){const p=l.parts[i];assert.equal(p.id,`${code}-${String(i+1).padStart(3,'0')}`);assert(p.partitionPartId.startsWith(p.sourceCellId));assert(!p.approved&&!p.readyToCut);}
  for(const c of new Set(l.parts.map(p=>p.cell)))assert.equal(new Set(l.parts.filter(p=>p.cell===c).map(p=>p.colour)).size,1);
  options.rowLevels[1]++;assert.notEqual(initialLayouts[code].rowLevels[1],options.rowLevels[1]);
 }
 const p=commonRowPlan(9475);assert.equal(p.approved,false);assert.equal(p.readyToCut,false);assert.equal(p.necessaryOnly,true);
});
test('actual nominal complement and explicit joint ledger conserve all material; no artificial solid loss',()=>{
 let rawTotal=0,finishedTotal=0,jointTotal=0,consumedTotal=0,strips=0;
 for(const code of Object.keys(facades)){
  const l=layoutFor(code,initialLayouts[code]),a=l.rectanglePartitionAccounting;
  const nominal=[...l.parts.map(p=>p.nominal),...l.jointClearances.map(c=>c.rectangle)];
  assert.equal(a.nominalMaterialAreaMm2,l.width*l.height-openingUnionArea(l.width,l.height,l.openings));assert.equal(a.openingUnionAreaMm2,openingUnionArea(l.width,l.height,l.openings));
  assert.equal(nominal.reduce((s,r)=>s+r.width*r.height,0),a.nominalMaterialAreaMm2);
  for(let i=0;i<nominal.length;i++){const r=nominal[i];assert(r.x>=0&&r.y>=0&&r.x+r.width<=l.width&&r.y+r.height<=l.height);for(const h of l.openings)assert(!overlap(r,h));for(let j=0;j<i;j++)assert(!overlap(r,nominal[j]));}
  const finished=l.parts.reduce((s,p)=>s+p.width*p.height,0),consumed=l.jointClearances.reduce((s,p)=>s+p.rectangle.width*p.rectangle.height,0),joint=l.parts.reduce((s,p)=>s+p.nominal.width*p.nominal.height-p.width*p.height,0);
  assert.equal(finished,a.finishedAreaMm2);assert.equal(consumed,a.consumedNominalAreaMm2);assert.equal(joint,a.jointLossAreaMm2);assert.equal(finished+joint+consumed,a.nominalMaterialAreaMm2);assert.equal(l.area,finished/1e6);
  assert.equal(a.allCellSearchesComplete,true);assert.equal(a.globalFacadeStockOptimum,false);assert(!a.approved&&!a.readyToCut);assert.equal(l.cells,undefined);assert.equal(l.alternatives,undefined);
  rawTotal+=a.nominalMaterialAreaMm2;finishedTotal+=finished;jointTotal+=joint;consumedTotal+=consumed;strips+=l.jointClearances.length;
 }
 assert.deepEqual([rawTotal,finishedTotal,jointTotal,consumedTotal,strips],[746401500,733218560,13155040,27900,39]);
});
test('actual8mm joints/4mm opening clearance and unchanged1192x1250 stock/grid',()=>{
 for(const code of Object.keys(facades)){
  const l=layoutFor(code,initialLayouts[code]);assert.equal(l.offset,0);assert.equal(l.module,1200);assert.equal(l.panelHeight,1250);assert.equal(l.edgeChain.finishedWidths.at(-1),l.width===40400?792:432);
  for(const p of l.parts){assert(p.width>0&&p.height>0&&p.width<=1192&&p.height<=1250);assert.equal(p.x,p.nominal.x+4);assert.equal(p.y,p.nominal.y+4);assert.equal(p.width,p.nominal.width-8);assert.equal(p.height,p.nominal.height-8);for(const h of l.openings)assert(!overlap(p,{x:h.x-4,y:h.y-4,width:h.width+8,height:h.height+8}));}
  for(let i=0;i<l.parts.length;i++)for(let j=0;j<i;j++){const a=l.parts[i],b=l.parts[j],dx=Math.max(0,a.x-b.x-b.width,b.x-a.x-a.width),dy=Math.max(0,a.y-b.y-b.height,b.y-a.y-a.height);assert(Math.max(dx,dy)>=8);}
 }
 const se=layoutFor('SE',initialLayouts.SE),short=se.parts.filter(p=>p.height<160);assert.deepEqual(short.map(p=>[p.width,p.height]),[[22,87],[32,87]]);assert(short.every(p=>p.warnings.length===2));
});
test('legacy D and absent row/partition options keep former subtraction and levels',()=>{
 for(const code of Object.keys(facades)){
  const old=layoutFor(code,{module:1208,offset:0}),direct=makeLayout({...facades[code],module:1208,offset:0,facade:code});assert.deepEqual(old.parts,direct.parts);assert.deepEqual(old.levels,facades[code].levels);assert.equal(old.rectanglePartition,undefined);assert.equal(old.rowLevels,undefined);assert.equal(old.rectanglePartitionAccounting,undefined);
  const auto=makeLayout({...facades[code],facade:code,module:1200,panelHeight:1250});assert.equal(auto.levels[1],1258);assert.equal(auto.rectanglePartition,undefined);
 }
 const legacy=Object.keys(facades).map(code=>layoutFor(code,{module:1208,offset:0}));assert.equal(legacy.reduce((s,l)=>s+l.warningParts.length,0),16);
 const nonstandard=layoutFor('SE',{module:1200,panelHeight:1240});assert.equal(nonstandard.levels[1],1248);assert.equal(nonstandard.rectanglePartition,undefined);
});
