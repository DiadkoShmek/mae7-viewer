// PP-1 is horizontal attic-floor insulation, not pitched-roof insulation.
export const atticFloorSpec=Object.freeze({level:8.525,thickness:.450,lambdaMaximum:.041,source:'PDF60/арк12 PP-1; §5.4 PDF19–20',approved:false,levelStatus:'section datum; existing floor thickness and clearances require survey'});
export function createAtticFloor(THREE,parent,{material,width=39.970,depth=10.810,x=0,z=0,inspection=false}={}){
 const s=atticFloorSpec,m=material??new THREE.MeshStandardMaterial({color:'#c1b784',roughness:.98});m.name=m.name||'mineral_wool';
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,s.thickness,depth),m),pose=new THREE.Matrix4().makeTranslation(x,s.level+s.thickness/2,z);
 parent.updateWorldMatrix(true,false);mesh.applyMatrix4(parent.matrixWorld.clone().invert().multiply(pose));
 mesh.name=inspection?'PP1-inspection-projection':'PP1-attic-floor';mesh.userData={assembly:'attic-floor',inspectionRepresentation:inspection,newStockPart:false,approved:false,sourceThickness:.450,sourceDatum:s.level,component:{kind:'attic-insulation',title:'PP-1 · насипна вата450мм',source:s.source,note:'Горизонтальне утеплення існуючого горищного перекриття. Старі250мм видаляються; проєктний новий шар450мм. Рівень8.525 — графічна прив’язка; товщина існуючого перекриття, проходи, вітровідбійники й проходки потребують робочого вузла.'}};
 mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
