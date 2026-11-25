import ContributionProgress from './ContributionProgress';
import {personalBalances} from './couple-budget';
import {personMonth} from './gestora-summary';
import type {Snapshot} from './sync/snapshot';
import {moeda} from './utils';
import type {ViewerIdentity} from './viewer-identity';

// Guest home: what matters to the person who is looking, first.
// Gestora: their contribution of the month. Casal: their personal balance.
export default function GuestYou({snapshot,month,identity}:{snapshot:Snapshot;month:string;identity:ViewerIdentity|null}){
 const account=snapshot.contas[0];
 if(!identity)return null;
 if(account.tipo==='gestora'){
  const person=(account.pessoas??[]).find(p=>p.id===identity.pessoa_id);if(!person)return null;
  const {target,paid,falta:missing,deveConta,contaDeve,pessoaisMes}=personMonth(account,snapshot.lancamentos,month,person);
  return <section className="panel guest-you"><h3>Você · {person.nome}</h3>
   <div className="guest-you-figures"><div><small>Contribuição do mês</small><strong>{moeda(target)}</strong></div><div><small>Você já pagou</small><strong className="green">{moeda(paid)}</strong></div><div><small>Falta pagar</small><strong className={missing>0?'red':'green'}>{missing>0?moeda(missing):'Em dia ✓'}</strong></div></div>
   {target>0&&<ContributionProgress target={target} paid={paid} name={person.nome}/>}
   <div className="guest-you-market"><div className={deveConta>0?'alert':''}><small>Você deve à conta · mercado</small><strong className={deveConta>0?'red':'green'}>{deveConta>0?moeda(deveConta):'Nada ✓'}</strong>{pessoaisMes>0&&<span>itens pessoais no mês: {moeda(pessoaisMes)}</span>}</div>{contaDeve>0&&<div><small>A conta deve a você</small><strong>{moeda(contaDeve)}</strong><span>repasse de mercado</span></div>}</div>
  </section>;
 }
 const holder=Number(identity.pessoa_id.split(':')[1]);
 const balance=personalBalances(account,month+'-31')[holder-1];if(!balance)return null;
 return <section className="panel guest-you"><h3>Você · {identity.nome}</h3>
  <div className="guest-you-figures"><div><small>Seu saldo pessoal a receber</small><strong className={balance.pendente>0?'green':''}>{moeda(balance.pendente)}</strong></div><div><small>Já transferido para você</small><strong>{moeda(balance.transferido)}</strong></div><div><small>Total da sua parte</small><strong>{moeda(balance.creditado)}</strong></div></div>
  <small className="muted">Acumulado até {month.slice(5)}/{month.slice(0,4)}, pela divisão pessoal do casal.</small>
 </section>;
}
