import { TABLE_NAMES, type LegacySnapshot, type Records, type TableName } from './types.ts';
import { money } from '../assistant.ts';

type Row = { [key: string]: unknown };
export function normalizeLegacy(source: LegacySnapshot): { [N in TableName]: Records[N][] } {
  const result = Object.fromEntries(TABLE_NAMES.map(name => [name, (source.tables[name] ?? []).map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Registro legado inválido em ${name}.`);
    return {...row} as Row;
  })])) as Record<TableName, Row[]>;
  const hasData = Object.values(source.tables).some(rows => rows.length > 0);
  if (!hasData) return result as unknown as { [N in TableName]: Records[N][] };
  if (!result.contas.length) result.contas = [{id:'principal', nome:'Minha conta', conjunta:false, padrao:true}];
  const defaultAccount = result.contas.find(row => row.padrao)?.id ?? result.contas[0].id;
  const accountIds = new Set(result.contas.map(row => row.id));
  if (typeof defaultAccount !== 'string') throw new Error('Conta legada sem ID válido.');
  const oldCategories = new Map(result.categorias.map(row => [row.id, row.nome]));
  for (const name of TABLE_NAMES) {
    if (name === 'contas') continue;
    for (const row of result[name]) {
      if (row.contaId === undefined) row.contaId = defaultAccount;
      if (!accountIds.has(row.contaId)) throw new Error('Há registros de uma conta inexistente. O banco de origem foi preservado.');
      if (name === 'salarios') {
        if (row.id === 'principal') row.id = `${row.contaId}:1`;
      } else if (name === 'configuracoes' && source.version < 4) row.id = row.contaId;
      if (name === 'lancamentos' || name === 'reservas' || name === 'recorrencias') {
        if (row.valorCentavos === undefined && row.valor !== undefined) {
          const converted = money(row.valor as string | number);
          if (converted === null) throw new Error('Valor legado inválido. Exporte um backup para conferência.');
          row.valorCentavos = converted;
        }
        if (!Number.isSafeInteger(row.valorCentavos)) throw new Error('Valor em centavos inválido no banco de origem.');
      }
      if (name === 'lancamentos' && !row.categoria) row.categoria = oldCategories.get(row.categoriaId) ?? (row.tipo === 'receita' ? 'Outras receitas' : 'Outros');
      if (name === 'categorias' && !row.natureza) row.natureza = row.tipo === 'receita' || ['Moradia','Assinaturas'].includes(String(row.nome)) ? 'fixo' : 'variavel';
    }
  }
  // Unmapped historical stores (e.g. v1 budgets) remain intact in the source and
  // in the SQLite migration archive, even when the current UI cannot display them.
  return result as unknown as { [N in TableName]: Records[N][] };
}
