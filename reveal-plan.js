// Field candidate, explicitly separate from PDF62's PURAL reveal assembly.
// Metres, local facade x/y/z; positive z points towards the exterior.
import {planWindowProfiles} from './facade-window.js';
const canonicalA01=planWindowProfiles({width:1.780,height:1.475,windowType:'A-01'});
export function planRevealCandidate({openingWidth=1.780,openingHeight=1.475,revealDepth=.150,
 faceZ=.029,joint=.008,boardThickness=.008,frameDepth=.090,frameWidth=1.760,frameHeight=canonicalA01.frameH,frameCentreY=canonicalA01.cy,
 rearClearance=.002,sillClearance=.002,sillBackY=frameCentreY-frameHeight/2-.002,sillDegrees=10,metalThickness=.0006,facadeClearance=0}={}){
 const values=[openingWidth,openingHeight,revealDepth,joint,boardThickness,frameDepth,frameWidth,frameHeight,rearClearance,sillClearance,metalThickness];
 if(!values.every(v=>Number.isFinite(v)&&v>0)||![faceZ,frameCentreY,sillBackY].every(Number.isFinite)||sillDegrees<1||sillDegrees>=45||!Number.isFinite(sillDegrees)||!Number.isFinite(facadeClearance)||facadeClearance<0)throw Error('Invalid field reveal dimensions');
 if(revealDepth<.100||revealDepth>.250||revealDepth<=rearClearance||frameWidth>openingWidth||frameHeight>openingHeight)throw Error('Field reveal cannot fit this 100–250mm inspection fragment');
 const frameFront=faceZ-revealDepth,frameBack=frameFront-frameDepth,backZ=frameFront+rearClearance;
 const half=openingWidth/2,top=openingHeight/2,outerX=half+facadeClearance-joint,innerX=outerX-boardThickness;
 const headTop=top+facadeClearance-joint,headBottom=headTop-boardThickness,sideTop=headBottom-joint;
 const tan=Math.tan(sillDegrees*Math.PI/180),plateUpperOffset=metalThickness/(2*Math.cos(sillDegrees*Math.PI/180));
 const bottomAt=z=>sillBackY-tan*(z-frameFront)+plateUpperOffset+sillClearance;
 const backBottom=bottomAt(backZ),frontBottom=bottomAt(faceZ),finishedDepth=faceZ-backZ;
 if(outerX<=joint/2||sideTop<=Math.max(backBottom,frontBottom)||innerX<=0)throw Error('Field reveal part has no positive finished area');
 const sideProfile=[[backBottom,backZ],[sideTop,backZ],[sideTop,faceZ],[frontBottom,faceZ]];
 const parts=[];
 const roundUpMm=v=>Math.ceil((v-1e-10)*1000)/1000;
 const authority={approved:false,measured:false,illustrative:true,source:'User field candidate: Cembrit side/head returns; PDF62 retains PURAL0.6mm source assembly',
  note:'150mm is approximate facade-to-frame input. Stock is a derived cut blank, not a selected manufacturer sheet. Joint8mm is explicit. Head split across width is provisional pending clarification. Supports, fasteners, edge distances, sealing and fire details are not approved.'};
 for(const side of [-1,1]){
  const id=side<0?'FIELD-SIDE-L':'FIELD-SIDE-R',xs=side<0?[-outerX,-innerX]:[innerX,outerX],blankLength=roundUpMm(sideTop-frontBottom),blankBottom=sideTop-blankLength;
  parts.push({id,role:'side-board',material:'Cembrit candidate',...authority,
   geometry:{x:xs,profileYZ:sideProfile.map(p=>[...p])},
   stock:{kind:'minimum rectangular cut blank',length:blankLength,width:revealDepth,thickness:boardThickness,manufacturerSheet:null,kerf:null,
    geometry:{x:xs,profileYZ:[[blankBottom,frameFront],[sideTop,frameFront],[sideTop,faceZ],[blankBottom,faceZ]]}},
   finished:{depth:finishedDepth,heightBack:sideTop-backBottom,heightFront:sideTop-frontBottom,thickness:boardThickness,top:'straight',bottomAngleDegrees:sillDegrees},
   operations:[{id:id+'-DEPTH',kind:'trim rear edge',remove:rearClearance,keep:'z >= rear edge plus clearance'},
    {id:id+'-BOTTOM',kind:'inclined lower cut',angleDegrees:sillDegrees,keep:'above sill clearance line',lineYZ:[[bottomAt(frameFront),frameFront],[frontBottom,faceZ]]}]});
 }
 for(const side of [-1,1]){
  const id=side<0?'FIELD-HEAD-L':'FIELD-HEAD-R',xs=side<0?[-outerX,-joint/2]:[joint/2,outerX],width=xs[1]-xs[0],blankLength=roundUpMm(width),stockX=side<0?[xs[1]-blankLength,xs[1]]:[xs[0],xs[0]+blankLength];
  parts.push({id,role:'head-board',material:'Cembrit candidate',...authority,
   geometry:{x:xs,profileYZ:[[headBottom,backZ],[headTop,backZ],[headTop,faceZ],[headBottom,faceZ]]},
   stock:{kind:'minimum rectangular cut blank',length:blankLength,width:revealDepth,thickness:boardThickness,manufacturerSheet:null,kerf:null,
    geometry:{x:stockX,profileYZ:[[headBottom,frameFront],[headTop,frameFront],[headTop,faceZ],[headBottom,faceZ]]}},
   finished:{width,depth:finishedDepth,thickness:boardThickness},
   operations:[{id:id+'-DEPTH',kind:'trim rear edge',remove:rearClearance},{id:id+'-WIDTH',kind:'square end cut',finishedLength:width}],provisionalLayout:'two adjacent across width'});
 }
 const supports=[];
 for(const side of [-1,1])for(const [index,cy] of [-.450,.450].entries()){
  const xs=side<0?[-outerX-.050,-outerX]:[outerX,outerX+.050];
  supports.push({id:`FIELD-SUPPORT-${side<0?'L':'R'}-${index+1}`,role:'timber-support',...authority,
   x:xs,y:[cy-.025,cy+.025],z:[-.065,-.040],layer:4,
   boardId:side<0?'FIELD-SIDE-L':'FIELD-SIDE-R',
   stock:{kind:'illustrative timber blocking',width:.050,height:.050,depth:.025},
   pitch:null,fasteners:null,structuralCapacity:null,positions:'two illustrative stations per side, not a fixing schedule'});
 }
 for(const part of parts.filter(p=>p.role==='head-board')){
  const cx=(part.geometry.x[0]+part.geometry.x[1])/2;
  supports.push({id:part.id+'-SUPPORT',role:'timber-support',...authority,boardId:part.id,
   x:[cx-.025,cx+.025],y:[headTop,headTop+.050],z:[-.065,-.040],layer:4,
   stock:{kind:'illustrative timber blocking',width:.050,height:.050,depth:.025},pitch:null,fasteners:null,structuralCapacity:null,
   positions:'one illustrative station per head board, not a fixing schedule'});
 }
 return {...authority,mode:'field',opening:{width:openingWidth,height:openingHeight},faceZ,revealDepth,
  frame:{front:frameFront,back:frameBack,width:frameWidth,height:frameHeight,centreY:frameCentreY,depth:frameDepth},
  joint,boardThickness,rearClearance,sillClearance,facadeClearance,sill:{backY:sillBackY,angleDegrees:sillDegrees,metalThickness,plateUpperOffset},
  boundaries:{outerX,innerX,headTop,headBottom,sideTop,backZ},parts,supports,
  joints:[{id:'HEAD-CENTRE',width:joint},{id:'SIDE-L-TO-FACADE',width:joint},{id:'SIDE-R-TO-FACADE',width:joint},
   {id:'HEAD-TO-FACADE',width:joint},{id:'SIDE-L-TO-HEAD',width:joint},{id:'SIDE-R-TO-HEAD',width:joint}],
  operations:parts.flatMap(p=>p.operations.map(o=>({...o,partId:p.id}))),
  disclosure:'Field FC reveal candidate differs from PDF62 PURAL0.6mm reveals; source mode remains available and default.'};
}
