import type {Lancamento} from './db.ts';

// Devolução de gasto (estorno): alguém devolveu parte de uma despesa já paga,
// como o troco do almoço. Fica gravada como despesa NEGATIVA na categoria do
// gasto original, então todas as somas de despesa (categoria, relatórios,
// orçamento semanal do dia da devolução e saldo) abatem o valor sem regra extra.
export const isExpenseRefund=(entry:Pick<Lancamento,'estorno'>)=>entry.estorno===true;
export const refundAmount=(entry:Pick<Lancamento,'valorCentavos'>)=>Math.abs(entry.valorCentavos);
export function validateExpenseRefund(entry:Lancamento){
 if(entry.estorno===undefined)return;
 if(entry.estorno!==true)throw Error('Marcação de devolução inválida.');
 if(entry.tipo!=='despesa'||!Number.isSafeInteger(entry.valorCentavos)||entry.valorCentavos>=0)throw Error('Devolução de gasto precisa ser uma despesa com valor negativo.');
 if(entry.status!=='confirmado')throw Error('Devolução de gasto precisa estar confirmada.');
 if(entry.cartaoId||entry.faturaMes||entry.parcela||entry.parcial||entry.gestao||entry.recorrenciaId!==undefined||entry.grupoRecorrencia||entry.dataPrevista)throw Error('Devolução de gasto não pode ter cartão, parcela, recorrência ou pagamento parcial.');
}
