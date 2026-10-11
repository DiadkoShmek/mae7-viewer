import {MeshBasicMaterial} from 'three';
// A construction view uses the original authored objects. Masking the other
// branches avoids background clutter without cloning, scaling or moving stock.
export function createInspectionStage(root,{context=false,opacity=.12}={}){
 if(!root?.isObject3D)throw Error('Inspection stage needs the native scene');
 if(typeof context!=='boolean'||!Number.isFinite(opacity)||opacity<=0||opacity>=1)throw Error('Invalid inspection context');
 const saved=new Map(),surfaces=new Map(),ghosts=new Map();let targets=[],keep=new Set();
 const remember=o=>{if(!saved.has(o))saved.set(o,o.visible);};
 function restore(){
  for(const [o,visible] of saved)o.visible=visible;
  for(const [o,state] of surfaces){o.material=state.material;o.castShadow=state.castShadow;o.receiveShadow=state.receiveShadow;o.renderOrder=state.renderOrder;if(state.context===undefined)delete o.userData.inspectionContext;else o.userData.inspectionContext=state.context;}
  saved.clear();surfaces.clear();targets=[];keep.clear();
 }
 function ghost(material){
  if(!ghosts.has(material)){
   const m=new MeshBasicMaterial({color:material.color?.clone(),map:material.map??null,alphaMap:material.alphaMap??null,alphaTest:material.alphaTest??0,side:material.side,transparent:true,opacity,depthWrite:false});m.forceSinglePass=true;m.name='inspection_context';
   if('transmission' in m)m.transmission=0;
   m.userData={...m.userData,inspectionContext:true,physical:false,quantityEligible:false};ghosts.set(material,m);
  }return ghosts.get(material);
 }
 function mask(){
  if(!targets.length)return;
  keep=new Set();
  for(const target of targets)for(let o=target;o;o=o.parent){keep.add(o);if(o===root)break;}
  if(context){
   for(const o of keep){remember(o);o.visible=true;}
   root.traverse(o=>{
    if(!o.isMesh)return;
    for(let a=o;a;a=a.parent)if(targets.includes(a))return;
    if(!surfaces.has(o))surfaces.set(o,{material:o.material,castShadow:o.castShadow,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder,context:o.userData.inspectionContext});
    const material=surfaces.get(o).material;o.material=Array.isArray(material)?material.map(ghost):ghost(material);
    o.castShadow=o.receiveShadow=false;o.renderOrder=-1;o.userData.inspectionContext=true;
   });return;
  }
  for(const parent of keep){
   remember(parent);parent.visible=true;
   if(targets.includes(parent))continue;
   for(const child of parent.children){remember(child);child.visible=keep.has(child);}
  }
 }
 return {
  show(next=[]){
   if(!Array.isArray(next)||new Set(next).size!==next.length)throw Error('Unique inspection targets required');
   // Validate before changing any visible flag.
   for(const target of next){let o=target;while(o&&o!==root)o=o.parent;if(o!==root)throw Error('Inspection target outside the native scene');}
   restore();targets=[...next];mask();
  },refresh(){if(context){for(const o of keep)o.visible=true;}else mask();},restore,
  dispose(){restore();for(const m of ghosts.values())m.dispose();ghosts.clear();},
  get targets(){return [...targets];},get active(){return targets.length>0;}
 };
}
