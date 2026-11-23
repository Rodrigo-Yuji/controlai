import type {EmprestimoReserva,InicioControle,Lancamento,Reserva,TransferenciaPessoal} from './db.ts';
import {netLent} from './reserve-loans.ts';
import {movesSpendable,reserveSpent} from './reserve-spending.ts';
import {inSeparateBox,reserveImplanted} from './reserve-boxes.ts';
export function periodEnd(period:string){if(period.length===10)return period;const [year,month]=period.split('-').map(Number);return new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);}
// Opening total is capital already present, never income. Reserve retains its
// entire deposit/withdrawal history and is separated from the combined total.
// `separate`: caixinhas kept out of the reserve and the total (foraDaReserva). Money
// guarded into them leaves the account; their own spending, loans and implantação
// don't touch it.
export function registeredBalance(entries:Lancamento[],allReserves:Reserva[],transfers:TransferenciaPessoal[],period:string,opening?:InicioControle,allLoans:EmprestimoReserva[]=[],separate:ReadonlySet<string>=new Set()){
 const end=periodEnd(period),inPeriod=(date:string)=>date<=end&&(!opening||date>=opening.data);
 const reserves=allReserves.filter(r=>!inSeparateBox(r,separate)),loans=allLoans.filter(l=>!inSeparateBox(l,separate));
 const keptApart=allReserves.filter(r=>inSeparateBox(r,separate)&&movesSpendable(r)&&inPeriod(r.data)).reduce((s,r)=>s+r.valorCentavos,0);
 const reserve=reserves.filter(r=>r.data<=end).reduce((s,r)=>s+r.valorCentavos,0);
 if(opening&&end<opening.data)return {current:0,reserve,total:0,unavailable:true};
 const cash=(opening?.saldoCentavos??0)+entries.filter(e=>e.status==='confirmado'&&e.data<=end&&(!opening||e.data>=opening.data)).reduce((s,e)=>s+(e.tipo==='receita'?e.valorCentavos:-e.valorCentavos),0)-transfers.filter(t=>t.data<=end&&(!opening||t.data>=opening.data)).reduce((s,t)=>s+t.valorCentavos,0)-netLent(loans,end,opening?.data)-reserveSpent(reserves,end,opening?.data)+reserveImplanted(reserves,end,opening?.data)-keptApart;
 return {current:cash-reserve,reserve,total:cash,...(opening?{unavailable:false}:{})};
}
