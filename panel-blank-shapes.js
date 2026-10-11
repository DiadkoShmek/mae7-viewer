// Comparative whole-blank geometry. Integer millimetres, exterior view.
// Patina WOOD DIM rev02.2026 p17 recommends separate cuts around openings;
// these sharp notched contours are NOT a fabrication admission.
const key = ([x,y]) => `${x},${y}`;
const comparePoint = (a,b) => a[0]-b[0] || a[1]-b[1];
export function contourArea(points) {
 if (points.length<3) return 0;
 const [x,y]=points[0];
 return points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+(a[0]-x)*(b[1]-y)-(b[0]-x)*(a[1]-y);},0)/2;
}
// Exact rectangular tessellation of an orthogonal stock contour. These cells
// are a display triangulation, never new panels or joints. Aperture notches and
// holes remain empty, and no clearance is added at the inspection boundary.
export function panelMaterialRectangles(part,bounds) {
 const outer=part.outer??[[part.x,part.y],[part.x+part.width,part.y],[part.x+part.width,part.y+part.height],[part.x,part.y+part.height]],holes=part.holes??[];
 const rings=[outer,...holes],points=rings.flat();
 if(!bounds||![bounds.x,bounds.y,bounds.width,bounds.height,...points.flat()].every(Number.isFinite)||bounds.width<=0||bounds.height<=0)throw Error('Invalid contour projection');
 for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(a[0]!==b[0]&&a[1]!==b[1])throw Error('Contour projection requires orthogonal edges');}
 const left=Math.max(bounds.x,Math.min(...outer.map(p=>p[0]))),right=Math.min(bounds.x+bounds.width,Math.max(...outer.map(p=>p[0]))),bottom=Math.max(bounds.y,Math.min(...outer.map(p=>p[1]))),top=Math.min(bounds.y+bounds.height,Math.max(...outer.map(p=>p[1])));
 if(right<=left||top<=bottom)return [];
 const xs=[...new Set([left,right,...points.map(p=>p[0]).filter(x=>x>left&&x<right)])].sort((a,b)=>a-b),ys=[...new Set([bottom,top,...points.map(p=>p[1]).filter(y=>y>bottom&&y<top)])].sort((a,b)=>a-b);
 const inside=(x,y,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 const result=[];
 for(let j=0;j<ys.length-1;j++){let start=null;for(let i=0;i<xs.length;i++){const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2,present=i<xs.length-1&&inside(x,y,outer)&&!holes.some(r=>inside(x,y,r));if(present&&start===null)start=i;if(!present&&start!==null){const r={x:xs[start],y:ys[j],width:xs[i]-xs[start],height:ys[j+1]-ys[j]};const prior=result.find(q=>q.x===r.x&&q.width===r.width&&q.y+q.height===r.y);if(prior)prior.height+=r.height;else result.push(r);start=null;}}}
 return result;
}
function simplify(points) {
 let result=points.filter((p,i)=>i===0||key(p)!==key(points[i-1]));
 let changed=true;
 while(changed&&result.length>3){changed=false;result=result.filter((b,i)=>{const a=result[(i+result.length-1)%result.length],c=result[(i+1)%result.length];if((b[0]-a[0])*(c[1]-b[1])===(b[1]-a[1])*(c[0]-b[0])){changed=true;return false;}return true;});}
 let first=0;for(let i=1;i<result.length;i++)if(comparePoint(result[i],result[first])<0)first=i;
 return [...result.slice(first),...result.slice(0,first)];
}
function rings(component,xs,ys) {
 const edges=[];
 const add=(a,b)=>edges.push({a,b,used:false});
 for(const [i,j] of component.cells){const x=xs[i],r=xs[i+1],y=ys[j],t=ys[j+1];
  if(!component.set.has(`${i},${j-1}`))add([x,y],[r,y]);
  if(!component.set.has(`${i+1},${j}`))add([r,y],[r,t]);
  if(!component.set.has(`${i},${j+1}`))add([r,t],[x,t]);
  if(!component.set.has(`${i-1},${j}`))add([x,t],[x,y]);
 }
 const outgoing=new Map();for(const edge of edges){const k=key(edge.a);if(!outgoing.has(k))outgoing.set(k,[]);outgoing.get(k).push(edge);}
 const result=[];
 for(const start of edges){if(start.used)continue;const points=[];let edge=start;
  for(let count=0;;count++){
   if(count>edges.length)throw Error('Unclosed blank boundary');
   edge.used=true;points.push(edge.a);if(key(edge.b)===key(start.a))break;
   const candidates=(outgoing.get(key(edge.b))||[]).filter(e=>!e.used);if(!candidates.length)throw Error('Missing blank boundary continuation');
   // Keep the material on the left. At diagonal contacts the largest left
   // turn closes each boundary rather than manufacturing a zero-width bridge.
   const dx=edge.b[0]-edge.a[0],dy=edge.b[1]-edge.a[1];
   candidates.sort((a,b)=>{const angle=e=>Math.atan2(dx*(e.b[1]-e.a[1])-dy*(e.b[0]-e.a[0]),dx*(e.b[0]-e.a[0])+dy*(e.b[1]-e.a[1]));return angle(b)-angle(a)||comparePoint(a.b,b.b);});edge=candidates[0];
  }
  const ring=simplify(points);if(contourArea(ring)!==0)result.push(ring);
 }
 return result;
}
function materialRuns(component,xs,ys,minWidth,minHeight) {
 const narrow=[];let minimumHorizontalRunMm=Infinity,minimumVerticalRunMm=Infinity;
 for(const axis of ['x','y']){
  const intervals=axis==='x'?ys:xs,along=axis==='x'?xs:ys;
  for(let s=0;s<intervals.length-1;s++){
   let start=null;
   for(let i=0;i<along.length;i++){
    const present=i<along.length-1&&component.set.has(axis==='x'?`${i},${s}`:`${s},${i}`);
    if(present&&start===null)start=i;
    if(!present&&start!==null){const size=along[i]-along[start];if(axis==='x')minimumHorizontalRunMm=Math.min(minimumHorizontalRunMm,size);else minimumVerticalRunMm=Math.min(minimumVerticalRunMm,size);
     const minimum=axis==='x'?minWidth:minHeight;if(size<minimum)narrow.push({axis,sizeMm:size,minimumMm:minimum,fromMm:along[start],toMm:along[i],crossSectionMm:[intervals[s],intervals[s+1]],status:'geometric material run; not a structural neck calculation'});start=null;
    }
   }
  }
 }
 return {minimumHorizontalRunMm,minimumVerticalRunMm,narrowNecks:narrow};
}
function style(layout,cell,floor,blank,sourceCellId) {
 const explicit=layout.cellStyles?.[sourceCellId];if(explicit)return {colour:explicit.colour??null,grain:explicit.grain??null,policy:'explicit-cell-style'};
 const source=(layout.parts||[]).filter(p=>p.cell===cell&&p.floor===floor);
 const grains=[...new Set(source.map(p=>p.grain).filter(Boolean))];let colour;
 if(layout.blankColourPolicy==='cell-centre'){
  if(!Array.isArray(layout.accentBands))throw Error('Cell-centre blank colour requires accentBands');
  const centre=blank.x+blank.width/2;colour=layout.accentBands.some(([a,b])=>centre>=a&&centre<b)?'P070':'P222';
 }else {const colours=[...new Set(source.map(p=>p.colour).filter(Boolean))];colour=colours.length===1?colours[0]:layout.colour??null;}
 return {colour,grain:grains.length===1?grains[0]:layout.grain??null,policy:layout.blankColourPolicy||'unique-source-cell-style'};
}
export function blankContours(layout) {
 const {width,height,joint,cuts,levels,openings=[],colourRegions=[],facade='SE'}=layout;
 const integer=n=>Number.isSafeInteger(n);
 if(![width,height,joint].every(integer)||width<=0||height<=0||joint<0||joint%2||!Number.isSafeInteger(width*height))throw Error('Blank geometry requires integer dimensions and an even joint');
 for(const [values,end] of [[cuts,width],[levels,height]])if(!Array.isArray(values)||values.length<2||values[0]!==0||values.at(-1)!==end||values.some((v,i)=>!integer(v)||(i&&v<=values[i-1])))throw Error('Invalid blank grid boundaries');
 if(layout.panelHeight!==undefined&&(!integer(layout.panelHeight)||layout.panelHeight<0))throw Error('Invalid finished panel height');
 const half=joint/2,minWidth=layout.validity?.minWidth??50,minHeight=layout.validity?.minHeight??160;
 if(![minWidth,minHeight].every(n=>integer(n)&&n>=0))throw Error('Invalid necessary feature limits');
 const obstacles=openings.map(o=>{if(![o.x,o.y,o.width,o.height].every(integer)||o.width<=0||o.height<=0||![o.x+o.width+half,o.y+o.height+half].every(integer))throw Error('Invalid blank opening');return {x0:o.x-half,y0:o.y-half,x1:o.x+o.width+half,y1:o.y+o.height+half};});
 for(const r of colourRegions){
  if(![r.x,r.y,r.width,r.height].every(integer)||r.width<=0||r.height<=0||typeof r.colour!=='string')throw Error('Invalid physical colour region');
  // A single FC blank cannot have two product colours. Colour edges therefore
  // create real local 8mm joints; the1192 grid elsewhere stays untouched.
  for(const x of [r.x,r.x+r.width])obstacles.push({x0:x-half,x1:x+half,y0:r.y-half,y1:r.y+r.height+half});
  for(const y of [r.y,r.y+r.height])obstacles.push({x0:r.x-half,x1:r.x+r.width+half,y0:y-half,y1:y+half});
 }
 const result=[];
 for(let cell=0;cell<cuts.length-1;cell++)for(let floor=0;floor<levels.length-1;floor++){
  const blank={x:cuts[cell]+half,y:levels[floor]+half,width:cuts[cell+1]-cuts[cell]-joint,height:levels[floor+1]-levels[floor]-joint};if(blank.width<=0||blank.height<=0)continue;
  const x0=blank.x,y0=blank.y,x1=x0+blank.width,y1=y0+blank.height;
  const clips=obstacles.filter(o=>o.x0<x1&&o.x1>x0&&o.y0<y1&&o.y1>y0).map(o=>({x0:Math.max(x0,o.x0),y0:Math.max(y0,o.y0),x1:Math.min(x1,o.x1),y1:Math.min(y1,o.y1)}));
  const xs=[...new Set([x0,x1,...clips.flatMap(o=>[o.x0,o.x1])])].sort((a,b)=>a-b),ys=[...new Set([y0,y1,...clips.flatMap(o=>[o.y0,o.y1])])].sort((a,b)=>a-b),remaining=new Set();
  for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++){const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;if(!clips.some(o=>x>o.x0&&x<o.x1&&y>o.y0&&y<o.y1))remaining.add(`${i},${j}`);}
  const components=[];
  while(remaining.size){const seed=remaining.values().next().value,queue=[seed],set=new Set([seed]),cells=[];remaining.delete(seed);
   for(let q=0;q<queue.length;q++){const [i,j]=queue[q].split(',').map(Number);cells.push([i,j]);for(const [a,b] of [[i-1,j],[i+1,j],[i,j-1],[i,j+1]]){const k=`${a},${b}`;if(remaining.delete(k)){set.add(k);queue.push(k);}}}
   const boundary=rings({cells,set},xs,ys),outers=boundary.filter(r=>contourArea(r)>0),holes=boundary.filter(r=>contourArea(r)<0);if(outers.length!==1)throw Error('Connected positive-area blank needs exactly one outer boundary');
   const outer=outers[0],bbox={x:Math.min(...outer.map(p=>p[0])),y:Math.min(...outer.map(p=>p[1]))};bbox.width=Math.max(...outer.map(p=>p[0]))-bbox.x;bbox.height=Math.max(...outer.map(p=>p[1]))-bbox.y;
   const areaMm2=cells.reduce((a,[i,j])=>a+(xs[i+1]-xs[i])*(ys[j+1]-ys[j]),0);if(contourArea(outer)+holes.reduce((a,h)=>a+contourArea(h),0)!==areaMm2)throw Error('Blank profile area does not close');
   const sample=cells[0],sampleX=(xs[sample[0]]+xs[sample[0]+1])/2,sampleY=(ys[sample[1]]+ys[sample[1]+1])/2;
   const region=colourRegions.find(r=>sampleX>r.x&&sampleX<r.x+r.width&&sampleY>r.y&&sampleY<r.y+r.height);
   components.push({colourRegion:colourRegions.length?(region?.id??'background'):null,regionColour:colourRegions.length?(region?.colour??'P222'):null,outer,holes:holes.sort((a,b)=>comparePoint(a[0],b[0])),bbox,areaMm2,...materialRuns({cells,set},xs,ys,minWidth,minHeight)});
  }
  components.sort((a,b)=>a.bbox.x-b.bbox.x||a.bbox.y-b.bbox.y||a.bbox.width-b.bbox.width||a.bbox.height-b.bbox.height);
  const sourceCellId=`${facade}-GRID-C${String(cell+1).padStart(3,'0')}-R${String(floor+1).padStart(3,'0')}`,sty=style(layout,cell,floor,blank,sourceCellId);
  components.forEach((p,i)=>{
   const sty=p.regionColour?{colour:p.regionColour,grain:layout.grain??'вертикально',policy:'source-colour-region-separate-physical-part'}:style(layout,cell,floor,blank,sourceCellId);
   const warnings=[];if(p.narrowNecks.some(n=>n.axis==='x'))warnings.push(`матеріальна смуга < ${minWidth} мм: необхідні крайові відстані не перевірені`);if(p.narrowNecks.some(n=>n.axis==='y'))warnings.push(`матеріальна смуга < ${minHeight} мм: необхідні торцеві відстані не перевірені`);
   if(sty.colour===null)warnings.push('колір цілої заготовки неоднозначний у джерельній комірці');if(sty.grain===null)warnings.push('напрям фактури цілої заготовки не визначений');
   const vertices=new Set();let touches=false;for(const ring of [p.outer,...p.holes])for(const point of ring){if(vertices.has(key(point)))touches=true;vertices.add(key(point));}if(touches)warnings.push('контури дотикаються в точці: нульова шийка, топологію й кріплення не погоджено');
   const id=`${sourceCellId}-C${String(i+1).padStart(2,'0')}`;
   result.push({...p,id,facade,cell,floor,row:floor,sourceCellId,sourceFloorId:`${facade}-GRID-R${String(floor+1).padStart(3,'0')}`,sourceLevelInterval:[levels[floor],levels[floor+1]],blank:{...blank},panelHeight:layout.panelHeight??0,x:p.bbox.x,y:p.bbox.y,width:p.bbox.width,height:p.bbox.height,area:p.areaMm2/1e6,points:p.outer,contours:[p.outer,...p.holes],colour:sty.colour,grain:sty.grain,colourPolicy:sty.policy,warnings,openingClearanceMm:half,jointMm:joint,componentCountInCell:components.length,status:'COMPARATIVE_NOTCHED_BLANK_CANDIDATE',manufacturerBoundary:'Patina WOOD DIM rev02.2026 p17 recommends separate cuts; notched mode is comparative only',cornerRadiusMm:null,approved:false,readyToCut:false});
  });
 }
 return result;
}
