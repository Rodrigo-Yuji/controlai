import {horaAtual} from './utils.ts';
import type {Lancamento} from './db.ts';
import type {Database,Tables} from './storage/types.ts';
import {projectRecurrences,invoiceMonth} from './finance.ts';
import {validDate} from './assistant.ts';
import {ensureOpenMonth} from './account-guards.ts';
export function validatePartialPayments(entries:Lancamento[]){
 const groups=new Map<string,Lancamento[]>();
 for(const e of entries){if(!e.parcial)continue;const p=e.parcial;if(!p.grupo||!['saldo','pagamento'].includes(p.papel)||!validDate(p.dataPrevista)||!validDate(e.data)||!Number.isSafeInteger(e.valorCentavos)||e.valorCentavos<=0||e.gestao||!['previsto','confirmado'].includes(e.status)||(p.papel==='pagamento'&&e.status!=='confirmado'))throw Error('Pagamento parcial inválido.');const key=`${e.contaId}:${p.grupo}`;groups.set(key,[...(groups.get(key)??[]),e]);}
 for(const rows of groups.values()){const sources=rows.filter(e=>e.parcial!.papel==='saldo');if(sources.length!==1)throw Error('Pagamento parcial sem previsão de origem única.');const source=sources[0];if(!Number.isSafeInteger(rows.reduce((sum,e)=>sum+e.valorCentavos,0)))throw Error('Total do grupo parcial inválido.');if(rows.some(e=>e.tipo!==source.tipo||e.parcial!.dataPrevista!==source.parcial!.dataPrevista||e.recorrenciaId!==source.recorrenciaId||e.grupoRecorrencia!==source.grupoRecorrencia||e.parcela?.grupo!==source.parcela?.grupo||e.parcela?.numero!==source.parcela?.numero||e.cartaoId!==source.cartaoId||e.faturaMes!==source.faturaMes))throw Error('Referências do pagamento parcial inconsistentes.');}
}
async function guard(tx:Tables,accountId:string,e:Lancamento,date?:string){await ensureOpenMonth(tx,accountId,e.data);if(e.parcial)await ensureOpenMonth(tx,accountId,e.parcial.dataPrevista);if(e.dataPrevista)await ensureOpenMonth(tx,accountId,e.dataPrevista);if(date)await ensureOpenMonth(tx,accountId,date);}
export async function recordPartialPayment(db:Database,accountId:string,target:Lancamento,amount:number,date:string){return db.transaction([db.contas,db.lancamentos,db.recorrencias,db.fechamentos],tx=>recordPartialPaymentIn(tx,accountId,target,amount,date));}
export async function recordPartialPaymentIn(tx:Tables,accountId:string,target:Lancamento,amount:number,date:string){
 if(!Number.isSafeInteger(amount)||amount<=0||!validDate(date))throw Error('Informe valor e data válidos.');
  const account=await tx.contas.get(accountId);if(!account)throw Error('Conta não encontrada.');const entries=await tx.lancamentos.where('contaId').equals(accountId).toArray();let source:Lancamento|undefined;
  if((target.id??0)<0){source=projectRecurrences(target.data.slice(0,7),accountId,await tx.recorrencias.where('contaId').equals(accountId).toArray(),entries,account.cartoes).find(e=>e.id===target.id&&e.data===target.data);if(source&&account.tipo==='gestora')source={...source,cartaoId:undefined,faturaMes:undefined};}
  else source=entries.find(e=>e.id===target.id);
  if(!source||source.status!=='previsto'||source.gestao||source.parcial?.papel==='pagamento')throw Error('A previsão foi alterada. Atualize a lista e tente novamente.');
  if(!validDate(source.data)||!Number.isSafeInteger(source.valorCentavos)||source.valorCentavos<=0)throw Error('Data ou valor da previsão inválido.');
  if(source.valorCentavos!==target.valorCentavos||source.data!==target.data||source.tipo!==target.tipo||source.categoria!==target.categoria||source.cartaoId!==target.cartaoId)throw Error('O valor ou a data da previsão mudou. Reabra o pagamento.');
  await guard(tx,accountId,source,date);if(amount>source.valorCentavos)throw Error('O valor supera o restante previsto.');
  const {id:discarded,...value}=source;void discarded;
  const card=source.cartaoId?account.cartoes?.find(c=>c.id===source.cartaoId):undefined;if(source.cartaoId&&!card)throw Error('Cartão não encontrado.');
  const metadata=source.parcial??{grupo:crypto.randomUUID(),papel:'saldo' as const,dataPrevista:source.dataPrevista??source.data};
  const base={...value,...(card?{faturaMes:source.faturaMes||invoiceMonth(metadata.dataPrevista,card)}:{}),parcial:metadata};
  const sourceId=(source.id??0)>0?source.id!:await tx.lancamentos.add({...base});
  if(amount===source.valorCentavos){await tx.lancamentos.update(sourceId,{...base,...(!source.parcial?{parcial:undefined,dataPrevista:source.dataPrevista??source.data}:{}),data:date,horario:horaAtual(),status:'confirmado'});return {remaining:0};}
  await tx.lancamentos.update(sourceId,{...base,valorCentavos:source.valorCentavos-amount});
  await tx.lancamentos.add({...base,valorCentavos:amount,data:date,horario:horaAtual(),status:'confirmado',parcial:{...metadata,papel:'pagamento'}});
  return {remaining:source.valorCentavos-amount};
}
export async function undoPartialPayment(db:Database,accountId:string,id:number){
 await db.transaction([db.lancamentos,db.fechamentos],async tx=>{
  const payment=await tx.lancamentos.get(id);if(payment?.contaId!==accountId||payment.parcial?.papel!=='pagamento')throw Error('Pagamento parcial não encontrado.');const entries=await tx.lancamentos.where('contaId').equals(accountId).toArray();const source=entries.find(e=>e.parcial?.grupo===payment.parcial!.grupo&&e.parcial.papel==='saldo');if(!source)throw Error('Previsão de origem não encontrada.');await guard(tx,accountId,payment);await guard(tx,accountId,source);
  if(source.status==='confirmado'){const {id:discarded,...value}=source;void discarded;await tx.lancamentos.add({...value,parcial:{...source.parcial!,papel:'pagamento'}});await tx.lancamentos.update(source.id!,{status:'previsto',data:source.parcial!.dataPrevista,valorCentavos:payment.valorCentavos});}
  else{const more=entries.some(e=>e.id!==id&&e.parcial?.grupo===payment.parcial!.grupo&&e.parcial.papel==='pagamento');await tx.lancamentos.update(source.id!,{valorCentavos:source.valorCentavos+payment.valorCentavos,...(!more?{parcial:undefined}:{})});}
  await tx.lancamentos.delete(id);
 });
}
export async function reopenPartialBalance(db:Database,accountId:string,id:number){
 await db.transaction([db.lancamentos,db.fechamentos],async tx=>{const source=await tx.lancamentos.get(id);if(source?.contaId===accountId&&source.status==='confirmado'&&!source.parcial&&source.dataPrevista){await guard(tx,accountId,source,source.dataPrevista);await tx.lancamentos.update(id,{status:'previsto',data:source.dataPrevista,dataPrevista:undefined});return;}if(source?.contaId!==accountId||source.parcial?.papel!=='saldo'||source.status!=='confirmado')throw Error('Lançamento não encontrado.');await guard(tx,accountId,source);const hasParts=(await tx.lancamentos.where('contaId').equals(accountId).toArray()).some(e=>e.parcial?.grupo===source.parcial!.grupo&&e.parcial.papel==='pagamento');await tx.lancamentos.update(id,{status:'previsto',data:source.parcial.dataPrevista,...(!hasParts?{parcial:undefined}:{})});});
}
