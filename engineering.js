import {southeastOpenings} from './source-openings.js';
import {entranceSpec} from './entrance.js';
import {planCuts} from './cut-planner.js';
import {partitionLayout} from './panel-rectangle-partition.js';
import {validateRowLevels} from './panel-row-plans.js';
import {studyLocalJoints} from './panel-local-joints.js';
export const floorLevels=[0,2850,5685,8525];
export const variants=[
 {id:'A',title:'A · зберегти 420',module:840,bays:2,stock:1250,note:'Шов через дві рейкові комірки. Проєктний номінал 420 мм збережений; локальні опори біля прорізів ще розробляються.'},
 {id:'B',title:'B · модуль 1200',module:1200,bays:3,stock:1192,note:'1192 + 8 = 1200; три комірки по 400 мм. Зміна проєктного номіналу 420: потрібне узгодження робочої схеми.'},
 {id:'C',title:'C · модуль 1258',module:1258,bays:3,stock:1250,note:'1250 + 8 = 1258; три комірки близько 419,33 мм. Різницю з 420 не накопичувати; узгодити прив’язку та робочий проєкт.'},
 {id:'D',title:'D · зліва 1200 → залишок справа',module:1208,bays:3,stock:1200,fixedOffset:0,note:'Попередній кандидат: ширина1200 мм, висота за поверхами. Замінено уточненням готової плити1192×1250.'},
 {id:'E',title:'1192×1250 · зліва → справа',module:1200,bays:3,stock:1192,stockHeight:1250,panelHeight:1250,fixedOffset:0,note:'Готова плита1192×1250 мм за уточненням Артура. Шви8 мм; горизонтальний модуль1200, висота деталі≤1250. Зліва повні плити; залишок справа. Біля прорізів локальні шви й опори потребують погодження.'}
];
const entrances=[-13184.6,-88.9,13121.1];
export const seOpenings=[...southeastOpenings.map(o=>({id:o.id,x:Math.round(o.x*1000+20200-o.width*500),y:Math.round(o.y*1000-o.height*500),width:Math.round(o.width*1000),height:Math.round(o.height*1000),kind:o.type,positionStatus:'PDF-вектор',dimensionSource:o.dimensionSource})),...entrances.map((x,i)=>({id:'SE-D'+(i+1),x:Math.round(x+20200-(entranceSpec.doorWidth/2+entranceSpec.openingFit)*1000),y:Math.round((entranceSpec.threshold-entranceSpec.thresholdProfile)*1000),width:Math.round((entranceSpec.doorWidth+2*entranceSpec.openingFit)*1000),height:Math.round((entranceSpec.doorHeight+entranceSpec.thresholdProfile)*1000),kind:'VU01 · двері у головній стіні',positionStatus:'Арк20/27;20мм монтажний зазор і рівень порога — кандидати',dimensionSource:'VU01 2305×2100; арк20 двері у стіні, попереду відкритий майданчик. Отвір2345мм та абсолютні рівні звірити на об’єкті'}))];
export function subtractRect(r,h){
 const x=Math.max(r.x,h.x),y=Math.max(r.y,h.y),right=Math.min(r.x+r.width,h.x+h.width),top=Math.min(r.y+r.height,h.y+h.height);
 if(x>=right||y>=top)return[r];
 return [{x:r.x,y:r.y,width:x-r.x,height:r.height},{x:right,y:r.y,width:r.x+r.width-right,height:r.height},{x,y:r.y,width:right-x,height:y-r.y},{x,y:top,width:right-x,height:r.y+r.height-top}].filter(p=>p.width>0&&p.height>0);
}
export function makeLayout({module=840,joint=8,offset=0,width=40400,height=8525,openings=seOpenings,levels=floorLevels,panelHeight=0,rowLevels,columnCuts,rectanglePartition,localJoints,facade='SE',accentBands=entrances.map(x=>[x+20200-1360,x+20200+1360]),scope,colourRegions=[],minWidth=50,minHeight=160}={}){
 if(![module,joint,offset,width,height].every(Number.isInteger)||module<=joint||joint<0||width<=0||height<=0||Math.abs(offset)>=module)throw Error('Invalid layout');
 if(![minWidth,minHeight].every(n=>Number.isInteger(n)&&n>=0))throw Error('Invalid necessary edge limits');
 if(!Number.isInteger(panelHeight)||panelHeight<0)throw Error('Invalid finished panel height');
 if(rectanglePartition!==undefined&&!['best','vertical-first','horizontal-first','global-cell'].includes(rectanglePartition))throw Error('Invalid rectangle partition strategy');
 if(localJoints!==undefined&&!['none','best','shift-redistribute','patch-retile'].includes(localJoints))throw Error('Invalid local joint strategy');
 if(localJoints&&localJoints!=='none'&&(module!==1200||joint!==8||panelHeight!==1250||rectanglePartition!=='best'))throw Error('Local joints require rectangular1192×1250 /8 candidate');
 if(rowLevels!==undefined)levels=validateRowLevels(rowLevels,{height,panelHeight,joint});
 else if(panelHeight){const pitch=panelHeight+joint;levels=[0,...Array.from({length:Math.ceil(height/pitch)-1},(_,i)=>(i+1)*pitch),height];}
 if(levels[0]!==0||levels.at(-1)!==height||levels.some((v,i)=>!Number.isInteger(v)||(i&&v<=levels[i-1])))throw Error('Invalid levels');
 for(const o of openings)if(![o.x,o.y,o.width,o.height].every(Number.isInteger)||o.width<=0||o.height<=0)throw Error('Invalid opening');
 if(columnCuts!==undefined&&(!Array.isArray(columnCuts)||columnCuts.length<2||columnCuts[0]!==0||columnCuts.at(-1)!==width||columnCuts.some((x,i)=>!Number.isSafeInteger(x)||(i&&x<=columnCuts[i-1]))))throw Error('Invalid explicit column cuts');
 const cuts=columnCuts?[...columnCuts]:Array.from(new Set([0,width,...Array.from({length:Math.ceil(width/module)+3},(_,i)=>offset+(i-1)*module).filter(x=>x>0&&x<width)])).sort((a,b)=>a-b),parts=[],jointClearances=[],errors=[];
 const finishedWidths=cuts.slice(1).map((x,i)=>x-cuts[i]-joint),panelWidthSum=finishedWidths.reduce((s,w)=>s+w,0),internalJoints=(finishedWidths.length-1)*joint,edgeClearances=[joint/2,joint/2];
 const edgeChain={finishedWidths,panelWidthSum,internalJoints,edgeClearances,total:panelWidthSum+internalJoints+joint,width,closed:panelWidthSum+internalJoints+joint===width};
 finishedWidths.forEach((w,cell)=>{if(w<=0||w<minWidth)errors.push({kind:'grid-width',cell,width:w,minimum:minWidth});});
 for(let c=0;c<cuts.length-1;c++)for(let f=0;f<levels.length-1;f++){
  // Nominal joint at grid boundaries. Every additional split also gets its
  // own half-joint below, so neighbouring pieces never touch across an opening.
  const cell={x:cuts[c],y:levels[f],width:cuts[c+1]-cuts[c],height:levels[f+1]-levels[f]};let pieces=[cell];
  for(const o of openings)pieces=pieces.flatMap(r=>subtractRect(r,o));
  for(const p of pieces){const w=p.width-joint,h=p.height-joint;if(w<=0||h<=0){
   // An opening cut can leave less than one joint (e.g. 5 mm between an
   // A02 head and the floor grid). Record that clearance, never fabricate
   // a negative panel. Original invalid grid columns still fail above.
   jointClearances.push({kind:'consumed-by-joint',cell:c,floor:f,rectangle:{...p},finishedWidth:w,finishedHeight:h});continue;
  }
   const centre=panelHeight?cell.x+cell.width/2:p.x+p.width/2,accent=accentBands.some(([a,b])=>centre>=a&&centre<b),warnings=[];
   if(w<minWidth){warnings.push(`ширина < ${minWidth} мм: необхідні крайові відстані не вміщуються`);errors.push({kind:'piece-width',cell:c,floor:f,width:w,minimum:minWidth});}
   if(h<minHeight){warnings.push(`висота < ${minHeight} мм: необхідні торцеві відстані не вміщуються`);errors.push({kind:'piece-height',cell:c,floor:f,height:h,minimum:minHeight});}
   // Edge distances are a geometric necessary check only; screw diameter,
   // hole clearance, wind and movement still need the exact selected system.
   parts.push({facade,id:facade+'-'+String(parts.length+1).padStart(3,'0'),x:p.x+joint/2,y:p.y+joint/2,width:w,height:h,colour:accent?'P070':'P222',grain:'вертикально',warnings,status:'варіант розкладки',cell:c,floor:f});
  }
 }
 const area=parts.reduce((s,p)=>s+p.width*p.height,0)/1e6;
 const installation={view:'exterior',direction:'left-to-right',policy:offset===0?'left-full-right-remainder':'offset-grid',fullWidth:module-joint,rightWidth:finishedWidths.at(-1),edgeClearances};
 const layout={width,height,module,joint,offset,panelHeight,levels,colourRegions,parts,area,cuts,openings,accentBands,grain:'вертикально',blankColourPolicy:panelHeight?'cell-centre':'fragment-centre',installation,warningParts:parts.filter(p=>p.warnings.length),jointClearances,edgeChain,validity:{valid:errors.length===0&&edgeChain.closed,visualizable:edgeChain.closed&&errors.every(e=>e.kind==='piece-width'||e.kind==='piece-height'),errors,minWidth,minHeight,necessaryOnly:true},facade,scope:scope||'ПдСх: прямокутник головної стіни; без цоколя, боків тамбурів, відкосів, балконів і фронтонів. Геометрія прорізів за PDF/специфікацією, не фактичний обмір.',approved:false};
 if(rowLevels!==undefined)layout.rowLevels=[...levels];
 if(rectanglePartition===undefined)return layout;
 const result=partitionLayout(layout,{strategy:rectanglePartition});
 const nextParts=result.parts.map((p,i)=>({...p,partitionPartId:p.id,id:facade+'-'+String(i+1).padStart(3,'0')}));
 const nextErrors=errors.filter(e=>e.kind==='grid-width');
 for(const p of nextParts){if(p.width<minWidth)nextErrors.push({kind:'piece-width',cell:p.cell,floor:p.floor,width:p.width,minimum:minWidth});if(p.height<minHeight)nextErrors.push({kind:'piece-height',cell:p.cell,floor:p.floor,height:p.height,minimum:minHeight});}
 const clearances=result.consumed.map(p=>({kind:'consumed-by-joint',cell:p.cell,floor:p.floor,sourceCellId:p.sourceCellId,rectangle:{...p.nominal},finishedWidth:p.nominal.width-joint,finishedHeight:p.nominal.height-joint,areaMm2:p.areaMm2,reason:p.reason}));
 const rectangular={...layout,rectanglePartition,parts:nextParts,area:result.summary.finishedAreaMm2/1e6,warningParts:nextParts.filter(p=>p.warnings.length),jointClearances:clearances,validity:{...layout.validity,valid:nextErrors.length===0&&edgeChain.closed,visualizable:edgeChain.closed&&nextErrors.every(e=>e.kind==='piece-width'||e.kind==='piece-height'),errors:nextErrors},rectanglePartitionAccounting:{...result.summary,openingUnionAreaMm2:width*height-result.summary.nominalMaterialAreaMm2,objective:result.objective,globalFacadeStockOptimum:false,necessaryOnly:true,approved:false,readyToCut:false},readyToCut:false};
 if(!localJoints||localJoints==='none')return {...rectangular,...(localJoints?{localJoints}:{})};
 const local=studyLocalJoints(rectangular,{model:localJoints}),changed=local.patches.filter(p=>p.model!=='fixed-grid');
 if(!changed.length)return {...rectangular,localJoints};
 const patched=local.parts.map((p,i)=>({...p,previousPartId:p.localPatchId?null:p.id,partitionPartId:p.partitionPartId??p.id,id:facade+'-'+String(i+1).padStart(3,'0'),stockFit:p.width<=1192&&p.height<=1250}));
 const patchedErrors=errors.filter(e=>e.kind==='grid-width');
 for(const p of patched){if(p.width<minWidth)patchedErrors.push({kind:'piece-width',id:p.id,width:p.width,minimum:minWidth});if(p.height<minHeight)patchedErrors.push({kind:'piece-height',id:p.id,height:p.height,minimum:minHeight});}
 return {...rectangular,localJoints,parts:patched,area:local.summary.finishedAreaMm2/1e6,warningParts:patched.filter(p=>p.warnings.length),jointClearances:local.jointClearances,
  edgeChain:{...edgeChain,scope:'Reference module outside local aperture patches; local edges are declared separately'},
  validity:{...rectangular.validity,valid:patchedErrors.length===0&&edgeChain.closed,visualizable:edgeChain.closed&&patchedErrors.every(e=>e.kind==='piece-width'||e.kind==='piece-height'),errors:patchedErrors},
  rectanglePartitionAccounting:{...local.summary,openingUnionAreaMm2:width*height-local.summary.nominalMaterialAreaMm2,objective:local.objective,globalFacadeStockOptimum:false,necessaryOnly:true,approved:false,readyToCut:false},
  localJointTopology:local.localJointTopology,
  localJointPlan:{model:localJoints,changedPatches:changed.length,removedPreviousPartIds:local.removedPartIds,baseline:local.baseline,summary:local.summary,unmappedThinPartIds:local.unmappedThinPartIds,scope:local.scope,manufacturerBoundary:local.manufacturerBoundary,finiteDomainOptimum:false,approved:false,readyToCut:false},
  approved:false,readyToCut:false};
}
export function screenOffsets(module,options={}){
 if(!Number.isInteger(module)||module<=8||(options.joint!==undefined&&options.joint!==8))throw Error('Offset search requires an integer module and fixed 8 mm joints');
 const stock={width:variants.find(v=>v.module===module)?.stock||1250,height:3050,kerf:3,trim:0,...options.stock};
 // Validate packing settings even when no geometric candidate survives.
 planCuts([],stock);
 let minimumParts=Infinity,feasible=0,leastConflicts=Infinity;const layouts=[];
 for(let offset=0;offset<module;offset++){
  const layout=makeLayout({...options,module,joint:8,offset});leastConflicts=Math.min(leastConflicts,layout.validity.errors.length);
  if(!layout.validity.valid)continue;
  if(layout.parts.some(p=>p.width>stock.width-2*stock.trim||p.height>stock.height-2*stock.trim))continue;feasible++;
  if(layout.parts.length<minimumParts){minimumParts=layout.parts.length;layouts.length=0;}
  if(layout.parts.length===minimumParts)layouts.push(layout);
 }
 const objective=['necessary geometry and stock admission','minimum part count','balanced finished edge widths','fewer heuristic saw lines','less unallocated stock area'];
 const common={checked:module,joint:8,stock,objective,approved:false,globalOptimum:false};
 if(!layouts.length)return {...common,feasible:false,offset:null,score:null,alternatives:[],reason:'No offset passes the necessary geometry and stock checks',leastConflicts};
 const candidates=layouts.map(layout=>{const packing=planCuts(layout.parts,stock),widths=layout.edgeChain.finishedWidths,edges=[widths[0],widths.at(-1)],sawLines=packing.sheets.reduce((n,s)=>n+s.cuts.length,0);return {offset:layout.offset,parts:layout.parts.length,columns:widths.length,edges,edgeImbalance:Math.abs(edges[0]-edges[1]),sawLines,sheets:packing.sheets.length,unallocatedArea:packing.unallocatedArea,utilization:packing.utilization};});
 const criteria=['edgeImbalance','sawLines','unallocatedArea'];
 const compare=(a,b)=>{for(const key of criteria)if(a[key]!==b[key])return a[key]-b[key];return a.offset-b.offset;};
 candidates.sort(compare);
 const alternatives=candidates.filter(a=>!candidates.some(b=>criteria.every(k=>b[k]<=a[k])&&criteria.some(k=>b[k]<a[k]))).filter((a,i,list)=>list.findIndex(b=>criteria.every(k=>b[k]===a[k]))===i);
 const recommendation=candidates[0];return {...common,feasible:true,feasibleOffsets:feasible,offset:recommendation.offset,score:[0,recommendation.parts,recommendation.edgeImbalance,recommendation.sawLines,recommendation.unallocatedArea],recommendation,alternatives};
}
export function insulationFit({axisStep=600,timberWidth=50,stockWidth=565,compression=15}={}){
 for(const n of [axisStep,timberWidth,stockWidth,compression])if(!Number.isFinite(n)||n<0)throw Error('Invalid insulation input');
 if(timberWidth>=axisStep||stockWidth===0)throw Error('No clear bay or stock');
 const clear=axisStep-timberWidth,target=clear+compression;return {clear,target,cut:stockWidth-target,cutNeeded:stockWidth>target,tooNarrow:stockWidth<target,compressionIsScenario:true};
}
