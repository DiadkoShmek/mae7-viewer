import {candidateFastenerAxis} from './panel-fastener-pattern.js';
export function plinthBoardContour(p){
 if(p.kind==='contourZ')return {outer:p.outer,holes:p.holes??[],z0:p.z0,z1:p.z1};
 if(p.kind!=='prismY')throw Error('Unsupported FC plinth contour');
 const xs=p.sectionXZ.map(a=>a[0]),zs=p.sectionXZ.map(a=>a[1]);
 return {outer:[[Math.min(...xs),p.y0],[Math.max(...xs),p.y0],[Math.max(...xs),p.y1],[Math.min(...xs),p.y1]],holes:[],z0:Math.min(...zs),z1:Math.max(...zs)};
}
export function plinthBoardDrills(p){
 const {outer,holes}=plinthBoardContour(p),x0=Math.min(...outer.map(a=>a[0])),y0=Math.min(...outer.map(a=>a[1])),w=Math.max(...outer.map(a=>a[0]))-x0,h=Math.max(...outer.map(a=>a[1]))-y0;
 const inside=(q,r)=>{let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 const clear=q=>[outer,...holes].every(r=>r.every((a,i)=>{const b=r[(i+1)%r.length],u=b[0]-a[0],v=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*u+(q[1]-a[1])*v)/(u*u+v*v)));return Math.hypot(q[0]-a[0]-u*t,q[1]-a[1]-v*t)>.0041;}));
 const points=[];for(const x of candidateFastenerAxis(w*1000,30))for(const y of candidateFastenerAxis(h*1000,60)){const q=[x0+x/1000,y0+y/1000];if(inside(q,outer)&&!holes.some(r=>inside(q,r))&&clear(q))points.push({x:q[0],y:q[1],diameterMM:8,approved:false});}return points;
}
export function drilledPlinthBoardGeometry(THREE,p){
 const c=plinthBoardContour(p),shape=new THREE.Shape();const ring=(path,ps)=>{ps.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));path.closePath();};ring(shape,c.outer);for(const ps of c.holes){const h=new THREE.Path();ring(h,ps);shape.holes.push(h);}for(const d of plinthBoardDrills(p)){const h=new THREE.Path();h.absarc(d.x,d.y,.004,0,Math.PI*2,true);shape.holes.push(h);}return new THREE.ExtrudeGeometry(shape,{depth:c.z1-c.z0,steps:1,bevelEnabled:false,curveSegments:12}).translate(0,0,c.z0);
}
