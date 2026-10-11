import {planPlinthAssembly,polygonArea} from './plinth-plan.js';
import {planCuts} from './cut-planner.js';
import {packingAreaAccounting} from './cut-area-accounting.js';
import {projectQuantities} from './project-quantities.js';

const clone=value=>JSON.parse(JSON.stringify(value));
const EPS=1e-9;
function finishedPart(p,face){
 if(p.kind==='contourZ')return finishedContour(p,face);
 if(p.projection||p.region!=='physical'||p.stockPart!==true)throw Error('not-canonical-physical-stock-part');
 if(p.kind!=='prismY'||p.material!=='FC_P070')throw Error('unsupported-FC-part');
 if(!face||!Array.isArray(face.position)||face.position.length!==3||!face.position.every(Number.isFinite)||!Number.isFinite(face.rotation))throw Error('missing-face-transform');
 const ps=p.sectionXZ;
 if(!Array.isArray(ps)||ps.length<3||!ps.every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite))||!Number.isFinite(p.y0)||!Number.isFinite(p.y1)||p.y1<=p.y0)throw Error('invalid-finished-geometry');
 const xs=ps.map(v=>v[0]),zs=ps.map(v=>v[1]);
 const x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
 if(Math.abs(z1-z0-.008)>EPS)throw Error('unsupported-thickness-not-FC8');
 // The current plan is a convex prism with a planar exterior FC face.
 // Reject another topology instead of deriving a rectangular blank silently.
 let turn=0;
 for(let i=0;i<ps.length;i++){
  const a=ps[i],b=ps[(i+1)%ps.length],c=ps[(i+2)%ps.length];
  const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
  if(Math.abs(cross)>1e-12){if(turn&&Math.sign(cross)!==turn)throw Error('unsupported-nonconvex-section');turn=Math.sign(cross);}
 }
 if(!turn||polygonArea(ps)<=0||x1<=x0)throw Error('degenerate-finished-geometry');
 for(let i=0;i<ps.length;i++){
  const a=ps[i],b=ps[(i+1)%ps.length];
  if(ps.some(v=>turn*((b[0]-a[0])*(v[1]-a[1])-(b[1]-a[1])*(v[0]-a[0]))< -1e-12))throw Error('unsupported-nonconvex-or-crossed-section');
 }
 const exteriorXs=ps.filter(v=>Math.abs(v[1]-z1)<EPS).map(v=>v[0]);
 if(exteriorXs.length<2)throw Error('no-planar-exterior-face');
 const widthMm=(x1-x0)*1000,heightMm=(p.y1-p.y0)*1000;
 const exteriorWidthMm=(Math.max(...exteriorXs)-Math.min(...exteriorXs))*1000;
 const volumeMm3=polygonArea(ps)*(p.y1-p.y0)*1e9;
 const sectionProfiles=[];
 for(let i=0;i<ps.length;i++){
  const a=ps[i],b=ps[(i+1)%ps.length];
  if(Math.abs(a[0]-b[0])>EPS&&Math.abs(a[1]-b[1])>EPS){
   const from=a.map((v,k)=>(v-(k?z0:x0))*1000),to=b.map((v,k)=>(v-(k?z0:x0))*1000);
   sectionProfiles.push({id:p.sourcePartId+'-SECTION-E'+String(i+1).padStart(2,'0'),sourcePartId:p.sourcePartId,
    edge:i+1,sectionAxes:'X/Z; origin at blank section minimum; mm',from,to,
    throughHeightMm:heightMm,angleDegrees:Math.atan2(to[1]-from[1],to[0]-from[0])*180/Math.PI,
    status:'CANDIDATE_THICKNESS_MITER; tooling, corner joint and secondary kerf unknown'});
  }
 }
 return {sourcePartId:p.sourcePartId,face:p.face,material:p.material,layer:4,
  source:p.source,approved:false,
  finished:{kind:'prismY',unit:'m',sectionXZ:clone(ps),y0:p.y0,y1:p.y1,
   faceTransform:{position:clone(face.position),rotationY:face.rotation},widthMm,heightMm,thicknessMm:(z1-z0)*1000,
   exteriorWidthMm,exteriorFaceAreaMm2:exteriorWidthMm*heightMm,volumeMm3,
   declaredPlanVolumeM3:p.volume??null},
  blank:{width:Math.ceil(widthMm),height:Math.ceil(heightMm),thickness:8,unit:'mm',rounding:'ceil exact bounding width and height; no rotation'},
  sectionProfiles};
}

function finishedContour(p,face){
 if(p.projection||p.region!=='physical'||p.stockPart!==true)throw Error('not-canonical-physical-stock-part');
 if(p.material!=='FC_P070'||p.layer!==4)throw Error('unsupported-FC-part');
 if(!face?.position?.every(Number.isFinite)||face.position.length!==3||!Number.isFinite(face.rotation))throw Error('missing-face-transform');
 if(!Array.isArray(p.outer)||p.outer.length<3||![p.z0,p.z1].every(Number.isFinite)||Math.abs(p.z1-p.z0-.008)>EPS)throw Error('invalid-contour-geometry');
 const rings=[p.outer,...(p.holes??[])];
 if(!rings.every(r=>r.length>=3&&r.every(v=>v.length===2&&v.every(Number.isFinite))))throw Error('invalid-contour-points');
 const xs=p.outer.map(v=>v[0]),ys=p.outer.map(v=>v[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 const net=polygonArea(p.outer)-(p.holes??[]).reduce((a,h)=>a+polygonArea(h),0);
 if(!(net>0&&x1>x0&&y1>y0))throw Error('degenerate-contour-geometry');
 const widthMm=(x1-x0)*1000,heightMm=(y1-y0)*1000,volumeMm3=net*(p.z1-p.z0)*1e9;
 if(Math.abs((p.volume??NaN)*1e9-volumeMm3)>1e-4||!Number.isFinite(p.volume))throw Error('contour-volume-mismatch');
 return {sourcePartId:p.sourcePartId,sourceBlankId:p.sourceBlankId??p.sourcePartId,face:p.face,material:p.material,layer:4,source:p.source,approved:false,
  finished:{kind:'contourZ',unit:'m',outer:clone(p.outer),holes:clone(p.holes??[]),z0:p.z0,z1:p.z1,y0,y1,
   faceTransform:{position:clone(face.position),rotationY:face.rotation},widthMm,heightMm,thicknessMm:8,
   exteriorWidthMm:widthMm,exteriorFaceAreaMm2:net*1e6,volumeMm3,declaredPlanVolumeM3:p.volume},
  blank:{width:Math.ceil(widthMm),height:Math.ceil(heightMm),thickness:8,unit:'mm',rounding:'ceil exact bounding width and height; no rotation'},
  sectionProfiles:[],contourCut:{status:'WITHHELD_APERTURE_OPERATION',outer:clone(p.outer),holes:clone(p.holes??[]),units:'m',cornerRadiusMm:null,tooling:null,kerfMm:null,
   source:'PDF53 retained opening graphic candidate; Patina WOOD DIM p17 requires resolving cuts/supports',approved:false,readyToCut:false}};
}

export function buildPlinthCutReport({plan=planPlinthAssembly(),width=1250,height=3050,kerf=3,trim=10}={}){
 if(!Array.isArray(plan.physicalParts)||!Array.isArray(plan.faces))throw Error('Missing physical plinth plan');
 const faces=new Map(plan.faces.map(f=>[f.code,f]));
 const sourceParts=plan.physicalParts.filter(p=>p.layer===4);
 const seen=new Set(),parts=[],withheld=[];
 for(const p of sourceParts){
  if(!p.sourcePartId||seen.has(p.sourcePartId))throw Error('Missing or duplicate physical FC sourcePartId');
  seen.add(p.sourcePartId);
  try{parts.push(finishedPart(p,faces.get(p.face)));}
  catch(e){withheld.push({sourcePartId:p.sourcePartId,status:'WITHHELD',reason:e.message,geometryEvidence:clone(p),approved:false});}
 }
 const packing=planCuts(parts.map(p=>({id:p.sourcePartId,sourcePartId:p.sourcePartId,face:p.face,colour:p.material,
  width:p.blank.width,height:p.blank.height})),{width,height,kerf,trim});
 for(const s of packing.sheets){s.id='PLINTH-'+s.id;for(const c of s.cuts){c.id=s.id+'-CUT-'+String(c.order).padStart(3,'0');c.sheetId=s.id;c.sourcePartId=c.part;}}
 const placed=new Map(packing.sheets.flatMap(s=>s.parts.map(p=>[p.id,{sheetId:s.id,xMm:p.xSheet,yMm:p.ySheet,rotated:p.rotated}])));
 const rejected=new Map(packing.rejected.map(p=>[p.id,p.reason]));
 for(const p of parts){p.placement=placed.get(p.sourcePartId)??null;p.status=p.placement?'PACKED':'REJECTED';p.reason=rejected.get(p.sourcePartId)??null;}
 const accounting=packingAreaAccounting(packing);
 const finishSizing=parts.filter(p=>p.placement&&(p.blank.width-p.finished.widthMm>1e-9||p.blank.height-p.finished.heightMm>1e-9)).map(p=>({
  id:p.sourcePartId+'-FINISH-SIZE',sourcePartId:p.sourcePartId,sheetId:p.placement.sheetId,
  kind:'secondary-finish-sizing',blankWidthMm:p.blank.width,blankHeightMm:p.blank.height,
  finishedBoundingWidthMm:p.finished.widthMm,finishedHeightMm:p.finished.heightMm,
  kerfMm:null,tooling:null,approved:false,
  status:'CANDIDATE_EXACT_DIMENSIONS; datum, tool tolerance and secondary kerf not established',
  dependsOn:operationsFor(p.sourcePartId,packing,[])}));
 const sectionProfiles=parts.filter(p=>p.placement).flatMap(p=>p.sectionProfiles.map(c=>({...c,sheetId:p.placement.sheetId})));
 const operations=[...packing.sheets.flatMap(s=>s.cuts.map(c=>({id:c.id,kind:'rectangular-stock-cut',sourcePartId:c.sourcePartId,
  sheetId:s.id,cutOrder:c.order,direction:c.direction,xMm:c.x,yMm:c.y,lengthMm:c.length,kerfMm:c.kerf,sourceRectangle:c.sourceRectangle,
  dependsOn:c.order>1?[s.cuts[c.order-2].id]:[],approved:false}))),...finishSizing,
  ...sectionProfiles.map(c=>({id:c.id,kind:'thickness-miter-profile',sourcePartId:c.sourcePartId,sheetId:c.sheetId,
   section:c,dependsOn:[...operationsFor(c.sourcePartId,packing,[]),...finishSizing.filter(v=>v.sourcePartId===c.sourcePartId).map(v=>v.id)],approved:false})),
  ...parts.filter(p=>p.contourCut).map(p=>({id:p.sourcePartId+'-CONTOUR',kind:'unresolved-aperture-contour',sourcePartId:p.sourcePartId,sheetId:p.placement?.sheetId??null,dependsOn:operationsFor(p.sourcePartId,packing,[]),...p.contourCut})),
  ...parts.map(p=>({id:p.sourcePartId+'-INSTALL',kind:'candidate-install-reference',sourcePartId:p.sourcePartId,
   sourceOperationId:'R76',quantityReference:'Hanketabel row76, project76m²; no accepted crew quantity',
   candidateExteriorFaceAreaM2:p.finished.exteriorFaceAreaMm2/1e6,stockDisposition:p.status,sheetId:p.placement?.sheetId??null,
   dependsOn:[...operationsFor(p.sourcePartId,packing,sectionProfiles),...finishSizing.filter(v=>v.sourcePartId===p.sourcePartId).map(v=>v.id),...(p.contourCut?[p.sourcePartId+'-CONTOUR']:[])],labourHours:null,approved:false}))];
 const sourceQuantity=projectQuantities.find(r=>r.row===76);
 const modelExteriorFaceAreaM2=parts.reduce((a,p)=>a+p.finished.exteriorFaceAreaMm2,0)/1e6;
 const placedParts=parts.filter(p=>p.placement);
 const placedFinishedVolumeMm3=placedParts.reduce((a,p)=>a+p.finished.volumeMm3,0);
 return {schema:'Mae7-plinth-physical-cut/1',approved:false,
  scope:{assembly:'VS-1',layer:4,physicalSourcePartIds:[...seen].sort(),excluded:'inspection/outside/cover projections; other layers; unlocated thin zone',
   heightStatus:plan.metadata?.heightStatus??'survey height unknown',openingsStatus:plan.metadata?.openingsStatus??'openings unknown'},
  stock:{...packing.stock,thicknessMm:8,status:'CANDIDATE_NOT_ORDERED',manufacturer:null,product:null,
   textureDirection:'blank height parallel to stock height; candidate only; no rotation'},
  parts,withheld,packing,finishSizing,sectionProfiles,operations,accounting,
  finishing:{unit:'mm³',placedBlankVolume:accounting.placedBlankArea*8,placedFinishedVolume:placedFinishedVolumeMm3,
   blankToFinishedRemovalCandidate:accounting.placedBlankArea*8-placedFinishedVolumeMm3,
   note:'Ceil-mm sizing and thickness miters require secondary finishing. Removed material, tooling, profile kerf and reuse are not validated.'},
  reconciliation:{sourceOperationId:'R76',source:clone(sourceQuantity),sourceStatus:'project quantity; not accepted crew scope',
   retainedOpeningCount:plan.retainedOpenings?.length??0,newBasementWindows:0,modelExteriorFaceAreaM2,deltaModelMinusSourceM2:modelExteriorFaceAreaM2-sourceQuantity.quantity,
   comparableBoundary:false,incompleteModel:withheld.length>0,
   warning:'Not the same measured boundary: presentation height, graphical basement aperture dimensions, corner joints and thin-zone location are unresolved. Delta is not overrun, shortage or accepted quantity.'},
  summary:{physicalFCParts:sourceParts.length,packed:placed.size,rejected:packing.rejected.length,withheld:withheld.length,
   sheets:packing.sheets.length,unresolvedContourOperations:parts.filter(p=>p.contourCut).length,rectangularCuts:packing.sheets.reduce((a,s)=>a+s.cuts.length,0),finishSizingOperations:finishSizing.length,sectionProfileCuts:sectionProfiles.length,
   modelExteriorFaceAreaM2,blankAreaM2:parts.reduce((a,p)=>a+p.blank.width*p.blank.height,0)/1e6},
  warnings:[plan.metadata?.panelStock??'ordered stock unknown',plan.metadata?.cornerFit??'corner details unknown',
   'FC8 P070 is the model material role, not a confirmed ordered product. Candidate packing is not a shop instruction or procurement minimum.',
   'Source R76 remains 76m²; model-derived areas do not update the labour ledger.',
   'Contour blank nesting excludes unresolved aperture cutting, radii and supports; no cutting instruction is approved.']};
}
function operationsFor(id,packing,profiles){return [...packing.sheets.flatMap(s=>s.cuts.filter(c=>c.sourcePartId===id).map(c=>c.id)),...profiles.filter(c=>c.sourcePartId===id).map(c=>c.id)];}
