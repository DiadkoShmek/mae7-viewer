// Rectangular, grain-preserving guillotine candidate. All dimensions are mm.
// This verifies geometric packing only, not panel fixing or optimality.
export function planCuts(parts,{width=1250,height=3050,kerf=3,trim=10}={}){
 for(const [k,v] of Object.entries({width,height,kerf,trim}))if(!Number.isInteger(v)||v<(k==='kerf'||k==='trim'?0:1))throw new Error('Invalid '+k);
 if(width<=2*trim||height<=2*trim)throw new Error('No usable sheet');
 const ids=new Set();for(const p of parts){if(!p.id||ids.has(p.id)||!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<=0||p.height<=0)throw new Error('Invalid or duplicate part');ids.add(p.id);}
 const sheets=[],rejected=[];
 const sorted=[...parts].sort((a,b)=>b.height-a.height||b.width-a.width||String(a.id).localeCompare(String(b.id)));
 for(const part of sorted){if(part.width>width-2*trim||part.height>height-2*trim){rejected.push({...part,reason:'exceeds-usable-stock'});continue;}
  let best=null;
  for(const sheet of sheets)if(sheet.colour===part.colour)for(let i=0;i<sheet.free.length;i++){const f=sheet.free[i];if(part.width<=f.width&&part.height<=f.height){const score=f.width*f.height-part.width*part.height;if(!best||score<best.score)best={sheet,index:i,score};}}
  if(!best){const sheet={id:'S'+String(sheets.length+1).padStart(3,'0'),colour:part.colour,width,height,free:[{x:trim,y:trim,width:width-2*trim,height:height-2*trim}],parts:[],cuts:[]};sheets.push(sheet);best={sheet,index:0};}
  const sheet=best.sheet,f=sheet.free.splice(best.index,1)[0];sheet.parts.push({...part,xSheet:f.x,ySheet:f.y,rotated:false});
  if(part.width<f.width)sheet.cuts.push({order:sheet.cuts.length+1,part:part.id,direction:'vertical',x:f.x+part.width,y:f.y,length:f.height,kerf:Math.min(kerf,f.width-part.width),sourceRectangle:{...f}});
  if(part.height<f.height)sheet.cuts.push({order:sheet.cuts.length+1,part:part.id,direction:'horizontal',x:f.x,y:f.y+part.height,length:part.width,kerf:Math.min(kerf,f.height-part.height),sourceRectangle:{x:f.x,y:f.y,width:part.width,height:f.height}});
  const rw=f.width-part.width-kerf,bh=f.height-part.height-kerf;
  // Vertical first cut: right strip spans the full remaining rectangle;
  // second horizontal cut affects the left strip only. No overlapping scraps.
  if(rw>0)sheet.free.push({x:f.x+part.width+kerf,y:f.y,width:rw,height:f.height});
  if(bh>0)sheet.free.push({x:f.x,y:f.y+part.height+kerf,width:part.width,height:bh});
 }
 const placedArea=sheets.flatMap(s=>s.parts).reduce((a,p)=>a+p.width*p.height,0),stockArea=sheets.length*width*height;
 return {stock:{width,height,kerf,trim},sheets,rejected,placedArea,stockArea,utilization:stockArea?placedArea/stockArea:0,unallocatedArea:stockArea-placedArea,note:'Unallocated includes reusable offcuts, trims and kerf; it is not all waste. Grain is preserved; no rotation. Candidate, not certified mounting/cutting instructions.'};
}
