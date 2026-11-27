import type {Lancamento} from './db.ts';
import {referenceMonth} from './reporting.ts';

// Receitas que formam a base "Atual" da divisão da renda: valem pelo mês de referência,
// não pela data do recebimento (ex.: vale-alimentação recebido no dia 27 para o mês seguinte).
// `candidates`: lançamentos e previsões do mês, do mês anterior e do seguinte.
export function incomeForMonth(candidates:readonly Lancamento[],month:string){
 return candidates.filter(e=>e.tipo==='receita'&&referenceMonth(e)===month);
}
