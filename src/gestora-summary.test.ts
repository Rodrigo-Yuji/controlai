import test from 'node:test';
import assert from 'node:assert/strict';
import {personMonth,activePeople} from './gestora-summary.ts';
import type {Conta,Lancamento} from './db.ts';
const account:Conta={id:'G',nome:'Casa',padrao:false,conjunta:false,tipo:'gestora',pessoas:[{id:'a',nome:'Ana',inicioMes:'2026-09',contribuicoes:[{desde:'2026-09',valorCentavos:100000}]},{id:'b',nome:'Bia',inicioMes:'2026-09',fimMes:'2026-10',contribuicoes:[{desde:'2026-09',valorCentavos:50000}]}],
 mercados:[{id:'m1',descricao:'Mercado',data:'2026-10-10',totalCentavos:30000,itens:[{id:'i1',descricao:'Whey',pessoaId:'a',valorCentavos:5000}]},{id:'m2',descricao:'Mercado',data:'2026-11-10',totalCentavos:20000,pagadorPessoaId:'a',itens:[{id:'i2',descricao:'Chá',pessoaId:'a',valorCentavos:2000}]}]};
const paid=(extra:Partial<Lancamento>):Lancamento=>({contaId:'G',descricao:'x',valorCentavos:0,tipo:'receita',natureza:'fixo',categoria:'Contribuição',data:'2026-11-05',status:'confirmado',...extra});
test('a person shows contribution, what is owed to the account and what the account owes',()=>{
 const entries=[paid({valorCentavos:60000,gestao:{tipo:'contribuicao',pessoaId:'a',mesReferencia:'2026-11'}}),paid({valorCentavos:2000,gestao:{tipo:'reembolsoMercado',pessoaId:'a',compraId:'m1'}})];
 const r=personMonth(account,entries,'2026-11',account.pessoas![0]);
 assert.equal(r.target,100000);assert.equal(r.paid,60000);assert.equal(r.falta,40000);
 assert.equal(r.deveConta,3000);assert.equal(r.pessoaisMes,2000);assert.equal(r.contaDeve,18000);
 assert.deepEqual(activePeople(account,'2026-11').map(p=>p.id),['a']);assert.deepEqual(activePeople(account,'2026-10').map(p=>p.id),['a','b']);
});
