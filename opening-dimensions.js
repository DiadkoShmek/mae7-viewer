import {facades} from './facade-layouts.js';

// Bind the actual façade window assembly, including the declared balcony
// door/window aliases. Inspection copies and basement-only openings do not
// inherit the main façade schedule.
export function resolveOpeningDimensions(metadata,faces=facades){
 const id=metadata?.windowId,profile=metadata?.windowProfilePlan,aperture=metadata?.aperture;
 if(metadata?.component?.kind!=='window'||typeof id!=='string'||metadata.approved!==false||
  !profile||profile.windowId!==id||profile.inspectionRepresentation!==false||metadata.fieldCandidate||
  metadata.inspectionRepresentation||metadata.sourceOpeningId!==id||!aperture||
  ![aperture.width,aperture.height].every(n=>Number.isFinite(n)&&n>0))return null;
 let sourceId=id;
 if(metadata.assemblyId){
  const role=metadata.componentRole;
  if(!['door','window'].includes(role)||id!==metadata.assemblyId+'-'+role.toUpperCase())return null;
  sourceId=metadata.assemblyId+(role==='door'?'-D':'-W');
 }
 const matches=Object.entries(faces).flatMap(([code,face])=>face.openings.filter(o=>o.id===sourceId).map(opening=>({code,opening})));
 if(matches.length!==1)return null;
 const {code,opening}=matches[0];
 if(Math.round(aperture.width*1000)!==opening.width||Math.round(aperture.height*1000)!==opening.height)return null;
 return {code,opening:structuredClone(opening),nativeWindowId:id,approved:false,measured:false,graphicLevels:true};
}

// The BAL numbering is not the NW opening numbering. Follow the authored
// floor's doorRange, then that door's declared assembly and companion role.
export function resolveBalconyOpeningPair(balcony,floors,windows){
 const id=balcony?.balconyId;
 if(balcony?.component?.kind!=='balcony'||!/^BAL-\d{2}$/.test(id??''))return null;
 const matches=floors.filter(m=>m?.floorAssembly===true&&m.assembly==='balcony-floor'&&m.balconyId===id&&m.approved===false);
 if(matches.length!==1)return null;
 const doorId=matches[0].floorPlan?.doorRange?.id;
 if(typeof doorId!=='string')return null;
 const doors=windows.filter(m=>m.windowId===doorId&&resolveOpeningDimensions(m));
 if(doors.length!==1||doors[0].componentRole!=='door')return null;
 const assembly=doors[0].assemblyId;
 const companions=windows.filter(m=>m.assemblyId===assembly&&m.componentRole==='window'&&resolveOpeningDimensions(m));
 if(companions.length!==1)return null;
 return {door:resolveOpeningDimensions(doors[0]),window:resolveOpeningDimensions(companions[0])};
}
