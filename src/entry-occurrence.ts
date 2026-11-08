import type {Lancamento} from './db.ts';
import type {Database} from './storage/types.ts';
import {projectRecurrences} from './finance.ts';
import {ensureOpenMonth} from './account-guards.ts';
// Keep the scheduled occurrence separate from the date chosen for this entry.
export function entryDateChange(entry:Lancamento,date:string){return {data:date,...(entry.dataPrevista?{dataPrevista:entry.dataPrevista}:entry.status==='previsto'&&date!==entry.data?{dataPrevista:entry.data}:{})};}
export async function materializeOccurrence(db:Database,accountId:string,target:Lancamento){
 if((target.id??0)>=0)return target;
 return db.transaction([db.contas,db.lancamentos,db.recorrencias,db.fechamentos],async tx=>{
  const account=await tx.contas.get(accountId);if(!account)throw Error('Conta não encontrada.');
  const entries=await tx.lancamentos.where('contaId').equals(accountId).toArray(),recurrences=await tx.recorrencias.where('contaId').equals(accountId).toArray();
  const source=projectRecurrences(target.data.slice(0,7),accountId,recurrences,entries,account.cartoes).find(e=>e.id===target.id&&e.data===target.data);
  if(!source)throw Error('A previsão foi atualizada. Reabra a lista antes de editar.');
  await ensureOpenMonth(tx,accountId,source.data);
  const {id:discarded,...value}=source;void discarded;
  const row={...value,dataPrevista:source.data,...(account.tipo==='gestora'?{cartaoId:undefined,faturaMes:undefined}:{})};
  const id=await tx.lancamentos.add(row);return {...row,id};
 });
}
