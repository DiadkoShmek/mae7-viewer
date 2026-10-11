// Interior access is an illustrative envelope, not a structural opening schedule.
// The outer threshold comes from PDF53; hall width/run and slab are unsurveyed.
export function planEntranceHall(spec,{upperFloor=.085}={}){
 const threshold=spec.threshold-spec.thresholdProfile,width=spec.doorWidth-2*spec.frame,openingWidth=spec.doorWidth+2*spec.openingFit,tread=.30,steps=4,flightFront=-1.50;
 if(!Number.isFinite(upperFloor)||upperFloor<=threshold)throw Error('Invalid illustrative entrance floor rise');
 const flightBack=flightFront-steps*tread,rise=(upperFloor-threshold)/steps;
 return {threshold,upperFloor,width,openingWidth,tread,steps,flightFront,flightBack,rise,
  floor:{length:spec.doorPlane+.10-flightFront,centreZ:(spec.doorPlane+.10+flightFront)/2,thickness:.035},
  approved:false,physical:false,quantityEligible:false,quantity:0,
  authority:'Ark20 door in main wall, ark27 VU01 2305×2100;20mm threshold and20mm frame fit are candidates. Existing model upper slab; stair count/run and interior layout require survey'};
}

export function planGroundFloorAccess(spec,centres,{width=39.45,depth=10.35,thickness=.14,centreY=.015,facadeZ=5.62}={}){
 const hall=planEntranceHall(spec,{upperFloor:centreY+thickness/2}),cuts=centres.map(x=>({x0:x-hall.openingWidth/2,x1:x+hall.openingWidth/2,z0:facadeZ+hall.flightBack,z1:depth/2})).sort((a,b)=>b.x1-a.x1);
 for(let i=0;i<cuts.length;i++)if(cuts[i].x0<=-width/2||cuts[i].x1>=width/2||cuts[i].z0<=-depth/2||cuts[i].z0>=depth/2||i&&cuts[i].x1>=cuts[i-1].x0)throw Error('Entrance access notch outside slab or overlapping');
 const contour=[[-width/2,-depth/2],[width/2,-depth/2],[width/2,depth/2]];
 for(const c of cuts)contour.push([c.x1,c.z1],[c.x1,c.z0],[c.x0,c.z0],[c.x0,c.z1]);
 contour.push([-width/2,depth/2]);
 return {width,depth,thickness,centreY,facadeZ,hall,cuts,contour,approved:false,physical:false,quantityEligible:false,quantity:0,
  removedVolume:cuts.reduce((n,c)=>n+(c.x1-c.x0)*(c.z1-c.z0)*thickness,0),
  authority:'Clearance notches in illustrative whole-floor envelope only; no proposed demolition, reinforcement or structural dimensions'};
}

export function createGroundFloorAccessGeometry(THREE,plan){
 const shape=new THREE.Shape();plan.contour.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:plan.thickness,bevelEnabled:false});
 geometry.rotateX(Math.PI/2);geometry.translate(0,plan.thickness/2,0);return geometry;
}
