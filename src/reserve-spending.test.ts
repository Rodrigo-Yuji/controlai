import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createSqliteDatabase,type SqlDriver} from './storage/sqlite.ts';
import {registeredBalance} from './account-balance.ts';
import {balanceForecast} from './insights.ts';
import {validateSnapshot} from './sync/snapshot.ts';
import {movesSpendable,reserveSpent,spendFromReserve} from './reserve-spending.ts';
import type {Conta,Lancamento} from './db.ts';
function device(){const raw=new DatabaseSync(':memory:');const driver:SqlDriver={all:async(sql,v=[])=>raw.prepare(sql).all(...v),run:async(sql,v=[])=>{const r=raw.prepare(sql).run(...v);return {changes:Number(r.changes),lastId:Number(r.lastInsertRowid)};},begin:async()=>{raw.exec('BEGIN IMMEDIATE');},commit:async()=>{raw.exec('COMMIT');},rollback:async()=>{raw.exec('ROLLBACK');}};return createSqliteDatabase(async()=>driver);}
const account:Conta={id:'A',nome:'Solo',padrao:true,conjunta:false,tipo:'solo'};
async function seed(){const db=device();await db.contas.add(account);await db.reservas.add({contaId:'A',descricao:'Guardado',valorCentavos:100000,data:'2026-10-01'});return db;}
const income:Lancamento={contaId:'A',descricao:'Salário',valorCentavos:500000,tipo:'receita',natureza:'fixo',categoria:'Salário',data:'2026-10-05',status:'confirmado'};

test('spending from the reserve creates no expense entry and keeps the spendable balance',async()=>{
 const db=await seed();
 const before=registeredBalance([income],await db.reservas.toArray(),[],'2026-11');
 const row=await spendFromReserve(db,'A',{descricao:'  Conserto   do carro ',valorCentavos:30000,data:'2026-11-03',categoria:'Transporte'});
 assert.equal(row.descricao,'Conserto do carro');assert.equal(row.gasto,true);assert.equal(row.valorCentavos,-30000);
 assert.equal(await db.lancamentos.count(),0);
 const after=registeredBalance([income],await db.reservas.toArray(),[],'2026-11');
 assert.equal(after.current,before.current);assert.equal(after.reserve,before.reserve-30000);assert.equal(after.total,before.total-30000);
 const earlier=registeredBalance([income],await db.reservas.toArray(),[],'2026-11-02');assert.equal(earlier.reserve,before.reserve);
});
test('a plain withdrawal still moves money back to the spendable balance',()=>{
 const rows=[{contaId:'A',descricao:'Guardado',valorCentavos:100000,data:'2026-10-01'},{contaId:'A',descricao:'Resgate',valorCentavos:-20000,data:'2026-11-02'}];
 const b=registeredBalance([income],rows,[],'2026-11');assert.equal(b.reserve,80000);assert.equal(b.current,420000);assert.equal(b.total,500000);
});
test('the reserve cannot go negative and closed months are protected',async()=>{
 const db=await seed();
 await assert.rejects(spendFromReserve(db,'A',{descricao:'Viagem',valorCentavos:100001,data:'2026-11-03'}),/insuficiente/);
 await assert.rejects(spendFromReserve(db,'A',{descricao:'Antes',valorCentavos:100,data:'2026-09-30'}),/insuficiente/);
 await assert.rejects(spendFromReserve(db,'A',{descricao:' ',valorCentavos:100,data:'2026-11-03'}),/Informe/);
 await assert.rejects(spendFromReserve(db,'A',{descricao:'X',valorCentavos:0,data:'2026-11-03'}),/maior que zero/);
 await db.fechamentos.add({id:'A:2026-11',contaId:'A',mes:'2026-11',fechadoEm:'2026-12-01'});
 await assert.rejects(spendFromReserve(db,'A',{descricao:'Viagem',valorCentavos:100,data:'2026-11-03'}),/fechado/);
 assert.equal((await db.reservas.toArray()).length,1);
});
test('totals ignore spending before the start of control and other movements',()=>{
 const rows=[{descricao:'a',valorCentavos:-500,data:'2026-10-01',gasto:true as const},{descricao:'b',valorCentavos:-700,data:'2026-11-01',gasto:true as const},{descricao:'c',valorCentavos:-900,data:'2026-11-01'}];
 assert.equal(reserveSpent(rows,'2026-11-30'),1200);assert.equal(reserveSpent(rows,'2026-11-30','2026-10-15'),700);
 assert.equal(movesSpendable(rows[0]),false);assert.equal(movesSpendable(rows[2]),true);assert.equal(movesSpendable({emprestimoId:'x'}),false);
});
test('the forecast does not count reserve spending as available money',()=>{
 const rows=[{contaId:'A',descricao:'Guardado',valorCentavos:100000,data:'2026-10-01'},{contaId:'A',descricao:'Carro',valorCentavos:-30000,data:'2026-11-10',gasto:true as const}];
 const f=balanceForecast(account,[income],rows,[],'2026-11','2026-11-01');
 assert.equal(f.closing,400000);assert.equal(f.points.find(p=>p.date==='2026-11-10')?.balance,400000);
});
test('synchronized copies reject malformed reserve spending',()=>{
 const base={contas:[account],fechamentos:[],lancamentos:[],configuracoes:[],categorias:[],recorrencias:[],salarios:[]};
 assert.doesNotThrow(()=>validateSnapshot({...base,reservas:[{id:1,contaId:'A',descricao:'Carro',valorCentavos:-100,data:'2026-11-01',gasto:true}]}));
 assert.throws(()=>validateSnapshot({...base,reservas:[{id:1,contaId:'A',descricao:'Carro',valorCentavos:100,data:'2026-11-01',gasto:true}]}),/Gasto da reserva/);
 assert.throws(()=>validateSnapshot({...base,reservas:[{id:1,contaId:'A',descricao:'Carro',valorCentavos:-100,data:'2026-11-01',gasto:'sim'}]}),/Gasto da reserva/);
});
