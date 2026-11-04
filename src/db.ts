import Dexie, { type Table } from 'dexie';
export type Tipo = 'receita' | 'despesa';
export type Natureza = 'fixo' | 'variavel';
export type Status = 'previsto' | 'confirmado';
export interface Lancamento { id?: number; descricao: string; valorCentavos: number; tipo: Tipo; natureza: Natureza; categoria: string; data: string; status: Status; observacao?: string; grupoRecorrencia?: string; recorrenciaId?: number; }
export interface Categoria { id?: number; nome: string; tipo: Tipo; natureza: Natureza; }
export interface Recorrencia { id?: number; descricao: string; valorCentavos: number; categoria: string; natureza: Natureza; tipo: Tipo; inicio: string; dia: number; ativa: boolean; }
export interface Salario { id: string; liquido: number; refeicao: number; beneficio: number; adicional: number; }
export interface Configuracao { id: string; fixos: number; variaveis: number; reserva: number; }
export interface Reserva { id?: number; descricao: string; valorCentavos: number; data: string; }
class ControlDB extends Dexie {
  lancamentos!: Table<Lancamento, number>;
  configuracoes!: Table<Configuracao, string>;
  reservas!: Table<Reserva, number>;
  categorias!: Table<Categoria, number>;
  recorrencias!: Table<Recorrencia, number>;
  salarios!: Table<Salario, string>;
  constructor() { super('ControlAI');
    this.version(1).stores({ categorias: '++id, nome, tipo', lancamentos: '++id, tipo, data, categoriaId, natureza, status', orcamentos: '++id' });
    this.version(2).stores({ categorias: null, orcamentos: null, lancamentos: '++id, data, tipo, natureza, categoria, status', configuracoes: 'id', reservas: '++id, data' }).upgrade(async tx => {
      const tabela = tx.table('lancamentos');
      await tabela.toCollection().modify((l: Record<string, unknown>) => { if (typeof l.valorCentavos !== 'number') { l.valorCentavos = Math.round(Number(l.valor || 0) * 100); delete l.valor; } if (!l.categoria) l.categoria = l.tipo === 'receita' ? 'Outras receitas' : 'Outros'; });
    });
    this.version(3).stores({ categorias: '++id, &[tipo+nome]', recorrencias: '++id, ativa, inicio', salarios: 'id', lancamentos: '++id, data, tipo, natureza, categoria, status, recorrenciaId', configuracoes: 'id', reservas: '++id, data' }).upgrade(async tx => {
      const tabela = tx.table('categorias');
      const padrao = [
        ...['Moradia','Alimentação','Transporte','Saúde','Educação','Lazer','Assinaturas','Pets','Compras','Outros'].map(nome=>({nome,tipo:'despesa',natureza:['Moradia','Assinaturas'].includes(nome)?'fixo':'variavel'})),
        ...['Salário','Freelance','Rendimentos','Reembolso','Outras receitas'].map(nome=>({nome,tipo:'receita',natureza:nome==='Salário'?'fixo':'variavel'}))
      ];
      await tabela.bulkAdd(padrao);
    });
  }
}
export const db = new ControlDB();
export const categoriasDespesa = ['Moradia','Alimentação','Transporte','Saúde','Educação','Lazer','Assinaturas','Pets','Compras','Outros'];
export const categoriasReceita = ['Salário','Freelance','Rendimentos','Reembolso','Outras receitas'];
