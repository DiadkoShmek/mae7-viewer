// Authored visual texture density, not the supplier's delivered finish.
// Coordinates are the facade's local metre frame. Do not choose grain from
// a piece's aspect ratio: short and tall offcuts retain the same source grain.
export const FC_TEXTURE_DENSITY=Object.freeze({across:3,along:.7});
export function fcGrainCode(grain){
 if(grain==='вертикально'||grain==='vertical')return 0;
 if(grain==='горизонтально'||grain==='horizontal')return 1;
 throw Error('Fibre-cement texture needs an explicit visual grain direction');
}
export function fibreSurfaceUV(position,normal,extent,grain){
 const code=fcGrainCode(grain),axis=code===0?1:0;
 if(![...position,...normal,...extent].every(Number.isFinite))throw Error('Non-finite fibre-cement UV frame');
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),unit=a=>{const length=Math.hypot(...a);if(length<=1e-12)throw Error('Degenerate fibre-cement face normal');return a.map(v=>v/length);};
 const n=unit(normal),source=[0,0,0];source[axis]=1;
 const tangent=source.map((v,i)=>v-n[i]*dot(source,n));
 if(Math.hypot(...tangent)>=1e-8){
  const along=unit(tangent);
  for(const i of [0,1,2].filter(i=>i!==axis)){
   const sourceAcross=[0,0,0];sourceAcross[i]=1;
   let across=sourceAcross.map((v,j)=>v-n[j]*dot(sourceAcross,n));
   across=across.map((v,j)=>v-along[j]*dot(across,along));
   if(Math.hypot(...across)>1e-8)return [dot(position,unit(across))*3,dot(position,along)*.7];
  }
  throw Error('Fibre-cement face has no across-grain tangent');
 }
 const drop=[0,1,2].reduce((a,b)=>Math.abs(normal[b])>Math.abs(normal[a])?b:a),axes=[0,1,2].filter(i=>i!==drop);
 // End grain has no in-plane source grain. Retain the old cap projection.
 const longest=[0,1,2].reduce((a,b)=>extent[b]>extent[a]?b:a);
 if(axes.includes(longest))axes.splice(0,2,axes.find(i=>i!==longest),longest);
 return [position[axes[0]]*3,position[axes[1]]*.7];
}
export function applyFibreSurfaceUV(THREE,geometry,grain,origin=[0,0,0]){
 fcGrainCode(grain);geometry.computeBoundingBox();
 const extent=geometry.boundingBox.getSize(new THREE.Vector3()).toArray(),p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
 if(!p||!n||p.count!==n.count)throw Error('Fibre-cement UV needs matching position/normal attributes');
 const values=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++)values.set(fibreSurfaceUV([p.getX(i)+origin[0],p.getY(i)+origin[1],p.getZ(i)+origin[2]],[n.getX(i),n.getY(i),n.getZ(i)],extent,grain),i*2);
 geometry.setAttribute('uv',new THREE.BufferAttribute(values,2));return geometry;
}
export function setInstanceFibreGrain(THREE,geometry,grains){
 geometry.setAttribute('fcUvGrain',new THREE.InstancedBufferAttribute(Float32Array.from(grains,fcGrainCode),1));
}
export function createInstanceFibreMaterial(THREE,source,origin=[0,0,0]){
 for(const key of ['map','normalMap','roughnessMap'])if(source[key]&&source[key].channel!==0)throw Error('Fibre-cement candidate expects source UV channel0');
 const material=source.clone();
 material.userData={...material.userData,candidateMetricFibreUV:true};
 material.customProgramCacheKey=()=> 'facade-metric-fibre-uv-v1';
 material.onBeforeCompile=shader=>{
  shader.uniforms.fcUvOrigin={value:new THREE.Vector3(...origin)};
  shader.vertexShader='attribute float fcUvGrain;\nuniform vec3 fcUvOrigin;\n'+shader.vertexShader;
  const chunk=THREE.ShaderChunk.uv_vertex.replace(/\b(?:uv|MAP_UV|NORMALMAP_UV|ROUGHNESSMAP_UV)\b/g,'fcSurfaceUV');
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>',`
   vec2 fcSurfaceUV=uv;
   #ifdef USE_INSTANCING
    vec3 fcP=(instanceMatrix*vec4(position,1.0)).xyz+fcUvOrigin;
    vec3 fcN=abs(normal);
    vec3 fcE=vec3(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz),length(instanceMatrix[2].xyz));
    bool fcX=fcN.x>=fcN.y&&fcN.x>=fcN.z;
    bool fcY=!fcX&&fcN.y>=fcN.z;
    bool fcHorizontal=fcUvGrain>0.5;
    if(fcHorizontal&&!fcX)fcSurfaceUV=vec2((fcY?fcP.z:fcP.y)*3.0,fcP.x*0.7);
    else if(!fcHorizontal&&!fcY)fcSurfaceUV=vec2((fcX?fcP.z:fcP.x)*3.0,fcP.y*0.7);
    else if(fcY)fcSurfaceUV=fcE.x>=fcE.y&&fcE.x>=fcE.z?vec2(fcP.z*3.0,fcP.x*0.7):vec2(fcP.x*3.0,fcP.z*0.7);
    else fcSurfaceUV=fcE.y>fcE.x&&fcE.y>=fcE.z?vec2(fcP.z*3.0,fcP.y*0.7):vec2(fcP.y*3.0,fcP.z*0.7);
   #endif
   ${chunk}
  `);
 };
 return material;
}
