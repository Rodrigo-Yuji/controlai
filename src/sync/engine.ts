import type {Database} from '../storage/types.ts';
import {snapshotKey,validateSnapshot,type Snapshot} from './snapshot.ts';
import type {RemoteVault} from './client.ts';
export interface Transport {revision():Promise<number>;read():Promise<RemoteVault|null>;push(expected:number,snapshot:Snapshot):Promise<number>}
interface Binding {owner:string;revision:number;base:Snapshot}
export type SyncResult={kind:'ready'|'choose'|'conflict'|'retry';message:string};
export class SyncEngine {
 private running=false;
 private db:Database;private remote:Transport;private owner:string;
 constructor(db:Database,remote:Transport,owner:string){this.db=db;this.remote=remote;this.owner=owner;}
 private async binding(){const value=await this.db.getLocalState('sync.binding') as Binding|undefined;return value?.owner===this.owner?value:undefined;}
 async step():Promise<SyncResult>{
  if(this.running)return {kind:'retry',message:'Sincronização em andamento.'};
  this.running=true;
  try{
   const binding=await this.binding();
   if(!binding)return {kind:'choose',message:'Escolha a origem dos dados na primeira conexão.'};
   const local=validateSnapshot(await this.db.snapshot());
   const localKey=snapshotKey(local),baseKey=snapshotKey(binding.base);
   const remoteRevision=await this.remote.revision();
   if(remoteRevision===0)throw Error('A cópia da nuvem não existe mais. Reconecte os dados explicitamente.');
   if(remoteRevision===binding.revision){
    if(localKey!==baseKey){
     const revision=await this.remote.push(binding.revision,local);
     // Later local edits remain in the DB; only the acknowledged base advances.
     await this.db.setLocalState('sync.binding',{owner:this.owner,revision,base:local});
    }
    await this.db.setLocalState('sync.lastSuccess',{owner:this.owner,at:new Date().toISOString()});return {kind:'ready',message:'Sincronizado. Alterações aparecem nos outros dispositivos conectados.'};
   }
   const cloud=await this.remote.read();if(!cloud)throw Error('Cópia remota indisponível.');
   const next=validateSnapshot(cloud.snapshot);const nextKey=snapshotKey(next);
   if(nextKey===baseKey&&localKey!==baseKey){const revision=await this.remote.push(cloud.revision,local);await this.db.setLocalState('sync.binding',{owner:this.owner,revision,base:local});await this.db.setLocalState('sync.lastSuccess',{owner:this.owner,at:new Date().toISOString()});return {kind:'ready',message:'Alterações locais enviadas após a atualização de armazenamento.'};}
   if(localKey!==baseKey&&localKey!==nextKey){await this.db.setLocalState('sync.recovery',{owner:this.owner,at:new Date().toISOString(),local,cloud});return {kind:'conflict',message:'Os dois dispositivos foram alterados. A sincronização foi pausada para preservar as duas cópias.'};}
   const changed=await this.db.applySnapshot(localKey,next,'sync.binding',{owner:this.owner,revision:cloud.revision,base:next});if(changed)await this.db.setLocalState('sync.lastSuccess',{owner:this.owner,at:new Date().toISOString()});
   return changed?{kind:'ready',message:'Dados atualizados pela nuvem.'}:{kind:'retry',message:'Nova alteração local; sincronizando novamente.'};
  }finally{this.running=false;}
 }
 async connect(source:'local'|'cloud'):Promise<SyncResult>{
  if(this.running)throw Error('Aguarde a sincronização atual.');
  this.running=true;
  try{
   const current=await this.db.snapshot();const local=source==='local'?validateSnapshot(current):current;const localKey=snapshotKey(local);
   const cloud=await this.remote.read();
   // Keep a durable recovery copy, including both sides of a conflict.
   await this.db.setLocalState('sync.recovery',{owner:this.owner,at:new Date().toISOString(),local,cloud});
   if(source==='local'){
    const revision=await this.remote.push(cloud?.revision??0,local);
    await this.db.setLocalState('sync.binding',{owner:this.owner,revision,base:local});
   }else{
    if(!cloud)throw Error('A nuvem está vazia. Envie primeiro os dados do celular.');
    const next=validateSnapshot(cloud.snapshot);
    if(!await this.db.applySnapshot(localKey,next,'sync.binding',{owner:this.owner,revision:cloud.revision,base:next}))return {kind:'retry',message:'Os dados locais mudaram durante a conexão. Tente novamente.'};
   }
   await this.db.setLocalState('sync.lastSuccess',{owner:this.owner,at:new Date().toISOString()});return {kind:'ready',message:'Dispositivo conectado. A sincronização automática está ativa.'};
  }finally{this.running=false;}
 }
}
