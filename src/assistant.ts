import type { Categoria, Lancamento, Natureza, Status, Tipo } from './db.ts';

export type Cell = string | number | boolean | Date | null;
export type Column = 'descricao' | 'valor' | 'data' | 'tipo' | 'categoria' | 'status' | 'observacao';
export type Columns = Record<Column, number>;
export interface Draft {
  descricao: string;
  valor: string;
  valorOriginal?: string;
  data: string;
  tipo: string;
  categoria: string;
  status: string;
  observacao: string;
  selecionada: boolean;
  linha: number;
}
export const MAX_ROWS = 500;
export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Parse decimal digits into integer cents without floating-point rounding.
export function money(value: string | number): number | null {
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  let text = String(value).trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (/^\(.*\)$/.test(text)) text = `-${text.slice(1, -1)}`;
  const negative = text.startsWith('-');
  text = text.replace(/^[+-]/, '');
  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      if (!/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(text)) return null;
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      if (!/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(text)) return null;
      text = text.replace(/,/g, '');
    }
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  } else if (typeof value === 'string' && /^\d{1,3}(?:\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [integer, decimal = ''] = text.split('.');
  const cents = Number(integer) * 100 + Number(decimal.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents * (negative ? -1 : 1) : null;
}
export function moneyInput(cents: number): string {
  const absolute = Math.abs(cents);
  return `${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) < '1900' || value.slice(0, 4) > '9999') return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function dateCell(value: Cell): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
}

export function parseCsv(input: string): Cell[][] {
  const text = input.replace(/^\uFEFF/, '').replace(/^(?:[ \t]*\r?\n)+/, '');
  let quoted = false;
  const counts = new Map([[';', 0], [',', 0], ['\t', 0]]);
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      if (quoted && text[i + 1] === '"') { i++; continue; }
      quoted = !quoted;
    }
    if (!quoted && /[\r\n]/.test(text[i])) break;
    if (!quoted && counts.has(text[i])) counts.set(text[i], counts.get(text[i])! + 1);
  }
  const separator = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const rows: Cell[][] = [];
  let row: string[] = [], cell = '';
  quoted = false;
  const finish = () => {
    row.push(cell); cell = '';
    if (row.some(value => value.trim() !== '')) rows.push(row);
    row = [];
    if (rows.length > MAX_ROWS + 1) throw new Error(`Importe até ${MAX_ROWS} linhas por vez.`);
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell === '') quoted = !quoted;
      else throw new Error('CSV inválido: aspas fora de um campo delimitado.');
    } else if (char === separator && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      finish();
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else cell += char;
  }
  if (quoted) throw new Error('CSV inválido: feche as aspas do último campo.');
  if (cell !== '' || row.length) finish();
  return rows;
}

const aliases: Record<Column, string[]> = {
  descricao: ['descricao', 'historico', 'lancamento', 'estabelecimento', 'description'],
  valor: ['valor', 'valor r$', 'valor (r$)', 'valor total', 'amount'],
  data: ['data', 'data da compra', 'data de pagamento', 'vencimento', 'date'],
  tipo: ['tipo', 'entrada/saida', 'natureza da operacao', 'type'],
  categoria: ['categoria', 'category'],
  status: ['status', 'situacao'],
  observacao: ['observacao', 'observacoes', 'obs', 'nota', 'notes'],
};
export function detectColumns(headers: Cell[]): Columns {
  return Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, headers.findIndex(header => names.includes(normalize(String(header ?? ''))))])) as Columns;
}
export function suggestCategory(description: string, type: Tipo, categories: Categoria[], explicit = ''): string {
  const available = categories.filter(category => category.tipo === type);
  if (explicit.trim()) return available.find(category => normalize(category.nome) === normalize(explicit))?.nome ?? explicit.trim();
  const text = normalize(description);
  const rules: [RegExp, string][] = type === 'receita'
    ? [[/salario/, 'Salário'], [/freelance|freela/, 'Freelance'], [/reembolso/, 'Reembolso'], [/rendimento/, 'Rendimentos']]
    : [[/almoco|jantar|lanche|restaurante|mercado|comida|cafe|padaria/, 'Alimentação'], [/uber|onibus|combustivel|gasolina|transporte/, 'Transporte'], [/aluguel|agua|luz|energia|internet/, 'Moradia'], [/farmacia|medico|saude/, 'Saúde'], [/curso|escola|faculdade/, 'Educação'], [/netflix|spotify|assinatura/, 'Assinaturas'], [/cinema|lazer/, 'Lazer']];
  const suggestion = rules.find(([pattern]) => pattern.test(text))?.[1] ?? (type === 'receita' ? 'Outras receitas' : 'Outros');
  return available.find(category => category.nome === suggestion)?.nome ?? available[0]?.nome ?? '';
}
export function spreadsheetDrafts(rows: Cell[][], columns: Columns, categories: Categoria[], today: string): Draft[] {
  if (columns.descricao < 0 || columns.valor < 0) throw new Error('Selecione as colunas de descrição e valor.');
  if (rows.length < 2) throw new Error('A planilha precisa de cabeçalho e ao menos um lançamento.');
  if (rows.slice(1).filter(row => row.some(cell => cell !== null && String(cell).trim() !== '')).length > MAX_ROWS) throw new Error(`Importe até ${MAX_ROWS} linhas por vez.`);
  return rows.slice(1).flatMap((row, index) => {
    if (row.every(cell => cell === null || String(cell).trim() === '')) return [];
    const get = (key: Column) => columns[key] < 0 ? '' : row[columns[key]] ?? '';
    const cents = money(get('valor') as string | number);
    const rawType = normalize(String(get('tipo')));
    const type = ['receita', 'entrada', 'credito', 'c', 'income'].includes(rawType) ? 'receita'
      : ['despesa', 'saida', 'debito', 'd', 'expense'].includes(rawType) ? 'despesa'
      : rawType || (cents !== null && cents > 0 ? 'receita' : 'despesa');
    const rawStatus = normalize(String(get('status')));
    const status = ['confirmado', 'pago', 'recebido', 'paid'].includes(rawStatus) ? 'confirmado'
      : ['previsto', 'pendente', 'pending'].includes(rawStatus) ? 'previsto' : rawStatus || 'confirmado';
    const descricao = String(get('descricao')).trim();
    return [{ descricao, valor: cents === null ? '' : moneyInput(cents), valorOriginal: String(get('valor')), data: columns.data < 0 ? today : dateCell(get('data')), tipo: type,
      categoria: suggestCategory(descricao, type === 'receita' ? 'receita' : 'despesa', categories, String(get('categoria'))), status,
      observacao: String(get('observacao')).trim(), selecionada: true, linha: index + 2 }];
  });
}
export function draftError(draft: Draft, categories: Categoria[], closedMonths: string[]): string {
  if (!draft.descricao.trim() || draft.descricao.trim().length > 120) return 'Descrição: informe entre 1 e 120 caracteres.';
  const cents = money(draft.valor);
  if (cents === null || cents <= 0) return 'Informe um valor positivo com até duas casas decimais.';
  if (!validDate(draft.data)) return 'Informe uma data válida.';
  if (closedMonths.includes(draft.data.slice(0, 7))) return 'Mês fechado. Reabra em Orçamento ou desmarque esta linha.';
  if (!['receita', 'despesa'].includes(draft.tipo)) return 'Selecione receita ou despesa.';
  if (!['previsto', 'confirmado'].includes(draft.status)) return 'Selecione o status.';
  if (!categories.some(category => category.tipo === draft.tipo && category.nome === draft.categoria)) return 'Selecione uma categoria desta conta e deste tipo.';
  return '';
}
export function toEntry(draft: Draft, accountId: string, categories: Categoria[]): Lancamento {
  const error = draftError(draft, categories, []);
  if (error) throw new Error(error);
  const category = categories.find(category => category.tipo === draft.tipo && category.nome === draft.categoria)!;
  return {contaId: accountId, descricao: draft.descricao.trim(), valorCentavos: money(draft.valor)!, data: draft.data, tipo: draft.tipo as Tipo,
    categoria: category.nome, natureza: category.natureza as Natureza, status: draft.status as Status, observacao: draft.observacao.trim()};
}
export function fingerprint(entry: Lancamento): string {
  return JSON.stringify([entry.data, entry.tipo, entry.valorCentavos, normalize(entry.descricao), normalize(entry.categoria)]);
}

const numberWords: Record<string, number> = {zero:0, um:1, uma:1, dois:2, duas:2, tres:3, quatro:4, cinco:5, seis:6, sete:7, oito:8, nove:9, dez:10,
  onze:11, doze:12, treze:13, quatorze:14, catorze:14, quinze:15, dezesseis:16, dezassete:17, dezessete:17, dezoito:18, dezenove:19,
  vinte:20, trinta:30, quarenta:40, cinquenta:50, sessenta:60, setenta:70, oitenta:80, noventa:90, cem:100, cento:100, duzentos:200,
  trezentos:300, quatrocentos:400, quinhentos:500, seiscentos:600, setecentos:700, oitocentos:800, novecentos:900};
function wordsValue(text: string): number {
  let result = 0, group = 0;
  for (const word of normalize(text).split(/\s+/)) {
    if (word === 'e') continue;
    if (word === 'mil') { result += (group || 1) * 1000; group = 0; }
    else if (word in numberWords) group += numberWords[word];
    else return NaN;
  }
  return result + group;
}
export function commandDraft(command: string, categories: Categoria[], today: string): Draft {
  let text = command.trim();
  if (!text) throw new Error('Digite ou fale uma despesa ou receita.');
  const normalized = normalize(text);
  const income = /\b(recebi|ganhei|receita|entrou)\b/.test(normalized);
  if (income && /\b(comprei|paguei|gastei|despesa)\b/.test(normalized)) throw new Error('Informe uma receita ou despesa por comando.');
  const tipo: Tipo = income ? 'receita' : 'despesa';
  const dates = [...text.matchAll(/\b\d{2}\/\d{2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|\bhoje\b|\bontem\b/gi)];
  if (dates.length > 1) throw new Error('Informe uma única data por comando.');
  let data = today;
  if (dates[0]) {
    const raw = dates[0][0];
    if (normalize(raw) === 'ontem') {
      const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 1); data = date.toISOString().slice(0, 10);
    } else if (normalize(raw) !== 'hoje') data = dateCell(raw);
    text = text.replace(raw, ' ');
  }
  const numeric = [...text.matchAll(/(?:R\$\s*)?\d+(?:[.,]\d+)*(?:\s*(?:reais|real))?(?:\s+e\s+(\d{1,2})\s+centavos)?/gi)];
  const words = [...Object.keys(numberWords), 'três', 'mil', 'e'].join('|');
  const wordAmounts = [...text.matchAll(new RegExp(`\\b((?:${words})(?:\\s+(?:${words}))*)\\s+(?:reais|real)(?:\\s+e\\s+((?:${words})(?:\\s+(?:${words}))*)\\s+centavos)?\\b`, 'gi'))];
  let raw: string, cents: number | null;
  if (numeric.length + wordAmounts.length > 1) throw new Error('Informe um único valor por comando.');
  if (numeric.length === 1) {
    raw = numeric[0][0];
    const main = raw.replace(/\s*(reais|real)\b.*/i, '').trim();
    cents = money(main);
    if (numeric[0][1]) cents = cents !== null && cents % 100 === 0 ? cents + Number(numeric[0][1]) : null;
  } else {
    const match = wordAmounts[0];
    if (!match) throw new Error('Não identifiquei o valor. Exemplo: comprei almoço por 40 reais.');
    raw = match[0]; const whole = wordsValue(match[1]), decimal = match[2] ? wordsValue(match[2]) : 0;
    cents = decimal >= 0 && decimal < 100 ? whole * 100 + decimal : null;
  }
  if (/\bcentavos\b/i.test(text.replace(raw, ''))) throw new Error('Informe os centavos junto ao valor. Exemplo: almoço por 40,50 reais.');
  if (cents === null || !Number.isSafeInteger(cents) || cents <= 0) throw new Error('Não identifiquei um valor positivo válido.');
  const descricao = text.replace(raw, ' ').replace(/^\s*(comprei|paguei|gastei|recebi|ganhei|receita|despesa|entrou)\s+/i, '')
    .replace(/\s+/g, ' ').replace(/\b(por|de|em|no valor de)\s*$/i, '').replace(/^[\s,.;:]+|[\s,.;:]+$/g, '').trim();
  if (!descricao) throw new Error('Informe também a descrição. Exemplo: comprei almoço por 40 reais.');
  if (!validDate(data)) throw new Error('A data informada não é válida.');
  return {descricao: descricao.charAt(0).toUpperCase() + descricao.slice(1), valor: moneyInput(cents), data, tipo,
    categoria: suggestCategory(descricao, tipo, categories), status:'confirmado', observacao:'', selecionada:true, linha:1};
}
