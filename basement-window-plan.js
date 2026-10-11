// PDF63/ark15 and §5.7: retained windows, new FC side returns and PURAL0.6.
// Dimensions of existing frames and folded-sheet fabrication remain candidates.
export const basementWindowCandidate=Object.freeze({recess:.030,frameFace:.040,frameDepth:.065,mountingClearance:.003,revealThickness:.008,
 sillThickness:.0006,sillProjection:.030,sillSlope:.1,beadFace:.008,beadDepth:.005,sealFace:.003,sealDepth:.006,headWindboard:.030,
 approved:false,surveyVerified:false,unknown:{existingFrameSection:null,existingGlassLayers:null,existingGlassThickness:null,installedRecess:null,anchors:null,sillFolds:null,
 bottomWindboardSeat:null,sideTimber75x30Seat:null,headVentilationClosure:null,orderedFCParts:null}});
function strip(path,t){
 const ns=path.slice(0,-1).map((a,i)=>{const b=path[i+1],dz=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dz,dy);return[-dy/n,dz/n];});
 const side=s=>path.map((p,i)=>{if(!i||i===path.length-1){const n=ns[i?i-1:0];return[p[0]+s*t*n[0]/2,p[1]+s*t*n[1]/2];}const a=ns[i-1],b=ns[i],f=s*t/(2*(1+a[0]*b[0]+a[1]*b[1]));return[p[0]+(a[0]+b[0])*f,p[1]+(a[1]+b[1])*f];});
 return [...side(1),...side(-1).reverse()].map(([z,y])=>[y,z]);
}
export function planBasementWindowFinish(opening){
 if(!opening?.retained||opening.replacement!==false||![opening.x0,opening.x1,opening.y0,opening.y1].every(Number.isFinite)||opening.width<=.1||opening.height<=.1)throw Error('Invalid retained basement finish');
 const c=basementWindowCandidate,w=opening.x1-opening.x0,h=opening.y1-opening.y0,frameFront=-c.recess,front=.183,nose=front+c.sillProjection;
 const width=w-2*c.revealThickness-.002,rear=frameFront+c.sillThickness/2,backY=-h/2+c.mountingClearance+c.frameFace-c.beadFace-.012;
 const upstand=.012,drip=.012,hem=.003,drop=(nose-rear)*c.sillSlope,path=[[rear,backY+upstand],[rear,backY],[nose,backY-drop],[nose,backY-drop-drip],[nose-hem,backY-drop-drip]];
 const sectionYZ=strip(path,c.sillThickness),upper=z=>backY-c.sillSlope*(z-rear)+c.sillThickness*Math.sqrt(1+c.sillSlope**2)/2;
 const z0=rear+c.sillThickness*.6,z1=nose-c.sillThickness*.6;
 const endSectionYZ=[[upper(z0),z0],[upper(z1),z1],[upper(z1)+.012,z1],[upper(z0)+.012,z0]];
 const headBottom=h/2-.001-c.headWindboard,headBack=frameFront+.001,headFront=front-c.sillThickness;
 return {id:opening.id,approved:false,quantityAuthority:false,source:'§5.7; PDF63/ark15',sourceFacts:{retainedWindow:true,replacement:false,PURALThickness:.0006,minimumSillSlope:.1,projection:.030,FCThickness:.008,RKL31Thickness:.030,treatedTimberSection:[.075,.030],timberClass:'H3'},
  aperture:{width:w,height:h},frame:{width:w-2*c.mountingClearance,height:h-2*c.mountingClearance,front:frameFront},
  head:{bottom:headBottom,back:headBack,front:headFront,width:w-2*c.revealThickness,windboardThickness:c.headWindboard,sheetThickness:c.sillThickness},
  sill:{width,rear,nose,backY,drop,sectionYZ,endSectionYZ,endThickness:c.sillThickness,scope:'Continuous display sheet from retained frame to30mm projection; rear/end folds are fabrication candidates, not approved weather seals'},
  candidate:{frameFace:c.frameFace,frameDepth:c.frameDepth,beadFace:c.beadFace,beadDepth:c.beadDepth,gasketFace:c.sealFace,gasketDepth:c.sealDepth,sillRearUpstand:upstand,sillFrontDrip:drip,sillHem:hem,sillEndHeight:.012,sideClearance:.001,headSeat:'30mm lining fits inside the current graphic display aperture; actual head seating requires survey'},
  unknown:{...c.unknown,frameMaterial:null,existingSashDivision:null,bendRadii:null,endSealing:null,bottomRKL31Seat:null,fasteners:null},
  sourceFeaturesNotAuthored:['Contact seats and anchors of bottom RKL31 and side75x30H3 supports require survey','Head insect mesh/ventilation/tape closure: section and fastening unresolved']};
}
