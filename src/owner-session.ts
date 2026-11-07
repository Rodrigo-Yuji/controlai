import type {Database} from './storage/types';
import type {Session} from './sync/client';
const KEY='controlai.owner.session',PREF='controlai.owner.auto-login';
export function ownerAutoLogin(){return typeof localStorage==='undefined'||localStorage.getItem(PREF)!=='false';}
export function setOwnerAutoLogin(value:boolean){localStorage.setItem(PREF,String(value));}
export async function readOwnerSession(db:Database):Promise<{url:string;session:Session}|null>{try{const value=typeof sessionStorage==='undefined'?null:JSON.parse(sessionStorage.getItem(KEY)||'null');if(value?.session?.user?.id)return value;}catch{/* Ignore invalid tab session. */}return await db.getLocalState('sync.session') as {url:string;session:Session}|null;}
export async function saveOwnerSession(db:Database,value:{url:string;session:Session}|null){if(!value||ownerAutoLogin()){if(typeof sessionStorage!=='undefined')sessionStorage.removeItem(KEY);await db.setLocalState('sync.session',value);}else{sessionStorage.setItem(KEY,JSON.stringify(value));await db.setLocalState('sync.session',null);}}
