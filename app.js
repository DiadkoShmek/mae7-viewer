import {setFacadeModelSnapshot} from './facade-model-report.js';
import * as THREE from 'three';
import { OrbitControls } from './assets/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from './assets/CSS2DRenderer.js';
import {setupLookdev,configureRenderer,configureRendererBase,preloadDaylight} from './lookdev.js';
import {bindContextRecovery} from './context-recovery.js';
import {setupLandscape} from './landscape.js';
import {renderPixelRatio,resizeRenderer,createRenderQuality} from './render-quality.js';
import {createPresentationRenderer} from './presentation-renderer.js';
import {mergeBalconyDisplay,mergeFixedBuildingDisplay,mergeStaticShellDisplay,mergeBalconyFloorDisplay} from './static-display.js';
import {layers as facadeLayers,roofLayers,plinthLayers,layerZ,origin,geometry} from './model.js';
import {loadNativeModel,nativePanelRecord,nativeLayerRecord,nativePanelBounds,nativeEntranceRecord,nativeBalconyRecord,nativeBalconyGuardRecord,nativeGlazingPartRecord,nativePlinthRecord,nativeRetainedReturnRecord,nativeRoofEdgeRecord,nativeRoofLathRecord,nativeOpeningRecord,nativeBalconyOpeningRecords} from './native-model.js';
import {selectedRoofEdgeDrawing} from './roof-edge-drawing.js';
import {selectedRoofLathReview} from './roof-lath-review.js';
import {facades} from './facade-layouts.js';
import {roofSpec} from './roof-geometry.js';
import {createScalarMotion} from './motion.js';
import {createCameraFlight} from './camera-flight.js';
import {createCameraPath} from './camera-path.js';
import {depthBufferOptions,safePerspectiveNear} from './depth-precision.js';
import {visiblePickTargets} from './visible-picking.js';
import {createTapGesture} from './tap-gesture.js';
import {initialVisualLayouts} from './facade-layouts.js';
import {layoutOptions} from './layout-options.js';
import {houseVolumes,constrainCamera,inspectionVolume,inVolume,boundsVolume} from './camera-clearance.js';
import {balconyDoorNote} from './balcony-door-review.js';
import {keyboardTranslation,acceptsCameraKeys} from './camera-keyboard.js';
import {endWallFrame,endWallSpec} from './end-wall-plan.js';
import {dimensionSchedule} from './dimension-schedule.js';
import {takeViewerContext,showStartupFailure} from './viewer-startup.js';
import {placeDimensionLabels,dimensionAnchorVisible,clippedDimensionSegment} from './dimension-label-layout.js';

const $ = id => document.getElementById(id);
const app = $('app'), viewer = $('viewer');
app.dataset.moduleReadyMs=performance.now().toFixed(0);
preloadDaylight().catch(()=>{});
function loadingStage({stage,loaded=0,total=0}){
 app.dataset.loadingStage=stage;
 const progress=$('loading-progress');if(stage==='geometry'&&total>0)progress.value=100*loaded/total;else progress.removeAttribute('value');
 $('loading-text').textContent=stage==='geometry'?`Завантажуємо геометрію · ${Math.round(100*loaded/total)}%`:stage==='assembly'?'Збираємо будинок…':stage==='frame'?'Готуємо перший кадр…':'Завантажуємо модель…';
}
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let mode='building', selected=-1, amount=0, dimensionVisible=false, renderer, controls, labelRenderer, rendererPrimed=false;
let shadowsDirty=true,shadowPasses=0;
function invalidateShadows(){shadowsDirty=true;}
const visibility={facade:facadeLayers.map((_,i)=>![5,7,8].includes(i)),detail:facadeLayers.map(()=>true),roof:roofLayers.map(()=>true),plinth:plinthLayers.map(()=>true)},pins=[];
let layers=facadeLayers,visible=visibility.facade;
app.dataset.mode=mode;
const eye='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
function paintLayerList(){
 $('layer-list').innerHTML=layers.map((l,i)=>`<div class="layer-row" data-row="${i}"><button class="layer-select" data-layer="${i}" aria-pressed="false"><span class="layer-index">0${i+1}</span><span class="swatch" style="background:${l.color}"></span><span class="layer-title">${l.title}</span></button><button class="visibility" data-visible="${i}" aria-label="Показати або приховати: ${l.title}" aria-pressed="true">${eye}</button></div>`).join('');
 for(const b of document.querySelectorAll('[data-layer]'))b.addEventListener('click',()=>{if(mode==='building')setMode('layers');selectLayer(Number(b.dataset.layer));});
 for(const b of document.querySelectorAll('[data-visible]'))b.addEventListener('click',()=>{if(mode==='building')setMode('layers');const i=Number(b.dataset.visible);visible[i]=!visible[i];updateLayers();});
}
paintLayerList();

const scene=new THREE.Scene();
const selectionCard=$('selection-card');
let selectedPanel=null,selectedReturn=null,selectedRoofEdge=null,selectedRoofLath=null,selectedGuard=null,selectedOpening=null,selectedBalconyOpenings=null;
function syncSelectionCard(){
 selectionCard.replaceChildren();const info=$('selected-layer'),title=info.querySelector('h3');
 selectionCard.hidden=!app.dataset.component||!title;
 if(!selectionCard.hidden){selectionCard.append(title.cloneNode(true));const text=info.querySelector('p');if(text)selectionCard.append(text.cloneNode(true));
  const actions=document.createElement('div');actions.className='selection-actions';
  for(const id of ['focus-component','open-selection-drawing','measure-balcony-door','measure-balcony-window']){const original=$(id);if(original.hidden)continue;const button=original.cloneNode(true);button.removeAttribute('id');button.addEventListener('click',()=>original.click());actions.append(button);}
  selectionCard.append(actions);
 }
}
new MutationObserver(syncSelectionCard).observe($('selected-layer'),{childList:true,subtree:true,characterData:true});
new MutationObserver(()=>{if(app.dataset.component!=='panel')selectedPanel=null;if(app.dataset.component!=='retained-wall-return')selectedReturn=null;if(app.dataset.component!=='roof-edge')selectedRoofEdge=null;if(app.dataset.component!=='roof-lath')selectedRoofLath=null;if(app.dataset.component!=='balcony-guard-panel')selectedGuard=null;if(app.dataset.component!=='window')selectedOpening=null;if(app.dataset.component!=='balcony')selectedBalconyOpenings=null;for(const role of ['door','window'])$('measure-balcony-'+role).hidden=!selectedBalconyOpenings?.[role];const button=$('open-selection-drawing');button.hidden=!(selectedPanel||selectedReturn||selectedRoofEdge||selectedRoofLath||selectedGuard||selectedOpening);button.textContent=selectedGuard?'Креслення й розкрій плити ↗':selectedOpening?'Розміри прорізу':selectedRoofLath?'Крок і розміри лат ↗':selectedRoofEdge?'Креслення профілю ↗':selectedReturn?'Креслення виступу ↗':'Креслення цієї плити ↗';syncSelectionCard();}).observe(app,{attributes:true,attributeFilter:['data-component']});
for(const role of ['door','window'])$('measure-balcony-'+role).addEventListener('click',()=>{const record=selectedBalconyOpenings?.[role];if(!record||mode!=='building')return;showOpeningSelection(record);$('open-selection-drawing').click();});
$('open-selection-drawing').addEventListener('click',()=>{
 if(selectedGuard&&app.dataset.component==='balcony-guard-panel'){document.dispatchEvent(new CustomEvent('mae-open-drawing',{detail:{balconyGuard:structuredClone(selectedGuard)}}));return;}
 if(selectedOpening&&app.dataset.component==='window'&&mode==='building'){dimensionSelection=structuredClone(selectedOpening);if(!dimensionVisible)toggleDimensions();else showElevation(selectedOpening.code);frameOpeningDimensions();return;}
 if(selectedRoofLath&&app.dataset.component==='roof-lath'){document.dispatchEvent(new CustomEvent('mae-open-drawing',{detail:{roofLath:structuredClone(selectedRoofLath)}}));return;}
 if(selectedRoofEdge&&app.dataset.component==='roof-edge'){document.dispatchEvent(new CustomEvent('mae-open-drawing',{detail:{roofEdge:structuredClone(selectedRoofEdge)}}));return;}
 if(selectedReturn&&app.dataset.component==='retained-wall-return'){document.dispatchEvent(new CustomEvent('mae-open-drawing',{detail:{retainedReturn:structuredClone(selectedReturn)}}));return;}
 if(!selectedPanel||app.dataset.component!=='panel')return;
 document.dispatchEvent(new CustomEvent('mae-open-drawing',{detail:{panel:structuredClone(selectedPanel)}}));
});
const perspectiveCamera=new THREE.PerspectiveCamera(36,1,.1,450);const orthoCamera=new THREE.OrthographicCamera(-25,25,15,-15,.1,450);let camera=perspectiveCamera;let orthographic=false;
perspectiveCamera.position.set(35,22,55);
let nativeModel;
let rendererStart;
try{nativeModel=await loadNativeModel(scene,{assetVersion:document.documentElement.dataset.assetVersion,onProgress:loadingStage});}catch(error){showStartupFailure(document,error,'asset');console.error('Native model loading failed',error);throw error;}
app.dataset.modelReadyMs=performance.now().toFixed(0);
const {building,garden,patch,fieldPatch,panelRecords,updateFacade,setInspection,setFacadeLayers}=nativeModel;
const staticDisplay=mergeBalconyDisplay(nativeModel.balconies),floorDisplay=mergeBalconyFloorDisplay(nativeModel.balconies),fixedDisplay=mergeFixedBuildingDisplay(building),shellDisplay=mergeStaticShellDisplay(nativeModel);app.dataset.staticDrawsSaved=String(staticDisplay.drawsSaved+floorDisplay.drawsSaved+fixedDisplay.drawsSaved+shellDisplay.drawsSaved);
setFacadeModelSnapshot(nativeModel.getFacadeModelSnapshot());
app.dataset.snapshotReadyMs=performance.now().toFixed(0);
let revealMode='field',glazingInspect=false,glazingSpread=0;
let {window:patchWindow,groups:layerGroups}=nativeModel.setRevealMode(revealMode);
app.dataset.revealMode=revealMode;
function windowPanelCaption(){const view=nativeModel.getWindowPanelInspection();app.dataset.windowPanelCount=String(view.focusedPartIds.length);return `${view.focusedPartIds.length} деталі фасаду · проріз 1780 × 1475 мм.`;}
windowPanelCaption();
app.dataset.modelSource='Blender glTF';app.dataset.nativeNodes=String(nativeModel.nativeAsset.nodeCount);
const selectedLayouts=structuredClone(initialVisualLayouts);
app.dataset.cutPolicy='notched-study';
function panelCaption(code){const modules=code?[selectedLayouts[code].module]:[...new Set(Object.values(selectedLayouts).map(l=>l.module))];return modules.length===1?(modules[0]===1200&&(code?selectedLayouts[code].panelHeight===1250:Object.values(selectedLayouts).every(l=>l.panelHeight===1250))?'1192×1250 → · шви 8 мм':modules[0]===1208?'1200 → · шов 8 мм · залишок справа':`Плита до ${modules[0]-8} мм · шов 8 мм · варіант`):'Різні модулі плит · варіант';}

app.dataset.sePartCount=String(panelRecords.filter(p=>p.facade==='SE').length);
for(const [code,options] of Object.entries(selectedLayouts))if(options.rowLevels)app.dataset[code.toLowerCase()+'RowLevels']=options.rowLevels.join(',');
window.addEventListener('mae-layout-change',event=>{
 // Positive pieces with insufficient fastening margins remain visible for
 // review. Their cutting export stays held; impossible grid widths stay held.
 if(event.detail.validity?.valid===false&&event.detail.validity?.visualizable!==true){event.preventDefault();return;}
 try{const code=event.detail.facade||'SE',ids=updateFacade(event.detail);setFacadeModelSnapshot(nativeModel.getFacadeModelSnapshot());if(selectedPanel?.facade===code){selectedPanel=null;app.dataset.component='';$('open-selection-drawing').hidden=true;}if(dimensionSelection?.panel&&dimensionSelection.code===code){dimensionSelection=null;if(dimensionVisible)setDimensions(dimensionCode);}selectedLayouts[code]=layoutOptions(event.detail);app.dataset[code.toLowerCase()+'PartCount']=String(ids.length);app.dataset[code.toLowerCase()+'RowLevels']=event.detail.levels.join(',');app.dataset.activeLayout=code+':'+event.detail.module+':'+event.detail.offset;if(code==='SE')app.dataset.seLayout=event.detail.module+':'+event.detail.offset;app.dataset.cutPolicy=event.detail.cutPolicy||'split';if(mode==='building')$('model-tag-text').textContent=panelCaption(app.dataset.elevation)+(event.detail.cutPolicy==='notched-study'?' · зарізи: варіант':'');updateLayers();windowPanelCaption();if(mode==='detail')$('panel-description').textContent=windowPanelCaption();}
 catch(error){event.preventDefault();$('engineering-status').textContent='Оновлення 3D не завершено: '+error.message;}
});
const BASEX=origin.x,BASEY=origin.y,BASEZ=origin.z;
// Whole-building view shows the completed exterior. The cut bay is isolated
// only in construction views, so it cannot float over an unrelated window.
patch.visible=false;
app.dataset.landscapeStartMs=performance.now().toFixed(0);
setupLookdev(scene);
const landscape=setupLandscape(garden,{footprint:{...geometry,depth:endWallSpec.widthMM/1000},apronCentreZ:(endWallSpec.frontZ+endWallSpec.rearZ)/2,groundY:-.705,apronWidth:.6,textureLoader:new THREE.TextureLoader(),onTextureLoad:()=>draw()});
landscape.materialReady.catch(error=>console.warn('Landscape surface assets unavailable',error));
app.dataset.landscapeReadyMs=performance.now().toFixed(0);
app.dataset.landscape='source-contours-soft-lawn-relief-tonal-transition';
const dimensionGroup=new THREE.Group();scene.add(dimensionGroup);dimensionGroup.visible=false;
let dimensionSelection=null;
const dimMaterial=new THREE.LineBasicMaterial({color:'#354d5c',transparent:true,opacity:0,depthTest:false});
const svgNS='http://www.w3.org/2000/svg',dimensionOverlay=document.createElementNS(svgNS,'svg');dimensionOverlay.classList.add('dimension-overlay');dimensionOverlay.setAttribute('aria-hidden','true');
dimensionOverlay.innerHTML='<defs><marker id="dimension-arrow" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M10 1L1 5L10 9" fill="none" stroke="#354d5c" stroke-width="1.8" stroke-linejoin="round"/></marker></defs>';
const openingArrow=dimensionOverlay.querySelector('marker').cloneNode(true);openingArrow.id='opening-dimension-arrow';openingArrow.setAttribute('markerWidth','12');openingArrow.setAttribute('markerHeight','12');openingArrow.firstElementChild.setAttribute('stroke-width','2.1');dimensionOverlay.firstElementChild.append(openingArrow);
viewer.append(dimensionOverlay);
let dimensionCode='SE',dimensionScope='general',dimensionRows=[],dimensionContextKey='';
const dimensionReview=document.createElement('section');dimensionReview.id='dimension-review';dimensionReview.className='dimension-review';dimensionReview.hidden=true;dimensionReview.setAttribute('aria-label','Набори розмірів фасаду');
dimensionReview.innerHTML='<div class="dimension-head"><label class="dimension-face-label"><span class="sr-only">Фасад</span><select id="dimension-face" aria-label="Фасад для розмірів"></select></label><button id="dimension-close" type="button" aria-label="Закрити розміри">×</button></div><div class="dimension-scopes" role="group" aria-label="Розміри на моделі"><button type="button" data-dimension-scope="general">Габарити</button><button type="button" data-dimension-scope="levels">Поверхи</button><button type="button" data-dimension-scope="detail">Деталь</button></div><p id="dimension-context"></p><details id="dimension-list"><summary>Повний список розмірів</summary><div id="dimension-values"></div><p class="dimension-source-note">Суцільні — проєктні розміри; пунктир — графічна прив’язка. Плити — поточна розкладка.</p></details><p id="dimension-visible-count" role="status"></p>';
document.querySelector('.mode-tabs').after(dimensionReview);
$('dimension-close').addEventListener('click',()=>toggleDimensions());
for(const [code,face] of Object.entries(facades)){const option=document.createElement('option');option.value=code;option.textContent=face.title;$('dimension-face').append(option);}
$('dimension-face').addEventListener('change',()=>showElevation($('dimension-face').value));
for(const button of dimensionReview.querySelectorAll('[data-dimension-scope]'))button.addEventListener('click',()=>{dimensionScope=button.dataset.dimensionScope;setDimensions(dimensionCode);draw();});
$('dimension-list').addEventListener('toggle',()=>draw());
function paintDimensionReview(selection,schedule){
 dimensionReview.hidden=false;$('dimension-face').value=dimensionCode;
 const detail=selection.opening?.id||selection.panel?.id||'';
 $('dimension-context').textContent=detail?'Деталь: '+detail:'';$('dimension-context').hidden=!detail;
 for(const button of dimensionReview.querySelectorAll('[data-dimension-scope]')){button.setAttribute('aria-pressed',String(button.dataset.dimensionScope===dimensionScope));button.disabled=button.dataset.dimensionScope==='detail'&&!detail;}
 $('dimension-values').replaceChildren();
 for(const d of [...schedule].sort((a,b)=>Number(b.group===dimensionScope)-Number(a.group===dimensionScope))){const row=document.createElement('div');row.className='dimension-value';row.dataset.dimensionId=d.id;row.dataset.dimensionSource=d.source;row.dataset.dimensionAuthority=d.authority;row.dataset.dimensionRole=d.role;
  const name=document.createElement('span');name.textContent=d.name;const value=document.createElement('strong');value.textContent=d.text;const source=document.createElement('small');source.textContent=(d.source.startsWith('PP-1')?'PP-1 · арк. 07 / PDF55':d.source==='facade-owner:width'?'План і фасади · арк. 02, 05–06':d.source==='facade-owner:graphic-height'?'Модель стіни · графіка PP-1':d.source==='selected-panel:source-bounds'?'Поточна розкладка плит':d.source)+' · '+({written:'проєкт',graphic:'графічна прив’язка',model:'модель'}[d.authority]);row.append(name,value,source);$('dimension-values').append(row);
 }
 $('dimension-list').firstElementChild.textContent='Усі розміри фасаду · '+schedule.length;
}
function updateDimensionOverlay(){
 dimensionOverlay.replaceChildren(dimensionOverlay.firstElementChild);dimensionOverlay.style.display=dimensionGroup.visible?'block':'none';if(!dimensionGroup.visible)return;
 const w=viewer.clientWidth,h=viewer.clientHeight;dimensionOverlay.setAttribute('viewBox',`0 0 ${w} ${h}`);const rendered=new Set();
 for(const child of dimensionGroup.children){const endpoints=child.userData.dimensionEndpoints;if(!endpoints)continue;const points=endpoints.map(v=>{const p=new THREE.Vector3(...v).project(camera);return {x:(p.x+1)*w/2,y:(1-p.y)*h/2,z:p.z};});const clipped=clippedDimensionSegment(...points,w,h,{minLength:child.userData.extension?1:12});if(!clipped)continue;
  if(child.userData.dimensionId)rendered.add(child.userData.dimensionId);
  const detail=child.userData.group==='detail',marker=detail?'url(#opening-dimension-arrow)':'url(#dimension-arrow)';
  const line=document.createElementNS(svgNS,'line');for(const [key,value] of Object.entries({x1:clipped.x1,y1:clipped.y1,x2:clipped.x2,y2:clipped.y2,stroke:'#354d5c','stroke-width':child.userData.extension?1.2:detail?3:2.5,'data-dimension-id':child.userData.dimensionId||'',...(child.userData.authority==='graphic'?{'stroke-dasharray':'5 3'}:{}),...(child.userData.extension?{'stroke-dasharray':'4 4',opacity:.65}:{...(clipped.arrowStart?{'marker-start':marker}:{}),...(clipped.arrowEnd?{'marker-end':marker}:{})})}))line.setAttribute(key,value);dimensionOverlay.append(line);
 }
 const labels=[],viewerRect=viewer.getBoundingClientRect(),obstacles=[];
 for(const el of viewer.parentElement.querySelectorAll('.stage-title,.view-tools,.stage-bottom,.model-tag,#selection-card,#dimension-review')){if(el.hidden)continue;const r=el.getBoundingClientRect();if(r.width&&r.height)obstacles.push({left:r.left-viewerRect.left,top:r.top-viewerRect.top,width:r.width,height:r.height});}
 for(const child of dimensionGroup.children){if(!child.element)continue;const el=child.element;el.style.marginLeft=el.style.marginTop='0px';const p=child.getWorldPosition(new THREE.Vector3()).project(camera),px=(p.x+1)*w/2,py=(1-p.y)*h/2,visible=rendered.has(child.userData.dimensionId)&&dimensionAnchorVisible({x:px,y:py,z:p.z},w,h);el.hidden=!visible;if(!visible)continue;const width=el.offsetWidth,height=el.offsetHeight;labels.push({child,x:px-width*child.center.x,y:py-height*child.center.y,width,height,px,py,priority:child.userData.group==='detail'?2:child.userData.role==='facade-width'?1:0});}
 const boxes=placeDimensionLabels(labels,w,h,{margin:8,gap:5,obstacles}),placed=new Set(boxes.map(b=>b.child));
 for(const label of labels)label.child.element.hidden=!placed.has(label.child);
 for(const b of boxes){
  b.child.element.style.marginLeft=(b.left-b.x)+'px';b.child.element.style.marginTop=(b.top-b.y)+'px';
  if(Math.abs(b.left-b.x)+Math.abs(b.top-b.y)>3){const l=document.createElementNS(svgNS,'line');for(const [k,v] of Object.entries({x1:b.px,y1:b.py,x2:Math.max(b.left,Math.min(b.left+b.width,b.px)),y2:Math.max(b.top,Math.min(b.top+b.height,b.py)),stroke:'#354d5c','stroke-width':1.2,opacity:.6}))l.setAttribute(k,v);dimensionOverlay.append(l);}
 }
 $('dimension-visible-count').textContent='На моделі: '+boxes.length+' / '+dimensionRows.length+' · усі значення у списку';
 app.dataset.dimensionLabels=String(boxes.length);app.dataset.dimensionSchedule=String(dimensionRows.length);app.dataset.dimensionScope=dimensionScope;
}
function dimension(a,b,text,{labelAt,align=.5,authority='',role='',openingId='',id='',group='general'}={}){
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]),dimMaterial);line.userData={dimensionEndpoints:[a,b],authority,role,dimensionId:id,group};dimensionGroup.add(line);
 const el=document.createElement('span');el.className='dimension-label';el.textContent=text;el.dataset.dimensionAuthority=authority;el.dataset.dimensionRole=role;el.dataset.openingId=openingId;el.dataset.dimensionId=id;if(authority==='graphic'){el.style.borderStyle='dashed';el.title='Графічна прив’язка — потребує обміру';}
 const label=new CSS2DObject(el);label.center.set(align,.5);label.position.fromArray(labelAt||a.map((v,i)=>(v+b[i])/2));label.userData={dimensionId:id,role,group};dimensionGroup.add(label);
}
function setDimensions(code){
 app.dataset.dimensions=String(dimensionVisible&&mode==='building');
 landscape.setDimensionMode(dimensionVisible&&mode==='building');
 for(const child of [...dimensionGroup.children]){child.element?.remove();child.geometry?.dispose();dimensionGroup.remove(child);}
 if(!dimensionVisible||mode!=='building'){dimensionReview.hidden=true;dimensionGroup.visible=false;return;}
 const end=code==='SW'||code==='NE';
 const point=(x,y)=>end?[code==='SW'?21.6:-21.6,y,code==='SW'?-(x+endWallFrame(code).centre):x+endWallFrame(code).centre]:[code==='NW'?-x:x,y,code==='NW'?-8.05:8.75];
 const selection=dimensionSelection?.code===code?dimensionSelection:{};
 const schedule=dimensionSchedule(code,selection);dimensionCode=code;const key=selection.opening?.id||selection.panel?.id||'';if(key!==dimensionContextKey){dimensionContextKey=key;dimensionScope=key?'detail':'general';}if(dimensionScope==='detail'&&!key)dimensionScope='general';paintDimensionReview(selection,schedule);dimensionRows=schedule.filter(d=>d.group===dimensionScope||(dimensionScope==='levels'&&d.role==='facade-width'));
 const openingMatrix=selection.opening&&selection.apertureMatrix?new THREE.Matrix4().fromArray(selection.apertureMatrix):null;
 const openingPoint=(x,y)=>new THREE.Vector3(x-(selection.opening.x+selection.opening.width/2)/1000+facades[code].width/2000,y-(selection.opening.y+selection.opening.height/2)/1000,0).applyMatrix4(openingMatrix).toArray();
 for(const d of dimensionRows){const locate=openingMatrix&&d.openingId?openingPoint:point;dimension(locate(...d.a),locate(...d.b),d.text,{labelAt:d.labelAt?locate(...d.labelAt):undefined,align:d.align??.5,authority:d.authority,role:d.role,openingId:d.openingId,id:d.id,group:d.group});}
 const half=facades[code].width/2000;
 for(const y of new Set(dimensionRows.filter(d=>d.source.startsWith('PP-1')).flatMap(d=>[d.a[1],d.b[1]]))){const l=new THREE.Line(new THREE.BufferGeometry(),dimMaterial);l.userData={dimensionEndpoints:[point(half,y),point(half+2.3,y)],extension:true};dimensionGroup.add(l);}
 dimensionGroup.visible=true;
}

let pendingMode=null,pendingNavigation=null,applyingFlight=false,navigationPath=null,framingBox=null;
let roofTarget=0,plinthTarget=0;
let dimensionSnapshot=null,cameraManual=false,navigationCompletion=null;
let selectedEntrance=null,entranceFocus=null,entranceAmount=0,entranceTarget=0,entranceManual=false;
let selectedBalcony=null,balconyFocus=null,balconyAmount=0,balconyTarget=0,balconyManual=false;
let balconyLabels=null;
const layerMotion=createScalarMotion({value:0,duration:360,reduced,apply:value=>{updateLayers(value);if(value===0){if(pendingMode){const next=pendingMode;pendingMode=null;setMode(next.mode,next.immediate,next.face,next.requestedLayer);}else if(pendingNavigation){const next=pendingNavigation;pendingNavigation=null;next();}}}});
const cameraFlight=createCameraFlight({duration:420,reduced,apply:(pose,progress)=>{
 applyingFlight=true;
 try{camera.position.fromArray(navigationPath?navigationPath(progress):pose.position);controls.target.fromArray(pose.target);camera.zoom=pose.zoom;camera.updateProjectionMatrix();protectCamera();controls.update();draw();}finally{applyingFlight=false;}
}});
const glazingMotion=createScalarMotion({duration:850,reduced,apply:value=>{
 glazingSpread=value;nativeModel.setGlazingInspection(glazingInspect,{window:patchWindow,spread:value});
 invalidateShadows();
 app.dataset.glazingSpread=String(Math.round(value));
 if(glazingInspect){$('explode').value=Math.round(value);$('explode-value').value=`${Math.round(value)}%`;}
 if(glazingInspect&&controls&&!cameraManual){framingBox=viewBounds();flyTo(fittedPose(framingBox,[1.4,.4,1]),{immediate:true});}
 protectCamera();draw();
}});
const balconyMotion=createScalarMotion({duration:850,reduced,apply:value=>{
 if(!balconyFocus)return;
 balconyAmount=value;nativeModel.setBalconyInspection(balconyFocus,{enabled:true,spread:value});
 invalidateShadows();
 selectionBox.box.copy(nativeModel.getBalconyFloorBounds(balconyFocus)).expandByScalar(.012);
 if(!balconyManual)$('explode').value=Math.round(value);$('explode-value').value=`${Math.round(value)}%`;
 app.dataset.balconySpread=String(Math.round(value));protectCamera();draw();
}});
const entranceMotion=createScalarMotion({duration:850,reduced,apply:value=>{
 if(!entranceFocus)return;
 entranceAmount=value;nativeModel.setEntranceSpread(entranceFocus,value);
 invalidateShadows();
 selectionBox.box.copy(nativeModel.getEntranceBounds(entranceFocus)).expandByScalar(.012);
 if(!entranceManual)$('explode').value=Math.round(value);$('explode-value').value=`${Math.round(value)}%`;
 protectCamera();draw();
}});
function updateLayers(nextAmount=amount){
  invalidateShadows();
  amount=nextAmount;$('explode-value').value=`${Math.round(glazingInspect?glazingSpread:balconyFocus?balconyAmount:entranceFocus?entranceAmount:amount)}%`;
  setFacadeLayers(mode,amount,visibility.facade);
  const fs=mode==='detail'||mode==='layers',rs=mode==='roof',ps=mode==='plinth';
  nativeModel.setFacadeSpread(fs?amount:0,fs?visible.map(v=>v&&!glazingInspect):facadeLayers.map(()=>true));
  nativeModel.setRoofSpread(rs?amount:0,rs?visible:visibility.roof.map(()=>true));
  nativeModel.setPlinthSpread(ps?amount:0,ps?visible:visibility.plinth.map(()=>true));
  pins.forEach((pin,i)=>{pin.visible=(mode==='detail'||mode==='layers')&&amount>35&&visible[i]&&i===selected;pin.element.textContent=facadeLayers[i].title;});
  if(glazingInspect)nativeModel.setGlazingInspection(true,{window:patchWindow,spread:glazingSpread});
  for(const b of document.querySelectorAll('[data-layer]'))b.setAttribute('aria-pressed',String(Number(b.dataset.layer)===selected));
  for(const b of document.querySelectorAll('[data-visible]')){const i=Number(b.dataset.visible);b.setAttribute('aria-pressed',String(visible[i]));b.closest('.layer-row').classList.toggle('is-hidden',!visible[i]);}
  protectCamera();draw();
}
const layerReading={
 base:['Існуюча основа','Основа фасаду, до якої кріпиться підконструкція.'],
 anchors:['150×150×60×2,5 мм','Кронштейни передають навантаження від бруса на стіну.'],
 wool100:['100 мм','Перший суцільний шар. Разом із двома шарами по50 мм —200 мм утеплення.'],
 vertical50:['50×50 мм · вертикально','Вертикальний брус із ватою між елементами; крок600 мм.'],
 horizontal50:['50×50 мм · горизонтально','Перехресний ряд бруса й утеплення. Під кріпленнями водостоку — опорні бруси50×200 мм у цьому самому шарі.'],
 windboard:['9 мм','Захищає утеплення від продування. Стики герметизуються.'],
 battens:['100×25 мм','Вертикальні дошки утворюють вентзазор і тримають плити. Біля шва — дві окремі дошки.'],
 epdm:['100 мм','Захисна стрічка по центру дошки, між деревиною та плитою.'],
 cladding:['8 мм','Фіброцементні плити з відкритими швами8 мм. Контури біля вікон повторюють фасад.'],
 rafters:['450 мм утеплення перекриття','Утеплення лежить горизонтально на горищному перекритті. Крокви під схилами залишаються окремою конструкцією.'],
 underlay:['Під покриттям','Мембрана відводить воду під металевою покрівлею до карниза.'],
 counter:['32×50 мм','Контрлати вздовж схилу створюють вентиляційний канал.'],
 roofbattens:['32×100 мм','Поперечні дошки підтримують покрівельний лист.'],
 metal:['0,6 мм','Фальцева покрівля із захисним покриттям у темно-сірому відтінку.'],
 existing:['Існуюча основа','Цоколь під новим утепленням і облицюванням.'],
 eps100:['100 мм','Перший суцільний шар утеплення цоколя.'],
 eps50:['50 мм','Другий шар між елементами дерев’яної підконструкції.'],
 hat:['25 мм','Горизонтальні металеві профілі підтримують облицювання цоколя.'],
 plinthboard:['8 мм','Темний фіброцемент із вентзазором та відливом у верхньому примиканні.']
};
function selectLayer(i){if(!Number.isInteger(i)||!layers[i])return;if(balconyFocus){resetBalconyFocus();selectionBox.visible=false;$('focus-component').hidden=true;delete app.dataset.component;}if(entranceFocus){resetEntranceFocus();selectionBox.visible=false;$('focus-component').hidden=true;delete app.dataset.component;}selected=i;const l=layers[i],reading=layerReading[l.id]||[l.spec,l.note];$('selected-layer').innerHTML=`<span class="eyebrow">${reading[0]}</span><h3>${l.title}</h3><p>${reading[1]}</p>`;updateLayers();}
function setRevealMode(next){
 selectionBox.visible=false;$('focus-component').hidden=true;delete app.dataset.component;selectionDirection=null;
 if(balconyFocus){resetBalconyFocus();selectionBox.visible=false;$('focus-component').hidden=true;delete app.dataset.component;}
 if(entranceFocus){resetEntranceFocus();selectionBox.visible=false;$('focus-component').hidden=true;delete app.dataset.component;}
 if(glazingInspect)nativeModel.setGlazingInspection(false,{window:patchWindow,spread:0});
 revealMode=next;const active=nativeModel.setRevealMode(next);patchWindow=active.window;layerGroups=active.groups;app.dataset.revealMode=next;
 pins.forEach((pin,i)=>layerGroups[i].add(pin));
 for(const button of document.querySelectorAll('[data-reveal]'))button.setAttribute('aria-pressed',String(button.dataset.reveal===next));
 if(['layers','detail'].includes(mode)){$('view-title').textContent=next==='field'?'Відкоси з Cembrit.':'Вузол за проєктом.';$('view-description').textContent=next==='field'?'150 мм · шви 8 мм · польовий варіант':'PURAL 0,6 мм · аркуш 14';$('selected-layer').innerHTML=next==='field'?'<span class="eyebrow">ПОЛЬОВИЙ ВАРІАНТ</span><h3>2 бокові + 2 верхні деталі</h3><p>Нижній заріз під відлив 10°. Глибина 150 мм орієнтовна; чинний вузол ще звіряємо.</p>':'<span class="eyebrow">ПУБЛІЧНИЙ ПРОЄКТ</span><h3>Металеві відкоси PURAL</h3><p>Аркуш 14. Посадка рами, загини й кріплення показові.</p>';}
 updateLayers();
 if(glazingInspect)setGlazingView(true,{immediate:true});
}
for(const button of document.querySelectorAll('[data-reveal]'))button.addEventListener('click',()=>setRevealMode(button.dataset.reveal));
function setGlazingView(enabled,{immediate=false,frame=true}={}){
 glazingMotion.stop();glazingInspect=enabled;app.dataset.glazingInspection=String(enabled);
 $('glazing-inspection').setAttribute('aria-pressed',String(enabled));
 $('glazing-inspection').textContent=enabled?'Зібрати склопакет':'Склопакет';
 $('layer-list').hidden=enabled;
 if(enabled){
  stopNavigation();layerMotion.to(0,{immediate:true});
  building.visible=garden.visible=false;
  document.querySelector('label[for="explode"]').textContent='Розсунути скла';
  $('explode').setAttribute('aria-label','Розсунути скла склопакета');
  $('model-tag-text').textContent='A-01 · оглядове розсування';
  $('view-title').textContent='Три скла. Дві камери.';
  $('view-description').textContent='A-01 · 510/1270 мм · керамічні рамки';
  $('selected-layer').innerHTML='<span class="eyebrow">A-01 / АРКУШ 25</span><h3>Склопакет у деталях</h3><p>Три скла й керамічні рамки — за проєктом. Склад 4/10/4/10/4 мм і посадка профілю показові; замовлений виріб ще не підтверджено.</p>';
 }
 glazingMotion.to(enabled?82:0,{immediate});
 if(!enabled){nativeModel.setGlazingInspection(false,{window:patchWindow,spread:0});building.visible=garden.visible=true;document.querySelector('label[for="explode"]').textContent='Розсунути шари';$('explode').setAttribute('aria-label','Розсунути шари фасаду');$('explode').value=0;$('model-tag-text').textContent='VS-2 · розсування збільшене';updateLayers();if(frame&&['layers','detail'].includes(mode))setRevealMode(revealMode);}
}
$('glazing-inspection').addEventListener('click',()=>setGlazingView(!glazingInspect));
function setMode(next,immediate=false,face=null,requestedLayer=null){if(dimensionVisible)clearDimensions();if(glazingInspect)setGlazingView(false,{immediate:true,frame:false});resetBalconyFocus();resetEntranceFocus();cameraFlight.stop();pendingNavigation=null;pendingMode=null;layerMotion.stop();const oldSystem=mode==='roof'?'roof':mode==='plinth'?'plinth':'facade';mode=next;const system=mode==='roof'?'roof':mode==='plinth'?'plinth':'facade';layers=system==='roof'?roofLayers:system==='plinth'?plinthLayers:facadeLayers;visible=visibility[mode==='detail'||mode==='layers'?'detail':system];if(system!==oldSystem||mode==='building'){selected=-1;}paintLayerList();app.dataset.mode=mode;for(const b of document.querySelectorAll('button[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
  building.visible=garden.visible=true;patchWindow.visible=true;setInspection(mode);selectionBox.visible=false;$('focus-component').hidden=true;delete app.dataset.component;selectionDirection=null;
  const title={building:['01 / MÄE TN 7 · ALU','Mäe tn 7.','Реконструкція за публічним проєктом.'],layers:['02 / VS-2 · ФРАГМЕНТ','Фасад на шари.','100 + 50 + 50 мм · вітрозахист · дошки100×25 · плити'],detail:['03 / ВІКОННИЙ ФРАГМЕНТ','Місце з’єднання.','Прив’язка до аркуша 14; фактичний проріз ще звіряємо.'],roof:['04 / ПОКРІВЛЯ · АРКУШ 12','Дах у розрізі.','Контрлати, лати й покриття — різні елементи.'],plinth:['05 / VS-1 · АРКУШ 09','Цоколь у розрізі.','EPS 100 + 50 мм, брус і металевий профіль.']}[mode];
  $('view-kicker').textContent=title[0];$('view-title').textContent=title[1];$('view-description').textContent=title[2];
  $('reveal-controls').hidden=!['layers','detail'].includes(mode);
  if(mode==='roof'){document.querySelector('label[for="explode"]').textContent='Розкрити дах';$('explode').setAttribute('aria-label','Розкрити шари покрівлі');}
  if(mode==='plinth'){document.querySelector('label[for="explode"]').textContent='Розкрити цоколь';$('explode').setAttribute('aria-label','Розкрити шари цоколя');}
  if(mode==='detail'){$('view-title').textContent=revealMode==='field'?'Відкоси з Cembrit.':'Вузол за проєктом.';$('view-description').textContent=revealMode==='field'?'150 мм · шви 8 мм · польовий варіант':'PURAL 0,6 мм · аркуш 14';}
  $('panel-title').textContent={building:'Огляд будинку',layers:'Конструкція VS-2',detail:'Віконне примикання',roof:'Покрівля',plinth:'Цоколь VS-1'}[mode];
  $('panel-description').textContent={building:'Натисни на елемент у 3D.',layers:'Фрагмент VS-2. Око приховує обраний шар.',detail:windowPanelCaption(),roof:'Розкриття на схилі; крок лат показовий.',plinth:'Розкриття цоколя на торці будинку.'}[mode];
  $('model-tag-text').textContent=mode==='building'?panelCaption():(mode==='roof'?'Дах · крок лат ілюстративний':mode==='plinth'?'VS-1 · розсування збільшене':'VS-2 · розсування збільшене');
  $('explode').value=mode==='building'?0:['layers','roof','plinth'].includes(mode)?82:52;
  dimensionGroup.visible=false;if(mode!=='building'){dimensionVisible=false;$('dimensions').setAttribute('aria-pressed','false');}$('dimensions').hidden=mode!=='building';
  if(mode!=='building'){if(Number.isInteger(requestedLayer)&&layers[requestedLayer])selectLayer(requestedLayer);else if(selected<0)selectLayer(mode==='roof'||mode==='plinth'?1:6);}if(mode==='building'){$('selected-layer').innerHTML='<span class="eyebrow">ВИБІР У 3D</span><h3>Mäe tn 7 · Alu</h3>';}
  const finalAmount=Number($('explode').value);roofTarget=mode==='roof'?finalAmount:0;plinthTarget=mode==='plinth'?finalAmount:0;updateLayers(0);layerMotion.to(0,{immediate:true});
  if(face&&mode==='building'){showElevation(face);return;}
  home({immediate,finalAmount});layerMotion.to(finalAmount,{immediate:immediate||mode==='building'});
}
function bounds(min,max){return new THREE.Box3(new THREE.Vector3(...min),new THREE.Vector3(...max));}
function viewBounds(finalAmount=amount,face=null){
 const spread=mode==='layers'?8*.24*finalAmount/100:0;
 if(['layers','detail'].includes(mode)&&glazingInspect)return nativeModel.setGlazingInspection(true,{window:patchWindow,spread:glazingSpread}).clone().expandByScalar(.10);
 if(mode!=='building')return nativeModel.getInspectionBounds(finalAmount).union(nativeModel.getInspectionBounds(amount)).expandByScalar(mode==='roof'?.12:.08);
 if(face){
  if(face==='SE')return bounds([-20.3,-.76,5.4],[20.3,roofSpec.ridge+.2,7.61+spread]);
  if(face==='NW')return bounds([-20.3,-.76,-6.8-spread],[20.3,roofSpec.ridge+.2,-5.4]);
  const x=face==='SW'?20.2:-20.2;
  return bounds([x-.2-spread,-.76,-5.75],[x+.2+spread,roofSpec.ridge+.2,5.75]);
 }
 return bounds([-Math.max(roofSpec.length/2+.06,20.25+spread),-.76,-Math.max(roofSpec.backSpan+.06,6.8+spread)],[Math.max(roofSpec.length/2+.06,20.25+spread),roofSpec.ridge+.25,Math.max(7.61,5.67+spread)]);
}
function fittedPose(box,direction){
 const centre=box.getCenter(new THREE.Vector3()),back=new THREE.Vector3(...direction).normalize(),right=new THREE.Vector3(0,1,0).cross(back).normalize(),up=back.clone().cross(right).normalize();
 const w=Math.max(1,viewer.clientWidth),h=Math.max(1,viewer.clientHeight),mobile=w<600;
 const tanV=Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov/2))*Math.max(.45,(h-(mobile?72:96))/h),tanH=Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov/2))*(w/h)*Math.max(.5,(w-(mobile?32:48))/w);
 let distance=1.8;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const q=new THREE.Vector3(x,y,z).sub(centre),depth=q.dot(back);distance=Math.max(distance,depth+Math.abs(q.dot(right))/tanH,depth+Math.abs(q.dot(up))/tanV);}
 return {position:centre.clone().addScaledVector(back,distance*1.08).toArray(),target:centre.toArray(),zoom:1};
}
function usePerspective(){
 if(dimensionVisible)clearDimensions();
 if(orthographic){const direction=camera.position.clone().sub(controls.target).normalize(),distance=(camera.top-camera.bottom)/(2*camera.zoom*Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov/2)));perspectiveCamera.position.copy(controls.target).addScaledVector(direction,distance);perspectiveCamera.zoom=1;lastSafeCamera=null;}
 camera=perspectiveCamera;orthographic=false;controls.object=camera;controls.enableRotate=true;controls.maxPolarAngle=Math.PI*.485;delete app.dataset.elevation;dimensionGroup.visible=false;dimensionVisible=false;$('dimensions').setAttribute('aria-pressed','false');camera.aspect=Math.max(1,viewer.clientWidth)/Math.max(1,viewer.clientHeight);camera.updateProjectionMatrix();
}
function flyTo(pose,{immediate=false,onComplete}={}){
 if(!controls)return;cameraFlight.stop();usePerspective();cameraManual=false;protectCamera();
 const from={position:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom};navigationPath=mode==='building'?createCameraPath(from.position,pose.position):null;
 // Instant placement skips the orbit: validate its endpoint, not a fictitious
 // chord across the house. Animated frames retain their swept guard history.
 if(immediate||reduced)lastSafeCamera=null;
 navigationCompletion=onComplete||null;cameraFlight.to(from,pose,{immediate,onComplete:()=>{const complete=navigationCompletion;navigationCompletion=null;complete?.();}});
}
function home({immediate=false,onComplete,finalAmount=mode==='roof'?roofTarget:mode==='plinth'?plinthTarget:amount}={}){
 if(dimensionVisible)clearDimensions();const hadComponent=!!app.dataset.component;
 if(balconyFocus){resetBalconyFocus();selectionBox.visible=false;$('focus-component').hidden=true;delete app.dataset.component;}
 if(entranceFocus){resetEntranceFocus();selectionBox.visible=false;$('focus-component').hidden=true;delete app.dataset.component;}
 if(mode==='building'&&hadComponent){selectedBalcony=selectedEntrance=null;selectionDirection=null;selectionBox.visible=false;$('focus-component').hidden=true;delete app.dataset.component;$('selected-layer').innerHTML='<span class="eyebrow">ВИБІР У 3D</span><h3>Mäe tn 7 · Alu</h3>';}
 if(!controls)return;if(mode==='roof')roofTarget=finalAmount;if(mode==='plinth')plinthTarget=finalAmount;framingBox=viewBounds(finalAmount);app.dataset.view='home';if(mode==='building'){$('model-tag-text').textContent=panelCaption();$('view-title').textContent='Mäe tn 7.';$('view-description').textContent='Реконструкція за публічним проєктом.';}
 const direction=glazingInspect?[1.4,.4,1]:mode==='roof'?[.55,.6,1]:mode==='plinth'?[.65,.27,-1]:mode==='detail'?[.35,.15,1]:mode==='layers'?[.5,.2,1]:viewer.clientWidth/Math.max(1,viewer.clientHeight)<.95?[2.5,.8,1]:[.65,.28,1.6];
 flyTo(fittedPose(framingBox,direction),{immediate,onComplete});
}
function afterClosing(navigate){cameraFlight.stop();pendingMode=null;pendingNavigation=null;const restore=Number($('explode').value);if(mode!=='building'&&amount>0&&!reduced){if(mode==='roof')roofTarget=0;if(mode==='plinth')plinthTarget=0;pendingNavigation=()=>navigate(restore);layerMotion.to(0);}else{layerMotion.stop();layerMotion.to(0,{immediate:true});navigate(restore);}}
function navigateHome(){afterClosing(restore=>home({finalAmount:restore,onComplete:()=>layerMotion.to(restore)}));}
function showElevation(code){
 if(balconyFocus){resetBalconyFocus();selectionBox.visible=false;$('focus-component').hidden=true;delete app.dataset.component;}
 if(entranceFocus){resetEntranceFocus();selectionBox.visible=false;$('focus-component').hidden=true;delete app.dataset.component;}
 cameraFlight.stop();layerMotion.stop();orthographic=true;camera=orthoCamera;controls.object=camera;controls.enableRotate=true;controls.maxPolarAngle=Math.PI*.5;cameraManual=false;camera.zoom=1;app.dataset.elevation=code;app.dataset.view=code;
 const end=code==='SW'||code==='NE',sideMargin=dimensionVisible?3.3:.25;framingBox=bounds([-(end?geometry.depth:geometry.length)/2-sideMargin,dimensionVisible?-1.65:-.76,0],[(end?geometry.depth:geometry.length)/2+sideMargin,roofSpec.ridge+(dimensionVisible?1:.25),0]);
 controls.target.set(0,(framingBox.min.y+framingBox.max.y)/2,0);camera.position.set(...({SE:[0,controls.target.y,65],NW:[0,controls.target.y,-65],SW:[65,controls.target.y,0],NE:[-65,controls.target.y,0]}[code]));
 if(dimensionVisible){const half=(end?geometry.depth:geometry.length)/2+3.3;framingBox=viewBounds().union(end?bounds([code==='SW'?21.6:-21.6,-1.65,-half],[code==='SW'?21.6:-21.6,roofSpec.ridge+1,half]):bounds([-half,-1.65,code==='NW'?-8.05:8.75],[half,roofSpec.ridge+1,code==='NW'?-8.05:8.75]));}$('model-tag-text').textContent=panelCaption(code);fit();setDimensions(code);controls.update();$('view-title').textContent=facades[code].title;$('view-description').textContent='Ортогональний фасад · довжина і корпус за проєктом; висоти за PP-1';draw();
}
function elevation(code){
 if(mode!=='building'){setMode('building',false,code);return;}showElevation(code);
}
const selectionBox=new THREE.Box3Helper(new THREE.Box3(),0xe86d2d);selectionBox.visible=false;selectionBox.material.depthTest=false;selectionBox.renderOrder=20;scene.add(selectionBox);
let selectionDirection=null;
function resetBalconyFocus(){
 invalidateShadows();
 balconyMotion.stop();if(balconyFocus)nativeModel.setBalconyInspection(null,{enabled:false});
 selectedBalcony=balconyFocus=null;balconyAmount=balconyTarget=0;balconyManual=false;delete app.dataset.balconyFocus;delete app.dataset.balconySpread;
 document.querySelector('label[for="explode"]').textContent='Розсунути шари';
 $('explode').disabled=false;$('explode').setAttribute('aria-label','Ступінь розсування шарів фасаду');$('explode').value=Math.round(amount);$('explode-value').value=`${Math.round(amount)}%`;
 if(balconyLabels){for(const [id,text] of Object.entries(balconyLabels))$(id).textContent=text;balconyLabels=null;}
}
function frameBalcony({immediate=false,onComplete}={}){
 framingBox=nativeModel.getBalconyFloorBounds(balconyFocus,balconyTarget).union(nativeModel.getBalconyFloorBounds(balconyFocus)).expandByScalar(.14);
 app.dataset.view='component';flyTo(fittedPose(framingBox,[-.55,.75,-1]),{immediate,onComplete});
}
function resetEntranceFocus(){
 invalidateShadows();
 entranceMotion.stop();if(entranceFocus)nativeModel.setEntranceSpread(null);
 selectedEntrance=entranceFocus=null;entranceAmount=entranceTarget=0;entranceManual=false;delete app.dataset.entranceFocus;
 document.querySelector('label[for="explode"]').textContent='Розсунути шари';
 $('explode').disabled=false;$('explode').setAttribute('aria-label','Ступінь розсування шарів фасаду');$('explode').value=Math.round(amount);$('explode-value').value=`${Math.round(amount)}%`;
}
function frameEntrance({immediate=false,onComplete}={}){
 framingBox=nativeModel.getEntranceBounds(entranceFocus,entranceTarget).union(nativeModel.getEntranceBounds(entranceFocus)).expandByScalar(.12);
 app.dataset.view='component';flyTo(fittedPose(framingBox,[.4,.18,1]),{immediate,onComplete});
}
function focusSelection({immediate=false}={}){
 if(!selectionBox.visible)return;
 if(balconyFocus){const id=balconyFocus;frameBalcony({immediate,onComplete:()=>{if(balconyFocus===id)balconyMotion.to(balconyTarget);}});return;}
 if(selectedBalcony){
  const id=selectedBalcony;
  afterClosing(()=>{
   if(selectedBalcony!==id)return;
   balconyFocus=id;balconyManual=false;app.dataset.balconyFocus='true';app.dataset.component='balcony';
   const entry=nativeModel.balconies.find(e=>e.id===id);balconyTarget=entry.canInspect?82:0;
   document.querySelector('label[for="explode"]').textContent='Розкрити підлогу';
   $('explode').setAttribute('aria-label','Розкрити підлогу обраного балкона');$('explode').disabled=!entry.canInspect;$('focus-component').hidden=true;
   balconyLabels=Object.fromEntries(['view-title','view-description','model-tag-text'].map(id=>[id,$(id).textContent]));
   $('view-title').textContent='Підлога балкона';$('view-description').textContent='Сталь · стрічки · плита · покриття';$('model-tag-text').textContent=id+' · оглядове розсування';
   $('selected-layer').innerHTML='<span class="eyebrow">'+id+' · АРКУШІ 16–17</span><h3>Підлога балкона</h3><p>Сталь нерухома; розсування шарів оглядове. Відмітку підлоги біля дверей ще звіряємо.</p>';
   balconyMotion.to(0,{immediate:true});
   frameBalcony({immediate,onComplete:()=>{if(balconyFocus===id)balconyMotion.to(balconyTarget,{immediate});}});
  });return;
 }
 if(entranceFocus){const id=entranceFocus;frameEntrance({immediate,onComplete:()=>{if(entranceFocus===id)entranceMotion.to(entranceTarget);}});return;}
 if(selectedEntrance){
  const id=selectedEntrance;
  afterClosing(()=>{
   if(selectedEntrance!==id)return;
   entranceFocus=id;entranceManual=false;app.dataset.entranceFocus='true';app.dataset.component='entrance';
   const entry=nativeModel.entrances.find(e=>e.id===id);entranceTarget=entry.canExplode?82:0;
   document.querySelector('label[for="explode"]').textContent='Розкрити навіс';
   $('explode').setAttribute('aria-label','Розкрити навіс обраного входу');$('explode').disabled=!entry.canExplode;$('focus-component').hidden=true;
   entranceMotion.to(0,{immediate:true});
   frameEntrance({immediate,onComplete:()=>{if(entranceFocus===id)entranceMotion.to(entranceTarget,{immediate});}});
  });return;
 }
 pendingMode=null;pendingNavigation=null;layerMotion.stop();framingBox=selectionBox.box.clone().expandByScalar(.12);const direction=selectionDirection||camera.position.clone().sub(controls.target).normalize().toArray();app.dataset.view='component';flyTo(fittedPose(framingBox,direction),{immediate});
}
$('focus-component').addEventListener('click',focusSelection);
function outline(hit){
 selectedPanel=null;selectedReturn=null;selectedRoofEdge=null;selectedRoofLath=null;selectedGuard=null;selectedOpening=null;selectedBalconyOpenings=null;$('open-selection-drawing').hidden=true;
 dimensionSelection=null;
 const openingRecord=mode==='building'?nativeOpeningRecord(hit):null;
 if(openingRecord){selectedOpening=structuredClone(openingRecord.selection);dimensionSelection=structuredClone(selectedOpening);if(dimensionVisible)setDimensions(selectedOpening.code);}else if(dimensionVisible)setDimensions(dimensionCode);
 const guard=nativeBalconyGuardRecord(hit);let balcony=guard?null:nativeBalconyRecord(hit);if(balconyFocus&&balcony?.id!==balconyFocus){resetBalconyFocus();balcony=guard?null:nativeBalconyRecord(hit);}selectedBalcony=balcony?.id||null;if(balcony&&mode==='building')selectedBalconyOpenings=nativeBalconyOpeningRecords(balcony,building);
 let entrance=nativeEntranceRecord(hit);if(entranceFocus&&entrance?.id!==entranceFocus){resetEntranceFocus();entrance=nativeEntranceRecord(hit);}selectedEntrance=entrance?.id||null;selectionDirection=entrance?[.4,.18,1]:null;
 $('focus-component').textContent=balcony?'Наблизити підлогу':entrance?'Наблизити вхід '+entrance.index:'Наблизити деталь';
 if(balcony)app.dataset.component='balcony';else if(entrance)app.dataset.component='entrance';else delete app.dataset.component;
 if(openingRecord){selectedBalcony=selectedEntrance=null;selectionDirection=({SE:[0,.12,1],NW:[0,.12,-1],SW:[1,.12,0],NE:[-1,.12,0]})[selectedOpening.code];$('focus-component').textContent='Наблизити проріз';}
 let box=openingRecord?.bounds||(balcony?nativeModel.getBalconyFloorBounds(balcony.id):guard?.bounds||entrance?.bounds||nativeRoofLathRecord(hit)?.bounds||nativeRetainedReturnRecord(hit)?.bounds||nativePlinthRecord(hit)?.bounds||nativePanelBounds(hit));if(!box){if(hit.object.isInstancedMesh&&Number.isInteger(hit.instanceId)){const matrix=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,matrix);hit.object.geometry.computeBoundingBox();box=hit.object.geometry.boundingBox.clone().applyMatrix4(matrix).applyMatrix4(hit.object.matrixWorld);}else box=new THREE.Box3().setFromObject(hit.object);}
 if(!box.isEmpty()){selectionBox.box.copy(box).expandByScalar(.012);selectionBox.visible=true;$('focus-component').hidden=false;draw();}
}

function showOpeningSelection(record){
 outline({object:record.owner});const o=record.selection.opening;
 const ref=document.createElement('span');ref.className='eyebrow';ref.textContent='ПРОРІЗ ІЗ ПРОЄКТУ';
 const heading=document.createElement('h3');heading.textContent=`${o.width} × ${o.height} мм`;
 const note=document.createElement('p');note.textContent='Відкрий ширину, висоту та рівні низу й верху. Пунктирні відмітки відтворені з креслення й потребують обміру.';
 $('selected-layer').replaceChildren(ref,heading,note);app.dataset.component='window';
}

let lastSafeCamera=null,guardingCamera=false;const colliders=[...houseVolumes(),boundsVolume([-500,-500,-500],[500,.03,500])];
function protectCamera(){
 if(guardingCamera||orthographic)return;
 const isolated=mode!=='building';const extra=isolated?nativeModel.getInspectionLayerBounds(amount).map(b=>boundsVolume(b.min.toArray(),b.max.toArray())):[];if(glazingInspect){const b=nativeModel.setGlazingInspection(true,{window:patchWindow,spread:glazingSpread}).clone().expandByScalar(.01);extra.push(boundsVolume(b.min.toArray(),b.max.toArray()));}if(balconyFocus){const b=nativeModel.getBalconyFloorBounds(balconyFocus,balconyTarget).union(nativeModel.getBalconyFloorBounds(balconyFocus)).expandByScalar(.01);extra.push(boundsVolume(b.min.toArray(),b.max.toArray()));}const nativeEntrances=isolated?[]:nativeModel.entrances.map(e=>{const b=e.currentBounds.clone().expandByScalar(.005);return boundsVolume(b.min.toArray(),b.max.toArray());});const desired=camera.position.toArray(),volumes=[...(isolated?[]:colliders),...nativeEntrances,...extra];const safe=constrainCamera(lastSafeCamera,desired,volumes);camera.position.fromArray(safe);if(!volumes.some(v=>inVolume(safe,v)))lastSafeCamera=safe;app.dataset.cameraGuard='exterior';app.dataset.cameraBlocked=String(safe.some((v,i)=>Math.abs(v-desired[i])>1e-7));
 const near=safePerspectiveNear(safe,volumes);if(camera.near!==near){camera.near=near;camera.updateProjectionMatrix();}app.dataset.cameraNear=near.toFixed(5);
 if(app.dataset.cameraBlocked==='true'){guardingCamera=true;controls.update();guardingCamera=false;}
}
let renderPending=false,renderCompletion=null,recoveryFramePending=false,contextRecovery=null,rendererLookdev=null,lightingGeneration=0,presentationRenderer=null;
let shaderWarmupGeneration=0;
function prepareInspectionShaders(){
 const token=++shaderWarmupGeneration,pass=presentationRenderer;
 const run=()=>{
  if(token!==shaderWarmupGeneration||pass!==presentationRenderer||renderer.getContext().isContextLost()||document.hidden)return;
  const start=performance.now();app.dataset.shaderWarmup='compiling';
  try{const materials=pass.prepare(scene,camera);if(token!==shaderWarmupGeneration||pass!==presentationRenderer)return;app.dataset.shaderWarmup='submitted';app.dataset.shaderWarmupMaterials=String(materials.size);app.dataset.shaderWarmupMs=(performance.now()-start).toFixed(1);}
  catch(error){if(token!==shaderWarmupGeneration)return;app.dataset.shaderWarmup='failed';console.warn('Inspection shader preparation failed',error);}
 };
 if(globalThis.requestIdleCallback)requestIdleCallback(run,{timeout:1500});else setTimeout(run,0);
}
const renderQuality=createRenderQuality({
 canRefine:()=>!document.hidden&&app.dataset.ready==='true'&&!renderer?.getContext().isContextLost(),
 refine:()=>draw(false,true)
});
function syncRenderQuality(){
 const w=Math.max(1,viewer.clientWidth),h=Math.max(1,viewer.clientHeight);
 const profile=document.body.classList.contains('presentation')&&renderQuality.profile!=='still'?'presentation':renderQuality.profile;
 const ratio=resizeRenderer(renderer,w,h,profile,presentationRenderer?.maxPixels);
 app.dataset.renderScale=ratio.toFixed(2);app.dataset.renderQuality=profile;
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)renderQuality.suspend();else if(renderer)draw();});
async function refreshLighting(isCurrent=()=>true){
 const token=++lightingGeneration,current=()=>token===lightingGeneration&&isCurrent()&&!renderer.getContext().isContextLost();
 try{
  const next=await configureRenderer(renderer,scene,{isCurrent:current});if(!next)return false;
  rendererLookdev?.dispose();rendererLookdev=next;app.dataset.lookdev=next.mode??'CC0 HDR daylight';return true;
 }catch(error){
  if(!current())return false;
  scene.environment=null;app.dataset.lookdev='daylight base';scene.userData.lookdev={...scene.userData.lookdev,environment:'neutral daylight (HDR unavailable)'};console.warn('HDR unavailable; daylight view remains usable',error);return true;
 }
}
function draw(recoveryFrame=false,settledFrame=false){
 if(!renderer||!labelRenderer||renderer.getContext().isContextLost()||(!recoveryFrame&&contextRecovery?.state==='restoring'))return Promise.resolve(false);
 if(!settledFrame)renderQuality.activity();
 recoveryFramePending||=recoveryFrame;if(renderPending)return renderCompletion;
 renderPending=true;renderCompletion=new Promise(resolve=>requestAnimationFrame(()=>{renderPending=false;
 const permitted=recoveryFramePending;recoveryFramePending=false;
 if(renderer.getContext().isContextLost()||(!permitted&&contextRecovery?.state==='restoring')){resolve(false);return;}
 try{const start=performance.now();syncRenderQuality();app.dataset.screwBatchesVisible=String(nativeModel.updateScrewVisibility(camera));if(!rendererPrimed){
 // In this Three version the first shadow pass updates its matrix before
 // the shadow camera receives the reversed-depth projection. One warmup
 // render settles that projection; subsequent frames render only once.
 if(renderer.capabilities.reversedDepthBuffer){renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);shadowPasses++;}rendererPrimed=true;shadowsDirty=true;}
 renderer.shadowMap.needsUpdate=shadowsDirty;
 if(shadowsDirty)shadowPasses++;
 presentationRenderer??=createPresentationRenderer(renderer);presentationRenderer.render(scene,camera);app.dataset.antiAliasing=presentationRenderer.mode;app.dataset.presentationBufferBytes=String(presentationRenderer.bytes);shadowsDirty=false;labelRenderer.render(scene,camera);updateDimensionOverlay();app.dataset.shadowPasses=String(shadowPasses);app.dataset.frameMs=(performance.now()-start).toFixed(1);app.dataset.drawCalls=String(renderer.info.render.calls);app.dataset.triangles=String(renderer.info.render.triangles);app.dataset.camera=[camera.position.x,camera.position.y,camera.position.z].map(n=>n.toFixed(2)).join(',');app.dataset.frameCount=String(Number(app.dataset.frameCount||0)+1);if(app.dataset.contextState==='render-error'){app.dataset.contextState='ready';app.dataset.ready='true';$('fallback').hidden=true;}resolve(!renderer.getContext().isContextLost());}catch(error){renderQuality.suspend();app.dataset.renderErrors=String(Number(app.dataset.renderErrors||0)+1);app.dataset.contextState='render-error';app.dataset.ready='false';$('fallback').hidden=false;$('fallback-title').textContent='Огляд 3D призупинено';$('fallback-note').textContent='Спробуй відкрити сцену ще раз. Ракурс збережений до перезавантаження.';console.error('3D render failed',error);resolve(false);}
 }));return renderCompletion;}

function fit(){const w=Math.max(1,viewer.clientWidth),h=Math.max(1,viewer.clientHeight);perspectiveCamera.aspect=w/h;if(orthographic&&framingBox){let size=framingBox.getSize(new THREE.Vector3());if(dimensionVisible){const back=camera.position.clone().sub(controls.target).normalize(),right=new THREE.Vector3(0,1,0).cross(back).normalize(),up=back.clone().cross(right).normalize();let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;for(const x of [framingBox.min.x,framingBox.max.x])for(const y of [framingBox.min.y,framingBox.max.y])for(const z of [framingBox.min.z,framingBox.max.z]){const q=new THREE.Vector3(x,y,z).sub(controls.target),px=q.dot(right),py=q.dot(up);x0=Math.min(x0,px);x1=Math.max(x1,px);y0=Math.min(y0,py);y1=Math.max(y1,py);}size=new THREE.Vector3(2*Math.max(Math.abs(x0),Math.abs(x1)),2*Math.max(Math.abs(y0),Math.abs(y1)),0);}const safeH=Math.max(.45,(h-(w<600?72:96))/h),safeW=Math.max(.5,(w-(w<600?32:48))/w),half=Math.max(size.y/(2*safeH),size.x/(2*(w/h)*safeW))*1.04;camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;}camera.updateProjectionMatrix();if(renderer){renderQuality.activity();syncRenderQuality();labelRenderer.setSize(w,h);draw();}}
function clearDimensions(){
 dimensionReview.hidden=true;delete app.dataset.dimensionLabels;delete app.dataset.dimensionSchedule;delete app.dataset.dimensionScope;
 app.dataset.dimensions='false';delete app.dataset.dimensionOpening;
 landscape.setDimensionMode(false);
 dimensionVisible=false;dimensionSnapshot=null;dimensionGroup.visible=false;$('dimensions').setAttribute('aria-pressed','false');
}
function toggleDimensions(){
 if(!controls||mode!=='building')return;
 if(dimensionVisible){
  const saved=dimensionSnapshot;clearDimensions();if(!saved)return;
  cameraFlight.stop();orthographic=saved.orthographic;camera=orthographic?orthoCamera:perspectiveCamera;camera.copy(saved.camera);controls.object=camera;controls.target.copy(saved.target);
  for(const [key,value] of Object.entries(saved.controls))controls[key]=value;
  framingBox=saved.framingBox?.clone()||null;cameraManual=saved.cameraManual;lastSafeCamera=null;
  for(const key of ['view','elevation']){if(saved.dataset[key]===undefined)delete app.dataset[key];else app.dataset[key]=saved.dataset[key];}
  for(const [id,text] of Object.entries(saved.labels))$(id).textContent=text;
  // Preserve pose and zoom across a viewport change; only its aspect adapts.
  const aspect=Math.max(1,viewer.clientWidth)/Math.max(1,viewer.clientHeight);
  if(orthographic){if(aspect!==saved.aspect){const half=(camera.top-camera.bottom)/2;camera.left=-half*aspect;camera.right=half*aspect;}}else camera.aspect=aspect;
  camera.updateProjectionMatrix();protectCamera();controls.update();draw();return;
 }
 cameraFlight.stop();pendingMode=null;pendingNavigation=null;
 const keys=['enableRotate','enablePan','enableZoom','minPolarAngle','maxPolarAngle','minAzimuthAngle','maxAzimuthAngle','minDistance','maxDistance','minZoom','maxZoom'];
 dimensionSnapshot={aspect:Math.max(1,viewer.clientWidth)/Math.max(1,viewer.clientHeight),camera:camera.clone(),orthographic,target:controls.target.clone(),framingBox:framingBox?.clone()||null,cameraManual,controls:Object.fromEntries(keys.map(key=>[key,controls[key]])),dataset:{view:app.dataset.view,elevation:app.dataset.elevation},labels:Object.fromEntries(['view-title','view-description','model-tag-text'].map(id=>[id,$(id).textContent]))};
 dimensionVisible=true;$('dimensions').setAttribute('aria-pressed','true');
 const offset=camera.position.clone().sub(controls.target);
 const code=dimensionSelection?.code||app.dataset.elevation||(Math.abs(offset.x)>Math.abs(offset.z)?(offset.x>=0?'SW':'NE'):(offset.z>=0?'SE':'NW'));
 showElevation(code);
}
function frameOpeningDimensions(){
 if(!selectedOpening||!dimensionVisible||selectionBox.box.isEmpty())return;
 const direction=camera.position.clone().sub(controls.target).normalize();
 framingBox=selectionBox.box.clone().expandByVector(new THREE.Vector3(1.15,.55,1.15));
 controls.target.copy(framingBox.getCenter(new THREE.Vector3()));camera.position.copy(controls.target).addScaledVector(direction,65);camera.zoom=1;
 app.dataset.view='opening-dimensions';app.dataset.dimensionOpening=selectedOpening.nativeWindowId;fit();controls.update();draw();
}
function resizeView(){
 fit();if(orthographic||cameraManual||!framingBox)return;
 // Resize keeps the current viewing direction and never navigates Home.
 const wasMoving=cameraFlight.moving,complete=navigationCompletion;cameraFlight.stop();const direction=camera.position.clone().sub(controls.target).normalize().toArray();
 const pose=fittedPose(framingBox,direction);camera.position.fromArray(pose.position);controls.target.fromArray(pose.target);camera.zoom=pose.zoom;camera.updateProjectionMatrix();lastSafeCamera=null;protectCamera();controls.update();draw();if(wasMoving){navigationCompletion=null;complete?.();}
}
function stopNavigation(){cameraManual=true;navigationCompletion=null;glazingMotion.stop();cameraFlight.stop();layerMotion.stop();balconyMotion.stop();balconyTarget=balconyAmount;balconyManual=false;entranceMotion.stop();entranceTarget=entranceAmount;entranceManual=false;if(mode==='roof')roofTarget=amount;if(mode==='plinth')plinthTarget=amount;pendingMode=null;pendingNavigation=null;$('explode').value=Math.round(glazingInspect?glazingSpread:balconyFocus?balconyAmount:entranceFocus?entranceAmount:amount);}
function installCameraKeyboard(){
 const keys=new Set(),movement=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);let frame=0,last=0;
 function step(dt){
  camera.updateMatrixWorld();const distance=Math.max(.45,Math.min(5,camera.position.distanceTo(controls.target)*.12))*dt*(keys.has('ShiftLeft')||keys.has('ShiftRight')?3:1),delta=keyboardTranslation(camera,keys,distance),before=camera.position.clone(),target=controls.target.clone();
  camera.position.add(delta);protectCamera();controls.target.copy(target).add(camera.position.clone().sub(before));controls.update();draw();
 }
 function tick(now){frame=0;if(!keys.size)return;step(Math.min(.06,(now-last)/1000));last=now;frame=requestAnimationFrame(tick);}
 function stop(){keys.clear();cancelAnimationFrame(frame);frame=0;last=0;}
 document.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||!acceptsCameraKeys(event.target,viewer))return;
  if(event.code.startsWith('Shift')){keys.add(event.code);return;}if(!movement.has(event.code))return;
  event.preventDefault();if(keys.has(event.code))return;stopNavigation();keys.add(event.code);step(1/60);if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}
 });
 document.addEventListener('keyup',event=>{keys.delete(event.code);if(![...keys].some(k=>movement.has(k)))stop();});
 window.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 document.addEventListener('focusin',event=>{if(!acceptsCameraKeys(event.target,viewer))stop();});
}
function rotate(direction){if(!controls)return;stopNavigation();if(orthographic&&!dimensionVisible){usePerspective();protectCamera();}const offset=camera.position.clone().sub(controls.target);const spherical=new THREE.Spherical().setFromVector3(offset);spherical.theta+=direction*.2;camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));protectCamera();controls.update();draw();}
function zoom(factor){if(!controls)return;stopNavigation();if(orthographic){camera.zoom=Math.max(.3,Math.min(5,camera.zoom/factor));camera.updateProjectionMatrix();draw();return;}camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);protectCamera();controls.update();draw();}

for(const b of document.querySelectorAll('button[data-mode]'))b.addEventListener('click',()=>setMode(b.dataset.mode));
$('explode').addEventListener('input',()=>{
 const a=Number($('explode').value);
 if(mode==='building'&&!glazingInspect&&!balconyFocus&&!entranceFocus)setMode('layers',true);
 stopNavigation();$('explode').value=a;
 if(glazingInspect){glazingMotion.to(a,{immediate:true});return;}
 if(balconyFocus){balconyTarget=a;balconyManual=true;balconyMotion.to(a,{immediate:true});return;}
 if(entranceFocus){entranceTarget=a;entranceManual=true;entranceMotion.to(a,{immediate:true});return;}
 if(mode==='roof')roofTarget=a;if(mode==='plinth')plinthTarget=a;
 layerMotion.to(a,{immediate:true});
});
$('dimensions').addEventListener('click',toggleDimensions);
$('rotate-left').addEventListener('click',()=>rotate(-1));$('rotate-right').addEventListener('click',()=>rotate(1));$('zoom-in').addEventListener('click',()=>zoom(.85));$('zoom-out').addEventListener('click',()=>zoom(1.18));$('home-view').addEventListener('click',navigateHome);
$('open-engineering').addEventListener('click',()=>{const d=$('engineering-drawer');d.open=!d.open;(d.open?d:app).scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});});
const engineeringDrawer=$('engineering-drawer');engineeringDrawer.addEventListener('toggle',()=>{$('open-engineering').setAttribute('aria-expanded',String(engineeringDrawer.open));$('open-engineering').textContent=engineeringDrawer.open?'До моделі ↑':'Креслення';});

try{
  // Take the same tiny context reserved before model transport. Allocate
  // scene GPU resources only now, after native CPU assembly.
  rendererStart=takeViewerContext(()=>document.createElement('canvas'));app.dataset.contextAntialias=String(rendererStart.antialias);
  // Closed 0.6mm sheet solids require precision at whole-building distances.
  // EXT_clip_control uses reversed depth without logarithmic fragment-depth
  // writes, which produced visible roof patterns in the projector view.
  // Without that extension use linear depth with a near plane derived from
  // the active camera-clearance volumes. Physical phone proof is separate.
  const {canvas,context,antialias,reversedDepth}=rendererStart;
  renderer=new THREE.WebGLRenderer({canvas,context,antialias,alpha:false,powerPreference:'default',...depthBufferOptions(reversedDepth)});
  // Three may otherwise log a bad linked shader but return from render(),
  // making a black canvas look ready to our loading/recovery state machine.
  renderer.debug.checkShaderErrors=true;
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{throw Error('GPU shader failed: '+[gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n').slice(0,1800));};
  configureRendererBase(renderer,scene);presentationRenderer=createPresentationRenderer(renderer);renderer.setPixelRatio(renderPixelRatio(viewer.clientWidth,viewer.clientHeight,'motion',presentationRenderer.maxPixels));app.dataset.lookdev='daylight base';app.dataset.depthPrecision=renderer.capabilities.reversedDepthBuffer?'reversed':renderer.capabilities.logarithmicDepthBuffer?'logarithmic':'linear';viewer.appendChild(renderer.domElement);
  // Optional HDR must not hold the first usable frame or make 3D unavailable.
  refreshLighting().then(applied=>{if(applied)draw();});
  labelRenderer=new CSS2DRenderer();labelRenderer.domElement.style.cssText='position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden';viewer.appendChild(labelRenderer.domElement);
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Огляд 3D. WASD — рух, Q/E — вниз/вгору, стрілки — зсув, Shift — швидше.');
  controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,4.3,1);controls.enableDamping=false;controls.rotateSpeed=.65;controls.panSpeed=.75;controls.zoomSpeed=.8;controls.minDistance=.3;controls.maxDistance=240;controls.maxPolarAngle=Math.PI*.485;controls.enablePan=true;controls.screenSpacePanning=true;controls.addEventListener('start',stopNavigation);controls.addEventListener('change',()=>{protectCamera();draw();});installCameraKeyboard();
  if(matchMedia('(pointer:fine)').matches)$('gesture-hint').textContent='WASD · Q/E ↕ · стрілки · Shift';
  let panGesture=false;
  $('gesture-mode').addEventListener('click',()=>{panGesture=!panGesture;stopNavigation();controls.touches.ONE=panGesture?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;controls.mouseButtons.LEFT=panGesture?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;$('gesture-mode').dataset.gesture=panGesture?'pan':'rotate';$('gesture-mode').setAttribute('aria-pressed',String(panGesture));$('gesture-mode').setAttribute('aria-label',panGesture?'Перемкнути перетягування на обертання':'Перемкнути перетягування на зсув');app.dataset.gesture=panGesture?'pan':'rotate';});
  for(let i=0;i<facadeLayers.length;i++){const span=document.createElement('span');span.className='layer-pin';span.textContent=`0${i+1}`;const label=new CSS2DObject(span);label.position.set(-.6,1.55,.025);label.center.set(.5,1);layerGroups[i].add(label);label.visible=false;pins.push(label);}
  fit();setMode('building',true);
  let lastWidth=viewer.clientWidth,lastHeight=viewer.clientHeight;new ResizeObserver(()=>{const changed=lastWidth!==viewer.clientWidth||lastHeight!==viewer.clientHeight;lastWidth=viewer.clientWidth;lastHeight=viewer.clientHeight;if(changed)resizeView();}).observe(viewer);
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),tapGesture=createTapGesture();
  function setPickRay(raycaster,coords,activeCamera){
   if(!activeCamera.isOrthographicCamera){raycaster.setFromCamera(coords,activeCamera);return;}
   // Three0.180's ortho Raycaster assumes standard clip depth. The camera
   // plane's actual projected Z works with both standard and reversed depth.
   raycaster.ray.origin.set(coords.x,coords.y,activeCamera.projectionMatrix.elements[14]).unproject(activeCamera);
   raycaster.ray.direction.set(0,0,-1).transformDirection(activeCamera.matrixWorld);raycaster.camera=activeCamera;
  }
  // Bounded DOM-only input receipt: distinguishes an absent event, suppressed
  // gesture and empty ray. It never admits a tap or changes input ownership.
  const pointerDebug=renderer.domElement.dataset||{},pointerEvents=[];
  const tracePointer=(e,detail={})=>{pointerEvents.push({type:e.type,id:e.pointerId,kind:e.pointerType,primary:e.isPrimary,button:e.button,x:e.clientX,y:e.clientY,captured:renderer.domElement.hasPointerCapture?.(e.pointerId),...detail});if(pointerEvents.length>12)pointerEvents.shift();pointerDebug.pointerTrace=JSON.stringify(pointerEvents);};
  renderer.domElement.addEventListener('pointerdown',e=>{tapGesture.down(e);pointerDebug.pointerHits='';tracePointer(e);});
  renderer.domElement.addEventListener('pointermove',e=>{tapGesture.move(e);tracePointer(e);});
  // Capture phase precedes OrbitControls' cancellation/release, so a resulting
  // lostpointercapture cannot forward the same cancellation a second time.
  renderer.domElement.addEventListener('pointercancel',e=>{const owned=tapGesture.cancel(e);tracePointer(e,{owned});},{capture:true});
  renderer.domElement.addEventListener('lostpointercapture',e=>{
    const owned=tapGesture.cancel(e);tracePointer(e,{owned});if(!owned)return;
    renderer.domElement.dispatchEvent(new PointerEvent('pointercancel',{pointerId:e.pointerId,pointerType:e.pointerType}));
  });
  renderer.domElement.addEventListener('pointerup',e=>{
    const eligible=tapGesture.up(e);tracePointer(e,{eligible});if(!eligible)return;
    const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);setPickRay(raycaster,pointer,camera);
    const hits=raycaster.intersectObjects(visiblePickTargets([building,patch,fieldPatch]),false).filter(hit=>{const visual=hit.displayObject||hit.object;if(visual.userData.inspectionContext)return false;let o=visual;while(o){if(!o.visible)return false;o=o.parent;}return true;});
    let hitOwner=hits[0]?.object;while(hitOwner&&!hitOwner.userData?.balconyId)hitOwner=hitOwner.parent;
    pointerDebug.pointerHits=JSON.stringify({count:hits.length,ndc:[pointer.x,pointer.y],first:hits[0]?.object.name||null,balcony:hitOwner?.userData.balconyId||null});
    const roofEdgeHit=hits[0]?nativeRoofEdgeRecord(hits[0]):null;
    if(roofEdgeHit){
     outline(hits[0]);selectedRoofEdge=structuredClone(roofEdgeHit.selection);
     const drawing=selectedRoofEdgeDrawing(selectedRoofEdge),ref=document.createElement('span');ref.className='eyebrow';ref.textContent='КРАЙ ДАХУ';
     const heading=document.createElement('h3');heading.textContent=drawing.title;
     const note=document.createElement('p');note.textContent=`Матеріал ${drawing.dimensionsMm.sourceThickness.toLocaleString('uk-UA')} мм. Відкрий фактичний профіль цієї деталі; примикання й кріплення ще звіряємо.`;
     $('selected-layer').replaceChildren(ref,heading,note);app.dataset.component='roof-edge';return;
    }
    const lathHit=hits[0]?nativeRoofLathRecord(hits[0]):null;
    if(lathHit){
     outline(hits[0]);selectedRoofLath=structuredClone(lathHit.selection);
     const drawing=selectedRoofLathReview(selectedRoofLath),ref=document.createElement('span');ref.className='eyebrow';ref.textContent='ДОШКА ДАХУ';
     const heading=document.createElement('h3');heading.textContent='Лата 32 × 100 мм';
     const note=document.createElement('p');note.textContent=`Осі ${drawing.dimensionsMm.actualAxisPitch.toLocaleString('uk-UA',{maximumFractionDigits:2})} мм; чистий проміжок ${drawing.dimensionsMm.actualClearGap.toLocaleString('uk-UA',{maximumFractionDigits:2})} мм. Відкрий зріз цієї дошки.`;
     $('selected-layer').replaceChildren(ref,heading,note);app.dataset.component='roof-lath';return;
    }
    const guardHit=hits[0]?nativeBalconyGuardRecord(hits[0]):null;
    if(guardHit){
     outline(hits[0]);selectedGuard=structuredClone(guardHit.selection);$('open-selection-drawing').hidden=false;
     const p=selectedGuard.physicalPart,ref=document.createElement('span');ref.className='eyebrow';ref.textContent='БАЛКОННА ПЛИТА';
     const heading=document.createElement('h3');heading.textContent=`${Number((p.width*1000).toFixed(2)).toLocaleString('uk-UA')} × ${Number((p.height*1000).toFixed(2)).toLocaleString('uk-UA')} мм`;
     const note=document.createElement('p');note.textContent=`P070 · 8 мм · ${p.holes.length} отворів Ø8 мм. Відкрий креслення цієї панелі й місце її заготовки на листі.`;
     $('selected-layer').replaceChildren(ref,heading,note);app.dataset.component='balcony-guard-panel';return;
    }
    const returnHit=hits[0]?nativeRetainedReturnRecord(hits[0]):null;
    if(returnHit){
     outline(hits[0]);selectedReturn=structuredClone(returnHit.selection);$('open-selection-drawing').hidden=false;
     const ref=document.createElement('span');ref.className='eyebrow';ref.textContent='ЗБЕРЕЖЕНИЙ ВИСТУП';
     const heading=document.createElement('h3');heading.textContent='Виступ і нижнє примикання';
     const note=document.createElement('p');note.textContent='Відкрий план і зріз цієї конструкції. Нижній пакет, фундамент та обміри ще звіряємо.';
     $('selected-layer').replaceChildren(ref,heading,note);app.dataset.component='retained-wall-return';return;
    }
    const plinthHit=hits[0]?nativePlinthRecord(hits[0]):null;
    if(plinthHit){
     outline(hits[0]);selectedPanel=structuredClone(plinthHit.selection);
     const p=selectedPanel.physicalPart,xs=(p.outer??p.sectionXZ).map(q=>q[0]),ys=p.outer?.map(q=>q[1])??[p.y0,p.y1],mm=n=>Number((n*1000).toFixed(2)).toLocaleString('uk-UA');
     $('open-selection-drawing').hidden=false;
     $('selected-layer').innerHTML=`<span class="eyebrow">${p.sourcePartId} · ЦОКОЛЬ · ВАРІАНТ</span><h3>${mm(Math.max(...xs)-Math.min(...xs))} × ${mm(Math.max(...ys)-Math.min(...ys))} мм</h3><p>Фіброцемент 8 мм · P070. Креслення показує цілу фізичну деталь, включно із зарізами. Отвори й монтаж ще звіряємо.</p>`;
     app.dataset.component='panel';return;
    }
    const openingHit=mode==='building'&&hits[0]?nativeOpeningRecord(hits[0]):null;
    if(openingHit){
     showOpeningSelection(openingHit);return;
    }
    const layerHit=hits[0]?nativeLayerRecord(hits[0]):null;
    if(layerHit){const {system:sys,layer}=layerHit;const next=sys==='roof'?'roof':sys==='plinth'?'plinth':'layers';if((sys==='facade'&&!['layers','detail'].includes(mode))||(sys!=='facade'&&mode!==next))setMode(next,false,null,layer);else selectLayer(layer);}else if(hits[0]){outline(hits[0]);if(glazingInspect&&showGlazingPart(hits[0]))return;const panel=nativePanelRecord(hits[0]);if(panel){selectedPanel=structuredClone(panel);$('open-selection-drawing').hidden=false;dimensionSelection={code:panel.facade,panel};if(dimensionVisible)setDimensions(panel.facade);$('selected-layer').innerHTML=`<span class="eyebrow">${panel.id} · ${panel.colour} · ВАРІАНТ</span><h3>${panel.width} × ${panel.height} мм</h3><p>Фіброцемент 8 мм · шов 8 мм.${panel.drilling?` Отворів: ${panel.drilling.points.length} · Ø8 мм. Відступ 60 мм потребує звірки з DIM 80–100 мм.`:" Кріплення ще звіряємо."}</p>`;app.dataset.component='panel';return;}let o=hits[0].object;const instanceComponent=o.userData.components?.[hits[0].instanceId];while(o&&!o.userData.component)o=o.parent;const guard=nativeBalconyGuardRecord(hits[0]),balcony=guard?null:nativeBalconyRecord(hits[0]);if(guard||balcony||instanceComponent||o?.userData.component){const c=guard?.component||balcony?.component||instanceComponent||o.userData.component;$('selected-layer').innerHTML='';const ref=document.createElement('span');ref.className='eyebrow';ref.textContent=c.source;const heading=document.createElement('h3');heading.textContent=c.title;const note=document.createElement('p');note.textContent=c.kind==='balcony'?(balconyDoorNote(balcony?.id)||c.note):c.note;$('selected-layer').append(ref,heading,note);app.dataset.component=c.kind;}}
  });
  contextRecovery=bindContextRecovery(renderer.domElement,{
   isLost:()=>renderer.getContext().isContextLost(),
   rebuild:async({isCurrent})=>{
    presentationRenderer?.dispose();presentationRenderer=null;
    scene.environment=null;rendererLookdev?.dispose();rendererLookdev=null;
    configureRendererBase(renderer,scene);await refreshLighting(isCurrent);
    if(!isCurrent())return;rendererPrimed=false;invalidateShadows();
   },
   render:({isCurrent})=>isCurrent()?draw(true):false,
   onState:state=>{
    app.dataset.contextState=state;app.dataset.ready=String(state==='ready');$('fallback').hidden=state==='ready';
    if(state!=='ready')renderQuality.suspend();
    if(state==='lost'){app.dataset.contextLosses=String(Number(app.dataset.contextLosses||0)+1);lightingGeneration++;shaderWarmupGeneration++;stopNavigation();}
    if(state==='ready')prepareInspectionShaders();
    $('fallback-title').textContent=state==='restoring'?'Відновлюємо 3D…':state==='lost'?'3D тимчасово призупинено':'Не вдалося відновити 3D';
    $('fallback-note').textContent=state==='restoring'?'Збережений ракурс і розміри повернуться разом зі сценою.':'Ракурс і вибір збережені. Якщо сцена не повернулась, перезавантажте сторінку.';
   },
   onError:error=>console.error('3D context recovery failed',error)
  });
  loadingStage({stage:'frame'});
  if(!await draw())throw Error('Initial 3D frame unavailable');
  $('loading').hidden=true;app.dataset.ready='true';app.dataset.contextState='ready';app.dataset.readyMs=performance.now().toFixed(0);
  prepareInspectionShaders();
}catch(error){showStartupFailure(document,error,'render');console.error('3D initialization failed',error);}

function showGlazingPart(hit){
 const owner=nativeGlazingPartRecord(hit)?.owner;
 if(!owner)return false;const p=owner.userData,g=p.geometry;
 const names={'physical-pane':'Скло','ceramic-spacer':'Керамічна рамка','primary-edge-seal':'Первинне ущільнення','secondary-edge-seal':'Крайовий герметик','mount-gasket':'Ущільнення посадки'};
 if(!g||!names[p.glazingRole])return false;const mm=value=>Number((value*1000).toFixed(2)).toLocaleString('uk-UA');
 const ref=document.createElement('span');ref.className='eyebrow';ref.textContent=p.partId;
 const heading=document.createElement('h3');heading.textContent=names[p.glazingRole]+(p.paneIndex!==null&&p.paneIndex!==undefined?' '+(p.paneIndex+1):'')+' · '+mm(g.depth)+' мм';
 const note=document.createElement('p');note.textContent=mm(g.width)+' × '+mm(g.height)+' мм · показові розміри. Оглядова копія цієї деталі не додає закупівлю.';
 $('selected-layer').replaceChildren(ref,heading,note);app.dataset.component='glazing';return true;
}

// Browser tools reuse the same UI state; no network, project facts or saved data.
if(document.modelContext?.registerTool){
  for(const tool of [{name:'read_facade_demo',title:'Read façade demo',description:'Read the current project-based façade viewer state. Main dimensions and wall layers follow P-8/8/22; small details are approximate.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(){return {project:'Mäe tn 7, Alu',surveyVerified:false,mode,explode:amount,glazingInspection:glazingInspect,glazingSpread,visible:layers.filter((l,i)=>visible[i]).map(l=>l.id),selected:selected<0?null:layers[selected].id,webglReady:app.dataset.ready==='true'};}},{name:'configure_facade_demo',title:'Configure façade demo',description:'Change the same project-based viewer mode and layer spacing exposed in the UI. No project data is saved.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['building','layers','detail','roof','plinth']},explode:{type:'integer',minimum:0,maximum:100}},required:['mode'],additionalProperties:false},execute(input){if(!input||!['building','layers','detail','roof','plinth'].includes(input.mode)||Object.keys(input).some(k=>!['mode','explode'].includes(k))||(input.explode!==undefined&&(!Number.isInteger(input.explode)||input.explode<0||input.explode>100)))throw new Error('Invalid demo configuration');setMode(input.mode,true);if(input.explode!==undefined){pendingMode=null;if(mode==='roof')roofTarget=input.explode;if(mode==='plinth')plinthTarget=input.explode;$('explode').value=input.explode;layerMotion.to(input.explode,{immediate:true});home({immediate:true,finalAmount:input.explode});}return {project:'Mäe tn 7, Alu',surveyVerified:false,mode,explode:amount};}}]){
    try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch{}
  }
}
