// Retain the actual authored candidate across inspection and facade changes.
// A maximum board height alone does not define variable horizontal courses.
export function layoutOptions(layout){
 return {module:layout.module,offset:layout.offset,panelHeight:layout.panelHeight||0,
  ...(layout.rowLevels?{rowLevels:[...layout.rowLevels]}:{}),
  ...(layout.rectanglePartition?{rectanglePartition:layout.rectanglePartition}:{}),
  ...(layout.cutPolicy==='notched-study'?{localJoints:'none'}:layout.localJoints?{localJoints:layout.localJoints}:{}),
  ...(layout.cutPolicy==='notched-study'?{cutPolicy:layout.cutPolicy}:{})};
}
