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
