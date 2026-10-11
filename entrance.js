// Source-facing entrance parts. Metres; local z+ is outward from SE facade.
// PDF53 graphic elevation and PDF68 node20 nominal detail remain distinct.
import {addEntranceContext} from './entrance-context.js';
export const entranceCentres=Object.freeze([-13.1846,-.0889,13.1211]);
export const entranceSpec=Object.freeze({
 width:2.730,depth:1.345,doorWidth:2.305,doorHeight:2.100,leafWidths:[1.015,1.290],
 threshold:-0.6000943099654182,ground:-.660,canopyWallTop:1.955863056692844,
 pitch:Math.PI/12,canopyFront:1.385,canopyBack:-.030,
 steel:{width:2.660,depth:1.100,rearHeight:.425,section:[.080,.100],wall:.005,grade:'S355JR'},
 counter:[.032,.050],roofLath:[.032,.100],soffitBatten:[.025,.100],presentationDoorClearance:.018,
 frame:.065,board:.008,flashing:.0006,gutterDiameter:.100,downpipeDiameter:.090,
 doorPlane:-.300,openingFit:.020,thresholdProfile:.020,landingSlope:.020,landingThickness:.150,
 approved:false,rfi:'RFI06',
 evidence:{nominal:'PDF68 / node20; §5.8.1',elevation:'PDF53: datum293.06; door264.74..304.40; roof256.10; scale763.44/40.4 pt/m',
  candidate:'Ground−660mm, outer vestibule envelope and18mm door-to-soffit clearance are presentation candidates. PDF53 roofdatum1.956 is preserved separately from the assembled candidate roof. RFI06/RFI10 require survey and contractor job drawings.'}
});

const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,t)=>a.map(v=>v*t);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=v=>Math.sqrt(dot(v,v)),unit=v=>mul(v,1/length(v));
function boxSolid(size,position=[0,0,0],rotation=[0,0,0]){
 const [sx,sy,sz]=size.map(v=>v/2),[a,b,c]=rotation;
 const rotate=p=>{let [x,y,z]=p;[x,y]=[x*Math.cos(c)-y*Math.sin(c),x*Math.sin(c)+y*Math.cos(c)];[x,z]=[x*Math.cos(b)+z*Math.sin(b),-x*Math.sin(b)+z*Math.cos(b)];[y,z]=[y*Math.cos(a)-z*Math.sin(a),y*Math.sin(a)+z*Math.cos(a)];return add([x,y,z],position);};
 return {vertices:[[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],[-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]].map(rotate),faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]]};
}
function clipSolid(s,plane){
 const signed=p=>dot(plane.normal,p)-plane.constant,polygons=[],cuts=[];
 if(!s.vertices.some(p=>signed(p)>1e-11))return s;
 for(const f of s.faces){const points=f.map(i=>s.vertices[i]),out=[];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],fa=signed(a),fb=signed(b);if(fa<=1e-11)out.push(a);if(Math.abs(fa)<=1e-11)cuts.push(a);if((fa< -1e-11&&fb>1e-11)||(fa>1e-11&&fb< -1e-11)){const p=add(a,mul(sub(b,a),fa/(fa-fb)));out.push(p);cuts.push(p);}}
  if(out.length>=3)polygons.push(out);
 }
 const unique=[];for(const p of cuts)if(!unique.some(q=>length(sub(p,q))<1e-10))unique.push(p);
 if(unique.length>=3){const n=unit(plane.normal),u=unit(cross(Math.abs(n[0])<.8?[1,0,0]:[0,1,0],n)),v=cross(n,u),centre=mul(unique.reduce(add,[0,0,0]),1/unique.length);unique.sort((a,b)=>Math.atan2(dot(sub(a,centre),v),dot(sub(a,centre),u))-Math.atan2(dot(sub(b,centre),v),dot(sub(b,centre),u)));polygons.push(unique);}
 const vertices=[],faces=polygons.map(ps=>ps.map(p=>{let i=vertices.findIndex(q=>length(sub(p,q))<1e-10);if(i<0){i=vertices.length;vertices.push(p);}return i;}));return {vertices,faces};
}
function solidVolume(s){let volume=0;for(const f of s.faces)for(let i=1;i<f.length-1;i++)volume+=dot(s.vertices[f[0]],cross(s.vertices[f[i]],s.vertices[f[i+1]]))/6;return Math.abs(volume);}
function partBounds(points){return {min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))};}
const roofUnder=()=>entranceSpec.threshold+entranceSpec.doorHeight+entranceSpec.presentationDoorClearance;
const steelBottom=()=>roofUnder()+entranceSpec.board+entranceSpec.soffitBatten[0];
const steelTop=z=>steelBottom()+entranceSpec.steel.rearHeight-z*Math.tan(entranceSpec.pitch);
const roofStack=.0002+.032+.032+.0006; // Underlay display thickness only; source does not specify thickness.
function subtractBox(base,cut){
 const low=base.min.map((v,i)=>Math.max(v,cut.min[i])),high=base.max.map((v,i)=>Math.min(v,cut.max[i]));
 if(low.some((v,i)=>v>=high[i]-1e-12))return [base];
 const pieces=[];let min=[...base.min],max=[...base.max];
 for(let i=0;i<3;i++){if(min[i]<low[i]-1e-12){const end=[...max];end[i]=low[i];pieces.push({min:[...min],max:end});min[i]=low[i];}if(max[i]>high[i]+1e-12){const start=[...min];start[i]=high[i];pieces.push({min:start,max:[...max]});max[i]=high[i];}}
 return pieces;
}
export function entranceCanopyY(z){return steelTop(z)+roofStack/Math.cos(entranceSpec.pitch);}
export function planEntrance(){
 const s=entranceSpec,w=s.width,d=s.depth,h=s.doorHeight,t=s.threshold,head=t+h,a=s.pitch,c=Math.cos(a),f=s.frame,parts=[];
 const box=(id,size,position,material,rotation=[0,0,0],evidence='PDF68/node20',extra={})=>{const solid=boxSolid(size,position,rotation);parts.push({id,kind:'box',size,position,rotation,material,evidence,quantity:1,volume:size.reduce((s,x)=>s*x,1),bounds:partBounds(solid.vertices),...extra});};
 const prism=(id,profile,width,x,material,evidence='PDF68/node20',extra={})=>{const area=Math.abs(profile.reduce((n,p,i)=>{const q=profile[(i+1)%profile.length];return n+p[0]*q[1]-q[0]*p[1];},0))/2;parts.push({id,kind:'prismX',profile,width,x,material,evidence,quantity:1,volume:area*width,bounds:partBounds(profile.flatMap(([z,y])=>[[x-width/2,y,z],[x+width/2,y,z]])),...extra});};
 const tube=(id,radius,cutLength,position,material)=>parts.push({id,kind:'tubeY',radius,thickness:s.flashing,length:cutLength,cutLength,position,material,evidence:'§5.8.1:90mm downpipe,0.6mmPURAL',quantity:1,volume:Math.PI*(radius**2-(radius-s.flashing)**2)*cutLength,bounds:{min:[position[0]-radius,position[1]-cutLength/2,position[2]-radius],max:[position[0]+radius,position[1]+cutLength/2,position[2]+radius]}});
 const rhs=(id,origin,basis,cutLength,planes=[])=>{
  const [u,v]=s.steel.section,wall=s.steel.wall;
  const webs=[[[wall,v,cutLength],[-u/2+wall/2,0,0]],[[wall,v,cutLength],[u/2-wall/2,0,0]],[[u-2*wall,wall,cutLength],[0,-v/2+wall/2,0]],[[u-2*wall,wall,cutLength],[0,v/2-wall/2,0]]];
  const solids=webs.map(([size,p])=>{const b=boxSolid(size,p);b.vertices=b.vertices.map(q=>add(origin,add(add(mul(basis.u,q[0]),mul(basis.v,q[1])),mul(basis.axis,q[2]))));return planes.reduce(clipSolid,b);}).filter(b=>b.vertices.length&&solidVolume(b)>1e-13);
  const section={outer:[u,v],inner:[u-2*wall,v-2*wall],wall,grade:s.steel.grade,finish:'hot-dip galvanized C3',cornerRadius:null};
  const ring=(x,y)=>[[-x/2,-y/2],[x/2,-y/2],[x/2,y/2],[-x/2,y/2]];
  parts.push({id,kind:'rhs',material:'steel',evidence:'PDF70/node22; §5.8.1',quantity:1,section,cutLength,volume:solids.reduce((n,b)=>n+solidVolume(b),0),bounds:partBounds(solids.flatMap(s=>s.vertices)),solids,
   geometry:{outerSection:ring(u,v),innerSection:ring(u-2*wall,v-2*wall),length:cutLength,origin,basis,clipPlanes:planes},placementStatus:'nominal source principle with presentation cut planes; contractor job drawings required',unknown:{miterApproved:false,cornerRadius:null,endClosures:null,ventDrainHoles:null,welds:null,anchors:null}});
 };
 const bottom=steelBottom(),depth=s.steel.depth,tan=Math.tan(a);
 // A rotated transverse RHS spans103.156mm in global depth. Clipping it to
 //80mm cuts both side walls along its entire axis and splits the real tube.
 // Keep all four transverse rings whole; fit only longitudinal tube ends.
 const upperBand=s.steel.section[0]*c+s.steel.section[1]*Math.sin(a);
 const lowerRearZ=.040,lowerFrontZ=depth-upperBand-.040;
 const upperRearZ=upperBand/2,upperFrontZ=depth-upperBand/2;
 const roofBasis={u:[1,0,0],v:[0,c,Math.sin(a)],axis:[0,-Math.sin(a),c]},across={u:[0,Math.sin(a),-c],v:[0,c,Math.sin(a)],axis:[1,0,0]};
 const ribXs=[-1.29,-.9,-.3,.3,.9,1.29];
 for(const [i,x] of ribXs.entries()){
  const lowerStart=.080,lowerEnd=lowerFrontZ-.040;
  rhs(`entrance-steel-lower-${i+1}`,[x,bottom+.05,(lowerStart+lowerEnd)/2],{u:[1,0,0],v:[0,1,0],axis:[0,0,1]},lowerEnd-lowerStart);
  const zmid=depth/2;
  const cope={normal:[0,-1,0],constant:-(bottom+.100),keep:'negative',reason:'candidate longitudinal front cope above intact horizontal lower RHS; contractor end-fit drawings required'};
  rhs(`entrance-steel-upper-${i+1}`,[x,steelTop(zmid)-.05/c,zmid],roofBasis,(upperFrontZ-upperRearZ)/c-.080,[cope]);
 }
 for(const [id,lowerZ,upperZ] of [['rear',lowerRearZ,upperRearZ],['front',lowerFrontZ,upperFrontZ]]){
  rhs(`entrance-steel-lower-${id}`,[0,bottom+.05,lowerZ],{u:[0,0,-1],v:[0,1,0],axis:[1,0,0]},s.steel.width);
  rhs(`entrance-steel-upper-${id}`,[0,steelTop(upperZ)-.05/c,upperZ],across,s.steel.width);
 }
 const rearUprightTop=steelTop(0)-.100/c,rearUprightBottom=bottom+.100,rearUprightLength=rearUprightTop-rearUprightBottom;
 for(const sign of [-1,1]){
  rhs(`entrance-steel-rear-upright-${sign}`,[sign*1.29,(rearUprightTop+rearUprightBottom)/2,.050],{u:[1,0,0],v:[0,0,-1],axis:[0,1,0]},rearUprightLength,
   [{normal:[0,1,tan],constant:rearUprightTop,keep:'negative',reason:'candidate rear upright top fit to actual rotated upper RHS underside'}]);
  const p=parts.at(-1);p.sourceClearGap=.225;p.finishedHeightRange=[rearUprightLength-.100*tan,rearUprightLength];p.unknown.countApproval=null;p.placementStatus='two mirrored outer side-frame upright candidates; source225mm retained separately; actual rotated end fit requires job drawings';
 }
 const roofDepth=(s.canopyFront-s.canopyBack)/c,zmid=(s.canopyFront+s.canopyBack)/2;
 const pitched=(id,width,thickness,z0,z1,normalTop,material,evidence,extra={})=>{const z=(z0+z1)/2;box(id,[width,thickness,(z1-z0)/c],[extra.x??0,steelTop(z)+(normalTop-thickness/2)/c,z],material,[a,0,0],evidence,{...extra,cutLength:(z1-z0)/c,placementStatus:'presentation layout',normalRange:[normalTop-thickness,normalTop]});};
 pitched('entrance-roof-underlay',w,.0002,s.canopyBack,s.canopyFront,.0002,'underlay','§5.8.1:nonbreathing underlay; thickness0.2mm is display only',{unknown:{thickness:null,product:null}});
 for(const [i,x] of ribXs.entries())pitched(`entrance-counter-${i+1}`,.050,.032,0,depth,.0322,'wood','§5.8.1:32×50H3',{x,section:[.032,.050]});
 const innerWidth=w-2*s.board;
 for(const [i,z] of [.05,depth/2,depth-.05].entries())pitched(`entrance-roof-lath-${i+1}`,innerWidth,.032,z-.05*c,z+.05*c,.0642,'wood','§5.8.1:32×100H3; pitch per roofing manufacturer, not specified',{section:[.032,.100],unknown:{pitch:null,fasteners:null}});
 pitched('entrance-roof-skin',w,s.flashing,s.canopyBack,s.canopyFront,roofStack,'metal','§5.8.1:ClassicPURAL0.6;15°',{unknown:{standingSeamPitch:null,profileHeight:null},profileStatus:'flat cover envelope; Classic seam profile not specified'});
 const battenCount=Math.ceil((innerWidth-.100)/.400)+1,battenPitch=(innerWidth-.100)/(battenCount-1);
 for(let i=0;i<battenCount;i++)box(`entrance-soffit-batten-${i+1}`,[.100,.025,s.canopyFront-s.canopyBack],[-innerWidth/2+.05+i*battenPitch,bottom-.0125,zmid],'wood',[0,0,0],'PDF68:25×100H3;420source vs Swisspearl ceiling400max conflict',{section:[.025,.100],cutLength:s.canopyFront-s.canopyBack,placementStatus:'candidate ≤400mm centres inside sideFC8; RFI10; source420 retained'});
 const joint=.008,soffitMid=(s.canopyBack+s.canopyFront)/2;
 for(const [id,z0,z1] of [['entrance-soffit',s.canopyBack,soffitMid-joint/2],['entrance-soffit-front',soffitMid+joint/2,s.canopyFront]])box(id,[w,s.board,z1-z0],[0,roofUnder()+s.board/2,(z0+z1)/2],'board',[0,0,0],'§5.8.1:FC8; two-board8mm-joint layout candidate',{joint,placementStatus:'candidate cut layout, not stock procurement'});
 const postPockets=[];
 for(const sign of [-1,1])for(const pair of [-1,1]){
  const x=sign*(w/2-s.board-.050)+pair*.025,z=lowerFrontZ;
  box(`entrance-front-post-${sign}-${pair}`,[.050,bottom-t,.150],[x,(bottom+t)/2,z],'wood',[0,0,0],'§5.8.1:paired50×150H3 front supports',{section:[.050,.150],cutLength:bottom-t,placementStatus:'presentation position/end fit; support connection not dimensioned',unknown:{fasteners:null,endBearingApproved:false}});
  postPockets.push({min:[x-.025,roofUnder(),z-.075],max:[x+.025,bottom,z+.075]});
 }
 for(const p of parts.filter(p=>p.id.startsWith('entrance-soffit'))){
  const pieces=postPockets.reduce((pieces,cut)=>pieces.flatMap(piece=>subtractBox(piece,cut)),[p.bounds]);
  const oldVolume=p.volume,solids=pieces.map(b=>boxSolid(sub(b.max,b.min),mul(add(b.max,b.min),.5)));
  const volume=solids.reduce((n,b)=>n+solidVolume(b),0);
  if(oldVolume-volume>1e-12){p.solids=solids;p.geometry={baseBox:{size:p.size,position:p.position,rotation:p.rotation},cuts:postPockets,keep:'outside',reason:'candidate physical pocket for source paired50×150 supports'};p.volume=volume;p.removedVolume=oldVolume-volume;p.bounds=partBounds(solids.flatMap(s=>s.vertices));p.pocketApproved=false;}
 }
 for(const sign of [-1,1]){
  prism(`entrance-side-${sign}`,[[0,t],[s.canopyFront,t],[s.canopyFront,roofUnder()],[0,roofUnder()]],s.board,sign*(w/2-s.board/2),'board','PDF68:FC8; side finish joins front fascia, RFI06 candidate');
  // Ark21 and §5.6.1: FC8 on both faces, 25mm battens either
  // side of the 150mm core. Fit is a presentation candidate, not survey.
  const wallThickness=2*s.board+2*.025+.150;
  prism(`entrance-inner-side-${sign}`,[[0,t],[s.canopyFront,t],[s.canopyFront,roofUnder()],[0,roofUnder()]],s.board,sign*(w/2-wallThickness+s.board/2),'board','Ark21 / §5.6.1: inner FC8; 8+25+150+25+8 wall envelope',
   {wallThickness,approved:false,placementStatus:'candidate envelope, actual side wall insulation conflicts with Ark20; RFI06'});
  box(`entrance-front-return-${sign}`,[wallThickness,roofUnder()-t,s.board],[sign*(w/2-wallThickness/2),(roofUnder()+t)/2,s.canopyFront+s.board/2],'board',[0,0,0],'§5.6.1 / Ark21: FC8 finish on exposed side wall end; width216mm is envelope candidate');
  // Separate canopy side FC8 closes the source-required pitched edge. Keep an
  // explicit 8mm candidate joint above the horizontal soffit and below metal.
  const bandBottom=roofUnder()+s.board+.008,bandTop=z=>entranceCanopyY(z)-.035/c-.008;
  prism(`entrance-canopy-side-${sign}`,[[0,bandBottom],[s.canopyFront,bandBottom],[s.canopyFront,bandTop(s.canopyFront)],[0,bandTop(0)]],s.board,sign*(w/2-s.board/2),'board','§5.8.1: canopy sides clad FC8; PDF68/node20',
   {candidateJoint:.008,approved:false,placementStatus:'Full side to front fascia; existing canopy front bound, not a surveyed panel cut',unknown:{supports:null,ventilationMesh:null,fasteners:null}});
  const returnW=(w-s.doorWidth)/2-s.board;
  box(`entrance-jamb-return-${sign}`,[returnW,h,s.board],[sign*(s.doorWidth/2+returnW/2),t+h/2,-s.board/2],'board',[0,0,0],'Ark20:door at main wall; outer return fit candidate');
  box(`entrance-frame-jamb-${sign}`,[f,h,f],[sign*(s.doorWidth/2-f/2),t+h/2,s.doorPlane-f/2],'frame',[0,0,0],'Ark20 main-wall plane; ark27 VU01');
  box(`entrance-roof-edge-${sign}`,[s.flashing,.035,roofDepth],[sign*(w/2+s.flashing/2),entranceCanopyY(zmid)-.0175/c,zmid],'metal',[a,0,0],'§5.8.1:PURAL0.6;35mm leg candidate, bend/radius unknown',{unknown:{legLength:null,bendRadius:null}});
 }
 for(const [id,height,y] of [['sill',s.thresholdProfile,t+s.thresholdProfile/2],['head',f,head-f/2]])box(`entrance-frame-${id}`,[s.doorWidth-2*f,height,f],[0,y,s.doorPlane-f/2],'frame');
 const split=-s.doorWidth/2+s.leafWidths[0];box('entrance-frame-mullion',[f,h-f-s.thresholdProfile,f],[split,t+(h+s.thresholdProfile-f)/2,s.doorPlane-f/2],'frame');
 const left=-s.doorWidth/2+f,right=s.doorWidth/2-f;
 const crossTop=head-1.430,kickTop=t+.160;
 for(const [id,l,r] of [['left',left,split-f/2],['right',split+f/2,right]]){
  box(`entrance-glass-${id}`,[r-l,head-f-crossTop,.012],[(l+r)/2,(head-f+crossTop)/2,s.doorPlane-.040],'glass',[0,0,0],'Ark27 VU01: clear glass;1430 graphic upper zone, exact glazing requires manufacturer');
  box(`entrance-glass-lower-${id}`,[r-l,crossTop-f-kickTop,.012],[(l+r)/2,(crossTop-f+kickTop)/2,s.doorPlane-.040],'glass',[0,0,0],'Ark27 VU01 lower glazing');
  box(`entrance-door-rail-${id}`,[r-l,f,f],[(l+r)/2,crossTop-f/2,s.doorPlane-f/2],'frame');
  box(`entrance-kickplate-${id}`,[r-l,.160-s.thresholdProfile,.003],[(l+r)/2,(t+s.thresholdProfile+kickTop)/2,s.doorPlane+.002],'metal',[0,0,0],'§5.7 stainless kickplate;160mm height is display candidate');
 }
 for(const [id,x,sign] of [['left',split-.090,-1],['right',split+.090,1]])parts.push({id:`entrance-handle-${id}`,kind:'halfmoon',position:[x,t+1.050,s.doorPlane+.040],sign,material:'metal',quantity:1,evidence:'Ark27 VU01 half-moon handles; dimensions illustrative',bounds:{min:[x-.07,t+.89,s.doorPlane+.03],max:[x+.07,t+1.21,s.doorPlane+.05]},assembly:'entrance',volume:0,approved:false});
 for(const sign of [-1,1])box(`entrance-door-reveal-${sign}`,[s.board,h,.300],[sign*(s.doorWidth/2+s.openingFit-s.board/2),t+h/2,-.150],'board',[0,0,0],'Ark20 main-wall insulated jamb;8mm finish depth candidate');
 box('entrance-door-reveal-head',[s.doorWidth+2*s.openingFit,s.board,.300],[0,head+s.openingFit-s.board/2,-.150],'board',[0,0,0],'Ark20: continuous finished reveal head; fit candidate');
 const front=s.canopyFront,fasciaTop=entranceCanopyY(front),fasciaBottom=roofUnder();
 box('entrance-front-fascia',[w,fasciaTop-fasciaBottom,s.board],[0,(fasciaTop+fasciaBottom)/2,front+s.board/2],'board',[0,0,0],'§5.8.1:FC8; adaptive front depth candidate');
 const observedMax=s.canopyWallTop+.140,upstandBottom=entranceCanopyY(0);
 box('entrance-wall-upstand',[w,observedMax-upstandBottom,s.flashing],[0,(observedMax+upstandBottom)/2,-s.flashing/2],'metal',[0,0,0],'§5.8.1:PURAL0.6; upper observed display bound retained; adaptive leg unknown',{unknown:{legLength:null,bendRadius:null},placementStatus:'presentation bound, not observed flashing dimension'});
 const apronZ=.05,apronLen=.100/c;
 box('entrance-wall-apron',[w,s.flashing,apronLen],[0,entranceCanopyY(apronZ)+s.flashing/(2*c),apronZ],'metal',[a,0,0],'§5.8.1:wall flashing0.6;100mm apron candidate',{contactType:'explicit wet lap with roof skin',unknown:{lapLength:null,bendRadius:null}});
 box('entrance-drip',[w,.025,s.flashing],[0,fasciaTop-.0125,front+s.board+s.flashing/2],'metal',[0,0,0],'§5.8.1:eaves drip0.6;25mm leg candidate',{unknown:{legLength:null,bendRadius:null}});
 const outer=.05,inner=outer-s.flashing,profile=[];
 for(let i=0;i<=16;i++){const q=Math.PI+i*Math.PI/16;profile.push([outer*Math.cos(q),outer*Math.sin(q)]);}
 for(let i=16;i>=0;i--){const q=Math.PI+i*Math.PI/16;profile.push([inner*Math.cos(q),inner*Math.sin(q)]);}
 const gutterY=fasciaTop-.018,gutterZ=front+s.board+outer;
 prism('entrance-gutter',profile.map(([z,y])=>[z+gutterZ,y+gutterY]),w+.020,0,'metal','§5.8.1:100mm gutter0.6; outlet connection requires job drawing',{cutLength:w+.020});
 // Candidate outlet is below the gutter, not beyond its end in mid-air.
 const pipeX=w/2-.060,pipeTop=gutterY-.050,pipeBottom=s.ground+.060;
 tube('entrance-downpipe',s.downpipeDiameter/2,pipeTop-pipeBottom,[pipeX,(pipeTop+pipeBottom)/2,gutterZ],'metal');
 const rear=s.doorPlane-.100,frontLanding=d+.300,rearY=t-s.thresholdProfile,frontY=rearY-(frontLanding-rear)*s.landingSlope;
 prism('entrance-landing',[[rear,rearY-s.landingThickness],[frontLanding,frontY-s.landingThickness],[frontLanding,frontY],[rear,rearY]],w+.120,0,'concrete','Ark21:150mm C30/37 slab, ≥2% outward fall; footprint and levels require survey',{slope:s.landingSlope,physical:true,approved:false,quantityEligible:false,quantity:0});
 for(const p of parts){
  const id=p.id,roofDirection=[0,c,Math.sin(a)];let layer=null,direction=[0,0,0];
  if(p.kind==='rhs')layer='steel';
  else if(id.startsWith('entrance-front-post-'))layer='steel-support';
  else if(id==='entrance-roof-underlay'){layer='underlay';direction=roofDirection;}
  else if(id.startsWith('entrance-counter-')){layer='counter';direction=roofDirection;}
  else if(id.startsWith('entrance-roof-lath-')){layer='roof-lath';direction=roofDirection;}
  else if(id==='entrance-roof-skin'){layer='roof';direction=roofDirection;}
  else if(id.startsWith('entrance-soffit-batten-')){layer='soffit-batten';direction=[0,-1,0];}
  else if(id.startsWith('entrance-soffit')){layer='soffit';direction=[0,-1,0];}
  else if(id==='entrance-front-fascia'){layer='fascia';direction=[0,0,1];}
  else if(id.startsWith('entrance-canopy-side-')){layer='fascia';direction=[id.endsWith('--1')?-1:1,0,0];}
  else if(id.startsWith('entrance-roof-edge-')){layer='flashing';direction=[id.endsWith('--1')?-1:1,0,0];}
  else if(id.startsWith('entrance-wall-')){layer='flashing';direction=[0,0,-1];}
  else if(id==='entrance-drip'){layer='flashing';direction=[0,0,1];}
  else if(id==='entrance-gutter'||id==='entrance-downpipe')layer='rainwater';
  p.assembly=layer?'canopy':'entrance';p.layer=layer;p.explodeDirection=direction;
 }
 const unknowns={approved:false,fixings:null,structuralCapacity:null,manufacturerLathPitch:null,roofUnderlayThickness:null,steelBendRadius:null,weldAndMiterJobDrawings:null,outletConnector:null,roofOverhangSupport:null,frontLowerSetback:{candidate:upperBand,source:null,approved:false,reason:'Separate intact front transverse RHS rings; final end fits/weld topology require job drawings'},vestibuleEnvelope:'RFI06:old2730×1345 vs new details must be surveyed',soffitPitchConflict:{drawing:.420,manufacturerMaximum:.400,candidate:battenPitch,rfi:'RFI10'}};
 return {spec:s,parts,approved:false,unknowns,layers:[{id:'steel',source:'PDF70/node22',rearHeight:.425,frontEnvelopeHeight:.425-depth*tan},{id:'underlay',thickness:null,displayThickness:.0002},{id:'counter',thickness:.032},{id:'roof-lath',thickness:.032,pitch:null},{id:'roof',thickness:.0006},{id:'soffit-batten',thickness:.025,pitch:battenPitch,sourcePitch:.420,approved:false},{id:'soffit',thickness:.008}],
  datums:{graphicRoofWall:s.canopyWallTop,candidateRoofWall:entranceCanopyY(0),difference:entranceCanopyY(0)-s.canopyWallTop,soffitLower:roofUnder(),doorClearance:s.presentationDoorClearance,placementStatus:'presentation clearance candidate; RFI10, not source elevation'},
  sourceSteel:{width:2.66,depth:1.1,rearHeight:.425,slope:15,illustratedUpperCutLength:1.055,rearUprightClearGap:.225,rearUprights:{candidateCount:2,approvedCount:null,candidateCutLength:rearUprightLength,finishedHeightRange:[rearUprightLength-.100*tan,rearUprightLength],note:'Two mirrored outer source side-frame connections; actual fit and count require job drawings'},note:'1055/225 nominal drawing dimensions; modeled member cut lengths/miters require job drawings'},
  contacts:[{a:'steel',b:'counter',type:'roof-plane contact'},{a:'counter',b:'roof-lath',type:'32mm layer contact'},{a:'soffit-batten',b:'soffit',type:'horizontal face contact'}],totals:{parts:parts.length,steelParts:parts.filter(p=>p.kind==='rhs').length,steelVolume:parts.filter(p=>p.kind==='rhs').reduce((v,p)=>v+p.volume,0),steelCutLength:parts.filter(p=>p.kind==='rhs').reduce((v,p)=>v+p.cutLength,0)},bounds:partBounds(parts.flatMap(p=>[p.bounds.min,p.bounds.max]))};
}
export function entranceParts(){return planEntrance().parts;}
export function createEntrance(THREE,parent,{x=0,z=0,withContext=false}={}){
 const group=new THREE.Group();group.name='source-entrance';group.position.set(x,0,z);parent.add(group);
 group.userData.component={kind:'entrance',title:'Вхід · вузли20/21',source:'Арк20/21/27; §5.6/5.7/5.8.1',note:'VU01 2305×2100 у головній стіні; попереду відкритий майданчик і бокові стінки. Бетон150мм зі стоком2%. Посадка,20мм поріг/зазори, сходи й обміри потребують уточнення.'};
 const plan=planEntrance();group.userData.entranceSpec=entranceSpec;group.userData.entrancePlan={...plan,parts:undefined};
 group.userData.roofSourceConflict={legend:'PDF53/54:tuulekoja katus SBS',selectedNode:'§5.8.1/PDF68:Classic0.6PURAL',resolved:false};
 const materials={steel:new THREE.MeshStandardMaterial({color:'#8b969b',roughness:.45,metalness:1}),wood:new THREE.MeshStandardMaterial({color:'#b28b5c',roughness:.86}),underlay:new THREE.MeshStandardMaterial({color:'#414a46',roughness:.94}),board:new THREE.MeshStandardMaterial({color:'#343a3d',roughness:.85}),frame:new THREE.MeshStandardMaterial({color:'#303a3f',roughness:.55,metalness:.3}),metal:new THREE.MeshStandardMaterial({color:'#58656b',roughness:.4,metalness:.65}),concrete:new THREE.MeshStandardMaterial({color:'#a1a7a3',roughness:.85}),glass:new THREE.MeshPhysicalMaterial({color:'#e8eeee',roughness:.065,metalness:0,transmission:.9,thickness:.012,ior:1.5})};
 for(const [role,m] of Object.entries(materials))m.name='entrance_'+role;
 materials.glass.userData={materialFamily:'glass',source:'VU01/PDF75; PDF53 clear tempered glass',opticalRole:'entrance candidate single display surface',displayThickness:.012,orderedComposition:null,approved:false,sourceFacts:{clear:true,tempered:true,composition:null},finishAuthority:'12mm display candidate matches optical thickness; no specified glazing composition'};
 for(const part of plan.parts){
  let geometry;
  if(part.solids){
   const vertices=[];for(const solid of part.solids)for(const face of solid.faces)for(let i=1;i<face.length-1;i++)for(const j of [face[0],face[i],face[i+1]])vertices.push(...solid.vertices[j]);
   geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  }
  else if(part.kind==='box')geometry=new THREE.BoxGeometry(...part.size);
  if(part.kind==='prismX'){
   const shape=new THREE.Shape();part.profile.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();
   geometry=new THREE.ExtrudeGeometry(shape,{depth:part.width,bevelEnabled:false});geometry.rotateY(-Math.PI/2);geometry.translate(part.x+part.width/2,0,0);
  }
  if(part.kind==='tubeY'){
   const shape=new THREE.Shape();shape.absarc(0,0,part.radius,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,part.radius-part.thickness,0,Math.PI*2,true);shape.holes.push(hole);
   geometry=new THREE.ExtrudeGeometry(shape,{depth:part.length,bevelEnabled:false,curveSegments:16});geometry.rotateX(Math.PI/2);geometry.translate(0,part.length/2,0);
  }
  if(part.kind==='halfmoon'){
   const path=new THREE.Curve();path.getPoint=q=>new THREE.Vector3(part.sign*.06*Math.sin(q*Math.PI),.15*Math.cos(q*Math.PI),0);
   geometry=new THREE.TubeGeometry(path,24,.010,8,false);
  }
  const mesh=new THREE.Mesh(geometry,materials[part.material]);mesh.name=part.id;
  if(!part.solids){if(part.position)mesh.position.set(...part.position);if(part.rotation)mesh.rotation.set(...part.rotation);}
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData={authoring:part,partId:part.id,assembly:part.assembly,layer:part.layer,explodeDirection:[...part.explodeDirection],canopyPart:part.assembly==='canopy'};
  group.add(mesh);
 }
 const contextMaterials=withContext?addEntranceContext(THREE,group,plan,materials):{};
 let disposed=false;group.dispose=()=>{if(disposed)return;disposed=true;for(const mesh of group.children)mesh.geometry.dispose();for(const material of [...Object.values(materials),...Object.values(contextMaterials)])material.dispose();parent.remove(group);};
 return group;
}
