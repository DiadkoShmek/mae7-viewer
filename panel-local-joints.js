// V21 local rectangle/seam studies. Exact nominal geometry is conserved;
// installation supports, visual seam choice and fixing remain candidate/RFI.
import {partitionCell} from './panel-rectangle-partition.js';
const order=(a,b)=>a.y-b.y||a.x-b.x||a.height-b.height||a.width-b.width;
const area=r=>r.width*r.height;
const inside=(r,d)=>r.x>=d.x&&r.y>=d.y&&r.x+r.width<=d.x+d.width&&r.y+r.height<=d.y+d.height;
const overlap=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
const compare=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
function balanced(a,b,maximum){const n=Math.ceil((b-a)/maximum);return Array.from({length:n+1},(_,i)=>a+Math.floor((b-a)*i/n));}
function splitCuts(a,b,maximum,policy){
 if(policy==='balanced')return balanced(a,b,maximum);
 // 300 mm nominal terminal guard is a declared design scenario, not a manufacturer minimum.
 const n=Math.ceil((b-a)/maximum),cuts=[a];let left=b-a;
 for(let i=0;i<n;i++){const width=i===n-1?left:Math.min(maximum,left-300*(n-i-1));cuts.push(cuts.at(-1)+width);left-=width;}
 return cuts;
}
function stockSplit(rect,maxWidth,policy){const xs=splitCuts(rect.x,rect.x+rect.width,maxWidth,policy);return xs.slice(1).map((x,i)=>({...rect,x:xs[i],width:x-xs[i]}));}
function assess(nominal,joint,minWidth,minHeight){
 const parts=[],consumed=[];let nominalMaterialAreaMm2=0,finishedAreaMm2=0,jointLossAreaMm2=0,consumedNominalAreaMm2=0;
 nominal=[...nominal].sort(order);
 for(const r of nominal){nominalMaterialAreaMm2+=area(r);const width=r.width-joint,height=r.height-joint;
  if(width<=0||height<=0){consumed.push({nominal:{...r},areaMm2:area(r),reason:'Explicitly joint-consumed nominal strip'});consumedNominalAreaMm2+=area(r);continue;}
  const warnings=[];if(width<minWidth)warnings.push(`width ${width} < necessary scenario ${minWidth} mm`);if(height<minHeight)warnings.push(`height ${height} < necessary scenario ${minHeight} mm`);
  const p={nominal:{...r},x:r.x+joint/2,y:r.y+joint/2,width,height,areaMm2:width*height,warnings,approved:false,readyToCut:false};parts.push(p);finishedAreaMm2+=p.areaMm2;jointLossAreaMm2+=area(r)-p.areaMm2;
 }
 const warningParts=parts.filter(p=>p.warnings.length).length,under100WidthParts=parts.filter(p=>p.width<100).length;
 return {nominal,parts,consumed,summary:{parts:parts.length,warningParts,under100WidthParts,widthWarnings:parts.filter(p=>p.width<minWidth).length,heightWarnings:parts.filter(p=>p.height<minHeight).length,nominalMaterialAreaMm2,finishedAreaMm2,jointLossAreaMm2,consumedNominalAreaMm2,consumedStrips:consumed.length},score:[consumedNominalAreaMm2,warningParts,under100WidthParts,parts.length,jointLossAreaMm2]};
}
function jointSegments(rects,joint){
 const segments=[];
 for(let i=0;i<rects.length;i++)for(let j=0;j<i;j++){
  const a=rects[i],b=rects[j];
  if(a.x+a.width===b.x||b.x+b.width===a.x){const y=Math.max(a.y,b.y),top=Math.min(a.y+a.height,b.y+b.height);if(y<top)segments.push({axis:'vertical',at:a.x+a.width===b.x?b.x:a.x,from:y,to:top,jointMm:joint});}
  if(a.y+a.height===b.y||b.y+b.height===a.y){const x=Math.max(a.x,b.x),right=Math.min(a.x+a.width,b.x+b.width);if(x<right)segments.push({axis:'horizontal',at:a.y+a.height===b.y?b.y:a.y,from:x,to:right,jointMm:joint});}
 }
 return segments.sort((a,b)=>a.axis.localeCompare(b.axis)||a.at-b.at||a.from-b.from||a.to-b.to);
}
function groups(layout,minWidth){
 const found=new Map(),unmapped=[];
 for(const p of layout.parts.filter(p=>p.width<minWidth)){
  const r=p.nominal??{x:p.x-layout.joint/2,y:p.y-layout.joint/2,width:p.width+layout.joint,height:p.height+layout.joint};
  const holes=layout.openings.filter(o=>r.y<o.y+o.height&&o.y<r.y+r.height);
  const matches=[];
  for(const o of holes){if(r.x+r.width===o.x&&layout.cuts.includes(r.x))matches.push({side:'left',jamb:o.x,oldCut:r.x,opening:o});if(r.x===o.x+o.width&&layout.cuts.includes(r.x+r.width))matches.push({side:'right',jamb:r.x,oldCut:r.x+r.width,opening:o});}
  matches.sort((a,b)=>a.jamb-b.jamb||a.oldCut-b.oldCut||a.side.localeCompare(b.side)||String(a.opening.id).localeCompare(String(b.opening.id)));const match=matches[0];
  if(!match){unmapped.push(p.id);continue;}
  const index=layout.cuts.indexOf(match.oldCut),first=index-1,last=index+1;
  if(first<0||last>=layout.cuts.length){unmapped.push(p.id);continue;}
  const id=`${layout.facade}-LOCAL-JAMB-X${match.jamb}-G${match.oldCut}`;
  if(!found.has(id))found.set(id,{id,facade:layout.facade,side:match.side,jamb:match.jamb,oldCut:match.oldCut,x0:layout.cuts[first],x1:layout.cuts[last],rows:new Set(),openingIds:new Set(),oldPartIds:new Set()});
  const g=found.get(id);g.rows.add(p.floor);for(const m of matches)if(m.jamb===match.jamb&&m.oldCut===match.oldCut&&m.side===match.side)g.openingIds.add(m.opening.id);g.oldPartIds.add(p.id);
 }
 const result=[...found.values()].map(g=>({...g,rows:[...g.rows].sort((a,b)=>a-b),openingIds:[...g.openingIds].sort(),oldPartIds:[...g.oldPartIds].sort()})).sort((a,b)=>a.x0-b.x0);
 for(let i=0;i<result.length;i++)for(let j=0;j<i;j++)if(result[i].x0<result[j].x1&&result[j].x0<result[i].x1&&result[i].rows.some(y=>result[j].rows.includes(y)))throw Error('Overlapping local patch domains require an explicit merged study, not double replacement');
 return {groups:result,unmapped};
}
function rowStudy(layout,g,row,{minWidth,minHeight,maxNominalWidth}){
 const domain={x:g.x0,y:layout.levels[row],width:g.x1-g.x0,height:layout.levels[row+1]-layout.levels[row]},joint=layout.joint;
 const baselineRects=[...layout.parts.filter(p=>inside(p.nominal,domain)).map(p=>p.nominal),...layout.jointClearances.filter(p=>inside(p.rectangle,domain)).map(p=>p.rectangle)];
 const base=assess(baselineRects,joint,minWidth,minHeight);
 const alternatives=[{model:'fixed-grid',...base,cuts:layout.cuts.filter(x=>x>=g.x0&&x<=g.x1),stockSplitPolicy:null}];
 const full=partitionCell(domain,layout.openings,{joint,minWidth,minHeight});
 for(const stockSplitPolicy of ['balanced','full-left-guarded']){
  const cuts=[...splitCuts(g.x0,g.jamb,maxNominalWidth,stockSplitPolicy).slice(0,-1),...splitCuts(g.jamb,g.x1,maxNominalWidth,stockSplitPolicy)];
  const shifted=cuts.slice(1).flatMap((x,i)=>partitionCell({x:cuts[i],y:domain.y,width:x-cuts[i],height:domain.height},layout.openings,{joint,minWidth,minHeight}).rectangles);
  alternatives.push({model:'shift-redistribute',stockSplitPolicy,...assess(shifted,joint,minWidth,minHeight),cuts});
  for(const seed of full.alternatives){const nominal=seed.rectangles.flatMap(r=>stockSplit(r,maxNominalWidth,stockSplitPolicy));alternatives.push({model:'patch-retile',stockSplitPolicy,seed:seed.strategy,...assess(nominal,joint,minWidth,minHeight),cuts:null});}
 }
 for(const a of alternatives){if(a.summary.nominalMaterialAreaMm2!==full.nominalMaterialAreaMm2)throw Error('Local patch nominal complement drift');if(a.parts.some(p=>p.width>maxNominalWidth-joint||p.height>layout.panelHeight))throw Error('Local patch exceeds stock after seam redistribution');}
 return {row,domain,alternatives,openingUnionAreaMm2:area(domain)-full.nominalMaterialAreaMm2};
}
function topology(layout,patches){
 const ys=[...new Set([0,layout.height,...layout.levels,...patches.flatMap(p=>p.nominal.flatMap(r=>[r.y,r.y+r.height]))])].sort((a,b)=>a-b),bands=[];
 for(let i=0;i<ys.length-1;i++){
  const y=ys[i],top=ys[i+1],active=patches.filter(p=>p.model!=='fixed-grid'&&p.domain.y<=y&&p.domain.y+p.domain.height>=top);
  const cuts=new Set(layout.cuts.filter(x=>!active.some(p=>x>p.domain.x&&x<p.domain.x+p.domain.width)));
  for(const p of active){cuts.add(p.domain.x);cuts.add(p.domain.x+p.domain.width);for(const r of p.nominal)if(r.y<=y&&r.y+r.height>=top){cuts.add(r.x);cuts.add(r.x+r.width);}}
  const list=[...cuts].sort((a,b)=>a-b),last=bands.at(-1);
  if(last&&last.y+last.height===y&&JSON.stringify(last.cuts)===JSON.stringify(list))last.height+=top-y;
  else bands.push({y,height:top-y,cuts:list,source:'V21 physical rectangle edge topology candidate',approved:false});
 }
 const openings=layout.openings.map(({id,x,y,width,height})=>({id,x,y,width,height})).sort((a,b)=>String(a.id).localeCompare(String(b.id))||a.x-b.x||a.y-b.y||a.width-b.width||a.height-b.height);
 return {bands,generatedFrom:{width:layout.width,height:layout.height,cuts:[...layout.cuts],levels:[...layout.levels],openings},patches:patches.map(p=>({id:p.id,groupId:p.groupId,row:p.row,domain:p.domain,model:p.model,stockSplitPolicy:p.stockSplitPolicy,nominalTailGuardMm:p.stockSplitPolicy==='full-left-guarded'?300:null,oldCut:p.oldCut,jamb:p.jamb,nominal:p.nominal,jointSegments:p.jointSegments,approved:false,readyToCut:false})),approved:false,approval:false,requiresApertureClipping:true,supportStatus:'Candidate local vertical support/EPDM segments; do not retain old internal axis beside replacement axes. Widths, anchors, row-end/T-joint support and aperture clipping require owner integration/RFI.'};
}
export function studyLocalJoints(layout,{model='best',stockSplitPolicy='full-left-guarded',minWidth=layout.validity?.minWidth??50,minHeight=layout.validity?.minHeight??160}={}){
 if(!['balanced','full-left-guarded'].includes(stockSplitPolicy))throw Error('Unknown stock split policy');
 if(!['best','fixed-grid','shift-redistribute','patch-retile'].includes(model))throw Error('Unknown local joint model');
 if(layout.joint!==8||layout.panelHeight!==1250||layout.module!==1200||layout.rectanglePartition!=='best'||!layout.parts.every(p=>p.nominal)||layout.parts.some(p=>p.points)||![minWidth,minHeight].every(n=>Number.isSafeInteger(n)&&n>=0))throw Error('V21 study requires canonical V20 rectangular1192x1250/module1200/joint8 layout with nominal rectangles');
 const discovery=groups(layout,minWidth),patches=[],studies=[];
 for(const g of discovery.groups)for(const row of g.rows){const study=rowStudy(layout,g,row,{minWidth,minHeight,maxNominalWidth:1200});
  let chosen=study.alternatives[0];for(const a of study.alternatives){if(a.model!=='fixed-grid'&&a.stockSplitPolicy!==stockSplitPolicy)continue;if(model!=='best'&&a.model!==model)continue;if(model!=='best'&&chosen.model!==model||compare(a.score,chosen.score)<0)chosen=a;}
  const id=`${g.id}-R${String(row+1).padStart(3,'0')}`;
  const patch={...chosen,id,groupId:g.id,row,domain:study.domain,jamb:g.jamb,oldCut:g.oldCut,openingIds:g.openingIds,jointSegments:jointSegments(chosen.nominal,8),approved:false,readyToCut:false};patches.push(patch);studies.push({...study,id,group:g.id,chosenModel:chosen.model,chosenSeed:chosen.seed??null,chosenStockSplitPolicy:chosen.stockSplitPolicy});
 }
 const modified=patches.filter(p=>p.model!=='fixed-grid');
 const removed=layout.parts.filter(p=>modified.some(q=>inside(p.nominal,q.domain))),outside=layout.parts.filter(p=>!removed.includes(p)),parts=[...outside];
 for(const patch of modified)patch.parts.forEach((p,i)=>{
  const nominal=p.nominal,centre=nominal.x+nominal.width/2;
  const id=`${patch.id}-P${String(i+1).padStart(3,'0')}`,cell=layout.cuts.findIndex((x,c)=>c<layout.cuts.length-1&&centre>=x&&centre<layout.cuts[c+1]);
  const sourceCells=layout.cuts.slice(1).flatMap((x,c)=>x>nominal.x&&layout.cuts[c]<nominal.x+nominal.width?[c]:[]);
  const sourceColours=sourceCells.map(c=>{const x=(layout.cuts[c]+layout.cuts[c+1])/2;return layout.accentBands.some(([a,b])=>x>=a&&x<b)?'P070':'P222';});
  if(new Set(sourceColours).size!==1)throw Error(`Ambiguous source cell colour across ${id}: explicit approved colour-boundary split or held patch required`);
  const colour=sourceColours[0];
  parts.push({...p,id,partitionPartId:id,facade:layout.facade,floor:patch.row,row:patch.row,cell,localPatchId:patch.id,sourceCellIds:sourceCells.map(c=>`${layout.facade}-GRID-C${String(c+1).padStart(3,'0')}-R${String(patch.row+1).padStart(3,'0')}`),colour,colourPolicy:'source baseline grid-cell centre; cross-cell styles must agree',grain:'вертикально',quantityEligible:true,inspectionRepresentation:false,approved:false,readyToCut:false});
 });
 parts.sort(order);
 const outsideConsumed=layout.jointClearances.filter(p=>!modified.some(q=>inside(p.rectangle,q.domain))),nominal=[...outside.map(p=>p.nominal),...outsideConsumed.map(p=>p.rectangle),...modified.flatMap(p=>p.nominal)],combined=assess(nominal,8,minWidth,minHeight);
 const baseline=assess([...layout.parts.map(p=>p.nominal),...layout.jointClearances.map(p=>p.rectangle)],8,minWidth,minHeight);
 const jointClearances=[...outsideConsumed,...modified.flatMap(p=>p.consumed.map(c=>({kind:'consumed-by-joint',rectangle:{...c.nominal},areaMm2:c.areaMm2,reason:c.reason,floor:p.row,localPatchId:p.id,finishedWidth:c.nominal.width-8,finishedHeight:c.nominal.height-8})))];
 return {facade:layout.facade,width:layout.width,height:layout.height,levels:[...layout.levels],cuts:[...layout.cuts],parts,nominalRectangles:nominal,jointClearances,consumed:jointClearances.map(c=>({nominal:c.rectangle,areaMm2:area(c.rectangle),localPatchId:c.localPatchId??null,reason:c.reason??'Unchanged baseline joint clearance'})),removedPartIds:removed.map(p=>p.id),summary:combined.summary,baseline:baseline.summary,groups:discovery.groups,unmappedThinPartIds:discovery.unmapped,studies,patches,localJointTopology:topology(layout,patches),stockSplitPolicy,nominalTailGuardMm:stockSplitPolicy==='full-left-guarded'?300:null,stockSplitAuthority:'Candidate left-stock preference with nominal300 terminal guard; not a manufacturer minimum or global optimum',objective:['minimize explicitly joint-consumed nominal material','minimize conservative50/160 warnings','prefer finishedwidth>=100mm','fewer finishedrectangles','less joint clearance area'],finiteDomainOptimum:false,scope:'Bounded two-cell affected-course rectangle candidates; unchanged exterior grid outside local patches. Explicit full-left-guarded300 or balanced stock subdivision and seed comparison, not exhaustive global topology optimization.',manufacturerBoundary:'Patina WOOD p17 rectangular sections/smallboards conditions remain separate. No L-part fabrication, fixing design, structural or purchasing approval.',approved:false,readyToCut:false};
}
