import {validatePlanning} from '../planning.ts';
import {validateFinancialReferences,validateManagement} from '../management.ts';
import {TABLE_NAMES,NUMERIC_TABLES, type Records, type TableName, type Tables} from '../storage/types.ts';
export type Snapshot = {[N in TableName]:Records[N][]};
export function withoutHistory(snapshot:Snapshot):Snapshot{return {...snapshot,contas:snapshot.contas.map(account=>{const clean={...account};delete clean.atividades;return clean;})};}
export async function readTables(tables:Tables):Promise<Snapshot> {
  return withoutHistory(Object.fromEntries(await Promise.all(TABLE_NAMES.map(async name=>[name,await tables[name].toArray()]))) as Snapshot);
}
export function stable(value:unknown):string {
  if(value instanceof Date)return JSON.stringify(value.toJSON());
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).filter(key=>(value as Record<string,unknown>)[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+stable((value as Record<string,unknown>)[key])).join(',')+'}';
  return JSON.stringify(value)??'null';
}
export function snapshotKey(snapshot:Snapshot):string {
  const normalized=withoutHistory(snapshot);return stable(Object.fromEntries(TABLE_NAMES.map(name=>[name,[...normalized[name]].sort((a,b)=>String(a.id).localeCompare(String(b.id)))])));
}
export function validateSnapshot(value:unknown):Snapshot {
  if(!value||typeof value!=='object')throw Error('Cópia de sincronização inválida.');
  if(!Array.isArray((value as Snapshot).contas))throw Error('Tabela ausente: contas.');const snapshot=withoutHistory(value as Snapshot);
  const accounts=new Set<string>();
  for(const name of TABLE_NAMES){
    if(!Array.isArray(snapshot[name]))throw Error(`Tabela ausente: ${name}.`);
    const ids=new Set<string>();
    for(const row of snapshot[name]){
      if(!row||typeof row!=='object'||!['string','number'].includes(typeof row.id)||String(row.id)==='')throw Error(`Identificador inválido em ${name}.`);
      if(typeof row.id==='number'&&(!Number.isSafeInteger(row.id)||row.id<=0))throw Error(`Identificador inválido em ${name}.`);
      if(NUMERIC_TABLES.includes(name)&&typeof row.id!=='number')throw Error(`Identificador numérico obrigatório em ${name}.`);
      const key=String(row.id);if(ids.has(key))throw Error(`Identificador repetido em ${name}.`);ids.add(key);
      if(name==='configuracoes')validatePlanning(row as Records['configuracoes']);
      if(name==='contas'){validateManagement(row as Records['contas']);accounts.add(key);}
    }
  }
  for(const name of TABLE_NAMES)for(const row of snapshot[name]){
    if(name!=='contas'&&(!('contaId' in row)||!row.contaId||!accounts.has(row.contaId)))throw Error(`Conta ausente em ${name}.`);
    for(const key of ['valorCentavos','liquido','refeicao','beneficio','adicional']){
      const amount=(row as unknown as Record<string,unknown>)[key];
      if(amount!==undefined&&(!Number.isSafeInteger(amount)||(['liquido','refeicao','beneficio','adicional'].includes(key)&&Number(amount)<0)))throw Error('Valor monetário inválido na cópia remota.');
    }
  }
  validateFinancialReferences(snapshot.contas,snapshot.lancamentos,snapshot.recorrencias);
  if(!snapshot.contas.length)throw Error('A cópia precisa conter ao menos uma conta.');
  // Keep synchronization requests bounded; attachments are not included.
  if(new TextEncoder().encode(JSON.stringify(snapshot)).byteLength>8*1024*1024)throw Error('Cópia maior que o limite de 8 MB.');
  return JSON.parse(JSON.stringify(snapshot)) as Snapshot;
}
export async function writeTables(tables:Tables,snapshot:Snapshot){
 snapshot=withoutHistory(snapshot);
  for(const name of TABLE_NAMES)await tables[name].clear();
  for(const name of TABLE_NAMES){
    // The mapped union shares the same JSON storage representation.
    const table=tables[name] as import('../storage/types.ts').StorageTable<Records[TableName],string|number>;
    if(snapshot[name].length)await table.bulkAdd(snapshot[name]);
  }
}
export function backupPayload(snapshot:Snapshot){return {app:'ControlAI',versao:5,...withoutHistory(snapshot)};}
