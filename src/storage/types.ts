import type { Categoria, Configuracao, Conta, Fechamento, Lancamento, Recorrencia, Reserva, Salario } from '../db.ts';

export interface Records {
  contas: Conta;
  fechamentos: Fechamento;
  lancamentos: Lancamento;
  configuracoes: Configuracao;
  reservas: Reserva;
  categorias: Categoria;
  recorrencias: Recorrencia;
  salarios: Salario;
}
export const TABLE_NAMES = ['contas', 'fechamentos', 'lancamentos', 'configuracoes', 'reservas', 'categorias', 'recorrencias', 'salarios'] as const;
export type TableName = typeof TABLE_NAMES[number];
export const NUMERIC_TABLES: readonly TableName[] = ['lancamentos', 'reservas', 'categorias', 'recorrencias'];
export type Key<N extends TableName> = N extends 'lancamentos' | 'reservas' | 'categorias' | 'recorrencias' ? number : string;
export interface TableRef { readonly name: TableName }
export interface Collection<T> {
  toArray(): Promise<T[]>;
  first(): Promise<T | undefined>;
  count(): Promise<number>;
  modify(changes: Partial<T> | ((row: T) => void)): Promise<number>;
  delete(): Promise<number>;
}
export interface StorageTable<T, K> extends TableRef {
  toArray(): Promise<T[]>;
  get(id: K): Promise<T | undefined>;
  count(): Promise<number>;
  add(row: T): Promise<K>;
  put(row: T): Promise<K>;
  bulkAdd(rows: readonly T[]): Promise<K | undefined>;
  bulkDelete(ids: readonly K[]): Promise<void>;
  update(id: K, changes: Partial<T>): Promise<number>;
  delete(id: K): Promise<void>;
  clear(): Promise<void>;
  where(index: string): { equals(value: unknown): Collection<T> };
  filter(predicate: (row: T) => boolean): Collection<T>;
  toCollection(): Collection<T>;
}
export type Tables = { [N in TableName]: StorageTable<Records[N], Key<N>> };
export interface Observer<T> { next(value: T): void; error(error: unknown): void }
export interface Database extends Tables {
  readonly kind: 'sqlite' | 'indexeddb';
  readonly tables: TableRef[];
  initialize(): Promise<void>;
  transaction<T>(tables: readonly TableRef[], work: (transaction: Tables) => Promise<T>): Promise<T>;
  subscribe<T>(query: () => Promise<T>, observer: Observer<T>): () => void;
}

export interface LegacySnapshot { version: number; tables: Record<string, unknown[]> }
