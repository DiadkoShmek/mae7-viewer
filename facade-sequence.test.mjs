import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout,variants} from './engineering.js';
import {facades,initialLayouts,layoutFor} from './facade-layouts.js';
import {gableLayout} from './gables.js';
import {buildHouseReport,candidateOffsets} from './house-report.js';

test('all exterior views start full1200 and finish with the sole right grid remainder',()=>{
 const expected={SE:[33,528],NW:[33,528],SW:[9,360],NE:[9,360]};
 for(const [code,[full,right]] of Object.entries(expected)){
  const l=layoutFor(code,{module:1208,offset:0});assert.equal(l.joint,8);assert.equal(l.offset,0);
  assert.equal(l.edgeChain.finishedWidths.length,full+1);
  assert.deepEqual(l.edgeChain.finishedWidths,[...Array(full).fill(1200),right]);
  // Independently add the physical panel widths, actual interior joints and
  // two4mm edge clearances. A1200 module would incorrectly shrink each sheet.
  assert.equal(full*1200+right+full*8+4+4,facades[code].width);
  assert.equal(l.installation.view,'exterior');assert.equal(l.installation.direction,'left-to-right');
  for(const p of l.parts){assert(p.width>0&&p.height>0);assert(p.width<=1200);assert(p.x>=4&&p.x+p.width<=l.width-4);}
  for(let i=0;i<l.parts.length;i++)for(let j=i+1;j<l.parts.length;j++){
   const a=l.parts[i],b=l.parts[j];assert(!(Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)),`${a.id}/${b.id} overlap`);
  }
  for(const p of l.parts)for(const h of l.openings)assert(!(Math.min(p.x+p.width,h.x+h.width)>Math.max(p.x,h.x)&&Math.min(p.y+p.height,h.y+h.height)>Math.max(p.y,h.y)),`${p.id} covers${h.id}`);
 }
});

test('narrow opening strips remain visible conflicts, never disguised as a shifted full grid',()=>{
 const layouts=Object.keys(facades).map(code=>layoutFor(code,{module:1208,offset:0}));
 const strips=layouts.flatMap(l=>l.warningParts);assert.equal(strips.length,16);
 assert.equal(Math.min(...strips.map(p=>p.width)),3);assert.equal(Math.max(...strips.map(p=>p.width)),39);
 for(const l of layouts){assert.equal(l.validity.visualizable,true);assert.equal(l.validity.valid,l.warningParts.length===0);}
 const impossible=makeLayout({width:10,height:1000,module:1208,levels:[0,1000],openings:[]});
 assert.equal(impossible.validity.valid,false);assert.equal(impossible.validity.visualizable,false);
});

test('end gables share every body seam; report defaults cannot rebalance the mounting origin',()=>{
 const report=buildHouseReport({variant:'D'});assert.equal(report.variant.id,'D');assert.equal(report.variant.stock,1200);
 assert.equal(report.readyToCut,false);assert.equal(report.approved,false);
 assert.deepEqual(candidateOffsets('D'),{SE:0,NW:0,SW:0,NE:0});
 for(const code of ['SW','NE'])assert.deepEqual(gableLayout(code,1208,0).cuts,layoutFor(code,{module:1208,offset:0}).cuts);
 for(const l of report.layouts)assert.deepEqual(l.cuts,(l.facade.endsWith('G')?gableLayout(l.facade.slice(0,2),1208,0):layoutFor(l.facade,{module:1208,offset:0})).cuts);
 assert.equal(report.summary.geometricConflictParts,16);
 assert.throws(()=>buildHouseReport({variant:'D',offsets:{SE:100,NW:0,SW:0,NE:0}}),/full board/);
 // Legacy comparisons remain distinguishable: B is1192, D is1200.
 assert.equal(variants.find(v=>v.id==='B').stock,1192);assert.equal(variants.find(v=>v.id==='D').module,1208);
});
