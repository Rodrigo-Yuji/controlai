import type {CompraMercado,Lancamento} from './db.ts';
import {marketPaid,marketSettlement} from './management.ts';
export function marketPersonStatuses(purchase:CompraMercado,entries:Lancamento[]){const settlement=marketSettlement(purchase);return Object.entries(settlement.pessoais).map(([personId,total])=>{const offset=personId===purchase.pagadorPessoaId,received=offset?0:marketPaid(entries,purchase.id,personId,'receber'),pending=offset?0:Math.max(0,total-received);return{personId,total,received,pending,status:offset?'offset' as const:pending===0?'settled' as const:'pending' as const};});}
