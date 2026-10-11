import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {layoutFor,facades,initialLayouts,initialVisualLayouts} from './facade-layouts.js';
import {makeLayout,variants,screenOffsets,insulationFit} from './engineering.js';
import {visualPanelLayout,samePanelLayout,samePanelPart} from './visual-panel-layout.js';
import {blankContours} from './panel-blank-shapes.js';
import {planCuts} from './cut-planner.js';
import {localJointCutHold} from './cut-export-admission.js';

test('separate visual defaults have exact contours and stock bounds, without stale split authority',()=>{
 for(const code of Object.keys(facades)){
  assert.equal(initialLayouts[code].localJoints,'best');assert.equal(initialLayouts[code].cutPolicy,undefined);
  const visual=layoutFor(code,initialVisualLayouts[code]);
  const split=layoutFor(code,{...initialLayouts[code],localJoints:'none'});
  const expected=blankContours(split);
  assert.deepEqual(visual.parts.map(p=>p.contours),expected.map(p=>p.contours));
  assert.equal(visual.area,expected.reduce((sum,p)=>sum+p.areaMm2,0)/1e6);
  assert(visual.parts.every(p=>p.stockFit&&p.width<=1192&&p.height<=1250));
  assert(visual.parts.every(p=>p.grain==='вертикально'));
  for(const field of ['rectanglePartitionAccounting','localJointPlan','localJointTopology'])assert(!Object.hasOwn(visual,field));
  assert.deepEqual(visual.jointClearances,[]);assert.equal(visual.localJoints,'none');
  assert.equal(visual.validity.valid,false);assert.equal(visual.validity.visualizable,true);assert.equal(visual.readyToCut,false);
  assert.equal(visual.visualPanelAccounting.internalCutOperationsVerified,false);
 }
});

test('closed apertures fit a bounding blank but are never internal guillotine operations',()=>{
 const base=makeLayout({width:1200,height:1258,module:1200,joint:8,panelHeight:1250,openings:[{x:400,y:400,width:400,height:400}]});
 const visual=visualPanelLayout(base);assert.equal(visual.parts.length,1);assert.equal(visual.parts[0].holes.length,1);
 const packed=planCuts(visual.parts,{width:1192,height:1250,trim:0});
 assert.equal(packed.rejected.length,0);assert.equal(packed.sheets[0].cuts.length,0);
 assert.equal(packed.placedArea,1490000);assert.equal(visual.visualPanelAccounting.finishedAreaMm2,1323536);
 assert.equal(visual.visualPanelAccounting.cutoutAreaWithinBoundingBlanksMm2,166464);
 assert.equal(visual.parts[0].cornerRadiusMm,null);assert.equal(visual.parts[0].approved,false);
});

test('native equality distinguishes actual holes, grain, policy and openings, not just bounding boxes',()=>{
 const base=layoutFor('SE',initialVisualLayouts.SE);assert(samePanelLayout(base,structuredClone(base)));
 for(const mutate of [p=>p.parts[0].grain='горизонтально',p=>p.parts.find(p=>p.outer.length>4).outer[1][0]++,p=>p.openings[0].width++,p=>p.cutPolicy='split']){
  const changed=structuredClone(base);mutate(changed);assert(!samePanelLayout(changed,base));
 }
 assert.throws(()=>layoutFor('SE',{...initialVisualLayouts.SE,cutPolicy:'unknown'}),/policy/);
 const tall=visualPanelLayout(makeLayout({width:1200,height:1400,module:1200,levels:[0,1400],openings:[]}));assert(!tall.parts[0].stockFit);
 assert.equal(tall.validity.errors[0].kind,'bounding-stock');
});

test('shipped native matcher retains matching contours and rejects stale or mutated asset records',async()=>{
 const source=await readFile(new URL('./native-model.js',import.meta.url),'utf8');
 const start=source.indexOf(' function isNativeLayout('),end=source.indexOf('\n gltf.scene.traverse',start);
 const native=layoutFor('SE',initialVisualLayouts.SE),records=structuredClone(native.parts);
 const context=vm.createContext({canonicalLayouts:{SE:native},authoredPanelRecords:records,samePanelLayout,samePanelPart});
 vm.runInContext(source.slice(start,end)+'\nglobalThis.matches=isNativeLayout;',context);
 assert(context.matches('SE',structuredClone(native)));
 records[0].outer[0][0]++;assert(!context.matches('SE',native));
 records[0].outer[0][0]--;const candidate=structuredClone(native);candidate.parts[0].grain='горизонтально';assert(!context.matches('SE',candidate));
});

test('actual workbench defaults to whole contours, describes bounding packing, and holds all three cut CSV callbacks',async()=>{
 const elements=new Map(),downloads=[],events=[];
 const values={'layout-variant':'E','layout-facade':'SE','layout-offset':0,'stock-width':1192,'stock-height':1250,'panel-height':1250,'kerf':3,'trim':0,'cut-policy':'split','wool-step':420,'wool-width':610,'wool-extra':15};
 const $=id=>{if(!elements.has(id))elements.set(id,{value:values[id]??'',textContent:'',innerHTML:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},querySelectorAll(){return [];}});return elements.get(id);};
 const source=await readFile(new URL('./workbench.js',import.meta.url),'utf8');
 const context=vm.createContext({document:{getElementById:$,createElement:()=>({click(){downloads.push(this.download);}})},window:{dispatchEvent:e=>{events.push(e.detail);return true;}},CustomEvent:class{constructor(type,options){Object.assign(this,options);}},fetch:async()=>({ok:true,json:async()=>[]}),makeLayout,variants,screenOffsets,insulationFit,localJointCutHold,layoutFor,facades,initialLayouts,planCuts,projectQuantities:[],URL:{createObjectURL:()=>'',revokeObjectURL(){}},Blob,setTimeout:()=>{},Intl,console});
 vm.runInContext(source.replace(/^import .*;\n/gm,''),context);
 assert.equal($('cut-policy').value,'notched-study');assert.equal(events.at(-1).cutPolicy,'notched-study');
 assert(!Object.hasOwn(events.at(-1),'rectanglePartitionAccounting'));
 assert.match($('layout-metrics').innerHTML,/прямокутні габарити/);
 for(const id of ['csv-export','saw-export','offcut-export'])$(''+id).listeners.click();
 assert.equal(downloads.length,0);assert.match($('engineering-status').textContent,/упаковка габаритів/);
 vm.runInContext('globalThis.report={layout,packing};',context);
 assert.equal(context.report.packing.geometryBasis,'bounding-rectangular-blanks-only');
 assert.equal(context.report.packing.internalCutOperationsVerified,false);
 $('cut-policy').value='split';$('cut-policy').listeners.change();
 assert.equal(events.at(-1).cutPolicy,undefined);assert(events.at(-1).localJointTopology);
});
