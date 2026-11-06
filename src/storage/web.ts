import {readTables,snapshotKey,validateSnapshot,writeTables} from '../sync/snapshot';
import Dexie, { liveQuery, type Collection as DexieCollection, type Table, type UpdateSpec } from 'dexie';
import { LegacyDatabase } from './legacy';
import { TABLE_NAMES, type Collection, type Database, type LegacySnapshot, type StorageTable, type Tables } from './types';

function collection<T, K>(source: DexieCollection<T, K>): Collection<T> {
  return {
    toArray: () => source.toArray(), first: () => source.first(), count: () => source.count(),
    modify: changes => typeof changes === 'function' ? source.modify(changes) : source.modify(changes as UpdateSpec<T>),
    delete: () => source.delete(),
  };
}
function table<T, K>(source: Table<T, K>): StorageTable<T, K> {
  return {
    name: source.name as StorageTable<T, K>['name'],
    toArray: () => source.toArray(), get: id => source.get(id), count: () => source.count(),
    add: row => source.add(row), put: row => source.put(row), bulkAdd: rows => source.bulkAdd([...rows]),
    bulkDelete: ids => source.bulkDelete([...ids]), update: (id, changes) => source.update(id, changes as UpdateSpec<T>),
    delete: id => source.delete(id), clear: () => source.clear(),
    where: index => ({ equals: value => collection(source.where(index).equals(value as string | number)) }),
    filter: predicate => collection(source.filter(predicate)), toCollection: () => collection(source.toCollection()),
  };
}
export function createWebDatabase(): Database {
  const source = new LegacyDatabase();
  const tables = Object.fromEntries(TABLE_NAMES.map(name => [name, table(source.table(name))])) as Tables;
  return {
    ...tables, kind:'indexeddb', tables:Object.values(tables),
    initialize: async () => { await source.open(); },
    // Native async scope preserves Dexie context across nested transaction helpers.
    transaction: (refs, work) => source.transaction('rw', refs.map(ref => source.table(ref.name)), async () => await work(tables)),
    snapshot:()=>source.transaction('r',TABLE_NAMES.map(name=>source.table(name)),()=>readTables(tables)),
    getLocalState:async key=>(await source.table('localstate').get(key))?.value,
    setLocalState:async(key,value)=>{await source.table('localstate').put({key,value});},
    applySnapshot:async(expected,next,stateKey,state)=>{
      validateSnapshot(next);
      return source.transaction('rw',[...TABLE_NAMES.map(name=>source.table(name)),source.table('localstate')],async()=>{
        if(snapshotKey(await readTables(tables))!==expected)return false;
        await writeTables(tables,next);await source.table('localstate').put({key:stateKey,value:state});return true;
      });
    },
    subscribe(query, observer) {
      const subscription = liveQuery(query).subscribe(observer);
      return () => subscription.unsubscribe();
    },
  };
}

// Open the existing schema dynamically: inspecting a native WebView's old data must
// not trigger the web app's historical upgrades or delete legacy object stores.
export async function readLegacySnapshot(): Promise<LegacySnapshot | undefined> {
  if (typeof indexedDB === 'undefined' || !await Dexie.exists('ControlAI')) return undefined;
  const source = new Dexie('ControlAI');
  try {
    await source.open();
    return await source.transaction('r', source.tables, async () => ({
      version:source.verno,
      tables:Object.fromEntries(await Promise.all(source.tables.map(async item => [item.name, await item.toArray()]))),
    }));
  } finally { source.close(); }
}
