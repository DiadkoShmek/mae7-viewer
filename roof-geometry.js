// Presentation candidate traced from section PP-1 (PDF55). +8.525 is the
// attic floor, not a roof edge. Cross-view differences stay in roof-source.json.
// The plane is the outer flat-pan datum. The32mm reference fold rises above it.
// thickness is a deprecated wall/gable clearance proxy, never roof geometry.
export const roofSpec=Object.freeze({attic:8.525,ridge:11.109,
 frontSpan:6.266544318625537,backSpan:6.799867239359625,
 frontEdgeY:9.547125732135884,backEdgeY:9.413795001952362,
 length:41.60018861993084,endProjection:.6000943099654196,thickness:.065,
 metalThickness:.0006,assemblyDepth:.0648,envelopeDepth:.2148,profileHeight:.032,clearanceProxy:.065,
 approved:false,source:'PP-1 / PDF55; length traced PDF53; roof-source.json'});
export function roofSide(sign){
 if(sign!==1&&sign!==-1)throw Error('Roof side must be +1 or -1');
 const span=sign>0?roofSpec.frontSpan:roofSpec.backSpan,edgeY=sign>0?roofSpec.frontEdgeY:roofSpec.backEdgeY;
 const rise=roofSpec.ridge-edgeY,angle=Math.atan2(rise,span);
 return {span,edgeY,rise,angle,slope:Math.hypot(span,rise),sign};
}
// Positive fall per metre for either side; sign selects front or rear.
export const roofSlope=sign=>{const s=roofSide(sign);return s.rise/s.span;};
export function roofSurfaceY(z){
 if(!Number.isFinite(z))throw Error('Roof coordinate must be finite');
 const side=roofSide(z<0?-1:1);
 return Math.abs(z)<=side.span+1e-9?roofSpec.ridge-roofSlope(side.sign)*Math.abs(z):null;
}
// Whole display stack includes an unconfirmed150mm existing rafter. Cropping
// adjacent exterior envelopes is a collision-free review candidate, not a
// surveyed roof/wall junction or a structural bearing design.
export function roofExteriorTop(z,clearance=.004){
 const side=roofSide(z<0?-1:1);
 return roofSurfaceY(z)-roofSpec.envelopeDepth/Math.cos(side.angle)-clearance;
}
// Renderer localY0 is the outer flat-pan datum; local +Y is outward normal.
export function roofFrame(sign){
 const s=roofSide(sign),offset=0;
 return {...s,position:[0,(roofSpec.ridge+s.edgeY)/2-Math.cos(s.angle)*offset,
  sign*(s.span/2-Math.sin(s.angle)*offset)]};
}
