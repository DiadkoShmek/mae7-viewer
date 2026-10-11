// Ark09 (PDF57) specifies equal legs150, width60 and steel2.5mm.
// The square L-section represents those nominal dimensions; ordered product,
// bends, holes, anchors and attachment pitch still require a working detail.
export const plinthAngleCandidate=Object.freeze({height:.060,wallFlange:.150,steel:.0025,reach:.150,source:'PDF57/ark09:150x150x60x2.5mm',dimensionsSourceVerified:true,approved:false,product:null,anchors:null,verticalPitch:null,zincRequirement_g_m2:275});
const area=ps=>Math.abs(ps.reduce((n,p,i)=>{const q=ps[(i+1)%ps.length];return n+p[0]*q[1]-q[0]*p[1];},0))/2;
function clip(ps,k,e,sign){const out=[];for(let i=0;i<ps.length;i++){const a=ps[i],b=ps[(i+1)%ps.length],u=sign*(a[k]-e),v=sign*(b[k]-e);if(u<=1e-12)out.push(a);if(u*v<0){const f=u/(u-v);out.push(a.map((n,j)=>n+f*(b[j]-n)));}}return out;}
const inside=(ps,x,y)=>{let yes=false;for(let i=0,j=ps.length-1;i<ps.length;j=i++){const a=ps[i],b=ps[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const belongs=(c,p)=>{const a=c.outer[0],b=c.outer[1],n=Math.hypot(b[0]-a[0],b[1]-a[1]),x=(a[0]+b[0])/2-(b[1]-a[1])/n*1e-9,y=(a[1]+b[1])/2+(b[0]-a[0])/n*1e-9;return inside(p.outer,x,y)&&!p.holes.some(h=>inside(h,x,y));};
const valid=ps=>ps.length>=3&&area(ps)>1e-12;
function subtractRect(ps,r){const mid=clip(clip(ps,0,r.x0,-1),0,r.x1,1);return [clip(ps,0,r.x0,1),clip(ps,0,r.x1,-1),clip(mid,1,r.z0,1),clip(mid,1,r.z1,-1)].filter(valid);}
export function planPlinthSupports(face,timbers,rowCentres,height,cutouts){
 const s=plinthAngleCandidate,parts=[],unresolved=[];
 for(const timber of timbers){const xx=timber.sectionXZ.map(p=>p[0]),lo=Math.min(...xx),hi=Math.max(...xx),x=(lo+hi)/2;
  // The complete wall flange must touch the old base, not a miter/EPS overhang.
  const hands=[1,-1].filter(h=>h>0?hi+s.wallFlange<=face.width/2:lo-s.wallFlange>=-face.width/2);
  for(const [i,y] of rowCentres.entries()){
   const y0=y-s.height/2,y1=y+s.height/2;
   const hand=hands.find(h=>{
    const foot0=h>0?hi:lo,foot1=foot0+h*s.wallFlange;
    const x0=Math.min(lo,hi,foot0,foot1),x1=Math.max(lo,hi,foot0,foot1);
    return y0>=-height&&y1<=0&&!cutouts.some(o=>o.x0<x1&&o.x1>x0&&o.y0<y1&&o.y1>y0);
   });
   if(!hand){
    unresolved.push({timberId:timber.id,row:i+1,reason:!hands.length?'wall flange outside existing base':'both sides cross aperture or height bound',approved:false});continue;
   }
   const stem=hand>0?hi:lo,sectionXZ=[[0,0],[s.wallFlange,0],[s.wallFlange,s.steel],[s.steel,s.steel],[s.steel,s.reach],[0,s.reach]].map(([a,b])=>[stem+hand*a,b]);
   const id=timber.id+'-ANGLE-'+(i+1);
   parts.push({id,sourcePartId:id,face:face.code,layer:2,material:'galvanized',kind:'supportAngleY',sectionXZ,y0,y1,originX:x,hand,timberId:timber.id,
    source:s.source,approved:false,stockPart:false,quantityEligible:false,quantity:0,
    profileStatus:'Ark09 nominal150x150 legs/60width/2.5steel; square L without ordered bends/holes. Product, anchors, spacing and structural/thermal checks unresolved',candidate:s,
    rowStatus:'Display at hat rows only; not an approved vertical attachment pitch',recesses:[
     {x0:Math.min(stem,stem+hand*s.wallFlange),x1:Math.max(stem,stem+hand*s.wallFlange),y0,y1,z0:0,z1:s.steel},
     {x0:Math.min(stem,stem+hand*s.steel),x1:Math.max(stem,stem+hand*s.steel),y0,y1,z0:s.steel,z1:s.reach}
    ]});
  }
 }
 return {parts,unresolved};
}
export function recessPlinthEPS(p,cutters,{finish,rectangleContours}){
 if(p.kind==='compound'){const geometryPieces=p.geometryPieces.map(q=>recessPlinthEPS(q,cutters,{finish,rectangleContours}));return {...p,geometryPieces,volume:geometryPieces.reduce((a,q)=>a+q.volume,0)};}
 const xmin=p.kind==='contourZ'?p.blankBBox.x0:Math.min(...p.sectionXZ.map(q=>q[0])),xmax=p.kind==='contourZ'?p.blankBBox.x1:Math.max(...p.sectionXZ.map(q=>q[0]));
 const zmin=p.kind==='contourZ'?p.z0:Math.min(...p.sectionXZ.map(q=>q[1])),zmax=p.kind==='contourZ'?p.z1:Math.max(...p.sectionXZ.map(q=>q[1]));
 const ymin=p.kind==='contourZ'?p.blankBBox.y0:p.y0,ymax=p.kind==='contourZ'?p.blankBBox.y1:p.y1;
 const relevant=cutters.filter(r=>r.x0<xmax&&r.x1>xmin&&r.y0<ymax&&r.y1>ymin&&r.z0<zmax&&r.z1>zmin);
 if(!relevant.length)return p;
 const pieces=[];
 if(p.kind==='contourZ'){
  const zs=[...new Set([zmin,zmax,...relevant.flatMap(r=>[Math.max(zmin,r.z0),Math.min(zmax,r.z1)])])].sort((a,b)=>a-b);
  for(let i=0;i<zs.length-1;i++){const z0=zs[i],z1=zs[i+1],mid=(z0+z1)/2;
   // Shared construction edges can differ by a few binary ulps. Snap only
   // generated cutter endpoints within1pm to this existing contour lattice.
   const snap=(v,edges)=>edges.find(e=>Math.abs(v-e)<=1e-12)??v;
   const xe=[p.rectangleXY.x0,p.rectangleXY.x1,...p.cutouts.flatMap(r=>[r.x0,r.x1])],ye=[p.rectangleXY.y0,p.rectangleXY.y1,...p.cutouts.flatMap(r=>[r.y0,r.y1])];
   const cutouts=[...p.cutouts,...relevant.filter(r=>r.z0<mid&&r.z1>mid).map(({x0,x1,y0,y1})=>({x0:snap(x0,xe),x1:snap(x1,xe),y0:snap(y0,ye),y1:snap(y1,ye)}))];
   let contours;try{contours=rectangleContours(p.rectangleXY,cutouts);}catch(e){throw Error(p.id+' recess '+JSON.stringify({rectangle:p.rectangleXY,cutouts,z0,z1}),{cause:e});}
   for(const c of contours.filter(c=>belongs(c,p)))pieces.push({...p,...c,z0,z1,cutouts,volume:c.netAreaM2*(z1-z0)});
  }
 }else{
  const ys=[...new Set([ymin,ymax,...relevant.flatMap(r=>[Math.max(ymin,r.y0),Math.min(ymax,r.y1)])])].sort((a,b)=>a-b);
  for(let i=0;i<ys.length-1;i++){const y0=ys[i],y1=ys[i+1],mid=(y0+y1)/2;let sections=[p.sectionXZ];
   for(const r of relevant.filter(r=>r.y0<mid&&r.y1>mid))sections=sections.flatMap(ps=>subtractRect(ps,r));
   for(const sectionXZ of sections)pieces.push(finish({...p,sectionXZ,y0,y1}));
  }
 }
 if(!pieces.length)throw Error('Support recess consumed an entire EPS owner');
 return {...p,kind:'compound',geometryPieces:pieces,volume:pieces.reduce((a,q)=>a+q.volume,0),recessStatus:'Exact local candidate steel recess only; tolerance and sealing unresolved'};
}
