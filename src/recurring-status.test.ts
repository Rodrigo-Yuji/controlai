import test from 'node:test';
import assert from 'node:assert/strict';
import {recurringMonth,recurringSummary,toggleSkip} from './recurring-status.ts';
import {projectRecurrences} from './finance.ts';
import type {Lancamento,Recorrencia} from './db.ts';
const base:Recorrencia={id:1,contaId:'A',descricao:'Internet',valorCentavos:10000,tipo:'despesa',natureza:'fixo',categoria:'Casa',inicio:'2026-09-10',dia:10,ativa:true};
const entry=(extra:Partial<Lancamento>):Lancamento=>({contaId:'A',descricao:'Internet',valorCentavos:10000,tipo:'despesa',natureza:'fixo',categoria:'Casa',data:'2026-11-10',status:'confirmado',recorrenciaId:1,...extra});
test('a recurrence is pending, late or paid in the month',()=>{
 assert.equal(recurringMonth(base,'2026-11',[],'2026-11-05')!.state,'pendente');
 assert.equal(recurringMonth(base,'2026-11',[],'2026-11-11')!.state,'atrasado');
 const paid=recurringMonth(base,'2026-11',[entry({})],'2026-11-20')!;assert.equal(paid.state,'pago');assert.equal(paid.paid,10000);
 assert.equal(recurringMonth(base,'2026-11',[entry({status:'previsto'})],'2026-11-05')!.state,'pendente');
 assert.equal(recurringMonth(base,'2026-08',[],'2026-08-01'),null);assert.equal(recurringMonth({...base,ativa:false},'2026-11',[],'2026-11-01'),null);
});
test('partial payments and the previous-month reference',()=>{
 const partial=recurringMonth(base,'2026-11',[entry({valorCentavos:4000}),entry({valorCentavos:6000,status:'previsto'})],'2026-11-05')!;
 assert.equal(partial.state,'parcial');assert.equal(partial.paid,4000);assert.equal(partial.value,10000);
 const water={...base,id:2,descricao:'Água',referenciaAnterior:true,dia:6};
 const nov=recurringMonth(water,'2026-11',[],'2026-11-25')!;assert.equal(nov.dueMonth,'2026-12');assert.equal(nov.due,'2026-12-06');assert.equal(nov.state,'pendente');
 assert.equal(recurringMonth(water,'2026-11',[entry({recorrenciaId:2,data:'2026-12-03',competencia:'2026-11'})],'2026-12-04')!.state,'pago');
});
test('a skipped month is not projected and can be undone',()=>{
 const haircut={...base,id:3,descricao:'Corte de cabelo',...toggleSkip(base,'2026-11',true)};
 assert.deepEqual(haircut.pulados,['2026-11']);
 assert.equal(projectRecurrences('2026-11','A',[haircut],[]).length,0);assert.equal(projectRecurrences('2026-12','A',[haircut],[]).length,1);
 const row=recurringMonth(haircut,'2026-11',[],'2026-11-20')!;assert.equal(row.state,'pulado');
 assert.deepEqual(toggleSkip(haircut,'2026-11',false).pulados,[]);
 const s=recurringSummary([row,recurringMonth(base,'2026-11',[entry({})],'2026-11-20')!,recurringMonth({...base,id:4},'2026-11',[],'2026-11-20')!]);
 assert.deepEqual(s,{total:3,pagos:1,pendentes:0,atrasados:1,pulados:1,faltaCentavos:10000});
});
