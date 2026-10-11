// Uses the existing mode buttons and viewer resize handling.
const app=document.getElementById('app');
const button=document.getElementById('presentation-toggle');
if(app&&button){
 let active=false,enteredFullscreen=false,previousFocus,fullscreenEntry=null;
 function leave(){
  if(!active)return;
  active=false;enteredFullscreen=false;
  document.body.classList.remove('presentation');
  button.textContent='Повний екран';
  button.setAttribute('aria-pressed','false');
  button.setAttribute('aria-label','Повний екран');
  const focus=previousFocus?.isConnected?previousFocus:button;
  focus.focus({preventScroll:true});
  const exit=()=>{
   if(!active&&document.fullscreenElement===app){
    try{return Promise.resolve(document.exitFullscreen()).catch(()=>{});}catch{}
   }
  };
  // A quick drawing click can arrive before requestFullscreen settles.
  return fullscreenEntry?fullscreenEntry.then(exit):exit();
 }
 function enter(){
  previousFocus=document.activeElement;
  active=true;enteredFullscreen=false;
  document.body.classList.add('presentation');
  button.textContent='Вийти · Esc';
  button.setAttribute('aria-pressed','true');
  button.setAttribute('aria-label','Вийти з показу на екрані. Escape');
  button.focus({preventScroll:true});
  // The call stays inside this click gesture; rejection keeps the CSS view.
  if(typeof app.requestFullscreen==='function'){
   try{fullscreenEntry=Promise.resolve(app.requestFullscreen()).then(()=>{
    if(active)enteredFullscreen=document.fullscreenElement===app;
    else if(document.fullscreenElement===app){try{return Promise.resolve(document.exitFullscreen()).catch(()=>{});}catch{}}
   }).catch(()=>{});}catch{}
  }
 }
 button.addEventListener('click',()=>active?leave():enter());
 document.addEventListener('mae-open-drawing',event=>{const exit=leave();if(event.detail)event.detail.presentationExit=exit;},{capture:true});
 document.addEventListener('keydown',event=>{
  if(active&&event.key==='Escape'){event.preventDefault();leave();}
 });
 document.addEventListener('fullscreenchange',()=>{
  if(!active)return;
  if(document.fullscreenElement===app)enteredFullscreen=true;
  else if(enteredFullscreen)leave();
 });
}
