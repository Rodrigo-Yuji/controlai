import {accountType} from './finance.ts';
import {validateSnapshot,type Snapshot} from './sync/snapshot.ts';
export function validateSharedSnapshot(value:unknown,accountId:string):Snapshot{
 const snapshot=validateSnapshot(value);
 if(snapshot.contas.length!==1||snapshot.contas[0].id!==accountId||!['gestora','casal'].includes(accountType(snapshot.contas[0])))throw Error('Resposta de consulta inválida.');
 for(const [table,rows] of Object.entries(snapshot))if(table!=='contas'&&rows.some(row=>!('contaId' in row)||row.contaId!==accountId))throw Error('Resposta contém outra conta.');
 return snapshot;
}
