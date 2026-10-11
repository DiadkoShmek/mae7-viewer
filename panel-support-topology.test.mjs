import test from 'node:test';
import assert from 'node:assert/strict';
import {planPanelSupportTopology} from './panel-support-topology.js';
import {subtractRect} from './engineering.js';
import {layoutFor,initialLayouts} from './facade-layouts.js';
import {studyLocalJoints} from './panel-local-joints.js';

const area=r=>r.width*r.height;
const overlap=(a,b)=>Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)+1e-8&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y)+1e-8;
const bind=(layout,bands)=>({...layout,localJointTopology:{generatedFrom:{width:layout.width,height:layout.height,cuts:[...layout.cuts],levels:[...layout.levels],openings:layout.openings.map(({id,x,y,width,height})=>({id:id??null,x,y,width,height}))},bands}});
const baseline=code=>layoutFor(code,{...initialLayouts[code],localJoints:'none'});
const base={width:12000,height:1200,cuts:Array.from({length:11},(_,i)=>i*1200),levels:[0,600,1200],openings:[]};
// Independent area of strips minus the UNION of openings, by horizontal sweep.
function stripArea(strip,holes){
 const ys=[strip.y,strip.y+strip.height,...holes.flatMap(h=>[Math.max(strip.y,h.y),Math.min(strip.y+strip.height,h.y+h.height)])].filter(y=>y>=strip.y&&y<=strip.y+strip.height).sort((a,b)=>a-b);
 let covered=0;
 for(let i=1;i<ys.length;i++){
  const y=(ys[i-1]+ys[i])/2,spans=holes.filter(h=>h.y<y&&h.y+h.height>y).map(h=>[Math.max(strip.x,h.x),Math.min(strip.x+strip.width,h.x+h.width)]).filter(([a,b])=>a<b).sort((a,b)=>a[0]-b[0]);
  let end=strip.x,width=0;for(const [a,b] of spans){if(b>end){width+=b-Math.max(a,end);end=b;}}
  covered+=width*(ys[i]-ys[i-1]);
 }
 return area(strip)-covered;
}
function verify(plan,layout){
 for(const b of plan.support.bands){
  for(const cut of b.cuts)assert.ok(b.axes.includes(cut),'every active seam has an axis');
  for(let i=1;i<b.axes.length;i++)assert.ok(b.axes[i]-b.axes[i-1]>=100-1e-8&&b.axes[i]-b.axes[i-1]<=420+1e-8);
 }
 for(const [rectangles,width] of [[plan.battens,100],[plan.tape,90]]){
  for(let i=0;i<rectangles.length;i++){
   const r=rectangles[i];assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=layout.width+1e-8&&r.y+r.height<=layout.height);
   for(const h of layout.openings)assert.equal(overlap(r,h),false,'aperture stays empty');
   for(let j=0;j<i;j++)assert.equal(overlap(r,rectangles[j]),false,'no positive duplicate geometry');
  }
  const expected=plan.segments.reduce((sum,s)=>{
   const x=Math.max(0,s.axis-width/2),right=Math.min(layout.width,s.axis+width/2);
   return sum+stripArea({x,y:s.y,width:right-x,height:s.height},layout.openings);
  },0);
  assert.ok(Math.abs(rectangles.reduce((sum,r)=>sum+area(r),0)-expected)<1e-5,'wood/tape area equals independent aperture-union complement');
 }
 assert.equal(plan.support.validationScope,'geometry-only');assert.equal(plan.support.approved,false);assert.equal(plan.approved,false);
}

test('global fallback exactly preserves existing candidate strips on all four facades',()=>{
 for(const code of Object.keys(initialLayouts)){
  const layout=baseline(code),plan=planPanelSupportTopology(layout),axes=[0];
  for(let i=1;i<layout.cuts.length;i++){
   const from=layout.cuts[i-1],to=layout.cuts[i],count=Math.ceil((to-from)/420);
   for(let n=1;n<=count;n++)axes.push(n===count?to:from+(to-from)*n/count);
  }
  let wall=[{x:0,y:0,width:layout.width,height:layout.height}];for(const h of layout.openings)wall=wall.flatMap(r=>subtractRect(r,h));
  const previous=width=>axes.flatMap(axis=>{
   const left=Math.max(0,axis-width/2),right=Math.min(layout.width,axis+width/2);
   return wall.flatMap(r=>{const x=Math.max(left,r.x),y=Math.max(0,r.y),hi=Math.min(right,r.x+r.width),top=Math.min(layout.height,r.y+r.height);return hi>x&&top>y?[{x,y,width:hi-x,height:top-y}]:[];});
  });
  assert.deepEqual(plan.support.axes,axes);assert.deepEqual(plan.battens,previous(100));assert.deepEqual(plan.tape,previous(90));
  verify(plan,layout);
 }
});

test('48mm global union fails; separate row phases produce disjoint real support rectangles',()=>{
 const shifted=base.cuts.map(x=>x===9600?9648:x);
 const union=[...new Set([...base.cuts,...shifted])].sort((a,b)=>a-b);
 assert.throws(()=>planPanelSupportTopology({...base,cuts:union}),e=>e.code==='PANEL_SUPPORT_AXIS_OVERLAP'&&e.from===9600&&e.to===9648);
 const layout=bind(base,[{y:0,height:600,cuts:base.cuts},{y:600,height:600,cuts:shifted}]),snapshot=structuredClone(layout),plan=planPanelSupportTopology(layout);
 assert.equal(plan.support.axes,null,'no misleading full-height axis union');
 assert.ok(plan.segments.some(s=>s.axis===9600&&s.y===0&&s.height===600));
 assert.ok(plan.segments.some(s=>s.axis===9648&&s.y===600&&s.height===600));
 assert.ok(!plan.segments.some(s=>s.axis===9600&&s.y===600));
 const continuous=plan.segments.find(s=>s.axis===4800);
 assert.deepEqual(continuous.sourceBandIds,[0,1]);assert.equal(continuous.height,1200,'unchanged axes remain continuous, without artificial row butt ends');
 assert.ok(plan.battens.some(r=>r.x===4750&&r.y===0&&r.width===100&&r.height===1200));
 verify(plan,layout);assert.deepEqual(layout,snapshot,'input topology and opening records are immutable');
});

test('overlapping apertures, band-boundary openings and exterior-clipped openings leave no wood or EPDM inside',()=>{
 const layout=bind({...base,openings:[{x:9560,y:280,width:140,height:700},{x:9590,y:530,width:190,height:470},{x:-50,y:-70,width:180,height:190},{x:11970,y:1050,width:120,height:210}]},
  [{y:0,height:600,cuts:base.cuts},{y:600,height:600,cuts:base.cuts.map(x=>x===9600?9648:x)}]);
 verify(planPanelSupportTopology(layout),layout);
});

test('stale topology and an impossible reference grid cannot bypass guards',()=>{
 const layout=bind(base,[{y:0,height:1200,cuts:base.cuts}]);
 for(const changed of [{...layout,width:12100},{...layout,height:1201},{...layout,levels:[0,590,1200]},{...layout,openings:[{id:'NEW',x:1100,y:100,width:600,height:400}]},
  {...layout,cuts:[0,1200,2400,3600,4800,6000,7200,8400,9648,10800,12000]}])assert.throws(()=>planPanelSupportTopology(changed),/Stale|Invalid/);
 assert.throws(()=>planPanelSupportTopology({...layout,cuts:[0,30,...base.cuts.slice(1)]}),/100 mm timber would overlap/);
 assert.throws(()=>planPanelSupportTopology({...base,localJointTopology:{bands:layout.localJointTopology.bands}}),/unbound/);
});

test('nonfinite, missing, overlapping or unordered bands and sub-100 axes fail explicitly',()=>{
 const badBands=[[],[{y:0,height:599,cuts:base.cuts},{y:600,height:600,cuts:base.cuts}],
  [{y:0,height:601,cuts:base.cuts},{y:600,height:600,cuts:base.cuts}],
  [{y:600,height:600,cuts:base.cuts},{y:0,height:600,cuts:base.cuts}],
  [{y:0,height:Infinity,cuts:base.cuts}],[{y:0,height:1199,cuts:base.cuts}],
  [{y:0,height:1200,cuts:[0,99,...base.cuts.slice(1)]}], // finished91mm may pass50 filter, but its100mm rails overlap
  [{y:0,height:1200,cuts:[0,NaN,12000]}],[{y:0,height:1200,cuts:[0,1200,1100,12000]}]];
 for(const bands of badBands)assert.throws(()=>planPanelSupportTopology(bind(base,bands)));
 assert.throws(()=>planPanelSupportTopology({...base,openings:[{x:0,y:0,width:NaN,height:2}]}),/rectangle/);
 assert.throws(()=>planPanelSupportTopology({...base,width:Infinity}),/dimensions/);
 assert.throws(()=>planPanelSupportTopology({width:1e308,height:1200,cuts:[0,1e308],openings:[]}),/capacity/);
});

test('actual local rectangle candidates have finite aperture-free supports on every facade',()=>{
 for(const facade of Object.keys(initialLayouts)){
  const base=baseline(facade),study=studyLocalJoints(base,{model:'best'});
  const layout={...base,localJoints:'best',parts:study.parts,localJointTopology:study.localJointTopology},plan=planPanelSupportTopology(layout);
  verify(plan,layout);
  assert.equal(plan.support.phase,'per-y-band');assert.deepEqual(plan.support.referenceCuts,base.cuts);
  assert.ok(plan.support.rfi.some(note=>note.includes('Т-стики')));
  const snapshot=structuredClone(layout);snapshot.openings[0].x++;
  assert.throws(()=>planPanelSupportTopology(snapshot),/Stale/);
 }
});
