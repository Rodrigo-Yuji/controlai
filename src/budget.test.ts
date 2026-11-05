import test from 'node:test';
import assert from 'node:assert/strict';
import {isMonthlyCommitment,monthlyFixedBudget} from './budget.ts';
import type {Lancamento} from './db.ts';
const entry=(patch:Partial<Lancamento>):Lancamento=>({contaId:'A',descricao:'Exemplo',tipo:'despesa',natureza:'variavel',categoria:'Outros',status:'previsto',valorCentavos:10000,data:'2026-11-05',...patch});
test('counts paid and planned recurrences and installments regardless of category nature',()=>{
 const entries=[entry({recorrenciaId:1,valorCentavos:10000}),entry({recorrenciaId:2,status:'confirmado',valorCentavos:20000}),entry({parcela:{grupo:'x',numero:1,total:2},valorCentavos:30000}),entry({grupoRecorrencia:'y',status:'confirmado',valorCentavos:6000}),entry({natureza:'fixo',valorCentavos:50000}),entry({tipo:'receita',recorrenciaId:3,valorCentavos:90000})];
 assert.deepEqual(monthlyFixedBudget(entries,100000),{totalCentavos:66000,percentage:66});
});
test('an entry with multiple recurrence markers is counted once',()=>{
 assert.equal(monthlyFixedBudget([entry({recorrenciaId:1,grupoRecorrencia:'x',parcela:{grupo:'x',numero:1,total:2}})],100000).totalCentavos,10000);
});
test('keeps exact cents, rounds only the percentage and does not cap overspending',()=>{
 assert.deepEqual(monthlyFixedBudget([entry({recorrenciaId:1,valorCentavos:10001})],30000),{totalCentavos:10001,percentage:33.34});
 assert.equal(monthlyFixedBudget([entry({recorrenciaId:1})],5000).percentage,200);
});
test('handles missing income without Infinity or an invented percentage',()=>{
 assert.deepEqual(monthlyFixedBudget([entry({recorrenciaId:1})],0),{totalCentavos:10000,percentage:null});
 assert.deepEqual(monthlyFixedBudget([],100000),{totalCentavos:0,percentage:0});
 assert.equal(isMonthlyCommitment(entry({natureza:'fixo'})),false);
});
