// Retained aperture candidates, not a replacement-window specification.
// PDF53/ark05 outer vectors; written retained status PDF5 and §5.7/PDF23.
const scale=40.4/(1033.26-269.82),centre=651.54;
const vectors={SE:[[287.10,320.76],[481.14,514.80],[537.48,571.08],[730.26,763.92],[786.54,820.20],[986.88,1020.54]],NW:[[359.40,393.00],[417.42,451.02],[607.32,640.98],[665.34,699.00],[854.88,888.54],[912.90,946.56]]};
export const basementOpenings=Object.freeze(Object.entries(vectors).flatMap(([face,rows])=>rows.map(([left,right],i)=>{
 const top=face==='SE'?293.06:608.06,bottom=face==='SE'?304.22:619.22;
 const x0=(left-centre)*scale,x1=(right-centre)*scale,y0=(top-bottom)*scale,y1=0;
 return Object.freeze({id:`BASEMENT-${face}-G${String(i+1).padStart(2,'0')}`,face,x0,x1,y0,y1,x:(x0+x1)/2,y:(y0+y1)/2,width:x1-x0,height:y1-y0,
  retained:true,replacement:false,newStock:false,quantityEligible:false,approved:false,surveyVerified:false,
  dimensionAuthority:'graphic outer-frame envelope; display aperture uses same outline, not measured rough opening',
  source:'PDF53/ark05; retained PDF5 and §5.7/PDF23; retained window detail PDF63/ark15',
  sourceProof:{pdfSHA256:'fc22c9eb0964b52800a5d926fa2574b3f95654f64d1a3f17f21a0afaddd15f99',page:53,sheet:5,outerBBoxPt:[left,top,right,bottom],datumYpt:top,calibration:{metresPerPoint:scale,centreXpt:centre,dimensionSpanMm:40400,dimensionSpanPt:[269.82,1033.26]},coordinateFrame:'exterior left to right on each source elevation; NW rotation pi reverses world X'},
  unknown:{surveyOpening:null,existingFrame:null,existingGlazing:null,installedRecess:null,anchors:null,flashingWorkingDetail:null}});
})));
