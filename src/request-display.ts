import type {Conta,Lancamento} from './db.ts';
import type {EntryRequest,RequestVisualState} from './requests.ts';
import {requestReimbursement} from './request-reimbursement.ts';
export function requestDisplayState(row:EntryRequest,account:Conta|undefined,entries:Lancamento[]):RequestVisualState{
 if(row.status==='pendente')return 'pendente';if(row.status==='recusado')return 'recusada';if(row.status==='cancelado')return 'cancelada';
 if(row.payload.reembolsoPessoaId){const balance=requestReimbursement(row,account,entries);return balance?(balance.remaining?'reembolso_pendente':'concluida'):row.display_state??'aprovada';}
 const linked=entries.filter(e=>e.contaId===row.account_id&&e.solicitacaoId===row.id);
 return linked.length?(linked.every(e=>e.status==='confirmado')?'concluida':'aprovada'):row.display_state??'aprovada';
}
export function requestNeedsAttention(row:EntryRequest,account:Conta|undefined,entries:Lancamento[]){return row.status==='pendente'||(row.status==='aprovado'&&Boolean(row.payload.reembolsoPessoaId)&&requestDisplayState(row,account,entries)!=='concluida');}
export function newestRequestFirst(a:EntryRequest,b:EntryRequest){return b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id);}
