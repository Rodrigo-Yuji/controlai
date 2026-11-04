import Dexie,{type Table} from 'dexie';
export type Tipo='receita'|'despesa';export type Natureza='fixo'|'variavel';export type Status='previsto'|'confirmado';
export interface Lancamento{id?:number;descricao:string;valor:number;tipo:Tipo;natureza:Natureza;categoria:string;data:string;status:Status;recorrente:boolean;grupoRecorrencia?:string;parcela?:number;totalParcelas?:number}
export interface Orcamento{id:string;fixos:number;variaveis:number;reserva:number}
export interface Config{id:string;valor:string}
class DB extends Dexie{lancamentos!:Table<Lancamento,number>;orcamentos!:Table<Orcamento,string>;config!:Table<Config,string>;constructor(){super('ControlAI');this.version(1).stores({lancamentos:'++id,tipo,data,categoria,natureza,status',orcamentos:'id',config:'id'});}}
export const db=new DB();
export const categoriasPadrao=['Moradia','Alimentação','Transporte','Saúde','Educação','Lazer','Assinaturas','Pets','Compras','Impostos','Salário','Freelance','Investimentos','Outros'];
export const dinheiro=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
export const hoje=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export const mesAtual=()=>hoje().slice(0,7);
export const somar=(xs:Lancamento[])=>xs.reduce((a,x)=>a+x.valor,0);
export const addMeses=(date:string,quantidade:number)=>{const [a,m,d]=date.split('-').map(Number);const destino=new Date(a,m-1+quantidade,1);const dia=Math.min(d,new Date(destino.getFullYear(),destino.getMonth()+1,0).getDate());return `${destino.getFullYear()}-${String(destino.getMonth()+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`};
