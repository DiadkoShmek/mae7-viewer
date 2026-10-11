import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {GLTFLoader} from './assets/GLTFLoader.js';
import {loadNativeTransport} from './native-transport.js';
const packed=await readFile(new URL('./assets/mae7.gltf.gz',import.meta.url));
const exact=gunzipSync(packed);
for(const [name,body] of [['gzip',packed],['host decoded',exact]])test(name+' transport delivers exact native JSON and external buffer base',async()=>{
 let called=0;
 const result=await loadNativeTransport({parseAsync(text,base){called++;assert.equal(text,exact.toString('utf8'));assert.equal(base,'./assets/');const data=JSON.parse(text);assert(data.nodes.length>10000);assert(data.buffers.length>0);assert(data.buffers.every(b=>b.byteLength<=8*1024*1024&&/^mae7-[a-f0-9]+\.bin$/.test(b.uri)));return data;}},{suffix:'?v=proof',fetcher:async(url)=>{assert.equal(url,'./assets/mae7.gltf.gz?v=proof');return new Response(body);}});
 assert.equal(called,1);assert(result.bufferViews.length>6000);
});
test('failed native fetch refuses parse',async()=>{
 await assert.rejects(loadNativeTransport({parseAsync(){assert.fail('must not parse');}},{fetcher:async()=>new Response('',{status:404})}),/Native model unavailable: 404/);
});

const positions=new Float32Array([0,0,0,1,0,0,0,1,0]),body=new Uint8Array(positions.buffer);
const bufferURI='mae7-123abc.bin';
const fixture={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,translation:[2,3,4],extras:{native_id:'test-owner'}}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],bufferViews:[{buffer:0,byteLength:body.byteLength}],buffers:[{uri:bufferURI,byteLength:body.byteLength}]};
const fixtureJSON=gzipSync(JSON.stringify(fixture));
test('real GLTFLoader consumes exact lossless buffers and preserves owners and transforms',async()=>{
 for(const bytes of [gzipSync(body),body]){
  const progress=[],loader=new GLTFLoader(),callbacks=loader.pluginCallbacks.length;
  const result=await loadNativeTransport(loader,{compressedBuffers:true,suffix:'?v=exact',onProgress:p=>progress.push(p),fetcher:async url=>{
   assert(url.endsWith('?v=exact'));return new Response(url.includes('.gltf.gz')?fixtureJSON:bytes);
  }});
  assert.deepEqual([...result.scene.children[0].geometry.attributes.position.array],[...positions]);
  assert.deepEqual(result.scene.children[0].position.toArray(),[2,3,4]);assert.equal(result.scene.children[0].userData.native_id,'test-owner');
  assert.equal(loader.pluginCallbacks.length,callbacks);assert.equal(progress.at(-1).stage,'assembly');assert.equal(progress.at(-1).loaded,body.byteLength);
 }
});
test('missing compressed buffer alone falls back to the same content-addressed raw buffer',async()=>{
 const requests=[];
 const result=await loadNativeTransport(new GLTFLoader(),{compressedBuffers:true,fetcher:async url=>{
  requests.push(url);if(url.includes('.gltf.gz'))return new Response(fixtureJSON);
  if(url.endsWith('.bin.gz'))return new Response('',{status:404});return new Response(body);
 }});
 assert.equal(result.scene.children[0].geometry.attributes.position.count,3);assert.equal(requests.length,3);assert(requests.at(-1).endsWith(bufferURI));
});
test('truncated and corrupted buffers refuse the model without a raw fallback or plugin leak',async()=>{
 for(const bytes of [new Uint8Array([1,2]),new Uint8Array([0x1f,0x8b,0,0])]){
  const requests=[],loader=new GLTFLoader(),callbacks=loader.pluginCallbacks.length;
  await assert.rejects(loadNativeTransport(loader,{compressedBuffers:true,fetcher:async url=>{requests.push(url);return new Response(url.includes('.gltf.gz')?fixtureJSON:bytes);}}));
  assert.equal(requests.length,2);assert.equal(loader.pluginCallbacks.length,callbacks);
 }
});
