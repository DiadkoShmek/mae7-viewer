// Read the actual physical FC and horizontal profile owners. No new bores,
// steel, material quantities or mounting authority are created by this review.
export const plinthFixingRules=Object.freeze({
 source:'Swisspearl Patina Steel DIM2026-02 p13–14; project §5.3',
 supportDirection:'horizontal',alongMinMm:100,alongMaxMm:150,
 crossMinMm:30,crossMaxMm:100,middleProfileMinMm:40,jointProfileMinMm:100,
 sourcePitchMm:420,screwHoleMm:8,rivetHoleMm:9,
 orderedProduct:null,approved:false
});
const mm=v=>v*1000,copy=v=>structuredClone(v),eps=1e-7;
export function plinthFaceContour(p){
 if(p.kind==='contourZ')return [copy(p.outer),...copy(p.holes??[])].map(r=>r.map(q=>q.map(mm)));
 if(p.kind!=='prismY')throw Error('Unsupported physical FC contour');
 const z=Math.max(...p.sectionXZ.map(q=>q[1])),xs=p.sectionXZ.filter(q=>Math.abs(q[1]-z)<1e-10).map(q=>q[0]);
 if(xs.length<2)throw Error('Missing FC exterior face');
 const a=Math.min(...xs)*1000,b=Math.max(...xs)*1000;
 return [[[a,mm(p.y0)],[b,mm(p.y0)],[b,mm(p.y1)],[a,mm(p.y1)]]];
}
// Even-odd intersections retain aperture voids and disconnected intervals.
export function contourIntervals(rings,axis,level){
 const values=[];
 for(const ring of rings)for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length];
  if((a[axis]>level)!==(b[axis]>level))values.push(a[1-axis]+(b[1-axis]-a[1-axis])*(level-a[axis])/(b[axis]-a[axis]));
 }
 values.sort((a,b)=>a-b);if(values.length%2)throw Error('Unpaired contour intersection');
 return Array.from({length:values.length/2},(_,i)=>[values[2*i],values[2*i+1]]).filter(([a,b])=>b-a>eps);
}
const bounds=rings=>({x0:Math.min(...rings[0].map(q=>q[0])),x1:Math.max(...rings[0].map(q=>q[0])),y0:Math.min(...rings[0].map(q=>q[1])),y1:Math.max(...rings[0].map(q=>q[1]))});
const rectangle=rings=>rings.length===1&&rings[0].length===4&&rings[0].every((q,i)=>{const n=rings[0][(i+1)%4];return Math.abs(q[0]-n[0])<eps||Math.abs(q[1]-n[1])<eps;});
const within=(v,a,b)=>v>=a-eps&&v<=b+eps;
export function comparePlinthRows(heightMm,{edgeMm=60,pitchMm=420}={}){
 if(![heightMm,edgeMm,pitchMm].every(Number.isFinite)||heightMm<=0||!within(edgeMm,30,100)||pitchMm<=0)throw Error('Invalid row comparison');
 // At least two rows. This comparison treats420 as a maximum, which differs
 // from the written project pitch. It needs reconciliation, never adoption.
 const span=heightMm-2*edgeMm;
 if(span<40-eps)return {rows:[],status:'too-short',approved:false,readyToDrill:false,quantityEligible:false};
 const count=Math.max(2,Math.ceil(span/pitchMm)+1),gap=span/(count-1);
 return {rows:Array.from({length:count},(_,i)=>edgeMm+i*gap),pitchMm:gap,edgeMm,
  sourcePitchMm:420,changedSourcePitch:Math.abs(gap-420)>eps,
  status:'comparison-only',approved:false,readyToDrill:false,quantityEligible:false};
}
export function reviewPlinthFixings(part,plan){
 const matches=plan?.physicalParts?.filter(p=>p.sourcePartId===part?.sourcePartId);
 if(matches?.length!==1||JSON.stringify(matches[0])!==JSON.stringify(part)||part.layer!==4||part.material!=='FC_P070'||part.region!=='physical'||part.projection!==false||part.stockPart!==true)throw Error('Fixing review requires exact physical FC owner');
 const rings=plinthFaceContour(part),box=bounds(rings),rules=plinthFixingRules,rows=[],controls=[],issues=[];
 const backZ=part.kind==='contourZ'?part.z0:Math.min(...part.sectionXZ.map(q=>q[1]));
 for(const h of plan.physicalParts.filter(p=>p.face===part.face&&p.kind==='profileX'&&p.layer===3&&p.material==='galvanized')){
  const z=Math.max(...h.sectionYZ.map(q=>q[1]));
  if(Math.abs(z-backZ)>1e-10)continue; // A cut fragment not reaching FC is not a contact.
  const front=h.sectionYZ.filter(q=>Math.abs(q[1]-z)<1e-10).map(q=>mm(q[0]));
  if(front.length<2)continue;
  const y0=Math.min(...front),y1=Math.max(...front),y=(y0+y1)/2;
  const intervals=contourIntervals(rings,1,y).map(([a,b])=>[Math.max(a,mm(h.x0)),Math.min(b,mm(h.x1))]).filter(([a,b])=>b-a>eps);
  if(!intervals.length)continue;
  const width=y1-y0,id=h.sourcePartId;
  rows.push({id,yMm:y,topOffsetMm:box.y1-y,bottomOffsetMm:y-box.y0,widthMm:width,xIntervalsMm:intervals,contactZMm:mm(z),minimumMiddleWidthMm:40,profileWidthPass:width>=40-eps});
  if(width<40-eps)issues.push({code:'profile-width',owner:id,actualMm:width,requiredMinMm:40});
  // Crosses below are test locations, not drilled holes. No spacing/product
  // decision is inferred from their number or from rivet-centre limits.
  for(const [a,b] of intervals){
   if(b-a<250-eps){issues.push({code:'short-supported-interval',owner:id,widthMm:b-a});continue;}
   const xs=b-a<=250+eps?[(a+b)/2]:[a+125,b-125];
   for(const x of xs){
    const material=contourIntervals(rings,1,y).find(([u,v])=>within(x,u,v));
    const vertical=contourIntervals(rings,0,x).find(([u,v])=>within(y,u,v));
    if(!material||!vertical)throw Error('Control centre outside physical FC');
    const along=[x-material[0],material[1]-x],cross=[y-vertical[0],vertical[1]-y];
    const crossNearest=Math.min(...cross),alongNearest=Math.min(...along);
    controls.push({profileId:id,xMm:x,yMm:y,alongNearestMm:alongNearest,crossNearestMm:crossNearest,crossBottomMm:cross[0],crossTopMm:cross[1],profileWidthPass:width>=40-eps,drilled:false});
   }
  }
 }
 rows.sort((a,b)=>b.yMm-a.yMm||a.id.localeCompare(b.id));
 for(const c of controls){
  const [lo,hi]=contourIntervals(rings,0,c.xMm).find(([a,b])=>within(c.yMm,a,b));
  const ys=rows.filter(r=>within(r.yMm,lo,hi)&&r.xIntervalsMm.some(([a,b])=>within(c.xMm,a,b))).map(r=>r.yMm);
  const upper=Math.abs(c.yMm-Math.max(...ys))<eps,lower=Math.abs(c.yMm-Math.min(...ys))<eps;
  c.rowRole=upper&&lower?'both-edges':upper?'upper-edge':lower?'lower-edge':'middle';
  // The maximum cross-edge distance concerns corner/end rows, not a fixing
  // on an interior support. One row must satisfy BOTH ends, not just nearest.
  c.edgePass=within(c.alongNearestMm,100,150)&&c.crossNearestMm>=30-eps&&(!upper||c.crossTopMm<=100+eps)&&(!lower||c.crossBottomMm<=100+eps);
  if(!c.edgePass)issues.push({code:'edge-distance',owner:c.profileId,xMm:c.xMm,yMm:c.yMm,alongNearestMm:c.alongNearestMm,crossNearestMm:c.crossNearestMm,rowRole:c.rowRole});
 }
 if(!rows.length)issues.push({code:'no-contacting-profile'});
 if(!rectangle(rings))issues.push({code:'contour-support-unresolved'});
 const heightMm=box.y1-box.y0,proposal=rectangle(rings)?comparePlinthRows(heightMm):null;
 const comparison=proposal?.status==='comparison-only'?proposal:null;
 if(proposal?.status==='too-short')issues.push({code:'comparison-too-short'});
 const requiredTwoRowEdgeSumMm=heightMm-rules.sourcePitchMm;
 const twoSourceRowsCanMeetCrossEdges=requiredTwoRowEdgeSumMm>=2*rules.crossMinMm-eps&&requiredTwoRowEdgeSumMm<=2*rules.crossMaxMm+eps;
 return {schema:'mae7-plinth-fixing-review-v1',sourcePartId:part.sourcePartId,face:part.face,rings,boundsMm:box,rules:copy(rules),rows,controls,issues,
  comparison,twoSourceRowsCanMeetCrossEdges,requiredTwoRowEdgeSumMm,
  geometryChanged:false,drilledHoles:[],approved:false,readyToDrill:false,quantityAuthority:false,
  unknown:{orderedHat:null,steelWidth:null,fastener:null,anchors:null,windCheck:null,jointSupport:null,ventilationContinuity:null},
  limits:'Contact bands from the physical plan; control centres are not bores.40mm minimum applies to middle profiles;100mm joint support needs separate placement. Reduced-pitch comparison is not the written420mm layout. Product, movement, fixing centres, loads and ventilation remain unresolved.'};
}
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function plinthFixingReviewSVG(review,{comparison=false}={}){
 const b=review.boundsMm,w=b.x1-b.x0,h=b.y1-b.y0,fs=Math.max(28,w/22),pad=fs*3;
 const point=([x,y])=>[x-b.x0,b.y1-y],path=review.rings.map(r=>r.map((q,i)=>(i?'L':'M')+point(q).join(' ')).join(' ')+'Z').join(' ');
 const rows=comparison?(review.comparison?.rows??[]).map((topOffsetMm,i)=>({id:'comparison-'+i,yMm:b.y1-topOffsetMm,topOffsetMm,bottomOffsetMm:h-topOffsetMm,widthMm:40,profileWidthPass:true,xIntervalsMm:[[b.x0,b.x1]]})):review.rows;
 const colour=comparison?'#597667':'#b25d35',clip='plinth-contact-'+(comparison?'comparison':'actual');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${w+pad*2+fs*5} ${h+pad*2}" role="img" aria-label="${comparison?'Порівняння зі зміненим кроком':'Фактичні горизонтальні опори'} ${esc(review.sourcePartId)}"><defs><clipPath id="${clip}"><path d="${path}" fill-rule="evenodd" clip-rule="evenodd"/></clipPath><marker id="${clip}-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${colour}"/></marker></defs><path d="${path}" fill="#eef0e7" stroke="#34463f" stroke-width="3" fill-rule="evenodd"/><g clip-path="url(#${clip})">${rows.flatMap(r=>r.xIntervalsMm.map(([a,c])=>`<rect data-support-owner="${esc(r.id)}" x="${a-b.x0}" y="${b.y1-r.yMm-r.widthMm/2}" width="${c-a}" height="${r.widthMm}" fill="${colour}" fill-opacity=".25"/><path d="M${a-b.x0} ${b.y1-r.yMm}H${c-b.x0}" stroke="${colour}" stroke-width="3" stroke-dasharray="9 6"/>`)).join('')}</g>${comparison?'':review.controls.map(c=>`<path data-review-control="${c.edgePass&&c.profileWidthPass?'pass':'conflict'}" d="M${c.xMm-b.x0-8} ${b.y1-c.yMm}h16m-8 -8v16" stroke="${c.edgePass&&c.profileWidthPass?'#597667':'#b25d35'}" stroke-width="3"/>`).join('')}<g font-family="system-ui" font-size="${fs}" fill="#22342d">${rows.map(r=>`<text x="${w-fs/3}" y="${b.y1-r.yMm-fs/3}" text-anchor="end">${Math.round(r.topOffsetMm)} мм від верху</text>`).join('')}<text x="0" y="${-fs*2}" font-weight="600">${comparison?'Порівняння · у 3D не застосовано':'Опори з фізичної моделі'}</text></g>${rows.length?`<path d="M${w+fs*2} ${b.y1-rows.at(-1).yMm}V${h}" fill="none" stroke="${colour}" stroke-width="3" marker-start="url(#${clip}-arrow)" marker-end="url(#${clip}-arrow)"/><text x="${w+fs*2.5}" y="${(b.y1-rows.at(-1).yMm+h)/2}" font-family="system-ui" font-size="${fs}" fill="${colour}">${Math.round(rows.at(-1).bottomOffsetMm)} мм</text>`:''}</svg>`;
}
