import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createSqliteDatabase,type SqlDriver} from '../storage/sqlite.ts';
import {SyncEngine,type Transport} from './engine.ts';
import {snapshotKey,validateSnapshot,type Snapshot} from './snapshot.ts';
import {validateConfig} from './client.ts';
function device(){const raw=new DatabaseSync(':memory:');const driver:SqlDriver={all:async(sql,v=[])=>raw.prepare(sql).all(...v),run:async(sql,v=[])=>{const r=raw.prepare(sql).run(...v);return {changes:Number(r.changes),lastId:Number(r.lastInsertRowid)};},begin:async()=>{raw.exec('BEGIN IMMEDIATE');},commit:async()=>{raw.exec('COMMIT');},rollback:async()=>{raw.exec('ROLLBACK');}};return createSqliteDatabase(async()=>driver);}
const entry=(description:string)=>({contaId:'A',descricao:description,valorCentavos:1234,tipo:'despesa' as const,natureza:'variavel' as const,categoria:'Outros',status:'confirmado' as const,data:'2026-11-05'});
async function seed(db:ReturnType<typeof device>){await db.contas.add({id:'A',nome:'A',padrao:true,conjunta:false});await db.lancamentos.add(entry('Original'));}
function cloud(){let vault:{revision:number;snapshot:Snapshot}|null=null;let fail=false;const remote:Transport={revision:async()=>{if(fail)throw Error('offline');return vault?.revision??0;},read:async()=>vault?structuredClone(vault):null,push:async(expected,snapshot)=>{if(fail)throw Error('offline');if((vault?.revision??0)!==expected)throw Error('SYNC_CONFLICT');vault={revision:expected+1,snapshot:structuredClone(snapshot)};return vault.revision;}};return {remote,offline:(value:boolean)=>{fail=value;},vault:()=>structuredClone(vault)};}
test('first connection is explicit; two devices exchange edits without duplicate numeric IDs',async()=>{
 const a=device(),b=device(),server=cloud();await seed(a);const x=new SyncEngine(a,server.remote,'project:user');const y=new SyncEngine(b,server.remote,'project:user');
 assert.equal((await x.step()).kind,'choose');assert.equal(server.vault(),null);await x.connect('local');await y.connect('cloud');assert.equal(snapshotKey(await a.snapshot()),snapshotKey(await b.snapshot()));
 await b.lancamentos.add(entry('Computador'));await y.step();await x.step();assert.equal(await a.lancamentos.count(),2);await a.lancamentos.add(entry('Celular'));await x.step();await y.step();assert.equal(await b.lancamentos.count(),3);
});
test('simultaneous offline edits pause synchronization and preserve both snapshots',async()=>{
 const a=device(),b=device(),server=cloud();await seed(a);const x=new SyncEngine(a,server.remote,'owner'),y=new SyncEngine(b,server.remote,'owner');await x.connect('local');await y.connect('cloud');await a.lancamentos.add(entry('Phone'));await b.lancamentos.add(entry('PC'));await x.step();const before=snapshotKey(await b.snapshot());assert.equal((await y.step()).kind,'conflict');assert.equal(snapshotKey(await b.snapshot()),before);const recovery=await b.getLocalState('sync.recovery') as {local:Snapshot;cloud:{snapshot:Snapshot}};assert.equal(recovery.local.lancamentos[1].descricao,'PC');assert.equal(recovery.cloud.snapshot.lancamentos[1].descricao,'Phone');
});
test('local compare-and-replace rejects edits made while a download was in flight',async()=>{
 const db=device();await seed(db);const before=await db.snapshot();await db.lancamentos.add(entry('New'));assert.equal(await db.applySnapshot(snapshotKey(before),before,'binding',{}),false);assert.equal(await db.lancamentos.count(),2);assert.equal(await db.getLocalState('binding'),undefined);
});
test('local edits made during upload are retained for the next synchronization',async()=>{
 const db=device(),server=cloud();await seed(db);const engine=new SyncEngine(db,server.remote,'owner');await engine.connect('local');await db.lancamentos.add(entry('Upload'));const push=server.remote.push;server.remote.push=async(revision,snapshot)=>{await db.lancamentos.add(entry('During upload'));server.remote.push=push;return push(revision,snapshot);};await engine.step();assert.equal(await db.lancamentos.count(),3);await engine.step();assert.equal(server.vault()?.snapshot.lancamentos.length,3);
});
test('offline writes survive and changing authenticated owner never auto-uploads them',async()=>{
 const db=device(),server=cloud();await seed(db);const engine=new SyncEngine(db,server.remote,'user1');await engine.connect('local');server.offline(true);await db.lancamentos.add(entry('Offline'));await assert.rejects(engine.step(),/offline/);assert.equal(await db.lancamentos.count(),2);server.offline(false);assert.equal((await new SyncEngine(db,server.remote,'user2').step()).kind,'choose');assert.equal(server.vault()?.snapshot.lancamentos.length,1);await engine.step();assert.equal(server.vault()?.snapshot.lancamentos.length,2);
});
test('invalid remote snapshots and atomic replacement failures preserve data and metadata',async()=>{
 const db=device();await seed(db);const before=await db.snapshot();const invalid=structuredClone(before);invalid.lancamentos[0].valorCentavos=1.5;await assert.rejects(db.applySnapshot(snapshotKey(before),invalid,'binding',{new:true}),/monetário/);assert.equal(snapshotKey(await db.snapshot()),snapshotKey(before));assert.equal(await db.getLocalState('binding'),undefined);assert.throws(()=>validateSnapshot({...before,contas:[]}),/Conta/);
});
test('private sessions are local metadata, excluded from sync snapshots and financial backups',async()=>{
 const db=device();await seed(db);await db.setLocalState('session',{token:'private-test'});assert.equal(JSON.stringify(await db.snapshot()).includes('private-test'),false);assert.deepEqual(await db.getLocalState('session'),{token:'private-test'});
});
test('accepts only project URLs and public keys; rejects secret and service_role keys',()=>{
 assert.deepEqual(validateConfig({url:'https://project.supabase.co/',key:'sb_publishable_test'}),{url:'https://project.supabase.co',key:'sb_publishable_test'});assert.throws(()=>validateConfig({url:'https://evil.example',key:'sb_publishable_test'}));assert.throws(()=>validateConfig({url:'https://project.supabase.co',key:'sb_secret_test'}));const key='x.'+btoa(JSON.stringify({role:'service_role'}))+'.y';assert.throws(()=>validateConfig({url:'https://project.supabase.co',key}));
});

test('optional undefined properties use the same fingerprint before and after JSON transport',async()=>{
 const db=device();await seed(db);const snapshot=await db.snapshot();snapshot.lancamentos[0].observacao=undefined;assert.equal(snapshotKey(snapshot),snapshotKey(validateSnapshot(snapshot)));
});

test('replacement rolls back financial changes when saving synchronization metadata fails',async()=>{
 const db=device();await seed(db);const before=await db.snapshot();const next=structuredClone(before);next.lancamentos[0].descricao='Must roll back';const circular:{self?:unknown}={};circular.self=circular;await assert.rejects(db.applySnapshot(snapshotKey(before),next,'binding',circular),/circular/i);assert.equal(snapshotKey(await db.snapshot()),snapshotKey(before));assert.equal(await db.getLocalState('binding'),undefined);
});

test('cards, management people, market items and payment links survive SQLite and cloud transfer',async()=>{
 const a=device(),b=device(),server=cloud();await seed(a);await a.contas.update('A',{tipo:'gestora',pessoas:[{id:'Ana',nome:'Ana',inicioMes:'2026-11',contribuicoes:[{desde:'2026-11',valorCentavos:50000}]}],cartoes:[{id:'C',nome:'Gestão',fechamento:25,vencimento:5}],mercados:[{id:'M',descricao:'Mercado',data:'2026-11-05',cartaoId:'C',totalCentavos:10000,itens:[{id:'i',descricao:'Item Ana',pessoaId:'Ana',valorCentavos:2000}]}]});await a.lancamentos.update(1,{valorCentavos:10000,cartaoId:'C',faturaMes:'2026-12',gestao:{tipo:'compraMercado',compraId:'M'}});await a.lancamentos.add({...entry('Parte do reembolso'),tipo:'receita',valorCentavos:500,gestao:{tipo:'reembolsoMercado',compraId:'M',pessoaId:'Ana'}});const x=new SyncEngine(a,server.remote,'owner'),y=new SyncEngine(b,server.remote,'owner');await x.connect('local');await y.connect('cloud');assert.equal(snapshotKey(await a.snapshot()),snapshotKey(await b.snapshot()));assert.equal((await b.contas.get('A'))?.mercados?.[0].itens[0].valorCentavos,2000);assert.equal((await b.lancamentos.get(2))?.gestao?.tipo,'reembolsoMercado');
});

test('Gestora label upgrade preserves actual advance date, reference and other accounts',async()=>{
 const {normalizeGestoraCategories,managementEntryMonth}=await import('../gestora-upgrade.ts');const db=device();await db.contas.bulkAdd([{id:'A',nome:'Casa',tipo:'gestora',conjunta:false,padrao:true,pessoas:[{id:'P',nome:'Pessoa',inicioMes:'2026-11',contribuicoes:[{desde:'2026-11',valorCentavos:50000}]}]},{id:'B',nome:'Solo',conjunta:false,padrao:false}]);await db.categorias.bulkAdd([{contaId:'A',nome:'Contribuições',tipo:'receita',natureza:'fixo'},{contaId:'B',nome:'Contribuições',tipo:'receita',natureza:'variavel'}]);const id=await db.lancamentos.add({...entry('Adiantamento'),tipo:'receita',categoria:'Contribuições',valorCentavos:10000,data:'2026-10-30',status:'confirmado',gestao:{tipo:'contribuicao',pessoaId:'P',mesReferencia:'2026-11'}});await normalizeGestoraCategories(db,'A');const paid=await db.lancamentos.get(id);assert.equal(paid?.data,'2026-10-30');assert.equal(paid?.valorCentavos,10000);assert.equal(paid?.categoria,'Contribuição');assert.equal(managementEntryMonth(paid!),'2026-11');assert.equal((await db.categorias.where('contaId').equals('B').toArray())[0].nome,'Contribuições');const before=snapshotKey(await db.snapshot());await normalizeGestoraCategories(db,'A');assert.equal(snapshotKey(await db.snapshot()),before);
});
test('new Gestora market purchases do not require a credit card',async()=>{
 const db=device();await db.contas.add({id:'A',nome:'Casa',tipo:'gestora',conjunta:false,padrao:true,mercados:[{id:'M',descricao:'Mercado',data:'2026-11-05',totalCentavos:10000,itens:[]}]});await db.lancamentos.add({...entry('Mercado'),valorCentavos:10000,categoria:'Mercado',gestao:{tipo:'compraMercado',compraId:'M'}});validateSnapshot(await db.snapshot());assert.equal((await db.contas.get('A'))?.mercados?.[0].cartaoId,undefined);
});

test('couple releases and partial transfers persist through SQLite snapshots and two-device sync',async()=>{
 const a=device(),b=device(),server=cloud();await seed(a);await a.contas.update('A',{tipo:'casal',conjunta:true,percentualPessoalCasal:6000,distribuicoesCasal:[{mes:'2026-11',totalCentavos:200000,comumCentavos:80000,pessoais:[60000,60000],percentualPessoal:6000,confirmadaEm:'2026-11-05'}],transferenciasPessoais:[{id:'T',titular:1,data:'2026-11-05',valorCentavos:10000}]});const x=new SyncEngine(a,server.remote,'owner'),y=new SyncEngine(b,server.remote,'owner');await x.connect('local');await y.connect('cloud');assert.deepEqual((await b.contas.get('A'))?.distribuicoesCasal,(await a.contas.get('A'))?.distribuicoesCasal);assert.deepEqual((await b.contas.get('A'))?.transferenciasPessoais,(await a.contas.get('A'))?.transferenciasPessoais);assert.equal((await b.contas.get('A'))?.percentualPessoalCasal,6000);assert.equal(await b.lancamentos.count(),1);const invalid=await a.snapshot();invalid.contas[0].transferenciasPessoais![0].valorCentavos=60001;assert.throws(()=>validateSnapshot(invalid),/ultrapassa/);
});
