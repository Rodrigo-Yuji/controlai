import {Capacitor} from '@capacitor/core';
import Dexie from 'dexie';
import {createWebDatabase,readLegacySnapshot} from './web';
import {createSqliteDatabase} from './sqlite';
import {openNativeSqlite} from './native';
import {LEGACY_OWNER,profileStorageName,type PersonalContext} from '../workspace-context';
import {loginIdentity,type Login} from '../workspace-session';
import type {Session,SyncConfig} from '../sync/client';
export async function legacyProfile(){
 const marker=localStorage.getItem(LEGACY_OWNER);
 if(!Capacitor.isNativePlatform()&&!await Dexie.exists('ControlAI'))return {owner:marker,stored:null,config:null};
 const db=Capacitor.isNativePlatform()?createSqliteDatabase(openNativeSqlite,readLegacySnapshot):createWebDatabase();
 await db.initialize();
 const [record,binding,session,config]=await Promise.all([db.getLocalState('profile.owner'),db.getLocalState('sync.binding'),db.getLocalState('sync.session'),db.getLocalState('sync.config')]);
 const stored=session as {url:string;session:Session}|null;
 const owner=marker||record as string||(binding as {owner?:string})?.owner||(stored?.session?.user?.id?stored.url+':'+stored.session.user.id:null);
 if(owner)localStorage.setItem(LEGACY_OWNER,owner);
 return {owner,stored,config:config as SyncConfig|null};
}
export async function resolvePersonalContext(login:Login):Promise<PersonalContext>{const owner=loginIdentity(login);const legacyOwner=localStorage.getItem(LEGACY_OWNER)||(await legacyProfile()).owner;return {owner,login,legacy:owner===legacyOwner,name:owner===legacyOwner?'ControlAI':profileStorageName(owner)};}
