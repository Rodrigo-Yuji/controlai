import { Capacitor } from '@capacitor/core';
import {createWebDatabase,readLegacySnapshot} from './web';
import {createSqliteDatabase} from './sqlite';
import {openNativeSqlite} from './native';
import {personalContext} from '../workspace-context';
const context=personalContext();
export const db=Capacitor.isNativePlatform()
 ?createSqliteDatabase(()=>openNativeSqlite(context.legacy?'controlai':context.name),context.legacy?readLegacySnapshot:undefined)
 :createWebDatabase(context.name);
export const storageKind=db.kind;
export const initializeStorage=async()=>{await db.initialize();const owner=await db.getLocalState('profile.owner');if(owner&&owner!==context.owner)throw Error('Este banco pertence a outro login. Entre novamente com o titular correto.');if(context.owner&&!owner)await db.setLocalState('profile.owner',context.owner);};
