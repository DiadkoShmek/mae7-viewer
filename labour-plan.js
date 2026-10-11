// Labour budget only: inputs are crew-hours per unit, not elapsed hours.
// Missing norms stay missing; an empty cell never becomes a zero-hour job.
export function labourBudget(rows,{crew=4,days=65,hoursPerDay=8,productiveFraction=.8}={}){
 for(const [k,v] of Object.entries({crew,days,hoursPerDay,productiveFraction}))if(!Number.isFinite(v)||v<=0||k==='productiveFraction'&&v>1)throw Error('Invalid '+k);
 const included=rows.filter(r=>r.included!==false),unknown=[],known=[];
 for(const r of included){if(!Number.isFinite(r.quantity)||r.quantity<0)throw Error('Invalid quantity');
  if(r.norm===null||r.norm===undefined||r.norm===''){unknown.push(r.id);continue;}
  if(!Number.isFinite(r.norm)||r.norm<0)throw Error('Invalid labour norm');
  known.push({id:r.id,quantity:r.quantity,norm:r.norm,hours:r.quantity*r.norm});
 }
 const capacity=crew*days*hoursPerDay*productiveFraction,knownHours=known.reduce((a,r)=>a+r.hours,0),complete=included.length>0&&unknown.length===0;
 return {crew,days,hoursPerDay,productiveFraction,capacity,knownHours,unknown,known,complete,
  requiredHours:complete?knownHours:null,remainingHours:complete?capacity-knownHours:null,
  withinLabourBudget:complete?knownHours<=capacity:null,
  note:'Labour hours only. Does not prove calendar duration: access, dependencies, weather and specialists still need scheduling.'};
}
