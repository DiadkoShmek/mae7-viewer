import {entranceCentres,entranceSpec} from './entrance.js';
// Exact colour boundaries are separate physical parts with8mm candidate joints.
const tracedSoutheastColourRegions=[{"id":"P070-21828","x":5556,"y":1956,"width":2918,"height":7284,"colour":"P070","source":"PDF53/ark05 fill 21828","dimensionAuthority":"graphic candidate, rounded to1mm; source axes retained","approved":false},{"id":"P070-21791","x":18651,"y":1950,"width":2921,"height":7280,"colour":"P070","source":"PDF53/ark05 fill 21791","dimensionAuthority":"graphic candidate, rounded to1mm; source axes retained","approved":false},{"id":"P070-21754","x":31862,"y":1950,"width":2918,"height":7280,"colour":"P070","source":"PDF53/ark05 fill 21754","dimensionAuthority":"graphic candidate, rounded to1mm; source axes retained","approved":false}];

// User requests a flush edge above the vestibule, replacing only the graphic
// width candidate. Preserve the trace so it remains distinguishable from survey.
export const southeastColourRegions=tracedSoutheastColourRegions.map((r,i)=>({...r,tracedBounds:{x:r.x,y:r.y,width:r.width,height:r.height},x:Math.round((entranceCentres[i]+20.2)*1000-entranceSpec.width*500),width:entranceSpec.width*1000,dimensionAuthority:'user requested alignment with vestibule envelope candidate; original ark05 trace retained; not surveyed',alignmentOwner:'entranceSpec.width/entranceCentres'}));
