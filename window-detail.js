import {subtractRect} from './engineering.js';
import {facadeLayerSpec,planFacadeSystem} from './facade-system.js';
import {planPanelSupportTopology} from './panel-support-topology.js';
import {assertLocalJointDeclaration} from './local-joint-contract.js';
import {layoutFor,initialVisualLayouts} from './facade-layouts.js';
import {projectBracketContacts,bracketBatches,pocketBatch} from './bracket-contact.js';
import {facadeWindowSpec,createWindowProfiles,planWindowProfiles} from './facade-window.js';
import {planWindowSill} from './window-sill.js';
import {planRevealCandidate} from './reveal-plan.js';
import {panelMaterialRectangles} from './panel-blank-shapes.js';
import {planUserNineHoleSupports,addPanelFastenerMarkers} from './panel-fastener-pattern.js';

const source='P-8/8/22 · арк.14 / PDF62; VS-2 · арк.08 / PDF56';
export const windowDetailSpec={width:3.5,height:2.85,opening:{width:1.780,height:1.475},joint:.008,
 frame:{width:1.760,height:1.430,cy:.0125,section:.070,depth:.090,z:-.135,illustrative:true},
 surround:{width:.050,depth:.175,z:-.215},metalThickness:.0006,sillAngleDegrees:10,sillProjection:.030,
 sillBackY:planWindowProfiles({width:1.780,height:1.475,windowType:'A-01'}).sillBackY,sillPocketClearance:.0006,
 source,approved:false,surveyVerified:false};
const rect=(x,y,width,height)=>({x,y,width,height});
const wall=rect(-1750,-1425,3500,2850),hole=rect(-890,-737.5,1780,1475),ringOuter=rect(-940,-787.5,1880,1575);
const intersect=(a,b)=>{const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),top=Math.min(a.y+a.height,b.y+b.height);return right>x&&top>y?rect(x,y,right-x,top-y):null;};
const cut=(rectangles,cutter)=>rectangles.flatMap(r=>subtractRect(r,cutter).map(piece=>({...r,...piece})));
const fullWall=cut([wall],hole),support=cut([ringOuter],hole);
function grid(axis,step,width){
 const strips=[];const limit=axis==='x'?1750:1425;
 for(let centre=-Math.floor((limit+width/2)/step)*step;centre-width/2<limit;centre+=step){
  const band=axis==='x'?rect(centre-width/2,-1425,width,2850):rect(-1750,centre-width/2,3500,width);
  const clipped=intersect(band,wall);if(clipped)strips.push(...cut([clipped],hole));
 }
 return strips;
}
const batch=(kind,rectangles,depth,z=0)=>({kind,rectangles,depth,z});
const panelRecordFor=r=>({...r.sourcePart,detailProjection:{x:r.x,y:r.y,width:r.width,height:r.height,...(r.profileYZ?{profileYZ:r.profileYZ}:{})},projectedOnly:true,newStockPart:false});
function projectSurrounding(input){
 if(!input)return null;
 const {layout,centre}=input;
 assertLocalJointDeclaration(layout);
 if(!layout||!Array.isArray(layout.parts)||!Array.isArray(layout.cuts)||!centre||![centre.x,centre.y,layout.width,layout.height,layout.module,layout.offset].every(Number.isFinite)||layout.joint!==8)throw Error('Invalid surrounding layout / centre; 8mm joints required');
 // Validate the reference grid even when physical supports are local segments.
 for(let i=1;i<layout.cuts.length;i++)if((layout.cuts[i]-layout.cuts[i-1])/Math.ceil((layout.cuts[i]-layout.cuts[i-1])/420)<100)throw Error('Projected support axes would overlap100mm timber');
 const topology=layout.cutPolicy==='notched-study'?planUserNineHoleSupports(layout):layout.localJointTopology?planPanelSupportTopology(layout):null;
 if(topology&&(input.supportAxes!==undefined||layout.supportAxes!==undefined))throw Error('A full-height support axis override cannot replace local joint segments');
 const localBands=rectangles=>rectangles.flatMap(r=>{
  const projected=intersect({...r,x:r.x-centre.x,y:r.y-centre.y},wall);
  return projected?cut([projected],hole):[];
 });
 const axes=topology?null:(input.supportAxes??layout.supportAxes??layout.cuts.flatMap((to,i)=>{
  if(!i)return [to];const from=layout.cuts[i-1],count=Math.ceil((to-from)/420),step=(to-from)/count;
  if(step<100)throw Error('Projected support axes would overlap100mm timber');
  return Array.from({length:count},(_,n)=>n+1===count?to:from+(n+1)*step);
 }));
 if(!topology){
  const invalid=!Array.isArray(axes)||axes.some((x,i)=>!Number.isFinite(x)||(i&&(x-axes[i-1]<100-1e-7||x-axes[i-1]>420+1e-7)))||layout.cuts.some(cut=>!axes.some(axis=>Math.abs(axis-cut)<1e-7));
  if(invalid)throw Error('Invalid projected support axes');
 }
 const panels=layout.parts.flatMap(part=>{
  const globalBounds={...wall,x:wall.x+centre.x,y:wall.y+centre.y};
  return panelMaterialRectangles(part,globalBounds).flatMap(r=>cut([{...r,x:r.x-centre.x,y:r.y-centre.y}],hole)).map(r=>({...r,sourcePart:{...part,module:layout.module,scope:layout.scope},contourTessellation:true}));
 });
 const bands=width=>axes.flatMap(axis=>{
  const low=Math.max(0,axis-width/2),high=Math.min(layout.width,axis+width/2);
  const projected=intersect(rect(low-centre.x,-centre.y,high-low,layout.height),wall);
  return projected?cut([projected],hole):[];
 });
 return {panels,battens:topology?localBands(topology.battens):bands(100),tape:topology?localBands(topology.tape):bands(90),metadata:{facade:layout.facade,width:layout.width,height:layout.height,module:layout.module,offset:layout.offset,joint:layout.joint,
  centre:{...centre},scope:layout.scope,sourcePartIds:[...new Set(panels.map(p=>p.sourcePart.id))],newStockParts:false,
  support:topology?{...topology.support,segmentsGlobal:topology.segments,projectedFromLocalJointTopology:true}:{alignment:'panel-joints',axesGlobal:[...axes],axesLocal:axes.map(x=>x-centre.x),sourcePitch:420,approved:false,note:'Projected whole-facade candidate support phase; not approval of the altered420mm nominal.'}}};
}
const profileArea=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
function sillPocket(b,layerZ,spec=windowDetailSpec){
 const rear=spec.frame.z+spec.frame.depth,tan=Math.tan(spec.sillAngleDegrees*Math.PI/180);
 const rectangles=[];let removedVolume=b.removedVolume??0;
 for(const r of b.rectangles){
  if(r.y+r.height>hole.y+1e-7||layerZ+b.z+b.depth<=rear){rectangles.push(r);continue;}
  const middle=intersect(r,rect(hole.x,r.y,hole.width,r.height));
  if(!middle){rectangles.push(r);continue;}
  rectangles.push(...subtractRect(r,middle).map(piece=>({...r,...piece})));
  const polygon=[[middle.y/1000,b.z],[(middle.y+middle.height)/1000,b.z],[(middle.y+middle.height)/1000,b.z+b.depth],[middle.y/1000,b.z+b.depth]];
  const signed=p=>p[0]-(spec.sillBackY-tan*(layerZ+p[1]-rear)-spec.sillPocketClearance);
  const clipped=[];
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i],next=polygon[(i+1)%polygon.length],fa=signed(a),fb=signed(next);
   if(fa<=0)clipped.push(a);
   if((fa<0&&fb>0)||(fa>0&&fb<0)){const t=fa/(fa-fb);clipped.push([a[0]+t*(next[0]-a[0]),a[1]+t*(next[1]-a[1])]);}
  }
  const original=middle.width*middle.height/1e6*b.depth,kept=profileArea(clipped)*middle.width/1000;
  removedVolume+=original-kept;
  if(original-kept<1e-12)rectangles.push({...r,...middle});
  else if(clipped.length>=3){const low=Math.min(...clipped.map(p=>p[0])),high=Math.max(...clipped.map(p=>p[0]));rectangles.push({...r,...middle,y:low*1000,height:(high-low)*1000,profileYZ:clipped});}
 }
 return {...b,rectangles,removedVolume};
}
function insulated(axis,depth,z,hasSurround,canonicalWood){
 const gridWood=canonicalWood??grid(axis,600,50),wood=hasSurround?[...cut(gridWood,ringOuter),...support]:gridWood;
 let fill=fullWall;
 for(const r of wood)fill=cut(fill,r);
 return [batch('wood',wood,depth,z),batch('wool',fill,depth,z)];
}

// Local x/y are centred on the aperture. All planar cuts are in millimetres;
// thicknesses and z are metres. Timber replaces insulation in its own volume.
export function planWindowDetail({revealMode='source',revealDepth=.150,surroundingLayout}={}){
 if(!['source','field'].includes(revealMode))throw Error('Unknown reveal mode');
 const projection=projectSurrounding(surroundingLayout);
 const candidate=revealMode==='field'?planRevealCandidate({revealDepth,frameHeight:windowDetailSpec.frame.height,sillBackY:windowDetailSpec.sillBackY,facadeClearance:projection?projection.metadata.joint/2000:0}):null;
 const spec=candidate?{...windowDetailSpec,frame:{...windowDetailSpec.frame,z:candidate.frame.back},revealMode,revealCandidate:candidate}:windowDetailSpec;
 const canonicalLayout=surroundingLayout?.layout??layoutFor('SE',initialVisualLayouts.SE);
 const defaultOpening=canonicalLayout.openings.find(o=>o.id==='SE-W07');
 const centre=surroundingLayout?.centre??{x:defaultOpening.x+defaultOpening.width/2,y:defaultOpening.y+defaultOpening.height/2};
 const canonical=planFacadeSystem(canonicalLayout.facade,{layout:canonicalLayout,supportAlignment:canonicalLayout.cutPolicy==='notched-study'?'user-nine-hole':'panel-joints'});
 const projectedFasteners=canonical.fasteners?{...canonical.fasteners,width:wall.width,points:canonical.fasteners.points.filter(p=>p.x-centre.x>wall.x&&p.x-centre.x<wall.x+wall.width&&p.y-centre.y>wall.y&&p.y-centre.y<wall.y+wall.height).map(p=>({...p,x:p.x-centre.x+wall.width/2,y:p.y-centre.y,projectedOnly:true,newStockPart:false}))}:null;
 const canonicalWood=i=>canonical.layers[i].batches.filter(b=>b.kind==='wood').flatMap(b=>b.rectangles.flatMap(r=>{
  const p=intersect({...r,x:r.x-centre.x,y:r.y-centre.y},wall);return p?cut([{...r,...p}],hole):[];
 }));
 const verticalBatches=insulated('x',.05,0,true,canonicalWood(3));
 const horizontalWood=canonicalWood(4);
 const brackets=projectBracketContacts(canonical.brackets,{bounds:wall,centre,availableTimber:verticalBatches.find(b=>b.kind==='wood').rectangles});
 const battens=projection?.battens??grid('x',420,100),tape=projection?.tape??grid('x',420,90);
 let panels=projection?.panels??fullWall;
 if(!projection){for(const x of [-1680,-840,0,840,1680])panels=cut(panels,rect(x-4,-1425,8,2850));panels=cut(panels,rect(-1750,-4,3500,8));}
 const claddingBatches=[];
 if(projection){
  const variants=new Map();for(const r of panels){const part=r.sourcePart,key=part.colour+'-'+(part.cell%6);
   if(!variants.has(key))variants.set(key,{...batch('board',[],.008),colour:part.colour,materialVariant:part.cell%6,panelProjection:true});
   variants.get(key).rectangles.push(r);
  }claddingBatches.push(...variants.values());
 }else claddingBatches.push(batch('board',panels,.008));
 const layerBatches=[
  [batch('base',fullWall,.22)],
  bracketBatches(brackets),
  [batch('wool',cut(fullWall,ringOuter),.1),batch('wood',support,.1)],
  verticalBatches,
  [...insulated('y',.025,0,true,horizontalWood),...insulated('y',.025,.025,false,horizontalWood)],
  [batch('wind',fullWall,.009)],
  [batch('wood',battens,.025)],
  [batch('tape',tape,.002)],
  claddingBatches
 ];
 for(const i of [2,3,4])layerBatches[i]=layerBatches[i].flatMap(b=>pocketBatch(b,facadeLayerSpec[i].z,brackets.parts));
 if(candidate){
  const mm=v=>Math.round(v*1000*1e9)/1e9;
  const replacements=candidate.supports.map(s=>rect(mm(s.x[0]),mm(s.y[0]),mm(s.x[1]-s.x[0]),mm(s.y[1]-s.y[0])));
  layerBatches[4]=layerBatches[4].map(b=>b.z===0&&b.depth===.025?{...b,rectangles:replacements.reduce((rs,r)=>cut(rs,r),b.rectangles)}:b);
  layerBatches[4].push({...batch('wood',replacements,.025),candidateSupport:true,supportRecords:candidate.supports});
 }
 const layers=[...facadeLayerSpec,{id:'cladding',z:.021,thickness:.008,source:'VS-2; фіброцемент 8 мм'}];
 return {spec,hole,wall,revealMode,revealCandidate:candidate,brackets,fasteners:projectedFasteners,timberProjection:{facade:canonical.facade,centre,source:'canonical full facade; opening ring remains a separate candidate'},surroundingLayout:projection?.metadata??null,layers:layers.map((s,i)=>({...s,index:i,batches:layerBatches[i].map(b=>{
  const clipped=sillPocket(b,s.z,spec);
  return clipped.panelProjection?{...clipped,rectangles:clipped.rectangles.map(r=>({...r,panelRecord:panelRecordFor(r)}))}:clipped;
 })})),source,approved:false};
}

export function createWindowDetail(THREE,parent,options={}){
 const plan=planWindowDetail(options),candidate=plan.revealCandidate,groups=[],geometries=new Set(),materials=new Map(),textures=[];
 const unit=new THREE.BoxGeometry(1,1,1);geometries.add(unit);
 const colours={base:'#9b8f7b',wool:'#bdaf78',wood:'#b78d5d',wind:'#c8cfb9',tape:'#343c3e',board:'#d9d1bd',steel:'#aeb9be',paintedMetal:'#9aa9ad',frame:'#dde3df',sash:'#d0d8d5',bead:'#e4e9e5',gasket:'#293738',foam:'#d3ba78',lining:'#dbddd5'};
 function material(kind){
  if(kind==='board'&&options.claddingMaterials?.P222?.[0])return options.claddingMaterials.P222[0];
  if(materials.has(kind))return materials.get(kind);
  const m=kind==='glass'?new THREE.MeshPhysicalMaterial({color:'#e8eeee',metalness:0,roughness:.065,transmission:.90,thickness:.024,ior:1.5,opacity:1,transparent:false,envMapIntensity:1.1}):new THREE.MeshStandardMaterial({color:colours[kind],roughness:kind==='steel'?.35:kind==='paintedMetal'?.48:kind==='frame'?.46:kind==='sash'?.44:kind==='bead'?.42:kind==='gasket'?.82:.86,metalness:kind==='steel'?1:0});
  m.name=kind;if(kind==='glass')m.userData.opticalGlass=true;
  if(['wood','wool','board','base','wind'].includes(kind)){
   const n=64,data=new Uint8Array(n*n*4);let seed=71;
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=Math.round(170+(seed/4294967296)*35+(kind==='wood'?14*Math.sin(x*.7+Math.sin(y*.1)):0));const i=(y*n+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}
   const t=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;
   m.bumpMap=t;m.bumpScale=kind==='wood'?.0012:.0006;textures.push(t);
  }
  materials.set(kind,m);return m;
 }
 function prism(r){
  const points=r.profileYZ,n=points.length,left=r.x/1000,right=(r.x+r.width)/1000,vertices=[];
  const p=(side,i)=>[side?right:left,...points[i]];
  const triangle=(a,b,c)=>vertices.push(...a,...b,...c);
  for(let i=1;i<n-1;i++){triangle(p(0,0),p(0,i+1),p(0,i));triangle(p(1,0),p(1,i),p(1,i+1));}
  for(let i=0;i<n;i++){const j=(i+1)%n;triangle(p(0,i),p(0,j),p(1,j));triangle(p(0,i),p(1,j),p(1,i));}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometries.add(geometry);return geometry;
 }
 const projectionRecord=r=>r.panelRecord??panelRecordFor(r);
 function claddingMaterial(b){
  const external=options.claddingMaterials?.[b.colour];
  if(b.colour==='P222'&&Array.isArray(external)&&external.length)return external[b.materialVariant%external.length];
  if(b.colour==='P070'&&external?.isMaterial)return external;
  return material(b.kind);
 }
 for(const layer of plan.layers){
  const g=new THREE.Group();g.name='window-detail-'+layer.id;g.position.z=layer.z;
  g.userData={layer:layer.index,system:'facade',source:layer.source,approved:false,nominalZ:layer.z};parent.add(g);groups.push(g);
  if(layer.index===1)g.userData.brackets={parts:plan.brackets.parts.length,omissions:plan.brackets.omissions.filter(o=>o.reason.includes('detail')||o.reason.includes('candidate opening')),spec:plan.brackets.spec,approved:false};
  if(plan.surroundingLayout&&layer.index>=6)g.userData.surroundingLayout=plan.surroundingLayout;
  if(plan.surroundingLayout&&layer.index===8){g.userData.panelProjection=true;g.userData.panelRecords=layer.batches.flatMap(b=>b.rectangles.map(projectionRecord));}
  for(const b of layer.batches){
   if(!b.rectangles.length)continue;
   const metadata={layer:layer.index,system:'facade',materialKind:b.kind,source,approved:false,illustrative:[0,1,7,8].includes(layer.index),...(b.candidateSupport?{fieldCandidate:true,supportRecords:b.supportRecords}:{}),note:'Номінальна геометрія; фаза сітки й розкладка швів показові. Кишеня під відлив і зазор показові. Опори, анкери, рух і пожежні вузли не погоджені.'};
   const boxes=b.rectangles.filter(r=>!r.profileYZ),dummy=new THREE.Object3D(),surface=b.panelProjection?claddingMaterial(b):material(b.kind);
   if(boxes.length){const mesh=new THREE.InstancedMesh(unit,surface,boxes.length);
    boxes.forEach((r,i)=>{dummy.position.set((r.x+r.width/2)/1000,(r.y+r.height/2)/1000,b.z+b.depth/2);dummy.scale.set(r.width/1000,r.height/1000,b.depth);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.receiveShadow=true;mesh.userData={...metadata,...(boxes.some(r=>r.partId)?{components:boxes.map(r=>({partId:r.partId,sourcePartId:r.partId,kind:r.bracketRecord?'facade-bracket':'facade-timber',title:r.partId,projectedOnly:true,newStockPart:false,pairedTimberId:r.pairedTimberId,solidRole:r.solidRole,...(r.bracketRecord?{contact:r.bracketRecord.contact,pairedTimberBounds:r.bracketRecord.pairedTimberBounds,orientation:r.bracketRecord.orientation,sourceDimensions:r.bracketRecord.sourceDimensions}:{}),approved:false}))}:{}),...(b.panelProjection?{panelProjection:true,panelRecords:boxes.map(projectionRecord),colour:b.colour,materialVariant:b.materialVariant}:{})};g.add(mesh);
   }
   for(const r of b.rectangles.filter(r=>r.profileYZ)){const mesh=new THREE.Mesh(prism(r),surface);mesh.receiveShadow=true;mesh.userData={...metadata,sillPocket:true,...(b.panelProjection?{panelProjection:true,panelRecords:[projectionRecord(r)],colour:b.colour,materialVariant:b.materialVariant}:{})};g.add(mesh);}
  }
 }
 const markerState=plan.fasteners?addPanelFastenerMarkers(THREE,groups[8],plan.fasteners,{z:.009}):null;
 if(markerState)Object.assign(markerState.mesh.userData,{layer:8,system:'facade'});
 const window=new THREE.Group();window.name='window-detail-fixed';
 window.userData.component={kind:'window',title:'Вікно · дві стулки й вузол арк.14',source,note:'Проріз 1780×1475 мм заданий для фрагмента. PVC, тришаровий склопакет і стулки з відкриванням — за кресленням / §5.5; профіль 70×90 мм, поділ на дві стулки, імпост, ручки, зазор 10 мм, посадка й оптичне зображення скла тут показові. Ручки з боку приміщення; напрям відкривання та профіль виробника не визначені. Метал 0,6 мм PURAL; відлив 10°, виступ 30 мм. Кишеня під похилий відлив має показовий зазор 0,6 мм; загини й бічні виноси показові. RKL-31 30 мм, монтажні ущільнювальні стрічки й сітка не розгорнуті в монтажну геометрію. Кріплення та герметизація не погоджені.'};
 parent.add(window);
 if(candidate){window.userData.fieldCandidate=true;window.userData.revealCutPlan=candidate;window.userData.component={...window.userData.component,title:'Польовий кандидат · Cembrit відкоси / 150 мм',note:candidate.disclosure+' '+candidate.note};}
 window.userData.component.note='A01 SE-W07: зовнішній поділ510/1270, темно-сіра зовнішня/біла внутрішня рама — арк25/PDF73; три скла й керамічні дистанційні рамки — §5.7. Спільні з фасадом чисті розміри скла й кандидатний фальц; профілі70×90/склад4/10/4/10/4мм/стулкова фурнітура/RGB/загини та кріплення не погоджені, виробник і замовлені розміри невідомі. Inspection-копія не створює нових stock parts; proxy має нульову кількість матеріалу. Спільний кандидатний рівень тилу відливу:2мм нижче рами, нахил10°, виступ30мм.'+(candidate?' '+candidate.disclosure+' '+candidate.note:' Металеві відкоси PURAL0.6мм за арк14/PDF62; розгортки й герметизація невідомі.');
 function box(w,h,d,x,y,z,kind,component,angle=0){
  const mesh=new THREE.Mesh(unit,material(kind));mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.rotation.x=angle;mesh.receiveShadow=kind!=='glass';
  mesh.userData={materialKind:kind,detailRole:component.kind,source:component.source||source,approved:false,illustrative:component.illustrative??true,component};window.add(mesh);return mesh;
 }
 function ring(w,h,border,d,z,kind,component,cx=0,cy=0){
  for(const sx of [-1,1])box(border,h,d,cx+sx*(w-border)/2,cy,z+d/2,kind,component);
  for(const sy of [-1,1])box(w-2*border,border,d,cx,cy+sy*(h-border)/2,z+d/2,kind,component);
 }
 const frame=plan.spec.frame,frameShift=frame.z-windowDetailSpec.frame.z;
 const profiles=createWindowProfiles(THREE,window,{width:1.780,height:1.475,windowId:'SE-W07',windowType:'A-01',frameBack:frame.z,
  variantId:candidate?'field-recess-'+Math.round(candidate.revealDepth*1000):'source',inspectionRepresentation:true,
  roleNames:{'outer-frame':'window-frame',mullion:'window-mullion',sash:'window-sash',bead:'glazing-bead',gasket:'glazing-gasket'}});
 window.userData.windowId='SE-W07';window.userData.windowType='A-01';window.userData.inspectionRepresentation=true;window.userData.newStockPart=false;
 window.userData.windowProfilePlan=profiles.plan;
 window.userData.profileCandidate={double:true,glassLeaves:2,frameWidth:frame.width,frameHeight:frame.height,frameBack:frame.z,frameFront:frame.z+frame.depth,leaves:profiles.plan.leaves,divider:profiles.plan.divider};
 const foam={kind:'window-foam',title:'Монтажна піна',source:'Арк.14 / PDF62',illustrative:true,note:'Піна за джерелом;10mm side/top and35mm bottom candidate fit shared with facadeA01.'};
 for(const sx of [-1,1])box(.010,1.475,frame.depth,sx*.885,0,frame.z+frame.depth/2,'foam',foam);
 box(1.760,.010,frame.depth,0,.7325,frame.z+frame.depth/2,'foam',foam);
 box(1.760,.035,frame.depth,0,-.720,frame.z+frame.depth/2,'foam',foam);

 const metal=windowDetailSpec.metalThickness,front=.029,rear=frame.z+frame.depth,revealDepth=front-rear;
 const reveal={kind:'window-reveal',title:'Металевий відкос · PURAL 0,6 мм',source:'Арк.14 / PDF62',illustrative:true,note:'Матеріал і товщина за кресленням. Довжина від умовної рами до фасаду; розгортка, загини й кріплення потребують робочого вузла.'};
 if(!candidate){
  for(const sx of [-1,1])box(metal,1.455,revealDepth,sx*(.890-metal/2),0,rear+revealDepth/2,'paintedMetal',reveal);
  for(const sx of [-1,1])box(.010,1.455,metal,sx*.885,0,rear+metal/2,'paintedMetal',{...reveal,kind:'side-frame-return',title:'Примикання відкосу до рами · показовий загин'});
  box(frame.width,.010,metal,0,.7325,rear+metal/2,'paintedMetal',{...reveal,kind:'head-frame-return',title:'Примикання верхнього відкосу до рами · показовий загин'});
  box(1.780,metal,revealDepth+.020,0,.7375-metal/2,rear+(revealDepth+.020)/2,'paintedMetal',{...reveal,kind:'head-flashing',title:'Верхній відкіс / крапельник'});
  box(1.780,.014,metal,0,.7375-metal-.007,front+.020,'paintedMetal',{...reveal,kind:'head-drip',title:'Верхній крапельник · показовий загин'});
 }else for(const part of candidate.parts){
  const r={x:part.geometry.x[0]*1000,width:(part.geometry.x[1]-part.geometry.x[0])*1000,profileYZ:part.geometry.profileYZ};
  const mesh=new THREE.Mesh(prism(r),material('board'));mesh.receiveShadow=true;
  mesh.userData={materialKind:'board',detailRole:part.role,fieldCandidate:true,partId:part.id,source:part.source,approved:false,illustrative:true,cutPlan:part,
   component:{kind:'field-reveal-board',title:part.id+' · Cembrit кандидат',source:part.source,note:part.note}};
  window.add(mesh);
 }
 const backY=profiles.plan.sillBackY,sillPlan=planWindowSill({width:1.780,frameWidth:profiles.plan.frameW,frameFront:rear,backY,front,projection:windowDetailSpec.sillProjection,metal,degrees:windowDetailSpec.sillAngleDegrees});
 const sill={kind:'window-sill',title:'Відлив · PURAL 0,6 мм',source:'Арк.14 / PDF62',illustrative:true,note:'На кресленні: мінімальний нахил 10°, позначений виступ 30 мм. Ширина, загини й посадка відливу тут показові.'};
 for(const p of sillPlan.parts){const mesh=box(...p.size,...p.position,'paintedMetal',{...sill,kind:p.role==='sill'?'window-sill':p.role,title:p.role==='sill'?'Відлив · PURAL 0,6 мм':p.role==='sill-hem'?'Підгин крапельника':p.role==='sill-drip'?'Передній крапельник':'Загин відливу'},p.rotation);mesh.userData.sillPlan={sourceFacts:sillPlan.sourceFacts,candidate:sillPlan.candidate,orderedFoldProfile:null};}
 window.userData.windowSillPlan=sillPlan;

 const lining={kind:'interior-reveal',title:'Внутрішній відкіс · гіпс 13 мм',source:'Арк.14 / PDF62',illustrative:true,note:'Товщина 13 мм за джерелом; довжина й крайова посадка схематичні.'};
 const interiorDepth=frame.z-plan.layers[0].z,interiorZ=(frame.z+plan.layers[0].z)/2,sillDepth=frame.z+.455;
 for(const sx of [-1,1])box(.013,1.475,interiorDepth,sx*(.890-.0065),0,interiorZ,'lining',lining);
 box(1.754,.013,interiorDepth,0,.7375-.0065,interiorZ,'lining',lining);
 box(1.754,.018,sillDepth,0,-.7375+.009,(frame.z-.455)/2,'frame',{kind:'interior-sill',title:'Внутрішнє PVC підвіконня · 18 мм',source:'Арк.14 / PDF62',illustrative:true,note:'Товщина 18 мм за кресленням. Стоїть над нижньою опорою й доходить до тильної площини рами; ширина, довжина та посадка показові.'});

 let disposed=false;
 return {groups,window,plan,revealMode:plan.revealMode,revealCutPlan:candidate,dispose(){
  if(disposed)return;disposed=true;profiles.dispose();markerState?.dispose();
  for(const group of [...groups,window]){group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});group.removeFromParent();group.clear();}
  for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();for(const t of textures)t.dispose();
 }};
}
