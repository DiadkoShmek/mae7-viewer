import {blankContours} from './panel-blank-shapes.js';

// Visual authoring policy. A stock-fitting contour is not an approved cut.
export function visualPanelLayout(layout,{stockWidth=1192,stockHeight=1250}={}){
 if(![stockWidth,stockHeight].every(n=>Number.isSafeInteger(n)&&n>0))throw Error('Invalid visual blank stock');
 const parts=blankContours(layout).map(p=>({...p,stockFit:p.width<=stockWidth&&p.height<=stockHeight}));
 const finishedAreaMm2=parts.reduce((sum,p)=>sum+p.areaMm2,0);
 const boundingBlankAreaMm2=parts.reduce((sum,p)=>sum+p.width*p.height,0);
 // Split accounting and moved support declarations describe different parts.
 const {rectanglePartitionAccounting,localJointTopology,localJointPlan,rectanglePartition,...base}=layout;
 return {...base,cutPolicy:'notched-study',localJoints:'none',parts,area:finishedAreaMm2/1e6,
  warningParts:parts.filter(p=>p.warnings.length),jointClearances:[],
  validity:{...layout.validity,valid:false,visualizable:layout.edgeChain?.closed!==false,studyOnly:true,
   errors:parts.filter(p=>!p.stockFit).map(p=>({kind:'bounding-stock',id:p.id,width:p.width,height:p.height}))},
  visualPanelAccounting:{finishedAreaMm2,boundingBlankAreaMm2,
   cutoutAreaWithinBoundingBlanksMm2:boundingBlankAreaMm2-finishedAreaMm2,
   stockWidthMm:stockWidth,stockHeightMm:stockHeight,boundingStockFitOnly:true,
   internalCutOperationsVerified:false},
  jointClearancePolicy:'Grid edges and aperture union expanded by half-joint; no rectangle-partition seams',
  approved:false,readyToCut:false};
}

// Exact source geometry/style comparison; bounding boxes cannot prove a notch.
export function samePanelLayout(a,b){
 if(!a||!b||(a.cutPolicy??'split')!==(b.cutPolicy??'split'))return false;
 const fields=['module','offset','width','height','joint','localJoints'];
 if(!fields.every(k=>a[k]===b[k])||(a.panelHeight||0)!==(b.panelHeight||0))return false;
 for(const k of ['cuts','levels','openings','colourRegions','localJointTopology'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))return false;
 return a.parts.length===b.parts.length&&a.parts.every((p,i)=>samePanelPart(p,b.parts[i]));
}
export function samePanelPart(a,b){
 if(!a||!b)return false;
 const fields=['id','x','y','width','height','colour','grain','cell','floor'];
 return fields.every(k=>a[k]===b[k])&&['outer','holes','points','areaMm2'].every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]));
}
