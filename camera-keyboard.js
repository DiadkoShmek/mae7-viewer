import * as THREE from 'three';

// Walking uses horizontal forward/right. In an orthographic drawing W/S
// pan in screen height instead: walking along the view ray is invisible there.
export function keyboardTranslation(camera,keys,distance){
 const forward=camera.getWorldDirection(new THREE.Vector3()),right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).normalize(),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).normalize();
 const walk=forward.clone().setY(0);if(walk.lengthSq()<1e-10)walk.set(0,0,-1);walk.normalize();
 const axis=camera.isOrthographicCamera?up:walk,delta=new THREE.Vector3();
 const held=code=>keys.has(code)?1:0;
 delta.addScaledVector(axis,held('KeyW')-held('KeyS'));
 delta.addScaledVector(right,held('KeyD')-held('KeyA')+held('ArrowRight')-held('ArrowLeft'));
 delta.addScaledVector(up,held('ArrowUp')-held('ArrowDown'));
 delta.y+=held('KeyE')-held('KeyQ');
 return delta.lengthSq()?delta.normalize().multiplyScalar(distance):delta;
}
export function acceptsCameraKeys(target,viewer){
 return !!target&&!target.closest('input,textarea,select,button,a,[contenteditable="true"]')&&(target===document.body||target===document.documentElement||viewer.contains(target));
}
