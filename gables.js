import {blankContours} from './panel-blank-shapes.js';
import {makeLayout} from './engineering.js';
import {roofSpec,roofSurfaceY,roofSlope} from './roof-geometry.js';
// Convex clipping in facade millimetres. Stock envelopes are distinct from
// finished profiles: the guillotine trace produces blanks, not angled cuts.
export function clipHalfPlane(points,a,b,c){
 const out=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],q=points[(i+1)%points.length],fp=a*p[0]+b*p[1]-c,fq=a*q[0]+b*q[1]-c;
  if(fp<=1e-8)out.push(p);
  if((fp<0&&fq>0)||(fp>0&&fq<0)){const t=fp/(fp-fq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
 }
 return out;
}
export function polygonArea(points){return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;}
export function gableLayout(facade='SW',module=840,offset=0,{panelHeight=0}={}){
 if(!['SW','NE'].includes(facade))throw Error('Unknown gable');
 const width=11240,height=Math.round((roofSpec.ridge-roofSpec.attic)*1000);
 // SW local +X points toward the rear (-Z); NE local +X toward the front.
 // The upper wall includes a vertical attic band. It is not a triangle that
 // starts at the eaves. Crop below the actual candidate timber/roof envelope.
 const leftSign=facade==='SW'?1:-1,rightSign=-leftSign;
 const leftSlope=roofSlope(leftSign),rightSlope=roofSlope(rightSign);
 const clearance=slope=>roofSpec.envelopeDepth*Math.sqrt(1+slope*slope)+.004;
 const leftTop=(roofSurfaceY(leftSign*width/2000)-roofSpec.attic-clearance(leftSlope))*1000;
 const rightTop=(roofSurfaceY(rightSign*width/2000)-roofSpec.attic-clearance(rightSlope))*1000;
 const openings=facade==='SW'?[{id:'A08',x:5341,y:1195,width:500,height:800,kind:'A08',positionStatus:'PDF54-vector; written dimensions'}]:[{id:'VENT',x:5220,y:1195,width:800,height:400,kind:'вентрешітка',positionStatus:'PDF54 seq5528 aspect2:1;800×400 graphic candidate, centre/size require survey'}];
 const layout=makeLayout({width,height,module,offset,joint:8,levels:[0,height],panelHeight,openings,facade:facade+'G',accentBands:[]}),parts=[];
 for(const p of blankContours(layout)){
  let points=p.outer;
  points=clipHalfPlane(points,-leftSlope,1,leftTop);
  points=clipHalfPlane(points,rightSlope,1,rightTop+rightSlope*width);
  if(points.length<3||polygonArea(points)<1)continue;
  const x=Math.floor(Math.min(...points.map(p=>p[0]))),y=Math.floor(Math.min(...points.map(p=>p[1]))),right=Math.ceil(Math.max(...points.map(p=>p[0]))),top=Math.ceil(Math.max(...points.map(p=>p[1])));
  parts.push({...p,x,y,width:right-x,height:top-y,points,outer:points,holes:p.holes,profileArea:polygonArea(points)-p.holes.reduce((a,h)=>a+polygonArea(h),0),status:'профільований кандидат; розкрій заготовки не завершує деталь',warnings:[...p.warnings,'Скіс, крайові відстані й опори перевірити за робочим вузлом']});
 }
 return {...layout,parts,facade:facade+'G',profile:'attic-band-pentagon',
  roofBoundary:{leftTop,rightTop,leftSlope,rightSlope,clearanceNote:'214,8 мм по нормалі: кандидат крокви150 + нові шари64,8; зазор4 мм. Вузол до звірки.'},
  scope:'Верхній торець від рівня горища +8,525: вертикальний пояс і два схили за графічним кандидатом PDF55. Габарит11240×2584; обрізка під кандидатом повного даху. Крокви, вентрешітка та робочі розміри потребують уточнення.',
  area:parts.reduce((s,p)=>s+p.profileArea,0)/1e6,blankArea:parts.reduce((s,p)=>s+p.width*p.height,0)/1e6,approved:false};
}
