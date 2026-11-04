import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import type { SqlDriver, SqlValue } from './sqlite';

let opening: Promise<SqlDriver> | undefined;
export function openNativeSqlite(): Promise<SqlDriver> {
  if (!opening) opening = (async () => {
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const consistent = await sqlite.checkConnectionsConsistency();
    const exists = await sqlite.isConnection('controlai', false);
    const connection = consistent.result && exists.result
      ? await sqlite.retrieveConnection('controlai', false)
      : await sqlite.createConnection('controlai', false, 'no-encryption', 1, false);
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
  })().catch(error => { opening = undefined; throw error; });
  return opening;
}
