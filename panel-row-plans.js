// Shared exterior courses: bounded V20 candidate, not architectural floors,
// a supplier fixing design, or fabrication approval.
export const commonPanelCourses=Object.freeze([0,1113,2371,3629,4887,6009,7267,8525]);
// Current mounting direction: full finished1250mm sheets at the bottom,
// eight-millimetre joints, and the sole height remainder at the eave.
// The older common courses above remain an explicit historical study.
export function bottomUpRowPlan(height,{panelHeight=1250,joint=8}={}){
 if(![height,panelHeight,joint].every(Number.isSafeInteger)||height<=joint||panelHeight<=0||joint<0||joint%2)throw Error('Invalid bottom-up panel courses');
 const pitch=panelHeight+joint,rowLevels=[0];
 for(let y=pitch;y<height;y+=pitch)rowLevels.push(y);
 rowLevels.push(height);
 validateRowLevels(rowLevels,{height,panelHeight,joint});
 return {rowLevels,panelHeight,joint,installation:'bottom-full-top-remainder',approved:false,readyToCut:false};
}
export function validateRowLevels(rowLevels,{height,panelHeight,joint=8}){
 if(!Array.isArray(rowLevels)||rowLevels.length<2||![height,panelHeight,joint].every(Number.isSafeInteger)||height<=0||panelHeight<=0||joint<0||joint%2||rowLevels[0]!==0||rowLevels.at(-1)!==height)throw Error('Explicit rows require integer height, positive finished panelHeight, even joint and matching endpoints');
 if(rowLevels.some((v,i)=>!Number.isSafeInteger(v)||(i&&(v<=rowLevels[i-1]||v-rowLevels[i-1]<=joint||v-rowLevels[i-1]-joint>panelHeight))))throw Error('Invalid course: every finished height must be positive and <= panelHeight');
 return [...rowLevels];
}
export function commonRowLevels(height){
 if(height!==8525&&height!==9475)throw Error('Common course candidate is bound to current 8525/9475 mm facade heights');
 return height===8525?[...commonPanelCourses]:[...commonPanelCourses,height];
}
export function commonRowPlan(height){
 const rowLevels=validateRowLevels(commonRowLevels(height),{height,panelHeight:1250,joint:8});
 return {rowLevels,panelHeight:1250,joint:8,rectanglePartition:'best',status:'COMMON_COURSE_CANDIDATE',approved:false,readyToCut:false,necessaryOnly:true,limits:{minWidth:50,minHeight:160},boundary:'Common straight courses and rectangle cuts are a geometric candidate. 50/160 are conservative scenario prefilters; Patina WOOD DIM rev02.2026 p17 small-board100–150mm clause is not replaced by these limits.'};
}
