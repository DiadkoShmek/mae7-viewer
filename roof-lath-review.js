import {planRoofAssembly,roofAssemblySpec} from './roof-assembly.js';

const copy=v=>structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fmt=n=>Number(n.toFixed(2)).toLocaleString('uk-UA');
let cachedPlans;
const defaults=()=>cachedPlans??=( [planRoofAssembly(1),planRoofAssembly(-1)] );
const contains=(a,b)=>b.x>=a.x-1e-10&&b.z>=a.z-1e-10&&b.x+b.width<=a.x+a.width+1e-10&&b.z+b.depth<=a.z+a.depth+1e-10;

export function resolveRoofLathSelection(metadata,plans=defaults()){
 if(metadata?.assembly!=='roof'||metadata.system!=='roof'||metadata.layer!==3||!metadata.partId)return null;
 const matches=plans.flatMap(plan=>[...plan.outside,...plan.cover,...plan.inspection].filter(p=>p.layer===3&&p.partId===metadata.partId&&same(p,metadata.authoring)).map(p=>({plan,p})));
 if(matches.length!==1)return null;
 const {plan,p}=matches[0];
 if(p.approved!==false||metadata.sourcePartId!==p.sourcePartId||metadata.geometryPartId!==p.geometryPartId||metadata.roofProjection!==p.projection)return null;
 const physical=plan.physicalParts.filter(q=>q.layer===3&&q.sourcePartId===p.sourcePartId&&contains(q.rect,p.rect));
 if(physical.length!==1)return null;
 return {system:'roof-lath',id:p.partId,code:plan.code,fragment:copy(p),physicalPart:copy(physical[0])};
}

export function selectedRoofLathReview(selection,plans=defaults()){
 const p=selection?.fragment;
 const resolved=p&&resolveRoofLathSelection({assembly:'roof',system:'roof',layer:3,partId:selection.id,sourcePartId:p.sourcePartId,geometryPartId:p.geometryPartId,roofProjection:p.projection,authoring:p},plans);
 if(selection?.system!=='roof-lath'||!resolved||!same(resolved,selection))throw Error('Selected roof lath differs from its native owner');
 const plan=plans.find(p=>p.code===selection.code),whole=selection.physicalPart;
 const row=plan.baseParts.find(p=>p.id===whole.sourcePartId),station=p.rect.x+p.rect.width/2;
 const rows=plan.baseParts.filter(p=>p.layer===3),index=rows.indexOf(row),start=Math.max(0,Math.min(index-1,rows.length-3));
 const section=part=>part.geometry.sectionYZ.map(([z,y])=>[(part.rect.z+z)*1000,y*1000]);
 const context=rows.slice(start,start+3).map(base=>{
  const parts=plan.physicalParts.filter(part=>part.sourcePartId===base.id&&station>=part.rect.x-1e-10&&station<=part.rect.x+part.rect.width+1e-10);
  return {sourcePartId:base.id,axisMm:(base.rect.z+base.rect.depth/2)*1000,parts:parts.map(part=>({id:part.partId,polygon:section(part)}))};
 });
 const polygon=section(p),all=context.flatMap(r=>r.parts.flatMap(p=>p.polygon));
 if(!all.length||!polygon.length)throw Error('No physical lath section at selection station');
 const z0=Math.min(...all.map(q=>q[0])),z1=Math.max(...all.map(q=>q[0])),y1=Math.max(...all.map(q=>q[1])),scale=440/(z1-z0);
 const tx=z=>60+(z-z0)*scale,ty=y=>235+(y1-y)*scale;
 const path=poly=>poly.map(([z,y],i)=>(i?'L':'M')+tx(z).toFixed(4)+' '+ty(y).toFixed(4)).join(' ')+' Z';
 const dimension=(a,b,y,label)=>`<path d="M${tx(a)} ${y}H${tx(b)}" marker-start="url(#lath-arrow)" marker-end="url(#lath-arrow)"/><text x="${(tx(a)+tx(b))/2}" y="${y-12}" text-anchor="middle" stroke="none">${esc(label)}</text>`;
 const first=context[0],second=context[1],gapMm=(rows[start+1].rect.z-rows[start].rect.z-rows[start].rect.depth)*1000;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 360" role="img" aria-label="Крок і чистий проміжок лат вибраного скату" font-family="system-ui" font-size="18"><defs><marker id="lath-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M10 5 0 0 0 10Z" fill="#29423c"/></marker></defs><rect width="560" height="360" rx="12" fill="#f5f6f1"/><text x="24" y="32" fill="#1f3b34" font-weight="650">Лати 32 × 100 мм · зріз уздовж скату</text><text x="24" y="62" fill="#61736d">Розміри з моделі до оглядового розсування</text><g fill="#d0ad7b" stroke="#614b35" stroke-width="1.5">${context.flatMap(r=>r.parts.map(part=>`<path data-lath-physical-owner="${esc(part.id)}" d="${path(part.polygon)}"/>`)).join('')}</g><path data-lath-fragment-owner="${esc(p.partId)}" d="${path(polygon)}" fill="#dc8059" stroke="#a94824" stroke-width="2"/><g fill="#29423c" stroke="#29423c" stroke-width="1.8">${context.map(r=>`<path d="M${tx(r.axisMm)} 135V${ty(0)+15}" stroke-dasharray="4 5" opacity=".4"/>`).join('')}${dimension(first.axisMm,second.axisMm,135,fmt(second.axisMm-first.axisMm)+' мм · осі')}${dimension((rows[start].rect.z+rows[start].rect.depth)*1000,rows[start+1].rect.z*1000,185,fmt(gapMm)+' мм · просвіт')}</g><text x="24" y="318" fill="#29423c">Помаранчевий контур — вибраний фрагмент.</text><text x="24" y="344" fill="#61736d">Осі та просвіт — різні розміри.</text></svg>`;
 return {schema:'mae7-selected-roof-lath-v1',id:p.partId,sourcePartId:p.sourcePartId,code:plan.code,selection:copy(selection),physicalPart:copy(whole),fragment:copy(p),stationX:station,
  dimensionsMm:{projectSection:[32,100],nominalAxisPitch:plan.lathPitch*1000,actualAxisPitch:second.axisMm-first.axisMm,actualClearGap:gapMm,fragmentLengthX:p.rect.width*1000,fragmentDepthZ:p.rect.depth*1000,fragmentThickness:p.thickness*1000,physicalLengthX:whole.rect.width*1000},context,fragmentPolygon:polygon,
  source:'PDF60 / арк12; §5.4',profileReference:copy(roofAssemblySpec.profileReference),svg,
  approved:false,readyToCut:false,quantityAuthority:false,geometryChanged:false,
  note:'Крок лат 400 мм по осях заданий Артуром; просвіт між дошками 100 мм — 300 мм. Біля краю скату останній інтервал коротший. Довжина у 3D не визначає довжину закупівельної заготовки; стики й кріплення ще звіряємо.'};
}
