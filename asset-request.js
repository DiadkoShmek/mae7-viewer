// Abort stalled transfers (including the response body), retry transient
// network/server failures once, and keep permanent HTTP errors explicit.
export async function requestAsset(url,{fetcher=fetch,timeoutMs=45000,retries=1,signal}={}){
 for(let attempt=0;attempt<=retries;attempt++){
  if(signal?.aborted)throw signal.reason;
  const controller=new AbortController();
  const cancel=()=>controller.abort(signal.reason);
  signal?.addEventListener('abort',cancel,{once:true});
  let expired=false;
  let timer;
  const heartbeat=()=>{clearTimeout(timer);timer=setTimeout(()=>{expired=true;controller.abort();},timeoutMs);};
  heartbeat();
  try{
   const response=await fetcher(url,{signal:controller.signal});
   if(!response.ok){const error=Error('Asset unavailable: '+response.status);error.status=response.status;throw error;}
   // An active slow phone transfer is not a stall. Reset the deadline on
   // received chunks, while still aborting a body that stops delivering data.
   if(!response.body)return new Uint8Array(await response.arrayBuffer());
   const reader=response.body.getReader(),chunks=[];let length=0;
   while(true){const {done,value}=await reader.read();if(done)break;heartbeat();chunks.push(value);length+=value.byteLength;}
   const bytes=new Uint8Array(length);let offset=0;
   for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   return bytes;
  }catch(error){
   if(signal?.aborted)throw signal.reason;
   if(attempt===retries||(error.status&&error.status<500&&error.status!==408&&error.status!==429)){
    if(expired)throw Error('Asset transfer timed out',{cause:error});
    throw error;
   }
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
}

// Hosts may already have decoded Content-Encoding. Inspect the bytes so we
// never inflate twice; CRC and length errors from gzip remain fatal.
export async function decodeAsset(bytes){
 if(bytes[0]!==0x1f||bytes[1]!==0x8b)return bytes;
 if(typeof DecompressionStream==='undefined')throw Error('This browser cannot decode the native model');
 return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}

export function transferQueue(limit=4){
 let active=0;const pending=[];
 function pump(){
  while(active<limit&&pending.length){
   const {run,resolve,reject}=pending.shift();active++;
   Promise.resolve().then(run).then(resolve,reject).finally(()=>{active--;pump();});
  }
 }
 return run=>new Promise((resolve,reject)=>{pending.push({run,resolve,reject});pump();});
}
