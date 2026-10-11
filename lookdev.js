import * as THREE from 'three';
import {HDRLoader} from './assets/HDRLoader.js';
import {requestAsset} from './asset-request.js';
import {configureGlassPresentation} from './glass-presentation.js';
import {daylightSkySpec,daylightSkyPixels} from './daylight-sky.js';

let daylightSource;
export function preloadDaylight(){
 if(!daylightSource)daylightSource=requestAsset('./assets/quadrangle_sunny_1k.hdr',{timeoutMs:15000}).then(bytes=>{
  const data=new HDRLoader().parse(bytes.buffer);
  const texture=new THREE.DataTexture(data.data,data.width,data.height,THREE.RGBAFormat,data.type);
  texture.colorSpace=THREE.LinearSRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=false;texture.flipY=true;texture.needsUpdate=true;
  return texture;
 }).catch(error=>{daylightSource=null;throw error;});
 return daylightSource;
}

// Presentation lighting, not the surveyed surroundings or solar orientation.
// The CC0 HDR is used for illumination/reflections, never as site geometry.
function skyTexture(useFloat=true){
 const {width,height}=daylightSkySpec,encoded=daylightSkyPixels(width,height),data=new Uint16Array(encoded.length);
 for(let i=0;i<encoded.length;i++){const s=encoded[i]/255;data[i]=THREE.DataUtils.toHalfFloat(i%4===3?1:s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4));}
 // Three converts equirectangular backgrounds through a cube render target.
 // A float-limited device therefore needs a byte sky too, not just no FXAA.
 const pixels=useFloat?data:Uint8Array.from(data,n=>Math.round(THREE.DataUtils.fromHalfFloat(n)*255));
 const background=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat,useFloat?THREE.HalfFloatType:THREE.UnsignedByteType);
 background.name='Stroika illustrative daylight';
 background.colorSpace=THREE.LinearSRGBColorSpace;background.mapping=THREE.EquirectangularReflectionMapping;
 background.magFilter=THREE.LinearFilter;background.minFilter=THREE.LinearFilter;background.needsUpdate=true;
 return background;
}
export function setupLookdev(scene){
 // A restrained outdoor sky, not a photograph of the surveyed surroundings.
 const background=skyTexture();
 scene.background=background;scene.fog=new THREE.Fog(daylightSkySpec.horizon,daylightSkySpec.fogNear,daylightSkySpec.fogFar);
 scene.userData.presentationSky={...daylightSkySpec,worldSpace:true,source:'Authored illustrative daylight; not site photography'};
 // Neutral sky bounce keeps the shaded end readable without recolouring FC.
 const ambient=new THREE.HemisphereLight('#eef2f3','#aeb8b2',.55);
 ambient.name='Lookdev · outdoor bounce';scene.add(ambient);
 const sun=new THREE.DirectionalLight('#fff5e7',2.4);
 sun.name='Lookdev · soft daylight';sun.position.set(-24,34,42);
 sun.target.position.set(0,4,0);sun.castShadow=true;
 const shadowSize=2048;
 sun.shadow.mapSize.set(shadowSize,shadowSize);
 Object.assign(sun.shadow.camera,{left:-30,right:30,top:24,bottom:-20,near:1,far:110});
 // Contact offset stays below one desktop shadow texel; 40mm detached reveals.
 sun.shadow.bias=-.00012;sun.shadow.normalBias=.006;
 sun.shadow.radius=2;scene.add(sun,sun.target);
 // Broad opposite sky fill is presentation light, not another surveyed sun.
 const fill=new THREE.DirectionalLight('#edf2f4',.40);
 fill.name='Lookdev · neutral sky fill';fill.position.set(24,16,-32);
 fill.target.position.set(0,4,0);fill.castShadow=false;
 scene.add(fill,fill.target);
 return {sun,ambient,fill};
}

export function configureRendererBase(renderer,scene){
 const useFloat=renderer.extensions.has('EXT_color_buffer_float');
 if(scene.background?.name==='Stroika illustrative daylight'&&scene.background.type!==(useFloat?THREE.HalfFloatType:THREE.UnsignedByteType)){
  scene.background.dispose();scene.background=skyTexture(useFloat);
 }
 scene.userData.presentationSky={...scene.userData.presentationSky,buffer:useFloat?'half-float':'linear-byte-capability-limit'};
 configureGlassPresentation(scene);
 // Bound future transmissive surfaces and reapply after context restoration.
 renderer.transmissionResolutionScale=.5;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 // The daylight and its shadow camera are fixed. Camera-only movement can
 // reuse this map; the viewer explicitly invalidates it on assembly changes.
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 // The installed shader adds bias before its <= / >= depth comparison.
 // Reversed depth therefore needs the opposite sign to linear depth.
 scene.traverse(o=>{if(o.isDirectionalLight&&o.castShadow)o.shadow.bias=renderer.capabilities.reversedDepthBuffer ? .00012 : -.00012;});
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 scene.traverse(o=>{
  if(!o.isMesh)return;
  for(const m of Array.isArray(o.material)?o.material:[o.material]){
   for(const key of ['map','normalMap','roughnessMap','metalnessMap'])if(m[key])m[key].anisotropy=anisotropy;
  }
 });
}

export async function configureRenderer(renderer,scene,{isCurrent=()=>true}={}){
 configureRendererBase(renderer,scene);
 if(!renderer.extensions.has('EXT_color_buffer_float')){
  scene.environment=null;scene.userData.lookdev={...scene.userData.lookdev,environment:'neutral daylight: float render targets unavailable'};
  return {mode:'daylight base · capability limit',dispose(){}};
 }
 const source=await preloadDaylight();if(!isCurrent())return null;
 // Keep the decoded CPU source. A PMREM render target has no pixel source
 // to re-upload after context loss, so it must be generated again.
 const hdr=source.clone();hdr.needsUpdate=true;
 const pmrem=new THREE.PMREMGenerator(renderer);pmrem.compileEquirectangularShader();
 let environment;
 try{environment=pmrem.fromEquirectangular(hdr);}finally{hdr.dispose();pmrem.dispose();}
 if(!isCurrent()){environment.dispose();return null;}
 scene.environment=environment.texture;
 scene.environmentIntensity=.32;scene.environmentRotation.y=Math.PI*.64;
 scene.userData.lookdev={environment:'Poly Haven quadrangle_sunny · CC0',surroundings:'illumination only',colourSamples:'manufacturer screen reference, not calibrated stock',shadowContactOffsetM:.006,readability:{hemisphere:.55,oppositeSkyFill:.40,exposure:.95,sourceMaterialsChanged:false}};
 return {dispose:()=>environment.dispose()};
}
