import type { Cartao, Categoria, Tipo } from './db.ts';
import { MAX_ROWS, money, moneyInput, normalize, spreadsheetMoney, suggestCategory, validDate, type Cell, type Draft } from './assistant.ts';

export interface PlanLayout { header: number; expenses: number; income: number }
export interface PlanSkipped { linha: number; coluna: string; descricao: string; motivo: string; aba?: string }
export interface PlanResult { drafts: Draft[]; skipped: PlanSkipped[]; month: string; day: number; months?: string[]; ignoredSheets?: string[] }
// A whole workbook (one tab per month) may hold many more rows than one tab.
export const MAX_WORKBOOK_ROWS = 3000;
const label = (cell: Cell | undefined) => typeof cell === 'string' ? normalize(cell).replace(/\s+/g, ' ') : '';
const total = (text: string) => /^(total|subtotal|saldo|sobra|sobrou|restante|diferenca)(?:\b|:)/.test(text);
const paid = (cell: Cell | undefined) => /^(ok|pago|paga|recebido|recebida|confirmado|quitado|quitada)$/.test(label(cell));
const empty = (cell: Cell | undefined) => cell === undefined || cell === null || String(cell).trim() === '';
const cellText = (cell: Cell | undefined) => empty(cell) ? '' : String(cell).trim();
function columnName(index: number): string {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}
// "Parcela 13 de 96" or "Parcela 13 de 96 - 58,6" (the amount may only be in the note).
export function parseInstallment(cell: Cell | undefined): { numero: number; total: number; valor: number | null } | null {
  const match = label(cell).match(/^parc(?:ela)?\.?\s*(\d{1,3})\s*(?:de|\/)\s*(\d{1,3})(?:\s*[-–:]\s*(?:r\$\s*)?([\d.,]+))?/);
  if (!match) return null;
  const numero = Number(match[1]), totalParcelas = Number(match[2]);
  if (numero < 1 || totalParcelas < 2 || numero > totalParcelas) return null;
  return {numero, total:totalParcelas, valor:match[3] ? money(match[3]) : null};
}
// A note that is only a number, such as the planned amount for groceries.
const plannedAmount = (cell: Cell | undefined) => typeof cell === 'number' ? Math.round(Math.abs(cell) * 100) : /^(?:r\$\s*)?\d{1,7}(?:[.,]\d{1,2})?$/.test(cellText(cell)) ? money(cellText(cell)) : null;
// "Cartão DM - Wania" and "Cartão DM Wania" are the same card.
export const cardKey = (name: string) => normalize(name).replace(/^cartao(?:\s+de\s+credito)?\b/, '').replace(/[^a-z0-9]+/g, ' ').trim();
// Matches a spreadsheet section such as "Cartão Itaú" to a card of the account by name.
export function matchCard(section: string, cards: readonly Cartao[]): Cartao | undefined {
  const key = cardKey(section);
  if (!key) return undefined;
  const active = cards.filter(card => !card.arquivado);
  return active.find(card => cardKey(card.nome) === key) ?? active.find(card => { const other = cardKey(card.nome); return other.length > 1 && (key.startsWith(other + ' ') || other.startsWith(key + ' ')); });
}
export function detectPlanLayout(rows: Cell[][]): PlanLayout | undefined {
  for (let header = 0; header < Math.min(rows.length, 60); header++) {
    const row = rows[header];
    const expenses = row.findIndex(cell => /^(despesas?|depesas?)( mensais| mensal)?$/.test(label(cell)));
    const income = row.findIndex(cell => /^(receitas?|entradas?)$/.test(label(cell)));
    if (expenses >= 0 && income >= expenses + 2) return {header, expenses, income};
  }
  return undefined;
}
export function inferSheetMonth(name: string): string {
  const text = normalize(name).replace(/\./g, '');
  const iso = text.match(/^(\d{4})[-/](\d{2})$/);
  if (iso && validDate(`${iso[1]}-${iso[2]}-01`)) return `${iso[1]}-${iso[2]}`;
  const numeric = text.match(/^(\d{1,2})[-/](\d{4})$/);
  if (numeric) {
    const month = `${numeric[2]}-${numeric[1].padStart(2, '0')}`;
    return validDate(`${month}-01`) ? month : '';
  }
  const months = ['jan(?:eiro)?','fev(?:ereiro)?','mar(?:co)?','abr(?:il)?','mai(?:o)?','jun(?:ho)?','jul(?:ho)?','ago(?:sto)?','set(?:embro)?','out(?:ubro)?','nov(?:embro)?','dez(?:embro)?'];
  for (let index = 0; index < months.length; index++) {
    const match = text.match(new RegExp(`^${months[index]}\\s*[-/]?\\s*(\\d{4})$`));
    if (match) {
      const month = `${match[1]}-${String(index + 1).padStart(2, '0')}`;
      return validDate(`${month}-01`) ? month : '';
    }
  }
  return '';
}

export function monthlyPlanDrafts(rows: Cell[][], sheet: string, month: string, day: number, categories: Categoria[], cards: readonly Cartao[] = []): PlanResult {
  const layout = detectPlanLayout(rows);
  if (!layout) throw new Error('Não identifiquei os blocos de despesas e receitas. Use o formato de tabela ou confira a aba.');
  if (!validDate(`${month}-01`)) throw new Error('Informe o mês e o ano desta aba antes de revisar.');
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('Informe um dia de referência entre 1 e 31.');
  const [year, monthNumber] = month.split('-').map(Number);
  const chosenDay = Math.min(day, new Date(Date.UTC(year, monthNumber, 0)).getUTCDate());
  const data = `${month}-${String(chosenDay).padStart(2, '0')}`;
  const result: PlanResult = {drafts:[], skipped:[], month, day:chosenDay};
  const skip = (line: number, column: number, description: string, reason: string) => result.skipped.push({linha:line, coluna:columnName(column), descricao:description, motivo:reason});
  // With mixed signs (as in this monthly plan), a positive expense cell is a
  // credit/refund. All-positive expense templates still use block semantics.
  const expenseValues = rows.slice(layout.header + 1).filter(row => !total(label(row[layout.expenses])))
    .map(row => spreadsheetMoney(row[layout.expenses + 1] ?? null)).filter((value): value is number => value !== null && value !== 0);
  const signedExpenses = expenseValues.some(value => value < 0);
  let section = cellText(rows[layout.header][layout.expenses]);
  const add = (draft: Omit<Draft, 'data' | 'linha'>, line: number) => {
    result.drafts.push({...draft, data, linha:line});
    if (result.drafts.length > MAX_ROWS) throw new Error(`Importe até ${MAX_ROWS} lançamentos por aba.`);
  };
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (index <= layout.header) {
      if (index < layout.header && !empty(row[layout.expenses]) && !empty(row[layout.expenses + 1])) skip(index + 1, layout.expenses + 1, cellText(row[layout.expenses]), 'Saldo de dívida ou resumo anterior aos lançamentos mensais.');
      continue;
    }
    for (const block of ['expenses','income'] as const) {
      const column = layout[block];
      const description = cellText(row[column]);
      const normalized = label(row[column]);
      const value = row[column + 1];
      const notes = block === 'expenses' ? row[column + 2] : undefined;
      if (total(normalized)) {
        if (!empty(value) || (block === 'expenses' && !empty(row[column + 2]))) skip(index + 1, column + 1, description, 'Total, subtotal ou saldo: não é um lançamento adicional.');
        continue;
      }
      if (block === 'expenses' && /^cartao\b/.test(normalized) && empty(value) && empty(notes)) { section = description; continue; }
      const installment = block === 'expenses' ? parseInstallment(notes) : null;
      let cents = empty(value) ? null : spreadsheetMoney(value);
      let planned = false;
      if (empty(value)) {
        if (block === 'expenses' && /^(reserva|reserva financeira|poupanca|dividas?)$/.test(normalized)) {
          if (!empty(notes)) skip(index + 1, column + 3, description, 'Anotação de reserva ou dívidas: registre em Orçamento → Reservas.');
          continue;
        }
        if (installment?.valor) cents = -installment.valor;
        else if (block === 'expenses' && description && plannedAmount(notes)) { cents = -plannedAmount(notes)!; planned = true; }
        else {
          if (description && !paid(row[column]) && !/^[-–—]+$/.test(description)) skip(index + 1, column + 1, description, empty(notes) ? 'Sem valor na coluna principal.' : `Sem valor na coluna principal; a anotação “${cellText(notes)}” não é um valor único.`);
          continue;
        }
      } else if (block === 'expenses' && /^(reserva|reserva financeira|poupanca)$/.test(normalized)) {
        skip(index + 1, column + 1, description, 'Reserva/poupança: registre em Orçamento → Reservas para não contar como consumo.'); continue;
      }
      if (cents === 0) { skip(index + 1, column + 1, description, 'Valor zero.'); continue; }
      if (!description && block === 'income') { skip(index + 1, column + 1, '', 'Receita sem descrição (provável subtotal).'); continue; }
      const tipo: Tipo = block === 'income' ? (cents !== null && cents < 0 ? 'despesa' : 'receita')
        : signedExpenses && cents !== null && cents > 0 ? 'receita' : 'despesa';
      const cardSection = block === 'expenses' && /^cartao\b/.test(label(section)) ? section : '';
      const card = cardSection && tipo === 'despesa' ? matchCard(cardSection, cards) : undefined;
      const statusCells = block === 'expenses' ? [notes, row[column + 3]] : [row[column + 2]];
      const descricao = description && !paid(row[column]) && !/^[-–—]+$/.test(description) ? description : `Sem descrição${cardSection ? ` · ${cardSection}` : ''}`;
      const observacao = [
        !empty(notes) && !paid(notes) && !installment && !planned ? cellText(notes) : '',
        installment ? `Parcela ${installment.numero} de ${installment.total}.` : '',
        planned ? `Valor planejado anotado na planilha (${cellText(notes)}); importado como previsto e desmarcado.` : '',
        `Origem: ${sheet}, linha ${index + 1}, ${block === 'expenses' ? section : 'Receitas'}.`,
        `Dia ${chosenDay} usado como referência; a planilha informa apenas o mês.`,
      ].filter(Boolean).join('\n');
      add({descricao, valor:cents === null ? '' : moneyInput(Math.abs(cents)), valorOriginal:empty(value) ? cellText(notes) : cellText(value), tipo,
        categoria:suggestCategory(description, tipo, categories), status:!planned && statusCells.some(paid) ? 'confirmado' : 'previsto', observacao,
        origemImportacao:`plano:${normalize(sheet)}:${columnName(column + 1)}${index + 1}`, selecionada:!planned,
        ...(installment && tipo === 'despesa' ? {parcela:{grupo:`plano:${normalize(descricao).replace(/\s+/g, ' ')}:${installment.total}`, numero:installment.numero, total:installment.total}} : {}),
        ...(cardSection && tipo === 'despesa' ? {secao:cardSection, faturaMes:month, ...(card ? {cartaoId:card.id} : {})} : {})}, index + 1);
    }
    // Side calculations outside the two identified blocks (férias, bruto, adiantamentos...)
    // come in unchecked, so nothing is counted twice unless the person selects it.
    for (let column = layout.income + 3; column < row.length - 1; column++) {
      if (typeof row[column] === 'string' && !empty(row[column]) && !empty(row[column + 1]) && spreadsheetMoney(row[column + 1]) !== null) {
        const description = cellText(row[column]), cents = spreadsheetMoney(row[column + 1])!;
        if (cents === 0 || total(label(row[column]))) { skip(index + 1, column + 1, description, 'Cálculo auxiliar sem valor de lançamento.'); column++; continue; }
        const tipo: Tipo = cents < 0 ? 'despesa' : 'receita';
        add({descricao:description, valor:moneyInput(Math.abs(cents)), valorOriginal:cellText(row[column + 1]), tipo, categoria:suggestCategory(description, tipo, categories), status:'previsto',
          observacao:`Bloco auxiliar da planilha (coluna ${columnName(column)}): pode ser só um cálculo. Confira antes de marcar.\nOrigem: ${sheet}, linha ${index + 1}.`,
          origemImportacao:`plano:${normalize(sheet)}:${columnName(column + 1)}${index + 1}`, selecionada:false}, index + 1);
        column++;
      }
    }
  }
  return result;
}

// Reads every tab whose name is a month ("Jun - 2026", "12/2026"...) at once.
export function monthlyPlanWorkbook(sheets: {name: string; rows: Cell[][]}[], day: number, categories: Categoria[], cards: readonly Cartao[] = []): PlanResult {
  const result: PlanResult = {drafts:[], skipped:[], month:'', day, months:[], ignoredSheets:[]};
  for (const sheet of sheets) {
    const month = inferSheetMonth(sheet.name);
    if (!month || !detectPlanLayout(sheet.rows)) { result.ignoredSheets!.push(sheet.name); continue; }
    const part = monthlyPlanDrafts(sheet.rows, sheet.name, month, day, categories, cards);
    result.drafts.push(...part.drafts);
    result.skipped.push(...part.skipped.map(item => ({...item, aba:sheet.name})));
    result.months!.push(month);
    result.day = part.day;
    if (result.drafts.length > MAX_WORKBOOK_ROWS) throw new Error(`A planilha passa de ${MAX_WORKBOOK_ROWS} lançamentos. Importe aba por aba.`);
  }
  if (!result.months!.length) throw new Error('Nenhuma aba com nome de mês (ex.: “Jun - 2026”) e blocos de despesas e receitas.');
  result.month = `${result.months![0]} a ${result.months![result.months!.length - 1]}`;
  return result;
}
