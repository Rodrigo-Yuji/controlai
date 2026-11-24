import type {Conta,Reserva} from './db';
import {MAIN_RESERVE,boxBalance,mainReserveName,yieldIn,rowsOfBox} from './reserve-boxes';
import {loanLateness} from './reserve-loans';
import {dataBR,hoje,moeda} from './utils';

// Início: compact view of each reserve (balance, goal and yield) and late loan installments.
export default function ReservesSummary({account,reserves,month,onOpen}:{account:Conta;reserves:Reserva[];month:string;onOpen:()=>void}){
 const boxes=[{id:MAIN_RESERVE,nome:mainReserveName(account),metaCentavos:account.reservaPrincipal?.metaCentavos,foraDaReserva:undefined as true|undefined},...(account.caixinhas??[])];
 const today=hoje(),late=(account.emprestimosReserva??[]).map(l=>({loan:l,late:loanLateness(l,today)})).filter(x=>x.late.parcelas>0);
 if((account.caixinhas??[]).length===0&&late.length===0)return null;
 return <section className="panel reserves-summary">
  <div className="sectiontitle"><h3>Reservas</h3><button type="button" className="textbutton" onClick={onOpen}>Ver reservas</button></div>
  {late.map(({loan,late:l})=><button type="button" key={loan.id} className="reserves-late" onClick={onOpen}>⚠ {loan.pessoa} · {l.parcelas} parcela{l.parcelas===1?' atrasada':'s atrasadas'} · {moeda(l.centavos)} desde {dataBR(l.desde!)}</button>)}
  {(account.caixinhas??[]).length>0&&<div className="reserves-summary-list">{boxes.map(b=>{const amount=boxBalance(reserves,b.id),pct=b.metaCentavos?Math.min(100,Math.max(0,amount/b.metaCentavos*100)):0,rendeu=yieldIn(rowsOfBox(reserves,b.id),month);return <button type="button" key={b.id||'main'} className="reserves-summary-item" onClick={onOpen}>
   <span className="reserves-summary-row"><span>{b.nome}{b.foraDaReserva&&<small> · fora da reserva</small>}</span><strong>{moeda(amount)}</strong></span>
   {b.metaCentavos?<span className="reserve-box-goal" aria-label={`${Math.floor(pct)}% da meta`}><span style={{width:`${pct}%`}}/></span>:null}
   {(b.metaCentavos||rendeu>0)&&<small className="muted">{b.metaCentavos?`${Math.floor(pct)}% de ${moeda(b.metaCentavos)}`:''}{b.metaCentavos&&rendeu>0?' · ':''}{rendeu>0?`rendeu +${moeda(rendeu)} no mês`:''}</small>}
  </button>;})}</div>}
 </section>;
}
