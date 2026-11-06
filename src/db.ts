export type Tipo = 'receita' | 'despesa';
export type Natureza = 'fixo' | 'variavel';
export type Status = 'previsto' | 'confirmado';
export interface Lancamento { contaId?: string; id?: number; descricao: string; valorCentavos: number; tipo: Tipo; natureza: Natureza; categoria: string; data: string; status: Status; observacao?: string; origemImportacao?: string; grupoRecorrencia?: string; recorrenciaId?: number; parcela?: Parcela; cartaoId?:string; faturaMes?:string; gestao?:MovimentoGestao; }
export interface Categoria { contaId?: string; id?: number; nome: string; tipo: Tipo; natureza: Natureza; }
export interface Recorrencia { contaId?: string; id?: number; descricao: string; valorCentavos: number; categoria: string; natureza: Natureza; tipo: Tipo; inicio: string; dia: number; ativa: boolean; observacao?: string; cartaoId?:string; }
export interface Salario { id: string; contaId?: string; titular?: string; liquido: number; refeicao: number; beneficio: number; adicional: number; }
export interface Configuracao { id: string; contaId?: string; baseReceita?: 'atual'|'prevista'; fixos: number; variaveis: number; reserva: number; }
export interface Reserva { contaId?: string; id?: number; descricao: string; valorCentavos: number; data: string; }
export interface Fechamento { id: string; contaId: string; mes: string; fechadoEm: string; }
export interface Parcela { grupo: string; numero: number; total: number; }
export type TipoConta='solo'|'casal'|'gestora';
export interface Cartao {id:string;nome:string;fechamento:number;vencimento:number;pessoaId?:string;arquivado?:boolean}
export interface PessoaGestora {id:string;nome:string;inicioMes:string;fimMes?:string;contribuicoes:{desde:string;valorCentavos:number}[]}
export interface ItemMercado {id:string;descricao:string;pessoaId:string;valorCentavos:number}
export interface CompraMercado {id:string;descricao:string;data:string;cartaoId?:string;pagadorPessoaId?:string;faturaMes?:string;totalCentavos:number;itens:ItemMercado[]}
export interface MovimentoGestao {tipo:'contribuicao'|'compraMercado'|'reembolsoMercado'|'repasseMercado'|'receitaPessoa';pessoaId?:string;mesReferencia?:string;compraId?:string}
export interface DistribuicaoCasal {mes:string;totalCentavos:number;comumCentavos:number;pessoais:[number,number];percentuaisPessoais?:[number,number];percentualPessoal?:number;confirmadaEm:string}
export interface TransferenciaPessoal {id:string;titular:1|2;data:string;valorCentavos:number}
export interface Conta { id: string; nome: string; conjunta: boolean; padrao: boolean; tipo?:TipoConta; cor?:string; percentualPessoalCasal?:number; percentuaisPessoaisCasal?:[number,number]; distribuicoesCasal?:DistribuicaoCasal[]; transferenciasPessoais?:TransferenciaPessoal[]; cartoes?:Cartao[]; pessoas?:PessoaGestora[]; mercados?:CompraMercado[]; }
export { db, initializeStorage, storageKind } from './storage/index';
export const categoriasDespesa = ['Moradia','Alimentação','Transporte','Saúde','Educação','Lazer','Assinaturas','Pets','Compras','Outros'];
export const categoriasReceita = ['Salário','Freelance','Rendimentos','Reembolso','Outras receitas'];
