// Preserve the existing tilted8mm envelope, cutting only its wall-facing end.
// The4mm façade clearance is a review candidate, not a glazing supplier detail.
export const balconyCanopySpec=Object.freeze({offset:.105,angle:.04,glass:.008,tape:.002,section:[.050,.050,.003],approved:false});
export function canopyUnderside({depth,top},z){const s=balconyCanopySpec;return top+s.offset-Math.tan(s.angle)*(z-depth/2)-s.glass/2/Math.cos(s.angle);}
export function balconyCanopyGeometry(THREE,{width,depth,top,wallPlane=.033,angle=balconyCanopySpec.angle}){
 const box=new THREE.BoxGeometry(width+.12,.008,depth+.12).toNonIndexed();box.rotateX(angle);box.translate(0,top+balconyCanopySpec.offset,depth/2);
 const a=box.getAttribute('position'),vertices=[],boundary=[],push=(p,q,r)=>vertices.push(...p,...q,...r);
 for(let i=0;i<a.count;i+=3){const ps=[0,1,2].map(j=>[a.getX(i+j),a.getY(i+j),a.getZ(i+j)]),out=[];for(let j=0;j<3;j++){const p=ps[j],q=ps[(j+1)%3],fp=p[2]-wallPlane,fq=q[2]-wallPlane;if(fp>=0)out.push(p);if((fp<0&&fq>0)||(fp>0&&fq<0)){const t=fp/(fp-fq),hit=p.map((v,k)=>v+t*(q[k]-v));hit[2]=wallPlane;out.push(hit);boundary.push(hit);}}for(let j=1;j<out.length-1;j++)push(out[0],out[j],out[j+1]);}
 const unique=[...new Map(boundary.map(p=>[p.map(v=>v.toFixed(9)).join(','),p])).values()],cx=unique.reduce((s,p)=>s+p[0],0)/unique.length,cy=unique.reduce((s,p)=>s+p[1],0)/unique.length;
 unique.sort((p,q)=>Math.atan2(q[1]-cy,q[0]-cx)-Math.atan2(p[1]-cy,p[0]-cx));for(let i=0;i<unique.length;i++)push([cx,cy,wallPlane],unique[i],unique[(i+1)%unique.length]);
 box.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();g.computeBoundingBox();return g;
}
