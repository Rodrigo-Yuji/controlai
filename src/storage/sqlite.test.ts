import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteDatabase, type SqlDriver } from './sqlite.ts';
import { normalizeLegacy } from './migration.ts';
import type { Lancamento } from '../db.ts';
import type { LegacySnapshot } from './types.ts';

function driver(file = ':memory:') {
  const raw = new DatabaseSync(file);
  const api: SqlDriver = {
    all: async (sql, values = []) => raw.prepare(sql).all(...values),
    run: async (sql, values = []) => { const result = raw.prepare(sql).run(...values); return {changes:Number(result.changes), lastId:Number(result.lastInsertRowid)}; },
    begin: async () => { raw.exec('BEGIN IMMEDIATE'); },
    commit: async () => { raw.exec('COMMIT'); },
    rollback: async () => { raw.exec('ROLLBACK'); },
  };
  return {raw, api};
}
const entry = (description: string, contaId = 'A'): Lancamento => ({contaId, descricao:description, valorCentavos:1234, tipo:'despesa', natureza:'variavel', categoria:'Outros', data:'2026-11-04', status:'confirmado', observacao:'Detalhes'});
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 10));

test('SQLite persists all document fields, IDs, and account queries after reopening the file', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'controlai-sqlite-'));
  const file = join(folder, 'controlai.db');
  try {
    const first = driver(file); const db = createSqliteDatabase(async () => first.api);
    const a = await db.lancamentos.add({...entry('A'), parcela:{grupo:'compra',numero:1,total:3}});
    const savedTime=(await db.lancamentos.get(a))!.horario;
    assert.match(savedTime!,/^\d{2}:\d{2}$/);
    const b = await db.lancamentos.add(entry('B','B'));
    assert.notEqual(a,b);
    assert.equal((await db.lancamentos.where('contaId').equals('A').toArray()).length,1);
    first.raw.close();
    const second = driver(file); const restored = createSqliteDatabase(async () => second.api);
    assert.deepEqual(await restored.lancamentos.get(a), {...entry('A'), parcela:{grupo:'compra',numero:1,total:3},id:a,horario:savedTime});
    const c = await restored.lancamentos.add(entry('C'));
    assert.ok(c>b); second.raw.close();
  } finally { rmSync(folder,{recursive:true,force:true}); }
});
test('failed batches and backup replacement roll back every change', async () => {
  const {raw,api}=driver(); const db=createSqliteDatabase(async()=>api);
  await db.contas.add({id:'A',nome:'A',conjunta:false,padrao:true});
  await db.lancamentos.add({...entry('Original'),id:10});
  await assert.rejects(db.transaction([db.contas,db.lancamentos],async tx=>{
    await Promise.all([tx.contas.clear(),tx.lancamentos.clear()]);
    await tx.lancamentos.bulkAdd([{...entry('Nova'),id:1},{...entry('Duplicada'),id:1}]);
  }));
  assert.equal((await db.lancamentos.get(10))?.descricao,'Original');
  assert.equal(await db.contas.count(),1);
  await assert.rejects(db.lancamentos.bulkAdd([{...entry('Primeira'),id:20},{...entry('Duplicada'),id:10}]));
  assert.equal(await db.lancamentos.get(20),undefined); raw.close();
});
test('independent writes cannot join or be rolled back with another async transaction',async()=>{
  const {raw,api}=driver();const db=createSqliteDatabase(async()=>api);await db.initialize();
  let signal!:()=>void, release!:()=>void;
  const entered=new Promise<void>(resolve=>{signal=resolve});const resume=new Promise<void>(resolve=>{release=resolve});
  const transaction=db.transaction([db.lancamentos],async tx=>{await tx.lancamentos.add(entry('Reverter'));signal();await resume;throw Error('rollback')});
  await entered;
  const separate=db.lancamentos.add(entry('Preservar','B'));
  release();await assert.rejects(transaction,/rollback/);await separate;
  assert.deepEqual((await db.lancamentos.toArray()).map(row=>row.descricao),['Preservar']);raw.close();
});
test('commit notifications are reactive and rollback does not expose uncommitted data',async()=>{
  const {raw,api}=driver();const db=createSqliteDatabase(async()=>api);const values:number[]=[];
  const unsubscribe=db.subscribe(()=>db.lancamentos.count(),{next:value=>values.push(value),error:error=>{throw error}});
  await pause();assert.deepEqual(values,[0]);
  await assert.rejects(db.transaction([db.lancamentos],async tx=>{await tx.lancamentos.add(entry('Reverter'));throw Error('rollback')}));
  await pause();assert.deepEqual(values,[0]);
  await db.lancamentos.add(entry('Confirmado'));await pause();assert.deepEqual(values,[0,1]);
  unsubscribe();await db.lancamentos.add(entry('Sem assinatura'));await pause();assert.deepEqual(values,[0,1]);raw.close();
});
test('collection updates, cascaded account cleanup, and uniqueness are atomic',async()=>{
  const {raw,api}=driver();const db=createSqliteDatabase(async()=>api);
  await db.categorias.bulkAdd([{contaId:'A',nome:'Outros',tipo:'despesa',natureza:'variavel'},{contaId:'B',nome:'Outros',tipo:'despesa',natureza:'variavel'}]);
  await db.lancamentos.bulkAdd([entry('A'),entry('B','B')]);
  await db.lancamentos.filter(row=>row.contaId==='A').modify({observacao:'Nova observação'});
  assert.equal((await db.lancamentos.where('contaId').equals('B').first())?.observacao,'Detalhes');
  await assert.rejects(db.categorias.add({contaId:'A',nome:'Outros',tipo:'despesa',natureza:'variavel'}));
  await db.transaction([db.categorias,db.lancamentos],async tx=>{await Promise.all([tx.categorias.where('contaId').equals('A').delete(),tx.lancamentos.where('contaId').equals('A').delete()])});
  assert.equal(await db.lancamentos.count(),1);assert.equal(await db.categorias.count(),1);
  await assert.rejects(db.transaction([db.contas],tx=>tx.lancamentos.clear()),/fora da transação/);raw.close();
});
test('legacy import is atomic, idempotent and preserves the untouched source and raw archive',async()=>{
  const source:LegacySnapshot={version:5,tables:{contas:[{id:'A',nome:'A',conjunta:false,padrao:true}],lancamentos:[{...entry('Legado'),id:42}],fechamentos:[{id:'A:2026-11',contaId:'A',mes:'2026-11',fechadoEm:'2026-11-04T12:00:00Z'}]}};
  const before=JSON.stringify(source);let reads=0;const {raw,api}=driver();const loader=async()=>{reads++;return source};
  const db=createSqliteDatabase(async()=>api,loader);await db.initialize();
  assert.equal((await db.lancamentos.get(42))?.valorCentavos,1234);assert.equal(await db.fechamentos.count(),1);
  assert.equal(JSON.stringify(source),before);
  assert.equal(JSON.parse(String(raw.prepare('SELECT value FROM storage_meta WHERE key=?').get('indexeddb_archive')?.value)).tables.lancamentos[0].id,42);
  const again=createSqliteDatabase(async()=>api,loader);await again.initialize();assert.equal(reads,1);assert.equal(await again.lancamentos.count(),1);raw.close();
});
test('failed legacy import does not mark completion or leave partial data; retry succeeds',async()=>{
  const source:LegacySnapshot={version:5,tables:{contas:[{id:'A',nome:'A',conjunta:false,padrao:true}],lancamentos:[{...entry('1'),id:1},{...entry('2'),id:1}]}};
  const {raw,api}=driver();const db=createSqliteDatabase(async()=>api,async()=>source);
  await assert.rejects(db.initialize());
  assert.equal(raw.prepare('SELECT COUNT(*) AS total FROM lancamentos').get()?.total,0);
  assert.equal(raw.prepare('SELECT COUNT(*) AS total FROM storage_meta').get()?.total,0);
  source.tables.lancamentos.pop();await db.initialize();assert.equal(await db.lancamentos.count(),1);raw.close();
});
test('v1 data keeps category names, values and unknown historical tables in the archive',async()=>{
  const source:LegacySnapshot={version:1,tables:{categorias:[{id:42,nome:'Personalizada',tipo:'despesa'}],lancamentos:[{id:1,descricao:'Antigo',valor:'12,34',categoriaId:42,tipo:'despesa',natureza:'variavel',data:'2025-01-01',status:'confirmado'}],orcamentos:[{id:7,valor:100}]}};
  const normalized=normalizeLegacy(source);
  assert.equal(normalized.lancamentos[0].categoria,'Personalizada');assert.equal(normalized.lancamentos[0].valorCentavos,1234);assert.equal(normalized.lancamentos[0].contaId,'principal');
  const {raw,api}=driver();const db=createSqliteDatabase(async()=>api,async()=>source);await db.initialize();
  const archive=JSON.parse(String(raw.prepare('SELECT value FROM storage_meta WHERE key=?').get('indexeddb_archive')?.value));assert.deepEqual(archive.tables.orcamentos,[{id:7,valor:100}]);raw.close();
});
test('newer SQLite schemas are never downgraded',async()=>{
  const {raw,api}=driver();raw.exec('PRAGMA user_version=2');const db=createSqliteDatabase(async()=>api);await assert.rejects(db.initialize(),/mais recente/);assert.equal(raw.prepare('PRAGMA user_version').get()?.user_version,2);raw.close();
});
test('SQLite rejects fractional and unsafe monetary values without changing existing records',async()=>{
  const {raw,api}=driver();const db=createSqliteDatabase(async()=>api);await db.lancamentos.add(entry('Correto'));
  for(const valorCentavos of [12.34,Number.MAX_SAFE_INTEGER+1,NaN]) await assert.rejects(db.lancamentos.add({...entry('Inválido'),valorCentavos}),/centavos/);
  assert.equal(await db.lancamentos.count(),1);raw.close();
});
test('existing SQLite data does not depend on opening legacy browser storage',async()=>{
  const {raw,api}=driver();const first=createSqliteDatabase(async()=>api);await first.lancamentos.add(entry('SQLite existente'));
  raw.exec("DELETE FROM storage_meta WHERE key='indexeddb_migration'");
  const next=createSqliteDatabase(async()=>api,async()=>{throw Error('IndexedDB indisponível')});
  await next.initialize();assert.equal((await next.lancamentos.toArray())[0].descricao,'SQLite existente');raw.close();
});
