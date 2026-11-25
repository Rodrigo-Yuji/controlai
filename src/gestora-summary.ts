import type {Conta,Lancamento,PessoaGestora} from './db.ts';
import {contributionPaid,contributionTarget,personMarketBalance} from './management.ts';

// Situação de cada pessoa da conta Gestora no mês: contribuição e mercado.
// `deveConta`: reembolsos de itens pessoais de mercado ainda não pagos à conta (todas
// as compras até o fim do mês). `contaDeve`: repasses que a conta ainda deve a quem pagou.
export interface PersonMonth{person:PessoaGestora;target:number;paid:number;falta:number;pessoaisMes:number;deveConta:number;contaDeve:number}
export function personMonth(account:Conta,entries:Lancamento[],month:string,person:PessoaGestora):PersonMonth{
 const target=contributionTarget(person,month),paid=contributionPaid(entries,person.id,month);
 const upTo=(account.mercados??[]).filter(p=>p.data.slice(0,7)<=month),inMonth=upTo.filter(p=>p.data.slice(0,7)===month);
 const all=personMarketBalance(upTo,entries,person.id),current=personMarketBalance(inMonth,entries,person.id);
 return {person,target,paid,falta:Math.max(0,target-paid),pessoaisMes:current.pessoais,deveConta:Math.max(0,all.receber-all.recebido),contaDeve:Math.max(0,all.pagar-all.pago)};
}
export const activePeople=(account:Conta,month:string)=>(account.pessoas??[]).filter(p=>p.inicioMes<=month&&(!p.fimMes||p.fimMes>=month));
