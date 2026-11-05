export type Tipo = 'receita' | 'despesa';
export type Natureza = 'fixo' | 'variavel';
export type Status = 'previsto' | 'confirmado';
export interface Lancamento { contaId?: string; id?: number; descricao: string; valorCentavos: number; tipo: Tipo; natureza: Natureza; categoria: string; data: string; status: Status; observacao?: string; origemImportacao?: string; grupoRecorrencia?: string; recorrenciaId?: number; parcela?: Parcela; }
export interface Categoria { contaId?: string; id?: number; nome: string; tipo: Tipo; natureza: Natureza; }
export interface Recorrencia { contaId?: string; id?: number; descricao: string; valorCentavos: number; categoria: string; natureza: Natureza; tipo: Tipo; inicio: string; dia: number; ativa: boolean; observacao?: string; }
export interface Salario { id: string; contaId?: string; titular?: string; liquido: number; refeicao: number; beneficio: number; adicional: number; }
export interface Configuracao { id: string; contaId?: string; baseReceita?: 'atual'|'prevista'; fixos: number; variaveis: number; reserva: number; }
export interface Reserva { contaId?: string; id?: number; descricao: string; valorCentavos: number; data: string; }
export interface Fechamento { id: string; contaId: string; mes: string; fechadoEm: string; }
export interface Parcela { grupo: string; numero: number; total: number; }
export interface Conta { id: string; nome: string; conjunta: boolean; padrao: boolean; }
export { db, initializeStorage, storageKind } from './storage/index';
export const categoriasDespesa = ['Moradia','Alimentação','Transporte','Saúde','Educação','Lazer','Assinaturas','Pets','Compras','Outros'];
export const categoriasReceita = ['Salário','Freelance','Rendimentos','Reembolso','Outras receitas'];
