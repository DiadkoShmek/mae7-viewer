// P-8/8/22 ark25/PDF73, ark26/PDF74 and §5.7. Dimensions are
// gross outside-view dimensions. Supplier sections and clear sizes are unknown.
export const sourceWindowSchedule=Object.freeze({
 'A-01':{width:1.780,height:1.475,count:36,fields:2,subdivisions:[.510,1.270],sheet:25,pdf:73,use:'apartment'},
 'A-02':{width:1.500,height:1.475,count:6,fields:2,subdivisions:[.510,.990],sheet:25,pdf:73,use:'apartment'},
 'A-03':{width:2.530,height:2.200,count:9,fields:null,sheet:25,pdf:73,use:'balcony-combined',doorSide:'right'},
 'A-04':{width:2.530,height:2.200,count:9,fields:null,sheet:25,pdf:73,use:'balcony-combined',doorSide:'left'},
 'A-05':{width:.400,height:.800,count:18,fields:1,sheet:25,pdf:73,use:'aboveground-window',roomFunction:null},
 'A-06':{width:2.160,height:.800,count:3,fields:2,sheet:26,pdf:74,use:'stair',smokeMotorVoltage:24},
 'A-06-1':{width:2.160,height:.800,count:3,fields:2,sheet:26,pdf:74,use:'stair'},
 'A-07':{width:2.160,height:.565,count:3,fields:2,sheet:26,pdf:74,use:'basement-label',disputed:true},
 'A-08':{width:.500,height:.800,count:1,fields:1,sheet:26,pdf:74,use:'attic'}
});
export const normalizeWindowType=type=>typeof type==='string'?type.replace(/^A(?=\d)/,'A-'):null;
const middle=new Set(['SE-W25','SE-W26','SE-W27']);
const upper=new Set(['SE-W19','SE-W21','SE-W23']);
export function resolveWindowSchedule({windowId,windowType,type,width,height,assemblyId,componentRole}={}){
 const declaredSourceType=normalizeWindowType(windowType??type);
 let boundType=declaredSourceType,bindingOverride=null;
 if(declaredSourceType==='A-06'&&middle.has(windowId)){
  boundType='A-06-1';bindingOverride={declaredSourceType,boundType,reason:'Current source aperture array labels all six A06; ark26 qty3+3 and §5.7 top-stair smoke motor bind middle SE-W25/26/27 to A06-1. Placement interpretation, verify on site.'};
 }
 const row=sourceWindowSchedule[boundType];
 const combined=!!row?.doorSide;
 const expected=combined?(componentRole==='window'?{width:1.810,height:1.475,fields:1,operability:'fixed'}:componentRole==='door'?{width:.720,height:2.200,fields:1,operability:'operable'}:null):row;
 const confirmed=!!row&&!row.excluded&&!!expected&&(!combined||!!assemblyId)&&Math.abs(width-expected.width)<1e-9&&Math.abs(height-expected.height)<1e-9;
 const sourceConflict=row?.disputed?'Ark26 calls A07 a basement window; §5.7 retains basement windows; model SE-W20/22/24 is above ground. Physical type candidate shown, replacement/order inventory withheld.':null;
 const compositionAuthority=row?.disputed?'disputed source candidate':confirmed?'source triple fact; exact composition candidate':'unknown';
 const sourceFacts=confirmed?{type:boundType,declaredSourceType,outsideView:true,grossWidth:row.width,grossHeight:row.height,sourceCount:row.count,
  grossSubdivisions:row.subdivisions??null,fields:expected.fields,divisionDimensionsKnown:!!row.subdivisions||expected.fields===1,
  componentRole:combined?componentRole:null,componentGrossWidth:width,componentGrossHeight:height,doorSide:row.doorSide??null,
  operability:combined?expected.operability:'operable divisions per §5.7; direction unknown',
  exteriorFinish:'dark grey',interiorFinish:'white',finishSource:`арк${row.sheet}/PDF${row.pdf}`,paneCount:row.disputed?null:3,spacerMaterial:row.disputed?null:'ceramic per §5.7',
  depictionPaneCount:3,depictionSpacerMaterial:'ceramic',compositionAuthority,sourceConflict,
  smokeMotorVoltage:boundType==='A-06'?24:null,smokeMotorBinding:boundType==='A-06'?(upper.has(windowId)?'top stair source placement interpretation':'type fact; exact opening binding unverified'):null}:{};
 return {confirmed,boundType,declaredSourceType,bindingOverride,sourceFacts,fields:confirmed?expected.fields:null,
  fixed:confirmed&&combined&&componentRole==='window',assemblyId:combined?assemblyId:null,componentRole:combined?componentRole:null,
  quantityKey:confirmed?(assemblyId??windowId):null,quantityUnits:'window assembly',quantityRule:'unique quantityKey; component/profile/crop copies are not extra purchased windows',
  replacementStatus:row?.excluded?'pending-replacement-classification':row?.disputed?'disputed':confirmed?'source-scheduled':'unknown',
  quantityEligible:confirmed&&!row.disputed,source:row?`P-8/8/22 · арк${row.sheet} / PDF${row.pdf}; §5.7`:null,
  conflict:sourceConflict,sourceConflict,compositionAuthority,
  candidate:confirmed?{profile:'70×90mm frame;35mm sash; rebate/mount/clear sizes unknown',composition:'4/10/4/10/4mm; ordered composition unknown',division:row.subdivisions?'source gross division, candidate rebates':expected.fields===2?'central mullion from schematic; equal gross fields are a candidate':'single field from schematic',openingDirection:null,hardware:null,approved:false}:null};
}
