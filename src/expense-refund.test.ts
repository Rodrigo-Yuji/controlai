import test from 'node:test';
import assert from 'node:assert/strict';
import {payCycleWeeks} from './pay-cycle.ts';
import {financialReports} from './reporting.ts';
import {registeredBalance} from './account-balance.ts';
import {validateSnapshot} from './sync/snapshot.ts';
import {isExpenseRefund,refundAmount,validateExpenseRefund} from './expense-refund.ts';
import type {Conta,Lancamento} from './db.ts';
const account:Conta={id:'A',nome:'Solo',padrao:true,conjunta:false,tipo:'solo'};
const entry=(descricao:string,valorCentavos:number,data:string,extra:Partial<Lancamento>={}):Lancamento=>({contaId:'A',descricao,valorCentavos,tipo:'despesa',natureza:'variavel',categoria:'Alimentação',data,status:'confirmado',...extra});
const income:Lancamento={contaId:'A',descricao:'Salário',valorCentavos:500000,tipo:'receita',natureza:'fixo',categoria:'Salário',data:'2026-11-06',status:'confirmado'};
const lunches=[entry('Pix almoço',3000,'2026-11-10'),entry('Pix almoço',3000,'2026-11-11')];
const refund=entry('Troco dos almoços',-1500,'2026-11-12',{estorno:true});

test('a refund gives the money back to the week of the refund',()=>{
 const before=payCycleWeeks('2026-11',lunches,100000,'2026-11-12').semanas.find(w=>w.inicio==='2026-11-09')!;
 const after=payCycleWeeks('2026-11',[...lunches,refund],100000,'2026-11-12').semanas.find(w=>w.inicio==='2026-11-09')!;
 assert.equal(before.gasto,6000);assert.equal(after.gasto,4500);assert.equal(after.limite-after.gasto,before.limite-before.gasto+1500);
});
test('a refund lowers the category and monthly expenses and raises the balance',()=>{
 const r=financialReports([income,...lunches,refund],account,'2026-11');
 assert.equal(r.expense,4500);assert.deepEqual(r.categories,[{name:'Alimentação',value:45}]);
 const only=financialReports([income,refund],account,'2026-11');assert.deepEqual(only.categories,[]);
 const b=registeredBalance([income,...lunches],[],[],'2026-11'),c=registeredBalance([income,...lunches,refund],[],[],'2026-11');
 assert.equal(c.current,b.current+1500);assert.equal(c.total,b.total+1500);
});
test('refund helpers and validation',()=>{
 assert.equal(isExpenseRefund(refund),true);assert.equal(isExpenseRefund(lunches[0]),false);assert.equal(refundAmount(refund),1500);
 assert.doesNotThrow(()=>validateExpenseRefund(refund));assert.doesNotThrow(()=>validateExpenseRefund(lunches[0]));
 assert.throws(()=>validateExpenseRefund({...refund,valorCentavos:1500}),/negativo/);
 assert.throws(()=>validateExpenseRefund({...refund,tipo:'receita'}),/negativo/);
 assert.throws(()=>validateExpenseRefund({...refund,status:'previsto'}),/confirmada/);
 assert.throws(()=>validateExpenseRefund({...refund,cartaoId:'c1'}),/cartão/);
 assert.throws(()=>validateExpenseRefund({...refund,estorno:'sim' as unknown as true}),/inválida/);
});
test('synchronized copies accept refunds and reject malformed ones',()=>{
 const base={contas:[account],fechamentos:[],reservas:[],configuracoes:[],categorias:[],recorrencias:[],salarios:[]};
 assert.doesNotThrow(()=>validateSnapshot({...base,lancamentos:[{...refund,id:1}]}));
 assert.throws(()=>validateSnapshot({...base,lancamentos:[{...refund,id:1,valorCentavos:1500}]}),/Devolução/);
});
