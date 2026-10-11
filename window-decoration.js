const caches=new WeakMap();
// Optional apartment decoration for external presentation. These rooms and
// furnishings are not an apartment survey and cannot enter engineering stock.
export function createWindowDecoration(THREE,parent,{width,height,windowId='',type=null}={}){
 if(!parent?.isObject3D||![width,height].every(Number.isFinite)||width<=.3||height<=.3)throw Error('Invalid window decoration');
 const hash=[...windowId].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619),2166136261)>>>0,variant=hash%5;
 const group=new THREE.Group();group.name='decor-'+windowId;group.userData={windowDecoration:true,physical:false,quantityEligible:false,quantity:0,approved:false,variant,source:'User requested varied apartment decor; no existing apartment layout/material inferred'};parent.add(group);
 const cache=caches.get(THREE)??{materials:new Map(),users:0};caches.set(THREE,cache);cache.users++;const geometries=[];
 const mat=(name,color,roughness=.95)=>{const key=name+color;if(cache.materials.has(key))return cache.materials.get(key);const m=new THREE.MeshStandardMaterial({color,roughness,metalness:0});m.name='decor_'+name+color.slice(1);m.userData={materialFamily:'decorative',finishAuthority:'illustrative apartment decor; not a source material or stock'};cache.materials.set(key,m);return m;};
 const wall=mat('wall',['#b5b4a9','#b5ada0','#a5adaa','#b3b0a7','#aeb5b5'][variant]),floor=mat('floor','#8a7763'),fabric=mat('fabric',['#d9d4c8','#a0aca8','#b7a398','#c6c8be','#9ea6b0'][variant]);
 const wood=mat('furniture','#766554'),dark=mat('furniture_dark','#414843');
 const box=(w,h,d,x,y,z,m)=>{const geo=new THREE.BoxGeometry(w,h,d);geometries.push(geo);const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.userData={windowDecoration:true,physical:false,quantityEligible:false,quantity:0};group.add(o);return o;};
 // Closed rear and jambs stop the view travelling through the whole building.
 box(width-.02,height-.02,.02,0,0,-1.58,wall);
 for(const s of [-1,1])box(.018,height-.02,1.38,s*(width/2-.02),0,-.87,wall);
 box(width-.02,.018,1.38,0,-height/2+.025,-.87,floor);box(width-.02,.018,1.38,0,height/2-.025,-.87,wall);
 const stair=windowId.startsWith('SE-')&&/A-?0[567]/.test(type??'');
 group.userData.interiorKind=stair?'common-stair-hall':'apartment-candidate';
 if(stair){
  // Shared circulation, no apartment curtains or furniture. The source fixes
  // the stair zone; these internal finishes/flight dimensions are illustrative.
  group.userData.source='Ark02–04 common stair halls; illustrative treads/rail/finishes, no surveyed interior';
  const stepW=Math.max(.22,width*.72),rise=Math.min(.14,height*.11),tread=.16,y0=-height/2+.03;
  box(width-.05,.07,.40,0,y0+.05,-.42,floor);
  for(let i=0;i<8;i++){const h=(i+1)*rise;const m=box(stepW,h,tread,0,y0+h/2,-.65-(i+.5)*tread,floor);m.userData.stairRole='tread';}
  for(const side of [-1,1]){
   const rail=box(.025,.025,1.35,side*stepW/2,y0+height*.55,-1.12,dark);rail.rotation.x=Math.atan2(8*rise,1.28);rail.userData.stairRole='handrail';
   for(let i=0;i<3;i++){const m=box(.02,height*.42,.02,side*stepW/2,y0+height*.24+i*rise*2,-.70-i*.48,dark);m.userData.stairRole='baluster';}
  }
 }
 else{
  // Different deterministic curtains and a few simple furniture silhouettes.
  if(variant!==2)for(const s of [-1,1]){const curtainWidth=width*(variant===0?.31:.18);for(let n=0;n<9;n++)box(curtainWidth/9+.001,height*.86,.018,s*(width/2-.075-curtainWidth/2)+(n-4)*curtainWidth/9,0,-.20-.008*Math.cos(n*Math.PI),fabric);}
  if(variant===0||variant===3){box(width*.58,height*.23,.28,-width*.09,-height*.28,-1.28,fabric);box(width*.58,.065,.43,-width*.09,-height*.40,-1.07,fabric);}
  else{box(width*.40,.04,.38,width*.10,-height*.20,-1.15,wood);for(const s of [-1,1])box(.03,height*.27,.03,width*.10+s*width*.16,-height*.35,-1.15,dark);}
  if(variant===2||variant===4)box(width*.18,height*.60,.22,-width*.32,-height*.13,-1.40,wood);
 }
 let disposed=false;return {group,variant,dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();if(--cache.users===0){for(const m of cache.materials.values())m.dispose();caches.delete(THREE);}}};
}
