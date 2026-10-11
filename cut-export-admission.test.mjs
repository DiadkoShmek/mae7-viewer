import test from 'node:test';
import assert from 'node:assert/strict';
import {localJointCutHold,houseLocalJointCutHold} from './cut-export-admission.js';
import {layoutFor,initialLayouts} from './facade-layouts.js';
import {planPanelSupportTopology} from './panel-support-topology.js';
import {planFacadeSystem} from './facade-system.js';
import {planWindowDetail} from './window-detail.js';
test('zero dimension warnings cannot silently release changed aperture supports',()=>{
 const layout={warningParts:[],validity:{valid:true},localJointTopology:{patches:[{model:'patch-retile'}],approved:false}};
 assert(localJointCutHold(layout));assert(houseLocalJointCutHold({layouts:[{},layout]}));
 assert(localJointCutHold({...layout,localJointTopology:{...layout.localJointTopology,approval:true}}),'wrong approval key cannot release exports');
 assert.equal(localJointCutHold({localJointTopology:{patches:[{model:'fixed-grid'}],approved:false}}),null);
 assert.equal(localJointCutHold({}),null);
});
test('actual moved facade cannot lose its topology and fall back to old supports or cutting admission',()=>{
 const good=layoutFor('SE',initialLayouts.SE);
 assert(good.parts.some(p=>p.localPatchId));
 const opening=good.openings[0],centre={x:opening.x+opening.width/2,y:opening.y+opening.height/2};
 for(const mutate of [
  l=>delete l.localJointTopology,
  l=>l.localJointTopology.patches=[],
  l=>l.localJointTopology.patches[0].id='wrong',
  l=>l.localJointPlan.changedPatches++,
  l=>l.localJoints='none'
 ]){
  const stale=structuredClone(good);mutate(stale);
  assert(localJointCutHold(stale));assert(houseLocalJointCutHold({layouts:[stale]}));
  assert.throws(()=>planPanelSupportTopology(stale),/topology/);
  assert.throws(()=>planFacadeSystem('SE',{layout:stale,supportAlignment:'panel-joints'}),/topology/);
  assert.throws(()=>planWindowDetail({surroundingLayout:{layout:stale,centre}}),/topology/);
 }
 const forged=structuredClone(good);forged.localJointTopology.approved=true;
 assert(localJointCutHold(forged),'a boolean cannot substitute for a source-bound human approval mechanism');
 const restored=layoutFor('SE',{...initialLayouts.SE,localJoints:'none'});
 assert.equal(localJointCutHold(restored),null);
 assert.equal(planFacadeSystem('SE',{layout:restored,supportAlignment:'panel-joints'}).support.phase,'per-panel-span');
});
