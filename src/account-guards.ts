import type {Tables} from './storage/types.ts';
export async function ensureOpenMonth(tables:Tables,accountId:string,date:string){
 if((await tables.fechamentos.where('contaId').equals(accountId).toArray()).some(f=>f.mes===date.slice(0,7)))throw Error('O mês está fechado. Reabra antes de alterar valores.');
}
