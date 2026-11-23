import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createSqliteDatabase,type SqlDriver} from './storage/sqlite.ts';
import {registeredBalance} from './account-balance.ts';
import {validateSnapshot} from './sync/snapshot.ts';
import {movesSpendable,spendFromReserve} from './reserve-spending.ts';
import {separateBoxIds,boxBalance,moveReserve,removeBox,removeReserveRow,saveBox,validateBoxes} from './reserve-boxes.ts';
import {lendFromReserve,registerLoanRepayment,setLoanBox} from './reserve-loans.ts';
import type {Conta,Lancamento} from './db.ts';
function device(){const raw=new DatabaseSync(':memory:');const driver:SqlDriver={all:async(sql,v=[])=>raw.prepare(sql).all(...v),run:async(sql,v=[])=>{const r=raw.prepare(sql).run(...v);return {changes:Number(r.changes),lastId:Number(r.lastInsertRowid)};},begin:async()=>{raw.exec('BEGIN IMMEDIATE');},commit:async()=>{raw.exec('COMMIT');},rollback:async()=>{raw.exec('ROLLBACK');}};return createSqliteDatabase(async()=>driver);}
const ids=()=>{let n=0;return ()=>`id${++n}`;};
const income:Lancamento={contaId:'A',descricao:'Salário',valorCentavos:500000,tipo:'receita',natureza:'fixo',categoria:'Salário',data:'2026-10-05',status:'confirmado'};
async function seed(){
 const db=device();await db.contas.add({id:'A',nome:'Casal',padrao:true,conjunta:true,tipo:'casal'});
 await db.reservas.add({contaId:'A',descricao:'Guardado',valorCentavos:100000,data:'2026-10-06'});
 return db;
}
const balance=async(db:Awaited<ReturnType<typeof seed>>)=>{const a=(await db.contas.get('A'))!;return registeredBalance([income],await db.reservas.toArray(),[],'2026-12',undefined,a.emprestimosReserva??[]);};

test('caixinhas are created, renamed and only deleted when empty',async()=>{
 const db=await seed(),next=ids();
 const trip=await saveBox(db,'A',{nome:'  Viagem  ',metaCentavos:300000},undefined,next);
 assert.deepEqual(trip,{id:'id1',nome:'Viagem',metaCentavos:300000});
 await assert.rejects(()=>saveBox(db,'A',{nome:'viagem'},undefined,next),/mesmo nome|esse nome/);
 await assert.rejects(()=>saveBox(db,'A',{nome:'Reserva principal'},undefined,next),/esse nome/);
 await saveBox(db,'A',{nome:'Viagem Europa'},trip.id);
 assert.deepEqual((await db.contas.get('A'))!.caixinhas,[{id:'id1',nome:'Viagem Europa'}]);
 await moveReserve(db,'A',{caixinhaId:trip.id,operacao:'deposito',descricao:'Guardar',valorCentavos:1000,data:'2026-11-01'});
 await assert.rejects(()=>removeBox(db,'A',trip.id),/movimentos/);
 const row=(await db.reservas.toArray()).find(r=>r.caixinhaId===trip.id)!;await removeReserveRow(db,'A',row.id!);
 await removeBox(db,'A',trip.id);assert.deepEqual((await db.contas.get('A'))!.caixinhas,[]);
});
test('each reserve keeps its own balance and never goes negative',async()=>{
 const db=await seed(),trip=await saveBox(db,'A',{nome:'Viagem'},undefined,ids());
 await moveReserve(db,'A',{caixinhaId:trip.id,operacao:'deposito',descricao:'Guardar',valorCentavos:20000,data:'2026-11-01'});
 const before=await balance(db);
 await assert.rejects(()=>moveReserve(db,'A',{caixinhaId:trip.id,operacao:'retirada',descricao:'Resgate',valorCentavos:20001,data:'2026-11-02'}),/insuficiente/);
 await assert.rejects(()=>spendFromReserve(db,'A',{descricao:'Hotel',valorCentavos:30000,data:'2026-11-02',caixinhaId:trip.id}),/insuficiente/);
 await spendFromReserve(db,'A',{descricao:'Hotel',valorCentavos:15000,data:'2026-11-02',caixinhaId:trip.id});
 const rows=await db.reservas.toArray();assert.equal(boxBalance(rows,trip.id),5000);assert.equal(boxBalance(rows,''),100000);
 const after=await balance(db);assert.equal(after.current,before.current);assert.equal(after.total,before.total-15000);
 const deposit=rows.find(r=>r.caixinhaId===trip.id&&r.valorCentavos===20000)!;
 await assert.rejects(()=>removeReserveRow(db,'A',deposit.id!),/negativa/);
});
test('implantação adds saved money to the reserve and the total, not to the spendable balance',async()=>{
 const db=await seed(),trip=await saveBox(db,'A',{nome:'Viagem'},undefined,ids());
 const before=await balance(db);
 const row=await moveReserve(db,'A',{caixinhaId:trip.id,operacao:'implantacao',descricao:'Saldo da caixinha do banco',valorCentavos:250000,data:'2026-11-01'});
 assert.equal(row.implantacao,true);assert.equal(movesSpendable(row),false);
 const after=await balance(db);
 assert.equal(after.current,before.current);assert.equal(after.reserve,before.reserve+250000);assert.equal(after.total,before.total+250000);
});
test('a loan from a caixinha leaves it and its repayments go back to it',async()=>{
 const db=await seed(),next=ids(),trip=await saveBox(db,'A',{nome:'Viagem'},undefined,next);
 await moveReserve(db,'A',{caixinhaId:trip.id,operacao:'deposito',descricao:'Guardar',valorCentavos:50000,data:'2026-11-01'});
 await assert.rejects(()=>lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:60000,data:'2026-11-02',caixinhaId:trip.id},next),/insuficiente/);
 const loan=await lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:30000,data:'2026-11-02',caixinhaId:trip.id},next);
 assert.equal(loan.caixinhaId,trip.id);
 await registerLoanRepayment(db,'A',loan.id,{valorCentavos:10000,data:'2026-11-10'},next);
 let rows=await db.reservas.toArray();assert.equal(boxBalance(rows,trip.id),30000);assert.equal(boxBalance(rows,''),100000);
 await assert.rejects(()=>removeBox(db,'A',trip.id),/movimentos|empréstimos/);
 await setLoanBox(db,'A',loan.id,'');
 rows=await db.reservas.toArray();assert.equal(boxBalance(rows,trip.id),50000);assert.equal(boxBalance(rows,''),80000);
 assert.equal((await db.contas.get('A'))!.emprestimosReserva![0].caixinhaId,undefined);
});
test('older loans without a caixinha keep using the main reserve',async()=>{
 const db=await seed(),loan=await lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:30000,data:'2026-11-02'},ids());
 assert.equal(loan.caixinhaId,undefined);assert.equal(boxBalance(await db.reservas.toArray(),''),70000);
});
test('synchronized copies check caixinhas and their movements',async()=>{
 const account:Conta={id:'A',nome:'Casal',padrao:true,conjunta:true,tipo:'casal',caixinhas:[{id:'c1',nome:'Viagem'}]};
 const base={fechamentos:[],lancamentos:[],configuracoes:[],categorias:[],recorrencias:[],salarios:[]};
 const row={id:1,contaId:'A',descricao:'Saldo',valorCentavos:1000,data:'2026-11-01',caixinhaId:'c1',implantacao:true as const};
 assert.doesNotThrow(()=>validateSnapshot({...base,contas:[account],reservas:[row]}));
 assert.throws(()=>validateSnapshot({...base,contas:[{...account,caixinhas:[]}],reservas:[row]}),/caixinha inexistente/);
 assert.throws(()=>validateSnapshot({...base,contas:[account],reservas:[{...row,valorCentavos:-1000}]}),/Implantação/);
 assert.throws(()=>validateBoxes({...account,caixinhas:[{id:'c1',nome:'Viagem'},{id:'c2',nome:'VIAGEM'}]}),/esse nome/);
 assert.throws(()=>validateSnapshot({...base,contas:[{...account,emprestimosReserva:[{id:'L',pessoa:'Ana',data:'2026-11-01',valorCentavos:100,devolucoes:[],caixinhaId:'x'}]}],reservas:[]}),/Caixinha do empréstimo/);
});

test('a caixinha kept apart counts in neither the reserve nor the total',async()=>{
 const db=await seed(),next=ids(),own=await saveBox(db,'A',{nome:'Meu dinheiro',foraDaReserva:true},undefined,next);
 const sep=async()=>{const a=(await db.contas.get('A'))!;return registeredBalance([income],await db.reservas.toArray(),[],'2026-12',undefined,a.emprestimosReserva??[],separateBoxIds(a));};
 assert.equal((await db.contas.get('A'))!.caixinhas![0].foraDaReserva,true);
 const before=await sep();
 await moveReserve(db,'A',{caixinhaId:own.id,operacao:'implantacao',descricao:'Economias',valorCentavos:900000,data:'2026-11-01'});
 assert.deepEqual(await sep(),before);
 await moveReserve(db,'A',{caixinhaId:own.id,operacao:'deposito',descricao:'Guardar',valorCentavos:10000,data:'2026-11-02'});
 let b=await sep();assert.equal(b.current,before.current-10000);assert.equal(b.reserve,before.reserve);assert.equal(b.total,before.total-10000);
 await moveReserve(db,'A',{caixinhaId:own.id,operacao:'retirada',descricao:'Resgate',valorCentavos:30000,data:'2026-11-03'});
 b=await sep();assert.equal(b.current,before.current+20000);assert.equal(b.total,before.total+20000);
 await spendFromReserve(db,'A',{descricao:'Presente',valorCentavos:5000,data:'2026-11-04',caixinhaId:own.id});
 await lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:7000,data:'2026-11-04',caixinhaId:own.id},next);
 assert.deepEqual(await sep(),b);
 await saveBox(db,'A',{nome:'Meu dinheiro'},own.id);assert.equal((await db.contas.get('A'))!.caixinhas![0].foraDaReserva,undefined);
 assert.throws(()=>validateBoxes({id:'A',nome:'C',padrao:true,conjunta:true,caixinhas:[{id:'x',nome:'X',foraDaReserva:'sim' as unknown as true}]}),/fora da reserva/);
});
