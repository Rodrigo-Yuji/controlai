import {moeda} from './utils.ts';
import {validDate} from './assistant.ts';
import type {Cartao,Conta,Lancamento,Recorrencia,TipoConta} from './db.ts';
export const accountType=(account:Conta):TipoConta=>account.tipo??(account.conjunta?'casal':'solo');
export function shiftMonth(month:string,delta:number){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7);}
export function invoiceMonth(date:string,card:Cartao|undefined){
 if(!card||!validDate(date))return '';
 const [y,m,d]=date.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();
 const closing=shiftMonth(date.slice(0,7),d>Math.min(card.fechamento,last)?1:0);
 return shiftMonth(closing,card.vencimento<=card.fechamento?1:0);
}
export function dueDate(month:string,day:number){const [y,m]=month.split('-').map(Number);return `${month}-${String(Math.min(day,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0')}`;}
export function projectRecurrences(month:string,accountId:string,recurrences:Recorrencia[],entries:Lancamento[]):Lancamento[]{
 return recurrences.filter(r=>r.contaId===accountId&&r.ativa&&r.inicio.slice(0,7)<=month&&!entries.some(e=>e.contaId===accountId&&e.recorrenciaId===r.id&&(e.parcial?.dataPrevista??e.data).slice(0,7)===month)).map(r=>({contaId:accountId,id:-(r.id??0),recorrenciaId:r.id,descricao:r.descricao,observacao:r.observacao,valorCentavos:r.valorCentavos,tipo:r.tipo,natureza:r.natureza,categoria:r.categoria,data:dueDate(month,r.dia),status:'previsto',...(r.cartaoId?{cartaoId:r.cartaoId}:{})}));
}
export function matchesEntry(entry:Lancamento,query:string,status:'todos'|'previsto'|'confirmado',cardId=''){
 const text=`${entry.descricao} ${entry.observacao??''} ${entry.categoria} ${(entry.valorCentavos/100).toFixed(2)} ${(entry.valorCentavos/100).toFixed(2).replace('.',',')} ${moeda(entry.valorCentavos)}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
 const needle=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 return (status==='todos'||entry.status===status)&&(!cardId||entry.cartaoId===cardId)&&text.includes(needle);
}

// Numeric IDs are allocated at insertion and preserved by edits, backups and sync.
export function newestEntryFirst(a:Lancamento,b:Lancamento){const savedA=(a.id??0)>0,savedB=(b.id??0)>0;if(savedA!==savedB)return savedA?-1:1;if(savedA&&savedB)return b.id!-a.id!;return b.data.localeCompare(a.data)||((b.id??0)-(a.id??0));}
