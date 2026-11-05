import type { Categoria, Tipo } from './db.ts';
import { MAX_ROWS, moneyInput, normalize, spreadsheetMoney, suggestCategory, validDate, type Cell, type Draft } from './assistant.ts';

export interface PlanLayout { header: number; expenses: number; income: number }
export interface PlanSkipped { linha: number; coluna: string; descricao: string; motivo: string }
export interface PlanResult { drafts: Draft[]; skipped: PlanSkipped[]; month: string; day: number }
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

export function monthlyPlanDrafts(rows: Cell[][], sheet: string, month: string, day: number, categories: Categoria[]): PlanResult {
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
      if (total(normalized)) {
        if (!empty(value) || (block === 'expenses' && !empty(row[column + 2]))) skip(index + 1, column + 1, description, 'Total, subtotal ou saldo: não é um lançamento adicional.');
        continue;
      }
      if (block === 'expenses' && /^cartao\b/.test(normalized) && empty(value)) { section = description; continue; }
      if (empty(value)) {
        if (description && !paid(row[column]) && !/^[-–—]+$/.test(description)) skip(index + 1, column + 1, description, 'Sem valor na coluna principal; anotações não foram convertidas em dinheiro.');
        continue;
      }
      if (block === 'expenses' && /^(reserva|reserva financeira|poupanca)$/.test(normalized)) {
        skip(index + 1, column + 1, description, 'Reserva/poupança: registre em Orçamento → Reserva para não contar como consumo.'); continue;
      }
      const cents = spreadsheetMoney(value);
      if (cents === 0) { skip(index + 1, column + 1, description, 'Valor zero.'); continue; }
      const tipo: Tipo = block === 'income' ? (cents !== null && cents < 0 ? 'despesa' : 'receita')
        : signedExpenses && cents !== null && cents > 0 ? 'receita' : 'despesa';
      const notes = block === 'expenses' ? row[column + 2] : undefined;
      const statusCells = block === 'expenses' ? [notes, row[column + 3]] : [row[column + 2]];
      const observacao = [
        !empty(notes) && !paid(notes) ? cellText(notes) : '',
        `Origem: ${sheet}, linha ${index + 1}, ${block === 'expenses' ? section : 'Receitas'}.`,
        `Dia ${chosenDay} usado como referência; a planilha informa apenas o mês.`,
      ].filter(Boolean).join('\n');
      result.drafts.push({descricao:paid(row[column]) || /^[-–—]+$/.test(description) ? '' : description,
        valor:cents === null ? '' : moneyInput(cents), valorOriginal:cellText(value), data, tipo,
        categoria:suggestCategory(description, tipo, categories), status:statusCells.some(paid) ? 'confirmado' : 'previsto', observacao,
        origemImportacao:`plano:${normalize(sheet)}:${columnName(column + 1)}${index + 1}`, selecionada:true, linha:index + 1});
      if (result.drafts.length > MAX_ROWS) throw new Error(`Importe até ${MAX_ROWS} lançamentos por aba.`);
    }
    // Side calculations outside the two identified blocks are deliberately not
    // counted as income; show their locations instead of silently guessing.
    for (let column = layout.income + 3; column < row.length - 1; column++) {
      if (typeof row[column] === 'string' && !empty(row[column + 1]) && spreadsheetMoney(row[column + 1]) !== null) {
        skip(index + 1, column + 1, cellText(row[column]), 'Bloco auxiliar fora de Receitas/Despesas; confira separadamente.'); column++;
      }
    }
  }
  return result;
}
