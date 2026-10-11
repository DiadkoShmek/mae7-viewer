// Passing the dimensional filter does not admit a newly moved support scheme.
// CSVs here are candidate records; no function grants fabrication authority.
import {hasLocalJointChanges,assertLocalJointDeclaration} from './local-joint-contract.js';
export function localJointCutHold(layout){
 try{assertLocalJointDeclaration(layout);}catch{return 'Втрачено прив’язку локальних деталей до опор. Розкрій зупинено до відновлення схеми.';}
 return hasLocalJointChanges(layout)
  ?'Локальні шви змінено: опори й кріплення біля прорізів ще не погоджені. Для звірки доступні креслення та JSON.'
  :null;
}
export function houseLocalJointCutHold(report){
 return report?.layouts?.map(localJointCutHold).find(Boolean)??null;
}
