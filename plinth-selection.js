import {selectedPanelDrawing} from './selection-drawing.js';
import {planPlinthAssembly} from './plinth-plan.js';
import {reviewPlinthFixings} from './plinth-fixing-review.js';
import {reviewPlinthAirPath} from './plinth-air-path.js';

// A cropped display owner refers to one complete physical part. It is never
// another item of stock. The plan is the same owner used by the cut report.
const copy=v=>structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function resolvePlinthSelection(metadata,plan,nativeBores){
 if(metadata?.assembly!=='plinth'||metadata.system!=='plinth'||metadata.layer!==4)return null;
 const region=metadata.region;
 if(!['outside','cover','inspection'].includes(region))return null;
 const represented=plan[region].filter(p=>p.id+'@'+region===metadata.partId);
 if(represented.length!==1)return null;
 const r=represented[0];
 if(r.material!=='FC_P070'||r.sourcePartId!==metadata.sourcePartId||metadata.authoring?.kind!==r.kind||metadata.authoring?.source!==r.source||!Number.isFinite(metadata.volume)||Math.abs(metadata.volume-r.volume)>1e-12)return null;
 const parts=plan.physicalParts.filter(p=>p.sourcePartId===r.sourcePartId);
 if(parts.length!==1)return null;
 const p=parts[0];
 if(p.region!=='physical'||p.projection!==false||p.stockPart!==true||p.layer!==4||p.material!=='FC_P070')return null;
 return {system:'plinth',id:p.sourcePartId,representationId:metadata.partId,representationRegion:region,physicalPart:copy(p),...(nativeBores?{nativeBores:copy(nativeBores)}:{})};
}

// Union the exact imported owners' existing holes across cropped display
// regions. A cropped inspection fragment is not the whole physical plate.
export function collectNativePlinthBores(owners,plan){
 const groups=new Map();
 for(const metadata of owners){
  const selection=resolvePlinthSelection(metadata,plan);if(!selection)continue;
  let points=groups.get(selection.id);if(!points){points=new Map();groups.set(selection.id,points);}
  for(const hole of metadata.drills??[]){
   if(![hole.x,hole.y,hole.diameterMM].every(Number.isFinite)||hole.diameterMM<=0)throw Error('Invalid native plinth bore: '+selection.id);
   const b={x:hole.x*1000,y:hole.y*1000,diameterMM:hole.diameterMM,approved:false};
   const key=[b.x,b.y,b.diameterMM].map(v=>v.toFixed(6)).join('/');
   points.set(key,b);
  }
 }
 return new Map([...groups].map(([id,points])=>[id,[...points.values()].sort((a,b)=>a.x-b.x||a.y-b.y)]));
}

export function selectedPlinthDrawing(selection,report,plan=planPlinthAssembly()){
 const s=copy(selection),p=s?.physicalPart;
 if(s?.system!=='plinth'||s.id!==p?.sourcePartId||p.region!=='physical'||p.projection!==false||p.stockPart!==true||p.layer!==4||p.material!=='FC_P070')throw Error('Missing physical plinth owner');
 const matches=report.parts.filter(r=>r.sourcePartId===s.id);
 if(matches.length!==1)throw Error('Missing or duplicate plinth report owner');
 const part=matches[0],f=part.finished;
 if(f.kind!==p.kind||!Number.isFinite(f.thicknessMm)||Math.abs(f.thicknessMm-8)>1e-9||part.face!==p.face||f.declaredPlanVolumeM3!==p.volume)throw Error('Plinth report geometry differs from selected owner');
 let outer,holes=[];
 if(p.kind==='contourZ'){
  if(!same(f.outer,p.outer)||!same(f.holes,p.holes)||f.z0!==p.z0||f.z1!==p.z1)throw Error('Plinth contour differs from selected owner');
  outer=p.outer;holes=p.holes;
 }else if(p.kind==='prismY'){
  if(!same(f.sectionXZ,p.sectionXZ)||f.y0!==p.y0||f.y1!==p.y1)throw Error('Plinth section differs from selected owner');
  const xs=p.sectionXZ.map(v=>v[0]);outer=[[Math.min(...xs),p.y0],[Math.max(...xs),p.y0],[Math.max(...xs),p.y1],[Math.min(...xs),p.y1]];
 }else throw Error('Unsupported plinth topology');
 const xs=outer.map(v=>v[0]*1000),ys=outer.map(v=>v[1]*1000);
 const panel={system:'plinth',id:s.id,facade:p.face,colour:'P070',x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),outer:outer.map(v=>v.map(n=>n*1000)),holes:holes.map(r=>r.map(v=>v.map(n=>n*1000))),grain:'вертикально · кандидат; без повороту'};
 if(s.nativeBores)panel.drilling={points:copy(s.nativeBores),source:'native imported owners',approved:false};
 const drawing=selectedPanelDrawing(panel);
 const placed=report.packing.sheets.flatMap(sheet=>sheet.parts.filter(r=>r.sourcePartId===s.id).map(r=>({sheet,placement:r})));
 if(part.placement){
  if(placed.length!==1||placed[0].sheet.id!==part.placement.sheetId||placed[0].placement.xSheet!==part.placement.xMm||placed[0].placement.ySheet!==part.placement.yMm||placed[0].placement.width!==part.blank.width||placed[0].placement.height!==part.blank.height||placed[0].placement.rotated!==false)throw Error('Selected part packing is inconsistent');
 }else if(placed.length)throw Error('Rejected selected part has a stock placement');
 const operations=report.operations.filter(o=>o.sourcePartId===s.id);
 return {...drawing,system:'plinth',selection:s,part:copy(part),stock:copy(report.stock),sheet:placed.length?copy(placed[0].sheet):null,operations:copy(operations),sectionProfiles:copy(part.sectionProfiles),fixingReview:reviewPlinthFixings(p,plan),airPathReview:reviewPlinthAirPath(p,plan),sourceOperationId:'R76',quantityAuthority:false,readyToCut:false,readyToDrill:false};
}

export function selectedPlinthSheetSVG(drawing){
 const s=drawing.sheet;if(!s)return '';
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-35 -100 ${s.width+70} ${s.height+150}" role="img" aria-label="Лист-кандидат ${esc(s.id)}: вибрана заготовка ${esc(drawing.id)}"><text x="0" y="-30" font-family="system-ui" font-size="45">${esc(s.id)} · ${s.width} × ${s.height} мм</text><rect width="${s.width}" height="${s.height}" fill="#edf0e8" stroke="#34463f" stroke-width="5"/>${s.parts.map(p=>`<rect data-stock-part="${esc(p.sourcePartId)}" x="${p.xSheet}" y="${p.ySheet}" width="${p.width}" height="${p.height}" fill="${p.sourcePartId===drawing.id?'#dd7545':'#b5c0b5'}" stroke="#34463f" stroke-width="4"/>`).join('')}</svg>`;
}
