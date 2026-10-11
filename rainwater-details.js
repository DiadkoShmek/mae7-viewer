import {roofSpec,roofSide} from './roof-geometry.js';
import {roofFasciaSpec} from './roof-assembly.js';
import {balconyBays} from './assembly-geometry.js';
import {retainedReturnFootprints} from './balcony-returns.js';
import {planNWSourcePipeStations,nwRainwaterSource} from './rainwater-source.js';

export const rainwaterSpec=Object.freeze({gutterDiameter:.150,pipeDiameter:.090,steelThickness:.0006,
 source:'§5.4; PDF60 / арк12',approved:false});
const add=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,s)=>a.map(v=>v*s),sub=(a,b)=>a.map((v,i)=>v-b[i]);
const norm=a=>Math.hypot(...a),unit=a=>{const n=norm(a);if(!Number.isFinite(n)||n<1e-10)throw Error('Invalid rainwater direction');return scale(a,1/n);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function clearWallAxis(x,s,wallHalfLength){
 const low=-wallHalfLength+.1,high=wallHalfLength-.1,clamped=Math.max(low,Math.min(high,x));
 // NW uses world−localX. Include the existing60mm canopy overhang,
 //49mm clamp envelope and10mm clearance; no façade opening is moved.
 const forbidden=s<0?[
  ...balconyBays().map(b=>[-b.x-b.width/2-.119,-b.x+b.width/2+.119]),
  ...retainedReturnFootprints().map(r=>[r.min[0]-.059,r.max[0]+.059])
 ]:[];
 const choices=[clamped,...forbidden.flat()].filter(v=>v>=low&&v<=high&&forbidden.every(([a,b])=>v<=a+1e-10||v>=b-1e-10));
 if(!choices.length)throw Error('No clear wallpipe axis');
 return choices.sort((a,b)=>Math.abs(a-clamped)-Math.abs(b-clamped)||a-b)[0];
}
function arc(start,horizontal,radius,angle,reverse=false){
 const down=[0,-1,0],points=[],tangents=[];
 for(let i=0;i<=12;i++){const t=angle*i/12;
  const dv=reverse?Math.sin(angle)-Math.sin(angle-t):Math.sin(t),hv=reverse?Math.cos(angle-t)-Math.cos(angle):1-Math.cos(t),a=reverse?angle-t:t;
  points.push(add(start,scale(add(scale(down,dv),scale(horizontal,hv)),radius)));
  tangents.push(add(scale(down,Math.cos(a)),scale(horizontal,Math.sin(a))));
 }return {points,tangents};
}
function straight(a,b){const tangent=unit(sub(b,a));return {points:[a,b],tangents:[tangent,tangent]};}
export function planRainwaterDetails({outlets=[-20.3,-6.7,6.7,20.3],wallHalfLength=20.2,wallFace=5.649,pipeWallClearance=.040,
 elbowRadius=.120,clampMaximumSpacing=2,bottomY=-.28,rearSource=true}={}){
 for(const [k,v] of Object.entries({wallHalfLength,wallFace,pipeWallClearance,elbowRadius,clampMaximumSpacing}))if(!Number.isFinite(v)||v<=0)throw Error('Invalid '+k);
 if(!Number.isFinite(bottomY)||elbowRadius<=rainwaterSpec.pipeDiameter/2||!Array.isArray(outlets)||!outlets.length||outlets.some(x=>!Number.isFinite(x)))throw Error('Invalid rainwater path');
 if(new Set(outlets).size!==outlets.length)throw Error('Duplicate rainwater outlet');
 const pipes=[],gutters=[],radius=rainwaterSpec.pipeDiameter/2;
 for(const s of [1,-1]){
  const edge=roofSide(s),fasciaFront=edge.span-roofFasciaSpec.centreSetback+roofFasciaSpec.thickness/2;
  // Five millimetres clears the fascia; roof edge remains above the open bowl.
  const gutterZ=fasciaFront+rainwaterSpec.gutterDiameter/2+.005,gutterY=edge.edgeY-.11;
  const stations=s<0&&rearSource?planNWSourcePipeStations():null;
  const wallAxes=stations?stations.map(p=>p.x):outlets.map(x=>clearWallAxis(x,s,wallHalfLength));
  // NW inlet and real gutter hole share the actual paired elevation axis.
  // The source has no written axis dimension or outlet depth.
  const actualOutlets=s<0?[...wallAxes]:[...outlets];
  gutters.push({id:`RAIN-GUTTER-${s>0?'SE':'NW'}`,s,z:s*gutterZ,y:gutterY,length:roofSpec.length,outlets:actualOutlets,originalOutlets:[...outlets],outletPositionAuthority:stations?nwRainwaterSource.source+'; graphic display fit, not written axes':'graphic candidate; written/source outlet coordinates unknown',approved:false});
  for(const [i,outletX] of actualOutlets.entries()){
   if(Math.abs(outletX)+radius>=roofSpec.length/2)throw Error('Gutter outlet beyond roof');
   const station=stations?.[i],x=wallAxes[i],mountedFace=station?Math.abs(station.wallFace):wallFace,wallZ=mountedFace+pipeWallClearance+radius;
   // Both current overhangs fit two90-degree radius120 bends. The NW
   // source axis is kept; brackets use its actual finished return face.
   const angle=Math.PI/2;
   const inlet=[outletX,gutterY-rainwaterSpec.gutterDiameter/2,s*gutterZ],a=add(inlet,[0,-.10,0]),h=unit([x-outletX,0,s*(wallZ-gutterZ)]);
   const distance=Math.hypot(x-outletX,wallZ-gutterZ),length=(distance-2*elbowRadius*(1-Math.cos(angle)))/Math.sin(angle);
   if(length<=.020)throw Error('Roof overhang too short for two candidate elbows');
   const first=arc(a,h,elbowRadius,angle),b=first.points.at(-1),c=add(b,scale(first.tangents.at(-1),length)),second=arc(c,h,elbowRadius,angle,true),returnEnd=second.points.at(-1);
   if(returnEnd[1]<=bottomY+.5)throw Error('Rainwater return below usable wall');
   const id=`RAIN-${s>0?'SE':'NW'}-${i+1}`,parts=[{id:id+'-INLET',role:'inlet',...straight(inlet,a)},
    {id:id+'-ELBOW-1',role:'return-elbow',...first},{id:id+'-CONNECTOR',role:'return-connector',...straight(b,c)},
    {id:id+'-ELBOW-2',role:'return-elbow',...second},{id:id+'-DOWNPIPE',role:'downpipe',...straight(returnEnd,[x,bottomY,s*wallZ])}];
   for(const part of parts)part.frameNormal=unit(cross([0,-1,0],h));
   const shoe=arc([x,bottomY,s*wallZ],[0,0,s],elbowRadius,Math.PI/4),shoeEnd=shoe.points.at(-1),shoeTangent=shoe.tangents.at(-1);
   parts.push({id:id+'-SHOE-BEND',role:'outlet-bend',...shoe,frameNormal:[1,0,0]},
    {id:id+'-OUTLET',role:'outlet',...straight(shoeEnd,add(shoeEnd,scale(shoeTangent,.25))),frameNormal:[1,0,0]});
   // Keep the200mm backing in the wall's horizontal50 layer, above the
   // separate VS-1 plinth. These stations are display fits, not written levels.
   const low=Math.max(bottomY+.35,.150),high=returnEnd[1]-.35,n=Math.ceil((high-low)/clampMaximumSpacing);
   if(n<1)throw Error('No usable clamp interval');
   const clamps=Array.from({length:n+1},(_,k)=>({id:id+'-CLAMP-'+(k+1),position:[x,low+(high-low)*k/n,s*wallZ],wallFace:s*wallFace,
    backingRequirement:{source:'§5.5',sectionMM:[50,200],layer:'horizontal50',realizedInFacade:false,approved:false,...(station?{supportTarget:station.retainedWallReturnId,returnBackingDetail:null}:{})}}));
   for(const clamp of clamps)clamp.wallFace=s*mountedFace;
   pipes.push({id,x,s,outletX,originalOutletX:outlets[i],graphicCandidateDelta:outletX-outlets[i],sourceOutletPosition:null,graphicSource:station??null,retainedWallReturnId:station?.retainedWallReturnId??null,elbowDegrees:angle*180/Math.PI,parts,clamps,returnEnd,wallFace:s*mountedFace,pipeWallClearance,approved:false});
  }
 }
 return {pipes,gutters,spec:rainwaterSpec,approved:false,candidate:{elbowDegrees:{SE:90,NW:90},elbowRadius,clampMaximumSpacing,returnRoute:'Two tangent 90 degree candidate bends on both facades. Supplier product/radius, joints and drainage fall unresolved',wallPipePosition:'NW axes from the actual PDF53 paired pipe outlines; mounted on the current return front fit. Written axes, mounted depth and anchors unknown'},
  unknowns:['Ordered gutter profile, elbows, bend radii, collars, clamp/anchor capacities and spacing require manufacturer/site confirmation.',
   'Source50×200 timber backing is a requirement, not an installed overlapping solid; façade backing/pocket design remains unresolved.',
   'Outlet shoe and drainage routing are illustrative; source calls concrete drainage channels away from building.']};
}
function tube(THREE,p,radius,thickness){
 const vertices=[],indices=[],n=24,lat=p.frameNormal??unit(cross(p.tangents[0],norm(cross(p.tangents[0],[1,0,0]))>.1?[1,0,0]:[0,0,1]));
 if(p.tangents.some(t=>Math.abs(t.reduce((n,v,i)=>n+v*lat[i],0))>1e-9))throw Error('Pipe frame must be perpendicular to all path tangents');
 for(let k=0;k<p.points.length;k++){const other=unit(cross(lat,p.tangents[k]));for(const r of [radius,radius-thickness])for(let j=0;j<n;j++)vertices.push(...add(p.points[k],scale(add(scale(lat,Math.cos(j*2*Math.PI/n)),scale(other,Math.sin(j*2*Math.PI/n))),r)));}
 const quad=(a,b,c,d)=>indices.push(a,b,d,b,c,d);
 for(let k=0;k<p.points.length-1;k++)for(let j=0;j<n;j++){const q=(j+1)%n,a=k*2*n,b=(k+1)*2*n;quad(a+j,a+q,b+q,b+j);quad(a+n+j,b+n+j,b+n+q,a+n+q);}
 for(let j=0;j<n;j++){const q=(j+1)%n,end=(p.points.length-1)*2*n;quad(j,n+j,n+q,q);quad(end+j,end+q,end+n+q,end+n+j);}
 // lat×other points against the path tangent; reverse the shell winding so
 // outside faces are visible with the existing FrontSide PURAL material.
 for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function gutterGeometry(THREE,p,{radius=p.radius??rainwaterSpec.gutterDiameter/2,outletRadius=rainwaterSpec.pipeDiameter/2}={}){
 const shape=new THREE.Shape(),left=-p.length/2,right=p.length/2;
 shape.moveTo(left,0);shape.lineTo(right,0);shape.lineTo(right,Math.PI);shape.lineTo(left,Math.PI);shape.closePath();
 // Circular outlet in world XZ, mapped into the curved gutter section.
 for(const x of p.outlets){const hole=new THREE.Path(),r=outletRadius;
  for(let i=0;i<=32;i++){const a=-i*2*Math.PI/32,px=x+r*Math.cos(a),theta=Math.acos(r*Math.sin(a)/radius);i?hole.lineTo(px,theta):hole.moveTo(px,theta);}hole.closePath();shape.holes.push(hole);}
 const original=new THREE.ExtrudeGeometry(shape,{depth:rainwaterSpec.steelThickness,steps:1,bevelEnabled:false,curveSegments:24}),a=original.getAttribute('position'),positions=[];
 // Nonlinear mapping needs real angular subdivision: mapping only the four
 // rectangle corners would produce a flat plate, rather than a half-round bowl.
 function emit(points){const angles=points.map(v=>v[1]),low=angles.indexOf(Math.min(...angles)),high=angles.indexOf(Math.max(...angles));
  if(angles[high]-angles[low]>Math.PI/40){const mid=points[low].map((v,i)=>(v+points[high][i])/2),first=points.map(v=>v.slice()),second=points.map(v=>v.slice());first[high]=mid;second[low]=mid;emit(first);emit(second);return;}
  for(const [x,theta,depth] of points){const r=radius-depth;positions.push(x,p.y-r*Math.sin(theta),p.z+r*Math.cos(theta));}}
 for(let i=0;i<a.count;i+=3)emit([0,1,2].map(k=>[a.getX(i+k),a.getY(i+k),a.getZ(i+k)]));original.dispose();
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
export function gutterEndCapGeometry(THREE,p,endSign){
 const r=p.radius??rainwaterSpec.gutterDiameter/2,t=rainwaterSpec.steelThickness,shape=new THREE.Shape();
 // Solid semicircular end plate and short return collar, in the bowl's YZ plane.
 shape.moveTo(-r,0);for(let i=1;i<=40;i++){const a=Math.PI*i/40;shape.lineTo(-r*Math.cos(a),-r*Math.sin(a));}shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth:t,bevelEnabled:false,steps:1}),a=g.attributes.position;
 for(let i=0;i<a.count;i++){const z=a.getX(i),y=a.getY(i),x=a.getZ(i);a.setXYZ(i,endSign*(p.length/2+x),p.y+y,p.z+z);}
 // The right-hand mapping swaps X and Z. Keep both plates outward-facing.
 if(endSign>0)for(const attr of Object.values(g.attributes))for(let i=0;i<attr.count;i+=3)for(let k=0;k<attr.itemSize;k++){
  const j=(i+1)*attr.itemSize+k,q=(i+2)*attr.itemSize+k,v=attr.array[j];attr.array[j]=attr.array[q];attr.array[q]=v;
 }
 g.computeVertexNormals();return g;
}
export const gutterOutletReference=Object.freeze({
 url:'https://www.ruukki.com/est/katusetooted/tooted-ja-teenused/vihmaveesusteemid/umar-vihmaveesusteem/vihmaveesusteemi-detailid/allatulek-ee',
 scope:'Running-outlet form and lip retention reference only. Reference product is150/100; this150/90 model fit is a candidate, not the ordered product.',approved:false
});
export function planGutterOutlet(pipe,gutter){
 const r=gutter.radius??rainwaterSpec.gutterDiameter/2,t=rainwaterSpec.steelThickness,pipeR=rainwaterSpec.pipeDiameter/2;
 if(pipe.s!==gutter.s||!gutter.outlets.includes(pipe.outletX))throw Error('Running outlet must share the real gutter-hole axis');
 const inlet=pipe.parts.find(p=>p.role==='inlet');if(!inlet||Math.abs(inlet.points[0][0]-pipe.outletX)>1e-9||Math.abs(inlet.points[0][2]-gutter.z)>1e-9)throw Error('Inlet axis differs from gutter');
 return {id:pipe.id+'-GUTTER-OUTLET',x:pipe.outletX,y:gutter.y,z:gutter.z,s:pipe.s,
  gutterRadius:r,sheetThickness:t,saddleWidth:r*7/3,mouthRadius:Math.min(.062,r-.001),
  socketInnerRadius:pipeR+.0005,socketOuterRadius:pipeR+.0005+t,
  throatY:inlet.points[0][1]-.055,socketBottomY:inlet.points[0][1]-.080,
  pipeStart:inlet.points[0],pipeEnd:inlet.points[1],source:gutterOutletReference,approved:false};
}
function outletFunnelGeometry(THREE,p){
 const n=48,positions=[],indices=[],rings=3,t=p.sheetThickness;
 // The upper mouth follows the curved underside of the150mm gutter.
 // A hollow flare reaches the slip socket; neither end is a filled disk.
 for(const inner of [false,true])for(let k=0;k<rings;k++)for(let j=0;j<n;j++){
  const a=j*2*Math.PI/n,r=k===0?p.mouthRadius+(inner?0:t):(inner?p.socketInnerRadius:p.socketOuterRadius),z=r*Math.sin(a);
  const y=k===0?p.y-Math.sqrt((p.gutterRadius+t)**2-z*z):k===1?p.throatY:p.socketBottomY;
  positions.push(p.x+r*Math.cos(a),y,p.z+z);
 }
 const quad=(a,b,c,d)=>indices.push(a,b,d,b,c,d),side=rings*n;
 for(let k=0;k<rings-1;k++)for(let j=0;j<n;j++){
  const q=(j+1)%n,a=k*n,b=(k+1)*n;
  quad(a+j,a+q,b+q,b+j);quad(side+a+j,side+b+j,side+b+q,side+a+q);
 }
 for(let j=0;j<n;j++){const q=(j+1)%n,e=(rings-1)*n;quad(j,side+j,side+q,q);quad(e+j,e+q,side+e+q,side+e+j);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createGutterOutlet(THREE,parent,pipe,gutter,material){
 if(!material)throw Error('Running-outlet material required');
 const p=planGutterOutlet(pipe,gutter),meshes=[];
 const add=(geometry,suffix,role,position)=>{const m=new THREE.Mesh(geometry,material);m.name=p.id+suffix;m.castShadow=m.receiveShadow=true;
  if(position)m.position.set(...position);m.userData={partId:m.name,assembly:'rainwater',rainwaterRole:role,physical:true,dynamicCover:true,preservePhysicalProfile:true,
   gutterOutletId:p.id,connectedPipeId:pipe.id,authoring:p,sourceFacts:rainwaterSpec,candidateDimensions:true,approved:false};parent.add(m);meshes.push(m);return m;};
 // Thin saddle sits on the actual outer bowl, with a real open mouth.
 const saddle=gutterGeometry(THREE,{...gutter,length:p.saddleWidth,outlets:[0]},
  {radius:p.gutterRadius+p.sheetThickness,outletRadius:p.mouthRadius});saddle.translate(p.x,0,0);
 add(saddle,'-SADDLE','gutter-outlet-saddle');add(outletFunnelGeometry(THREE,p),'-FUNNEL','gutter-outlet-funnel');
 // Front lip and two rear retaining tabs capture the gutter edges.
 add(new THREE.BoxGeometry(p.saddleWidth,p.sheetThickness,.008),'-FRONT-LIP','gutter-outlet-retainer',[p.x,p.y+p.sheetThickness/2,p.z+p.s*(p.gutterRadius-.003)]);
 for(const [i,dx] of [-.055,.055].entries())add(new THREE.BoxGeometry(.024,p.sheetThickness,.012),'-REAR-TAB-'+(i+1),'gutter-outlet-retainer',
  [p.x+dx,p.y+p.sheetThickness/2,p.z-p.s*(p.gutterRadius-.004)]);
 return {plan:p,meshes};
}
export function createRainwaterDetails(THREE,parent,{materials={},...options}={}){
 if(!materials.PURAL_dark)throw Error('Rainwater PURAL material required');
 const plan=planRainwaterDetails(options),rainwaterGroups=[],gutters=[],radius=rainwaterSpec.pipeDiameter/2;
 const mesh=(geometry,id,role,owner,extra={})=>{const m=new THREE.Mesh(geometry,materials.PURAL_dark);m.name=id;m.castShadow=m.receiveShadow=true;m.userData={partId:id,assembly:'rainwater',rainwaterRole:role,physical:true,approved:false,preservePhysicalProfile:true,...extra};owner.add(m);return m;};
 for(const p of plan.gutters){gutters.push(mesh(gutterGeometry(THREE,p),p.id,'gutter',parent,{sourceFacts:rainwaterSpec}));
  for(const endSign of [-1,1])mesh(gutterEndCapGeometry(THREE,p,endSign),p.id+'-ENDCAP-'+(endSign>0?'R':'L'),'gutter-endcap',parent,{sourceFacts:rainwaterSpec,endSign,closedEnd:true});
 }
 for(const p of plan.pipes){const g=new THREE.Group();g.name=p.id;parent.add(g);g.userData={assembly:'rainwater',rainwaterId:p.id,originalOutletX:p.originalOutletX,outletX:p.outletX,graphicCandidateDelta:p.graphicCandidateDelta,sourceOutletPosition:null,graphicSource:p.graphicSource,retainedWallReturnId:p.retainedWallReturnId,elbowDegrees:p.elbowDegrees,approved:false,
   component:{kind:'rainwater',title:'Водостічна труба · Ø90',source:rainwaterSpec.source,note:'Два коліна повертають трубу до стіни. Профіль, положення, хомути, анкери й підкладний брус50×200 потребують робочого рішення.'}};
  for(const part of p.parts)mesh(tube(THREE,part,radius,rainwaterSpec.steelThickness),part.id,part.role,g,{sourceFacts:rainwaterSpec,authoring:part});
  createGutterOutlet(THREE,g,p,plan.gutters.find(q=>q.s===p.s),materials.PURAL_dark);
  for(const c of p.clamps){const ringPath=straight(add(c.position,[0,-.012,0]),add(c.position,[0,.012,0]));mesh(tube(THREE,ringPath,radius+.004,.002),c.id,'wall-clamp',g,{backingRequirement:c.backingRequirement,candidateDimensions:true});
   const back=mesh(new THREE.BoxGeometry(.060,.080,.003),c.id+'-PLATE','clamp-wallplate',g,{backingRequirement:c.backingRequirement,candidateDimensions:true});back.position.set(p.x,c.position[1],c.wallFace+p.s*.0015);
   const rear=c.position[2]-p.s*(radius+.004),start=c.wallFace+p.s*.003,stem=mesh(new THREE.BoxGeometry(.012,.025,Math.abs(rear-start)),c.id+'-STANDOFF','clamp-standoff',g,{candidateDimensions:true});stem.position.set(p.x,c.position[1],(rear+start)/2);
  }
  g.traverse(o=>{if(o.isMesh)o.userData.dynamicCover=true;});rainwaterGroups.push({g,x:p.x,s:p.s,outletX:p.outletX});
 }
 return {rainwaterGroups,gutters,plan};
}
