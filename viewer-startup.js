// A failed multisampled context must not rule out a usable plain WebGL2
// context. Use a fresh canvas for the second attempt; never weaken privacy
// settings or silently substitute WebGL1 for a WebGL2 renderer.
export function createViewerContext(createCanvas,{preferAntialias=false}={}){
 const failures=[];
 for(const antialias of preferAntialias?[true,false]:[false,true]){
  const canvas=createCanvas();let context;
  try{context=canvas.getContext('webgl2',{antialias,alpha:false,powerPreference:'default'});}catch(error){failures.push(error.name);}
  if(!context||context.isContextLost()){failures.push('unavailable');continue;}
  let reversedDepth=false;
  try{reversedDepth=Boolean(context.getExtension('EXT_clip_control'));}catch{}
  return {canvas,context,antialias,reversedDepth};
 }
 const error=Error('WebGL2 unavailable');error.code='WEBGL2_UNAVAILABLE';error.attempts=failures;throw error;
}

// Reserve one tiny context before importing/downloading the native scene.
// The renderer takes this same context after CPU assembly; no second probe
// or large GPU buffer lives alongside the model download.
let preparedContext=null;
export function prepareViewerContext(createCanvas){
 if(!preparedContext)preparedContext=createViewerContext(createCanvas);
 return preparedContext;
}
export function releasePreparedContext(){
 const prepared=preparedContext;preparedContext=null;
 try{prepared?.context.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
}
export function takeViewerContext(createCanvas){
 const prepared=preparedContext;preparedContext=null;
 if(prepared&&!prepared.context.isContextLost())return prepared;
 return createViewerContext(createCanvas);
}
export async function launchViewer({createCanvas,load}){
 try{prepareViewerContext(createCanvas);return await load();}
 catch(error){releasePreparedContext();throw error;}
}

export function startupFailure(error,phase){
 const code=error?.code==='WEBGL2_UNAVAILABLE'?'WEBGL2_UNAVAILABLE':phase==='module'?'MODULE_LOAD':phase==='asset'?'MODEL_LOAD':'RENDER_START';
 return {code,title:code==='WEBGL2_UNAVAILABLE'?'Браузер не запустив 3D':'Не вдалося відкрити 3D',
  note:code==='WEBGL2_UNAVAILABLE'?'Браузер не надав доступу до WebGL 2. Перезавантаж сторінку й спробуй ще раз.':code==='MODEL_LOAD'||code==='MODULE_LOAD'?'Не завершилось завантаження. Перевір з’єднання й спробуй ще раз.':'Сцена завантажилась, але перший кадр не запустився. Спробуй ще раз.'};
}

export function showStartupFailure(document,error,phase){
 const failure=startupFailure(error,phase),app=document.getElementById('app');
 document.getElementById('loading').hidden=true;document.getElementById('fallback').hidden=false;
 document.getElementById('fallback-title').textContent=failure.title;
 document.getElementById('fallback-note').textContent=failure.note+' Огляд будинку залишається доступним на зображенні.';
 app.dataset.ready='false';app.dataset.startupError=failure.code;
}
