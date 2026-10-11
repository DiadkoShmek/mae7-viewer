// P-8/8/22 sheet 14 / PDF62 supplies PVC triple glazing and PURAL 0.6mm
// flashings, a minimum 10-degree sill and the marked 30mm projection.
// The manufacturer frame/sash profile and opening configuration are unknown.
import {createGlazingUnit} from './glazing-unit.js';
import {resolveWindowSchedule} from './window-schedule.js';
import {planWindowSill} from './window-sill.js';
export const facadeWindowSpec={frameSection:.070,frameDepth:.090,frameBack:-.135,sideGap:.010,topGap:.010,bottomGap:.035,
 sashSection:.040,sashDepth:.035,sashBack:-.085,mullion:.065,bead:.012,gasket:.002,glassGeometry:.006,
 metal:.0006,sillDegrees:10,sillProjection:.030,front:.029,source:'P-8/8/22 · арк.14 / PDF62',approved:false};
const caches=new WeakMap();
function resources(THREE){
 if(caches.has(THREE))return caches.get(THREE);
 const geometry=new THREE.BoxGeometry(1,1,1),materials={
  frame:new THREE.MeshStandardMaterial({color:'#dde3df',roughness:.46,metalness:0}),
  sash:new THREE.MeshStandardMaterial({color:'#d0d8d5',roughness:.44,metalness:0}),
  bead:new THREE.MeshStandardMaterial({color:'#e4e9e5',roughness:.42,metalness:0}),
  gasket:new THREE.MeshStandardMaterial({color:'#293738',roughness:.82,metalness:0}),
  foam:new THREE.MeshStandardMaterial({color:'#c1aa71',roughness:.95,metalness:0}),
  paintedMetal:new THREE.MeshStandardMaterial({color:'#849599',roughness:.48,metalness:0}),
  glass:new THREE.MeshPhysicalMaterial({color:'#e8eeee',metalness:0,roughness:.065,transmission:.90,thickness:.024,ior:1.5,opacity:1,transparent:false,envMapIntensity:1.1})
 };
 materials.frameExterior=new THREE.MeshStandardMaterial({color:'#454c50',roughness:.46});
 materials.sashExterior=new THREE.MeshStandardMaterial({color:'#454c50',roughness:.44});
 materials.beadExterior=new THREE.MeshStandardMaterial({color:'#454c50',roughness:.42});
 for(const [kind,m] of Object.entries(materials)){m.name=kind;m.userData.materialFamily=kind==='glass'?'glass':kind==='gasket'?'seal':kind==='foam'?'foam':['frame','sash','bead','frameExterior','sashExterior','beadExterior'].includes(kind)?'pvc':'coated_metal';
  if(kind.endsWith('Exterior'))m.userData.finish={source:'арк25/26; PDF73/74:dark-grey exterior for scheduled windows',colourCandidate:'#454c50',orderedRAL:null};
  if(['frame','sash','bead'].includes(kind))m.userData.finish={source:'арк25/26; PDF73/74:white interior for scheduled windows; unknown types illustrative',colourCandidate:'#dde3df',orderedRAL:null};
 }
 // Transmission uses its own optical render pass; an opaque blue backing
 // would lose the aperture. transparent=false also permits static instancing.
 materials.glass.userData.opticalGlass=true;
 const cache={geometry,materials,users:0};caches.set(THREE,cache);return cache;
}

export function planWindowProfiles({width,height,windowId,windowType,type,assemblyId,componentRole,frameBack=facadeWindowSpec.frameBack,variantId='source',inspectionRepresentation=false}={}){
 const s=facadeWindowSpec;if(![width,height,frameBack].every(Number.isFinite)||width<=.30||height<=.30)throw Error('Invalid window profile plan');
 const schedule=resolveWindowSchedule({width,height,windowId,windowType,type,assemblyId,componentRole});
 const confirmedA01=schedule.confirmed&&schedule.boundType==='A-01';
 const frameW=width-2*s.sideGap,frameH=height-s.topGap-s.bottomGap,cy=(s.bottomGap-s.topGap)/2,innerW=frameW-2*s.frameSection,innerH=frameH-2*s.frameSection,double=schedule.confirmed?schedule.fields===2:width>1.2;
 const divider=schedule.sourceFacts.grossSubdivisions?-width/2+schedule.sourceFacts.grossSubdivisions[0]:0;
 const intervals=double?[[-innerW/2,divider-s.mullion/2],[divider+s.mullion/2,innerW/2]]:[[-innerW/2,innerW/2]];
 const leaves=intervals.map(([a,b],leafId)=>({leafId,x:(a+b)/2,width:b-a,height:innerH,glassWidth:b-a-2*(s.sashSection+s.bead+s.gasket),glassHeight:innerH-2*(s.sashSection+s.bead+s.gasket)}));
 if(leaves.some(l=>Math.min(l.glassWidth,l.glassHeight)<=.030))throw Error('Window profile leaves no valid glazing field');
 return {windowId:windowId??(assemblyId&&componentRole?`${assemblyId}-${componentRole.toUpperCase()}`:undefined),windowType:windowType??type??null,confirmedA01,confirmedSourceType:schedule.confirmed?schedule.boundType:null,schedule,frameW,frameH,cy,sillBackY:cy-frameH/2-.002,sillProjection:(schedule.confirmed&&schedule.assemblyId)? .010:s.sillProjection,innerW,innerH,double,divider,leaves,frameBack,frameFront:frameBack+s.frameDepth,frameShift:frameBack-s.frameBack,variantId,inspectionRepresentation,approved:false,
  sourceFacts:schedule.sourceFacts,
  unknown:{supplierProfile:null,orderedGlazing:null,finishRAL:null,openingDirection:null},note:'70×90 frame/35mm sash/clear leaf sizes are candidate fits; scheduled divisions are gross outside dimensions, not clear glass widths. Dark-grey outside/white inside are source finish families; RGB/RAL and30/60 depth split are candidates.'};
}
let anonymousId=0;
export function createWindowProfiles(THREE,parent,options={}){
 const plan=planWindowProfiles(options),s=facadeWindowSpec,cache=resources(THREE),owned=[],units=[];cache.users++;
 const roles=options.roleNames??{};const role=name=>roles[name]??name;
 const id=options.windowId??(options.assemblyId&&options.componentRole?`${options.assemblyId}-${options.componentRole.toUpperCase()}`:'DISPLAY-WINDOW-'+(++anonymousId));
 function box(name,kind,w,h,d,x,y,z){const mesh=new THREE.Mesh(cache.geometry,cache.materials[kind]);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.receiveShadow=true;
  mesh.userData={windowRole:role(name),detailRole:role(name),materialKind:kind.includes('Exterior')?name==='sash'?'sash':name==='bead'?'bead':'frame':kind,
   source:plan.schedule.source??s.source,approved:false,illustrative:true,sharedWindowResources:true,windowId:id,inspectionRepresentation:plan.inspectionRepresentation,assemblyId:plan.schedule.assemblyId,componentRole:plan.schedule.componentRole,
   replacementStatus:plan.schedule.replacementStatus,openingDirection:null};parent.add(mesh);owned.push(mesh);return mesh;}
 function ring(name,kind,w,h,border,d,x,y,z){for(const side of [-1,1])box(name,kind,border,h,d,x+side*(w-border)/2,y,z+d/2);for(const side of [-1,1])box(name,kind,w-2*border,border,d,x,y+side*(h-border)/2,z+d/2);}
 const exterior=!!plan.confirmedSourceType;
 if(exterior){ring('outer-frame','frame',plan.frameW,plan.frameH,s.frameSection,.030,0,plan.cy,plan.frameBack);ring('outer-frame','frameExterior',plan.frameW,plan.frameH,s.frameSection,.060,0,plan.cy,plan.frameBack+.030);}
 else ring('outer-frame','frame',plan.frameW,plan.frameH,s.frameSection,s.frameDepth,0,plan.cy,plan.frameBack);
 if(plan.double){if(exterior){box('mullion','frame',s.mullion,plan.innerH,.030,plan.divider,plan.cy,plan.frameBack+.015);box('mullion','frameExterior',s.mullion,plan.innerH,.060,plan.divider,plan.cy,plan.frameBack+.060);}else box('mullion','frame',s.mullion,plan.innerH,s.frameDepth,plan.divider,plan.cy,plan.frameBack+s.frameDepth/2);}
 for(const l of plan.leaves){
  const z=s.sashBack+plan.frameShift,beadW=l.width-2*s.sashSection,beadH=l.height-2*s.sashSection;
  if(exterior){ring('sash','sash',l.width,l.height,s.sashSection,.012,l.x,plan.cy,z);ring('sash','sashExterior',l.width,l.height,s.sashSection,.023,l.x,plan.cy,z+.012);
   ring('bead','beadExterior',beadW,beadH,s.bead,.012,l.x,plan.cy,-.065+plan.frameShift);
   ring('glazing-stop','bead',beadW,beadH,s.bead,.004,l.x,plan.cy,-.084+plan.frameShift);
   const unit=createGlazingUnit(THREE,parent,{windowId:id,leafId:l.leafId,width:l.glassWidth,height:l.glassHeight,cx:l.x,cy:plan.cy,back:-.084+plan.frameShift,
    variantId:plan.variantId,inspectionRepresentation:plan.inspectionRepresentation,showPhysical:options.showPhysical,quantityEligible:plan.schedule.quantityEligible,
    assemblyId:plan.schedule.assemblyId,replacementStatus:plan.schedule.replacementStatus,source:plan.schedule.source,sourceFacts:plan.sourceFacts,
    sourceConflict:plan.schedule.sourceConflict,compositionAuthority:plan.schedule.compositionAuthority});units.push(unit);
  }else{
   ring('sash','sash',l.width,l.height,s.sashSection,s.sashDepth,l.x,plan.cy,z);
   ring('bead','bead',beadW,beadH,s.bead,.012,l.x,plan.cy,-.077+plan.frameShift);
   const gw=beadW-2*s.bead,gh=beadH-2*s.bead;ring('gasket','gasket',gw,gh,s.gasket,.004,l.x,plan.cy,-.069+plan.frameShift);
   const g=box('glazing','glass',l.glassWidth,l.glassHeight,s.glassGeometry,l.x,plan.cy,-.072+plan.frameShift);g.receiveShadow=false;
   g.userData={...g.userData,leaf:l.leafId,opticalGlass:true,physical:false,quantityEligible:false,quantity:0,glazingRole:'legacy-optical-illustration',note:'Non-A01 display only; no new source-backed glazing inventory. Basement replacement not claimed.'};
  }
  if(plan.schedule.fixed||(!exterior&&l.leafId>0))continue;
  const hx=plan.double?(l.leafId===0?plan.divider-s.mullion/2-s.sashSection/2:plan.divider+s.mullion/2+s.sashSection/2):plan.innerW/2-s.sashSection/2;
  box('handle-base','frame',.022,.055,.009,hx,plan.cy,z-.0045);box('handle-neck','frame',.013,.020,.026,hx,plan.cy,z-.022);box('handle-lever','frame',.014,.130,.016,hx,plan.cy-.055,z-.033);
 }
 let disposed=false;return {plan,units,dispose(){if(disposed)return;disposed=true;for(const o of owned)o.removeFromParent();for(const u of units)u.dispose();if(--cache.users===0){cache.geometry.dispose();for(const m of Object.values(cache.materials))m.dispose();caches.delete(THREE);}}};
}

export function createFacadeWindow(THREE,parent,{x=0,y=0,width,height,windowId,windowType,type,assemblyId,componentRole,showPhysical=false}={}){
 if(![x,y,width,height].every(Number.isFinite)||width<=.30||height<=.30)throw Error('Invalid window aperture');
 const s=facadeWindowSpec,cache=resources(THREE),root=new THREE.Group();
 root.position.set(x,y,0);root.name='facade-window';
 root.userData.component={kind:'window',title:'PVC вікно · рама, стулка й примикання',source:s.source,note:`Габарит прорізу ${Math.round(width*1000)}×${Math.round(height*1000)} мм заданий джерельною моделлю. PVC і тришаровий склопакет — за арк.14; профіль 70×90 мм, стулки, імпости, внутрішня ручка й посадка показові. Напрям відкривання потребує специфікації. Зазори 10 мм з боків/зверху та 35 мм знизу — ілюстративний монтажний сценарій для похилого відливу. Метал PURAL 0,6 мм; нахил 10°, виступ 30 мм. Опори, ущільнення, кріплення й пожежні вузли не погоджені.`};
 root.userData.aperture={width,height};root.userData.approved=false;root.userData.sharedWindowResources=true;parent.add(root);
 const frameW=width-2*s.sideGap,frameH=height-s.topGap-s.bottomGap,cy=(s.bottomGap-s.topGap)/2,frameFront=s.frameBack+s.frameDepth;
 function box(role,kind,w,h,d,px,py,pz,angle=0){
  if([w,h,d].some(v=>v<=0||!Number.isFinite(v)))throw Error('Invalid window component');
  const mesh=new THREE.Mesh(cache.geometry,cache.materials[kind]);mesh.scale.set(w,h,d);mesh.position.set(px,py,pz);mesh.rotation.x=angle;mesh.receiveShadow=kind!=='glass';
  mesh.userData={windowRole:role,materialKind:kind,source:s.source,approved:false,illustrative:true,sharedWindowResources:true};root.add(mesh);return mesh;
 }
 function ring(role,kind,w,h,border,d,px,py,z){
  for(const side of [-1,1])box(role,kind,border,h,d,px+side*(w-border)/2,py,z+d/2);
  for(const side of [-1,1])box(role,kind,w-2*border,border,d,px,py+side*(h-border)/2,z+d/2);
 }
 const profiles=createWindowProfiles(THREE,root,{width,height,windowId,windowType:windowType??type,assemblyId,componentRole,showPhysical});
 root.userData.windowId=profiles.plan.windowId;root.userData.windowType=windowType??type??null;root.userData.sourceOpeningId=profiles.plan.windowId;root.userData.sourceWindowType=windowType??type??null;root.userData.windowProfilePlan=profiles.plan;
 root.userData.windowSchedule=profiles.plan.schedule;root.userData.assemblyId=profiles.plan.schedule.assemblyId;root.userData.componentRole=profiles.plan.schedule.componentRole;
 root.userData.quantityEligible=profiles.plan.schedule.quantityEligible;root.userData.quantityKey=profiles.plan.schedule.quantityKey;root.userData.replacementStatus=profiles.plan.schedule.replacementStatus;
 root.userData.sourceConflict=profiles.plan.schedule.sourceConflict;root.userData.compositionAuthority=profiles.plan.schedule.compositionAuthority;
 if(!profiles.plan.confirmedSourceType)root.userData.component.note=`${root.userData.windowType??'Тип невідомий'}: показові профіль і оптика; до обліку нового склопакета не включено. Поділ, посадка й склад потребують специфікації.`;
 else if(!profiles.plan.confirmedA01){const q=profiles.plan.schedule;root.userData.component.source=q.source;root.userData.component.note=`${q.boundType} · ${Math.round(width*1000)}×${Math.round(height*1000)} мм, ${q.source}. Темно-сіра зовні / біла всередині. ${q.sourceConflict?'A07: специфікація називає підвальним, §5.7 залишає підвальні вікна; тут фізичний кандидат без закупівельного обліку.':'Три скла; керамічні рамки за §5.7.'} ${q.fixed?'Вікно поруч із балконними дверима — фіксоване. ':''}${q.boundType==='A-06'?'Димовидалення 24 V — за джерелом; форма й кріплення мотора невідомі. ':''}Профіль 70×90, фальц, чисті розміри скла й склад 32 мм — непогоджені кандидати; напрям відкривання невідомий.`;}
 if(profiles.plan.confirmedA01)root.userData.component.note='A01 за арк25/PDF73:1780×1475мм, зовнішній поділ510/1270, темно-сіра зовнішня/біла внутрішня рама;§5.7:три скла й керамічні дистанційні рамки. Профіль70×90,фальц/стулки/чисті розміри скла й склад4/10/4/10/4мм — непогоджені кандидати; виробник, газ, покриття, крайові ущільнення й замовлені розміри невідомі. Оптичний proxy не є матеріалом; кандидати посадки/відкривання й PURAL0.6мм/10°/30мм потребують робочого вузла.';
 for(const side of [-1,1])box('perimeter-foam','foam',s.sideGap,height,s.frameDepth,side*(width-s.sideGap)/2,0,s.frameBack+s.frameDepth/2);
 box('perimeter-foam','foam',frameW,s.topGap,s.frameDepth,0,height/2-s.topGap/2,s.frameBack+s.frameDepth/2);
 box('perimeter-foam','foam',frameW,s.bottomGap,s.frameDepth,0,-height/2+s.bottomGap/2,s.frameBack+s.frameDepth/2);

 const metal=s.metal,revealDepth=s.front-frameFront;
 for(const side of [-1,1]){
  box('side-reveal','paintedMetal',metal,frameH,revealDepth,side*(width/2-metal/2),cy,frameFront+revealDepth/2);
  box('side-frame-return','paintedMetal',s.sideGap,frameH,metal,side*(width/2-s.sideGap/2),cy,frameFront+metal/2);
 }
 box('head-reveal','paintedMetal',width,metal,revealDepth+.020,0,height/2-metal/2,frameFront+(revealDepth+.020)/2);
 box('head-frame-return','paintedMetal',frameW,s.topGap,metal,0,height/2-s.topGap/2,frameFront+metal/2);
 box('head-drip','paintedMetal',width,.014,metal,0,height/2-metal-.007,s.front+.020);

 // The illustrative 35mm bottom gap leaves the complete source-angle sill
 // above the unchanged rectangular rough-opening bottom, including its folds.
 const backY=profiles.plan.sillBackY,sillPlan=planWindowSill({width,frameWidth:frameW,frameFront,backY,front:s.front,projection:profiles.plan.sillProjection,metal,degrees:s.sillDegrees});
 for(const p of sillPlan.parts){const mesh=box(p.role,'paintedMetal',...p.size,...p.position,p.rotation);mesh.userData.sillPlan={sourceFacts:sillPlan.sourceFacts,candidate:sillPlan.candidate,orderedFoldProfile:null};}
 root.userData.windowSillPlan=sillPlan;
 root.userData.profileCandidate={double:profiles.plan.double,frameWidth:frameW,frameHeight:frameH,frameCentreY:cy,sillBackY:backY,frameFront,glassLeaves:profiles.plan.leaves.length,confirmedA01:profiles.plan.confirmedA01,confirmedSourceType:profiles.plan.confirmedSourceType,divider:profiles.plan.divider};
 let disposed=false;
 root.dispose=()=>{
  if(disposed)return;disposed=true;root.removeFromParent();root.clear();
  profiles.dispose();
 };
 return root;
}
