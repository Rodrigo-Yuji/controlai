import type {InicioControle,Lancamento,Reserva,TransferenciaPessoal} from './db.ts';
export function periodEnd(period:string){if(period.length===10)return period;const [year,month]=period.split('-').map(Number);return new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);}
// Opening total is capital already present, never income. Reserve retains its
// entire deposit/withdrawal history and is separated from the combined total.
export function registeredBalance(entries:Lancamento[],reserves:Reserva[],transfers:TransferenciaPessoal[],period:string,opening?:InicioControle){
 const end=periodEnd(period),reserve=reserves.filter(r=>r.data<=end).reduce((s,r)=>s+r.valorCentavos,0);
 if(opening&&end<opening.data)return {current:0,reserve,total:0,unavailable:true};
 const cash=(opening?.saldoCentavos??0)+entries.filter(e=>e.status==='confirmado'&&e.data<=end&&(!opening||e.data>=opening.data)).reduce((s,e)=>s+(e.tipo==='receita'?e.valorCentavos:-e.valorCentavos),0)-transfers.filter(t=>t.data<=end&&(!opening||t.data>=opening.data)).reduce((s,t)=>s+t.valorCentavos,0);
 return {current:cash-reserve,reserve,total:cash,...(opening?{unavailable:false}:{})};
}
