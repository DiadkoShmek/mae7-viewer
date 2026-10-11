import {requestAsset,decodeAsset,transferQueue} from './asset-request.js';

// Lossless gzip envelopes only. The JSON, buffer views, textures, semantic
// IDs and decoded buffer payloads stay exactly as authored in Blender.
export async function loadNativeTransport(loader,{suffix='',fetcher=fetch,compressedBuffers=false,onProgress=()=>{}}={}){
 onProgress({stage:'metadata'});
 let bytes;
 try{bytes=await decodeAsset(await requestAsset('./assets/mae7.gltf.gz'+suffix,{fetcher}));}
 catch(error){if(error.status)throw Error('Native model unavailable: '+error.status,{cause:error});throw error;}
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(!compressedBuffers)return loader.parseAsync(text,'./assets/');
 const schedule=transferQueue(4),cancel=new AbortController();
 // GLTFLoader 0.180's parser caches buffer dependencies. Hook only its buffer
 // reader through a registered plugin; the ordinary glTF JSON is unchanged.
 const plugin=parser=>{
  const original=parser.loadBuffer.bind(parser),definitions=parser.json.buffers;
  const total=definitions.reduce((n,b)=>n+b.byteLength,0);let loaded=0;
  onProgress({stage:'geometry',loaded,total});
  parser.loadBuffer=index=>{
   const definition=definitions[index];
   if(!/^mae7-[a-f0-9]+\.bin$/.test(definition.uri??''))return original(index);
   return schedule(async()=>{
    if(cancel.signal.aborted)throw cancel.signal.reason;
    let raw;
    try{raw=await requestAsset('./assets/'+definition.uri+'.gz'+suffix,{fetcher,signal:cancel.signal});}
    catch(error){
     // Allows an older complete source release to remain usable. Corrupted
     // data and other errors never silently fall back to a different model.
     if(error.status!==404)throw error;
     raw=await requestAsset('./assets/'+definition.uri+suffix,{fetcher,signal:cancel.signal});
    }
    const body=await decodeAsset(raw);
    if(body.byteLength!==definition.byteLength)throw Error('Native buffer length mismatch: '+definition.uri);
    loaded+=body.byteLength;onProgress({stage:loaded===total?'assembly':'geometry',loaded,total});
    return body.buffer;
   });
  };
  return {name:'MAE_lossless_buffer_transport'};
 };
 loader.register(plugin);
 try{return await loader.parseAsync(text,'./assets/');}
 catch(error){cancel.abort(error);throw error;}
 finally{loader.unregister(plugin);}
}
