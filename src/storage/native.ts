import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import type { SqlDriver, SqlValue } from './sqlite';

const sqlite=new SQLiteConnection(CapacitorSQLite);
const openings=new Map<string,Promise<SqlDriver>>();
export function openNativeSqlite(name='controlai'): Promise<SqlDriver> {
  if (!/^[a-zA-Z0-9_]+$/.test(name))throw Error('Nome de banco inválido.');
  let opening=openings.get(name);
  if (!opening) {opening = (async () => {
    const consistent = await sqlite.checkConnectionsConsistency();
    const exists = await sqlite.isConnection(name, false);
    const connection = consistent.result && exists.result
      ? await sqlite.retrieveConnection(name, false)
      : await sqlite.createConnection(name, false, 'no-encryption', 1, false);
    if (!(await connection.isDBOpen()).result) await connection.open();
    return {
      all: async (sql: string, values: SqlValue[] = []) => (await connection.query(sql, values)).values ?? [],
      run: async (sql: string, values: SqlValue[] = []) => {
        const result = await connection.run(sql, values, false);
        return {changes:result.changes?.changes ?? 0, lastId:result.changes?.lastId};
      },
      begin: async () => { await connection.beginTransaction(); },
      commit: async () => { await connection.commitTransaction(); },
      rollback: async () => { await connection.rollbackTransaction(); },
    };
  })().catch(error => { openings.delete(name); throw error; });
  openings.set(name,opening);}
  return opening;
}
