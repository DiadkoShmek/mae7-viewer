// Exact vertical section of physical plinth owners. This is a geometric
// connectivity review, not an airflow/pressure calculation or mounting release.
import {plinthFaceContour,contourIntervals} from './plinth-fixing-review.js';
const mm=v=>v*1000,eps=1e-7;
const unique=values=>values.sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>eps);
const bounds=ps=>({z0:Math.min(...ps.map(p=>p[0])),z1:Math.max(...ps.map(p=>p[0])),y0:Math.min(...ps.map(p=>p[1])),y1:Math.max(...ps.map(p=>p[1]))});
const inside=(ring,x,y)=>{let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};
const rect=(z0,z1,y0,y1)=>[[z0,y0],[z1,y0],[z1,y1],[z0,y1]];
export function physicalPlinthSection(parts,face,xMm){
 const pieces=[];
 function visit(p,parent=p){
  if(p.kind==='compound'){for(const q of p.geometryPieces)visit(q,parent);return;}
  let rings=[];
  if(p.kind==='prismY'||p.kind==='supportAngleY')rings=contourIntervals([p.sectionXZ.map(q=>q.map(mm))],0,xMm).map(([z0,z1])=>rect(z0,z1,mm(p.y0),mm(p.y1)));
  else if(p.kind==='contourZ')rings=contourIntervals([p.outer,...(p.holes??[])].map(r=>r.map(q=>q.map(mm))),0,xMm).map(([y0,y1])=>rect(mm(p.z0),mm(p.z1),y0,y1));
  else if(p.kind==='profileX'){if(xMm>mm(p.x0)+eps&&xMm<mm(p.x1)-eps)rings=[p.sectionYZ.map(([y,z])=>[mm(z),mm(y)])];}
  else throw Error('Unsupported physical plinth section: '+p.kind);
  for(const ring of rings)pieces.push({owner:parent.sourcePartId,layer:parent.layer,material:parent.material,ring});
 }
 for(const p of parts.filter(p=>p.face===face))visit(p);
 return pieces;
}
// An orthogonal boundary lattice: a free cell joins a neighbour only across a
// positive-width common edge. Corner-touching voids never become an air route.
export function sectionAirConnectivity(polygons,box){
 if(!Object.values(box).every(Number.isFinite)||box.z1<=box.z0||box.y1<=box.y0)throw Error('Invalid air-path box');
 polygons=polygons.filter(p=>{const b=bounds(p);return b.z0<box.z1&&b.z1>box.z0&&b.y0<box.y1&&b.y1>box.y0;});
 for(const ring of polygons)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(Math.abs(a[0]-b[0])>eps&&Math.abs(a[1]-b[1])>eps)return {status:'unsupported-oblique-boundary',connected:null,route:[]};}
 const zs=unique([box.z0,box.z1,...polygons.flatMap(p=>p.map(q=>q[0])).filter(z=>z>box.z0&&z<box.z1)]),ys=unique([box.y0,box.y1,...polygons.flatMap(p=>p.map(q=>q[1])).filter(y=>y>box.y0&&y<box.y1)]),nx=zs.length-1,ny=ys.length-1;
 const free=new Set(),centre=k=>{const [i,j]=k.split(',').map(Number);return [(zs[i]+zs[i+1])/2,(ys[j]+ys[j+1])/2];};
 for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const k=`${i},${j}`,[z,y]=centre(k);if(!polygons.some(r=>inside(r,z,y)))free.add(k);}
 const queue=[],previous=new Map();for(let i=0;i<nx;i++){const k=`${i},0`;if(free.has(k)){queue.push(k);previous.set(k,null);}}
 let end=null,best=queue[0]??null;
 for(let q=0;q<queue.length;q++){
  const k=queue[q],[i,j]=k.split(',').map(Number);if(!best||centre(k)[1]>centre(best)[1])best=k;
  if(j===ny-1){end=k;break;}
  for(const [a,b] of [[i,j+1],[i-1,j],[i+1,j],[i,j-1]]){const n=`${a},${b}`;if(free.has(n)&&!previous.has(n)){previous.set(n,k);queue.push(n);}}
 }
 const route=[];for(let k=end??best;k!==null&&k!==undefined;k=previous.get(k))route.unshift(centre(k));
 return {status:'exact-orthogonal-section',connected:!!end,route,reachableCellCount:previous.size,totalFreeCellCount:free.size,bottomOpeningInSection:queue.length>0,box:{...box}};
}
function stationFor(part,plan){
 const rings=plinthFaceContour(part),xs=rings.flat().map(q=>q[0]);
 for(const p of plan.physicalParts.filter(p=>p.face===part.face&&p.material==='timber'))if(p.sectionXZ)xs.push(...p.sectionXZ.map(q=>mm(q[0])));
 const edges=unique(xs),candidates=[];
 for(let i=0;i<edges.length-1;i++){const x=(edges[i]+edges[i+1])/2,intervals=contourIntervals(rings,0,x);for(const [y0,y1] of intervals)candidates.push({x,y0,y1,width:edges[i+1]-edges[i],height:y1-y0});}
 candidates.sort((a,b)=>b.height-a.height||b.width-a.width||a.x-b.x);
 if(!candidates.length)throw Error('No material station in physical FC');
 return candidates[0];
}
export function reviewPlinthAirPath(part,plan){
 const owners=plan?.physicalParts?.filter(p=>p.sourcePartId===part?.sourcePartId);
 if(owners?.length!==1||JSON.stringify(owners[0])!==JSON.stringify(part)||part.region!=='physical'||part.projection!==false||part.stockPart!==true||part.layer!==4||part.material!=='FC_P070')throw Error('Air-path review requires exact physical FC owner');
 const station=stationFor(part,plan),pieces=physicalPlinthSection(plan.physicalParts,part.face,station.x),selected=pieces.filter(p=>p.owner===part.sourcePartId);
 const relevant=pieces.filter(p=>{const b=bounds(p.ring);return b.y0<station.y1&&b.y1>station.y0;});
 const backing=relevant.filter(p=>p.layer===1||p.layer===2),profiles=relevant.filter(p=>p.layer===3),boardBack=Math.min(...selected.flatMap(p=>p.ring.map(q=>q[0]))),boardFront=Math.max(...selected.flatMap(p=>p.ring.map(q=>q[0])));
 if(!backing.length||!Number.isFinite(boardBack))return {schema:'mae7-plinth-air-path-v1',sourcePartId:part.sourcePartId,status:'no-resolved-backing',approved:false,ventilationApproved:false,geometryChanged:false,quantityAuthority:false,pieces,station};
 const backingFront=Math.max(...backing.flatMap(p=>p.ring.map(q=>q[0]))),box={z0:backingFront,z1:boardBack,y0:station.y0,y1:station.y1};
 const actual=sectionAirConnectivity(relevant.filter(p=>p.layer!==4).map(p=>p.ring),box),rear=profiles.length?Math.min(...profiles.flatMap(p=>p.ring.map(q=>q[0]))):null;
 // Move only the drawn profiles/FC in a separate comparison. Supporting
 // spacers, their anchors, openings, flashing and corner fit are NOT designed.
 const extraMm=25,comparisonPieces=pieces.map(p=>({...p,ring:p.ring.map(([z,y])=>[z+(p.layer===3||p.layer===4?extraMm:0),y])}));
 const comparisonBox={...box,z1:box.z1+extraMm},comparison=sectionAirConnectivity(comparisonPieces.filter(p=>p.layer!==4).map(p=>p.ring),comparisonBox);
 const centres=profiles.map(p=>{const b=bounds(p.ring);return (b.y0+b.y1)/2;}).sort((a,b)=>a-b),focus=centres[0]??(station.y0+station.y1)/2;
 return {schema:'mae7-plinth-air-path-v1',sourcePartId:part.sourcePartId,face:part.face,status:'section-reviewed',station,pieces,actual,
  dimensionsMm:{backingFront,boardBack,boardFront,cavity:boardBack-backingFront,behindHorizontalProfile:rear===null?null:rear-backingFront},
  rules:{boardBackToInsulationMinMm:20,behindOtherHorizontalProfileMinMm:25,perforatedVFLException:true,source:'Swisspearl Steel DIM2026-02 p13; project§5.3/ark09',manufacturerURL:'https://www.swisspearl.com/media/19900/download/Swisspearl%20Patina%20Design%20Line%20on%20Steel.pdf?inline=true&v=1'},
  comparison:{pieces:comparisonPieces,path:comparison,extraDepthMm:extraMm,boardBack:boardBack+extraMm,boardFront:boardFront+extraMm,cavity:boardBack+extraMm-backingFront,behindProfile:rear===null?null:rear+extraMm-backingFront,appliedTo3D:false,approved:false,quantityAuthority:false},
  drawingRangeMm:{y0:Math.max(station.y0,focus-90),y1:Math.min(station.y1,focus+90)},
  geometryChanged:false,ventilationApproved:false,approved:false,quantityAuthority:false,
  limits:'Single vertical section only; lateral bypass, profile perforations and inlet/outlet free areas are unresolved. Comparison has no support/anchor/flashing design and is not written into CAD, physical stock or 3D.'};
}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function plinthAirPathSVG(review,{comparison=false}={}){
 if(review.status!=='section-reviewed')return '';
 const pieces=comparison?review.comparison.pieces:review.pieces,r=review.drawingRangeMm,h=r.y1-r.y0,front=comparison?review.comparison.boardFront:review.dimensionsMm.boardFront,w=front+88,pad=42,id='air-'+(comparison?'compare':'actual')+'-'+review.sourcePartId.replace(/[^\w-]/g,''),point=([z,y])=>[z,r.y1-y];
 const colour={EPS_Perimeeter:'#e4dfb4',timber:'#b18b60',galvanized:'#6d8085',FC_P070:'#424b46',masonry:'#bac1b8'},path=ring=>ring.map((q,i)=>(i?'L':'M')+point(q).join(' ')).join(' ')+'Z';
 const d=review.dimensionsMm,gap=comparison?review.comparison.behindProfile:d.behindHorizontalProfile,cavity=comparison?review.comparison.cavity:d.cavity,profileRear=d.backingFront+(gap??0),arrowZ=d.backingFront+(comparison?12.5:cavity/2),endY=comparison?r.y1:Math.min(r.y1,Math.max(...(review.actual.route.map(q=>q[1])))-3),arrowBottom=Math.max(r.y0+6,Math.min(endY-8,r.y0+12)),safeArrow=endY>arrowBottom;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${pad} -${pad} ${w+pad} ${h+pad*2+28}" role="img" aria-label="${comparison?'Порівняння доданого проходу':'Фізичний вертикальний переріз'} ${esc(review.sourcePartId)}"><defs><clipPath id="${id}"><rect x="0" y="0" width="${front+1}" height="${h}"/></clipPath><marker id="${id}-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#39798c"/></marker></defs><rect x="${d.backingFront}" width="${(comparison?review.comparison.boardBack:d.boardBack)-d.backingFront}" height="${h}" fill="#e0edf0"/><g clip-path="url(#${id})">${pieces.map(p=>`<path data-section-owner="${esc(p.owner)}" d="${path(p.ring)}" fill="${colour[p.material]??'#a8b5ac'}" stroke="#46564d" stroke-width=".45"/>`).join('')}${safeArrow?`<path d="M${arrowZ} ${r.y1-arrowBottom}V${r.y1-endY}" fill="none" stroke="#39798c" stroke-width="1.8" marker-end="url(#${id}-arrow)"/>`:''}</g><g font-family="system-ui" fill="#22342d" font-size="11"><text x="0" y="-22" font-weight="600">${comparison?'Порівняння · додано 25 мм':'Фактичний переріз у моделі'}</text><text x="0" y="-9">Утеплення / брус</text><text x="${front+8}" y="17">FC 8 мм</text><text x="${front+8}" y="32">Профіль 25</text><text x="0" y="${h+26}">За профілем: ${gap===null?'невідомо':Math.round(gap)+' мм'}</text><text x="0" y="${h+40}">До плити: ${Math.round(cavity)} мм</text><text x="0" y="${h+54}" fill="${comparison?'#39798c':'#b25d35'}">${comparison?'У 3D не застосовано':review.actual.connected?'Прохід у цьому перерізі є':'Прохід у цьому перерізі перекрито'}</text></g><path d="M${d.backingFront} ${h+8}H${comparison?profileRear:d.boardBack}" fill="none" stroke="#39798c" stroke-width="1" marker-start="url(#${id}-arrow)" marker-end="url(#${id}-arrow)"/></svg>`;
}
