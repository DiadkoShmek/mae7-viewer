import test from 'node:test';
import assert from 'node:assert/strict';
import {dimensionSchedule} from './dimension-schedule.js';
import {layoutFor,initialVisualLayouts,facades} from './facade-layouts.js';
test('floor chains close exactly against the written attic level on every facade',()=>{
 for(const code of ['SE','NW','SW','NE']){
  const d=dimensionSchedule(code),chain=d.filter(x=>x.source==='PP-1:floor-levels');
  assert.equal(chain.length,3);assert.equal(chain[0].a[1],0);assert.equal(chain[2].b[1],8.525);
  assert.equal(chain.reduce((s,x)=>s+Math.round((x.b[1]-x.a[1])*1000),0),8525);
  assert.equal(d[0].b[0]-d[0].a[0],facades[code].width/1000);
 }
});
test('detail dimensions bind to the actual panel and source opening, rejecting foreign owners',()=>{
 const p=layoutFor('SE',initialVisualLayouts.SE).parts[0],panel={...p,facade:'SE'};
 const d=dimensionSchedule('SE',{panel,opening:facades.SE.openings[0]}).filter(x=>x.detail);assert.ok(d.length>=10);
 assert.ok(Math.abs(d[0].b[0]-d[0].a[0]-p.width/1000)<1e-9);
 assert.throws(()=>dimensionSchedule('NW',{panel}),/Unbound/);
 assert.throws(()=>dimensionSchedule('SE',{opening:{id:'fabricated'}}),/Unbound/);
});
test('opening sill and head levels retain their graphic source and exact vertical closure',()=>{
 for(const code of ['SE','NW','SW','NE'])for(const opening of facades[code].openings){
  const levels=dimensionSchedule(code,{opening}).filter(d=>['opening-sill-level','opening-head-level'].includes(d.role));
  assert.equal(levels.length,2);assert(levels.every(d=>['opening-sill-level','opening-head-level'].includes(d.role)&&d.openingId===opening.id));
  assert.equal(Math.round(levels[0].a[1]*1000),opening.y);
  assert.equal(Math.round((levels[1].a[1]-levels[0].a[1])*1000),opening.height);
 }
});
test('new source dimensions close the roof and locating chains without trusting caller aperture values',()=>{
 for(const code of Object.keys(facades)){
  const base=dimensionSchedule(code),roof=base.find(d=>d.role==='attic-roof-height'),marks=base.filter(d=>d.role==='floor-datum');
  assert.equal(Math.round((roof.b[1]-roof.a[1])*1000),2584);assert.equal(roof.authority,'written');
  assert.deepEqual(marks.map(d=>Math.round(d.a[1]*1000)),[0,2850,5685,8525]);
  const ids=new Set(base.map(d=>d.id));assert.equal(ids.size,base.length);assert.equal(base.find(d=>d.role==='facade-height').authority,'graphic');
  for(const source of facades[code].openings){
   const d=dimensionSchedule(code,{opening:{id:source.id,width:1,height:1,x:1,y:1}}),width=d.find(d=>d.role==='opening-width');
   assert.equal(Math.round((width.b[0]-width.a[0])*1000),source.width);
   const chain=d.filter(d=>['opening-width','opening-left-setback','opening-right-setback'].includes(d.role));
   assert.equal(Math.round(chain.reduce((sum,d)=>sum+d.b[0]-d.a[0],0)*1000),facades[code].width);
   assert(d.filter(d=>d.role.includes('setback')).every(d=>d.authority==='graphic'));
  }
 }
});
test('panel dimensions use the active source bounds, with location and model levels',()=>{
 const panel={facade:'SE',id:'actual-source',x:2400,y:1258,width:1192,height:1250},d=dimensionSchedule('SE',{panel}).filter(d=>d.detail);
 assert.equal(d.length,6);assert(d.every(d=>d.authority==='model'));
 assert.equal(Math.round(d.find(d=>d.role==='panel-head-level').a[1]*1000),2508);
 const chain=d.filter(d=>['panel-width','panel-left-setback','panel-right-setback'].includes(d.role));
 assert.equal(Math.round(chain.reduce((sum,d)=>sum+d.b[0]-d.a[0],0)*1000),40400);
 for(const value of [NaN,Infinity,-1,0])assert.throws(()=>dimensionSchedule('SE',{panel:{...panel,width:value}}),/Unbound/);
});
