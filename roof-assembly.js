import {roofSpec,roofFrame} from './roof-geometry.js';

export const roofAssemblySpec=Object.freeze({metalThickness:.0006,module:.475,seamHeight:.032,foldWidth:.0066,underlayDisplayThickness:.0002,counter:{width:.050,depth:.032},lath:{width:.100,depth:.032,axisPitch:.400,pitchSource:"Artur2026-10-11:400mm axes"},rafters:{width:.065,depth:.150,pitch:1,source:null,approved:false},profileReference:{name:'Ruukki EE Classic Design475 dimensional reference only',url:'https://www.ruukki.com/est/katusetooted/tooted-ja-teenused/katuseprofiilid/katuse-detailid/parnu-classic-design-c-475mm',effectiveWidth:.475,height:.032,thickness:.0006,recommendedLathPitch:.200,totalWidth:.510,orderedProduct:null,approved:false},unknown:{foldWidth:null,bendRadii:null,clickInterlock:null,manufacturerOrdered:null,structuralCapacity:null,anchors:null,underlayThickness:null,rafterSection:null,rafterPitch:null}});
export const roofLayerOffsets=Object.freeze([-.2148,-.0648,-.0646,-.0326,0]);
export const roofFasciaSpec=Object.freeze({thickness:.022,height:.150,centreSetback:.020,placementSource:null,endFitApproved:false});
export const roofLocalZ=(sign,worldZ)=>{const f=roofFrame(sign);return(worldZ-f.position[2])/Math.cos(f.angle);};
export function defaultRoofOpenings(sign){
 const r=(id,x,z,width,depth,evidence)=>({id,x:x-width/2,z:roofLocalZ(sign,z)-depth/2,width,depth,source:evidence,approved:false});
 const vertical=o=>({...o,axis:'worldY',clearanceProjection:'candidate vertical corridor; each layer includes its actual normal-depth envelope'});
 if(sign===1)return [r('ROOF-HATCH-KLK01',-9,3.3,.800,.600,'KLK01 source800×600; location/orientation candidate'),...[-15,-8.5,-2.8,5,10.5,17].map((x,i)=>vertical(r('ROOF-VENT-'+(i+1),x,5.4,.140,.140/Math.cos(roofFrame(sign).angle),'observedmodel120mm pipe;140mm rectangular opening candidate, not approved')))];
 return[vertical(r('ROOF-EXHAUST',18.6,-3.3,.440,.440/Math.cos(roofFrame(sign).angle),'observedmodel400mm exhaust;440mm rectangular opening candidate, not approved'))];
}
export function projectRoofOpening(opening,layer,sign){
 if(opening.axis!=='worldY')return {...opening};
 // worldZ=frameZ+sin(theta)*localY+cos(theta)*localZ.
 // A vertical duct therefore shifts in localZ through every physical layer.
 const yMin=layer.index===4?-roofAssemblySpec.metalThickness:layer.z,yMax=layer.index===4?roofAssemblySpec.seamHeight:layer.z+layer.thickness;
 const shifts=[-yMin*Math.tan(sign*roofFrame(sign).angle),-yMax*Math.tan(sign*roofFrame(sign).angle)],low=Math.min(...shifts),high=Math.max(...shifts);
 return {...opening,z:opening.z+low,depth:opening.depth+high-low,normalEnvelope:[yMin,yMax],projection:'vertical-layer-envelope'};
}
const area=ps=>Math.abs(ps.reduce((n,p,i)=>{const q=ps[(i+1)%ps.length];return n+p[0]*q[1]-q[0]*p[1];},0))/2;
const rect=(x,z,width,depth)=>({x,z,width,depth});
const intersect=(a,b)=>{const x=Math.max(a.x,b.x),z=Math.max(a.z,b.z),r=Math.min(a.x+a.width,b.x+b.width),f=Math.min(a.z+a.depth,b.z+b.depth);return r>x+1e-12&&f>z+1e-12?rect(x,z,r-x,f-z):null;};
function subtract(a,b){const hit=intersect(a,b);if(!hit)return[a];const out=[];if(hit.x>a.x)out.push(rect(a.x,a.z,hit.x-a.x,a.depth));if(hit.x+hit.width<a.x+a.width)out.push(rect(hit.x+hit.width,a.z,a.x+a.width-hit.x-hit.width,a.depth));if(hit.z>a.z)out.push(rect(hit.x,a.z,hit.width,hit.z-a.z));if(hit.z+hit.depth<a.z+a.depth)out.push(rect(hit.x,hit.z+hit.depth,hit.width,a.z+a.depth-hit.z-hit.depth));return out;}
const rectSection=r=>[[r.x,r.y],[r.x+r.width,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y+r.height]];
export function roofProfileSection(width=roofAssemblySpec.module){
 const t=roofAssemblySpec.metalThickness,h=roofAssemblySpec.seamHeight,f=roofAssemblySpec.foldWidth;
 if(!Number.isFinite(width)||width<=f)throw Error('Roof pan width must exceed candidate folded edge');
 // Idealised constant0.6mm walls, zero-radius bends. The reference dimensions
 //32/475 do not establish proprietary click geometry or its6.6mm fold width.
 const sectionXY=[[0,0],[0,h],[f,h],[f,0],[width,0],[width,-t],[f-t,-t],[f-t,h-t],[t,h-t],[t,0]];
 const webs=[{x:0,y:0,width:t,height:h},{x:t,y:h-t,width:f-t,height:t},{x:f-t,y:-t,width:t,height:h},{x:f,y:-t,width:width-f,height:t}];
 return {sectionXY,webs,area:area(sectionXY),thickness:t,foldHeight:h,foldWidth:f,bendRadius:null,manufacturerGeometry:false};
}
export function planRoofRidge(){
 const front=roofFrame(1),back=roofFrame(-1),leg=.200,t=.0006,raise=.040;
 const path=[[-leg*Math.cos(back.angle),roofSpec.ridge+raise-leg*Math.sin(back.angle)],[0,roofSpec.ridge+raise],[leg*Math.cos(front.angle),roofSpec.ridge+raise-leg*Math.sin(front.angle)]];
 const normals=path.slice(0,-1).map((p,i)=>{const q=path[i+1],dx=q[0]-p[0],dy=q[1]-p[1],n=Math.hypot(dx,dy);return[-dy/n,dx/n];});
 const side=sign=>path.map((p,i)=>{if(!i||i===path.length-1){const n=normals[i?i-1:0];return[p[0]+sign*t/2*n[0],p[1]+sign*t/2*n[1]];}const n=[normals[i-1][0]+normals[i][0],normals[i-1][1]+normals[i][1]],factor=sign*t/(2*(1+normals[i-1][0]*normals[i][0]+normals[i-1][1]*normals[i][1]));return[p[0]+n[0]*factor,p[1]+n[1]*factor];});
 const sectionYZ=[...side(1),...side(-1).reverse()];
 return {partId:'ROOF-RIDGE-CAP',geometryPartId:'ROOF-RIDGE-CAP-0.6',kind:'profileExtrusionX',geometry:{sectionYZ,length:roofSpec.length,startX:-roofSpec.length/2},volume:area(sectionYZ)*roofSpec.length,thickness:t,source:'PDF60/node12:0.6PURAL,200mm legs reference',approved:false,unknown:{heightRaiseSource:null,heightRaiseCandidate:raise,bendRadius:null,ventSealProduct:null,fasteners:null}};
}
const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(16);};
function clipSection(points,{a,b,c}){const out=[];for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length],u=a*p[0]+b*p[1]-c,v=a*q[0]+b*q[1]-c;if(u<=1e-12)out.push(p);if((u<0&&v>0)||(u>0&&v<0)){const t=u/(u-v);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}return out;}
function finishSegment(part,r,region){
 const g=part.geometry,profile=part.kind==='profile';
 const polygons=profile?g.webs.map(w=>{const low=Math.max(w.x,r.x-part.rect.x),high=Math.min(w.x+w.width,r.x+r.width-part.rect.x);return high>low+1e-12?rectSection({...w,x:low,width:high-low}):null;}).filter(Boolean):null;
 const crossArea=profile?polygons.reduce((n,p)=>n+area(p),0):r.width*part.thickness;
 const sectionXY=profile&&Math.abs(r.width-part.rect.width)<1e-10&&Math.abs(r.x-part.rect.x)<1e-10?g.sectionXY:null;
 let geometry={kind:profile?'profileExtrusionZ':'box',sectionXY,sectionPolygons:polygons,length:r.depth,zStart:r.z,x:part.rect.x,y:profile?0:part.thickness/2,width:r.width,thickness:part.thickness,boxX:r.x+r.width/2},volume=crossArea*r.depth;
 if(g.endClip){const plane={...g.endClip,c:g.endClip.c-g.endClip.a*r.z},sectionYZ=clipSection([[0,0],[r.depth,0],[r.depth,part.thickness],[0,part.thickness]],plane);geometry={...geometry,kind:'prismExtrusionX',sectionYZ,length:r.width,startX:r.x,zStart:r.z,endClip:g.endClip};volume=area(sectionYZ)*r.width;}
 const geometryPartId='ROOF-G-'+hash(JSON.stringify(geometry.kind==='prismExtrusionX'?[geometry.kind,geometry.sectionYZ,r.width]:profile?[sectionXY??polygons,r.depth]:[r.width,part.thickness,r.depth]));
 return {...part,rect:r,geometry,geometryPartId,sourcePartId:part.id,partId:part.id+'@'+region+'-'+hash(JSON.stringify(r)),region,volume,stockPart:false,projection:region!=='physical'};
}
export function planRoofAssembly(sign,{openings=defaultRoofOpenings(sign),patch={x:-12.5,z:0,width:4,depth:2.6},ridgeSetback=.100}={}){
 const frame=roofFrame(sign),s=roofAssemblySpec,code=sign===1?'SE':'NW',full=rect(-roofSpec.length/2,-frame.slope/2+(sign===1?ridgeSetback:0),roofSpec.length,frame.slope-ridgeSetback);
 const layers=[{id:'rafters',index:0,z:roofLayerOffsets[0],thickness:.150,source:null,candidate:true},{id:'underlay',index:1,z:roofLayerOffsets[1],thickness:.0002,sourceThickness:null,candidate:true},{id:'counter',index:2,z:roofLayerOffsets[2],thickness:.032,source:'PDF60/node12;§5.4'},{id:'lath',index:3,z:roofLayerOffsets[3],thickness:.032,source:'PDF60/node12;§5.4',pitchReference:"Artur2026-10-11:400mm axes",userConfirmedPitch:true,approvedPitch:false},{id:'metal',index:4,z:0,thickness:.0006,source:'PDF60/node12;§5.4',profileCandidate:true}];
 for(const o of openings)if(!o.id||![o.x,o.z,o.width,o.depth].every(Number.isFinite)||o.width<=0||o.depth<=0)throw Error('Invalid roof opening');
 const fasciaBack=sign*((sign===1?roofSpec.frontSpan:roofSpec.backSpan)-roofFasciaSpec.centreSetback-roofFasciaSpec.thickness/2),theta=sign*frame.angle;
 const endFits=Object.fromEntries([0,1,2,3].map(index=>[index,{a:sign*Math.cos(theta),b:sign*Math.sin(theta),c:sign*(fasciaBack-frame.position[2]-Math.sin(theta)*roofLayerOffsets[index]),convention:'a*localZ+b*childY <= c; negative side retained',source:null,approved:false,worldPlane:{axis:'Z',coordinate:fasciaBack,keep:sign===1?'less-or-equal':'greater-or-equal'},placement:index===1?'display underlay candidate termination at fascia back; actual membrane routing/drip unknown':'candidate vertical timber end fit at actual22mm fascia back; woodworking detail unknown'}])),timberEndFits=Object.fromEntries([0,2,3].map(i=>[i,endFits[i]])),rafterEndClip=endFits[0];
 const baseParts=[],box=(layer,id,r)=>baseParts.push({id:'ROOF-'+code+'-'+id,kind:'box',layer:layer.index,layerId:layer.id,material:layer.index===1?'roof_underlay':'roof_timber',rect:r,thickness:layer.thickness,geometry:endFits[layer.index]?{endClip:endFits[layer.index]}:{},source:layer.source,approved:false});
 const axes=[];for(let x=Math.ceil((full.x+.0325)/s.rafters.pitch)*s.rafters.pitch;x<full.x+full.width-.0325;x+=s.rafters.pitch)axes.push(x);
 for(const [i,x] of axes.entries())for(const layerIndex of [0,2]){const layer=layers[layerIndex],width=layerIndex===0?.065:.050,r=intersect(rect(x-width/2,full.z,width,full.depth),full);if(r)box(layer,(layerIndex===0?'RAFTER-':'COUNTER-')+String(i+1).padStart(3,'0'),r);}
 box(layers[1],'UNDERLAY',full);
 const lathPitch=.400,lathSpan=full.depth-s.lath.width,lathPositions=Array.from({length:Math.floor(lathSpan/lathPitch)+1},(_,i)=>i*lathPitch);
 if(lathSpan-lathPositions.at(-1)>=s.lath.width)lathPositions.push(lathSpan);
 // User-confirmed 400mm axes. Only the final edge support closes the residual;
 // never redistribute every course and silently turn 400 into another pitch.
 for(const [i,z] of lathPositions.entries())box(layers[3],'LATH-'+String(i+1).padStart(3,'0'),rect(full.x,full.z+z,full.width,s.lath.width));
 for(let x=full.x,n=1;x<full.x+full.width-1e-10;x+=s.module,n++){
  const width=Math.min(s.module,full.x+full.width-x),section=roofProfileSection(width);
  baseParts.push({id:'ROOF-'+code+'-PAN-'+String(n).padStart(3,'0'),kind:'profile',layer:4,layerId:'metal',material:'roof_steel',rect:rect(x,full.z,width,full.depth),thickness:.0006,geometry:section,source:'PDF60/node12;§5.4',profileReference:s.profileReference,approved:false});
 }
 const placed=p=>({...p,placement:{frame:{position:frame.position,rotation:[sign*frame.angle,0,0]},layerY:layers[p.layer].z}});
 const layerOpenings=layers.map(layer=>openings.map(o=>projectRoofOpening(o,layer,sign)));
 const physicalParts=baseParts.flatMap(p=>layerOpenings[p.layer].reduce((rs,o)=>rs.flatMap(r=>subtract(r,o)),[p.rect]).map(r=>placed(finishSegment(p,r,'physical'))));
 const patchBounds=sign===1?rect(patch.x-patch.width/2,patch.z-patch.depth/2,patch.width,patch.depth):null;
 const outside=[],cover=[],inspection=[];
 for(const p of physicalParts){if(!patchBounds){outside.push({...p,region:'outside'});continue;}for(const r of subtract(p.rect,patchBounds))outside.push(placed(finishSegment(baseParts.find(b=>b.id===p.sourcePartId),r,'outside')));const hit=intersect(p.rect,patchBounds);if(hit){const base=baseParts.find(b=>b.id===p.sourcePartId);cover.push(placed(finishSegment(base,hit,'cover')));inspection.push(placed(finishSegment(base,hit,'inspection')));}}
 return {sign,code,frame:{position:frame.position,rotation:[sign*frame.angle,0,0]},bounds:full,layers,baseParts,physicalParts,outside,cover,inspection,patch:patchBounds,openings,layerOpenings,rafterAxes:axes,lathPitch,profilePhase:full.x,
  metadata:{source:'PDF60/node12;§5.4',approved:false,orderedProduct:null,rafters:s.rafters,rafterEndClip,timberEndFits,underlayEndFit:endFits[1],fascia:roofFasciaSpec,ridgeSetback:{candidate:ridgeSetback,source:null,approved:false},profileReference:s.profileReference,profileGeometry:'idealised U-return6.6mm;32/475 dimensions official reference; interlock/radii unknown',panDatum:'outer flat pan at graphic roofSurfaceY; crest32mm outward; datum interpretation is RFI',underlayThickness:{source:null,display:.0002},atticInsulation:{thickness:.450,location:'attic floor8.525, NOT pitched roof plane'},overhangs:{front:roofSpec.frontSpan-5.62,back:roofSpec.backSpan-5.62,minimumFront:.600,minimumBack:.750,endIncrement:.300,finalEndOverhangSource:null},unknown:s.unknown}};
}
export function createRoofAssembly(THREE,parent,{materials={},openings={1:defaultRoofOpenings(1),'-1':defaultRoofOpenings(-1)},patch={x:-12.5,z:0,width:4,depth:2.6}}={}){
 const plans=[planRoofAssembly(1,{openings:openings[1]??[],patch}),planRoofAssembly(-1,{openings:openings[-1]??[],patch})],ownedMaterials=new Set(),geometries=new Map();
 const mats={};for(const [role,color] of Object.entries({roof_steel:'#4a5158',roof_timber:'#af895e',roof_underlay:'#5b6864'})){mats[role]=materials[role]??new THREE.MeshStandardMaterial({color,roughness:role==='roof_steel'?.48:.87,metalness:role==='roof_steel'?.75:0});if(!materials[role]){ownedMaterials.add(mats[role]);mats[role].name=role;}}
 const geometry=p=>{if(geometries.has(p.geometryPartId))return geometries.get(p.geometryPartId);let g;
  if(p.geometry.kind==='prismExtrusionX'){const shape=new THREE.Shape();p.geometry.sectionYZ.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();g=new THREE.ExtrudeGeometry(shape,{depth:p.rect.width,bevelEnabled:false,steps:1});g.rotateY(-Math.PI/2);g.translate(p.rect.width,0,0);}
  else if(p.kind==='box')g=new THREE.BoxGeometry(p.rect.width,p.thickness,p.rect.depth);
  else{
   const sections=p.geometry.sectionXY?[p.geometry.sectionXY]:p.geometry.sectionPolygons,positions=[];
   for(const points of sections){const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const part=new THREE.ExtrudeGeometry(shape,{depth:p.rect.depth,bevelEnabled:false,steps:1}),flat=part.index?part.toNonIndexed():part,arr=flat.getAttribute('position');for(let i=0;i<arr.count;i++)positions.push(arr.getX(i),arr.getY(i),arr.getZ(i));if(flat!==part)flat.dispose();part.dispose();}
   g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();
  }geometries.set(p.geometryPartId,g);return g;};
 const addPart=(p,target,originX=0,originZ=0)=>{const m=new THREE.Mesh(geometry(p),mats[p.material]);m.name=p.partId;
  if(p.geometry.kind==='prismExtrusionX')m.position.set(p.rect.x-originX,0,p.rect.z-originZ);else if(p.kind==='box')m.position.set(p.rect.x+p.rect.width/2-originX,p.thickness/2,p.rect.z+p.rect.depth/2-originZ);else m.position.set(p.geometry.x-originX,0,p.geometry.zStart-originZ);
  m.castShadow=m.receiveShadow=true;m.userData={partId:p.partId,sourcePartId:p.sourcePartId,geometryPartId:p.geometryPartId,assembly:'roof',layer:p.layer,system:'roof',roofProjection:p.projection,authoring:p,component:{kind:'roof-part',title:p.sourcePartId,source:p.source??'Розмір існуючої крокви невідомий',note:'Кандидат геометрії; замовлений профіль, кріплення та робочі вузли непідтверджені.'}};target.add(m);return m;};
 const roofCovers=new THREE.Group();roofCovers.name='roof-cover-fragment';roofCovers.userData={layer:4,system:'roof'};parent.add(roofCovers);
 const fullGroups=[],roofCut=new THREE.Group(),roofGroups=[],roofOffsets=[...roofLayerOffsets];parent.add(roofCut);roofCut.name='roof-inspection';roofCut.visible=false;const front=plans[0];roofCut.position.fromArray(front.frame.position);roofCut.position.x=patch.x;roofCut.rotation.fromArray(front.frame.rotation);
 for(const plan of plans){const full=new THREE.Group();full.name='roof-'+plan.code;full.position.fromArray(plan.frame.position);full.rotation.fromArray(plan.frame.rotation);full.userData.component={kind:'roof',title:'Дах · реальна геометрія шарів',source:'PDF60/node12;§5.4',note:'0,6мм метал;475/32мм — довідковий кандидат. Крокви, профіль замовлення, вузли й прив’язки потребують звірки.'};full.userData.roofPlan=plan.metadata;parent.add(full);fullGroups.push(full);
  const coverFrame=new THREE.Group();coverFrame.position.copy(full.position);coverFrame.rotation.copy(full.rotation);roofCovers.add(coverFrame);
  for(const layer of plan.layers){const fg=new THREE.Group(),cg=new THREE.Group();fg.position.y=cg.position.y=layer.z;full.add(fg);coverFrame.add(cg);fg.userData={roofLayer:layer,layer:layer.index,system:'roof'};cg.userData={roofLayer:layer,layer:layer.index,system:'roof'};
   for(const p of plan.outside.filter(p=>p.layer===layer.index))addPart(p,fg);
   for(const p of plan.cover.filter(p=>p.layer===layer.index))addPart(p,cg);
   if(plan.sign===1){const ig=new THREE.Group();ig.position.y=layer.z;ig.userData={layer:layer.index,system:'roof',roofLayer:layer};roofCut.add(ig);roofGroups.push(ig);for(const p of plan.inspection.filter(p=>p.layer===layer.index))addPart(p,ig,patch.x,patch.z);}
  }
 }
 const ridgePart=planRoofRidge(),shape=new THREE.Shape();ridgePart.geometry.sectionYZ.forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();const ridgeGeometry=new THREE.ExtrudeGeometry(shape,{depth:ridgePart.geometry.length,bevelEnabled:false});ridgeGeometry.rotateY(-Math.PI/2);ridgeGeometry.translate(roofSpec.length/2,0,0);geometries.set(ridgePart.geometryPartId,ridgeGeometry);
 const ridge=new THREE.Mesh(ridgeGeometry,mats.roof_steel);ridge.name=ridgePart.partId;ridge.userData={partId:ridgePart.partId,geometryPartId:ridgePart.geometryPartId,layer:4,system:'roof',assembly:'roof',authoring:ridgePart,component:{kind:'roof',title:'Коник · тонкий PURAL0,6мм',source:ridgePart.source,note:'Вентиляційний проміжок і згини — кандидат до робочого вузла.'}};ridge.castShadow=ridge.receiveShadow=true;parent.add(ridge);
 let disposed=false;return {plans,ridgePart,ridge,fullGroups,roofCovers,roofCut,roofGroups,roofOffsets,materials:mats,dispose(){if(disposed)return;disposed=true;for(const g of [...fullGroups,roofCovers,roofCut,ridge])parent.remove(g);for(const g of geometries.values())g.dispose();for(const m of ownedMaterials)m.dispose();}};
}
