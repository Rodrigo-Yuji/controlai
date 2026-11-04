import test from 'node:test';
import assert from 'node:assert/strict';
import type { Categoria } from './db.ts';
import { commandDraft, dateCell, detectColumns, draftError, fingerprint, money, moneyInput, parseCsv, spreadsheetDrafts, toEntry, validDate } from './assistant.ts';

const categories: Categoria[] = [
  {id:1, contaId:'A', nome:'Alimentação', tipo:'despesa', natureza:'variavel'},
  {id:2, contaId:'A', nome:'Moradia', tipo:'despesa', natureza:'fixo'},
  {id:3, contaId:'A', nome:'Outros', tipo:'despesa', natureza:'variavel'},
  {id:4, contaId:'A', nome:'Salário', tipo:'receita', natureza:'fixo'},
  {id:5, contaId:'A', nome:'Outras receitas', tipo:'receita', natureza:'variavel'},
];

test('decimal currency parsing preserves cents and rejects unsafe or invalid values', () => {
  for (const [input, expected] of [['R$ 1.234,56',123456], ['-40,01',-4001], ['(40,01)',-4001], ['1,234.56',123456], ['0.29',29], ['1.234',123400], [19.99,1999]] as const) assert.equal(money(input), expected);
  for (const input of ['1,005', 'abc', '12.34,56', '1,2,3', '9007199254740992', Infinity, 1.005]) assert.equal(money(input), null);
  assert.equal(moneyInput(10001), '100,01');
  assert.equal(money(moneyInput(9007199254740991)), 9007199254740991);
});
test('dates reject rollover and use the Excel cell calendar date', () => {
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(dateCell('04/11/2026'), '2026-11-04');
  assert.equal(dateCell(new Date('2026-11-04T00:00:00Z')), '2026-11-04');
});
test('CSV supports BR decimals, escaped quotes, delimiters, multiline and BOM', () => {
  assert.deepEqual(parseCsv('\uFEFFDescrição;Valor;Observação\r\n"Almoço; equipe";-40,50;"Nota ""A""\nsegunda linha"\r\n'), [
    ['Descrição','Valor','Observação'], ['Almoço; equipe','-40,50','Nota "A"\nsegunda linha'],
  ]);
  assert.deepEqual(parseCsv('Descrição,Valor\nAlmoço,"40,50"'), [['Descrição','Valor'],['Almoço','40,50']]);
  assert.deepEqual(parseCsv('Descrição\tValor\nAlmoço\t40'), [['Descrição','Valor'],['Almoço','40']]);
  assert.deepEqual(parseCsv('\n\nDescrição,Valor\nAlmoço,40'), [['Descrição','Valor'],['Almoço','40']]);
  assert.throws(() => parseCsv('Descrição;Valor\n"não terminou;40'), /aspas/);
  assert.throws(() => parseCsv('Descrição;Valor\n' + 'x;1\n'.repeat(501)), /500/);
});
test('column mapping handles accents, signs, date, category and notes', () => {
  const rows = parseCsv('Descrição;Valor (R$);Data;Observação\nAlmoço;-40,50;04/11/2026;Com colegas\nSalário;2500;05/11/2026;');
  const drafts = spreadsheetDrafts(rows, detectColumns(rows[0]), categories, '2026-01-01');
  assert.equal(drafts[0].tipo, 'despesa');
  assert.equal(drafts[0].categoria, 'Alimentação');
  assert.equal(drafts[0].observacao, 'Com colegas');
  assert.equal(drafts[1].tipo, 'receita');
  assert.equal(drafts[1].categoria, 'Salário');
  assert.deepEqual(toEntry(drafts[0], 'A', categories), {contaId:'A',descricao:'Almoço',valorCentavos:4050,data:'2026-11-04',tipo:'despesa',categoria:'Alimentação',natureza:'variavel',status:'confirmado',observacao:'Com colegas'});
});
test('unknown data stays invalid until reviewed, and closed dates block drafts', () => {
  const rows = parseCsv('Descrição;Valor;Tipo;Categoria;Data;Status\nX;10;despesa;Não existe;31/02/2026;estranho');
  const draft = spreadsheetDrafts(rows, detectColumns(rows[0]), categories, '2026-11-04')[0];
  assert.match(draftError(draft, categories, []), /data/);
  draft.data = '2026-11-04';
  assert.match(draftError(draft, categories, ['2026-11']), /Mês fechado/);
  assert.match(draftError(draft, categories, []), /status/);
  draft.status = 'confirmado';
  assert.match(draftError(draft, categories, []), /categoria/);
});
test('missing optional columns default visibly and mandatory columns are required', () => {
  const rows = parseCsv('Descrição;Valor\nÁgua;-10');
  const draft = spreadsheetDrafts(rows, detectColumns(rows[0]), categories, '2026-11-04')[0];
  assert.equal(draft.data, '2026-11-04'); assert.equal(draft.status, 'confirmado'); assert.equal(draft.observacao, '');
  assert.throws(() => spreadsheetDrafts(rows, {...detectColumns(rows[0]),valor:-1}, categories, '2026-11-04'), /colunas/);
});
test('invalid numeric Excel precision cannot be reinterpreted as BR thousands', () => {
  const rows = [['Descrição','Valor'],['Almoço',1.005]];
  const draft = spreadsheetDrafts(rows, detectColumns(rows[0]), categories, '2026-11-04')[0];
  assert.equal(draft.valor, '');
  assert.equal(draft.valorOriginal, '1.005');
  assert.match(draftError(draft, categories, []), /valor/);
});
test('simple Portuguese commands infer amount, account category and date without storing', () => {
  const lunch = commandDraft('comprei almoço por 40 reais', categories, '2026-11-04');
  assert.equal(lunch.descricao, 'Almoço'); assert.equal(lunch.valor,'40,00'); assert.equal(lunch.categoria,'Alimentação'); assert.equal(lunch.data,'2026-11-04');
  const income = commandDraft('recebi salário de 2500 reais ontem', categories, '2026-03-01');
  assert.equal(income.tipo,'receita'); assert.equal(income.data,'2026-02-28'); assert.equal(income.categoria,'Salário');
  assert.equal(commandDraft('paguei internet R$ 99,90 em 04/11/2026', categories, '2026-01-01').valor,'99,90');
});
test('spoken numbers and cents work, including three in Portuguese', () => {
  assert.equal(commandDraft('comprei almoço por quarenta reais e cinquenta centavos', categories, '2026-11-04').valor,'40,50');
  assert.equal(commandDraft('comprei café por três reais', categories, '2026-11-04').valor,'3,00');
  assert.equal(commandDraft('paguei almoço 40 reais e 50 centavos', categories, '2026-11-04').valor,'40,50');
});
test('ambiguous commands and invalid dates require correction', () => {
  for (const text of ['comprei almoço', 'comprei almoço 40 e café 5', 'comprei almoço por quarenta reais e café por cinco reais', 'comprei almoço por 40 reais e café por cinco reais', 'comprei almoço por 40 reais e cinquenta centavos', 'recebi e paguei almoço 40 reais', 'comprei almoço 40 reais em 31/02/2026', 'comprei almoço 40 reais hoje ontem']) assert.throws(() => commandDraft(text, categories, '2026-11-04'));
});
test('duplicate fingerprints normalize accents/case and include amounts and account-local fields', () => {
  const draft = commandDraft('comprei almoço 40 reais', categories, '2026-11-04');
  const entry = toEntry(draft, 'A', categories);
  assert.equal(fingerprint(entry), fingerprint({...entry,descricao:' almoco '}));
  assert.notEqual(fingerprint(entry), fingerprint({...entry,valorCentavos:4001}));
});
