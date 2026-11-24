import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPlanLayout, inferSheetMonth, matchCard, monthlyPlanDrafts, monthlyPlanWorkbook, parseInstallment } from './monthly-plan.ts';
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
  assert.equal(result.drafts.length,4);assert.equal(result.drafts.filter(d=>d.selecionada).length,2);assert.equal(result.skipped.length,4);assert.equal(JSON.stringify(rows),original);
  const planned=result.drafts.find(d=>d.descricao==='Sem valor')!;assert.equal(planned.valor,'999,00');assert.equal(planned.status,'previsto');assert.equal(planned.selecionada,false);
  const side=result.drafts.find(d=>d.descricao==='Férias')!;assert.equal(side.tipo,'receita');assert.equal(side.selecionada,false);
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
  assert.equal(result.drafts.length,2);assert.equal(result.drafts[0].descricao,'Sem descrição');assert.equal(draftError(result.drafts[0],categories,[]),'');assert.ok(draftError(result.drafts[1],categories,[]));
  assert.ok(result.skipped.some(s=>/subtotal/.test(s.motivo)));
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
test('installment notes become installments, also when the amount is only in the note',()=>{
  assert.deepEqual(parseInstallment('Parcela 13 de 96 - 58,6'),{numero:13,total:96,valor:5860});
  assert.deepEqual(parseInstallment('Parcela 4 de 12'),{numero:4,total:12,valor:null});
  assert.equal(parseInstallment('Mensal'),null);assert.equal(parseInstallment('Parcela 7 de 3'),null);
  const result=parse([header,['Empréstimo',null,'Parcela 13 de 96 - 58,6','-'],['Perfume',-116.9,'Parcela 6 de 10','OK'],['Lanche Semanal',null,'50/Semana'],['Reserva',null,'Total: 50']]);
  assert.equal(result.drafts.length,2);
  assert.equal(result.drafts[0].valor,'58,60');assert.deepEqual(result.drafts[0].parcela,{grupo:'plano:emprestimo:96',numero:13,total:96});
  const entry=toEntry(result.drafts[1],'A',categories);assert.deepEqual(entry.parcela,{grupo:'plano:perfume:10',numero:6,total:10});assert.equal(entry.status,'confirmado');
  assert.ok(result.skipped.some(s=>/50\/Semana/.test(s.motivo)));assert.ok(result.skipped.some(s=>/Reservas/.test(s.motivo)));
});
test('card sections are linked to the account cards and to the month invoice',()=>{
  const cards=[{id:'c1',nome:'Itaú',fechamento:1,vencimento:10},{id:'c2',nome:'Cartão Santander',fechamento:5,vencimento:12},{id:'c3',nome:'BTG',fechamento:1,vencimento:8,arquivado:true}];
  assert.equal(matchCard('Cartão Itaú',cards)?.id,'c1');assert.equal(matchCard('cartao santander',cards)?.id,'c2');assert.equal(matchCard('Cartão BTG',cards),undefined);assert.equal(matchCard('Cartão DM - Wania',cards),undefined);
  const result=monthlyPlanDrafts([header,['Cartão Itaú'],['Pizza',-182.3,null,'OK'],['Total Cartão Itaú',null,-182.3],['Cartão DM - Wania'],['Chuteira',-133.77,'Parcela 2 de 3','OK']],'Jul - 2026','2026-07',10,categories,cards);
  assert.equal(result.drafts.length,2);
  assert.equal(result.drafts[0].cartaoId,'c1');assert.equal(result.drafts[0].faturaMes,'2026-07');assert.equal(result.drafts[0].secao,'Cartão Itaú');
  assert.equal(result.drafts[1].cartaoId,undefined);assert.equal(result.drafts[1].secao,'Cartão DM - Wania');
  const entry=toEntry(result.drafts[0],'A',categories);assert.equal(entry.cartaoId,'c1');assert.equal(entry.faturaMes,'2026-07');
});
test('a whole workbook is read tab by tab with the month of each tab',()=>{
  const sheets=[{name:'Jun - 2026',rows:[header,['Compra',-10,null,'OK']]},{name:'Resumo',rows:[['x']]},{name:'Jul - 2026',rows:[header,['Compra',-10],['',null,null,'Salário',1000]]}];
  const result=monthlyPlanWorkbook(sheets,5,categories);
  assert.deepEqual(result.months,['2026-06','2026-07']);assert.deepEqual(result.ignoredSheets,['Resumo']);
  assert.deepEqual(result.drafts.map(d=>d.data),['2026-06-05','2026-07-05','2026-07-05']);
  assert.notEqual(result.drafts[0].origemImportacao,result.drafts[1].origemImportacao);
  assert.throws(()=>monthlyPlanWorkbook([{name:'Resumo',rows:[['x']]}],5,categories),/Nenhuma aba/);
});
