import Dexie, { type Table } from 'dexie';
import type { Conta, Fechamento, Lancamento, Configuracao, Reserva, Categoria, Recorrencia, Salario } from '../db';
export class LegacyDatabase extends Dexie {
  contas!: Table<Conta, string>;
  fechamentos!: Table<Fechamento, string>;
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
    this.version(4).stores({ contas: 'id, padrao', categorias: '++id, contaId, &[contaId+tipo+nome]', recorrencias: '++id, contaId, ativa, inicio', salarios: 'id, contaId', lancamentos: '++id, contaId, data, tipo, natureza, categoria, status, recorrenciaId', configuracoes: 'id, contaId', reservas: '++id, contaId, data' }).upgrade(async tx => {
      for (const nome of ['lancamentos','reservas','categorias','recorrencias','salarios','configuracoes']) await tx.table(nome).toCollection().modify((item: Record<string,unknown>) => {item.contaId='principal';});
      const salarioAntigo = await tx.table('salarios').get('principal');
      if(salarioAntigo){await tx.table('salarios').put({...salarioAntigo,id:'principal:1',contaId:'principal'});await tx.table('salarios').delete('principal');}
      await tx.table('contas').put({id:'principal',nome:'Minha conta',conjunta:false,padrao:true});
    });
    this.version(5).stores({fechamentos:'id, contaId, mes'});
  }
}
