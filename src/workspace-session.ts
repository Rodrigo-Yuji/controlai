import type {Session,SyncConfig} from './sync/client.ts';
export interface Login {config:SyncConfig;session:Session;epoch:string}
const KEY='controlai.login.v2',EPOCH='controlai.login.epoch',USED='controlai.login.initialized';
function valid(value:unknown):value is Login{const v=value as Login;return !!(v?.config?.url&&v.config.key&&v.session?.access_token&&v.session.refresh_token&&v.session.user?.id&&Number.isFinite(v.session.expires_at)&&v.epoch);}
export const loginIdentity=(login:Pick<Login,'config'|'session'>)=>login.config.url+':'+login.session.user.id;
export function readLogin():Login|null{try{const epoch=localStorage.getItem(EPOCH);for(const storage of [localStorage,sessionStorage]){try{const value=JSON.parse(storage.getItem(KEY)||'null');if(valid(value)&&value.epoch===epoch)return value;}catch{/* Ignore an invalid saved session. */}}return null;}catch{return null;}}
export function hasUsedLogin(){return localStorage.getItem(USED)==='true';}
export function startLogin(config:SyncConfig,session:Session,remember:boolean){const epoch=crypto.randomUUID();const value:Login={config,session,epoch};localStorage.setItem(USED,'true');localStorage.setItem('controlai.login.auto-login',String(remember));localStorage.setItem('controlai.login.config',JSON.stringify(config));localStorage.setItem(EPOCH,epoch);localStorage.removeItem(KEY);sessionStorage.setItem(KEY,JSON.stringify(value));if(remember)localStorage.setItem(KEY,JSON.stringify(value));clearOldTokens();return value;}
function clearOldTokens(){for(const key of ['controlai.viewer.session','controlai.owner.session']){sessionStorage.removeItem(key);localStorage.removeItem(key);}}
export function refreshLogin(config:SyncConfig,session:Session,epoch:string){const current=readLogin();if(!current||current.epoch!==epoch||loginIdentity(current)!==loginIdentity({config,session}))throw Error('O login mudou. Abra novamente o espaço para continuar.');const next={...current,session};sessionStorage.setItem(KEY,JSON.stringify(next));if(localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(next));}
export function clearLogin(){localStorage.setItem(USED,'true');localStorage.setItem(EPOCH,crypto.randomUUID());localStorage.removeItem(KEY);sessionStorage.removeItem(KEY);clearOldTokens();}
export function onLoginChanged(listener:()=>void){const handler=(event:StorageEvent)=>{if(event.key===EPOCH||event.key===null)listener();};window.addEventListener('storage',handler);return()=>window.removeEventListener('storage',handler);}
export type Space='pessoal'|'consulta';
export function spaceKey(login:Login){return 'controlai.space:'+loginIdentity(login);}
export function goToSpace(space:Space){const login=readLogin();if(login)localStorage.setItem(spaceKey(login),space);window.location.assign(window.location.pathname+(space==='consulta'?'?consulta=1':'?espaco=pessoal'));}
export function goToLogin(message=''){if(message)sessionStorage.setItem('controlai.login.message',message);window.location.assign(window.location.pathname+'?login=1');}
