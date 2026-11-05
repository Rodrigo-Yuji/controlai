import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPlanLayout, inferSheetMonth, monthlyPlanDrafts } from './monthly-plan.ts';
import { draftError, fingerprint, spreadsheetMoney, toEntry, type Cell } from './assistant.ts';
import type { Categoria } from './db.ts';
const categories: Categoria[] = [{id:1,contaId:'A',nome:'Outros',tipo:'despesa',natureza:'variavel'},{id:2,contaId:'A',nome:'Outras receitas',tipo:'receita',natureza:'variavel'}];
const header: Cell[] = ['Depesa Mensal',null,null,'Receitas'];
const parse = (rows:Cell[][],month='2026-11',day=1) => monthlyPlanDrafts(rows,'Nov - 2026',month,day,categories);
test('detects monthly blocks below debt summaries and infers Portuguese months',()=>{
  assert.deepEqual(detectPlanLayout([['Dívidas'],[],header]),{header:2,expenses:0,income:3});
  for(const [sheet,month] of [['Jun - 2026','2026-06'],['Março / 2027','2027-03'],['12/2026','2026-12'],['2027-01','2027-01']]) assert.equal(inferSheetMonth(sheet),month);
  assert.equal(inferSheetMonth('Resumo'),''); assert.equal(inferSheetMonth('13/2026'),'');
  assert.throws(()=>parse([header],'',1),/mês/);
});
test('excludes debt balances, totals, savings and auxiliary calculations',()=>{
  const rows:Cell[][]=[['Dívida',100],header,['Compra',-40,null,'Salário',1000],['Total',-40],['Reserva',-20],['Sem valor',null,999],['',null,null,'Sobra',960],['',null,null,null,null,null,'Férias',500]];
  const original=JSON.stringify(rows); const result=parse(rows);
  assert.equal(result.drafts.length,2);assert.equal(result.skipped.length,6);assert.equal(JSON.stringify(rows),original);
});
test('preserves installment notes, paid markers and defaults unmarked income to planned',()=>{
  const result=parse([header,['Cartão teste'],['Compra',-99.89999999999999,'Parcela 3 de 6','Salário',1000,777],['Outro',-10,'OK'],['Mais',-20,null,'OK'],['Crédito',15]]);
  assert.equal(result.drafts.length,5);
  assert.equal(result.drafts[0].valor,'99,90');assert.match(result.drafts[0].observacao,/Parcela 3 de 6/);
  assert.match(result.drafts[0].observacao,/Cartão teste/);
  assert.equal(result.drafts[1].status,'previsto');assert.equal(result.drafts[2].status,'confirmado');assert.equal(result.drafts[3].status,'confirmado');assert.equal(result.drafts[4].tipo,'receita');
});
test('uses expense block semantics for positive templates and clips reference day',()=>{
  const result=parse([header,['Compra',40]],'2027-02',31);
  assert.equal(result.day,28);assert.equal(result.drafts[0].data,'2027-02-28');assert.equal(result.drafts[0].tipo,'despesa');
  assert.throws(()=>parse([header],undefined,0),/dia/);
});
test('missing descriptions and invalid money require correction',()=>{
  const result=parse([header,[null,-10,null,null,20],['Invalid',1.005]]);
  assert.equal(result.drafts.length,3);for(const draft of result.drafts) assert.ok(draftError(draft,categories,[]));
  assert.equal(spreadsheetMoney(99.89999999999999),9990);assert.equal(spreadsheetMoney(1.005),null);
});
test('source cells preserve separate identical purchases while reimports remain detectable',()=>{
  const result=parse([header,['Compra',-10],['Compra',-10]]);
  const entries=result.drafts.map(d=>toEntry(d,'A',categories));
  assert.notEqual(fingerprint(entries[0]),fingerprint(entries[1]));
  assert.equal(fingerprint(entries[0]),fingerprint(toEntry(parse([header,['Compra',-10]]).drafts[0],'A',categories)));
  assert.equal(entries[0].origemImportacao,'plano:nov - 2026:B2');
});
test('respects batch size and closed months',()=>{
  assert.throws(()=>parse([header,...Array.from({length:501},()=>['Compra',-10])]),/500/);
  assert.match(draftError(parse([header,['Compra',-10]]).drafts[0],categories,['2026-11']) ?? '',/fechado/);
});
