import test from 'node:test';
import assert from 'node:assert/strict';
import {placeDimensionLabels} from './dimension-label-layout.js';
test('compact facade chains stay distinct, on screen and bound to their anchors',()=>{
 const boxes=placeDimensionLabels([0,1,2].map(i=>({id:i,x:295,y:180+i*15,width:68,height:24})),320,480);
 for(const b of boxes)assert(b.left>=8&&b.left+b.width<=312&&b.top>=8&&b.top+b.height<=472);
 for(let i=1;i<boxes.length;i++)assert(boxes[i].top>=boxes[i-1].top+boxes[i-1].height+4);
 assert.deepEqual(boxes.map(b=>b.id),[0,1,2]);assert.equal(boxes[1].y,195);
});
test('a chain near the lower edge moves upward without losing any association',()=>{
 const boxes=placeDimensionLabels([0,1,2].map(i=>({id:i,x:250,y:450+i*15,width:68,height:24})),320,480);
 assert.equal(boxes.length,3);for(const box of boxes){assert(box.top>=8&&box.top+24<=472);assert.equal(box.y,450+box.id*15);}const sorted=[...boxes].sort((a,b)=>a.top-b.top);for(let i=1;i<sorted.length;i++)assert(sorted[i].top>=sorted[i-1].top+28);
});
import {clippedDimensionSegment,dimensionAnchorVisible} from './dimension-label-layout.js';
const intersects=(a,b)=>a.left<b.left+b.width&&a.left+a.width>b.left&&a.top<b.top+b.height&&a.top+a.height>b.top;
function verify(boxes,w,h,obstacles=[]){for(const b of boxes){assert(b.left>=8&&b.left+b.width<=w-8&&b.top>=8&&b.top+b.height<=h-8);assert(!obstacles.some(a=>intersects(a,b)));}for(let i=0;i<boxes.length;i++)assert(!boxes.slice(i+1).some(b=>intersects(boxes[i],b)));}
test('overfull phone chain chooses a bounded subset instead of clamping labels into overlap',()=>{
 const items=Array.from({length:16},(_,id)=>({id,x:10,y:200,width:180,height:28,priority:id===15?2:0}));
 const boxes=placeDimensionLabels(items,240,422);verify(boxes,240,422);assert(boxes.length<16);assert(boxes.some(b=>b.id===15));assert.equal(new Set(boxes.map(b=>b.id)).size,boxes.length);
 assert.deepEqual(boxes,placeDimensionLabels(items,240,422));
 assert.equal(placeDimensionLabels([{x:0,y:0,width:400,height:24}],240,422).length,0);
});
test('crowded source overlays avoid controls and retain associations over phone, tablet and desktop sizes',()=>{
 for(const [w,h] of [[240,422],[320,380],[480,844],[768,600],[2196,1352]]){
  const obstacles=[{left:14,top:h-240,width:Math.min(330,w-28),height:160},{left:w-60,top:14,width:46,height:242}];
  const items=Array.from({length:25},(_,id)=>({id,x:(id*43)%w,y:(id*19)%h,width:70+id%3*24,height:28,priority:id%4===0?2:0}));
  const boxes=placeDimensionLabels(items,w,h,{obstacles});verify(boxes,w,h,obstacles);assert(boxes.every(b=>items[b.id].x===b.x&&items[b.id].y===b.y));
 }
});
test('near/far and edge-on projections are rejected; clipped shafts do not invent endpoint arrows',()=>{
 const a={x:-50,y:100,z:0},b={x:400,y:100,z:0},clip=clippedDimensionSegment(a,b,320,480);
 assert.deepEqual(clip,{x1:0,y1:100,x2:320,y2:100,arrowStart:false,arrowEnd:false});
 assert.deepEqual(clippedDimensionSegment({...a,x:10},{...b,x:200},320,480),{x1:10,y1:100,x2:200,y2:100,arrowStart:true,arrowEnd:true});
 for(const z of [-1.01,1.01,NaN,Infinity])assert.equal(clippedDimensionSegment({...a,z},b,320,480),null);
 assert.equal(clippedDimensionSegment({x:50,y:50,z:0},{x:51,y:51,z:0},320,480),null);
 assert.equal(clippedDimensionSegment({x:0,y:-20,z:0},{x:320,y:-20,z:0},320,480),null);
 assert(!dimensionAnchorVisible({x:100,y:100,z:-1.01},320,480));
});
