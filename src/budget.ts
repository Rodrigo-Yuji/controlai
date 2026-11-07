import type { Lancamento } from './db.ts';

// Permanent recurrences, finite repeats and installments are monthly commitments,
// regardless of the category's fixed/variable classification or payment status.
export function isMonthlyCommitment(entry: Lancamento): boolean {
  return entry.tipo === 'despesa' && (entry.recorrenciaId !== undefined || Boolean(entry.grupoRecorrencia) || Boolean(entry.parcela));
}

// Entries include the month's projections; the caller suppresses projections
// already represented by a recorded recurrence, including paid occurrences.
export function monthlyFixedBudget(entries: Lancamento[], baseCentavos: number, month?:string) {
  const totalCentavos = entries.filter(entry=>isMonthlyCommitment(entry)&&(!month||(entry.parcial?.dataPrevista??entry.dataPrevista??entry.data).slice(0,7)===month)).reduce((sum, entry) => sum + entry.valorCentavos, 0);
  const percentage = baseCentavos > 0 ? Math.round(totalCentavos / baseCentavos * 10000) / 100 : null;
  return { totalCentavos, percentage };
}
