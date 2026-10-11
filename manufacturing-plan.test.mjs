import test from 'node:test';
import assert from 'node:assert/strict';
import {manufacturingPlan} from './manufacturing-plan.js';
import {planCuts} from './cut-planner.js';
import {buildHouseReport} from './house-report.js';

test('known trapezoid finishing is bound to its placed blank with reflected sheet coordinates',()=>{
 const part={id:'T',x:20,y:30,width:100,height:100,colour:'P222',points:[[20,30],[120,30],[120,130],[20,80]]};
 const packing=planCuts([part],{width:200,height:220,kerf:3,trim:10});
 const m=manufacturingPlan(packing,[part]),line=m.profileMarking[0];
 assert.equal(m.profileMarking.length,1);assert.equal(line.sheet,'S001');
 assert.deepEqual(line.from,[100,100]);assert.deepEqual(line.to,[0,50]);
 assert.deepEqual(line.sheetFrom,[110,10]);assert.deepEqual(line.sheetTo,[10,60]);
 assert.equal(line.keepSide,'left');assert.equal(line.sheetKeepSide,'right');
 assert(Math.abs(line.sheetAngleDegrees-153.434948822922)<1e-9);
 assert.deepEqual(line.dependsOn,m.rectangularCuts.map(c=>c.id));
 assert.deepEqual(m.rectangularCuts[1].dependsOn,[m.rectangularCuts[0].id]);
 assert.equal(line.secondaryKerfModelled,false);
 const reversed=manufacturingPlan(packing,[{...part,points:[...part.points].reverse()}]).profileMarking[0];
 assert.equal(reversed.sheetKeepSide,'left');assert.deepEqual(reversed.sheetFrom,line.sheetTo);
});

test('actual four walls and two gables preserve identities and finishing references across candidate variants',()=>{
 for(const variant of ['A','B','C']){
  const report=buildHouseReport({variant}),m=report.manufacturing;
  assert.deepEqual(m.partResults.map(p=>p.part).sort(),report.parts.map(p=>p.id).sort());
  assert.equal(new Set(m.partResults.map(p=>p.part)).size,report.parts.length);
  assert.equal(report.summary.rectangularCuts,m.rectangularCuts.length);
  assert.equal(report.summary.profileMarkingLines,m.profileMarking.length);
  const ids=new Set([...m.rectangularCuts,...m.profileMarking].map(c=>c.id));
  assert.equal(ids.size,m.rectangularCuts.length+m.profileMarking.length);
  const sheets=new Map(report.packing.sheets.map(s=>[s.id,s]));
  for(const line of m.profileMarking){
   const sheet=sheets.get(line.sheet),part=sheet.parts.find(p=>p.id===line.part);assert(part);
   for(const [local,actual] of [[line.from,line.sheetFrom],[line.to,line.sheetTo]]){
    assert(Math.abs(actual[0]-part.xSheet-local[0])<1e-8);
    assert(Math.abs(actual[1]-part.ySheet-part.height+local[1])<1e-8);
    assert(actual[0]>=part.xSheet-1e-7&&actual[0]<=part.xSheet+part.width+1e-7);
    assert(actual[1]>=part.ySheet-1e-7&&actual[1]<=part.ySheet+part.height+1e-7);
   }
   assert(line.dependsOn.every(id=>ids.has(id)));
  }
  if(variant==='C'){assert.equal(m.profileMarking.length,24);assert.equal(m.rectangularCuts.length,1006);}
 }
});

test('rejected gable blanks get no fictitious finishing placement; missing identities fail closed',()=>{
 const report=buildHouseReport({variant:'C',stockWidth:200,stockHeight:300});
 assert(report.packing.rejected.some(p=>p.points));
 const rejected=new Set(report.packing.rejected.map(p=>p.id));
 assert(report.manufacturing.partResults.filter(p=>rejected.has(p.part)).every(p=>p.sheet===null&&p.profileMarkingIds.length===0));
 assert(report.manufacturing.profileMarking.every(p=>!rejected.has(p.part)));
 const part={id:'missing',width:50,height:50,colour:'P222'};
 assert.throws(()=>manufacturingPlan({sheets:[],rejected:[]},[part]),/Missing/);
 assert.throws(()=>manufacturingPlan({sheets:[],rejected:[part,part]},[part]),/rejection/);
 const rectangle=buildHouseReport({variant:'C',includeGables:false});assert.equal(rectangle.manufacturing.profileMarking.length,0);
});

test('same-ID stale placement cannot change source blank dimensions or put markings outside stock',()=>{
 const part={id:'T',x:0,y:0,width:100,height:100,colour:'P222',points:[[0,0],[100,0],[100,100],[0,50]]};
 const original=planCuts([part],{width:200,height:200,kerf:3,trim:0});
 for(const change of [{width:1,height:1},{xSheet:NaN},{ySheet:-1},{xSheet:150}]){
  const packing=structuredClone(original);Object.assign(packing.sheets[0].parts[0],change);
  assert.throws(()=>manufacturingPlan(packing,[part]),/placement/);
 }
 assert.throws(()=>manufacturingPlan(original,[{...part,points:[[0,0],[101,0],[100,100],[0,50]]}]),/Profile leaves/);
 const rejected=planCuts([part],{width:50,height:50});rejected.rejected[0].width=1;
 assert.throws(()=>manufacturingPlan(rejected,[part]),/rejection/);
});
