import type {Conta,Reserva} from './db';
import {MAIN_RESERVE,boxBalance,mainReserveName,yieldIn,rowsOfBox} from './reserve-boxes';
import {loanLateness,loansByPerson} from './reserve-loans';
import {dataBR,hoje,moeda} from './utils';

// Início: compact view of each reserve (balance, goal and yield) and late loan installments.
// `guest`: read-only view for whoever has consulta access; caixinhas kept apart
// (foraDaReserva) are someone's own money and stay hidden, and open loans are listed.
export default function ReservesSummary({account,reserves,month,onOpen,guest}:{account:Conta;reserves:Reserva[];month:string;onOpen?:()=>void;guest?:boolean}){
 const boxes=[{id:MAIN_RESERVE,nome:mainReserveName(account),metaCentavos:account.reservaPrincipal?.metaCentavos,foraDaReserva:undefined as true|undefined},...(account.caixinhas??[])].filter(b=>!guest||!b.foraDaReserva);
 const shownBoxes=boxes.length>1;
 const today=hoje(),late=(account.emprestimosReserva??[]).map(l=>({loan:l,late:loanLateness(l,today)})).filter(x=>x.late.parcelas>0);
 const openLoans=guest?loansByPerson(account.emprestimosReserva??[]).filter(p=>p.pendenteCentavos>0):[];
 if(!shownBoxes&&late.length===0&&openLoans.length===0)return null;
 const Tag=onOpen?'button':'div';
 return <section className="panel reserves-summary">
  <div className="sectiontitle"><h3>{guest?'Reservas do casal':'Reservas'}</h3>{onOpen&&<button type="button" className="textbutton" onClick={onOpen}>Ver reservas</button>}</div>
  {late.map(({loan,late:l})=><Tag type={onOpen?'button':undefined} key={loan.id} className="reserves-late" onClick={onOpen}>⚠ {loan.pessoa} · {l.parcelas} parcela{l.parcelas===1?' atrasada':'s atrasadas'} · {moeda(l.centavos)} desde {dataBR(l.desde!)}</Tag>)}
  {shownBoxes&&<div className="reserves-summary-list">{boxes.map(b=>{const amount=boxBalance(reserves,b.id),pct=b.metaCentavos?Math.min(100,Math.max(0,amount/b.metaCentavos*100)):0,rendeu=yieldIn(rowsOfBox(reserves,b.id),month);return <Tag type={onOpen?'button':undefined} key={b.id||'main'} className="reserves-summary-item" onClick={onOpen}>
   <span className="reserves-summary-row"><span>{b.nome}{b.foraDaReserva&&<small> · fora da reserva</small>}</span><strong>{moeda(amount)}</strong></span>
   {b.metaCentavos?<span className="reserve-box-goal" aria-label={`${Math.floor(pct)}% da meta`}><span style={{width:`${pct}%`}}/></span>:null}
   {(b.metaCentavos||rendeu>0)&&<small className="muted">{b.metaCentavos?`${Math.floor(pct)}% de ${moeda(b.metaCentavos)}`:''}{b.metaCentavos&&rendeu>0?' · ':''}{rendeu>0?`rendeu +${moeda(rendeu)} no mês`:''}</small>}
  </Tag>;})}</div>}
  {openLoans.length>0&&<div className="reserves-loans"><small className="muted">Empréstimos em aberto</small>{openLoans.map(p=><div key={p.pessoa} className="reserves-summary-row"><span>{p.pessoa}</span><strong>{moeda(p.pendenteCentavos)}</strong></div>)}</div>}
 </section>;
}
