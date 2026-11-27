import test from 'node:test';
import assert from 'node:assert/strict';
import {incomeForMonth} from './income-base.ts';
import type {Lancamento} from './db.ts';
const entry=(data:string,extra:Partial<Lancamento>={}):Lancamento=>({descricao:'x',valorCentavos:100,data,tipo:'receita',categoria:'Salário',natureza:'variavel',status:'confirmado',...extra} as Lancamento);
test('income counts in its reference month, not in the payment month',()=>{
 const vale=entry('2026-11-27',{competencia:'2026-12'}),salario=entry('2026-11-06'),gasto=entry('2026-12-02',{tipo:'despesa'});
 assert.deepEqual(incomeForMonth([vale,salario,gasto],'2026-11'),[salario]);
 assert.deepEqual(incomeForMonth([vale,salario,gasto],'2026-12'),[vale]);
});
