import test from 'node:test';
import assert from 'node:assert/strict';
import {fifthBusinessDay,payCycleWeeks,percentageText} from './pay-cycle.ts';
import type {Lancamento} from './db.ts';
const entry=(data:string,patch:Partial<Lancamento>={}):Lancamento=>({contaId:'A',descricao:'Compra',valorCentavos:1000,tipo:'despesa',natureza:'variavel',categoria:'Outros',status:'confirmado',data,...patch});
test('salary convention counts Saturdays and excludes Sundays and fixed national holidays',()=>{
 assert.equal(fifthBusinessDay('2026-11'),'2026-11-07'); // Sunday 1, holiday 2, Saturday 7 is fifth.
 assert.equal(fifthBusinessDay('2027-01'),'2027-01-07');
 assert.equal(fifthBusinessDay('2026-12'),'2026-12-05');
 assert.throws(()=>fifthBusinessDay('2026-13'),/inválido/);
});
test('cycle ends the day before next payday and includes spending from next calendar month',()=>{
 const cycle=payCycleWeeks('2026-11',[entry('2026-11-06'),entry('2026-11-07'),entry('2026-12-04'),entry('2026-12-05'),entry('2026-11-08',{status:'previsto'}),entry('2026-11-09',{recorrenciaId:1}),entry('2026-11-10',{parcela:{grupo:'x',numero:1,total:2}}),entry('2026-11-11',{tipo:'receita'})],10001);
 assert.equal(cycle.inicio,'2026-11-07'); assert.equal(cycle.fim,'2026-12-04');
 assert.equal(cycle.semanas.length,4);assert.equal(cycle.semanas.reduce((sum,s)=>sum+s.gasto,0),2000);
 assert.equal(cycle.semanas.reduce((sum,s)=>sum+s.limite,0),10001);
 assert.deepEqual(cycle.semanas.map(s=>s.limite),[2501,2500,2500,2500]);
});
test('cycles have contiguous nonoverlapping weeks and conserve every cent across years',()=>{
 for(let year=2024;year<=2034;year++)for(let month=1;month<=12;month++){
 const cycle=payCycleWeeks(`${year}-${String(month).padStart(2,'0')}`,[],10003);
 let expected=cycle.inicio;
 for(const week of cycle.semanas){assert.equal(week.inicio,expected);assert.ok(week.fim>=week.inicio);assert.ok((Date.parse(week.fim)-Date.parse(week.inicio))/86400000<=6);expected=new Date(Date.parse(week.fim)+86400000).toISOString().slice(0,10);}
 assert.equal(cycle.semanas.at(-1)?.fim,cycle.fim);assert.equal(cycle.semanas.reduce((s,w)=>s+w.limite,0),10003);
 }
});
test('formats remaining percentages in Portuguese without floating point noise',()=>{
 assert.equal(percentageText(99.46),'99,46');assert.equal(percentageText(Math.round((100-99.46)*100)/100),'0,54');assert.equal(percentageText(100),'100');
});

test('daily reference counts actual days including short final weeks and preserves a cent-safe limit',async()=>{
 const {weeklyDailyReference}=await import('./pay-cycle.ts');assert.deepEqual(weeklyDailyReference({inicio:'2026-11-07',fim:'2026-11-13',limite:10000}),{dias:7,centavos:1428});assert.deepEqual(weeklyDailyReference({inicio:'2026-11-28',fim:'2026-11-30',limite:10000}),{dias:3,centavos:3333});assert.deepEqual(weeklyDailyReference({inicio:'2026-12-31',fim:'2027-01-01',limite:100}),{dias:2,centavos:50});
});
