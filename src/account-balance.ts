import type {Lancamento,Reserva,TransferenciaPessoal} from './db.ts';
// Cash follows the actual date, including contributions received in advance.
// Moving money into/out of the reserve never changes the combined total.
export function registeredBalance(entries:Lancamento[],reserves:Reserva[],transfers:TransferenciaPessoal[],month:string){
 const cash=entries.filter(e=>e.status==='confirmado'&&e.data.slice(0,7)<=month).reduce((s,e)=>s+(e.tipo==='receita'?e.valorCentavos:-e.valorCentavos),0)-transfers.filter(t=>t.data.slice(0,7)<=month).reduce((s,t)=>s+t.valorCentavos,0);
 const reserve=reserves.filter(r=>r.data.slice(0,7)<=month).reduce((s,r)=>s+r.valorCentavos,0);
 return {current:cash-reserve,reserve,total:cash};
}
