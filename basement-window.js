// Retained existing window representation. No new IGU/frame specification.
import {basementWindowCandidate,planBasementWindowFinish} from './basement-window-plan.js';
export {basementWindowCandidate} from './basement-window-plan.js';
export function createRetainedBasementGlassMaterial(THREE){
 const material=new THREE.MeshPhysicalMaterial({color:'#d1d3cd',roughness:.14,transmission:.9,ior:1.5,thickness:0,transparent:false,opacity:1,depthWrite:false,side:THREE.DoubleSide});
 material.name='retained_unknown_glazing_optical_proxy';
 material.userData={materialFamily:'glass',opticalRole:'existing-unknown-glazing-representation',illustrative:true,approved:false,newStockPart:false,quantityEligible:false,glazingComposition:null,glassThickness:null,
  finishAuthority:'illustrative optics only; existing glazing composition and physical thickness unknown'};
 return material;
}
export function createRetainedBasementWindow(THREE,parent,opening,{materials={}}={}){
 if(!opening?.retained||opening.replacement!==false||![opening.x0,opening.x1,opening.y0,opening.y1].every(Number.isFinite)||opening.x1-opening.x0<=.1||opening.y1-opening.y0<=.1)throw Error('Invalid retained basement aperture');
 const c=basementWindowCandidate,finish=planBasementWindowFinish(opening),group=new THREE.Group(),apertureWidth=opening.x1-opening.x0,apertureHeight=opening.y1-opening.y0,width=apertureWidth-2*c.mountingClearance,height=apertureHeight-2*c.mountingClearance;
 group.position.set((opening.x0+opening.x1)/2,(opening.y0+opening.y1)/2,0);group.name=opening.id+'-retained-window';
 group.userData={basementOpeningId:opening.id,assembly:'retained-basement-window',sourceOpening:opening,candidate:c,finishPlan:finish,retained:true,replacement:false,quantityEligible:false,newStockPart:false,quantity:0,approved:false,
  component:{kind:'basement-window',title:opening.id+' · існуюче підвальне вікно',source:opening.source,note:'Існуюче вікно зберігається. Рама й край скла — оглядова форма; бічні FC8, верхній RKL31/метал та повний відлив PURAL0,6 за вузлом15. Посадку, нижнє утеплення, опори75×30 і згини звірити на місці.'}};
 parent.add(group);
 const white=materials.white??new THREE.MeshStandardMaterial({color:'#e6e7e2',roughness:.65}),reveal=materials.sideFC??materials.reveal??new THREE.MeshStandardMaterial({color:'#a9adaa',roughness:.9}),metal=materials.metal??new THREE.MeshStandardMaterial({color:'#606b70',metalness:.5,roughness:.4}),glass=materials.glass??createRetainedBasementGlassMaterial(THREE);
 for(const [m,name] of [[white,'retained_white_frame_candidate'],[reveal,'retained_reveal_candidate'],[metal,'basement_sill_PURAL_candidate'],[glass,'retained_unknown_glazing_optical_proxy']])if(!m.name)m.name=name;
 const add=(id,geometry,material,position,role)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(position);mesh.name=opening.id+'-'+id;mesh.userData={basementOpeningId:opening.id,partId:opening.id+'-'+id,role,quantity:0,quantityEligible:false,newStockPart:false,approved:false,surveyVerified:false,physical:false,illustrative:true};mesh.castShadow=role!=='optical-proxy';mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const insulation=materials.headInsulation??new THREE.MeshStandardMaterial({color:'#d2d2aa',roughness:1}),seal=materials.seal??new THREE.MeshStandardMaterial({color:'#282c2b',roughness:.8});
 insulation.name='wool_RKL31_basement_candidate';seal.name='retained_glazing_seal_candidate';seal.userData={materialFamily:'rubber',illustrative:true,approved:false,quantityEligible:false,finishAuthority:'Display edge seal, not surveyed retained product'};
 const z=-c.recess-c.frameDepth/2,box=(id,w,h,d,x,y,z,role,material=white)=>add(id,new THREE.BoxGeometry(w,h,d),material,[x,y,z],role);
 for(const sign of [-1,1])box('frame-jamb-'+sign,c.frameFace,height,c.frameDepth,sign*(width-c.frameFace)/2,0,z,'existing-frame-candidate');
 for(const sign of [-1,1])box('frame-horizontal-'+sign,width-2*c.frameFace,c.frameFace,c.frameDepth,0,sign*(height-c.frameFace)/2,z,'existing-frame-candidate');
 // Separate contacting rings: the bead sits on the frame face; the seal
 // borders the single unknown optical plane without invented glass thickness.
 const iw=width-2*c.frameFace,ih=height-2*c.frameFace;
 const ring=(prefix,w,h,face,depth,z,role,material)=>{
  for(const sign of [-1,1])box(prefix+'-jamb-'+sign,face,h,depth,sign*(w-face)/2,0,z,role,material);
  for(const sign of [-1,1])box(prefix+'-horizontal-'+sign,w-2*face,face,depth,0,sign*(h-face)/2,z,role,material);
 };
 ring('frame-bead',iw+2*c.beadFace,ih+2*c.beadFace,c.beadFace,c.beadDepth,-c.recess+c.beadDepth/2,'existing-frame-bead-candidate',white);
 ring('glass-seal',iw,ih,c.sealFace,c.sealDepth,-c.recess-c.sealDepth/2,'existing-seal-candidate',seal);
 const optical=add('unknown-glazing',new THREE.PlaneGeometry(iw-2*c.sealFace,ih-2*c.sealFace),glass,[0,0,-c.recess-c.sealDepth/2],'optical-proxy');optical.userData.glazingComposition=null;optical.userData.glassThickness=null;optical.userData.representationOnly=true;
 const front=.183,depth=front+c.recess;
 for(const sign of [-1,1])box('reveal-jamb-'+sign,c.revealThickness,apertureHeight,depth,sign*(apertureWidth-c.revealThickness)/2,0,(front-c.recess)/2,'reveal-candidate',reveal);
 const hp=finish.head;
 box('head-RKL31',hp.width,c.headWindboard,hp.front-hp.back,0,hp.bottom+c.headWindboard/2,(hp.front+hp.back)/2,'source30-head-windboard-candidate',insulation);
 box('reveal-head',hp.width,c.sillThickness,front-hp.back,0,hp.bottom-c.sillThickness/2,(front+hp.back)/2,'source06-head-sheet-candidate',metal);
 const wood=materials.wood??new THREE.MeshStandardMaterial({color:'#b79362',roughness:.9});if(!wood.name)wood.name='timber';
 for(const sign of [-1,1]){
  box('side-H3-'+sign,.075,apertureHeight,.030,sign*(apertureWidth/2+.0375),0,front-.015,'source75x30-H3-candidate',wood);
  // The retained support sits behind the new FC face. The metal corner wraps
  // its aperture edge; exposed H3 is an unfinished junction, not the finish.
  box('side-FC-cover-'+sign,.075,apertureHeight,.008,sign*(apertureWidth/2+.0375),0,front+.004,'side-FC-support-cover-candidate',reveal);
  box('side-L-front-'+sign,.020,apertureHeight,.0006,sign*(apertureWidth/2-.010),0,front+.0083,'source06-L-profile-candidate',metal);
  box('side-L-return-'+sign,.0006,apertureHeight,.020,sign*(apertureWidth/2-.0003),0,front-.002,'source06-L-profile-candidate',metal);
 }
 // One closed cross-section, extruded at the actual0.6mm sheet thickness.
 const profile=(id,sectionYZ,x0,x1,role)=>{
  const shape=new THREE.Shape();sectionYZ.forEach(([y,z],i)=>i?shape.lineTo(y,z):shape.moveTo(y,z));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:x1-x0,bevelEnabled:false,steps:1}),pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const y=pos.getX(i),z=pos.getY(i),x=pos.getZ(i)+x0;pos.setXYZ(i,x,y,z);}geometry.computeVertexNormals();
  const m=add(id,geometry,metal,[0,0,0],role);m.userData.preservePhysicalProfile=true;m.userData.source='§5.7;PDF63/ark15:PURAL0.6mm,30mm projection,slope>=1:10';m.userData.profileCandidate=true;m.userData.orderedFoldProfile=null;return m;
 };
 const sp=finish.sill,sill=profile('sill',sp.sectionYZ,-sp.width/2,sp.width/2,'new-sill-candidate');sill.userData.rearSeatGeometry='display fold only; actual frame seal unresolved';
 const seatZ=(sp.rear+front)/2,seatTop=sp.backY-c.sillSlope*(seatZ-sp.rear)-.001;
 box('bottom-RKL31',sp.width,.030,front-sp.rear,0,seatTop-.015,seatZ,'source30-bottom-windboard-candidate',insulation);
 for(const sign of [-1,1]){const x=sign*sp.width/2;profile('sill-end-'+sign,sp.endSectionYZ,sign<0?x:x-sp.endThickness,sign<0?x+sp.endThickness:x,'sill-end-candidate');}
 // A dim recess gives the retained glazing depth without inventing an as-built
 // basement plan. All these surfaces remain excluded from material quantities.
 const interior=new THREE.MeshStandardMaterial({color:'#625b50',roughness:1});interior.name='illustrative_basement_recess';
 interior.userData={illustrative:true,quantityEligible:false,finishAuthority:'Photo-guided dim utility-space appearance; interior dimensions not surveyed'};
 const back=box('interior-back',apertureWidth+.10,1.15,.025,0,-.30,-1.12,'interior-context',interior);
 back.userData.layoutAuthority='illustrative recess; not basement survey';
 box('interior-floor',apertureWidth+.10,.025,1.04,0,-.72,-.60,'interior-context',interior);
 for(const sign of [-1,1])box('interior-side-'+sign,.025,1.15,1.04,sign*(apertureWidth+.10)/2,-.30,-.60,'interior-context',interior);
 return {group,opening,candidate:c,finishPlan:finish};
}
