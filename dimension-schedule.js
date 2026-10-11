import {floorLevels} from './engineering.js';
import {roofSpec} from './roof-geometry.js';
import {facades} from './facade-layouts.js';

// Façade-local metres, with separate written/graphic/model authority. A source
// list remains complete when the chosen overlay or viewport hides a label.
export function dimensionSchedule(code,{panel=null,opening=null}={}){
 const face=facades[code];if(!face)throw Error('Unknown dimension facade');
 const half=face.width/2000,dimensions=[],mm=n=>Math.round(n).toLocaleString('uk-UA')+' мм';
 const level=n=>(n>=0?'+':'−')+(Math.abs(n)/1000).toFixed(3).replace('.',',');
 const add=(a,b,text,source,options={})=>dimensions.push({id:code+'-DIM-'+(dimensions.length+1),a,b,text,source,group:'general',authority:'written',...options});
 add([-half,-1.05],[half,-1.05],mm(face.width),'facade-owner:width',{name:'Ширина фасаду',role:'facade-width'});
 add([half+2.15,0],[half+2.15,roofSpec.ridge],mm(roofSpec.ridge*1000),'PP-1:ridge',{name:'До коника від ±0,000',role:'ridge-height',labelAt:[half+2.15,roofSpec.ridge+.45],align:1});
 add([-half-1.15,roofSpec.attic],[-half-1.15,roofSpec.ridge],mm((roofSpec.ridge-roofSpec.attic)*1000),'PP-1:ridge-attic-difference',{name:'Горище → коник',role:'attic-roof-height'});
 add([-half-.55,0],[-half-.55,face.height/1000],mm(face.height),'facade-owner:graphic-height',{name:'Висота основної стіни',role:'facade-height',authority:'graphic'});
 for(let i=1;i<floorLevels.length;i++)
  add([half+.85,floorLevels[i-1]/1000],[half+.85,floorLevels[i]/1000],mm(floorLevels[i]-floorLevels[i-1]),'PP-1:floor-levels',{name:'Поверх '+i,group:'levels',role:'floor-height'});
 for(const [i,y] of floorLevels.entries())
  add([-half-.35,y/1000],[-half+.35,y/1000],level(y),'PP-1:floor-datums',{name:i===3?'Горищне перекриття':i===0?'Нуль проєкту':'Рівень '+(i+1)+' поверху',group:'levels',role:'floor-datum',labelAt:[-half-.35,y/1000+.12],align:0});
 const locate=(x,y,w,h,source,prefix,id,authority='graphic')=>{
  if(x>=-half&&x+w<=half+1e-8){
   if(x>-half)add([-half,y-.5],[x,y-.5],mm((x+half)*1000),source,{detail:true,group:'detail',authority,name:'Від лівого краю фасаду',role:prefix+'-left-setback',openingId:id});
   if(x+w<half)add([x+w,y-.5],[half,y-.5],mm((half-x-w)*1000),source,{detail:true,group:'detail',authority,name:'До правого краю фасаду',role:prefix+'-right-setback',openingId:id});
  }
 };
 if(panel){
  if(panel.facade!==code||![panel.x,panel.y,panel.width,panel.height].every(Number.isFinite)||panel.width<=0||panel.height<=0)throw Error('Unbound panel dimension');
  const x=panel.x/1000-half,y=panel.y/1000,w=panel.width/1000,h=panel.height/1000;
  add([x,y-.17],[x+w,y-.17],mm(panel.width),'selected-panel:source-bounds',{detail:true,group:'detail',authority:'model',name:'Ширина вибраної плити',role:'panel-width'});
  add([x+w+.17,y],[x+w+.17,y+h],mm(panel.height),'selected-panel:source-bounds',{detail:true,group:'detail',authority:'model',name:'Висота вибраної плити',role:'panel-height'});
  locate(x,y,w,h,'selected-panel:source-bounds','panel',undefined,'model');
  for(const [name,v] of [['Низ плити',y],['Верх плити',y+h]])add([x-.6,v],[x-.08,v],level(v*1000),'selected-panel:source-bounds',{detail:true,group:'detail',authority:'model',name,role:name==='Низ плити'?'panel-sill-level':'panel-head-level',labelAt:[x-.65,v],align:1});
 }
 if(opening){
  const source=face.openings.find(o=>o.id===opening.id);if(!source)throw Error('Unbound opening dimension');
  const x=source.x/1000-half,y=source.y/1000,w=source.width/1000,h=source.height/1000,provenance=source.dimensionSource??source.positionStatus;
  add([x,y-.2],[x+w,y-.2],mm(source.width),provenance,{detail:true,group:'detail',name:'Ширина прорізу',role:'opening-width',openingId:source.id});
  add([x+w+.2,y],[x+w+.2,y+h],mm(source.height),provenance,{detail:true,group:'detail',name:'Висота прорізу',role:'opening-height',openingId:source.id});
  add([x-.6,y],[x-.08,y],'Низ '+level(source.y),provenance,{detail:true,group:'detail',authority:'graphic',name:'Низ прорізу',role:'opening-sill-level',openingId:source.id,labelAt:[x-.65,y],align:1});
  add([x-.6,y+h],[x-.08,y+h],'Верх '+level(source.y+source.height),provenance,{detail:true,group:'detail',authority:'graphic',name:'Верх прорізу',role:'opening-head-level',openingId:source.id,labelAt:[x-.65,y+h],align:1});
  locate(x,y,w,h,provenance,'opening',source.id);
 }
 return dimensions;
}
