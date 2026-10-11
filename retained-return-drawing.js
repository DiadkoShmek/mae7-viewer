import {planRetainedBalconyReturns,retainedBalconyReturnSource} from './balcony-returns.js';
import {plinthSpec} from './plinth-plan.js';

const copy=v=>structuredClone(v),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const mm=n=>n*1000,fmt=n=>Number(n.toFixed(2)).toLocaleString('uk-UA');
const colours={core:'#b4b9b5',wool:'#e7d49b',wood:'#b98853',P222:'#deddd1',EPDM:'#242c29'};

// Bind an actual authored part, including when its draw surface is instanced.
// A group title or a same-looking display copy is not a physical owner.
export function resolveRetainedReturnSelection(metadata,plan=planRetainedBalconyReturns()){
 if(metadata?.assembly!=='retained-balcony-return'||!metadata.partId)return null;
 const matches=plan.returns.filter(r=>r.id===metadata.retainedWallReturnId);
 if(matches.length!==1)return null;
 const r=matches[0],parts=r.parts.filter(p=>p.partId===metadata.partId);
 if(parts.length!==1||Object.keys(parts[0]).some(k=>!same(parts[0][k],metadata[k])))return null;
 if(!same(metadata.sourceFacts,r.sourceFacts)||!same(metadata.unknown,r.unknown))return null;
 return {system:'retained-return',id:r.id,partId:parts[0].partId,physicalReturn:copy(r)};
}

function clipY(ps,edge,keepAbove){
 const out=[];
 for(let i=0;i<ps.length;i++){
  const a=ps[i],b=ps[(i+1)%ps.length],u=(a[1]-edge)*(keepAbove?1:-1),v=(b[1]-edge)*(keepAbove?1:-1);
  if(u>=0)out.push(a);
  if((u<0&&v>0)||(u>0&&v<0)){const f=u/(u-v);out.push([a[0]+f*(b[0]-a[0]),edge]);}
 }
 return out;
}
export function returnHorizontalSection(r,y){
 if(!Number.isFinite(y))throw Error('Invalid return section station');
 const pieces=[];
 for(const p of r.parts){
  const {min,max}=p.bounds,[a,b]=p.topYAtZ;
  if(y<min[1]||y>=Math.max(a,b))continue;
  let z0=min[2],z1=max[2];
  if(y>Math.min(a,b)){const z=z0+(y-a)/(b-a)*(z1-z0);if(a<b)z0=z;else z1=z;}
  if(z1>z0)pieces.push({owner:p.partId,material:p.material,polygon:[[min[0],z0],[max[0],z0],[max[0],z1],[min[0],z1]]});
 }
 return pieces;
}
export function returnVerticalSection(r,x,{bottom=-1.1,top=.65}={}){
 if(![x,bottom,top].every(Number.isFinite)||top<=bottom)throw Error('Invalid return section extent');
 const pieces=[];
 for(const p of r.parts){
  const {min,max}=p.bounds,[a,b]=p.topYAtZ;
  if(x<=min[0]||x>=max[0])continue;
  const polygon=clipY(clipY([[min[2],min[1]],[max[2],min[1]],[max[2],b],[min[2],a]],bottom,true),top,false);
  if(polygon.length>=3)pieces.push({owner:p.partId,material:p.material,polygon});
 }
 return pieces;
}
function path(ps,transform){return ps.map((p,i)=>(i?'L':'M')+transform(p).map(v=>Number(v.toFixed(4))).join(' ')).join(' ')+' Z';}
function shapes(pieces,transform){return pieces.map(p=>`<path data-return-owner="${esc(p.owner)}" d="${path(p.polygon,transform)}" fill="${colours[p.material]}" stroke="#40504a" stroke-width=".8"/>`).join('');}
function shell(title,body){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 530" role="img" aria-label="${esc(title)}" font-family="system-ui" font-size="17"><defs><marker id="return-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M10 5 0 0 0 10Z" fill="#29423c"/></marker></defs><rect width="560" height="530" rx="12" fill="#f5f6f1"/><text x="24" y="32" fill="#1f3b34" font-weight="650">${title}</text>${body}</svg>`;}
function dim(x0,y0,x1,y1,label,lx,ly){return `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="#29423c" stroke-width="1.7" marker-start="url(#return-arrow)" marker-end="url(#return-arrow)"/><text x="${lx}" y="${ly}" text-anchor="middle" fill="#29423c">${label}</text>`;}

export function selectedRetainedReturnDrawing(selection,plan=planRetainedBalconyReturns()){
 const matches=plan.returns.filter(r=>r.id===selection?.id);
 if(selection?.system!=='retained-return'||matches.length!==1||!same(matches[0],selection.physicalReturn)||!matches[0].parts.some(p=>p.partId===selection.partId))throw Error('Selected return differs from its physical owner');
 const r=copy(matches[0]),s=retainedBalconyReturnSource,core=r.parts.find(p=>p.role==='retained-core');
 if(!core)throw Error('Missing retained core');
 const {min,max}=core.bounds,front=r.parts.filter(p=>p.role==='source50-insulation'&&p.partId.includes('-FRONT-')).sort((a,b)=>(b.bounds.max[0]-b.bounds.min[0])-(a.bounds.max[0]-a.bounds.min[0])||a.partId.localeCompare(b.partId));
 if(!front.length)throw Error('Missing source insulation station');
 const x=(front[0].bounds.min[0]+front[0].bounds.max[0])/2,base=min[1],upper=.65;
 const horizontal=returnHorizontalSection(r,.25),lower=returnHorizontalSection(r,-.4),vertical=returnVerticalSection(r,x,{bottom:base,top:upper});
 const plinthBottom=-plinthSpec.height;
 const widths={coreMm:mm(max[0]-min[0]),finishedMm:mm(r.max[0]-r.min[0]),coreDepthMm:mm(max[2]-min[2]),finishedDepthMm:mm(max[2]-r.min[2]),graphicDepthMm:mm(s.graphicNormalExtension),upperFinishMm:mm(s.finishThickness)};
 const drawing={schema:'mae7-selected-retained-return-v1',id:r.id,selectedPartId:selection.partId,selection:copy(selection),source:copy(s),widths,stations:{planY:.25,lowerY:-.4,sectionX:x},levels:{finishBottom:0,displayCoreBottom:base,mainPlinthBottom:plinthBottom,surveyedCoreBottom:null},horizontal,lower,vertical,approved:false,readyToBuild:false,quantityAuthority:false,geometryChanged:false,newStockParts:false,quantity:0,
  note:'Геометрія вибраного збереженого виступу. 50 мм/просочена деревина — джерельна вимога до виступу; місце нижнього обгортання, фундамент, глибина й вода не визначені.83мм верхнього пакета — кандидат моделі, не товщина нижнього цоколя.'};
 const scale=.28,xOrigin=190,yOrigin=80,xMin=r.min[0];
 const tr=([u,z])=>[xOrigin+(u-xMin)*1000*scale,yOrigin+(-z-s.existingWallFace)*1000*scale];
 const left=xOrigin,right=left+widths.finishedMm*scale,frontY=yOrigin+widths.finishedDepthMm*scale;
 drawing.planSVG=shell('Виступ · план на рівні +250 мм',shapes(horizontal,tr)+dim(left,55,right,55,fmt(widths.finishedMm)+' мм',(left+right)/2,48)+dim(150,yOrigin,150,frontY,fmt(widths.finishedDepthMm)+' мм',82,(yOrigin+frontY)/2)+`<text x="${(left+right)/2}" y="${frontY+35}" text-anchor="middle">Назовні ↓</text><text x="24" y="485">Сіре — існуюча основа · жовте — утеплення</text><text x="24" y="510">Світле — FC · чорне — закриття шва</text>`);
 const vscale=360/(upper-base),vx=62,vy=72;
 const vt=([z,y])=>[vx+(-z-s.existingWallFace)*vscale,vy+(upper-y)*vscale];
 const fcX=vt([min[2]-s.finishThickness,0])[0],zero=vt([min[2],0])[1],plinth=vt([min[2],plinthBottom])[1],bottom=vt([min[2],base])[1];
 drawing.sectionSVG=shell('Нижній вузол · вертикальний зріз',shapes(vertical,vt)+`<path d="M${vx} ${zero}H${fcX+10}" stroke="#24756a" stroke-width="2"/><text x="365" y="${zero-7}" fill="#24756a">0 · обшивка моделі</text><path d="M${vx} ${plinth}H${fcX+10}" stroke="#789592" stroke-dasharray="7 5"/><text x="365" y="${plinth-7}">${fmt(plinthBottom*1000)} · цоколь моделі</text><path d="M${fcX} ${zero}V${plinth}" stroke="#ba5c30" stroke-dasharray="6 4" stroke-width="2"/><text x="365" y="${(zero+plinth)/2}">Нижнє примикання</text><text x="365" y="${(zero+plinth)/2+23}" fill="#ba5c30">ще не визначене</text><path d="M${vx} ${bottom}H${fcX+10}" stroke="#9ca69f"/><text x="24" y="475">−1100 мм — умовне закінчення ядра в моделі.</text><text x="24" y="502">Фундамент і нижній пакет потребують обмірів.</text>`);
 return drawing;
}
