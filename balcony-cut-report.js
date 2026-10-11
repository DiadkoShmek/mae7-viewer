import {balconyBays,balconyFullSide} from './assembly-geometry.js';
import {balconyOpenings} from './balcony-openings.js';
import {planBalconyFloor} from './balcony-floor.js';
import {planBalconySteel} from './balcony-steel.js';
import {planBalconyGuard} from './balcony-guard.js';
import {balconyGuardSource} from './balcony-guard-source.js';
import {planCuts} from './cut-planner.js';
import {packingAreaAccounting} from './cut-area-accounting.js';

const copy=v=>structuredClone(v),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fmt=n=>Number(n.toFixed(2)).toLocaleString('uk-UA');
// Snap only floating-point noise at an integer mm, never a real fraction.
const ceilMm=n=>{const mm=n*1000,integer=Math.round(mm);return Math.abs(mm-integer)<1e-8?integer:Math.ceil(mm);};
// Object key order is transport detail; every source value and array order matters.
const same=(a,b)=>a===b||(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i])))||
 (a&&b&&!Array.isArray(a)&&!Array.isArray(b)&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k])));
let canonical;
function plans(){
 return canonical??=balconyBays().map((bay,i)=>{
  const balconyId=`BAL-${String(i+1).padStart(2,'0')}`,door=balconyOpenings.filter(o=>Math.abs(o.x-(bay.sourceX??bay.x))<.0001).sort((a,b)=>a.door.y-b.door.y)[bay.f];
  const floorPlan=planBalconyFloor({bay,balconyId,door:door?{...door.door,id:door.id+'-DOOR'}:null});
  return planBalconyGuard({bay,balconyId,steelPlan:planBalconySteel({bay,balconyId,floorPlan}),fullSide:balconyFullSide(bay.x)});
 });
}
export function balconyGuardParts(){return copy(plans().flatMap(p=>p.panels));}
export function resolveBalconyGuardSelection(metadata){
 if(metadata?.assembly!=='balcony-guard'||metadata.role!=='guard-panel')return null;
 const p=plans().flatMap(p=>p.panels).find(p=>p.partId===metadata.partId);
 if(!p||!Object.keys(p).every(k=>Object.hasOwn(metadata,k)&&same(p[k],metadata[k])))return null;
 return {system:'balcony-guard-panel',id:p.partId,physicalPart:copy(p)};
}
function validSelection(selection){
 const d=selection?.physicalPart,resolved=d&&resolveBalconyGuardSelection({...d,assembly:'balcony-guard'});
 if(!resolved||!same(selection,resolved))throw Error('Selected guard differs from its physical source owner');
 return resolved.physicalPart;
}
export function guardQuantityComparison(row){
 if(!row)return {sourceOperationId:'R134',projectAssemblyQuantity:null,modelAssemblies:plans().length,coverageApproved:false,unit:'шт',note:'Вихідну відомість ще не завантажено.'};
 if(row.id!=='R134'||row.row!==134||row.unit!=='шт'||!Number.isFinite(row.quantity)||row.quantity<0||row.original!=='Rõdu piirde massvärvitud plaat')throw Error('Guard quantity row differs from R134 source');
 return {sourceOperationId:row.id,projectAssemblyQuantity:row.quantity,modelAssemblies:plans().length,unit:row.unit,countsMatch:row.quantity===plans().length,coverageApproved:false,source:row.source,
  note:'R134 рахує огородження балконів, а не окремі панелі чи листи. Збіг кількостей не підтверджує обсяг бригади або приймання.'};
}
// Independent geometric bound: wide rectangles must overlap on X, hence be
// disjoint on Y. Tall panels cannot share a sheet with even the shortest panel.
function sheetBound(parts,stock,sheetCount,rejected){
 const w=stock.width-2*stock.trim,h=stock.height-2*stock.trim;
 if(rejected.length||!parts.length||parts.some(p=>p.width<=w/2))return {proved:false,minimumSheets:null};
 const min=Math.min(...parts.map(p=>p.height)),isolated=parts.filter(p=>p.height+min>h),others=parts.filter(p=>p.height+min<=h);
 const capacity=Math.floor(h/min),bound=isolated.length+Math.ceil(others.length/capacity);
 return {proved:sheetCount===bound,minimumSheets:bound,isolatedPanels:isolated.length,shortPanels:others.length,maxShortPanelsPerSheet:capacity,
  basis:'No rotation; every blank is wider than half the usable sheet. Y projections must be disjoint. This geometric bound ignores kerf, while the actual packing includes it.',
  procurementApproved:false};
}
export function buildBalconyCutReport(stock={},quantityRow=null){
 const physical=balconyGuardParts(),parts=physical.map(p=>({id:p.id,sourcePartId:p.partId,balconyId:p.balconyId,colour:p.colour,grain:p.grain,width:ceilMm(p.width),height:ceilMm(p.height)}));
 const packing=planCuts(parts,stock),accounting=packingAreaAccounting(packing),operations=[],placements=new Map();
 for(const sheet of packing.sheets){
  sheet.id='GUARD-'+sheet.id;
  const trimId=sheet.id+'-EDGE-TRIM';
  operations.push({id:trimId,kind:'edge-trim-candidate',sheetId:sheet.id,trimMm:packing.stock.trim,toolpath:null,dependsOn:[],sourceOperationId:'R134',approved:false});
  let previous=trimId;
  for(const cut of sheet.cuts){
   cut.id=sheet.id+'-CUT-'+String(cut.order).padStart(3,'0');
   operations.push({id:cut.id,kind:'rectangular-guillotine-cut',sheetId:sheet.id,sourcePartId:cut.part,cut:copy(cut),dependsOn:[previous],sourceOperationId:'R134',approved:false});previous=cut.id;
  }
  for(const p of sheet.parts)placements.set(p.id,{sheetId:sheet.id,xMm:p.xSheet,yMm:p.ySheet,rotated:p.rotated,dependsOn:[previous]});
 }
 const entries=physical.map(p=>{
  const blank=parts.find(q=>q.id===p.id),placement=placements.get(p.id),status=placement?'PLACED':'REJECTED';
  const finished={widthMm:p.width*1000,heightMm:p.height*1000,thicknessMm:p.thickness*1000,grossFaceAreaM2:p.area,
   boresMm:p.holes.map(h=>({x:h.x*1000,y:h.y*1000,diameter:h.diameter*1000}))};
  if(placement){
   const sizeId=p.id+'-SIZE',drillId=p.id+'-DRILL';
   operations.push({id:sizeId,kind:'secondary-sizing-and-edge-finish',sourcePartId:p.id,sheetId:placement.sheetId,blankMm:[blank.width,blank.height],finishedMm:[finished.widthMm,finished.heightMm],dependsOn:placement.dependsOn,secondaryKerfMm:null,sourceOperationId:'R134',approved:false});
   operations.push({id:drillId,kind:'source-bore-pattern-review',sourcePartId:p.id,sheetId:placement.sheetId,pointsMm:copy(finished.boresMm),dependsOn:[sizeId],sourceOperationId:'R134',approved:false,fixingApproval:false});
  }
  return {sourcePartId:p.partId,balconyId:p.balconyId,plane:p.plane,material:p.colour,grain:p.grain,status,finished,blank:copy(blank),placement:placement??null,
   reason:placement?null:'Панель не вміщується в корисний формат без повороту.',physicalPart:copy(p),approved:false};
 });
 const placed=entries.filter(p=>p.placement),gross=entries.reduce((n,p)=>n+p.finished.grossFaceAreaM2,0);
 return {schema:'mae7-balcony-cut-report-v51',approved:false,readyToCut:false,units:'mm',source:balconyGuardSource.source,stock:copy(packing.stock),parts:entries,sheets:packing.sheets,operations,accounting,
  counts:{assemblies:plans().length,panels:entries.length,bores:entries.reduce((n,p)=>n+p.finished.boresMm.length,0),placed:placed.length,rejected:entries.length-placed.length,sheets:packing.sheets.length},
  grossPanelAreaM2:gross,placedGrossPanelAreaM2:placed.reduce((n,p)=>n+p.finished.grossFaceAreaM2,0),
  secondarySizingCandidateAreaM2:placed.reduce((n,p)=>n+p.blank.width*p.blank.height/1e6-p.finished.grossFaceAreaM2,0),
  quantityComparison:guardQuantityComparison(quantityRow),sheetBound:sheetBound(parts,packing.stock,packing.sheets.length,packing.rejected),
  note:'Кандидат за геометрією макета. Заготовки округлено вгору до 1 мм; фінішні розміри й усі отвори збережено. Площа панелей брутто, без віднімання отворів. Вільні прямокутники — потенційні залишки; їх придатність невідома. Вторинний пропил, свердління, крайова обробка та фактичні втрати не замінені нулем.',
  unknown:copy(balconyGuardSource.unknown),procurementApproved:false};
}

export function selectedBalconyGuardDrawing(selection,report=buildBalconyCutReport()){
 const p=validSelection(selection),entry=report.parts?.find(q=>q.sourcePartId===p.partId);
 // A stale report is not allowed to substitute another panel or a forged blank.
 const expected=buildBalconyCutReport(report.stock);
 const match=expected.parts.find(q=>q.sourcePartId===p.partId);
 if(!entry||!same(entry,match)||!same(report.sheets,expected.sheets)||!same(report.operations,expected.operations)||!same(report.accounting,expected.accounting))throw Error('Guard sheet report differs from the selected physical panel');
 const w=p.width*1000,h=p.height*1000,s=Math.min(400/w,370/h),x=100+(400-w*s)/2,y=110+(370-h*s)/2,arrow='guard-dimension-arrow';
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 580" role="img" aria-label="Розміри і центри отворів вибраної балконної плити" font-family="system-ui" font-size="18"><defs><marker id="${arrow}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M10 5 0 0 0 10Z" fill="#29423c"/></marker></defs><rect width="600" height="580" rx="12" fill="#f5f6f1"/><text x="24" y="34" fill="#1f3b34" font-weight="650">Балконна плита · P070 · 8 мм</text><text x="24" y="65" fill="#61736d">${esc(p.partId)}</text><rect data-guard-part="${esc(p.partId)}" x="${x}" y="${y}" width="${w*s}" height="${h*s}" fill="#61645e" stroke="#26352e" stroke-width="2"/><g stroke="#ecf1e8" stroke-width="1.5">${p.holes.map((b,i)=>{const bx=x+b.x*1000*s,by=y+(h-b.y*1000)*s;return `<g data-guard-bore="${i}"><circle cx="${bx}" cy="${by}" r="${b.diameter*500*s}" fill="#f5f6f1"/><path d="M${bx-4} ${by}h8M${bx} ${by-4}v8"/></g>`;}).join('')}</g><g fill="#29423c" stroke="#29423c" stroke-width="1.8"><path d="M${x} ${y-16}V88M${x+w*s} ${y-16}V88"/><path d="M${x} 95H${x+w*s}" marker-start="url(#${arrow})" marker-end="url(#${arrow})"/><text x="300" y="84" text-anchor="middle" stroke="none">${fmt(w)} мм</text><path d="M${x-12} ${y}H55M${x-12} ${y+h*s}H55"/><path d="M65 ${y}V${y+h*s}" marker-start="url(#${arrow})" marker-end="url(#${arrow})"/><text x="45" y="${y+h*s/2}" transform="rotate(-90 45 ${y+h*s/2})" text-anchor="middle" stroke="none">${fmt(h)} мм</text></g><text x="24" y="518" fill="#1f3b34">${p.holes.length} отворів Ø8 мм · хрестик = центр</text><text x="24" y="548" fill="#61736d">Напрям текстури ↑ · розміри для звірки</text></svg>`;
 const sheet=entry.placement&&report.sheets.find(s=>s.id===entry.placement.sheetId);
 let sheetSVG=null;
 if(sheet){const k=500/sheet.height,sx=70,sy=82;sheetSVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 650" role="img" aria-label="Лист із вибраною балконною заготовкою" font-family="system-ui" font-size="18"><rect width="600" height="650" rx="12" fill="#f5f6f1"/><text x="24" y="34">${esc(sheet.id)} · ${sheet.width} × ${sheet.height} мм ↑</text><text x="24" y="63">Кандидат · обрізка ${report.stock.trim} · пропил ${report.stock.kerf} мм</text><rect x="${sx}" y="${sy}" width="${sheet.width*k}" height="${sheet.height*k}" fill="#dee5d9" stroke="#536957"/>${sheet.parts.map(q=>`<g data-guard-sheet-part="${esc(q.id)}"><rect x="${sx+q.xSheet*k}" y="${sy+q.ySheet*k}" width="${q.width*k}" height="${q.height*k}" fill="${q.id===p.id?'#d88b59':'#bccbbc'}" stroke="#29423c"/><text x="${sx+(q.xSheet+q.width/2)*k}" y="${sy+(q.ySheet+q.height/2)*k}" text-anchor="middle" font-size="13">${esc(q.id.replace('BAL-',''))}</text></g>`).join('')}<text x="24" y="618">Колірна мітка — заготовка цієї деталі</text></svg>`;}
 return {id:p.partId,entry:copy(entry),sheet:copy(sheet??null),svg,sheetSVG,operations:copy(report.operations.filter(o=>o.sourcePartId===p.partId||o.sheetId===sheet?.id)),stock:copy(report.stock),approved:false,readyToCut:false};
}
