import { NUMERIC_TABLES, TABLE_NAMES, type Collection, type Database, type Key, type LegacySnapshot, type Records, type StorageTable, type TableName, type TableRef, type Tables } from './types.ts';
import { normalizeLegacy } from './migration.ts';

export type SqlValue = string | number | null;
export interface SqlDriver {
  all(sql: string, values?: SqlValue[]): Promise<Record<string, unknown>[]>;
  run(sql: string, values?: SqlValue[]): Promise<{changes: number; lastId?: number}>;
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
type Document = {id?: string | number; contaId?: string; tipo?: string; nome?: string};
type Access = <T>(name: TableName, write: boolean, work: (session: Session) => Promise<T>) => Promise<T>;
const identifier = (name: TableName) => {
  if (!TABLE_NAMES.includes(name)) throw new Error('Tabela desconhecida.');
  return `"${name}"`;
};

class Session {
  private queue: Promise<unknown> = Promise.resolve();
  private failure: unknown;
  private sealed = false;
  constructor(privateDriver: SqlDriver) { this.driver = privateDriver; }
  private driver: SqlDriver;
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.sealed) return Promise.reject(new Error('A transação já foi encerrada.'));
    const task = this.queue.then(() => {
      if (this.failure) throw this.failure;
      return operation();
    });
    this.queue = task.catch(error => { this.failure = error; });
    return task;
  }
  all(sql: string, values: SqlValue[] = []) { return this.enqueue(() => this.driver.all(sql, values)); }
  run(sql: string, values: SqlValue[] = []) { return this.enqueue(() => this.driver.run(sql, values)); }
  seal() { this.sealed = true; }
  async drain() { await this.queue; if (this.failure) throw this.failure; }
}

function makeTable<N extends TableName>(name: N, access: Access): StorageTable<Records[N], Key<N>> {
  const numeric = NUMERIC_TABLES.includes(name);
  const decode = (row: Record<string, unknown>): Records[N] => ({...JSON.parse(String(row.payload)), id:row.id});
  const get = async (session: Session, id: Key<N>) => {
    const rows = await session.all(`SELECT id, payload FROM ${identifier(name)} WHERE id = ?`, [id]);
    return rows[0] ? decode(rows[0]) : undefined;
  };
  const insert = async (session: Session, value: Records[N], replace: boolean): Promise<Key<N>> => {
    const row = value as Document;
    if (!numeric && (typeof row.id !== 'string' || !row.id)) throw new Error(`ID inválido em ${name}.`);
    if (numeric && row.id !== undefined && (typeof row.id !== 'number' || !Number.isSafeInteger(row.id))) throw new Error(`ID inválido em ${name}.`);
    const financial = value as unknown as Record<string, unknown>;
    const moneyFields = name === 'salarios' ? ['liquido','refeicao','beneficio','adicional'] : ['lancamentos','reservas','recorrencias'].includes(name) ? ['valorCentavos'] : [];
    if (moneyFields.some(field => !Number.isSafeInteger(financial[field]))) throw new Error('Os valores financeiros devem ser centavos inteiros seguros.');
    const payload = JSON.stringify(value, (_key, item) => {
      if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('O registro contém um número inválido.');
      return item;
    });
    if (!payload) throw new Error('Registro inválido.');
    const columns = name === 'categorias' ? 'id, conta_id, tipo, nome, payload' : 'id, conta_id, payload';
    const values: SqlValue[] = [row.id ?? null, row.contaId ?? null];
    if (name === 'categorias') values.push(row.tipo ?? null, row.nome ?? null);
    values.push(payload);
    // UPSERT updates in place; INSERT OR REPLACE could delete existing records.
    const conflict = replace && row.id !== undefined ? ` ON CONFLICT(id) DO UPDATE SET conta_id=excluded.conta_id, ${name === 'categorias' ? 'tipo=excluded.tipo, nome=excluded.nome, ' : ''}payload=excluded.payload` : '';
    const result = await session.run(`INSERT INTO ${identifier(name)} (${columns}) VALUES (${values.map(() => '?').join(',')})${conflict}`, values);
    const id = row.id ?? result.lastId;
    if (id === undefined) throw new Error('O SQLite não retornou o ID do registro.');
    return id as Key<N>;
  };
  const update = async (session: Session, id: Key<N>, changes: Partial<Records[N]>) => {
    const old = await get(session, id);
    if (!old) return 0;
    if (changes.id !== undefined && changes.id !== id) throw new Error('Não é permitido trocar a chave de um registro.');
    await insert(session, {...old, ...changes, id} as Records[N], true);
    return 1;
  };
  function collection(predicate?: (row: Records[N]) => boolean, indexed?: {column: string; value: SqlValue}): Collection<Records[N]> {
    const read = async (session: Session) => {
      const rows = await session.all(`SELECT id, payload FROM ${identifier(name)}${indexed ? ` WHERE ${indexed.column} = ?` : ''} ORDER BY id`, indexed ? [indexed.value] : []);
      const decoded = rows.map(decode);
      return predicate ? decoded.filter(predicate) : decoded;
    };
    return {
      toArray: () => access(name, false, read),
      first: () => access(name, false, async session => (await read(session))[0]),
      count: () => access(name, false, async session => (await read(session)).length),
      modify: changes => access(name, true, async session => {
        const rows = await read(session);
        for (const row of rows) {
          const changed = {...row};
          if (typeof changes === 'function') changes(changed);
          else Object.assign(changed, changes);
          if (changed.id !== row.id) throw new Error('Não é permitido trocar a chave de um registro.');
          await insert(session, changed, true);
        }
        return rows.length;
      }),
      delete: () => access(name, true, async session => {
        const rows = await read(session);
        for (const row of rows) await session.run(`DELETE FROM ${identifier(name)} WHERE id = ?`, [row.id!]);
        return rows.length;
      }),
    };
  }
  return {
    name, toArray: () => collection().toArray(), get: id => access(name, false, session => get(session, id)),
    count: () => access(name, false, async session => Number((await session.all(`SELECT COUNT(*) AS total FROM ${identifier(name)}`))[0].total)),
    add: value => access(name, true, session => insert(session, value, false)),
    put: value => access(name, true, session => insert(session, value, true)),
    bulkAdd: values => access(name, true, async session => {
      let id: Key<N> | undefined;
      for (const value of values) id = await insert(session, value, false);
      return id;
    }),
    bulkDelete: ids => access(name, true, async session => { for (const id of ids) await session.run(`DELETE FROM ${identifier(name)} WHERE id = ?`, [id]); }),
    update: (id, changes) => access(name, true, session => update(session, id, changes)),
    delete: id => access(name, true, async session => { await session.run(`DELETE FROM ${identifier(name)} WHERE id = ?`, [id]); }),
    clear: () => access(name, true, async session => { await session.run(`DELETE FROM ${identifier(name)}`); }),
    where: index => ({equals: value => {
      if ((index === 'contaId' || index === 'id') && (typeof value === 'string' || typeof value === 'number')) return collection(undefined, {column:index === 'contaId' ? 'conta_id' : 'id', value});
      return collection(row => (row as unknown as Record<string, unknown>)[index] === value);
    }}),
    filter: predicate => collection(predicate), toCollection: () => collection(),
  };
}
function makeTables(access: Access): Tables {
  return Object.fromEntries(TABLE_NAMES.map(name => [name, makeTable(name, access)])) as Tables;
}

async function schema(driver: SqlDriver) {
  const version = Number((await driver.all('PRAGMA user_version'))[0]?.user_version ?? 0);
  if (version > 1) throw new Error('Este banco SQLite foi criado por uma versão mais recente do aplicativo.');
  await driver.begin();
  try {
    await driver.run('CREATE TABLE IF NOT EXISTS storage_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)');
    for (const name of TABLE_NAMES) {
      await driver.run(`CREATE TABLE IF NOT EXISTS ${identifier(name)} (id ${NUMERIC_TABLES.includes(name) ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'TEXT PRIMARY KEY NOT NULL'}, conta_id TEXT, ${name === 'categorias' ? 'tipo TEXT, nome TEXT, ' : ''}payload TEXT NOT NULL)`);
      await driver.run(`CREATE INDEX IF NOT EXISTS "${name}_conta" ON ${identifier(name)} (conta_id)`);
    }
    await driver.run('CREATE UNIQUE INDEX IF NOT EXISTS categorias_conta_tipo_nome ON categorias (conta_id, tipo, nome)');
    await driver.run('PRAGMA user_version = 1');
    await driver.commit();
  } catch (error) { await driver.rollback(); throw error; }
}

export function createSqliteDatabase(open: () => Promise<SqlDriver>, legacy: () => Promise<LegacySnapshot | undefined> = async () => undefined): Database {
  let driver: SqlDriver;
  let initialization: Promise<void> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const task = queue.then(work); queue = task.catch(() => undefined); return task;
  };
  const atomic = async <T>(names: readonly TableName[], work: (transaction: Tables, session: Session) => Promise<T>): Promise<T> => {
    await driver.begin();
    const session = new Session(driver);
    const transaction = makeTables((name, _write, operation) => {
      if (!names.includes(name)) return Promise.reject(new Error('Tabela fora da transação.'));
      return operation(session);
    });
    try {
      const result = await work(transaction, session);
      session.seal(); await session.drain(); await driver.commit();
      return result;
    } catch (error) {
      session.seal(); await session.drain().catch(() => undefined); await driver.rollback(); throw error;
    }
  };
  const initialize = () => {
    if (!initialization) initialization = (async () => {
      driver = await open(); await schema(driver);
      const checked = await driver.all('SELECT value FROM storage_meta WHERE key = ?', ['indexeddb_migration']);
      if (checked.length) return;
      const nonempty = await Promise.all(TABLE_NAMES.map(name => driver.all(`SELECT COUNT(*) AS total FROM ${identifier(name)}`)));
      const empty = nonempty.every(rows => Number(rows[0].total) === 0);
      const source = empty ? await legacy() : undefined;
      await atomic(TABLE_NAMES, async transaction => {
        if (source && empty) {
          const migrated = normalizeLegacy(source);
          for (const name of TABLE_NAMES) {
            const target = transaction[name] as StorageTable<Records[TableName], string | number>;
            await target.bulkAdd(migrated[name]);
          }
          await driver.run('INSERT INTO storage_meta (key, value) VALUES (?, ?)', ['indexeddb_archive', JSON.stringify(source)]);
        }
        await driver.run('INSERT INTO storage_meta (key, value) VALUES (?, ?)', ['indexeddb_migration', empty ? 'checked' : 'kept_existing_sqlite']);
      });
    })().catch(error => { initialization = undefined; throw error; });
    return initialization;
  };
  const access: Access = async (name, write, work) => {
    await initialize();
    return enqueue(async () => {
      const result = write ? await atomic([name], (_transaction, session) => work(session)) : await work(new Session(driver));
      if (write) listeners.forEach(listener => listener());
      return result;
    });
  };
  const tables = makeTables(access);
  return {
    ...tables, kind:'sqlite', tables:Object.values(tables), initialize,
    async transaction(refs: readonly TableRef[], work) {
      await initialize();
      return enqueue(async () => {
        const result = await atomic(refs.map(ref => ref.name), work);
        listeners.forEach(listener => listener()); return result;
      });
    },
    subscribe(query, observer) {
      let disposed = false, running = false, dirty = false;
      const refresh = async () => {
        dirty = true;
        if (running) return;
        running = true;
        do {
          dirty = false;
          try { const value = await query(); if (!disposed && !dirty) observer.next(value); }
          catch (error) { if (!disposed && !dirty) observer.error(error); }
        } while (!disposed && dirty);
        running = false;
      };
      const listener = () => { void refresh(); };
      listeners.add(listener); listener();
      return () => { disposed = true; listeners.delete(listener); };
    },
  };
}
