import test from 'node:test';
import assert from 'node:assert/strict';
import {fifthBusinessDay,salaryPayday,payCycleWeeks,percentageText} from './pay-cycle.ts';
import type {Lancamento} from './db.ts';
const entry=(data:string,patch:Partial<Lancamento>={}):Lancamento=>({contaId:'A',descricao:'Compra',valorCentavos:1000,tipo:'despesa',natureza:'variavel',categoria:'Outros',status:'confirmado',data,...patch});
test('salary convention counts Saturdays and excludes Sundays and fixed national holidays',()=>{
 assert.equal(fifthBusinessDay('2026-11'),'2026-11-07'); // Sunday 1, holiday 2, Saturday 7 is fifth.
 assert.equal(fifthBusinessDay('2027-01'),'2027-01-07');
 assert.equal(fifthBusinessDay('2026-12'),'2026-12-05');
 assert.throws(()=>fifthBusinessDay('2026-13'),/inválido/);
});
test('cycle ends the day before next payday and includes spending from next calendar month',()=>{
 const cycle=payCycleWeeks('2026-11',[entry('2026-11-06'),entry('2026-11-07'),entry('2026-12-04'),entry('2026-12-05'),entry('2026-11-08',{status:'previsto'}),entry('2026-11-09',{recorrenciaId:1}),entry('2026-11-10',{parcela:{grupo:'x',numero:1,total:2}}),entry('2026-11-11',{tipo:'receita'})],10001,'2026-11-08');
 assert.deepEqual(cycle.semanas.map(s=>[s.inicio,s.fim]),[['2026-11-06','2026-11-08'],['2026-11-09','2026-11-15'],['2026-11-16','2026-11-22'],['2026-11-23','2026-11-29'],['2026-11-30','2026-12-03']]);
 assert.equal(cycle.inicio,'2026-11-06'); assert.equal(cycle.fim,'2026-12-03');
 assert.equal(cycle.semanas.length,5);assert.equal(cycle.semanas.reduce((sum,s)=>sum+s.gasto,0),2000);
 assert.equal(cycle.semanas.reduce((sum,s)=>sum+s.limite+s.excessoAnterior,0),10001);
 assert.deepEqual(cycle.semanas.map(s=>s.limite),[1071,1571,2501,2500,1429]);
});
test('cycles have contiguous nonoverlapping weeks and conserve every cent across years',()=>{
 for(let year=2024;year<=2034;year++)for(let month=1;month<=12;month++){
 const cycle=payCycleWeeks(`${year}-${String(month).padStart(2,'0')}`,[],10003,`${year}-${String(month).padStart(2,'0')}-01`);
 let expected=cycle.inicio;
 for(const week of cycle.semanas){if(week.inicio!==cycle.inicio)assert.equal(new Date(`${week.inicio}T00:00:00Z`).getUTCDay(),1);if(week.fim!==cycle.fim)assert.equal(new Date(`${week.fim}T00:00:00Z`).getUTCDay(),0);assert.equal(week.inicio,expected);assert.ok(week.fim>=week.inicio);assert.ok((Date.parse(week.fim)-Date.parse(week.inicio))/86400000<=6);expected=new Date(Date.parse(week.fim)+86400000).toISOString().slice(0,10);}
 assert.equal(cycle.semanas.at(-1)?.fim,cycle.fim);assert.equal(cycle.semanas.reduce((s,w)=>s+w.limite,0),10003);
 }
});
test('formats remaining percentages in Portuguese without floating point noise',()=>{
 assert.equal(percentageText(99.46),'99,46');assert.equal(percentageText(Math.round((100-99.46)*100)/100),'0,54');assert.equal(percentageText(100),'100');
});

test('overspending reduces subsequent allowances until absorbed without double subtraction',()=>{
 const cycle=payCycleWeeks('2026-11',[entry('2026-11-06',{valorCentavos:12000}),entry('2026-11-09',{valorCentavos:1000})],28000,'2026-11-09');
 assert.deepEqual(cycle.semanas.map(w=>w.excessoAnterior),[0,9000,3000,0,0]);
 assert.deepEqual(cycle.semanas.map(w=>w.limite),[3000,-2000,4000,7000,4000]);
 // A negative allowance remains visible and is not subtracted a second time.
 assert.equal(cycle.semanas[2].limite-cycle.semanas[2].gasto,4000);
 assert.equal(payCycleWeeks('2026-12',[entry('2026-11-06',{valorCentavos:12000})],28000).semanas[0].excessoAnterior,0);
});

test('exact limits, planned expenses and non-variable commitments do not create carryover',()=>{
 const cycle=payCycleWeeks('2026-11',[entry('2026-11-06',{valorCentavos:3000}),entry('2026-11-07',{valorCentavos:9000,status:'previsto'}),entry('2026-11-07',{valorCentavos:9000,recorrenciaId:1})],28000,'2026-11-09');
 assert.ok(cycle.semanas.every(w=>w.excessoAnterior===0));
 assert.equal(cycle.semanas.reduce((sum,w)=>sum+w.limite,0),28000);
});

test('daily reference counts actual days including short final weeks and preserves a cent-safe limit',async()=>{
 const {weeklyDailyReference}=await import('./pay-cycle.ts');assert.deepEqual(weeklyDailyReference({inicio:'2026-11-07',fim:'2026-11-13',limite:10000}),{dias:7,centavos:1428});assert.deepEqual(weeklyDailyReference({inicio:'2026-11-28',fim:'2026-11-30',limite:10000}),{dias:3,centavos:3333});assert.deepEqual(weeklyDailyReference({inicio:'2026-12-31',fim:'2027-01-01',limite:100}),{dias:2,centavos:50});
});

test('salary cycles use the Friday payment when the fifth business day is Saturday',()=>{
 assert.equal(salaryPayday('2026-11'),'2026-11-06');assert.equal(salaryPayday('2026-12'),'2026-12-04');assert.equal(salaryPayday('2027-01'),'2027-01-07');const november=payCycleWeeks('2026-11',[entry('2026-11-05'),entry('2026-11-06'),entry('2026-12-03'),entry('2026-12-04')],120224);assert.equal(november.semanas.reduce((sum,w)=>sum+w.gasto,0),2000);assert.equal(november.fim,'2026-12-03');const december=payCycleWeeks('2026-12',[],120224);assert.equal(december.inicio,'2026-12-04');assert.equal(december.fim,'2027-01-06');assert.equal(new Date(Date.parse(november.fim)+86400000).toISOString().slice(0,10),december.inicio);
});

test('closed-week savings increase only the following allowance and never advance current or future savings',()=>{
 const rows=[entry('2026-11-06',{valorCentavos:1000})];
 const sunday=payCycleWeeks('2026-11',rows,28000,'2026-11-08'),monday=payCycleWeeks('2026-11',rows,28000,'2026-11-09');
 assert.deepEqual(sunday.semanas.map(w=>w.limite),[3000,7000,7000,7000,4000]);
 assert.deepEqual(monday.semanas.map(w=>w.limite),[3000,9000,7000,7000,4000]);assert.equal(monday.semanas[1].saldoAnterior,2000);
 assert.equal(monday.semanas.reduce((s,w)=>s+w.limiteBase,0),28000);
});
test('spending first consumes carried savings and only the excess reduces the next week',()=>{
 const rows=[entry('2026-11-06',{valorCentavos:1000}),entry('2026-11-09',{valorCentavos:10000})];
 const cycle=payCycleWeeks('2026-11',rows,28000,'2026-11-16');assert.deepEqual(cycle.semanas.map(w=>w.saldoAnterior),[0,2000,-1000,0,0]);assert.deepEqual(cycle.semanas.map(w=>w.limite),[3000,9000,6000,7000,4000]);
 const saved=payCycleWeeks('2026-11',rows.map(e=>({...e,valorCentavos:1000})),28000,'2026-11-16');assert.equal(saved.semanas[2].saldoAnterior,8000);assert.equal(saved.semanas[2].limite,15000);
});
test('complete cycles conserve cents after all spending and reset at the next payday',()=>{
 for(const month of['2026-11','2026-12','2027-01']){const cycle=payCycleWeeks(month,[],10003,'2030-01-01');assert.equal(cycle.semanas.at(-1)!.limite,10003);assert.equal(cycle.semanas.reduce((s,w)=>s+w.limiteBase,0),10003);assert.equal(cycle.semanas[0].saldoAnterior,0);}
});
