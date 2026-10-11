// Uses the existing mode buttons and viewer resize handling.
const app=document.getElementById('app');
const button=document.getElementById('presentation-toggle');
if(app&&button){
 let active=false,previousFocus;
 function leave(){
  if(!active)return;
  active=false;
  document.body.classList.remove('presentation');
  button.textContent='Повний екран';
  button.setAttribute('aria-pressed','false');
  button.setAttribute('aria-label','Повний екран');
  const focus=previousFocus?.isConnected?previousFocus:button;
  focus.focus({preventScroll:true});
 }
 function enter(){
  previousFocus=document.activeElement;
  active=true;
  document.body.classList.add('presentation');
  button.textContent='Вийти · Esc';
  button.setAttribute('aria-pressed','true');
  button.setAttribute('aria-label','Вийти з показу на екрані. Escape');
  button.focus({preventScroll:true});
  // Fill the browser viewport without moving the heavy WebGL canvas into
  // the browser's native fullscreen compositor. This also works on iOS.
 }
 button.addEventListener('click',()=>active?leave():enter());
 document.addEventListener('mae-open-drawing',event=>{const exit=leave();if(event.detail)event.detail.presentationExit=exit;},{capture:true});
 document.addEventListener('keydown',event=>{
  if(active&&event.key==='Escape'){event.preventDefault();leave();}
 });
}
