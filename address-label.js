import {endWallSpec,endWallFrame} from './end-wall-plan.js';
import {endWindows} from './facade-layouts.js';

// The project relocates the existing SE/photo sign to the right corner of
// the SW end wall (§5.5.1, PDF54/ark06). Drawing coordinates locate the sign;
// they do not approve a product size or an installation height.
export const addressSource={
 pdfSHA256:'fc22c9eb0964b52800a5d926fa2574b3f95654f64d1a3f17f21a0afaddd15f99',
 pageIndex:53,sheet:'06',facade:'SW',
 facadeDrawing:{index:564,rect:[125.33999633789062,102.6199951171875,462.47998046875,409.58001708984375]},
 plaqueDrawing:{index:4309,rect:[425.3999938964844,351.6800231933594,448.1999816894531,359.8399963378906]},
 windowDrawing:{index:3221,rect:[315.8999938964844,328.94000244140625,358.44000244140625,370.760009765625]},
 writtenEndWidthMM:11885,modelEndWidthMM:endWallSpec.widthMM,
 requirement:'§5.5.1: address sign at the right corner of the end wall; Ark06 locates it on SW'
};
export function planAddressLabel(){
 const opening=endWindows.SW.find(o=>o.id==='SW-A02-1');
 if(!opening)throw Error('Address label reference window missing');
 const f=addressSource.facadeDrawing.rect,p=addressSource.plaqueDrawing.rect,w=addressSource.windowDrawing.rect;
 const sx=addressSource.modelEndWidthMM/1000/(f[2]-f[0]),sy=opening.height/(w[3]-w[1]);
 // Elevation right is the SE entrance corner; SW native local+X is NW.
 const x=endWallFrame('SW').max-((p[0]+p[2])/2-f[0])*sx;
 const y=opening.y-((p[1]+p[3]-w[1]-w[3])/2)*sy,width=(p[2]-p[0])*sx;
 // Preserve the photo graphic's 4:1 aspect ratio. The drawing's framed
 // envelope is not a specified manufactured sign; dimensions stay candidates.
 const height=width/4,depth=.012,facadeOuter=.029,gap=.006;
 return {partId:'ADDRESS-MAE7',facade:'SW',referenceWindowId:opening.id,
  width,height,depth,x,y,z:facadeOuter+gap+depth/2,
  facadeOuter,gap,wallStrip:[endWallFrame('SW').min,opening.x-opening.width/2],approved:false,surveyVerified:false,quantityEligible:false,
  source:'§5.5.1; Ark06/PDF54 SW end wall; ECE09/ECE10 appearance candidate',sourcePlacement:addressSource,
  coordinateBasis:{horizontal:'Ark06 written11885mm full end wall; mirrored to native SW frame; SE entrance corner',vertical:'Drawing centre offset anchored to current lower A02 window',graphicAspectRatio:4},
  unknown:{endWidthConflict:'Ark06 labels11885mm; Ark02 labels11890mm. Five millimetre source difference and site registration remain open.',installationHeight:'Graphic offset from nominal A02; not a dimensioned mounting level',productSize:'Graphical width and photo4:1 ratio, not an ordered sign',fixings:'Depth12mm/gap6mm and fasteners not approved',appearance:'Font/colour reconstructed from existing photos, not a specified product'},
  portableTexture:{path:'assets/mae7-address.png',sha256:'da1ed628172373c0fda5bd694046707934a60dd16817f2f5eba26aa1f8e748f8'},
  text:'Mäe 7'};
}
export function createAddressLabel(THREE,parent){
 const p=planAddressLabel(),canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fafafa';ctx.fillRect(0,0,1024,256);
 ctx.fillStyle='#1d4683';ctx.fillRect(753,7,263,241);ctx.textAlign='left';
 ctx.fillStyle='#202c37';ctx.font='148px sans-serif';ctx.fillText('Mäe',52,192);
 ctx.fillStyle='#ffffff';ctx.font='195px sans-serif';ctx.fillText('7',812,195);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.65,map});
 material.name='address_label';material.userData={portableTexture:p.portableTexture,finishAuthority:'Reconstructed address graphic from object photos; font and dimensions are candidates'};
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(p.width,p.height,p.depth),material);
 mesh.name=p.partId;mesh.position.set(p.x,p.y,p.z);mesh.userData={...p,component:{kind:'address',title:p.text,source:p.source,note:'Правий край південно-західного торця за проєктом. Розмір таблички, монтажна висота й кріплення потребують звірки.'}};
 mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
