import {applyFibreSurfaceUV} from './fc-surface-uv.js';
import {pointInPanelMaterial} from './panel-fastener-pattern.js';
import {contourEdgeDistance} from './panel-drilling.js';
// Runtime comparison of a complete cut blank. Not a fabricated native part.
export function panelContourGeometry(THREE,part,layoutWidth,{drills=[],localCentre=0}={}){
 if(!Number.isFinite(layoutWidth)||layoutWidth<=0||!part.outer?.length)throw Error('Invalid contour geometry');
 const shape=new THREE.Shape();
 function ring(path,points){
  // Triangulate with the vertical axis first. Earcut's horizontal hole
  // bridges can skip aligned bores in a sloped top blank. Rotate the input
  // by exactly 90 degrees, then undo it on every output vertex.
  points.forEach(([x,y],i)=>{if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Invalid contour point');const px=y/1000,py=-(x/1000-layoutWidth/2000);i?path.lineTo(px,py):path.moveTo(px,py);});path.closePath();
 }
 ring(shape,part.outer);
 for(const points of part.holes||[]){const hole=new THREE.Path();ring(hole,points);shape.holes.push(hole);}
 for(const p of drills){
  if(![p.x,p.y,p.diameterMM].every(Number.isFinite)||p.diameterMM!==8||!pointInPanelMaterial(part,p.x,p.y)||contourEdgeDistance(part,p.x,p.y)<=4.01)throw Error('Unbound/intersecting drilling bore');
  const hole=new THREE.Path();hole.absarc(p.y/1000,-(p.x/1000-layoutWidth/2000),p.diameterMM/2000,0,Math.PI*2,true);shape.holes.push(hole);
 }
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:false,steps:1});
 for(const key of ['position','normal']){const a=geometry.attributes[key];for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i);a.setXY(i,-y,x);}}
 geometry.translate(localCentre,0,.021);geometry.userData={drilledBores:drills.length,diameterMM:drills.length?8:null,approved:false};return applyFibreSurfaceUV(THREE,geometry,part.grain);
}
