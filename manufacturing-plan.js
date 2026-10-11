import {profileCuts} from './profile-cuts.js';

// Source part -> stock blank -> ordered rectangular cuts -> profile marking.
// The finishing lines are drawing coordinates, never machine instructions.
export function manufacturingPlan(packing,parts){
 const originals=new Map(parts.map(p=>[p.id,p]));
 if(originals.size!==parts.length)throw Error('Duplicate manufacturing source ID');
 const rectangularCuts=[],profileMarking=[],partResults=[],seen=new Set();
 for(const sheet of packing.sheets){
  const cuts=sheet.cuts.map(c=>({...c,id:`CUT-${sheet.id}-${String(c.order).padStart(3,'0')}`,sheet:sheet.id,units:'mm',kind:'rectangular-guillotine-candidate',dependsOn:c.order>1?[`CUT-${sheet.id}-${String(c.order-1).padStart(3,'0')}`]:[]}));
  rectangularCuts.push(...cuts);
  for(const placed of sheet.parts){
   const source=originals.get(placed.id);
   if(!source||seen.has(placed.id)||placed.rotated||placed.width!==source.width||placed.height!==source.height||
    ![placed.xSheet,placed.ySheet].every(Number.isFinite)||placed.xSheet<0||placed.ySheet<0||
    placed.xSheet+placed.width>sheet.width||placed.ySheet+placed.height>sheet.height)throw Error('Invalid manufacturing placement '+placed.id);
   seen.add(placed.id);
   // Facade/profile coordinates have +Y up; stock drawings have +Y down.
   const onSheet=([x,y])=>[placed.xSheet+x,placed.ySheet+placed.height-y];
   const sourceLines=profileCuts(source);
   for(const line of sourceLines)for(const [x,y] of [line.from,line.to]){
    if(![x,y].every(Number.isFinite)||x< -1e-7||y< -1e-7||x>source.width+1e-7||y>source.height+1e-7)throw Error('Profile leaves source blank '+source.id);
   }
   const lines=sourceLines.map(c=>({...c,id:`PROFILE-${source.id}-E${String(c.edge).padStart(2,'0')}`,sheet:sheet.id,units:'mm',
    blankOrigin:'bottom-left; +Y up',sheetOrigin:'top-left; +Y down',sheetFrom:onSheet(c.from),sheetTo:onSheet(c.to),
    sheetAngleDegrees:Math.atan2(-Math.sin(c.angleDegrees*Math.PI/180),Math.cos(c.angleDegrees*Math.PI/180))*180/Math.PI,
    sheetKeepSide:c.keepSide==='left'?'right':'left',
    dependsOn:cuts.map(c=>c.id),kind:'profile-marking-candidate',secondaryKerfModelled:false}));
   profileMarking.push(...lines);
   partResults.push({part:source.id,sheet:sheet.id,status:lines.length?'blank-packed-profile-review-required':'blank-packed',
    blank:{width:placed.width,height:placed.height,xSheet:placed.xSheet,ySheet:placed.ySheet,rotated:false},
    rectangularCutIds:cuts.filter(c=>c.part===source.id).map(c=>c.id),profileMarkingIds:lines.map(c=>c.id)});
  }
 }
 for(const rejected of packing.rejected){
  const source=originals.get(rejected.id);
  if(!source||seen.has(rejected.id)||source.width!==rejected.width||source.height!==rejected.height)throw Error('Invalid manufacturing rejection '+rejected.id);
  seen.add(rejected.id);partResults.push({part:rejected.id,sheet:null,status:'rejected',reason:rejected.reason,rectangularCutIds:[],profileMarkingIds:[]});
 }
 if(seen.size!==originals.size)throw Error('Missing manufacturing source parts');
 return {approved:false,units:'mm',rectangularCuts,profileMarking,partResults,
  limits:['Candidate stock placements and ordered rectangular cuts only','Profile lines retain sheet identity; secondary profiling kerf, tool offsets and allowances remain unmodelled','No machine G-code, fastening design or approval']};
}
