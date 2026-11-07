import type {Conta,Lancamento} from './db.ts';
import type {Database} from './storage/types.ts';
import type {EntryRequest} from './requests.ts';
import {marketPaid,marketSettlement} from './management.ts';
import {validDate} from './assistant.ts';
import {ensureOpenMonth} from './account-guards.ts';
export const requestPurchaseId=(id:string)=>'solicitacao:'+id;
export function requestReimbursement(request:EntryRequest,account:Conta|undefined,entries:Lancamento[]){
 if(!request.payload.reembolsoPessoaId||request.status!=='aprovado'||!account||account.id!==request.account_id)return null;
 const purchase=account.mercados?.find(p=>p.id===requestPurchaseId(request.id)&&p.solicitacaoId===request.id);
 if(!purchase?.pagadorPessoaId)return null;
 const total=marketSettlement(purchase).pagarCentavos,paid=marketPaid(entries.filter(e=>e.contaId===account.id),purchase.id,purchase.pagadorPessoaId,'pagar');
 return {purchase,total,paid,remaining:Math.max(0,total-paid)};
}
export async function recordRequestReimbursement(db:Database,accountId:string,requestId:string,amount:number,date:string){
 if(!validDate(date)||!Number.isSafeInteger(amount)||amount<=0)throw Error('Informe valor e data válidos.');
 return db.transaction([db.contas,db.lancamentos,db.categorias,db.fechamentos],async tx=>{
  const account=await tx.contas.get(accountId),purchase=account?.mercados?.find(p=>p.id===requestPurchaseId(requestId)&&p.solicitacaoId===requestId),person=account?.pessoas?.find(p=>p.id===purchase?.pagadorPessoaId);
  if(account?.tipo!=='gestora'||!purchase||!person)throw Error('Compra ou participante não encontrado nesta gestora.');
  await ensureOpenMonth(tx,accountId,date);
  const entries=await tx.lancamentos.where('contaId').equals(accountId).toArray(),due=marketSettlement(purchase).pagarCentavos-marketPaid(entries,purchase.id,person.id,'pagar');
  if(amount>due)throw Error('O valor supera o reembolso pendente. Confira o restante atualizado.');
  const category=purchase.categoria??'Mercado',categories=await tx.categorias.where('contaId').equals(accountId).toArray(),found=categories.find(c=>c.tipo==='despesa'&&c.nome===category),natureza=found?.natureza??purchase.natureza??'variavel';
  if(!found)await tx.categorias.add({contaId:accountId,nome:category,tipo:'despesa',natureza});
  await tx.lancamentos.add({contaId:accountId,descricao:'Reembolso · '+person.nome+' · '+purchase.descricao,valorCentavos:amount,tipo:'despesa',natureza,categoria:category,data:date,status:'confirmado',gestao:{tipo:'repasseMercado',pessoaId:person.id,compraId:purchase.id},observacao:purchase.observacao});
  return due-amount;
 });
}
