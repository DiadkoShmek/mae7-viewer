// Derived punching of the nominal 25mm horizontal hat; no panel offset.
// Product/capacity remain candidates. Explicit holes, never an alpha texture.
export const plinthVentSpec=Object.freeze({pitch:.060,slotWidth:.030,z0:.154,z1:.172,source:'Artur2026-10-11:design ventilation; perforated horizontal profile candidate',approved:false});
const area=ps=>Math.abs(ps.reduce((v,p,i)=>{const q=ps[(i+1)%ps.length];return v+p[0]*q[1]-q[0]*p[1];},0))/2;
function clip(ps,z,sign){const out=[];for(let i=0;i<ps.length;i++){const p=ps[i],q=ps[(i+1)%ps.length],a=sign*(p[1]-z),b=sign*(q[1]-z);if(a<=1e-12)out.push(p);if((a<0&&b>0)||(a>0&&b<0)){const t=a/(a-b);out.push(p.map((v,k)=>v+t*(q[k]-v)));}}return out;}
export function perforatePlinthHat(p){
 if(p.kind!=='profileX'||!p.sourcePartId.includes('-HAT-'))return p;
 const s=plinthVentSpec,slots=[];
 for(let k=Math.ceil((p.x0-.030)/s.pitch);k*s.pitch+.030-s.slotWidth/2<p.x1;k++){
  const centre=k*s.pitch+.030,a=Math.max(p.x0,centre-s.slotWidth/2),b=Math.min(p.x1,centre+s.slotWidth/2);if(b>a+1e-10)slots.push([a,b]);
 }
 const clipped=[clip(p.sectionYZ,s.z0,1),clip(p.sectionYZ,s.z1,-1)].filter(ps=>ps.length>=3&&area(ps)>1e-12),pieces=[];let cursor=p.x0;
 const part=(a,b,section)=>({kind:'profileX',layer:p.layer,material:p.material,sourcePartId:p.sourcePartId,x0:a,x1:b,sectionYZ:section,volume:(b-a)*area(section)});
 for(const [a,b] of slots){if(a>cursor+1e-10)pieces.push(part(cursor,a,p.sectionYZ));for(const ring of clipped)pieces.push(part(a,b,ring));cursor=b;}
 if(cursor<p.x1-1e-10)pieces.push(part(cursor,p.x1,p.sectionYZ));
 return {...p,kind:'compound',geometryPieces:pieces,volume:pieces.reduce((v,q)=>v+q.volume,0),ventSlots:slots,ventilationCandidate:s,profileStatus:'perforated25mm hat;30×18mm two-web punching at60mm; candidate product/capacity',ventilationApproved:false};
}
export function createPlinthVentStrips(THREE,parent,faces,material,{height=.660}={}){
 const group=new THREE.Group();group.name='plinth-vent-strips';parent.add(group);
 for(const face of faces){const frame=new THREE.Group();frame.position.fromArray(face.position);frame.rotation.y=face.rotation;group.add(frame);
  for(const [name,y] of [['lower',-height],['upper',-.020]]){
   const positions=[],a=-face.width/2,b=face.width/2,z0=.150,z1=.175,w=.0008,pitch=.010;
   const quad=(x0,x1,low,high)=>positions.push(x0,y,low,x1,y,low,x1,y,high,x0,y,low,x1,y,high,x0,y,high);
   for(let x=Math.ceil((a-.005)/pitch)*pitch+.005;x<b;x+=pitch)quad(Math.max(a,x-w/2),Math.min(b,x+w/2),z0,z1);
   for(let z=z0+.005;z<z1;z+=pitch)quad(a,b,z-w/2,z+w/2);
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();
   const m=new THREE.Mesh(geo,material);m.name='VS1-'+face.code+'-VENT-'+name.toUpperCase();m.castShadow=false;m.receiveShadow=true;
   m.userData={partId:m.name,assembly:'plinth-ventilation',system:'plinth',layer:3,physical:false,quantityEligible:false,approved:false,preservePhysicalProfile:true,ventilationCandidate:true,
    component:{kind:'plinth',title:name==='lower'?'Нижній вентиляційний вхід':'Верхній вентиляційний вихід',source:plinthVentSpec.source,note:'Відкрита сітка та перфорація обох полиць профілю. Сітка, несуча здатність і монтаж потребують підбору виробу.'}};frame.add(m);
  }
 }return group;
}
