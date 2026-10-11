import {facadeColourReference} from './facade-colour-reference.js';
import {createWindowDecoration} from './window-decoration.js';
import {createRetainedBalconyReturns} from './balcony-returns.js';
import {createBalconyFoundation} from './balcony-foundation.js';
import {createGroundJunctions} from './ground-junctions.js';
import {createAtticFloor} from './attic-floor.js';
import {balconyCanopyGeometry} from './balcony-canopy.js';
import {planPanelFasteners,addPanelFastenerMarkers} from './panel-fastener-pattern.js';
import {makeLayout,floorLevels} from './engineering.js';
import {southeastOpenings} from './source-openings.js';
import {northwestOpenings} from './northwest-openings.js';
import {balconyOpenings} from './balcony-openings.js';
import {gableLayout} from './gables.js';
import {createFacadeSystem} from './facade-system.js';
import {balconyBays,balconySpec,balconyFullSide} from './assembly-geometry.js';
import {createWindowDetail} from './window-detail.js';
import {createFacadeWindow} from './facade-window.js';
import {createBalconyMaterials} from './balcony-materials.js';
import {createBalconySteel,createBalconySteelMaterial} from './balcony-steel.js';
import {planBalconyGuard,createBalconyGuard} from './balcony-guard.js';
import {planBalconyFloor,createBalconyFloor,createBalconyFloorMaterials} from './balcony-floor.js';
import {createEntrance,entranceSpec,entranceCentres} from './entrance.js';
import {planGroundFloorAccess,createGroundFloorAccessGeometry} from './entrance-access.js';
import {createAddressLabel} from './address-label.js';
import {roofSpec,roofSide,roofFrame,roofSurfaceY} from './roof-geometry.js';
import {createRoofAssembly} from './roof-assembly.js';
import {createRoofEdgeDetails} from './roof-edge-details.js';
import {createRainwaterDetails} from './rainwater-details.js';
import {createPlinthAssembly} from './plinth-assembly.js';
import {planJointBackings,createJointBackings} from './joint-backings.js';
import {facades,layoutFor,endWindows,initialVisualLayouts} from './facade-layouts.js';
import {createFacadeCorners} from './facade-corners.js';
import {visualPanelLayout} from './visual-panel-layout.js';
import {panelContourGeometry} from './panel-contour-geometry.js';
import {panelDrilling} from './panel-drilling.js';
import {layoutOptions} from './layout-options.js';
import * as THREE from 'three';
import {mergeGeometries} from './assets/BufferGeometryUtils.js';

// Nominal geometry from P-8/8/22, sheets 02,05–08. Openings and small
// accessories are traced approximately; this is a presentation, not a BIM survey.
export const geometry={length:40.4,depth:11.24,attic:8.525,ridge:11.109};
export const layers=[
 {id:'base',title:'Існуюча стіна',color:'#a5aca9',spec:'Блоки · §4.1',note:'Записка §4.1 називає стіни блоковими. Тип блоків, їхній стан, товщина й опір анкерам потребують огляду; товщина в моделі умовна.'},
 {id:'anchors',title:'Кронштейни',color:'#75828b',spec:'VS-2 · арк. 08',note:'Проєкт показує L-кронштейн 150×150×60×2,5 мм; кількість і положення у фрагменті показові. Анкери, несуча здатність і фактичне розташування потребують робочого проєкту та перевірки основи.'},
 {id:'wool100',title:'Вата · 100 мм',color:'#bcad71',spec:'100 мм · VS-2',note:'Перший шар мінеральної вати. Загальна номінальна товщина вати в цьому проєкті — 200 мм.'},
 {id:'vertical50',title:'Брус + вата · 50 мм',color:'#b89566',spec:'Вертикально · 50 мм',note:'Вертикальний брус 50×50 мм з ватою між елементами. На аркуші 08 показаний крок 600 мм; монтаж звіряють із чинним проєктом.'},
 {id:'horizontal50',title:'Брус + вата · 50 мм',color:'#c2a878',spec:'Горизонтально · 50 мм',note:'Другий перехресний ряд бруса 50×50 мм з ватою. Це третій шар утеплення: 100 + 50 + 50 мм.'},
 {id:'windboard',title:'Вітрозахисна плита',color:'#c6cfbb',spec:'Вітрогіпс · 9 мм',note:'Зовнішній вітрогіпс 9 мм за VS-2. Стики герметизуються сумісною системою. Точну марку уточнюємо; це не звичайний внутрішній гіпсокартон.'},
 {id:'battens',title:'Дошки / вентзазор',color:'#af8757',spec:'Дошка · 100×25 мм',note:'Польовий варіант: дошки100×25, дві окремі дошки біля шва; стрічка по центру. Дев’ять показових точок на повній1192×1250 плиті. Проєктний номінал420мм залишається окремим джерельним варіантом; кріплення й отвори до погодження.'},
 {id:'epdm',title:'Захисна стрічка',color:'#333b3e',spec:'За системою облицювання',note:'Стрічка на рейках під стиками облицювання. Тип і сумісність визначають за актуальною документацією виробника.'},
 {id:'cladding',title:'Cembrit / Swisspearl',color:'#dbd1bb',spec:'Фіброцемент · 8 мм',note:'Проєкт: 8 мм, Cembrit Patina як приклад; основний колір P222, акценти P070. Екранні кольори й розкладка швів наближені.'}
];
export const roofLayers=[
 {id:'rafters',title:'Крокви / перекриття PP-1',color:'#8e7454',spec:'Огляд / арк.12',note:'Переріз і крок тут ілюстративні. Проєкт вимагає огляду, перевірки міцності та робочого рішення пошкоджених місць.'},
 {id:'underlay',title:'Підпокрівельна мембрана',color:'#647c87',spec:'Арк.12',note:'На арк.12 названа не дихаюча підкладка. Точний матеріал, нахльости та водовідведення узгоджують із системою даху.'},
 {id:'counter',title:'Контрлати',color:'#ae8554',spec:'32×50 мм',note:'Контрлати 32×50 мм за арк.12. Крок слідує опорам крокв; модель не призначає їхню несучу здатність.'},
 {id:'roofbattens',title:'Лати',color:'#c6a372',spec:'32×100 мм',note:'Лати32×100. Крок — за інструкцією точної моделі покриття. У фрагменті крок ілюстративний, не розкладка монтажу.'},
 {id:'metal',title:'Classic / PURAL',color:'#4a5158',spec:'0,6 мм · §5.4',note:'Металеве покриття0,6мм. Форма стоячого фальца спрощена; профіль і кріплення уточнюємо за замовленою системою.'}
];
export const plinthLayers=[
 {id:'existing',title:'Стіна / кронштейни',color:'#9aa19a',spec:'VS-1 · арк.09',note:'Кронштейни закріплені до існуючого цоколя й проходять крізь утеплення до бруса. При розкритті вони показані перед EPS. Стан основи, виріб та анкери перевіряють на об’єкті.'},
 {id:'eps100',title:'EPS Perimeeter',color:'#eef0df',spec:'100 мм · VS-1',note:'Перший шар EPS120 Perimeeter100мм за арк.09. Належність марок і сумісність кріплень звіряють з проєктом.'},
 {id:'plinthwood',title:'Брус / EPS',color:'#b79362',spec:'50×75 / EPS50',note:'Вертикальний брус50×75 з EPS50мм. Крок бруса600мм. Кутики й місцеві пази показані як контактний кандидат; виріб, анкери та висотний крок ще потребують робочого вузла.'},
 {id:'hat',title:'Металевий профіль',color:'#7c919e',spec:'25 мм / крок420',note:'Горизонтальний профіль25мм із прорізами30×18мм у двох полицях, крок60мм. Прорізи відкривають вертикальний прохід. Виріб, вентиляційну площу, несучу здатність і кріплення ще погодити.'},
 {id:'plinthboard',title:'Фіброцемент P070',color:'#434d53',spec:'8 мм',note:'Облицювання8мм. Висота, низ, водовідведення і перехід до фасаду — окремі вузли, не копія VS-2.'}
];
const detailOpening=facades.SE.openings.find(o=>o.id==='SE-W07');
export const origin={x:(detailOpening.x+detailOpening.width/2-facades.SE.width/2)/1000,y:(detailOpening.y+detailOpening.height/2)/1000,z:5.62};
export const layerZ=[-.435,-.215,-.215,-.115,-.065,-.015,-.006,.019,.021];
export function createModel(scene,{authoring=false}={}){
 let facadeCut=false;const panelRecords=[],facadeGroups={},activeLayouts=structuredClone(initialVisualLayouts);const building=new THREE.Group(),garden=new THREE.Group(),patch=new THREE.Group();patch.userData.component={kind:'wall',title:'Розкриття VS-2 на фасаді',source:'Арк. 08 / PDF 56',note:'Розкриття прив’язане до вікна ПдСх. Товщини нових шарів номінальні з проєкту; розсування збільшене.'};scene.add(building,garden,patch);
 function material(color,r=.82,m=0){return new THREE.MeshStandardMaterial({color,roughness:r,metalness:m});}
 // Seeded fine surface variation, generated as material data, not a rendered image.
 function grain(kind){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');let seed=81;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};const a=ctx.createImageData(256,256);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const v=kind==='wood'?165+20*Math.sin(x*.28+Math.sin(y*.035))+rand()*15:160+rand()*65;const i=(y*256+x)*4;a.data[i]=a.data[i+1]=a.data[i+2]=v;a.data[i+3]=255;}ctx.putImageData(a,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='wood'?2:3,kind==='wood'?6:3);return t;}
 const stone=grain('stone'),timber=grain('wood');
 const beige=material('#f6f2e6'),charcoal=material('#676664'),joint=material('#3d4343'),base=material('#9b8f7b'),steel=material('#aeb7bc',.32,.75),dark=material('#333d41',.6,.3),wood=material('#b58b59'),wool=material('#baae78'),wind=material('#c8cfb9');
 base.userData.finishAuthority='Illustrative weathered plaster guided by supplied building photographs; not a site scan or confirmation of the core material';
 for(const [m,code] of [[beige,'P222'],[charcoal,'P070']]){const ref=facadeColourReference[code];m.userData.colourReference=ref;m.userData.portableTexture=ref.portableTexture;m.userData.finishAuthority='manufacturer digital colour sample; physical ordered-batch colour unknown';}
 for(const m of [base,wool,wind]){m.bumpMap=stone;m.bumpScale=.0012;}wood.bumpMap=timber;wood.bumpScale=.0025;
 const glass=new THREE.MeshPhysicalMaterial({color:'#7696a3',metalness:.12,roughness:.08,clearcoat:1,envMapIntensity:1.25});
 const {clear:balconyGlass,canopy:balconyCanopyGlass}=createBalconyMaterials(THREE);
 function box(w,h,d,x,y,z,m,p=building){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
 function beam(a,b,width,m,p=building){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),o=box(width,start.distanceTo(end),width,0,0,0,m,p);o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());return o;}
 function face(sign){const g=new THREE.Group();g.position.z=sign*5.62;if(sign<0)g.rotation.y=Math.PI;g.userData.component={kind:'facade',title:sign>0?'Фасад ПдСх · три входи':'Фасад ПнЗх · балкони',source:'Арк. 05 / PDF 53',note:'Довжина 40,4 м. Центри прорізів відтворені приблизно за фасадом; фактичні обміри очікуються.'};building.add(g);return g;}
 function win(p,x,y,w=1.86,h=1.45,source={}){const window=createFacadeWindow(THREE,p,{x,y,width:w,height:h,windowId:source.id,type:source.type,assemblyId:source.assemblyId,componentRole:source.componentRole});if(source.componentRole!=='door')createWindowDecoration(THREE,window,{width:w,height:h,windowId:source.id,type:source.type});return window;}
 for(const [m,name] of [[beige,'FC_P222'],[charcoal,'FC_P070'],[joint,'EPDM'],[base,'masonry'],[steel,'galvanized'],[dark,'PURAL_dark'],[wood,'timber'],[wool,'mineral_wool'],[wind,'windboard'],[glass,'glass']])m.name=name;
 const panelVariants=Array.from({length:6},(_,i)=>{const m=beige.clone();m.name='FC_P222_'+i;return m;});
 function subtract(r,h){const [x0,y0,x1,y1]=r,[a,b,c,d]=h;if(c<=x0||a>=x1||d<=y0||b>=y1)return[r];const l=Math.max(x0,a),rt=Math.min(x1,c),bt=Math.max(y0,b),tp=Math.min(y1,d);return [[x0,y0,l,y1],[rt,y0,x1,y1],[l,y0,rt,bt],[l,tp,rt,y1]].filter(q=>q[2]-q[0]>.006&&q[3]-q[1]>.006);}
 function panels(p,width,height,holes,stripes=[],code='SE',layout=layoutFor(code,initialVisualLayouts[code])){
  if(layout.cutPolicy==='notched-study'){
   const visible=code==='SE'&&facadeCut?visualPanelLayout({...layout,openings:[...layout.openings,{id:'INSPECTION-VIRTUAL',x:Math.round((origin.x-1.75+width/2)*1000),y:Math.round((origin.y-1.425)*1000),width:3500,height:2850}]}):layout;
   const batches=new Map(),fasteners=planPanelFasteners(layout);
   for(const part of visible.parts){
    const record={...part,facade:code,module:layout.module,scope:layout.scope};panelRecords.push(record);
    const material=part.colour==='P070'?charcoal:panelVariants[part.cell%6],key=material.name+'/'+part.grain;
    if(!batches.has(key))batches.set(key,{material,geometries:[],records:[]});
    const drilling=panelDrilling(part,fasteners.points.filter(h=>h.panelId===part.id));
    const batch=batches.get(key);batch.geometries.push(panelContourGeometry(THREE,part,layout.width,{drills:drilling.points,localCentre:layout.localCentre??0}));batch.records.push({...record,drilling});
   }
   for(const {material,geometries,records} of batches.values()){
    const merged=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    if(!merged)throw Error('Wholeplate contour geometry merge failed');
    const mesh=new THREE.Mesh(merged,material);mesh.userData={panelFacade:code,panelRecords:records,grain:records[0].grain,preservePhysicalProfile:true,notchedStudy:true,approved:false,readyToCut:false,quantityEligible:false};
    mesh.castShadow=false;mesh.receiveShadow=true;p.add(mesh);
   }
   addPanelFastenerMarkers(THREE,p,fasteners);
   return;
  }
  const batches=new Map();let index=0;
  for(const part of layout.parts){
   const record={...part,facade:code,module:layout.module,scope:layout.scope};panelRecords.push(record);
   const original=[part.x/1000-width/2,part.y/1000,(part.x+part.width)/1000-width/2,(part.y+part.height)/1000];
   const pieces=code==='SE'&&facadeCut?subtract(original,[origin.x-1.75,origin.y-1.425,origin.x+1.75,origin.y+1.425]):[original];
   for(const r of pieces){const m=part.colour==='P070'?charcoal:panelVariants[part.cell%6],list=batches.get(m)||[];list.push({r,record});batches.set(m,list);}
  }
  for(const [m,list] of batches){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),m,list.length);const dummy=new THREE.Object3D();list.forEach(({r},i)=>{dummy.position.set((r[0]+r[2])/2,(r[1]+r[3])/2,.025);dummy.scale.set(r[2]-r[0],r[3]-r[1],.008);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.userData.panelRecords=list.map(a=>a.record);mesh.userData.panelFacade=code;mesh.castShadow=false;mesh.receiveShadow=true;p.add(mesh);}
 }
 // Recessed interior slab edges remain hidden behind the cut panel faces.
 const {plinthCut,plinthGroups,plinthOffsets,plinthCover,plinthPlan}=createPlinthAssembly(THREE,building,garden,{materials:{masonry:base,timber:wood,galvanized:steel,FC_P070:charcoal}});
 for(let f=0;f<4;f++){
  const slab=box(39.45,.14,10.35,0,floorLevels[f]/1000+(f===3?-.070:.015),0,base);
  if(f===0){
   const access=planGroundFloorAccess(entranceSpec,entranceCentres,{centreY:slab.position.y,facadeZ:5.62});
   slab.geometry.dispose();slab.geometry=createGroundFloorAccessGeometry(THREE,access);
   slab.userData={assembly:'entrance-floor-access',illustrative:true,approved:false,physical:false,quantityEligible:false,quantity:0,accessPlan:access};
  }
 }
 const front=face(1),back=face(-1);facadeGroups.SE=front;facadeGroups.NW=back;const entrances=entranceCentres;
 const cols=[-18.395,-8.1267,-5.1468,5.0564,8.0346,18.6363],heights=[2.1067,4.9483,7.7865];
 const fh=[],bh=[];
 for(const o of southeastOpenings)fh.push([o.x-o.width/2-.04,o.y-o.height/2-.04,o.x+o.width/2+.04,o.y+o.height/2+.04]);
 for(const x of entrances)fh.push([x-entranceSpec.doorWidth/2-entranceSpec.openingFit,entranceSpec.threshold-entranceSpec.thresholdProfile,x+entranceSpec.doorWidth/2+entranceSpec.openingFit,entranceSpec.threshold+entranceSpec.doorHeight]);
 fh.push([origin.x-1.75,origin.y-1.425,origin.x+1.75,origin.y+1.425]);
 panels(front,40.4,facades.SE.height/1000,fh,entrances.map(x=>[x-1.36,x+1.36]),'SE');
 let normalPatchWindow;for(const o of southeastOpenings){const w=win(front,o.x,o.y,o.width,o.height,o);if(Math.abs(o.x-origin.x)<.001&&Math.abs(o.y-origin.y)<.01)normalPatchWindow=w;}
 for(const x of entrances)createEntrance(THREE,front,{x,z:0,withContext:true});
 const balcon=[315.09,490.65,563.37,738.21,810.93,987.99].map(x=>(x-269.82)*40.4/763.44-20.2);
 const bw=[...new Set(northwestOpenings.map(o=>o.x))];
 for(const o of northwestOpenings)bh.push([o.x-o.width/2-.04,o.y-o.height/2-.04,o.x+o.width/2+.04,o.y+o.height/2+.04]);
 for(const b of balconyOpenings)for(const o of [b.door,b.window])bh.push([o.x-o.width/2,o.y-o.height/2,o.x+o.width/2,o.y+o.height/2]);
 panels(back,40.4,facades.NW.height/1000,bh,[],'NW');
 createRetainedBalconyReturns(THREE,building,{materials:{core:base,wool,wood,P222:beige,EPDM:joint}});
 for(const o of northwestOpenings)win(back,o.x,o.y,o.width,o.height,o);
 for(const b of balconyOpenings){
  // Ark25 is drawn from outside: A03 door right, A04 door left. This
  // names the position in the assembly, not the unknown hinge handedness.
  const type=b.doorRight?'A-03':'A-04',assembly=new THREE.Group();
  assembly.name=b.id;assembly.userData={sourceAssemblyId:b.id,sourceWindowType:type,windowAssembly:true,
   sourceFacts:{width:2.530,height:2.200,windowWidth:1.810,windowHeight:1.475,doorWidth:.720,doorHeight:2.200,doorPositionOutside:b.doorRight?'right':'left',adjacentWindow:'fixed'},
   source:'Ark25/PDF73; facade Ark05/PDF53',surveyVerified:false,approved:false};back.add(assembly);
  win(assembly,b.door.x,b.door.y,b.door.width,b.door.height,{id:b.id+'-DOOR',type,assemblyId:b.id,componentRole:'door'});
  win(assembly,b.window.x,b.window.y,b.window.width,b.window.height,{id:b.id+'-WINDOW',type,assemblyId:b.id,componentRole:'window'});
 }
 // Balcony floors use the same source floor levels as the facade. The old
 // independent .645 m offset made the third glazing row intersect the main roof.
 const balconySteelMaterial=createBalconySteelMaterial(THREE);
 const balconyFloorMaterials=createBalconyFloorMaterials(THREE);
 for(const [bayIndex,bay] of balconyBays().entries()){
  const {x,f,bottom,top,width,depth,guardTop}=bay,hw=width/2;
  const balconyId=`BAL-${String(bayIndex+1).padStart(2,'0')}`;
  const g=new THREE.Group();back.add(g);g.userData.balconyId=balconyId;g.userData.component={kind:'balcony',title:`Балкон · поверх${f+1}`,source:'Арк.16–17 / PDF64–65',note:'RHS S355JR/C3; фактичний ухил каркаса й підлоги1:80, плита24мм, стрічка1.5×50мм, PURAL0.6мм. Порядок шарів, компенсація0.6мм, покриття1мм, відмітка підлоги й складки — кандидати. Підйом покриття100мм перерваний біля дверей; поріг, задній металевий підйом, ущільнення, основа та виробничі стики не завершені.'};
  const openings=balconyOpenings.filter(o=>Math.abs(o.x-(bay.sourceX??x))<.0001).sort((a,b)=>a.door.y-b.door.y),sourceDoor=openings[f];
  const floorPlan=planBalconyFloor({bay,balconyId,door:sourceDoor?{...sourceDoor.door,id:sourceDoor.id+'-DOOR'}:null});
  const {plan:steelPlan}=createBalconySteel(THREE,g,{bay,balconyId,material:balconySteelMaterial,floorPlan});
  if(f===0)createBalconyFoundation(THREE,g,{bay,balconyId,concrete:material('#b9bcb5'),steel});
  createBalconyFloor(THREE,g,{plan:floorPlan,materials:balconyFloorMaterials});
  const skinDepth=steelPlan.skin.front-steelPlan.skin.back,skinZ=(steelPlan.skin.front+steelPlan.skin.back)/2;
  for(const edge of [-hw+.05,hw-.05]){
   if(Math.sign(edge)!==balconyFullSide(x)){
    const pane=box(.006,top-guardTop-.09,skinDepth,x+edge,(guardTop+top)/2,skinZ,balconyGlass,g);
    pane.userData={balconyGlazing:true,partId:`BAL-${String(bayIndex+1).padStart(2,'0')}-SIDE`,glassRole:'clear-sliding',sourceFacts:{glassThickness:.006,tempered:true},approved:false,illustrative:true,
     component:{kind:'balcony-glazing',title:'Прозоре загартоване скло · 6 мм',source:'§5.8.2; арк16/PDF64',note:'Матеріал6мм за проєктом. Розміри, розподіл і механізм розсування — кандидати; виріб постачальника не визначений.'}};
   }
  }
  createBalconyGuard(THREE,g,{plan:planBalconyGuard({bay,balconyId,steelPlan,fullSide:balconyFullSide(x)}),materials:{board:charcoal,steel:balconySteelMaterial,joint}});
  const clearWidth=width-.2,glassH=top-guardTop-.06;
  for(let n=0;n<4;n++){
   const gx=x-clearWidth/2+(n+.5)*clearWidth/4;
   const pane=box(clearWidth/4-.008,glassH,.006,gx,(guardTop+top)/2,depth+.016,balconyGlass,g);
   pane.userData={balconyGlazing:true,partId:`BAL-${String(bayIndex+1).padStart(2,'0')}-FRONT-${n+1}`,glassRole:'clear-sliding',sourceFacts:{glassThickness:.006,tempered:true},approved:false,illustrative:true,
    component:{kind:'balcony-glazing',title:'Прозоре загартоване скло · 6 мм',source:'§5.8.2; арк16/PDF64',note:'Матеріал6мм за проєктом. Поділ на4 поля й шви показові; рухома система, ущільнення та замовлені розміри невідомі.'}};
   if(n<3)box(.007,glassH,.008,gx+clearWidth/8,(guardTop+top)/2,depth+.024,steel,g);
  }
  if(f===2){const canopy=new THREE.Mesh(balconyCanopyGeometry(THREE,{width,depth,top}),balconyCanopyGlass);canopy.position.x=x;g.add(canopy);
   canopy.userData={balconyGlazing:true,partId:`BAL-${String(bayIndex+1).padStart(2,'0')}-CANOPY`,glassRole:'gray-laminated-canopy',sourceFacts:{glassLayers:[.004,.004],tempered:true,laminated:true,tint:'gray'},approved:false,illustrative:true,
    component:{kind:'balcony-canopy',title:'Сірий ламінований навіс · 4+4 мм',source:'§5.8.2; арк16/PDF64',note:'Проєкт задає сіре ламіноване загартоване скло4+4мм. У моделі еквівалентна8мм оболонка; прошарок ламінату, точний відтінок, габарити й кріплення не визначені.'}};
  }
 }
 // Gables: triangular upper walls and one vertical apartment-window stack.
 for(const s of [-1,1]){const g=new THREE.Group();g.userData.component={kind:'facade',title:s===1?'Торцевий фасад ПдЗх':'Торцевий фасад ПнСх',source:'Арк. 06 / PDF 54',note:'Повний торець11885мм; єдина площина і сітка плит до покрівлі. Прив’язки та пакет колон до обміру.'};g.position.x=s*20.2;g.rotation.y=s*Math.PI/2;building.add(g);const code=s===1?'SW':'NE';facadeGroups[code]=g;panels(g,11.24,8.525,[],[],code);for(const o of endWindows[code])win(g,o.x,o.y,o.width,o.height,o);
  if(code==='SW')createAddressLabel(THREE,g);
  if(!layoutFor(code,initialVisualLayouts[code]).fullEndWall)gablePanels(g,code,initialVisualLayouts[code].module,initialVisualLayouts[code].offset,initialVisualLayouts[code].panelHeight);
  if(s===1)win(g,-.029,10.12,.5,.8,{id:'SW-A08-01',type:'A-08'});else{const vent=new THREE.Group();vent.name='NE-attic-louvre';vent.userData.component={kind:'ventilation-grille',title:'Горищна решітка · графічний кандидат800×400',source:'PDF54/арк06, seq5528',note:'Співвідношення сторін близько2:1 за рисунком; фактичний виріб, габарит і координату обміряти. Рама20мм та6похилих ламелей — декор вузла.'};g.add(vent);const recess=new THREE.Mesh(new THREE.PlaneGeometry(.82,.42),dark);recess.position.set(0,9.92,.012);recess.userData={representationOnly:true,physical:false,quantityEligible:false,quantity:0,appearanceAuthority:'Dark attic recess behind ventilation grille, not a surveyed product'};vent.add(recess);for(const sign of [-1,1]){box(.02,.40,.025,sign*.39,9.92,.035,dark,vent);box(.76,.02,.025,0,9.92+sign*.19,.035,dark,vent);}for(let i=0;i<6;i++){const slat=box(.76,.016,.045,0,9.758+i*.064,.035,dark,vent);slat.rotation.x=-.40;}}
 }
 // Source0.6mm folded cover and wood layers share one canonical whole-roof
 // plan with the inspection patch. Graphic ridge/pan datum remains a candidate.
 const frontRoof=roofFrame(1),angle=frontRoof.angle,roof=material('#4a5158',.58,.45),roofLength=roofSpec.length;roof.name='roof_steel';
 const roofTimber=material('#af895e',.86);roofTimber.name='roof_timber';
 const roofAssembly=createRoofAssembly(THREE,building,{materials:{roof_steel:roof,roof_timber:roofTimber}});
 const {roofCovers,roofCut,roofGroups,roofOffsets}=roofAssembly;
 createAtticFloor(THREE,building,{material:wool});
 createAtticFloor(THREE,roofGroups[0],{material:wool,width:4,depth:2.6,x:-12.5,z:frontRoof.position[2],inspection:true});
 for(const s of [-1,1]){
  const shape=roofFrame(s),g=roofAssembly.fullGroups.find(g=>g.name==='roof-'+(s===1?'SE':'NW'));
  // PV arrangement is retained from the graphic candidate; attachment, load
  // transfer and ordered modules are not determined by this scene.
  for(let c=0;c<(s===1?7:5);c++)for(let r=0;r<2;r++){const x=(s===1?-5.8:-4.1)+c*1.73,z=-.55+r*1.93;box(1.66,.04,1.83,x,.13,z,dark,g);const pv=box(1.57,.015,1.75,x,.165,z,material('#25394b',.25,.45),g);pv.userData.component={kind:'roof',title:'PV · графічне розташування',source:'Даховий план · кандидат',note:'Модулі, кріплення і навантаження не підтверджені.'};for(let n=0;n<4;n++)box(.004,.005,1.72,x-.6+n*.4,.18,z,steel,g);}
 }
 createRoofEdgeDetails(THREE,building,{materials:{timber:wood,metal:roof}});
 const {rainwaterGroups,plan:rainwaterPlan}=createRainwaterDetails(THREE,building,{materials:{PURAL_dark:dark}});
 createGroundJunctions(THREE,building,garden,{board:charcoal,joint,grey:steel,concrete:material('#b9bcb5'),rainwaterPlan});
 // Existing masonry chimneys are demolished in §5.4. New roof accessories
 // follow the roof-plan locations approximately, not the old-building silhouette.
 const roofY=roofSurfaceY;
 const walkwayY=roofY(.71)+.10;box(40.6,.055,.34,0,walkwayY,.88,dark);
 for(let x=-20;x<20.2;x+=1.5){for(const z of [.73,1.03]){const foot=roofY(z)+.05;box(.045,walkwayY-.0275-foot,.045,x,(walkwayY-.0275+foot)/2,z,dark);}}
 for(let x=-20;x<20.2;x+=1.5)box(.022,.03,.34,x,walkwayY+.045,.88,dark);
 for(let x=-17;x<18;x+=6){beam([x,roofY(5.48)+.18,5.48],[x+4.8,roofY(5.48)+.18,5.48],.033,dark);beam([x,roofY(5.48)+.30,5.48],[x+4.8,roofY(5.48)+.30,5.48],.033,dark);}
 for(let x=-17;x<18;x+=1.2){const y=roofY(5.48);box(.045,.28,.045,x,y+.17,5.48,dark);const foot=box(.10,.012,.16,x,y+.04,5.48,dark);foot.rotation.x=angle;}
 for(const x of [-15,-8.5,-2.8,5,10.5,17]){const v=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.38,16,1,true),dark);v.position.set(x,roofY(5.4)+.10,5.4);v.userData.component={kind:'roof',title:'Проходка · кандидат Ø120мм',source:'Даховий план; діаметр поточної геометрії не специфікація',note:'Реальний кандидатний прямокутний отвір140мм вирізано в шарах; ущільнення і фартух потребують робочого вузла.'};building.add(v);}
 const exhaust=new THREE.Mesh(new THREE.CylinderGeometry(.20,.20,.72,16,1,true),dark);exhaust.position.set(18.6,roofY(-3.3)+.28,-3.30);building.add(exhaust);box(.55,.09,.55,18.6,roofY(-3.3)+.75,-3.30,dark);
 const hatchGroup=new THREE.Group();hatchGroup.position.set(-9,roofY(3.3),3.3);hatchGroup.rotation.x=angle;building.add(hatchGroup);
 hatchGroup.userData.component={kind:'roof',title:'KLK01 · люк800×600',source:'Специфікація KLK01; позиція графічний кандидат',note:'Проріз вирізано в усіх шарах. Борт60мм, петлі, ущільнення та кріплення — непідтверджений кандидат.'};
 for(const side of [-1,1]){box(.0006,.060,.600,side*(.400-.0003),.030,0,roof,hatchGroup);box(.800-.0012,.060,.0006,0,.030,side*(.300-.0003),roof,hatchGroup);}
 box(.800,.0006,.600,0,.0603,0,roof,hatchGroup);
 for(const x of [-9.3,-8.7])beam([x,roofY(3.3)+.10,3.3],[x,roofY(.7)+.10,.7],.035,dark);
 for(let i=0;i<9;i++){const z=3.3-i*.325;beam([-9.3,roofY(z)+.1,z],[-8.7,roofY(z)+.1,z],.025,dark);}

 // Presentation ground and contact shadow; landscape is deliberately illustrative.
 const gr=new THREE.Mesh(new THREE.PlaneGeometry(500,500),material('#e8e5df'));gr.name='Presentation ground';gr.userData={presentationGround:true,physical:false,quantityEligible:false,quantity:0};gr.rotation.x=-Math.PI/2;gr.position.y=plinthPlan.spec.groundCandidate;gr.receiveShadow=true;scene.add(gr);
 // A source-linked window junction; support timber replaces wool, and the
 // fixed PVC frame stays at the building while the construction layers move.
 patch.position.set(origin.x,origin.y,origin.z);
 const detailLayout=layoutFor('SE',initialVisualLayouts.SE);
 const detailOptions={surroundingLayout:{layout:detailLayout,centre:{x:origin.x*1000+detailLayout.width/2,y:origin.y*1000}},claddingMaterials:{P222:panelVariants,P070:charcoal}};
 const windowDetail=createWindowDetail(THREE,patch,detailOptions);
 const layerGroups=windowDetail.groups,patchWindow=windowDetail.window;
 // Artur's field description is a separate candidate from the public metal
 // reveal detail. Both retain editable native geometry and independent IDs.
 const fieldPatch=new THREE.Group();fieldPatch.position.copy(patch.position);scene.add(fieldPatch);
 fieldPatch.userData.component={kind:'wall',title:'Відкоси Cembrit · польовий варіант',source:'Опис Артура · 08.10.2026',note:'Глибина 150 мм — орієнтир; чинний вузол і фактичний проріз ще звіряємо.'};
 const fieldDetail=createWindowDetail(THREE,fieldPatch,{...detailOptions,revealMode:'field',revealDepth:.150});
 const fieldWindow=fieldDetail.window,fieldLayerGroups=fieldDetail.groups;fieldPatch.visible=false;
 // Roof groups are already source-aligned projections of the full assembly.
 // Merge static meshes per shared material. Moving and pickable layers stay separate.
 function batch(g){g.updateMatrixWorld(true);const batches=new Map();for(const o of [...g.children]){if(o.isGroup){batch(o);continue;}if(!o.isMesh||o.userData.system||o.userData.dynamicCover||o.isInstancedMesh||o.material.transparent||Array.isArray(o.material)||o.userData.component||o.userData.partId||o.userData.preservePhysicalProfile)continue;const list=batches.get(o.material)||[];list.push(o);batches.set(o.material,list);}for(const [m,list] of batches){if(list.length<2)continue;const geos=list.map(o=>{const a=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();a.applyMatrix4(o.matrix);return a;});const geom=mergeGeometries(geos,false);if(geom){const mesh=new THREE.Mesh(geom,m);mesh.castShadow=mesh.receiveShadow=true;g.add(mesh);for(const o of list){g.remove(o);o.geometry.dispose();}}for(const a of geos)a.dispose();}}
 function instanceStaticBoxes(g){
  g.updateMatrixWorld(true);const inverse=g.matrixWorld.clone().invert(),batches=new Map();
  g.traverse(o=>{
   if(!o.isMesh||o.isInstancedMesh||o.geometry.type!=='BoxGeometry'||o.userData.system||o.userData.dynamicCover||o.material.transparent||Array.isArray(o.material))return;
   let owner=o;while(owner&&!owner.userData.component)owner=owner.parent;
   const component=owner?.userData.component||null,list=batches.get(o.material)||[];
   const params=o.geometry.parameters,matrix=inverse.clone().multiply(o.matrixWorld).multiply(new THREE.Matrix4().makeScale(params.width,params.height,params.depth));
   list.push({o,matrix,component});batches.set(o.material,list);
  });
  for(const [material,list] of batches){if(list.length<2)continue;const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,list.length);
   list.forEach((item,i)=>mesh.setMatrixAt(i,item.matrix));mesh.userData.components=list.map(item=>item.component);mesh.castShadow=!(material.transmission>0);mesh.receiveShadow=true;g.add(mesh);
   for(const item of list){item.o.parent.remove(item.o);item.o.geometry.dispose();}
  }
 }
 normalPatchWindow.traverse(o=>{if(o.isMesh)o.userData.dynamicCover=true;});roofCovers.traverse(o=>{if(o.isMesh)o.userData.dynamicCover=true;});
 if(!authoring){instanceStaticBoxes(building);batch(building);batch(garden);}
 for(const g of layerGroups){if(!authoring)batch(g);g.traverse(o=>{if(o.isMesh)o.userData.layer=layerGroups.indexOf(g);});}
 function updateFacade(layout){
  const code=layout.facade||'SE',target=facadeGroups[code];activeLayouts[code]=layoutOptions(layout);if(!target)throw Error('Unknown facade');
  for(const mesh of [...target.children])if(mesh.userData.panelFacade===code){target.remove(mesh);mesh.geometry.dispose();mesh.dispose();}
  for(let i=panelRecords.length-1;i>=0;i--)if(panelRecords[i].facade===code)panelRecords.splice(i,1);
  panels(target,layout.width/1000,layout.height/1000,[],[],code,layout);
  if((code==='SW'||code==='NE')&&!layout.fullEndWall)gablePanels(target,code,layout.module,layout.offset,layout.panelHeight);
  if(typeof facadeSystems!=='undefined'&&facadeSystems[code]){facadeSystems[code].dispose();facadeSystems[code]=createFacadeSystem(THREE,target,code,{...activeLayouts[code],supportAlignment:'user-nine-hole'});for(const g of facadeSystems[code].groups)if(g)g.position.x=activeLayouts[code].localCentre??0;}
  return panelRecords.filter(p=>p.facade===code).map(p=>p.id);
 }
 function gablePanels(target,code,module,offset,panelHeight=0){
  for(const mesh of [...target.children])if(mesh.userData.gableFacade===code){target.remove(mesh);mesh.geometry.dispose();}
  const upper=gableLayout(code,module,offset,{panelHeight});
  const backing=createJointBackings(THREE,target,planJointBackings(upper.parts,{openings:upper.openings,bounds:{x:0,y:0,width:upper.width,height:upper.height}}),{originX:5.62,originY:-8.525,z:.021,name:code+'-gable-black-joint-backing'});
  if(backing)backing.userData.gableFacade=code;
  target.userData.gablePartCount=upper.parts.length;target.userData.gableGrid=module+':'+offset;
  for(const p of upper.parts){const sh=new THREE.Shape();p.points.forEach((v,i)=>{const x=v[0]/1000-5.62,y=v[1]/1000+8.525;if(i===0)sh.moveTo(x,y);else sh.lineTo(x,y);});sh.closePath();for(const ring of p.holes??[]){const h=new THREE.Path();ring.forEach((v,i)=>i?h.lineTo(v[0]/1000-5.62,v[1]/1000+8.525):h.moveTo(v[0]/1000-5.62,v[1]/1000+8.525));h.closePath();sh.holes.push(h);}
   const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.008,bevelEnabled:false}).translate(0,0,.021),panelVariants[p.cell%6]);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.gableFacade=code;mesh.userData.component={kind:'gable-panel',title:p.id+' · профільована деталь',source:'Арк.06 / номінальна розкладка',note:'Заготовка'+p.width+'×'+p.height+'мм; сітка'+module+', зсув'+offset+'мм узгоджені з торцем. Скіс, крайові відстані та опори потребують робочого вузла.'};target.add(mesh);
  }
 }
 const facadeSystems=Object.fromEntries(Object.entries(facadeGroups).map(([code,g])=>{const system=createFacadeSystem(THREE,g,code,{...activeLayouts[code],supportAlignment:'user-nine-hole'});for(const layer of system.groups)if(layer)layer.position.x=activeLayouts[code].localCentre??0;return[code,system];}));
 createFacadeCorners(THREE,building,{material:steel});
 const clampBackings=new Map(Object.values(facadeSystems).flatMap(sys=>sys.backings.parts).map(p=>[p.clampId,p]));
 for(const {g} of rainwaterGroups){
  const paired=[];
  g.traverse(m=>{const req=m.userData.backingRequirement;if(!req)return;const clampId=m.userData.rainwaterRole==='wall-clamp'?m.userData.partId:m.userData.partId?.replace(/-PLATE$/,'');const part=clampBackings.get(clampId);if(!part)return;
   Object.assign(req,{realizedInFacade:true,partId:part.partId,candidateLengthMM:part.candidateLengthMM,bearingTimberIds:part.bearingTimberIds});if(!paired.includes(part.partId))paired.push(part.partId);
  });
  g.userData.backingPartIds=paired;
  g.userData.component.note=g.userData.retainedWallReturnId
   ?'Положення задньої труби звірено з кресленням фасаду. Труба показана біля збереженого виступу; його глибину, підкладний брус50×200, коліна, хомути та анкери ще треба уточнити.'
   :'Два коліна повертають трубу до стіни. Під кріпленнями показаний брус50×200 у горизонтальному шарі. Довжини й місця — геометричні кандидати; хомути, анкери й несучу здатність ще звіряємо.';
 }
 function setInspection(mode){
 const next=mode==='detail';if(next!==facadeCut){facadeCut=next;updateFacade(layoutFor('SE',activeLayouts.SE));}
 for(const {g,x,s} of rainwaterGroups)g.visible=!(next&&s===1&&Math.abs(x-origin.x)<1.9);
 patch.visible=next;fieldPatch.visible=false;normalPatchWindow.visible=!next;roofCut.visible=mode==='roof';roofCovers.visible=mode!=='roof';plinthCut.visible=mode==='plinth';plinthCover.visible=mode!=='plinth';
 }
 function setFacadeLayers(mode,amount,visible){
  const full=mode==='layers';
  for(const [code,sys] of Object.entries(facadeSystems)){
   sys.setState({enabled:mode!=='detail',explode:full?amount/100:0,visible:full?visible.slice(0,8):Array.from({length:8},(_,i)=>i===0||i===7)});
   for(const mesh of facadeGroups[code].children)if(mesh.userData.panelFacade||mesh.userData.gableFacade){mesh.visible=full?visible[8]:true;mesh.position.z=full?8*.24*amount/100:0;}
  }
 }
 return {setFacadeLayers,setInspection,building,garden,patch,patchWindow,layerGroups,fieldPatch,fieldWindow,fieldLayerGroups,panelRecords,roofCut,roofGroups,roofOffsets,plinthCut,plinthGroups,plinthOffsets,plinthPlan,updateFacade,facadeGroups,facadeSystems,normalPatchWindow,roofCovers,plinthCover,rainwaterGroups};
}
