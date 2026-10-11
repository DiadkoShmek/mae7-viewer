import {samePanelPart} from './visual-panel-layout.js';
import {planCuts} from './cut-planner.js';
import {packingAreaAccounting} from './cut-area-accounting.js';
import {pointInPanelMaterial} from './panel-fastener-pattern.js';

const clone=value=>structuredClone(value);
const ringArea=ring=>Math.abs(ring.reduce((sum,p,i)=>sum+p[0]*ring[(i+1)%ring.length][1]-ring[(i+1)%ring.length][0]*p[1],0))/2;
let current;
export function setFacadeModelSnapshot(snapshot){
 current=undefined;
 try{validateSnapshot(snapshot);current=clone(snapshot);}
 finally{if(typeof document!=='undefined')document.dispatchEvent(new Event('mae-facade-model-change'));}
}
export function currentFacadeModelSnapshot(){if(!current)throw Error('Модель ще завантажується.');return clone(current);}

// The native loader supplies complete physical owners, including panels hidden
// by an inspection crop. No inspection copies enter this inventory.
export function validateSnapshot(snapshot){
 if(snapshot?.schema!=='mae7-current-facade-panels-v1'||!Number.isInteger(snapshot.revision)||snapshot.revision<0||
   !Array.isArray(snapshot.parts)||!snapshot.parts.length||!snapshot.layouts)throw Error('Missing current model inventory');
 const expected=Object.values(snapshot.layouts).flatMap(l=>l.parts),records=snapshot.parts.filter(p=>!p.gable);
 if(expected.length!==records.length)throw Error('Incomplete whole-facade inventory');
 const gables=Object.values(snapshot.gableLayouts??{}).flatMap(l=>l.parts);
 if(gables.length!==snapshot.parts.filter(p=>p.gable).length)throw Error('Incomplete gable inventory');
 const ids=new Set();
 for(const p of snapshot.parts){
  if(ids.has(p.id)||!p.ownerId||!['native','runtime-layout'].includes(p.ownerKind)||p.approved!==false||p.quantityEligible!==false)throw Error('Duplicate or unbound model panel');
  ids.add(p.id);
  const source=(p.gable?gables:expected).find(s=>s.id===p.id);if(!source||!samePanelPart(source,p))throw Error('Stale model panel contour '+p.id);
  if(!['P222','P070'].includes(p.colour)||!['вертикально','горизонтально'].includes(p.grain))throw Error('Unknown panel material or grain');
  if(![p.x,p.y,p.width,p.height].every(Number.isFinite)||p.width<=0||p.height<=0)throw Error('Invalid model panel dimensions');
  const rings=[p.outer??[[p.x,p.y],[p.x+p.width,p.y],[p.x+p.width,p.y+p.height],[p.x,p.y+p.height]],...(p.holes??[])];
  if(rings.some(r=>r.length<3||r.some(q=>q.length!==2||!q.every(Number.isFinite)||q[0]<p.x-1e-6||q[0]>p.x+p.width+1e-6||q[1]<p.y-1e-6||q[1]>p.y+p.height+1e-6)))throw Error('Contour outside model blank');
  const area=ringArea(rings[0])-rings.slice(1).reduce((s,r)=>s+ringArea(r),0);
  if(!Number.isFinite(area)||area<=0||area>p.width*p.height+1e-5)throw Error('Invalid model contour area');
  // Clipped gables carry a legacy pre-clip area; always recompute from rings.
  if(!p.gable&&p.areaMm2!==undefined&&Math.abs(p.areaMm2-area)>1e-5)throw Error('Stale model contour area');
  for(const h of p.drilling?.points??[])if(![h.x,h.y].every(Number.isFinite)||h.diameterMM!==8||!pointInPanelMaterial(p,h.x,h.y))throw Error('Invalid source bore');
 }
 return true;
}

export function buildFacadeModelReport(snapshot,stock={width:1250,height:3050,kerf:3,trim:10}){
 validateSnapshot(snapshot);
 for(const [key,value] of Object.entries(stock))if(!Number.isSafeInteger(value)||value<(['kerf','trim'].includes(key)?0:1))throw Error('Перевір числові розміри листа, пропил і край.');
 const parts=snapshot.parts.map(source=>{
  const p=clone(source),outer=p.outer??[[p.x,p.y],[p.x+p.width,p.y],[p.x+p.width,p.y+p.height],[p.x,p.y+p.height]];
  const contourAreaMm2=ringArea(outer)-(p.holes??[]).reduce((s,r)=>s+ringArea(r),0);
  return {...p,outer,contourAreaMm2,blank:{width:Math.ceil(p.width),height:Math.ceil(p.height)},
   secondaryContourAreaMm2:Math.ceil(p.width)*Math.ceil(p.height)-contourAreaMm2,
   approved:false,readyToCut:false,readyToDrill:false,quantityAuthority:false};
 });
 const packing=planCuts(parts.map(p=>({id:p.id,facade:p.facade,colour:p.colour,grain:p.grain,width:p.blank.width,height:p.blank.height})),stock);
 const operations=[];
 for(const sheet of packing.sheets){
  sheet.id='MODEL-'+sheet.id;
  const trimId=sheet.id+'-TRIM';operations.push({id:trimId,kind:'edge-trim-review',sheet:sheet.id,dependsOn:[],approved:false});
  const cuts=sheet.cuts.map(c=>({...c,id:sheet.id+'-CUT-'+c.order,kind:'rectangular-stock-cut',sheet:sheet.id,dependsOn:[c.order===1?trimId:sheet.id+'-CUT-'+(c.order-1)],approved:false}));operations.push(...cuts);
  for(const placed of sheet.parts){
   const p=parts.find(p=>p.id===placed.id);p.placement={sheet:sheet.id,x:placed.xSheet,y:placed.ySheet,rotated:false};p.status='bounding-blank-packed-review';
   const contourId=p.id+'-CONTOUR-REVIEW';
   operations.push({id:contourId,kind:'whole-contour-and-edge-review',part:p.id,sheet:sheet.id,dependsOn:cuts.length?[cuts.at(-1).id]:[trimId],outer:p.outer,holes:p.holes??[],toolpath:null,cornerRadiusMm:null,secondaryKerf:null,approved:false});
   operations.push({id:p.id+'-BORE-REVIEW',kind:'source-bore-pattern-review',part:p.id,sheet:sheet.id,dependsOn:[contourId],points:p.drilling?.points??null,approved:false,readyToDrill:false});
  }
 }
 for(const r of packing.rejected){const p=parts.find(p=>p.id===r.id);p.placement=null;p.status='exceeds-usable-stock';p.reason=r.reason;}
 const accounting=packingAreaAccounting(packing);
 return {schema:'mae7-current-facade-report-v1',revision:snapshot.revision,parts,packing,accounting,operations,
  counts:{main:parts.filter(p=>!p.gable).length,gables:parts.filter(p=>p.gable).length,panels:parts.length,placed:parts.filter(p=>p.placement).length,rejected:packing.rejected.length,sheets:packing.sheets.length,knownBores:parts.reduce((s,p)=>s+(p.drilling?.points.length??0),0),borePatternsUnknown:parts.filter(p=>!p.drilling).length},
  contourAreaM2:parts.reduce((s,p)=>s+p.contourAreaMm2,0)/1e6,
  secondaryContourAreaM2:parts.reduce((s,p)=>s+p.secondaryContourAreaMm2,0)/1e6,
  scope:'Current whole panels of four facade walls and two gables. Inspection copies, plinth, reveals, entrances, soffits and balcony guards excluded.',
  limits:'Bounding blanks only; notches, apertures, corners, secondary kerf, edge finishing and source bore patterns need review. No procurement, machine path or installation approval.',
  approved:false,readyToCut:false,readyToDrill:false,quantityAuthority:false,surveyVerified:false};
}

export function facadeReportPanel(selection,report){
 const p=report?.parts.find(p=>p.id===selection?.id);
 const normalized=selection?{...selection,outer:selection.outer??[[selection.x,selection.y],[selection.x+selection.width,selection.y],[selection.x+selection.width,selection.y+selection.height],[selection.x,selection.y+selection.height]]}:null;
 if(!p||!samePanelPart(p,normalized)||JSON.stringify(p.drilling??null)!==JSON.stringify(selection.drilling??null))throw Error('Ця плита не відповідає поточній відомості моделі.');
 return {part:clone(p),sheet:clone(report.packing.sheets.find(s=>s.id===p.placement?.sheet)??null),stock:clone(report.packing.stock),revision:report.revision};
}
export function facadePanelSheetSVG(view){
 if(!view.sheet)return '';
 const {width,height}=view.stock,selected=view.part.id;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -120 ${width+100} ${height+210}" role="img" aria-label="Лист вибраної фасадної плити"><rect width="${width}" height="${height}" fill="#f4f5f6" stroke="#142538" stroke-width="5"/><text x="0" y="-30" font-size="70">${view.sheet.id}</text>${view.sheet.parts.map(p=>`<rect x="${p.xSheet}" y="${p.ySheet}" width="${p.width}" height="${p.height}" data-facade-sheet-part="${p.id}" fill="${p.id===selected?'#f37b40':'#d9e0e5'}" stroke="#142538" stroke-width="3"/>`).join('')}</svg>`;
}
