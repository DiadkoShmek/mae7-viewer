// Graphic trace of the EXISTING asphalt edge on PDF49 / sheet01.
// This is the 1:500 drawing fit, not a site survey or a construction quantity.
export const siteAccessReference=Object.freeze({
 source:'P8822_PP_AA-0-01_v04_Mae7.pdf · PDF49 / sheet01 · existing asphalt edges and Mäe tn junction',
 sourceSHA256:'fc22c9eb0964b52800a5d926fa2574b3f95654f64d1a3f17f21a0afaddd15f99',
 method:'Graphic boundary anchors; straight interpolation between anchors. Calibration reused from the five restoration contours.',
 approved:false,surveyVerified:false,quantityEligible:false,
 origin:[369.42002868652344,344.9600143432617],axisX:[1.2712875215133819,-5.480198246417659],axisZ:[5.348751298897631,1.2491124380525744],
 // Read from the retained 1800px plan rendering, then convert to display points.
 renderWidth:1800,pageWidth:1191,
 boundaryPixels:[[987,319],[899,343],[815,365],[775,405],[754,487],[739,565],[722,637],[691,725],[657,868],[624,986],[555,1039],[213,1095],[215,1140],[585,1078],[724,1048],[706,1007],[674,1006],[694,960],[706,897],[732,788],[754,689],[775,586],[799,480],[835,409],[862,388],[994,351]],
 vegetation:'Only the verified vegetation anchor from the existing sheet fit; no invented foreground trees.',
 limits:'Road edges are graphically traced and fitted to the model. Absolute geodetic alignment, elevations, road widths and tree crowns need survey.'
});
export function siteDisplayToModel([x,y]){
 const s=siteAccessReference,a=s.axisX,b=s.axisZ,u=x-s.origin[0],v=y-s.origin[1],d=a[0]*b[1]-a[1]*b[0];
 return [(u*b[1]-v*b[0])/d,(a[0]*v-a[1]*u)/d];
}
export const siteAccessContour=siteAccessReference.boundaryPixels.map(p=>siteDisplayToModel(p.map(v=>v*siteAccessReference.pageWidth/siteAccessReference.renderWidth)));
// The existing paved sidewalk separates the restored entrance paths from the
// driveway (§3.4.2 explicitly says to restore asphalt up to the sidewalk).
export const siteWalkwayContour=[[751,405],[730,487],[715,565],[698,637],[667,725],[633,868],[600,986],[546,1018],[213,1074],
 [213,1095],[555,1039],[624,986],[657,868],[691,725],[722,637],[739,565],[754,487],[775,405]]
 .map(p=>siteDisplayToModel(p.map(v=>v*siteAccessReference.pageWidth/siteAccessReference.renderWidth)));
