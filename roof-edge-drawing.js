import {planRoofEdgeDetails,roofEdgeSpec} from './roof-edge-details.js';

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),copy=v=>structuredClone(v);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const fmt=n=>Number(n.toFixed(2)).toLocaleString('uk-UA');
const names={'eave-fascia':'Карнизна лобова дошка','eave-flashing':'Карнизна планка','eave-soffit':'Підшивка карниза','fascia-corner':'Кут лобової дошки','rake-fascia':'Торцева лобова дошка','rake-flashing':'Торцева планка','rake-soffit':'Підшивка торця'};

export function resolveRoofEdgeSelection(metadata,plan=planRoofEdgeDetails()){
 if(metadata?.assembly!=='roof-edge'||metadata.physical!==true||!metadata.partId||metadata.approved!==false)return null;
 const matches=plan.parts.filter(p=>p.id===metadata.partId);
 if(matches.length!==1)return null;
 const p=matches[0];
 if(!['box','prismX'].includes(p.kind)||p.physical===false||metadata.roofEdgeRole!==p.role||!same(metadata.authoring,p))return null;
 return {system:'roof-edge',id:p.id,physicalPart:copy(p)};
}

export function selectedRoofEdgeDrawing(selection,plan=planRoofEdgeDetails()){
 const parts=plan.parts.filter(p=>p.id===selection?.id);
 if(selection?.system!=='roof-edge'||parts.length!==1||!same(parts[0],selection.physicalPart)||!['box','prismX'].includes(parts[0].kind))throw Error('Selected roof edge differs from its physical owner');
 const p=copy(parts[0]);
 // Slice the existing extrusion in world YZ. Do not replace its folded sheet
 // or sloping timber with a bounding rectangle, or infer manufacturing stock.
 const polygon=p.kind==='prismX'?p.sectionYZ.map(([y,z])=>[z*1000,y*1000]):[
  [p.position[2]-p.size[2]/2,p.position[1]-p.size[1]/2],
  [p.position[2]+p.size[2]/2,p.position[1]-p.size[1]/2],
  [p.position[2]+p.size[2]/2,p.position[1]+p.size[1]/2],
  [p.position[2]-p.size[2]/2,p.position[1]+p.size[1]/2]].map(q=>q.map(v=>v*1000));
 if(polygon.length<3||polygon.some(q=>q.some(v=>!Number.isFinite(v))))throw Error('Invalid actual roof edge section');
 const zs=polygon.map(q=>q[0]),ys=polygon.map(q=>q[1]),z0=Math.min(...zs),z1=Math.max(...zs),y0=Math.min(...ys),y1=Math.max(...ys);
 const width=z1-z0,height=y1-y0;if(width<=0||height<=0)throw Error('Empty roof edge section');
 const area=Math.abs(polygon.reduce((n,[x,y],i)=>{const [a,b]=polygon[(i+1)%polygon.length];return n+x*b-a*y;},0))/2;
 const length=p.kind==='prismX'?p.length:p.size[0],startX=p.kind==='prismX'?p.x:p.position[0]-length/2;
 const scale=Math.min(360/width,320/height),left=100,top=85;
 const tr=([z,y])=>[left+(z-z0)*scale,top+(y1-y)*scale];
 const right=left+width*scale,bottom=top+height*scale,path=polygon.map((q,i)=>(i?'L':'M')+tr(q).map(n=>Number(n.toFixed(5))).join(' ')).join(' ')+' Z';
 const dim=(x0,y0,x1,y1,label,lx,ly)=>`<path d="M${x0} ${y0}L${x1} ${y1}" marker-start="url(#roof-edge-arrow)" marker-end="url(#roof-edge-arrow)"/><text x="${lx}" y="${ly}" text-anchor="middle" stroke="none"${x0===x1?` transform="rotate(90 ${lx} ${ly})"`:''}>${esc(label)}</text>`;
 const sourceThicknessMm=(p.material==='metal'?roofEdgeSpec.flashingThickness:roofEdgeSpec.soffitThickness)*1000;
 if(![sourceThicknessMm,length,startX,area].every(Number.isFinite)||length<=0||area<=0)throw Error('Invalid roof edge profile dimensions');
 const title=names[p.role];if(!title)throw Error('Unknown roof edge role');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 530" role="img" aria-label="${esc(title)}, фактичний профіль вибраної деталі" font-family="system-ui" font-size="17"><defs><marker id="roof-edge-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M10 5 0 0 0 10Z" fill="#29423c"/></marker></defs><rect width="560" height="530" rx="12" fill="#f5f6f1"/><text x="24" y="32" fill="#1f3b34" font-weight="650">${esc(title)} · переріз YZ</text><path data-roof-edge-owner="${esc(p.id)}" d="${path}" fill="${p.material==='metal'?'#59615f':'#c49a68'}" stroke="#40504a" stroke-width="1.3" stroke-linejoin="round"/><g fill="#29423c" stroke="#29423c" stroke-width="1.7"><path d="M${left} ${top}V55M${right} ${top}V55M${right} ${top}H${right+25}M${right} ${bottom}H${right+25}" opacity=".45"/>${dim(left,62,right,62,fmt(width)+' мм · Z',(left+right)/2,52)}${dim(right+20,top,right+20,bottom,fmt(height)+' мм · Y',right+45,(top+bottom)/2)}</g><text x="24" y="450" fill="#29423c">Товщина матеріалу: ${fmt(sourceThicknessMm)} мм · за проєктом</text><text x="24" y="477" fill="#29423c">Розміри Y / Z — проєкції профілю з 3D.</text><text x="24" y="504" fill="#61736d">Згини, стики та кріплення ще звіряємо.</text></svg>`;
 return {schema:'mae7-selected-roof-edge-v1',id:p.id,title,selection:copy(selection),physicalPart:p,polygonYZmm:polygon,
  dimensionsMm:{projectedZ:width,projectedY:height,extrusionX:length*1000,sourceThickness:sourceThicknessMm},
  areaMm2:area,modeledVolumeM3:area/1e6*length,stationX:startX+length/2,source:roofEdgeSpec.source,
  svg,approved:false,readyToBuild:false,readyToCut:false,quantityAuthority:false,geometryChanged:false,
  note:'Фактичний профіль у моделі. Довжини заготовок, радіуси згину, стики й кріплення ще не визначені; це креслення для звірки, не монтажний випуск.'};
}
