import * as THREE from 'three';
import {HDRLoader} from './assets/HDRLoader.js';
import {requestAsset} from './asset-request.js';
import {configureGlassPresentation} from './glass-presentation.js';

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
export function setupLookdev(scene){
 // A restrained outdoor sky, not a photograph of the surveyed surroundings.
 const width=256,height=128,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const v=y/(height-1),sky=Math.max(0,Math.min(1,(v-.40)/.48)),cloud=Math.max(0,Math.sin(x*.047+Math.sin(y*.14))*Math.cos(y*.091+x*.021)-.42)*.30;
  const horizon=[207,215,207],zenith=[126,157,179],i=(y*width+x)*4;
  for(let c=0;c<3;c++)data[i+c]=Math.round(horizon[c]*(1-sky)+zenith[c]*sky+cloud*30);data[i+3]=255;
 }
 const background=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);background.colorSpace=THREE.SRGBColorSpace;background.mapping=THREE.UVMapping;background.magFilter=THREE.LinearFilter;background.minFilter=THREE.LinearFilter;background.needsUpdate=true;
 scene.background=background;scene.fog=new THREE.Fog('#cfd7cf',140,320);
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
