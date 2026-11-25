import test from 'node:test';
import assert from 'node:assert/strict';
import {installmentGroups} from './installments.ts';
import type {Lancamento} from './db.ts';
const part=(n:number,status:'confirmado'|'previsto',data:string,extra:Partial<Lancamento>={}):Lancamento=>({id:n,contaId:'A',descricao:`Notebook (${n}/4)`,valorCentavos:25000,tipo:'despesa',natureza:'variavel',categoria:'Compras',data,status,parcela:{grupo:'g1',numero:n,total:4},...extra});
test('installment purchases show paid, remaining, next due and late parts',()=>{
 const rows=[part(1,'confirmado','2026-09-10'),part(2,'confirmado','2026-10-10'),part(3,'previsto','2026-11-10'),part(4,'previsto','2026-12-10')];
 const [g]=installmentGroups(rows,[],'2026-11-20');
 assert.equal(g.nome,'Notebook');assert.equal(g.pagas,2);assert.equal(g.total,4);assert.equal(g.falta,50000);assert.equal(g.pago,50000);assert.equal(g.proxima?.parcela?.numero,3);assert.equal(g.atrasadas,1);assert.equal(g.ultima,'2026-12');
 const [done]=installmentGroups(rows.map(r=>({...r,status:'confirmado' as const})),[{id:'c',nome:'Itaú',fechamento:1,vencimento:10}],'2026-11-20');assert.equal(done.falta,0);assert.equal(done.proxima,undefined);
 const [card]=installmentGroups(rows.map(r=>({...r,cartaoId:'c'})),[{id:'c',nome:'Itaú',fechamento:1,vencimento:10}],'2026-11-01');assert.equal(card.cartao,'Itaú');assert.equal(card.atrasadas,0);
});
