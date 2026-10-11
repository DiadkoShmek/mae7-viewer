// Start a physical blank at each colour boundary instead of leaving a pale sliver.
export function colourAlignedColumns({width,module=1200,colourRegions=[]}){
 if(!Number.isSafeInteger(width)||width<=0||!Number.isSafeInteger(module)||module<=8)throw Error('Invalid colour column dimensions');
 const edges=[...new Set([0,width,...colourRegions.flatMap(r=>[r.x,r.x+r.width])])].sort((a,b)=>a-b);
 if(edges.some(x=>!Number.isSafeInteger(x)||x<0||x>width))throw Error('Colour boundary outside facade');
 const cuts=[0],zones=[];
 for(let i=0;i<edges.length-1;i++){
  const left=edges[i],right=edges[i+1],length=right-left,count=Math.ceil(length/module),dark=colourRegions.some(r=>(left+right)/2>r.x&&(left+right)/2<r.x+r.width);
  let spans;
  if(dark)spans=Array.from({length:count},(_,j)=>Math.floor(length*(j+1)/count)-Math.floor(length*j/count));
  else {
   const rest=length-(count-1)*module,before=Math.floor((count-1)/2);
   spans=[...Array(before).fill(module),rest,...Array(count-1-before).fill(module)];
   if(rest<208&&count>1){const j=Math.min(before,count-2),sum=spans[j]+spans[j+1];spans.splice(j,2,Math.floor(sum/2),Math.ceil(sum/2));}
   if(i===0)spans.sort((a,b)=>a-b);
   if(i===edges.length-2)spans.sort((a,b)=>b-a);
  }
  let x=left;for(const span of spans){x+=span;cuts.push(x);}
  zones.push({left,right,colour:dark?'P070':'P222',spans});
 }
 return {cuts,zones,authority:'entrance-aligned colour boundary candidate; cut approval and survey pending',approved:false};
}
