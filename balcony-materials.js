// §5.8.2 and ark16/PDF64 distinguish clear 6mm sliding panes from
// gray tempered laminated 4+4mm canopy glass. No ordered optical data exists.
const source='§5.8.2; арк16/PDF64: balcony clear tempered 6mm / canopy gray tempered laminated 4+4mm';
export const balconyGlassSpec=Object.freeze({
 clear:Object.freeze({id:'BALCONY_CLEAR_6MM',thickness:.006,color:'#f5f8f8',transmission:.98,roughness:.025,
  opticalRole:'balcony-clear-sliding-pane',sourceFacts:Object.freeze({glass:'clear',tempered:true,laminated:false,paneThicknesses:Object.freeze([.006])}),
  representation:'single physical 6mm pane'}),
 canopy:Object.freeze({id:'BALCONY_CANOPY_GRAY_4PLUS4',thickness:.008,color:'#8d9295',transmission:.90,roughness:.025,
  opticalRole:'balcony-gray-laminated-canopy-equivalent-skin',sourceFacts:Object.freeze({glass:'gray tinted',tempered:true,laminated:true,paneThicknesses:Object.freeze([.004,.004])}),
  representation:'equivalent single skin using 4+4mm glass sum; interlayer and separate laminate topology unresolved'})
});
export function createBalconyMaterials(THREE){
 const result={};
 for(const [role,s] of Object.entries(balconyGlassSpec)){
  const m=new THREE.MeshPhysicalMaterial({color:s.color,metalness:0,roughness:s.roughness,transmission:s.transmission,ior:1.5,
   // Closed glass solids use outward faces. Blender's volume exporter forces
   // doubleSided=false; FrontSide keeps source and exported optical contracts equal.
   thickness:s.thickness,opacity:1,transparent:false,side:THREE.FrontSide});
  m.name=s.id;
  m.userData={materialId:s.id,materialFamily:'glass',opticalRole:s.opticalRole,source,approved:false,units:'m',
   sourceFacts:structuredClone(s.sourceFacts),representation:s.representation,
   faceContract:'closed solid, outward winding, front faces; volume optics require no double-sided surface',
   thicknessBasis:role==='canopy'?'sum of source glass layers, excluding unknown interlayer':'source pane thickness',
   opticalCandidate:{color:s.color,transmission:s.transmission,roughness:s.roughness,ior:1.5,
    basis:'illustrative PBR values; no supplier optical specification or measured tint'},
   unknown:{supplier:null,product:null,lightTransmission:null,reflectance:null,absorption:null,deliveredTint:null,
    interlayerType:null,interlayerThickness:null,laminateOverallThickness:role==='canopy'?null:.006},
   finishAuthority:'source glass identity and nominal glass thickness; optical values are unapproved display candidates'};
  result[role]=m;
 }
 return result;
}
