import * as THREE from 'three';
import {sitePlanReference} from './site-plan-reference.js';
import {siteAccessReference,siteAccessContour,siteWalkwayContour} from './site-access-reference.js';
import {createTerrainRelief,terrainGeometry} from './terrain-relief.js';
import {rainwaterChannelPlan} from './ground-junctions.js';
import {planRainwaterDetails} from './rainwater-details.js';
import {plinthSpec} from './plinth-plan.js';
import {daylightSkySpec} from './daylight-sky.js';

// PDF49/арк01 + §3.4–3.5: retained greenery, restored entrance asphalt.
// §5.2: 600mm concrete perimeter apron, authored separately in the native model.
// Yard relief/extent/grass/access colours are presentation, not a site survey.
export function setupLandscape(scene,{footprint,groundY,apronWidth=.6,apronCentreZ=0,textureLoader,onTextureLoad=()=>{}}={}){
 if(!scene?.add)throw Error('Landscape needs a scene or garden parent');
 const {length,depth,centerX=0,centerZ=0}=footprint??{};
 if(![length,depth,centerX,centerZ,groundY,apronWidth].every(Number.isFinite)||length<=0||depth<=0||apronWidth<0)throw Error('Invalid landscape footprint/datum');
 const group=new THREE.Group();group.name='Presentation · retained green yard';
 group.userData={presentationOnly:true,physical:false,quantityEligible:false,quantity:0,approved:false,
  source:'PDF49/арк01; §3.4–3.5; §5.2',footprint:{length,depth,centerX,centerZ},groundY,apronWidth,
  sitePlanReference,siteAccessReference,limits:'Five restoration contours and the existing access-road contour traced from PDF49; interpolated boundaries and model fit are candidates. One vegetation symbol anchor; its displayed height/crown are illustrative. Lawn relief, grading and drainage are unsurveyed; no site quantities approved.'};
 const geometries=[],materials=[],textures=[];let disposed=false;
 function material(color){const m=new THREE.MeshStandardMaterial({color,roughness:1,metalness:0});materials.push(m);return m;}
 function mesh(name,geometry,mat,y){geometries.push(geometry);const o=new THREE.Mesh(geometry,mat);o.name=name;o.rotation.x=-Math.PI/2;o.position.set(centerX,y,centerZ);o.receiveShadow=true;o.userData={presentationOnly:true,physical:false,quantityEligible:false,quantity:0};group.add(o);return o;}
 const halfX=length/2+apronWidth,halfZ=depth/2+apronWidth;
 const roadContour=siteAccessContour;
 const drainage=rainwaterChannelPlan(planRainwaterDetails());
 const relief=createTerrainRelief({halfX,halfZ,centreZ:apronCentreZ,flatContours:[...sitePlanReference.asphalt.map(p=>p.modelFitContourXZMetres),roadContour,siteWalkwayContour,...drainage.map(p=>p.contour)]});
 group.userData.relief={...relief,height:undefined};
 const grass=material('#87997c');grass.vertexColors=true;
 // Broad colour variation helps read the low lawn relief. It is
 // an illustrative surface treatment, never a vegetation or moisture survey.
 // Fade the distant turf into the native presentation ground, including its
 // normal detail, so the yard does not end as a hard green island.
 const horizonColour=new THREE.Color(daylightSkySpec.horizon);
 grass.onBeforeCompile=shader=>{
  shader.uniforms.terrainHorizonColour={value:horizonColour};
  shader.vertexShader='attribute float terrainFade; varying float vTerrainFade;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTerrainFade = terrainFade;');
  shader.fragmentShader='uniform vec3 terrainHorizonColour; varying float vTerrainFade;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, terrainHorizonColour, vTerrainFade);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal = normalize(mix(normal, nonPerturbedNormal, vTerrainFade));');
 };
 grass.customProgramCacheKey=()=> 'mae7-lawn-relief-horizon-v73';
 // Low contrast, mipmapped albedo variation; no extra blades/draw calls.
 const pixels=new Uint8Array(64*64*4);let seed=713;
 for(let i=0;i<pixels.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const c=238+(seed>>>28);pixels[i]=c;pixels[i+1]=c;pixels[i+2]=c;pixels[i+3]=255;}
 const texture=new THREE.DataTexture(pixels,64,64,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1/2.5,1/2.5);texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;textures.push(texture);grass.map=texture;
 // Only the existing building core removes turf. The wider protection
 // rectangle flattens relief; it must not cut a hole between concrete pads.
 const lawnGeometry=terrainGeometry(THREE,{halfX:plinthSpec.existingHalfLength,halfZ:plinthSpec.existingHalfDepth,xBreaks:[-halfX,halfX],zBreaks:[apronCentreZ-halfZ,apronCentreZ+halfZ],height:relief.height,extent:daylightSkySpec.terrainExtent,farStep:32});
 const positions=lawnGeometry.attributes.position,colours=[],fade=[];
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),z=-positions.getY(i),h=positions.getZ(i);
  const broad=.040*Math.sin(x/11+.7)*Math.cos(z/13)+.025*Math.sin((x-z)/19);
  const tone=1+broad+h*.11;
  colours.push(tone*(1+.010*Math.sin(z/17)),tone,tone*(1-.018*Math.cos(x/21)));
  fade.push(smooth((Math.hypot(x,z)-100)/120));
 }
 lawnGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
 lawnGeometry.setAttribute('terrainFade',new THREE.Float32BufferAttribute(fade,1));
 lawnGeometry.userData.surfaceTreatment={illustrative:true,surveyVerified:false,horizonFadeMetres:[100,220],protectedWalkingDatumUnchanged:true};
 mesh('Presentation · existing lawn with soft relief',lawnGeometry,grass,groundY+.003);
 // The source gives three entrance connections and two end restoration areas,
 // not one invented continuous rectangle along the complete front facade.
 const asphalt=material('#626767');asphalt.name='site_asphalt';
 for(const p of sitePlanReference.asphalt){
  const shape=new THREE.Shape();p.modelFitContourXZMetres.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
  const o=mesh(p.id,new THREE.ShapeGeometry(shape),asphalt,groundY+.006);o.userData={...o.userData,source:'PDF49/арк01',sourceContour:p.id,graphicCandidate:true,contourXZ:p.modelFitContourXZMetres,approved:false};
 }
 // Generic CC0 surface references give the existing traced contours a metric
 // material appearance. They do not establish the site's grass or asphalt mix.
 const materialReady=textureLoader?Promise.all([[grass,'Grass005'],[asphalt,'Asphalt012']].map(async([mat,id])=>{
  const load=(role,srgb=false)=>new Promise((resolve,reject)=>{
   textureLoader.load('./assets/landscape/'+id+'_1K-JPG_'+role+'.webp',t=>{
    if(disposed){t.dispose();resolve(null);return;}
    t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(id==='Grass005'?.36:.26,id==='Grass005'?.36:.26);t.anisotropy=4;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;textures.push(t);resolve(t);
   },undefined,reject);
  });
  const [albedo,normal,roughness]=await Promise.all([load('Color',true),load('NormalGL'),load('Roughness')]);
  if(disposed)return;
  mat.color.set(id==='Grass005'?'#b7b4a1':'#d2d0c8');mat.map=albedo;mat.normalMap=normal;mat.roughnessMap=roughness;mat.roughness=1;mat.normalScale.setScalar(id==='Grass005'?.65:.4);mat.needsUpdate=true;
  mat.userData.appearanceReference={source:'https://ambientcg.com/view?id='+id,license:'CC0-1.0',tileMetres:id==='Grass005'?1/.36:1/.26,siteSample:false,quantityEligible:false};onTextureLoad();
 })):Promise.resolve([]);
 // Existing access asphalt and the Mäe tn junction, fitted from sheet01.
 // Five restoration hatches remain separate source contours.
 const accessShape=new THREE.Shape();roadContour.forEach(([x,z],i)=>i?accessShape.lineTo(x,-z):accessShape.moveTo(x,-z));accessShape.closePath();
 const road=mesh('Sheet01 existing asphalt and Mäe tn junction',new THREE.ShapeGeometry(accessShape),asphalt,groundY+.004);road.userData={...road.userData,source:siteAccessReference.source,positionAuthority:siteAccessReference.method,surveyVerified:false,reference:siteAccessReference};
 const sidewalkShape=new THREE.Shape();siteWalkwayContour.forEach(([x,z],i)=>i?sidewalkShape.lineTo(x,-z):sidewalkShape.moveTo(x,-z));sidewalkShape.closePath();
 const sidewalk=mesh('Sheet01 existing paved sidewalk',new THREE.ShapeGeometry(sidewalkShape),material('#a49d88'),groundY+.004);
 sidewalk.userData={...sidewalk.userData,source:'PDF49/sheet01; §3.4.2 entrance asphalt restored up to the existing sidewalk',positionAuthority:siteAccessReference.method,surveyVerified:false,materialAppearance:'illustrative uncalibrated paving colour'};
 const trunkMaterial=material('#766b5a');trunkMaterial.name='decorative_tree_bark';
 const leaves=material('#7c8860');leaves.name='photo_guided_birch_foliage';leaves.side=THREE.DoubleSide;leaves.alphaTest=.35;
 const leafPixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4,u=(x-32)/27,v=(y-32)/29,e=u*u+v*v+(Math.sin(x*.77)*Math.sin(y*.43))*.12;leafPixels[i]=leafPixels[i+1]=leafPixels[i+2]=230+Math.round(20*Math.sin(x*.16+y*.21));leafPixels[i+3]=e<1?255:0;}
 const leafTexture=new THREE.DataTexture(leafPixels,64,64,THREE.RGBAFormat);leafTexture.colorSpace=THREE.SRGBColorSpace;leafTexture.generateMipmaps=true;leafTexture.minFilter=THREE.LinearMipmapLinearFilter;leafTexture.magFilter=THREE.LinearFilter;leafTexture.needsUpdate=true;textures.push(leafTexture);leaves.map=leafTexture;
 // Keep the one source symbol anchor; crown and height are unmeasured.
 const trees=sitePlanReference.vegetation.map(p=>({id:p.id,x:p.anchor[0],z:p.anchor[1],h:9.4,anchor:p.anchor}));
 const branchGeometry=new THREE.CylinderGeometry(1,1,1,8),leafGeometry=new THREE.PlaneGeometry(1,1);geometries.push(branchGeometry,leafGeometry);
 const branches=[],leafPlacements=[];let rng=91371;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
 for(const tree of trees){
  const {x,z,h}=tree,groundOffset=relief.height(x,z);branches.push({a:[x,groundOffset,z],b:[x+.08,h*.72+groundOffset,z+.12],r:.17});
  for(let i=0;i<15;i++){const a=i*2.399,base=groundOffset+h*(.37+i*.022),reach=1.55+random()*1.3;branches.push({a:[x,base,z],b:[x+Math.cos(a)*reach,base+1.4+random(),z+Math.sin(a)*reach],r:.025+random()*.025});}
  for(let i=0;i<1350;i++){let u,v,w;do{u=random()*2-1;v=random()*2-1;w=random()*2-1;}while(u*u+v*v+w*w>1);leafPlacements.push({position:[centerX+x+u*3.0,groundY+groundOffset+h*.69+v*h*.29,centerZ+z+w*2.75],size:.27+random()*.30,angle:[random()*Math.PI,random()*Math.PI*2,random()*Math.PI*2],colour:new THREE.Color().setHSL(.22+random()*.08,.18+random()*.15,.22+random()*.17)});}
 }
 const branchMesh=new THREE.InstancedMesh(branchGeometry,trunkMaterial,branches.length),leafMesh=new THREE.InstancedMesh(leafGeometry,leaves,leafPlacements.length),dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
 branches.forEach((b,i)=>{const a=new THREE.Vector3(...b.a),end=new THREE.Vector3(...b.b),delta=end.clone().sub(a);dummy.position.copy(a.add(end).multiplyScalar(.5)).add(new THREE.Vector3(centerX,groundY,centerZ));dummy.quaternion.setFromUnitVectors(up,delta.clone().normalize());dummy.scale.set(b.r,delta.length(),b.r);dummy.updateMatrix();branchMesh.setMatrixAt(i,dummy.matrix);});
 leafPlacements.forEach((p,i)=>{dummy.position.fromArray(p.position);dummy.rotation.set(...p.angle);dummy.scale.set(p.size,p.size*.9,1);dummy.updateMatrix();leafMesh.setMatrixAt(i,dummy.matrix);leafMesh.setColorAt(i,p.colour);});
 for(const m of [branchMesh,leafMesh]){m.castShadow=m.receiveShadow=true;m.computeBoundingBox();m.computeBoundingSphere();m.userData={presentationOnly:true,physical:false,quantityEligible:false,quantity:0,source:'Photo-guided illustrative vegetation;2011 photos are dated',surveyVerified:false};group.add(m);}
 group.userData.vegetation={sourceAnchorPreserved:true,trees:trees.length,positionsSurveyed:false,heightSurveyed:false};
 scene.add(group);
 return {group,materialReady,setVisible(value){group.visible=!!value;},setDimensionMode(value){branchMesh.visible=leafMesh.visible=!value;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}};
}
