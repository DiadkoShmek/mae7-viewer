// Rectangular packing areas in mm². Free rectangles are potential offcuts,
// not an assertion that the material is reusable or that all loss is waste.
export function packingAreaAccounting(packing){
 const {width,height,trim}=packing.stock;
 const grossStockArea=packing.sheets.length*width*height;
 const placedBlankArea=packing.sheets.flatMap(s=>s.parts).reduce((a,p)=>a+p.width*p.height,0);
 const reusableOffcutCandidateArea=packing.sheets.flatMap(s=>s.free).reduce((a,r)=>a+r.width*r.height,0);
 const rectangularKerfArea=packing.sheets.flatMap(s=>s.cuts).reduce((a,c)=>a+c.kerf*c.length,0);
 const edgeTrimArea=packing.sheets.length*(width*height-(width-2*trim)*(height-2*trim));
 const balanceError=grossStockArea-placedBlankArea-reusableOffcutCandidateArea-rectangularKerfArea-edgeTrimArea;
 if(!Number.isFinite(balanceError)||Math.abs(balanceError)>1e-6)throw Error('Packing area conservation failed');
 return {unit:'mm²',grossStockArea,placedBlankArea,reusableOffcutCandidateArea,rectangularKerfArea,edgeTrimArea,
  unallocatedArea:grossStockArea-placedBlankArea,balanceError,
  note:'Unallocated = free offcut candidates + rectangular kerf + edge trim. Reuse, disposal and secondary profile kerf are not established.'};
}
