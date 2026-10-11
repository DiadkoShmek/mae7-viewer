// Thin architectural glazing needs visibility and reflections, not a second
// offscreen render of the entire building at every pointer movement. Keep
// native physical materials intact and use shared display clones for glass.
// This is an optical approximation; it does not change glazing geometry,
// pane count, part owners, dimensions or quantity calculations.
const displays=new WeakMap(),sources=new WeakMap();
export function physicalGlassMaterial(material){return sources.get(material)||material;}
export function glassDisplayMaterial(material){
 if(!material||!(material.transmission>0)||sources.has(material))return material;
 let display=displays.get(material);if(display)return display;
 display=material.clone();display.transmission=0;display.transparent=true;
 display.opacity=Math.max(.04,Math.min(.3,1-material.transmission));
 display.depthWrite=false;display.forceSinglePass=true;
 display.name=material.name+' · display glass';
 display.userData={...display.userData,displayGlass:true,opticalMethod:'alpha surface with environment reflections',sourceTransmission:material.transmission};
 displays.set(material,display);sources.set(display,material);
 return display;
}
export function configureGlassPresentation(root){
 let count=0;root.traverse(o=>{
  if(!o.isMesh)return;
  const originals=Array.isArray(o.material)?o.material:[o.material];
  const next=originals.map(material=>glassDisplayMaterial(material));
  if(next.some((m,i)=>m!==originals[i])){o.material=Array.isArray(o.material)?next:next[0];count++;}
 });return count;
}
