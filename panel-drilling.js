import {pointInPanelMaterial,planPanelFasteners,candidateFastenerAxis} from './panel-fastener-pattern.js';
export const drillingReference=Object.freeze({url:'https://www.swisspearl.com/media/27497/download/Global_Swisspearl_Facade_PatinaWood_DIM_EN_2026_02.pdf?inline=true&v=7',revision:'02.2026',page:12,diameterMM:8,sideEdgeMM:[25,100],endEdgeMM:[80,100],substructureDirection:'vertical',approved:false});
const rings=p=>[p.outer??[[p.x,p.y],[p.x+p.width,p.y],[p.x+p.width,p.y+p.height],[p.x,p.y+p.height]],...(p.holes??[])];
export function contourEdgeDistance(p,x,y){
 return Math.min(...rings(p).flatMap(r=>r.map(([ax,ay],i)=>{const [bx,by]=r[(i+1)%r.length],dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-ax-t*dx,y-ay-t*dy);}))); 
}
// Retain the user's60mm candidate; the manufacturer comparison is explicit.
// Bores are real geometry, but neither a drilling schedule nor an approval.
export function panelDrilling(part,points){
 const accepted=[],rejected=[];
 for(const p of points){
  const distance=contourEdgeDistance(part,p.x,p.y);
  if(!pointInPanelMaterial(part,p.x,p.y)||distance<=4.01){rejected.push({...p,reason:'8mm bore intersects contour/aperture'});continue;}
  accepted.push({...p,diameterMM:8,geometry:'through-bore',physical:false,quantityEligible:false,quantity:0,approved:false});
 }
 return {points:accepted,rejected,diameterMM:8,reference:drillingReference,approved:false,readyToDrill:false,fastenerProduct:null,fixingPointSchedule:null,
  edgeReview:{userEndMM:60,manufacturerEndMM:[80,100],compliant:false,reason:'60mm end offset is below DIM80mm; notched and small parts need individual fixing review'},
  manufacturerComparisonRows:candidateFastenerAxis(part.height,80).map(y=>part.y+y)};
}
export function planPanelDrilling(layout,fasteners=planPanelFasteners(layout)){
 const parts=layout.parts.map(p=>({panelId:p.id,...panelDrilling(p,fasteners.points.filter(h=>h.panelId===p.id))}));
 return {parts,points:parts.flatMap(p=>p.points),reference:drillingReference,physicalDrilledHoles:true,approved:false,readyToDrill:false,quantityEligible:false,fastenerProduct:null};
}
