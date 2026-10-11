// Millimetre geometry only. A local seam changes supports in its own Y band,
// never by taking the full-height union of every band's X coordinates.
import {assertLocalJointDeclaration} from './local-joint-contract.js';
const pitch=420,timberWidth=100,tapeWidth=90;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((n,i)=>n===b[i]);
const openingPins=holes=>holes.map(({id,x,y,width,height})=>({id:id??null,x,y,width,height})).sort((a,b)=>String(a.id).localeCompare(String(b.id))||a.x-b.x||a.y-b.y||a.width-b.width||a.height-b.height);
const sameOpenings=(a,b)=>{
 if(!Array.isArray(a)||a.length!==b.length||a.some(r=>!r||typeof r!=='object'))return false;
 return openingPins(a).every((r,i)=>['id','x','y','width','height'].every(k=>r[k]===b[i][k]));
};

function rectangle(r,label){
 if(!r||![r.x,r.y,r.width,r.height].every(finite)||r.width<=0||r.height<=0||!finite(r.x+r.width)||!finite(r.y+r.height))throw Error(`Invalid ${label} rectangle`);
}
function intersect(a,b){
 const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),top=Math.min(a.y+a.height,b.y+b.height);
 return right>x&&top>y?{x,y,width:right-x,height:top-y}:null;
}
function subtract(r,h){
 const hit=intersect(r,h);if(!hit)return [r];
 const right=hit.x+hit.width,top=hit.y+hit.height;
 return [{x:r.x,y:r.y,width:hit.x-r.x,height:r.height},{x:right,y:r.y,width:r.x+r.width-right,height:r.height},
  {x:hit.x,y:r.y,width:hit.width,height:hit.y-r.y},{x:hit.x,y:top,width:hit.width,height:r.y+r.height-top}].filter(p=>p.width>0&&p.height>0);
}
function axesFor(cuts,width,band){
 if(!Array.isArray(cuts)||cuts.length<2||cuts[0]!==0||cuts.at(-1)!==width||cuts.some((x,i)=>!finite(x)||(i&&x<=cuts[i-1])))throw Error(`Invalid support cuts in ${band}`);
 const axes=[0],bays=[];
 for(let i=1;i<cuts.length;i++){
  const from=cuts[i-1],to=cuts[i],count=Math.ceil((to-from)/pitch),step=(to-from)/count;
  if(!Number.isSafeInteger(count)||count>100000)throw Error('Support span exceeds bounded geometry capacity');
  if(step<timberWidth){
   const error=Error(`Candidate support axes are less than 100 mm apart in ${band} (${from}..${to}: ${step} mm); 100 mm timber would overlap`);
   error.code='PANEL_SUPPORT_AXIS_OVERLAP';error.band=band;error.from=from;error.to=to;error.step=step;throw error;
  }
  bays.push({from,to,count,step});
  for(let n=1;n<=count;n++)axes.push(n===count?to:from+n*step);
 }
 return {axes,bays};
}

/** Candidate cladding support geometry. No structural or fixing approval. */
export function planPanelSupportTopology(layout){
 assertLocalJointDeclaration(layout);
 if(!layout||![layout.width,layout.height].every(finite)||layout.width<=0||layout.height<=0)throw Error('Invalid support facade dimensions');
 const {width,height,cuts}=layout;
 // Retain the original guard even when a local topology replaces some cuts.
 axesFor(cuts,width,'reference grid');
 const openings=layout.openings??[];
 if(!Array.isArray(openings))throw Error('Invalid support openings');
 for(const hole of openings)rectangle(hole,'opening');
 const topology=layout.localJointTopology;
 const local=topology!==undefined;
 let rawBands;
 if(local){
  const reference=topology?.generatedFrom;
  if(!reference||reference.width!==width||reference.height!==height||!same(reference.cuts,cuts)||!same(reference.levels,layout.levels)||!sameOpenings(reference.openings,openingPins(openings)))throw Error('Stale or unbound local support topology: dimensions, cuts, levels and openings must match');
  if(!Array.isArray(layout.levels)||layout.levels.length<2||layout.levels[0]!==0||layout.levels.at(-1)!==height||layout.levels.some((y,i)=>!finite(y)||(i&&y<=layout.levels[i-1])))throw Error('Invalid support reference levels');
  rawBands=topology.bands;
 }else rawBands=[{y:0,height,cuts}];
 if(!Array.isArray(rawBands)||!rawBands.length)throw Error('Support bands must cover the whole facade');
 let cursor=0;
 const bands=rawBands.map((b,index)=>{
  if(!b||![b.y,b.height].every(finite)||b.height<=0||b.y!==cursor||!finite(b.y+b.height)||b.y+b.height>height)throw Error(`Support bands must be finite, ordered and disjoint (band ${index})`);
  cursor=b.y+b.height;
  const aligned=axesFor(b.cuts,width,`band ${index}`);
  return {index,y:b.y,height:b.height,cuts:[...b.cuts],...aligned};
 });
 if(cursor!==height)throw Error('Support bands must cover exactly 0..height');
 let wall=[{x:0,y:0,width,height}];
 for(const hole of openings)wall=wall.flatMap(r=>subtract(r,hole));
 // A changed local seam must not create butt ends in every unaffected rail.
 // Merge only an identical X axis with exact Y continuity, before apertures.
 const segments=[],lastAtAxis=new Map();
 for(const b of bands)for(const [index,axis] of b.axes.entries()){
  const joint=b.cuts.includes(axis),last=lastAtAxis.get(axis);
  if(last&&last.y+last.height===b.y){
   last.height+=b.height;last.sourceBandIds.push(b.index);last.joint||=joint;if(joint)last.jointBandIds.push(b.index);
  }else{
   const segment={id:`B${b.index}-A${index}`,axis,y:b.y,height:b.height,sourceBandIds:[b.index],joint,jointBandIds:joint?[b.index]:[]};
   segments.push(segment);lastAtAxis.set(axis,segment);
  }
 }
 const strips=stripWidth=>segments.flatMap(s=>{
  const x=Math.max(0,s.axis-stripWidth/2),right=Math.min(width,s.axis+stripWidth/2);
  const strip={x,y:s.y,width:right-x,height:s.height};
  return wall.flatMap(r=>{const piece=intersect(r,strip);return piece?[piece]:[];});
 });
 const battens=strips(timberWidth),tape=strips(tapeWidth);
 const baySteps=bands.flatMap(b=>b.bays.map(span=>span.step));
 const note='Геометрична прив’язка рейок до швів; зміну 420 мм треба погодити. Опори біля прорізів, кінці рейок у межах рядів і Т-стики потребують робочого вузла.';
 const support={alignment:'panel-joints',candidate:true,valid:true,validationScope:'geometry-only',status:'candidate-requires-approval',approved:false,
  sourcePitch:pitch,maximumBay:Math.max(...baySteps),minimumAxisSpacing:Math.min(...baySteps),phase:local?'per-y-band':'per-panel-span',
  axes:bands.length===1?[...bands[0].axes]:null,seamAxes:bands.length===1?[...bands[0].cuts]:null,bays:bands.length===1?bands[0].bays:null,
  referenceCuts:[...cuts],referenceLevels:layout.levels?[...layout.levels]:null,referenceOpenings:openingPins(openings),bands,
  rfi:['Зміна джерельного кроку 420 мм','Кріплення та опори біля прорізів','Кінці рейок і Т-стики локальних рядів','Продовження опор на фронтон'],note};
 return {width,height,segments,battens,tape,support,approved:false};
}
