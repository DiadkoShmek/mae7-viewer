// Missing derived topology cannot turn a moved facade back into the old grid.
export function hasLocalJointChanges(layout){
 return (layout?.localJointPlan?.changedPatches??0)>0
  ||layout?.parts?.some(p=>p.localPatchId)
  ||layout?.localJointTopology?.patches?.some(p=>p.model!=='fixed-grid');
}
export function assertLocalJointDeclaration(layout){
 if(!hasLocalJointChanges(layout))return;
 const t=layout.localJointTopology,patches=t?.patches?.filter(p=>p.model!=='fixed-grid');
 if(!Array.isArray(t?.bands)||!t.bands.length||!patches?.length||layout.localJoints==='none')throw Error('Moved local panels require their declared support topology');
 const ids=new Set(patches.map(p=>p.id));
 if(ids.size!==patches.length||ids.has(undefined)||layout.parts?.some(p=>p.localPatchId&&!ids.has(p.localPatchId))
  ||layout.localJointPlan?.changedPatches!==undefined&&layout.localJointPlan.changedPatches!==patches.length)throw Error('Local panels and support topology declarations disagree');
}
