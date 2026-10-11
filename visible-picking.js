// Pick only visible surfaces. Static batches delegate to exact source geometry.
// Hidden source meshes and distant inspection context never enter the raycast.
export function visiblePickTargets(roots){
 const targets=[];const seen=new Set();
 for(const root of roots){if(!root?.visible)continue;root.traverseVisible(o=>{
  if(o.isMesh&&!o.userData.inspectionContext&&!seen.has(o)){seen.add(o);targets.push(o);}
 });}return targets;
}
