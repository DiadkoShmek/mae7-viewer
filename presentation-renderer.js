import * as THREE from 'three';
import {FXAAShader} from './assets/FXAAShader.js';

// One bounded HDR target and one full-screen triangle. Prefer real geometry
// coverage with MSAA, followed by a sharp ACES/sRGB output. Use FXAA only
// when the HDR and float-depth formats have no common multisample count.
// Fusing OutputPass into sampling avoids a second full-size render target.
// Architecture, picking and dimensional overlays remain outside this pass.
export const PRESENTATION_BYTE_LIMIT=128*1024*1024;
export function createPresentationRenderer(renderer){
 if(!renderer.extensions.has('EXT_color_buffer_float'))return {maxPixels:4_194_304,mode:'direct-capability-limit',bytes:0,size:[0,0],render:(scene,camera)=>renderer.render(scene,camera),prepare:(scene,camera)=>renderer.compile(scene,camera),dispose(){}};
 const gl=renderer.getContext();
 const colourSamples=[...gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)];
 const depthSamples=[...gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT32F,gl.SAMPLES)];
 const counts=colourSamples.filter(n=>(n===2||n===4)&&depthSamples.includes(n)).sort((a,b)=>b-a);
 const minimum=counts.length?Math.min(...counts):0;
 const maxPixels=Math.min(4_194_304,Math.floor(PRESENTATION_BYTE_LIMIT/(12*(minimum+1))));
 const uniforms=THREE.UniformsUtils.clone(FXAAShader.uniforms);
 uniforms.toneMappingExposure={value:renderer.toneMappingExposure};
 const sample='return texture( tex2D, uv );';
 if(!FXAAShader.fragmentShader.includes(sample))throw Error('Unsupported FXAA shader revision');
 // ShaderMaterial already receives colours from Three's generated prefix.
 // Adding colorspace_pars_fragment again compiles duplicate function bodies.
 const fragmentShader=counts.length?'#include <tonemapping_pars_fragment>\nuniform sampler2D tDiffuse; varying vec2 vUv; void main(){vec4 c=texture2D(tDiffuse,vUv); c.rgb=ACESFilmicToneMapping(c.rgb);gl_FragColor=sRGBTransferOETF(c);}':'#include <tonemapping_pars_fragment>\n'+
  FXAAShader.fragmentShader.replace(sample,'vec4 colour = texture( tex2D, uv );\ncolour.rgb = ACESFilmicToneMapping( colour.rgb );\nreturn sRGBTransferOETF( colour );');
 const material=new THREE.ShaderMaterial({uniforms,fragmentShader,
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
  depthTest:false,depthWrite:false,toneMapped:false});
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,0,2],2));
 const screen=new THREE.Scene(),triangle=new THREE.Mesh(geometry,material),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 triangle.frustumCulled=false;screen.add(triangle);
 let target=null,width=0,height=0,disposed=false;
 function resize(w,h){
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>maxPixels||Math.max(w,h)>3072)throw Error('Presentation target exceeds render budget');
  if(target&&width===w&&height===h)return;
  // Release the old target before allocating its replacement on a resize.
  target?.dispose();target=null;
  target=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,
   depthBuffer:true,depthTexture:new THREE.DepthTexture(w,h,THREE.FloatType),stencilBuffer:false,samples:counts.find(n=>w*h*12*(n+1)<=PRESENTATION_BYTE_LIMIT)??0,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
  target.texture.colorSpace=THREE.LinearSRGBColorSpace;
  width=w;height=h;uniforms.resolution.value.set(1/w,1/h);uniforms.tDiffuse.value=target.texture;
 }
 return {
  maxPixels,
  get mode(){return counts.length?'msaa-'+(target?.samples??minimum)+'-display-space':'fxaa-display-space';},
  get bytes(){return width*height*12*(1+(target?.samples??0));}, // Resolved and multisample RGBA16F + float depth; excludes other scene resources.
  get size(){return [width,height];},
  prepare(scene,view){
   if(disposed)throw Error('Presentation renderer disposed');
   const oldTarget=renderer.getRenderTarget();
   if(oldTarget!==null)throw Error('Presentation expects the default framebuffer');
   const size=renderer.getDrawingBufferSize(new THREE.Vector2());resize(size.x,size.y);
   // Submit hidden inspection shaders in the actual HDR colour path. This
   // does not claim GPU completion. Avoid compileAsync's unbounded internal
   // polling after context loss; no timer/promise survives this submission.
   try{renderer.setRenderTarget(target);return renderer.compile(scene,view);}
   finally{renderer.setRenderTarget(oldTarget);}
  },
  render(scene,view){
   if(disposed)throw Error('Presentation renderer disposed');
   if(renderer.toneMapping!==THREE.ACESFilmicToneMapping||renderer.outputColorSpace!==THREE.SRGBColorSpace)throw Error('Presentation colour contract changed');
   const oldTarget=renderer.getRenderTarget(),oldReset=renderer.info.autoReset;
   if(oldTarget!==null)throw Error('Presentation expects the default framebuffer');
   const size=renderer.getDrawingBufferSize(new THREE.Vector2());resize(size.x,size.y);
   uniforms.toneMappingExposure.value=renderer.toneMappingExposure;
   renderer.info.autoReset=false;renderer.info.reset();
   try{
    renderer.setRenderTarget(target);renderer.render(scene,view);
    renderer.setRenderTarget(null);renderer.render(screen,camera);
   }finally{renderer.setRenderTarget(oldTarget);renderer.info.autoReset=oldReset;}
  },
  dispose(){if(disposed)return;disposed=true;target?.dispose();target=null;geometry.dispose();material.dispose();width=height=0;}
 };
}
