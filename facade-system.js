import {subtractRect} from './engineering.js';
import {layoutFor,initialLayouts} from './facade-layouts.js';
import {planPanelSupportTopology} from './panel-support-topology.js';
import {planUserNineHoleSupports,planPanelFasteners} from './panel-fastener-pattern.js';
import {assertLocalJointDeclaration} from './local-joint-contract.js';
import {timberPartId,planBracketContacts,bracketBatches,pocketBatch} from './bracket-contact.js';
import {planRainwaterDetails} from './rainwater-details.js';
import {planJointBackings,createJointBackings} from './joint-backings.js';

// Parent coordinates are the facade's coordinates, in metres. The cladding
// inner face is +.021; nominal layers terminate there without moving windows.
export const facadeLayerSpec=[
 {id:'base',z:-.435,thickness:.22,source:'§4.1; товщина існуючої стіни умовна'},
 {id:'anchors',z:-.215,thickness:.15,source:'VS-2; показові кронштейни 150×150×60×2,5 мм'},
 {id:'wool100',z:-.215,thickness:.1,source:'VS-2; вата 100 мм'},
 {id:'vertical50',z:-.115,thickness:.05,source:'VS-2; брус 50×50 мм, номінал 600 мм'},
 {id:'horizontal50',z:-.065,thickness:.05,source:'VS-2; перехресний брус 50×50 мм, номінал 600 мм'},
 {id:'windboard',z:-.015,thickness:.009,source:'VS-2; вітрогіпс 9 мм'},
 {id:'battens',z:-.006,thickness:.025,source:'VS-2; рейка 25×100 мм, номінал 420 мм'},
 {id:'epdm',z:.019,thickness:.002,source:'Системна стрічка; товщина 2 мм показова'}
];

const intersection=(a,b)=>{
 const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),top=Math.min(a.y+a.height,b.y+b.height);
 return right>x&&top>y?{x,y,width:right-x,height:top-y}:null;
};
function cutOpenings(rectangles,openings){
 for(const hole of openings)rectangles=rectangles.flatMap(rect=>subtractRect(rect,hole));
 return rectangles;
}
function intervals(length,step,width){
 const result=[];let cursor=0;
 for(let centre=0;centre-width/2<length;centre+=step){
  const low=Math.max(0,centre-width/2),high=Math.min(length,centre+width/2);
  if(low>cursor)result.push({low:cursor,high:low,timber:false});
  if(high>low)result.push({low,high,timber:true});
  cursor=high;
 }
 if(cursor<length)result.push({low:cursor,high:length,timber:false});
 return result;
}
function partition(wall,width,height,axis,step,timberWidth){
 const timber=[],fill=[];
 for(const strip of intervals(axis==='x'?width:height,step,timberWidth)){
  const band=axis==='x'?{x:strip.low,y:0,width:strip.high-strip.low,height}:{x:0,y:strip.low,width,height:strip.high-strip.low};
  for(const rect of wall){const piece=intersection(rect,band);if(piece)(strip.timber?timber:fill).push(piece);}
 }
 return {timber,fill};
}
function panelSupportAxes(cuts){
 const axes=[cuts[0]],bays=[];
 for(let i=1;i<cuts.length;i++){
  const from=cuts[i-1],to=cuts[i],count=Math.ceil((to-from)/420),step=(to-from)/count;
  if(step<100)throw Error(`Candidate support axes are less than 100 mm apart (${from}..${to}: ${step} mm); 100 mm timber would overlap`);
  bays.push({from,to,count,step});
  for(let n=1;n<=count;n++)axes.push(n===count?to:from+n*step);
 }
 return {axes,bays};
}
function timberAtAxes(wall,width,height,axes,timberWidth){
 const rectangles=[];
 for(const centre of axes){
  const low=Math.max(0,centre-timberWidth/2),high=Math.min(width,centre+timberWidth/2);
  const strip={x:low,y:0,width:high-low,height};
  for(const rect of wall){const piece=intersection(rect,strip);if(piece)rectangles.push(piece);}
 }
 return rectangles;
}

// §5.5 specifies horizontal50×200 timber at downpipe clamp positions. The
// source gives no lengths/anchors. Fit one whole candidate between openings,
// retaining at least the60mm wallplate footprint and a primary timber contact.
// It replaces material in layer4; it never sits on top of the insulation.
export function planRainwaterBackings(code,{width,height,openings},verticalTimber){
 const parts=[],omissions=[];
 if(!['SE','NW'].includes(code))return {parts,omissions,approved:false};
 const source=planRainwaterDetails(),s=code==='SE'?1:-1;
 for(const pipe of source.pipes.filter(p=>p.s===s))for(const clamp of pipe.clamps){
  const x=s*pipe.x*1000+width/2,y=clamp.position[1]*1000-100,id=clamp.id+'-BACKING';
  if(pipe.retainedWallReturnId){
   omissions.push({id,clampId:clamp.id,retainedWallReturnId:pipe.retainedWallReturnId,reason:'NW pipe mounts on retained return, not VS-2 mainwall; return50x200 backing and anchors unresolved',approved:false});
   continue;
  }
  let intervals=[[0,width]];
  for(const o of openings){
   if(o.y>=y+200-1e-8||o.y+o.height<=y+1e-8)continue;
   intervals=intervals.flatMap(([a,b])=>o.x>=b||o.x+o.width<=a?[[a,b]]:[[a,Math.max(a,o.x)],[Math.min(b,o.x+o.width),b]].filter(([a,b])=>b-a>1e-8));
  }
  const interval=intervals.find(([a,b])=>x-30>=a-1e-8&&x+30<=b+1e-8);
  if(y<0||y+200>height||!interval){omissions.push({id,clampId:clamp.id,reason:'whole200mm backing or60mm clamp footprint crosses a boundary/opening',approved:false});continue;}
  const [a,b]=interval,length=Math.min(600,b-a),left=Math.max(a,Math.min(b-length,x-length/2)),rectangle={x:left,y,width:length,height:200};
  const bearingTimberIds=verticalTimber.filter(r=>r.y<=y+1e-8&&r.y+r.height>=y+200-1e-8&&Math.min(left+length,r.x+r.width)-Math.max(left,r.x)>1e-8).map(r=>r.partId);
  if(!bearingTimberIds.length){omissions.push({id,clampId:clamp.id,reason:'no full-height contact with primary vertical50 timber',approved:false});continue;}
  parts.push({...rectangle,partId:id,clampId:clamp.id,facade:code,bearingTimberIds,sectionMM:[50,200],layer:'horizontal50',depth:.05,
   source:'§5.5 horizontal50x200 backing',candidateLengthMM:length,lengthAuthority:'geometry fit, not written stock length',anchors:null,approved:false});
 }
 return {parts,omissions,source:'§5.5',approved:false};
}

// Pure geometry plan, kept in integer millimetres for repeatable opening cuts.
// No support approval is implied by this nominal, regular demonstration grid.
export function planFacadeSystem(code,options={}){
 const supportAlignment=options.supportAlignment??'source-420';
 if(!['source-420','panel-joints','user-nine-hole'].includes(supportAlignment))throw Error('Unknown support alignment');
 const layout=options.layout??layoutFor(code,{...initialLayouts[code],...options});
 assertLocalJointDeclaration(layout);
 const {width,height,openings}=layout;
 const wall=cutOpenings([{x:0,y:0,width,height}],openings);
 const existingWall=cutOpenings([{x:0,y:0,width,height}],openings.filter(o=>o.physicalOpening!==false));
 const vertical=partition(wall,width,height,'x',600,50);
 vertical.timber=vertical.timber.map(r=>({...r,partId:timberPartId(code,r)}));
 const horizontal=partition(wall,width,height,'y',600,50);
 const cornerTimber=cutOpenings([{x:0,y:0,width:150,height},{x:width-150,y:0,width:150,height}],openings)
  .map((r,i)=>({...r,partId:code+'-CORNER-50X150-'+String(i+1).padStart(2,'0'),sectionMM:[50,150],source:'ark08 vertical50x150 corner support'}));
 for(const p of cornerTimber){horizontal.timber=horizontal.timber.flatMap(r=>subtractRect(r,p));horizontal.fill=horizontal.fill.flatMap(r=>subtractRect(r,p));}
 horizontal.timber.push(...cornerTimber);
 const backings=planRainwaterBackings(code,layout,vertical.timber);
 for(const p of backings.parts){
  horizontal.timber=horizontal.timber.flatMap(r=>subtractRect(r,p).map(piece=>({...r,...piece})));
  horizontal.fill=horizontal.fill.flatMap(r=>subtractRect(r,p));
 }
 horizontal.timber.push(...backings.parts);
 const userPattern=supportAlignment==='user-nine-hole',candidate=supportAlignment!=='source-420';
 const topology=userPattern?planUserNineHoleSupports(layout):candidate&&layout.localJointTopology?planPanelSupportTopology(layout):null;
 const aligned=candidate&&!topology?panelSupportAxes(layout.cuts):null;
 const axes=aligned?.axes||Array.from({length:Math.ceil((width+50)/420)},(_,i)=>i*420);
 const support=topology?.support??{alignment:supportAlignment,candidate,valid:true,axes,bays:aligned?.bays||[],seamAxes:candidate?[...layout.cuts]:[],sourcePitch:420,
  phase:candidate?'per-panel-span':0,seamPhases:candidate?layout.cuts.map(axis=>({axis,deltaFromSource420:axis-Math.round(axis/420)*420})):[],
  maximumBay:candidate?Math.max(...aligned.bays.map(b=>b.step)):420,
  note:candidate?'Геометрична прив’язка рейок до швів; зміну 420 мм треба погодити. Опори біля прорізів і продовження на фронтон потребують робочого вузла.':'Номінал 420 мм; локальні опори біля прорізів потребують робочого вузла',approved:false};
 const battens=topology?.battens??(candidate?timberAtAxes(wall,width,height,axes,100):partition(wall,width,height,'x',420,100).timber);
 const tape=topology?.tape??(candidate?timberAtAxes(wall,width,height,axes,90):partition(wall,width,height,'x',420,90).timber);
 const brackets=planBracketContacts({facade:code,width,height,openings,timber:vertical.timber});
 const batch=(kind,rectangles,depth,z=0)=>({kind,rectangles,depth,z});
 const batches=[
  [batch('base',existingWall,.22)],
  bracketBatches(brackets),
  [batch('wool',wall,.1)],
  [batch('wood',vertical.timber,.05),batch('wool',vertical.fill,.05)],
  [batch('wood',horizontal.timber,.05),batch('wool',horizontal.fill,.05)],
  [batch('wind',wall,.009)],
  [batch('wood',battens,.025)],
  [batch('tape',tape,.002)]
 ];
 for(const i of [2,3,4])batches[i]=batches[i].flatMap(b=>pocketBatch(b,facadeLayerSpec[i].z,brackets.parts));
 return {facade:code,width,height,openings,support,brackets,backings,...(userPattern?{fasteners:planPanelFasteners(layout,{supports:topology})}:{}),layers:facadeLayerSpec.map((spec,i)=>({...spec,index:i,batches:batches[i],...(candidate&&i>=6?{source:'VS-2 · '+support.note}:{})})),approved:false,scope:layout.scope};
}

export function createFacadeSystem(THREE,parent,code,options={}){
 const layerIndices=options.layerIndices??facadeLayerSpec.map((_,i)=>i);
 if(!Array.isArray(layerIndices)||layerIndices.some(i=>!Number.isInteger(i)||i<0||i>=facadeLayerSpec.length)||new Set(layerIndices).size!==layerIndices.length)throw Error('Invalid facade layer indices');
 const renderedLayers=new Set(layerIndices);
 const plan=planFacadeSystem(code,options),groups=[],materials=new Map(),textures=[];
 const geometry=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
 const colours={base:'#9b8f7b',steel:'#75828b',wool:'#bcad71',wood:'#b89566',wind:'#c6cfbb',tape:'#333b3e'};
 function material(kind){
  if(materials.has(kind))return materials.get(kind);
  const m=new THREE.MeshStandardMaterial({color:colours[kind],roughness:kind==='steel'?.38:.9,metalness:kind==='steel'?.65:0});
  if(kind==='base'){m.name='base';m.userData.finishAuthority='Illustrative weathered plaster guided by supplied building photographs; not a site scan';}
  if(['base','wool','wood','wind'].includes(kind)){
   const size=64,data=new Uint8Array(size*size*4);let seed=83;
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grain=kind==='wood'?18*Math.sin(x*.8+Math.sin(y*.14)):0;
    const v=Math.round(165+grain+(seed/4294967296)*55),i=(y*size+x)*4;
    data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
   }
   const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
   texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
   m.bumpMap=texture;m.bumpScale=kind==='wood'?.0016:.0008;textures.push(texture);
  }
  materials.set(kind,m);return m;
 }
 for(const layer of plan.layers){
  const group=new THREE.Group();group.position.z=layer.z;group.visible=false;
  group.userData={facade:code,layer:layer.index,system:'facade',nominalZ:layer.z,source:layer.source,approved:false,
   nominalBounds:{min:[-plan.width/2000,0,layer.z-(layer.index===1?.0025:0)],max:[plan.width/2000,plan.height/1000,layer.z+layer.thickness]}};
  if(layer.index===6||layer.index===7)group.userData.support=plan.support;
  if(layer.index===1)group.userData.brackets={parts:plan.brackets.parts.length,omissions:plan.brackets.omissions,orientation:plan.brackets.parts[0]?.orientation,spec:plan.brackets.spec,approved:false};
  parent.add(group);groups.push(group);
  if(!renderedLayers.has(layer.index))continue;
  for(const batch of layer.batches){
   if(!batch.rectangles.length)continue;
   const mesh=new THREE.InstancedMesh(geometry,material(batch.kind),batch.rectangles.length);
   batch.rectangles.forEach((r,i)=>{
    dummy.position.set((r.x+r.width/2)/1000-plan.width/2000,(r.y+r.height/2)/1000,batch.z+batch.depth/2);
    dummy.scale.set(r.width/1000,r.height/1000,batch.depth);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   });
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
   mesh.castShadow=false;mesh.receiveShadow=true;
   mesh.userData={facade:code,layer:layer.index,system:'facade',materialKind:batch.kind,source:layer.source,approved:false,illustrative:layer.index===0||layer.index===1||layer.index===7};
   if(batch.rectangles.some(r=>r.partId))mesh.userData.components=batch.rectangles.map(r=>({partId:r.partId,sourcePartId:r.partId,kind:r.clampId?'rainwater-backing':r.bracketRecord?'facade-bracket':'facade-timber',title:r.clampId?'Опорний брус під водостік ·50×200мм':r.partId,pairedTimberId:r.pairedTimberId,solidRole:r.solidRole,...(r.clampId?{clampId:r.clampId,bearingTimberIds:r.bearingTimberIds,sectionMM:r.sectionMM,candidateLengthMM:r.candidateLengthMM,lengthAuthority:r.lengthAuthority,anchors:null,source:r.source}:{}),...(r.bracketRecord?{contact:r.bracketRecord.contact,pairedTimberBounds:r.bracketRecord.pairedTimberBounds,orientation:r.bracketRecord.orientation,sourceDimensions:r.bracketRecord.sourceDimensions}:{}),approved:false}));
   if(layer.index===1)mesh.userData.supportStatus='Показові положення; схема анкерів і несуча здатність не підтверджені';
   if(layer.index===6||layer.index===7){mesh.userData.supportStatus=plan.support.note;mesh.userData.supportAlignment=plan.support.alignment;}
   group.add(mesh);
  }
 }
 const jointBackings=renderedLayers.has(7)?createJointBackings(THREE,groups[7],planJointBackings((options.layout??layoutFor(code,{...initialLayouts[code],...options})).parts,{openings:plan.openings,bounds:{x:0,y:0,width:plan.width,height:plan.height}}),{originX:plan.width/2000,z:.002,name:code+'-black-joint-backing'}):null;
 let disposed=false,enabled=false,explode=0,visible=Array(8).fill(true);
 return {
  groups,support:plan.support,backings:plan.backings,...(plan.fasteners?{fasteners:plan.fasteners}:{}),layerIndices:[...renderedLayers],
  setState(state={}){
   if(disposed)return;
   if(state.enabled!==undefined)enabled=!!state.enabled;
   if(state.visible!==undefined)visible=Array.from({length:8},(_,i)=>state.visible[i]!==false);
   if(state.explode!==undefined)explode=Number.isFinite(state.explode)?Math.max(0,state.explode):0;
   groups.forEach((group,i)=>{group.visible=enabled&&visible[i];group.position.z=facadeLayerSpec[i].z+i*.24*explode;});
  },
  dispose(){
   if(disposed)return;disposed=true;
   for(const group of groups){group.removeFromParent();for(const mesh of group.children)mesh.dispose();group.clear();}
   geometry.dispose();for(const m of materials.values())m.dispose();for(const texture of textures)texture.dispose();
   if(jointBackings){jointBackings.geometry.dispose();jointBackings.material.dispose();}
  }
 };
}
