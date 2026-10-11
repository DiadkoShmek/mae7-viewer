import {variants,screenOffsets} from './engineering.js';
import {facades,layoutFor} from './facade-layouts.js';
import {gableLayout} from './gables.js';
import {planCuts} from './cut-planner.js';
import {manufacturingPlan} from './manufacturing-plan.js';
import {packingAreaAccounting} from './cut-area-accounting.js';

const offsetCache=new Map();
export function candidateOffsets(variant='E'){
 const v=variants.find(v=>v.id===variant);if(!v)throw Error('Unknown variant');
 if(v.fixedOffset!==undefined)return Object.fromEntries(Object.keys(facades).map(code=>[code,v.fixedOffset]));
 if(!offsetCache.has(variant))offsetCache.set(variant,Object.fromEntries(Object.entries(facades).map(([code,f])=>[code,screenOffsets(v.module,{...f,facade:code}).offset])));
 return {...offsetCache.get(variant)};
}
function separatePlan(layouts,stock){
 const plans=layouts.map(l=>{const p=planCuts(l.parts,stock);return {...p,sheets:p.sheets.map(s=>({...s,id:l.facade+'-'+s.id}))};});
 const sheets=plans.flatMap(p=>p.sheets),rejected=plans.flatMap(p=>p.rejected),placedArea=plans.reduce((a,p)=>a+p.placedArea,0),stockArea=plans.reduce((a,p)=>a+p.stockArea,0);
 return {stock,sheets,rejected,placedArea,stockArea,utilization:stockArea?placedArea/stockArea:0,unallocatedArea:stockArea-placedArea};
}
// A valid combined candidate is compared against the same parts/stock packed
// separately. Keep the better candidate; no claim of optimality or procurement.
export function buildHouseReport({variant='E',kerf=3,trim=0,stockWidth,stockHeight,includeGables=true,offsets,panelHeight}={}){
 const v=variants.find(v=>v.id===variant);if(!v)throw Error('Unknown variant');
 if(typeof includeGables!=='boolean')throw Error('Invalid gable selection');
 const shifts=offsets||candidateOffsets(variant),stock={width:stockWidth??v.stock,height:stockHeight??v.stockHeight??3050,kerf,trim};
 const finishedPanelHeight=panelHeight??v.panelHeight??0;
 if(v.fixedOffset!==undefined&&Object.values(shifts).some(offset=>offset!==v.fixedOffset))throw Error('Left-to-right mounting starts with a full board; shifted grids require another variant');
 const layouts=Object.keys(facades).map(code=>{if(!Number.isInteger(shifts[code]))throw Error('Missing facade offset');return layoutFor(code,{module:v.module,offset:shifts[code],panelHeight:finishedPanelHeight});});
 if(includeGables)for(const code of ['SW','NE'])if(!layouts.find(l=>l.facade===code)?.fullEndWall)layouts.push(gableLayout(code,v.module,shifts[code],{panelHeight:finishedPanelHeight}));
 const parts=layouts.flatMap(l=>l.parts),separate=separatePlan(layouts,stock),combined=planCuts(parts,stock);
 const packed=combined.rejected.length<separate.rejected.length||combined.rejected.length===separate.rejected.length&&combined.sheets.length<=separate.sheets.length?combined:separate;
 const finishedArea=layouts.reduce((a,l)=>a+l.area,0),blankArea=parts.reduce((a,p)=>a+p.width*p.height,0)/1e6;
 const manufacturing=manufacturingPlan(packed,parts);
 return {project:'Mäe tn 7, Alu',source:'P-8/8/22 PP v04 / nominal candidate',approved:false,surveyVerified:false,readyToCut:false,variant:v,offsets:shifts,layouts,parts,packing:packed,
  manufacturing,profileMarking:manufacturing.profileMarking,areaAccounting:packingAreaAccounting(packed),
  summary:{parts:parts.length,finishedArea,blankArea,profileRemovalArea:blankArea-finishedArea,separateSheets:separate.sheets.length,combinedCandidateSheets:combined.sheets.length,selectedSheets:packed.sheets.length,sheetsSaved:separate.sheets.length-packed.sheets.length,rejected:packed.rejected.length,geometricConflictParts:parts.filter(p=>p.warnings.length&&p.facade.length===2).length,profileReviewParts:parts.filter(p=>p.points).length,rectangularCuts:manufacturing.rectangularCuts.length,profileMarkingLines:manufacturing.profileMarking.length,utilization:packed.utilization,unallocatedArea:packed.unallocatedArea/1e6},
  scope:'4 main rectangular walls and optionally 2 gables. No plinth, reveals, balcony guards, entrance side walls, soffits or roof cover.',
  limits:['Same-colour panels only; vertical grain; no 90-degree rotation','Nominal stock/kerf/trim; not a supplier order','Gables packed as rectangular blanks; angled profiling is a separate operation','Heuristic alternatives, not optimality proof; survey/support/holes/movement/fire unresolved']};
}
