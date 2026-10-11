import test from 'node:test';import assert from 'node:assert/strict';
import {studyLocalJoints} from './panel-local-joints.js';
import {planCuts} from './cut-planner.js';
import {initialLayouts,layoutFor} from './facade-layouts.js';import {makeLayout} from './engineering.js';
const overlap=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
function check(layout,r){
 assert.deepEqual(r.levels,layout.levels);assert.deepEqual(r.cuts,layout.cuts);
 const expected=layout.rectanglePartitionAccounting.nominalMaterialAreaMm2;
 assert.equal(r.nominalRectangles.reduce((s,p)=>s+p.width*p.height,0),expected);
 for(let i=0;i<r.nominalRectangles.length;i++){const p=r.nominalRectangles[i];assert(p.x>=0&&p.y>=0&&p.x+p.width<=layout.width&&p.y+p.height<=layout.height);for(const o of layout.openings)assert(!overlap(p,o));for(let j=0;j<i;j++)assert(!overlap(p,r.nominalRectangles[j]));}
 const finished=r.parts.reduce((s,p)=>s+p.width*p.height,0),consumed=r.jointClearances.reduce((s,c)=>s+c.rectangle.width*c.rectangle.height,0),loss=r.parts.reduce((s,p)=>s+p.nominal.width*p.nominal.height-p.width*p.height,0);
 assert.equal(finished+consumed+loss,expected);assert.equal(finished,r.summary.finishedAreaMm2);assert.equal(consumed,r.summary.consumedNominalAreaMm2);assert.equal(loss,r.summary.jointLossAreaMm2);
 assert.equal(new Set(r.parts.map(p=>p.id)).size,r.parts.length);
 for(const p of r.parts){assert(p.width>0&&p.height>0&&p.width<=1192&&p.height<=1250);assert(Number.isInteger(p.cell));assert.equal(p.x,p.nominal.x+4);assert.equal(p.y,p.nominal.y+4);assert.equal(p.width,p.nominal.width-8);assert.equal(p.height,p.nominal.height-8);for(const o of layout.openings)assert(!overlap(p,{x:o.x-4,y:o.y-4,width:o.width+8,height:o.height+8}));}
 for(let i=0;i<r.parts.length;i++)for(let j=0;j<i;j++){const a=r.parts[i],b=r.parts[j],dx=Math.max(0,a.x-b.x-b.width,b.x-a.x-a.width),dy=Math.max(0,a.y-b.y-b.height,b.y-a.y-a.height);assert(Math.max(dx,dy)>=8);}
 const unchanged=layout.parts.filter(p=>!r.removedPartIds.includes(p.id));for(const p of unchanged)assert.deepEqual(r.parts.find(q=>q.id===p.id),p,'outside patch geometry/style/ID changed');
 const bands=r.localJointTopology.bands;assert.equal(bands[0].y,0);assert.equal(bands.at(-1).y+bands.at(-1).height,layout.height);for(let i=0;i<bands.length;i++){const b=bands[i];assert(b.height>0);assert.equal(b.cuts[0],0);assert.equal(b.cuts.at(-1),layout.width);assert(b.cuts.every((x,j)=>Number.isInteger(x)&&(!j||x>b.cuts[j-1])));if(i)assert.equal(bands[i-1].y+bands[i-1].height,b.y);}
 const openings=layout.openings.map(({id,x,y,width,height})=>({id,x,y,width,height})).sort((a,b)=>String(a.id).localeCompare(String(b.id))||a.x-b.x||a.y-b.y||a.width-b.width||a.height-b.height);
 assert.deepEqual(r.localJointTopology.generatedFrom,{width:layout.width,height:layout.height,cuts:layout.cuts,levels:layout.levels,openings});assert.equal(r.finiteDomainOptimum,false);assert.equal(r.approved,false);assert.equal(r.readyToCut,false);
}
test('actual22 thin jambs replaced by stocklegal rectangles, no concealed material loss',()=>{
 const expected={SE:[424,0,303210176],NW:[385,0,254258600],SW:[80,0,87842884],NE:[80,0,87863564]};let totalParts=0,totalRaw=0,totalFinished=0,totalConsumed=0;
 for(const f of Object.keys(initialLayouts)){const l=layoutFor(f,{...initialLayouts[f],localJoints:'none'}),before=JSON.stringify(l),r=studyLocalJoints(l);assert.equal(JSON.stringify(l),before);check(l,r);assert.deepEqual([r.summary.parts,r.summary.warningParts,r.summary.finishedAreaMm2],expected[f]);assert.equal(r.unmappedThinPartIds.length,0);assert.equal(r.summary.consumedNominalAreaMm2,l.rectanglePartitionAccounting.consumedNominalAreaMm2);
  const patched=r.parts.filter(p=>p.localPatchId);assert(patched.every(p=>p.width>=100&&p.height>=160));assert(patched.every(p=>p.colour==='P222'),'root SVG witness: new593x1250 must not inventP070');for(const p of patched){const old=l.parts.find(q=>q.cell===p.cell&&q.floor===p.floor);assert(old);assert.equal(p.colour,old.colour);}
  totalParts+=r.parts.length;totalRaw+=r.summary.nominalMaterialAreaMm2;totalFinished+=r.summary.finishedAreaMm2;totalConsumed+=r.summary.consumedNominalAreaMm2;
 }
 assert.deepEqual([totalParts,totalRaw,totalFinished,totalConsumed],[969,746401500,733175224,27900]);
});
test('fixed grid is exact baseline, shifted compensation never oversized; source model alternatives honest',()=>{
 for(const f of ['SE','NW','SW']){const l=layoutFor(f,{...initialLayouts[f],localJoints:'none'}),base=studyLocalJoints(l,{model:'fixed-grid'}),b=studyLocalJoints(l,{model:'shift-redistribute'}),c=studyLocalJoints(l,{model:'patch-retile'});check(l,base);check(l,b);check(l,c);assert.deepEqual([...base.parts].sort((a,b)=>a.id.localeCompare(b.id)),[...l.parts].sort((a,b)=>a.id.localeCompare(b.id)));assert.equal(base.removedPartIds.length,0);assert.equal(base.localJointTopology.bands.length,1);
  assert(b.patches.every(p=>p.cuts.includes(p.jamb)&&p.cuts.slice(1).every((x,i)=>x-p.cuts[i]<=1200)));assert(c.patches.every(p=>p.cuts===null));
 }
 const se=studyLocalJoints(layoutFor('SE',{...initialLayouts.SE,localJoints:'none'}));assert.deepEqual(se.groups.map(g=>[g.x0,g.jamb,g.x1]),[[16800,18030,19200],[30000,31240,32400]]);
});
test('all physical internaljoint segments correspond to two actual nominal faces; oldaxis removed locally',()=>{
 const l=layoutFor('SE',{...initialLayouts.SE,localJoints:'none'}),r=studyLocalJoints(l);
 for(const p of r.patches){assert(p.domain.y===l.levels[p.row]&&p.domain.y+p.domain.height===l.levels[p.row+1]);
  for(const s of p.jointSegments){const left=p.nominal.filter(n=>s.axis==='vertical'?n.x+n.width===s.at&&n.y<=s.from&&n.y+n.height>=s.to:n.y+n.height===s.at&&n.x<=s.from&&n.x+n.width>=s.to),right=p.nominal.filter(n=>s.axis==='vertical'?n.x===s.at&&n.y<=s.from&&n.y+n.height>=s.to:n.y===s.at&&n.x<=s.from&&n.x+n.width>=s.to);assert(left.length&&right.length);assert.equal(s.jointMm,8);}
  for(const b of r.localJointTopology.bands.filter(b=>b.y>=p.domain.y&&b.y+b.height<=p.domain.y+p.domain.height))assert(!b.cuts.includes(p.oldCut));
 }
});
test('synthetic overlapping apertures/order reversal; unmodified fullcolumns and residual remain source',()=>{
 const options={facade:'SE',width:3590,height:1258,module:1200,panelHeight:1250,rowLevels:[0,1258],rectanglePartition:'best',accentBands:[],openings:[{id:'a',x:1230,y:240,width:400,height:800},{id:'b',x:1450,y:450,width:500,height:300}]};
 const l=makeLayout(options),r=studyLocalJoints(l),reverse=studyLocalJoints(makeLayout({...options,openings:[...options.openings].reverse()}));check(l,r);assert.deepEqual(r.nominalRectangles,reverse.nominalRectangles);assert.equal(r.summary.warningParts,0);assert(r.parts.filter(p=>p.x>=2404).every(p=>l.parts.some(q=>q.id===p.id&&q.x===p.x&&q.width===p.width)));
 assert.throws(()=>studyLocalJoints({...l,joint:7}));assert.throws(()=>studyLocalJoints(l,{model:'free-curve'}));
 const mixed=makeLayout({facade:'NW',width:3600,height:1258,module:1200,panelHeight:1250,rowLevels:[0,1258],rectanglePartition:'best',accentBands:[[1200,2400]],openings:[{id:'mixed',x:0,y:250,width:1190,height:800}]});assert.throws(()=>studyLocalJoints(mixed),/Ambiguous source cell colour/);
});
test('independent falsifiers reject naïve oversized neighbor, dropped sliver, wronggap and false ledger',()=>{
 const l=layoutFor('SE',{...initialLayouts.SE,localJoints:'none'}),r=studyLocalJoints(l),copy=()=>structuredClone(r);
 let bad=copy();bad.parts[0].width=1222;assert.throws(()=>check(l,bad));
 bad=copy();bad.parts[0].x--;assert.throws(()=>check(l,bad));
 bad=copy();bad.nominalRectangles.pop();assert.throws(()=>check(l,bad));
 bad=copy();bad.summary.consumedNominalAreaMm2=0;assert.throws(()=>check(l,bad));
 bad=copy();bad.parts[0].nominal.width--;assert.throws(()=>check(l,bad));
});

test('stock guard candidate preserves exact coverage but avoids half-stock balanced width penalty',()=>{
 const all=[],balanced=[];
 for(const code of ['SE','NW','SW','NE']){const l=layoutFor(code,{...initialLayouts[code],localJoints:'none'}),left=studyLocalJoints(l),b=studyLocalJoints(l,{stockSplitPolicy:'balanced'});check(l,left);check(l,b);assert.deepEqual(left.summary,b.summary);assert.equal(left.stockSplitPolicy,'full-left-guarded');assert.equal(left.nominalTailGuardMm,300);all.push(...left.parts);balanced.push(...b.parts);}
 const stock={width:1192,height:1250,kerf:3,trim:0};const a=planCuts(all,stock),b=planCuts(balanced,stock);assert.equal(a.rejected.length,0);assert.equal(b.rejected.length,0);assert(a.sheets.length<b.sheets.length);
 const se=studyLocalJoints(layoutFor('SE',{...initialLayouts.SE,localJoints:'none'}));const patch=se.patches.find(p=>p.domain.x===16800&&p.row===1);assert(patch.cuts.includes(17730));assert(!patch.cuts.includes(17415));assert(patch.parts.some(p=>p.width===292));
 assert.throws(()=>studyLocalJoints(layoutFor('SE',{...initialLayouts.SE,localJoints:'none'}),{stockSplitPolicy:'manufacturer-approved'}));
});
