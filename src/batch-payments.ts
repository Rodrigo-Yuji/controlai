import {recordPartialPaymentIn} from './partial-payments.ts';
import {hoje,horaAtual} from './utils.ts';
import {ensureOpenMonth} from './account-guards.ts';
import type {Lancamento} from './db.ts';
import type {Database} from './storage/types.ts';
import {validDate} from './assistant.ts';
import {projectRecurrences} from './finance.ts';
export const entrySelectionKey=(entry:Lancamento)=>`${entry.id}:${entry.data}`;
export const canBatchConfirm=(entry:Lancamento)=>entry.status==='previsto'&&entry.parcial?.papel!=='pagamento'&&(!entry.gestao||entry.gestao.tipo==='compraMercado');
export function selectionTotals(entries:Lancamento[]){const income=entries.filter(e=>e.tipo==='receita').reduce((sum,e)=>sum+e.valorCentavos,0),expense=entries.filter(e=>e.tipo==='despesa').reduce((sum,e)=>sum+e.valorCentavos,0);return{income,expense,total:income+expense};}
export async function confirmBatch(db:Database,accountId:string,targets:Lancamento[],date=hoje()){
 if(!validDate(date))throw Error('Data de pagamento inválida.');
 if(!targets.length)throw Error('Selecione ao menos um previsto.');
 const keys=new Set(targets.map(entrySelectionKey));if(keys.size!==targets.length)throw Error('A seleção contém lançamentos repetidos.');
 await db.transaction([db.contas,db.lancamentos,db.recorrencias,db.fechamentos],async tx=>{
  const account=await tx.contas.get(accountId);if(!account)throw Error('Conta não encontrada.');const entries=await tx.lancamentos.where('contaId').equals(accountId).toArray(),recurrences=await tx.recorrencias.where('contaId').equals(accountId).toArray(),closed=new Set((await tx.fechamentos.where('contaId').equals(accountId).toArray()).map(c=>c.mes));
  const fresh=targets.map(target=>{let source=(target.id??0)>0?entries.find(e=>e.id===target.id):projectRecurrences(target.data.slice(0,7),accountId,recurrences,entries).find(e=>entrySelectionKey(e)===entrySelectionKey(target));if(source&&account.tipo==='gestora'&&(source.id??0)<0)source={...source,cartaoId:undefined,faturaMes:undefined};if(!source||!canBatchConfirm(source)||source.contaId!==accountId||source.valorCentavos!==target.valorCentavos||source.tipo!==target.tipo||source.data!==target.data||source.descricao!==target.descricao||source.categoria!==target.categoria||source.cartaoId!==target.cartaoId||source.faturaMes!==target.faturaMes)throw Error('Um previsto foi alterado ou já confirmado. Refaça a seleção.');if(account.inicioControle&&source.data<account.inicioControle.data)throw Error('Para pagar débitos anteriores ao início do controle, use Pagar parte ou Receber parte e informe a data real do pagamento.');if(!validDate(source.data))throw Error('Data inválida na seleção.');if(closed.has(source.data.slice(0,7))||(source.parcial&&closed.has(source.parcial.dataPrevista.slice(0,7))))throw Error('A seleção contém lançamento de mês fechado. Nenhum item foi confirmado.');if(!Number.isSafeInteger(source.valorCentavos)||source.valorCentavos<=0)throw Error('Valor inválido na seleção.');if(source.cartaoId&&!account.cartoes?.some(c=>c.id===source!.cartaoId))throw Error('Cartão não encontrado.');return source;});
  if(!Number.isSafeInteger(selectionTotals(fresh).total))throw Error('Total da seleção inválido.');
  await ensureOpenMonth(tx,accountId,date);
  for(const source of fresh){if(!source.gestao)await recordPartialPaymentIn(tx,accountId,source,source.valorCentavos,date);else await tx.lancamentos.update(source.id!,{status:'confirmado',data:date,horario:horaAtual()});}
 });return selectionTotals(targets);
}
