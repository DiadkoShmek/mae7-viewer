import test from 'node:test';
import assert from 'node:assert/strict';
import {facades,initialLayouts,layoutFor} from './facade-layouts.js';
import {buildHouseReport} from './house-report.js';
import {gableLayout} from './gables.js';
test('finished1192×1250 closes both axes with actual8mm joints, no oversized parts',()=>{
 for(const code of Object.keys(facades)){
  const l=layoutFor(code,initialLayouts[code]);assert.equal(l.module,1200);assert.equal(l.panelHeight,1250);assert.equal(l.offset,0);
  const intervals=l.levels.slice(1).map((y,i)=>y-l.levels[i]-8);
  assert(intervals.every(n=>n>0&&n<=1250));assert.equal(intervals.reduce((a,n)=>a+n,0)+(intervals.length-1)*8+4+4,l.height);
  assert.equal(l.installation.rightWidth,['SE','NW'].includes(code)?792:432);
  assert(l.parts.every(p=>p.width<=1192&&p.height<=1250));
  for(const a of l.parts)for(const b of l.parts)if(a.id<b.id)assert(Math.min(a.x+a.width,b.x+b.width)<=Math.max(a.x,b.x)||Math.min(a.y+a.height,b.y+b.height)<=Math.max(a.y,b.y));
  for(const a of l.parts)for(const h of l.openings)assert(Math.min(a.x+a.width,h.x+h.width)<=Math.max(a.x,h.x)||Math.min(a.y+a.height,h.y+h.height)<=Math.max(a.y,h.y));
  for(const cell of new Set(l.parts.map(p=>p.cell)))assert.equal(new Set(l.parts.filter(p=>p.cell===cell).map(p=>p.colour)).size,1);
 }
 for(const code of ['SW','NE']){const g=gableLayout(code,1200,0,{panelHeight:1250});assert(g.parts.every(p=>p.width<=1192&&p.height<=1250));assert.deepEqual(g.cuts,layoutFor(code,initialLayouts[code]).cuts);}
});
test('house default binds finished format, preserves geometric conflicts and refuses optimistic stock fit',()=>{
 const r=buildHouseReport();assert.equal(r.variant.id,'E');assert.equal(r.packing.stock.width,1192);assert.equal(r.packing.stock.height,1250);
 assert.equal(r.summary.parts,1013);assert.equal(r.summary.geometricConflictParts,0);assert.equal(r.summary.rejected,0);
 assert.equal(r.readyToCut,false);assert.equal(r.approved,false);
 const short=buildHouseReport({stockHeight:1000});assert(short.summary.rejected>0);
 assert.throws(()=>buildHouseReport({offsets:{SE:1,NW:0,SW:0,NE:0}}),/full board/);
});
