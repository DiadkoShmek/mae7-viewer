// Shared facade/inspection plan. PURAL0.6mm,10degrees and30mm projection
// follow ark14. Fold heights,60mm wings and3mm hem are fabrication candidates.
export function planWindowSill({width,frameWidth,frameFront,backY,front=.029,projection=.030,metal=.0006,degrees=10}={}){
 if(![width,frameWidth,frameFront,backY,front,projection,metal,degrees].every(Number.isFinite)||width<=.3||frameWidth<=0||frameWidth>width||projection<=metal||metal<=0||degrees<10||degrees>=45||frameFront>=front)throw Error('Invalid window sill plan');
 const nose=front+projection,span=nose-frameFront,angle=degrees*Math.PI/180,drop=Math.tan(angle)*span,length=Math.hypot(span,drop),wing=0,drip=.012,hem=.003,parts=[];
 const box=(role,size,position,rotation=0)=>parts.push({role,size,position,rotation});
 box('sill',[width,metal,length],[0,backY-drop/2,(frameFront+nose)/2],angle);
 box('sill-upstand',[frameWidth,.020,metal],[0,backY+.010,frameFront+metal/2]);
 box('sill-drip',[width+2*wing,drip,metal],[0,backY-drop-drip/2,nose]);
 box('sill-hem',[width+2*wing,metal,hem],[0,backY-drop-drip+metal/2,nose-hem/2]);
 for(const side of [-1,1]){
  box('sill-end',[metal,.014,length],[side*(width/2-metal/2),backY-drop/2+.007,(frameFront+nose)/2],angle);
 }
 return {parts,nose,angle,drop,backY,sourceFacts:{thicknessMM:metal*1000,minDegrees:10,projectionMM:projection*1000},candidate:{sideWingMM:0,upstandMM:20,endFoldMM:14,dripMM:12,hemMM:3},approved:false,orderedFoldProfile:null};
}
