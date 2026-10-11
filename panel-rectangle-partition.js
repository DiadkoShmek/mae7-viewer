// Integer-mm rectangle studies only. Patina WOOD DIM rev02.2026 p17
// recommends sections around openings; this is not a fixing/fabrication design.
const rectOrder=(a,b)=>a.y-b.y||a.x-b.x||a.height-b.height||a.width-b.width;
const area=r=>r.width*r.height;
const compare=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
const plus=(a,b)=>a.map((n,i)=>n+b[i]);
function settings(options){
 const o={joint:8,minWidth:50,minHeight:160,maxStates:50000,maxAtoms:64,...options};
 if(![o.joint,o.minWidth,o.minHeight,o.maxStates,o.maxAtoms].every(Number.isSafeInteger)||o.joint<0||o.joint%2||o.minWidth<0||o.minHeight<0||o.maxStates<1||o.maxAtoms<1||o.maxAtoms>256)throw Error('Invalid integer rectangle-partition settings');
 return o;
}
function validRect(r){return r&&[r.x,r.y,r.width,r.height,r.x+r.width,r.y+r.height].every(Number.isSafeInteger)&&r.width>0&&r.height>0&&Number.isSafeInteger(area(r));}
function arrangement(cell,openings){
 if(!validRect(cell)||!Array.isArray(openings)||openings.some(o=>!validRect(o)))throw Error('Expected integer positive cell/opening rectangles');
 const x1=cell.x+cell.width,y1=cell.y+cell.height;
 const clips=openings.map(o=>({x0:Math.max(cell.x,o.x),y0:Math.max(cell.y,o.y),x1:Math.min(x1,o.x+o.width),y1:Math.min(y1,o.y+o.height)})).filter(o=>o.x0<o.x1&&o.y0<o.y1);
 // Duplicate apertures and their input order cannot change this arrangement.
 const xs=[...new Set([cell.x,x1,...clips.flatMap(o=>[o.x0,o.x1])])].sort((a,b)=>a-b),ys=[...new Set([cell.y,y1,...clips.flatMap(o=>[o.y0,o.y1])])].sort((a,b)=>a-b);
 let nx=xs.length-1,ny=ys.length-1,present=Array(nx*ny).fill(false);let nominalMaterialAreaMm2=0;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  // Full-atom containment avoids midpoint rounding at large integer origins.
  if(!clips.some(o=>xs[i]>=o.x0&&xs[i+1]<=o.x1&&ys[j]>=o.y0&&ys[j+1]<=o.y1)){present[j*nx+i]=true;nominalMaterialAreaMm2+=(xs[i+1]-xs[i])*(ys[j+1]-ys[j]);}
 }
 // Remove aperture edges hidden inside the UNION. Equivalent unions with a
 // different rectangle decomposition must use the same boundary lattice.
 for(let i=1;i<nx;){if(Array.from({length:ny},(_,j)=>present[j*nx+i]===present[j*nx+i-1]).every(Boolean)){
   const next=[];for(let j=0;j<ny;j++)for(let k=0;k<nx;k++)if(k!==i)next.push(present[j*nx+k]);xs.splice(i,1);nx--;present=next;
  }else i++;}
 for(let j=1;j<ny;){if(Array.from({length:nx},(_,i)=>present[j*nx+i]===present[(j-1)*nx+i]).every(Boolean)){
   present.splice(j*nx,nx);ys.splice(j,1);ny--;
  }else j++;}
 return {xs,ys,nx,ny,present,nominalMaterialAreaMm2};
}
function stripPartition(a,vertical){
 const cross=vertical?a.xs:a.ys,along=vertical?a.ys:a.xs,rects=[],active=new Map();
 for(let c=0;c<cross.length-1;c++){
  const runs=[];let start=null;
  for(let k=0;k<along.length;k++){
   const present=k<along.length-1&&a.present[vertical?k*a.nx+c:c*a.nx+k];
   if(present&&start===null)start=k;
   if(!present&&start!==null){runs.push([along[start],along[k]]);start=null;}
  }
  const next=new Map();
  for(const [lo,hi] of runs){const key=`${lo}:${hi}`,old=active.get(key);
   if(old){if(vertical)old.width=cross[c+1]-old.x;else old.height=cross[c+1]-old.y;next.set(key,old);}
   else{const r=vertical?{x:cross[c],y:lo,width:cross[c+1]-cross[c],height:hi-lo}:{x:lo,y:cross[c],width:hi-lo,height:cross[c+1]-cross[c]};rects.push(r);next.set(key,r);}
  }
  active.clear();for(const [k,r] of next)active.set(k,r);
 }
 return rects.sort(rectOrder);
}
function cost(r,o){
 const w=r.width-o.joint,h=r.height-o.joint,consumed=w<=0||h<=0;
 // Never obtain a lower warning count by deliberately consuming more material.
 return [consumed?area(r):0,!consumed&&(w<o.minWidth||h<o.minHeight)?1:0,1,consumed?0:area(r)-w*h];
}
function assess(rectangles,o,name,proof={}){
 const parts=[],consumed=[],score=[0,0,0,0];let finishedAreaMm2=0;
 rectangles=[...rectangles].sort(rectOrder);
 for(const r of rectangles){const c=cost(r,o);for(let i=0;i<4;i++)score[i]+=c[i];const width=r.width-o.joint,height=r.height-o.joint;
  if(width<=0||height<=0){consumed.push({nominal:{...r},areaMm2:area(r),reason:'Nominal material strip consumed by the explicitly applied half-joint on each edge'});continue;}
  const warnings=[];if(width<o.minWidth)warnings.push(`width ${width} mm < necessary ${o.minWidth} mm`);if(height<o.minHeight)warnings.push(`height ${height} mm < necessary ${o.minHeight} mm`);
  parts.push({nominal:{...r},x:r.x+o.joint/2,y:r.y+o.joint/2,width,height,areaMm2:width*height,warnings,approved:false,readyToCut:false});finishedAreaMm2+=width*height;
 }
 return {strategy:name,rectangles,parts,consumed,score,rectangleCount:rectangles.length,finishedPartCount:parts.length,warningPartCount:score[1],consumedNominalAreaMm2:score[0],jointLossAreaMm2:score[3],finishedAreaMm2,...proof};
}
function exactPartition(a,o){
 const n=a.nx*a.ny;if(n>o.maxAtoms)return {complete:false,reason:'Atomic arrangement exceeds declared maxAtoms',states:0};
 let full=0n;for(let k=0;k<n;k++)if(a.present[k])full|=1n<<BigInt(k);
 const candidates=new Map();
 for(let j=0;j<a.ny;j++)for(let i=0;i<a.nx;i++)if(a.present[j*a.nx+i]){
  const list=[];
  for(let h=1;j+h<=a.ny;h++)for(let w=1;i+w<=a.nx;w++){
   let mask=0n,ok=true;for(let y=j;y<j+h&&ok;y++)for(let x=i;x<i+w;x++){const k=y*a.nx+x;if(!a.present[k]){ok=false;break;}mask|=1n<<BigInt(k);}
   if(ok){const r={x:a.xs[i],y:a.ys[j],width:a.xs[i+w]-a.xs[i],height:a.ys[j+h]-a.ys[j]};list.push({r,mask,cost:cost(r,o)});}
  }
  list.sort((p,q)=>compare(p.cost,q.cost)||area(q.r)-area(p.r)||rectOrder(p.r,q.r));candidates.set(j*a.nx+i,list);
 }
 const memo=new Map();let states=0;const limit={};
 function solve(mask){if(mask===0n)return {score:[0,0,0,0],rectangles:[]};if(memo.has(mask))return memo.get(mask);if(++states>o.maxStates)throw limit;
  let first=0;while(!(mask&(1n<<BigInt(first))))first++;
  let best=null;
  // Row-major first remaining atom fixes the lower-left corner of its
  // rectangle. Enumerating all extents is complete on this boundary lattice.
  for(const c of candidates.get(first)){if((mask&c.mask)!==c.mask)continue;const tail=solve(mask^c.mask),score=plus(c.cost,tail.score);
   if(!best||compare(score,best.score)<0)best={score,rectangles:[c.r,...tail.rectangles]};
  }
  memo.set(mask,best);return best;
 }
 try{return {...solve(full),complete:true,states};}catch(e){if(e!==limit)throw e;return {complete:false,reason:'Exact search exceeded declared maxStates; strip alternatives remain exact covers, not optimal claims',states};}
}
export const partitionObjective=['less nominal material consumed by joints','fewer finished pieces below necessary limits','fewer nominal rectangles','less joint clearance area'];
export function partitionCell(cell,openings=[],options={}){
 const o=settings(options),a=arrangement(cell,openings);
 const alternatives=[assess(stripPartition(a,true),o,'vertical-first'),assess(stripPartition(a,false),o,'horizontal-first')];
 const exact=exactPartition(a,o);if(exact.complete)alternatives.push(assess(exact.rectangles,o,'global-cell',{optimalOnApertureBoundaryLattice:true,searchStates:exact.states}));
 let chosen=alternatives[0];for(const c of alternatives)if(compare(c.score,chosen.score)<0||(compare(c.score,chosen.score)===0&&c.strategy==='global-cell'))chosen=c;
 if(options.strategy&&options.strategy!=='best'){chosen=alternatives.find(c=>c.strategy===options.strategy);if(!chosen)throw Error('Requested strategy unavailable: '+options.strategy);}
 for(const c of alternatives){const nominal=c.rectangles.reduce((s,r)=>s+area(r),0);if(nominal!==a.nominalMaterialAreaMm2||c.finishedAreaMm2+c.jointLossAreaMm2+c.consumedNominalAreaMm2!==nominal)throw Error('Rectangle partition conservation failure');}
 return {...chosen,cell:{...cell},jointMm:o.joint,openingClearanceMm:o.joint/2,nominalMaterialAreaMm2:a.nominalMaterialAreaMm2,openingUnionAreaMm2:area(cell)-a.nominalMaterialAreaMm2,alternatives,objective:partitionObjective,search:{complete:exact.complete,states:exact.states,reason:exact.reason??null,maxStates:o.maxStates,maxAtoms:o.maxAtoms},approved:false,readyToCut:false,manufacturerBoundary:'Patina WOOD DIM rev02.2026 p17 recommends separate sections and discusses 100–150 mm small boards; 50/160 here are necessary project prefilters only, not universal manufacturer rejection/approval. Fixing, products and fabrication remain unapproved'};
}
export function partitionLayout(layout,options={}){
 const {width,height,cuts,levels,openings=[],facade='SE'}=layout,o=settings({joint:layout.joint,minWidth:layout.validity?.minWidth??50,minHeight:layout.validity?.minHeight??160,...options});
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||!Number.isSafeInteger(width*height))throw Error('Invalid rectangle facade dimensions');
 if(layout.roofBoundary||layout.parts?.some(p=>p.points||p.contours))throw Error('Rectangle partition does not clip roof/gable/profile boundaries');
 if(layout.blankColourPolicy==='cell-centre'&&!Array.isArray(layout.accentBands))throw Error('Cell-centre colour requires explicit accentBands');
 for(const [values,end] of [[cuts,width],[levels,height]])if(!Array.isArray(values)||values[0]!==0||values.at(-1)!==end||values.length<2||values.some((v,i)=>!Number.isSafeInteger(v)||(i&&v<=values[i-1])))throw Error('Invalid rectangle facade grid');
 const cells=[],parts=[],consumed=[];
 for(let cell=0;cell<cuts.length-1;cell++)for(let floor=0;floor<levels.length-1;floor++){
  const nominal={x:cuts[cell],y:levels[floor],width:cuts[cell+1]-cuts[cell],height:levels[floor+1]-levels[floor]},result=partitionCell(nominal,openings,o),sourceCellId=`${facade}-GRID-C${String(cell+1).padStart(3,'0')}-R${String(floor+1).padStart(3,'0')}`;
  const source=(layout.parts||[]).filter(p=>p.cell===cell&&p.floor===floor),colours=[...new Set(source.map(p=>p.colour).filter(Boolean))],grains=[...new Set(source.map(p=>p.grain).filter(Boolean))];
  const explicit=layout.cellStyles?.[sourceCellId];
  const colour=explicit?explicit.colour??null:layout.blankColourPolicy==='cell-centre'?(layout.accentBands.some(([a,b])=>nominal.x+nominal.width/2>=a&&nominal.x+nominal.width/2<b)?'P070':'P222'):colours.length===1?colours[0]:layout.colour??null,grain=explicit?explicit.grain??null:grains.length===1?grains[0]:layout.grain??null;
  const record={...result,facade,cell,floor,row:floor,sourceCellId,sourceLevelInterval:[levels[floor],levels[floor+1]],colour,grain};cells.push(record);
  result.parts.forEach((p,i)=>parts.push({...p,id:`${sourceCellId}-P${String(i+1).padStart(3,'0')}`,facade,cell,floor,row:floor,sourceCellId,sourceFloorId:`${facade}-GRID-R${String(floor+1).padStart(3,'0')}`,sourceLevelInterval:record.sourceLevelInterval,colour,grain,jointMm:o.joint,stockFit:p.width<=nominal.width-o.joint&&p.height<=nominal.height-o.joint,status:'RECTANGULAR_PARTITION_CANDIDATE',quantityEligible:true,inspectionRepresentation:false,approved:false,readyToCut:false}));
  consumed.push(...result.consumed.map(p=>({...p,sourceCellId,cell,floor})));
 }
 const summary={parts:parts.length,warningParts:parts.filter(p=>p.warnings.length).length,nominalRectangles:cells.reduce((s,c)=>s+c.rectangleCount,0),nominalMaterialAreaMm2:cells.reduce((s,c)=>s+c.nominalMaterialAreaMm2,0),finishedAreaMm2:cells.reduce((s,c)=>s+c.finishedAreaMm2,0),jointLossAreaMm2:cells.reduce((s,c)=>s+c.jointLossAreaMm2,0),consumedNominalAreaMm2:cells.reduce((s,c)=>s+c.consumedNominalAreaMm2,0),consumedStrips:consumed.length,allCellSearchesComplete:cells.every(c=>c.search.complete)};
 return {facade,width,height,joint:o.joint,cuts:[...cuts],levels:[...levels],cells,parts,consumed,summary,objective:partitionObjective,globalFacadeStockOptimum:false,approved:false,readyToCut:false};
}
