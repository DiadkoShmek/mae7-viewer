// Candidate marking lines for finishing convex gable blanks. Local origin is
// the blank's bottom-left; sheet coordinates are top-left. Not machine G-code.
export function profileCuts(part){
 if(!part.points)return [];
 const eps=1e-7,w=part.width,h=part.height,points=part.points.map(([x,y])=>[x-part.x,y-part.y]);
 const centre=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
 return points.flatMap((a,i)=>{const b=points[(i+1)%points.length];
  if(Math.hypot(b[0]-a[0],b[1]-a[1])<eps)return [];
  const boundary=Math.abs(a[0])<eps&&Math.abs(b[0])<eps||Math.abs(a[0]-w)<eps&&Math.abs(b[0]-w)<eps||Math.abs(a[1])<eps&&Math.abs(b[1])<eps||Math.abs(a[1]-h)<eps&&Math.abs(b[1]-h)<eps;
  if(boundary)return [];
  const cross=(b[0]-a[0])*(centre[1]-a[1])-(b[1]-a[1])*(centre[0]-a[0]);
  return [{part:part.id,edge:i+1,from:a,to:b,length:Math.hypot(b[0]-a[0],b[1]-a[1]),angleDegrees:Math.atan2(b[1]-a[1],b[0]-a[0])*180/Math.PI,keepSide:cross>=0?'left':'right',status:'CANDIDATE_MARKING_LINE_VERIFY_BEFORE_CUTTING'}];
 });
}
