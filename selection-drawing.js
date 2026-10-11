// Read the selected 3D owner, never a similarly named part in another layout.
// This review drawing does not calculate stock, approve cuts or invent bores.
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const area=ring=>Math.abs(ring.reduce((sum,[x,y],i)=>{const [a,b]=ring[(i+1)%ring.length];return sum+x*b-a*y;},0))/2;
const inside=(x,y,ring)=>{
 let hit=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [a,b]=ring[i],[c,d]=ring[j];
  if(Math.abs((x-a)*(d-b)-(y-b)*(c-a))<1e-6&&x>=Math.min(a,c)-1e-6&&x<=Math.max(a,c)+1e-6&&y>=Math.min(b,d)-1e-6&&y<=Math.max(b,d)+1e-6)return true;
  if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)hit=!hit;
 }
 return hit;
};
export function selectedPanelDrawing(input){
 const p=structuredClone(input);
 if(!p||!['SE','NW','SW','NE'].includes(p.facade)||typeof p.id!=='string'||!p.id||![p.x,p.y,p.width,p.height].every(Number.isFinite)||p.width<=0||p.height<=0)throw Error('Selected panel geometry is missing');
 const outer=p.outer??[[p.x,p.y],[p.x+p.width,p.y],[p.x+p.width,p.y+p.height],[p.x,p.y+p.height]],holes=p.holes??[];
 for(const ring of [outer,...holes]){
  if(!Array.isArray(ring)||ring.length<3||ring.some(q=>!Array.isArray(q)||q.length!==2||!q.every(Number.isFinite)||q[0]<p.x-1e-6||q[0]>p.x+p.width+1e-6||q[1]<p.y-1e-6||q[1]>p.y+p.height+1e-6))throw Error('Selected contour is outside its owner');
 }
 const contourAreaMm2=area(outer)-holes.reduce((sum,h)=>sum+area(h),0);
 if(contourAreaMm2<=0||(p.areaMm2!==undefined&&(!Number.isFinite(p.areaMm2)||Math.abs(p.areaMm2-contourAreaMm2)>1e-4)))throw Error('Selected panel area disagrees with its contour');
 const bores=p.drilling?.points??[];
 for(const b of bores)if(![b.x,b.y,b.diameterMM].every(Number.isFinite)||b.diameterMM<=0||!inside(b.x,b.y,outer)||holes.some(h=>inside(b.x,b.y,h)))throw Error('Selected bore geometry is missing or outside the contour');
 const size=Math.max(p.width,p.height),font=Math.max(18,size/24),margin=font*4,pad=font*6;
 const point=([x,y])=>[x-p.x,p.height-(y-p.y)],path=[outer,...holes].map(r=>r.map((q,i)=>(i?'L':'M')+point(q).join(' ')).join(' ')+'Z').join(' ');
 const fmt=n=>Number(n.toFixed(2)).toLocaleString('uk-UA');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${p.width+2*pad} ${p.height+2*pad}" role="img" aria-label="${esc(p.id)}, точний контур вибраної плити, ${fmt(p.width)} на ${fmt(p.height)} мм">
 <defs><marker id="selected-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#34463f"/></marker></defs>
 <path data-selected-contour="${esc(p.id)}" d="${path}" fill="${p.colour==='P070'?'#5e6260':'#dfdfd3'}" stroke="#34463f" stroke-width="${font/20}" fill-rule="evenodd"/>
 ${bores.map(b=>`<circle data-selected-bore="true" cx="${b.x-p.x}" cy="${p.height-(b.y-p.y)}" r="${b.diameterMM/2}" fill="#161d1b"/>`).join('')}
 <g fill="none" stroke="#34463f" stroke-width="${font/12}"><path d="M0 0V${-margin-font/3}M${p.width} 0V${-margin-font/3}M${p.width} 0H${p.width+margin+font/3}M${p.width} ${p.height}H${p.width+margin+font/3}" opacity=".5"/>
 <path d="M0 ${-margin}H${p.width}" marker-start="url(#selected-arrow)" marker-end="url(#selected-arrow)"/><path d="M${p.width+margin} 0V${p.height}" marker-start="url(#selected-arrow)" marker-end="url(#selected-arrow)"/></g>
 <g fill="#22342d" font-family="system-ui,sans-serif" font-size="${font}" font-weight="600"><text x="${p.width/2}" y="${-margin-font/2}" text-anchor="middle">${fmt(p.width)} мм</text><text x="${p.width+margin+font/2}" y="${p.height/2}" transform="rotate(90 ${p.width+margin+font/2} ${p.height/2})" text-anchor="middle">${fmt(p.height)} мм</text><text x="0" y="${p.height+margin}">↑ ${esc(p.grain??'напрям фактури не задано')}</text></g></svg>`;
 return {id:p.id,facade:p.facade,panel:p,svg,contourAreaMm2,bores:bores.length,approved:false,readyToCut:false,readyToDrill:false,quantityAuthority:false};
}
