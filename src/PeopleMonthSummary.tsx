import type {ReactNode} from 'react';
import type {Conta,Lancamento} from './db';
import {activePeople,personMonth,type PersonMonth} from './gestora-summary';
import {moeda} from './utils';

const MONTHS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
// Resumo mensal por pessoa (conta Gestora): contribuição com progresso e situação do mercado.
export default function PeopleMonthSummary({account,entries,month,actions,title='Resumo do mês por pessoa'}:{account:Conta;entries:Lancamento[];month:string;actions?:(row:PersonMonth)=>ReactNode;title?:string}){
 const rows=activePeople(account,month).map(p=>personMonth(account,entries,month,p));
 const total=rows.reduce((s,r)=>({target:s.target+r.target,paid:s.paid+r.paid,deve:s.deve+r.deveConta}),{target:0,paid:0,deve:0});
 if(!rows.length)return <section className="panel"><h3>{title}</h3><p className="muted">Nenhuma pessoa ativa em {MONTHS[Number(month.slice(5,7))-1]}/{month.slice(0,4)}.</p></section>;
 return <section className="panel people-month">
  <h3>{title}</h3>
  <div className="insight-stats"><div><small>Contribuições</small><strong>{moeda(total.target)}</strong></div><div><small>Recebido pela conta</small><strong className="green">{moeda(total.paid)}</strong></div><div className={total.deve>0?'alert':''}><small>Mercado a receber</small><strong className={total.deve>0?'red':''}>{moeda(total.deve)}</strong></div></div>
  <div className="people-cards">{rows.map(r=>{const pct=r.target?Math.min(100,Math.round(r.paid/r.target*100)):100;return <div className={`person-card${r.falta>0?'':' done'}`} key={r.person.id}>
   <div className="person-card-head"><strong>{r.person.nome}</strong><span className={`person-chip ${r.falta>0?'open':'paid'}`}>{r.falta>0?`Falta ${moeda(r.falta)}`:'✓ Em dia'}</span></div>
   <div className="person-progress" aria-label={`${pct}% da contribuição`}><span style={{width:`${pct}%`}}/></div>
   <small className="person-card-line">Contribuição {moeda(r.paid)} de {moeda(r.target)}</small>
   {(r.pessoaisMes>0||r.deveConta>0||r.contaDeve>0)&&<div className="person-market">{r.pessoaisMes>0&&<span>Itens pessoais no mês <b>{moeda(r.pessoaisMes)}</b></span>}{r.deveConta>0?<span className="red">Deve à conta (mercado) <b>{moeda(r.deveConta)}</b></span>:r.pessoaisMes>0&&<span className="green">Mercado acertado ✓</span>}{r.contaDeve>0&&<span>A conta deve a ela <b>{moeda(r.contaDeve)}</b></span>}</div>}
   {actions&&<div className="person-card-actions">{actions(r)}</div>}
  </div>;})}</div>
 </section>;
}
