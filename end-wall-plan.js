import {roofExteriorTop} from './roof-geometry.js';
// Ark06's written chain includes the retained return. Ark02 differs by 5mm.
// The SE finished plane is the display datum; core depth still needs survey.
export const endWallSpec=Object.freeze({widthMM:11885,frontZ:5.649,rearZ:-6.236,planeX:20.230,source:'Ark06/PDF54: 845+5580+5260+200=11885mm; Ark02/PDF50:11890mm',approved:false});
export function endWallFrame(code){
 if(!['SW','NE'].includes(code))throw Error('Invalid end wall');
 const min=code==='SW'?-endWallSpec.frontZ:endWallSpec.rearZ;
 return {min,max:min+endWallSpec.widthMM/1000,centre:min+endWallSpec.widthMM/2000,originMM:-min*1000,worldZ:x=>code==='SW'?-x:x};
}
function clip(ps,fn){const out=[];for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],u=fn(a),v=fn(b);if(u<=1e-7)out.push(a);if(u*v<0){const t=u/(u-v);out.push(a.map((x,k)=>x+(b[k]-x)*t));}}return out;}
export function clipEndWall(layout){
 const f=endWallFrame(layout.facade),top=x=>roofExteriorTop(f.worldZ(x/1000+f.min))*1000,area=ps=>Math.abs(ps.reduce((s,a,i)=>{const b=ps[(i+1)%ps.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
 const parts=layout.parts.flatMap(p=>{
  const outer=p.outer??[[p.x,p.y],[p.x+p.width,p.y],[p.x+p.width,p.y+p.height],[p.x,p.y+p.height]];
  // Two half planes meet at the ridge, which is off the end-wall centre.
  const ridge=-f.min*1000;
  let ps=clip(outer,([x,y])=>y-(top(0)+(top(ridge)-top(0))*x/ridge));
  ps=clip(ps,([x,y])=>y-(top(ridge)+(top(layout.width)-top(ridge))*(x-ridge)/(layout.width-ridge)));
  if(ps.length<3||area(ps)<1)return [];
  const x=Math.min(...ps.map(a=>a[0])),y=Math.min(...ps.map(a=>a[1])),right=Math.max(...ps.map(a=>a[0])),high=Math.max(...ps.map(a=>a[1]));
  const holes=p.holes??[],areaMm2=area(ps)-holes.reduce((s,h)=>s+area(h),0);
  return [{...p,x,y,width:right-x,height:high-y,outer:ps,points:ps,holes,areaMm2,profileArea:areaMm2,fullEndWall:true}];
 });
 return {...layout,fullEndWall:true,localCentre:f.centre,parts,area:parts.reduce((s,p)=>s+p.areaMm2,0)/1e6,approved:false,readyToCut:false};
}
