import {makeLayout,floorLevels,seOpenings} from './engineering.js';
import {northwestOpenings} from './northwest-openings.js';
import {roofExteriorTop} from './roof-geometry.js';
import {balconyOpenings} from './balcony-openings.js';
import {commonRowPlan,bottomUpRowPlan} from './panel-row-plans.js';
import {visualPanelLayout} from './visual-panel-layout.js';
import {southeastColourRegions} from './facade-colour-regions.js';
import {retainedReturnFacadeExclusions} from './balcony-returns.js';
import {colourAlignedColumns} from './colour-aligned-columns.js';
import {endWallSpec,endWallFrame,clipEndWall} from './end-wall-plan.js';

const hole=(o,width)=>({id:o.id,x:Math.round((o.x+width/2000-o.width/2)*1000),y:Math.round((o.y-o.height/2)*1000),width:Math.round(o.width*1000),height:Math.round(o.height*1000),kind:o.type||'проріз',positionStatus:'PDF-вектор',dimensionSource:o.source||o.dimensionSource});
const nw=[...northwestOpenings,...balconyOpenings.flatMap(b=>[{...b.door,id:b.id+'-D',type:'A03/A04 двері',source:b.source},{...b.window,id:b.id+'-W',type:'A03/A04 вікно',source:b.source}])].map(o=>hole(o,40400));
// End wall window positions calibrated from sheet06 vector rectangles.
// Written A02 dimensions win over plotted outlines; body depth needs survey.
export const endWindows={SW:[2.107,4.948,7.787].map((y,i)=>({id:'SW-A02-'+(i+1),x:1.176,y,width:1.5,height:1.475,type:'A02',source:'арк06/PDF54-вектор; A02 1500×1475'})),NE:[2.107,4.948,7.787].map((y,i)=>({id:'NE-A02-'+(i+1),x:-1.181,y,width:1.5,height:1.475,type:'A02',source:'арк06/PDF54-вектор; A02 1500×1475'}))};
// Clearance is controlled by the OUTER face of the 8 mm board, not its
// centre plane. The inclined underside falls through that last 4 mm too.
const frontHeight=Math.floor(roofExteriorTop(5.649)*1000);
const backHeight=Math.floor(roofExteriorTop(-5.649)*1000);
const endHeight=Math.ceil(roofExteriorTop(0)*1000);
const endHoles=code=>[...endWindows[code].map(o=>({...hole(o,endWallSpec.widthMM),x:Math.round((o.x+endWallFrame(code).originMM/1000-o.width/2)*1000)})),code==='SW'?{id:'SW-A08-01',x:Math.round(endWallFrame(code).originMM-29-250),y:9720,width:500,height:800,kind:'A08'}:{id:'NE-VENT',x:Math.round(endWallFrame(code).originMM-400),y:9720,width:800,height:400,kind:'vent'}];
export const facades={
 SE:{colourRegions:southeastColourRegions,title:'ПдСх · входи',width:40400,height:frontHeight,levels:[...floorLevels,frontHeight],openings:seOpenings,scope:'ПдСх: головна стіна до графічно відновленого карниза PP-1; висота кандидат до звірки. 45 вікон за PDF/специфікацією; отвори за тамбурами приблизні. Без цоколя, відкосів, тамбурів.'},
 NW:{title:'ПнЗх · балкони',width:40400,height:backHeight,levels:[...floorLevels,backHeight],openings:[...nw,...retainedReturnFacadeExclusions(backHeight)],accentBands:[],scope:'ПнЗх: головна стіна до графічно відновленого карниза PP-1; висота кандидат до звірки. 18 A01 + 18 асиметричних пар A03/A04; чотири збережені стінові виступи виключені з нового плаского200мм стека. Без облицювання балконів, цоколя й відкосів.'},
 SW:{title:'ПдЗх · торець',width:endWallSpec.widthMM,height:endHeight,levels:[...floorLevels,endHeight],openings:endHoles('SW'),accentBands:[],scope:'Повний гладкий торець 11885мм разом із збереженим виступом, єдина сітка до покрівлі. Арк06; розбіжність5мм із планом та фактичні прив’язки до обміру.'},
 NE:{title:'ПнСх · торець',width:endWallSpec.widthMM,height:endHeight,levels:[...floorLevels,endHeight],openings:endHoles('NE'),accentBands:[],scope:'Повний гладкий торець 11885мм разом із збереженим виступом, єдина сітка до покрівлі. Арк06; розбіжність5мм із планом та фактичні прив’язки до обміру.'}
};
export function layoutFor(facade='SE',options={}){
 if(!facades[facade])throw Error('Unknown facade');
 const standardE=options.module===1200&&options.panelHeight===1250&&(options.joint??8)===8;
 const input={...facades[facade],...options,facade};
 // Ark05's dark stair bands terminate at the eave, not at the attic datum.
 // Retain the traced colour coordinates; reconcile their top with PP-1's
 // actual exterior clearance plane instead of inventing a pale cap course.
 if(facade==='SE')input.colourRegions=input.colourRegions.map(r=>({...r,tracedTopMM:r.y+r.height,height:input.height-r.y,topBoundary:'facade-eave',topAuthority:'ark05 continuous dark band to eave; height reconciled with PP-1'}));
 if(options.cutPolicy!==undefined&&!['split','notched-study'].includes(options.cutPolicy))throw Error('Unknown visual panel policy');
 if(options.cutPolicy==='notched-study')input.localJoints='none';
 if(facade==='SE'&&standardE&&options.cutPolicy==='notched-study'&&(options.offset??0)===0&&input.columnCuts===undefined)input.columnCuts=colourAlignedColumns(input).cuts;
 if(standardE){if(input.rowLevels===undefined)input.rowLevels=(options.cutPolicy==='notched-study'||['SW','NE'].includes(facade)?bottomUpRowPlan(input.height):commonRowPlan(input.height)).rowLevels;if(input.rectanglePartition===undefined)input.rectanglePartition='best';if(input.rectanglePartition==='best'&&input.localJoints===undefined)input.localJoints='best';}
 const layout=makeLayout(input),visible=options.cutPolicy==='notched-study'?visualPanelLayout(layout):layout;
 return ['SW','NE'].includes(facade)?clipEndWall(visible):visible;
}
// Each local X axis reads left to right when standing outside its facade.
// The human's mounting candidate starts with a finished1192×1250 board, then8mm joints;
// the sole grid remainder is at the right. Opening conflicts stay explicit.
// Stock labels, corner clearances and the changed420 support phase need review.
export const initialLayouts=Object.fromEntries(Object.keys(facades).map(code=>[code,{module:1200,offset:0,panelHeight:1250,rowLevels:(['SW','NE'].includes(code)?bottomUpRowPlan:commonRowPlan)(facades[code].height).rowLevels,rectanglePartition:'best',localJoints:'best'}]));
// Separate visual authoring default; V21 engineering reports retain split parts.
export const initialVisualLayouts=Object.fromEntries(Object.entries(initialLayouts).map(([code,options])=>[code,{...options,rowLevels:bottomUpRowPlan(facades[code].height).rowLevels,cutPolicy:'notched-study',localJoints:'none'}]));
