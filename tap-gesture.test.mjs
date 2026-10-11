import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {OrbitControls} from './assets/OrbitControls.js';
import {createTapGesture} from './tap-gesture.js';

const pointer=(pointerId,x=100,y=180,extra={})=>({pointerId,clientX:x,clientY:y,button:0,isPrimary:pointerId===1,pointerType:'touch',...extra});

test('pinch suppresses both lifts in either order, then permits a new tap',()=>{
 for(const order of [[1,2],[2,1]])for(const drag of [false,true]){
  const gate=createTapGesture();gate.down(pointer(1));gate.down(pointer(2,220));if(drag)gate.move(pointer(1,80));
  for(const id of order)assert.equal(gate.up(pointer(id,id===1?(drag?80:100):220)),false);
  gate.down(pointer(1));assert.equal(gate.up(pointer(1)),true);
 }
});

test('drag stays suppressed after returning and through threshold-edge moves',()=>{
 const gate=createTapGesture();gate.down(pointer(1));gate.move(pointer(1,120));gate.move(pointer(1));assert.equal(gate.up(pointer(1)),false);
 gate.down(pointer(1));gate.move(pointer(1,107));assert.equal(gate.up(pointer(1,107)),true,'Exactly 7px is the existing tap tolerance');
 gate.down(pointer(1));assert.equal(gate.up(pointer(1,107.001)),false,'Release displacement counts even without a move event');
});

test('cancellation cleans up without admitting remaining or stale pointers',()=>{
 const gate=createTapGesture();gate.down(pointer(1));gate.down(pointer(2,220));gate.cancel({pointerId:1});assert.equal(gate.up(pointer(2,220)),false);assert.equal(gate.up(pointer(1)),false);
 gate.down(pointer(1));gate.cancel({pointerId:1});assert.equal(gate.up(pointer(1)),false);
 gate.down(pointer(1));assert.equal(gate.up(pointer(1)),true);
 gate.down(pointer(1));gate.down(pointer(2,220));gate.up(pointer(1));gate.down(pointer(3,300));gate.cancel({pointerId:2});assert.equal(gate.up(pointer(3,300)),false,'Replacing a finger does not restart the suppressed gesture');
 gate.down(pointer(1));assert.equal(gate.up(pointer(1)),true);
});

test('mouse click and primary touch tap work; secondary clicks and stray ups do not',()=>{
 const gate=createTapGesture(),mouse=pointer(7,100,180,{pointerType:'mouse',isPrimary:true});
 assert.equal(gate.up(mouse),false);gate.down(mouse);assert.equal(gate.up(mouse),true);assert.equal(gate.up(mouse),false);
 gate.down({...mouse,button:2});assert.equal(gate.up({...mouse,button:2}),false);
 gate.down(pointer(2));assert.equal(gate.up(pointer(2)),false,'A secondary touch alone cannot be a primary tap');
 gate.down(pointer(1));gate.down(pointer(1));assert.equal(gate.up(pointer(1)),false,'Duplicate downs do not replace the starting point');
});

test('invalid coordinates reject safely and reset can abandon a lost pointer',()=>{
 for(const threshold of [NaN,Infinity,-1])assert.throws(()=>createTapGesture({threshold}));
 const gate=createTapGesture();gate.down(pointer(1,NaN));assert.equal(gate.up(pointer(1)),false);
 gate.down(pointer(1));gate.move(pointer(1,Infinity));assert.equal(gate.up(pointer(1)),false);
 gate.down(pointer(1));gate.reset();assert.equal(gate.up(pointer(1)),false);gate.down(pointer(1));assert.equal(gate.up(pointer(1)),true);
});

test('live app canvas gate blocks pinch picking and retains a clean mouse selection',async()=>{
 const source=await readFile(new URL('./app.js',import.meta.url),'utf8'),start=source.indexOf('  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2()'),end=source.indexOf("  renderer.domElement.addEventListener('webglcontextlost'",start);
 assert(start>=0&&end>start);assert.match(source,/import \{createTapGesture\} from '\.\/tap-gesture\.js';/);
 const handlers=new Map(),calls=[];
 const ctx=vm.createContext({createTapGesture,THREE:{Raycaster:class{setFromCamera(){calls.push('pick');}intersectObjects(){return[{object:{visible:true,parent:null}}];}},Vector2:class{set(){}}},renderer:{domElement:{addEventListener:(kind,handler)=>handlers.set(kind,handler),getBoundingClientRect:()=>({left:0,top:0,width:390,height:500})}},camera:{},building:{children:[]},patch:{children:[]},fieldPatch:{children:[]},mode:'building',nativeLayerRecord:()=>({system:'roof',layer:1}),setMode:(next)=>calls.push(next),selectLayer(){}});
 vm.runInContext(source.slice(start,end),ctx);
 for(const order of [[1,2],[2,1]]){
  handlers.get('pointerdown')(pointer(1));handlers.get('pointerdown')(pointer(2,220));handlers.get('pointermove')(pointer(1,80));
  for(const id of order)handlers.get('pointerup')(pointer(id,id===1?80:220));assert.deepEqual(calls,[]);
 }
 handlers.get('pointerdown')(pointer(1));handlers.get('pointermove')(pointer(1,140));handlers.get('pointermove')(pointer(1));handlers.get('pointerup')(pointer(1));assert.deepEqual(calls,[]);
 handlers.get('pointerdown')(pointer(1));handlers.get('pointercancel')({pointerId:1});handlers.get('pointerup')(pointer(1));assert.deepEqual(calls,[]);
 const mouse=pointer(7,100,180,{pointerType:'mouse',isPrimary:true});handlers.get('pointerdown')(mouse);handlers.get('pointerup')(mouse);assert.deepEqual(calls,['pick','roof'],'Existing selection runs only after an eligible tap');
});

test('actual OrbitControls 0.180.0 capture loss cleans up only its pointer and normal release stays single',async()=>{
 const source=await readFile(new URL('./app.js',import.meta.url),'utf8'),start=source.indexOf('  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2()'),end=source.indexOf("  renderer.domElement.addEventListener('webglcontextlost'",start);
 const version=JSON.parse(await readFile(new URL('../node_modules/three/package.json',import.meta.url),'utf8')).version;assert.equal(version,'0.180.0','Review the local capture-loss patch when upgrading Three');
 function harness(){
  const listeners=new Map(),active=new Set(),captured=new Set(),calls=[],cancels=[];
  const add=(type,fn,options)=>{const list=listeners.get(type)||[],capture=options===true||options?.capture===true;if(!list.some(r=>r.fn===fn&&r.capture===capture))list.push({fn,capture});listeners.set(type,list);};
  const remove=(type,fn)=>listeners.set(type,(listeners.get(type)||[]).filter(r=>r.fn!==fn));
  const root={addEventListener(){},removeEventListener(){}};
  const dom={style:{},clientWidth:390,clientHeight:500,addEventListener:add,removeEventListener:remove,getRootNode:()=>root,getBoundingClientRect:()=>({left:0,top:0,width:390,height:500}),
   setPointerCapture(id){if(!active.has(id))throw Object.assign(Error('Inactive pointer'),{name:'NotFoundError'});captured.add(id);},
   hasPointerCapture:id=>captured.has(id),
   releasePointerCapture(id){if(!active.has(id))throw Object.assign(Error('Inactive pointer'),{name:'NotFoundError'});if(captured.delete(id))dispatch('lostpointercapture',{pointerId:id});},
   dispatchEvent(event){dispatch(event.type,event);return true;}
  };
  const camera=new THREE.PerspectiveCamera(36,390/500,.1,450);camera.position.set(0,3,10);
  const controls=new OrbitControls(camera,dom);let ends=0;controls.addEventListener('end',()=>ends++);
  class PointerEventStub{constructor(type,init){Object.assign(this,{type,button:0,clientX:0,clientY:0,pageX:0,pageY:0,preventDefault(){}},init);}}
  vm.runInContext(source.slice(start,end),vm.createContext({createTapGesture,PointerEvent:PointerEventStub,THREE:{...THREE,Raycaster:class{setFromCamera(){calls.push('pick');}intersectObjects(){return[{object:{visible:true,parent:null}}];}}},renderer:{domElement:dom},camera,building:{children:[]},patch:{children:[]},fieldPatch:{children:[]},mode:'building',nativeLayerRecord:()=>({system:'roof',layer:1}),setMode:next=>calls.push(next),selectLayer(){}}));
  function dispatch(type,event){
   const e={...event,type,preventDefault(){}};
   if(type==='pointerdown'){active.add(e.pointerId);if(e.pointerType==='touch')captured.add(e.pointerId);}
   if(type==='pointercancel')cancels.push(e.pointerId);
   // Target capture listeners precede target bubble listeners, including the
   // app gate registered after OrbitControls' permanent cancel listener.
   const list=[...(listeners.get(type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture));
   for(const r of list)if((listeners.get(type)||[]).includes(r))r.fn(e);
   if(type==='pointerup'||type==='pointercancel'){active.delete(e.pointerId);if(captured.delete(e.pointerId))dispatch('lostpointercapture',e);}
  }
  return {dispatch,calls,cancels,controls,ends:()=>ends,listenerCount:type=>(listeners.get(type)||[]).length,lose(id,{retired=false}={}){captured.delete(id);if(retired)active.delete(id);dispatch('lostpointercapture',{pointerId:id,pointerType:'touch'});}};
 }
 const p=(id,x=100,isPrimary=true)=>({...pointer(id,x,180,{isPrimary}),pageX:x,pageY:180});
 const normal=harness();normal.dispatch('pointerdown',p(1));normal.dispatch('pointerup',p(1));assert.deepEqual(normal.calls,['pick','roof']);assert.equal(normal.ends(),1);assert.deepEqual(normal.cancels,[],'Normal release must not forward a duplicate cancellation');
 assert.deepEqual(normal.controls._pointers,[]);assert.equal(normal.listenerCount('pointermove'),1);assert.equal(normal.listenerCount('pointerup'),1);
 const cancelled=harness();cancelled.dispatch('pointerdown',p(1));cancelled.dispatch('pointercancel',p(1));assert.deepEqual(cancelled.calls,[]);assert.equal(cancelled.ends(),1);assert.deepEqual(cancelled.cancels,[1],'Capture phase cancels gate before controls releases capture');
 const lost=harness();lost.dispatch('pointerdown',p(1));lost.lose(1,{retired:true});assert.deepEqual(lost.cancels,[1]);assert.equal(lost.ends(),1);assert.deepEqual(lost.controls._pointers,[],'An inactive lost pointer cannot leave stale controls or throw NotFoundError');assert.equal(lost.listenerCount('pointermove'),1);assert.equal(lost.listenerCount('pointerup'),1);
 lost.dispatch('pointerup',p(1));assert.deepEqual(lost.calls,[]);lost.dispatch('pointerdown',p(5));lost.dispatch('pointerup',p(5));assert.deepEqual(lost.calls,['pick','roof'],'A fresh gesture after outside release is usable');
 const held=harness();held.dispatch('pointerdown',p(1));held.dispatch('pointerdown',p(2,220,false));held.lose(1);assert.deepEqual(held.controls._pointers,[2],'Loss cancels one control pointer, preserving the held finger');
 held.dispatch('pointerdown',p(3,260,false));held.dispatch('pointermove',p(3,280,false));held.dispatch('pointerup',p(2,220,false));held.dispatch('pointerup',p(3,280,false));assert.deepEqual(held.calls,[],'Cancellation and newdown remain sticky through all held fingers');assert.deepEqual(held.controls._pointers,[]);assert.equal(held.ends(),1);
 held.dispatch('pointerdown',p(4));held.dispatch('pointerup',p(4));assert.deepEqual(held.calls,['pick','roof']);
});
