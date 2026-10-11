export function dimensionAnchorVisible({x,y,z},width,height){
 return [x,y,z,width,height].every(Number.isFinite)&&width>0&&height>0&&z>=-1&&z<=1&&x>=0&&x<=width&&y>=0&&y<=height;
}
const overlaps=(a,b,gap)=>a.left<b.left+b.width+gap&&a.left+a.width+gap>b.left&&a.top<b.top+b.height+gap&&a.top+a.height+gap>b.top;

// A bounded visible subset; every omitted label remains in the source list.
// Never clamp an overfull chain back onto another label or enlarge the viewport.
export function placeDimensionLabels(items,width,height,{margin=8,gap=4,obstacles=[]}={}){
 if(![width,height,margin,gap].every(Number.isFinite)||width<=2*margin||height<=2*margin)return [];
 const boxes=[],blocked=obstacles.filter(b=>[b.left,b.top,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0);
 const ordered=items.map((item,index)=>({...item,index})).filter(b=>[b.x,b.y,b.width,b.height].every(Number.isFinite)&&b.width>0&&b.height>0)
  .sort((a,b)=>(b.priority??0)-(a.priority??0)||a.y-b.y||a.index-b.index);
 for(const item of ordered){
  if(item.width>width-2*margin||item.height>height-2*margin)continue;
  const left=Math.max(margin,Math.min(width-margin-item.width,item.x)),top=Math.max(margin,Math.min(height-margin-item.height,item.y));
  const occupied=[...blocked,...boxes],xs=new Set([left,margin,width-margin-item.width]),ys=new Set([top,margin,height-margin-item.height]);
  for(const b of occupied){xs.add(b.left-item.width-gap);xs.add(b.left+b.width+gap);ys.add(b.top-item.height-gap);ys.add(b.top+b.height+gap);}
  let best=null,cost=Infinity;
  for(const x of xs)for(const y of ys){
   if(x<margin||x+item.width>width-margin||y<margin||y+item.height>height-margin)continue;
   const candidate={...item,left:x,top:y};if(occupied.some(b=>overlaps(candidate,b,gap)))continue;
   const distance=(x-left)**2+(y-top)**2;if(distance<cost){best=candidate;cost=distance;}
  }
  if(best)boxes.push(best);
 }
 return boxes;
}

// Conservative depth rejection, then clip the shaft to the viewport. Arrowheads
// belong only to real endpoints; a clipped screen edge is not a measured end.
export function clippedDimensionSegment(a,b,width,height,{minLength=12}={}){
 if(![a.x,a.y,a.z,b.x,b.y,b.z,width,height,minLength].every(Number.isFinite)||width<=0||height<=0||a.z< -1||a.z>1||b.z< -1||b.z>1)return null;
 const dx=b.x-a.x,dy=b.y-a.y;let start=0,end=1;
 for(const [p,q] of [[-dx,a.x],[dx,width-a.x],[-dy,a.y],[dy,height-a.y]]){
  if(p===0){if(q<0)return null;continue;}
  const t=q/p;if(p<0)start=Math.max(start,t);else end=Math.min(end,t);if(start>end)return null;
 }
 const x1=a.x+start*dx,y1=a.y+start*dy,x2=a.x+end*dx,y2=a.y+end*dy;
 if(Math.hypot(x2-x1,y2-y1)<minLength)return null;
 return {x1,y1,x2,y2,arrowStart:start===0,arrowEnd:end===1};
}
