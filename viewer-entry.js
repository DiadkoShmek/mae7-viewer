// Keep retry available even if the main module graph cannot be downloaded.
const app=document.getElementById('app'),fallback=document.getElementById('fallback');
document.getElementById('retry-viewer').addEventListener('click',()=>location.reload());
new MutationObserver(()=>{const ready=app.dataset.ready==='true';for(const tools of document.querySelectorAll('.view-tools,.mode-tabs'))tools.inert=!ready;}).observe(app,{attributes:true,attributeFilter:['data-ready']});
import('./app.js').catch(error=>{
 if(fallback.hidden)showStartupFailure(document,error,'module');
 document.getElementById('loading').hidden=true;fallback.hidden=false;app.dataset.ready='false';
 console.error('Viewer startup failed',error);
});
import {showStartupFailure} from './viewer-startup.js';
