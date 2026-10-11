// A visual height field, not surveyed levels or a drainage design.
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function polygonDistance(x,z,ring){
 let inside=false,distance=Infinity;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [ax,az]=ring[j],[bx,bz]=ring[i],dx=bx-ax,dz=bz-az;
  const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));
  distance=Math.min(distance,Math.hypot(x-ax-t*dx,z-az-t*dz));
  if((az>z)!==(bz>z)&&x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside;
 }
 return inside?0:distance;
}
export function createTerrainRelief({halfX,halfZ,centreX=0,centreZ=0,flatContours=[]}){
 if(![halfX,halfZ].every(v=>Number.isFinite(v)&&v>0)||flatContours.some(r=>r.length<3||r.some(p=>p.length!==2||!p.every(Number.isFinite))))throw Error('Invalid terrain protection contours');
 const contours=flatContours.map(ring=>({ring,minX:Math.min(...ring.map(p=>p[0])),maxX:Math.max(...ring.map(p=>p[0])),minZ:Math.min(...ring.map(p=>p[1])),maxZ:Math.max(...ring.map(p=>p[1]))}));
 const height=(x,z)=>{
  if(![x,z].every(Number.isFinite))throw Error('Invalid terrain point');
  const fromApron=Math.hypot(Math.max(0,Math.abs(x-centreX)-halfX),Math.max(0,Math.abs(z-centreZ)-halfZ));
  if(fromApron===0)return 0;
  // smooth(clearance/3) is already 1 beyond 3m. An expanded contour box is
  // a conservative distance bound, so distant lawn vertices need no costly
  // scan of every road edge. Near walking contours use the exact same math.
  let clearance=Math.min(3,fromApron);
  for(const c of contours){
   const lowerBound=Math.hypot(Math.max(0,c.minX-x,x-c.maxX),Math.max(0,c.minZ-z,z-c.maxZ));
   if(lowerBound>=clearance+1)continue;
   clearance=Math.min(clearance,Math.max(0,polygonDistance(x,z,c.ring)-1));
   if(clearance===0)return 0;
  }
  if(clearance===0)return 0;
  const waves=.16*Math.sin(x/14+.4)*Math.cos(z/18)+.10*Math.sin((x+z)/24);
  const mound=.22*Math.exp(-((x+31)**2/280+(z+17)**2/180));
  const hollow=.12*Math.exp(-((x-27)**2/340+(z-30)**2/230));
  // Small lawn rolls near the house make the relief visible at yard scale.
  // Protected walking contours still reach the same flat datum smoothly.
  const yardRolls=.14*Math.exp(-((x+22)**2/15+(z-11)**2/12))
   +.12*Math.exp(-((x-13)**2/18+(z-10)**2/14))
   -.08*Math.exp(-((x+2)**2/20+(z+13)**2/16));
  const perimeter=smooth((250-Math.max(Math.abs(x),Math.abs(z)))/35);
  return (waves+mound-hollow+yardRolls)*smooth(clearance/3)*perimeter;
 };
 return {height,approved:false,surveyVerified:false,quantity:0,limits:'Illustrative low lawn undulations; apron and walking surfaces retain the existing flat display datum. No surveyed grading or drainage solution.'};
}
export function terrainGeometry(THREE,{halfX,halfZ,centreX=0,centreZ=0,height,extent=250,step=2,farStep=8,detailExtent=60}){
 const axis=(half,centre)=>{const a=[-extent,extent,centre-half,centre+half];for(let v=-detailExtent;v<=detailExtent;v+=step)a.push(v);for(let v=detailExtent;v<extent;v+=farStep)a.push(v,-v);return [...new Set(a)].sort((a,b)=>a-b);};
 const xs=axis(halfX,centreX),zs=axis(halfZ,centreZ),vertices=[],uv=[],indices=[];
 for(const z of zs)for(const x of xs){vertices.push(x,-z,height(x,z));uv.push(x,-z);}
 for(let j=0;j<zs.length-1;j++)for(let i=0;i<xs.length-1;i++){
  const x=(xs[i]+xs[i+1])/2,z=(zs[j]+zs[j+1])/2;
  if(Math.abs(x-centreX)<halfX&&Math.abs(z-centreZ)<halfZ)continue;
  const a=j*xs.length+i,b=a+1,c=a+xs.length,d=c+1;
  indices.push(a,c,b,b,c,d);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData={presentationOnly:true,physical:false,quantity:0,approved:false,terrainRelief:true,exactApronHole:true};
 return geometry;
}
