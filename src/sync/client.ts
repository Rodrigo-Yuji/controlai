export interface SyncConfig {url:string;key:string}
export interface Session {access_token:string;refresh_token:string;expires_at:number;user:{id:string;email?:string}}
export interface RemoteVault {revision:number;snapshot:unknown}
export function validateConfig(value:SyncConfig):SyncConfig {
 const url=value.url.trim().replace(/\/$/,'');const key=value.key.trim();
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw Error('Informe a URL HTTPS do projeto, como https://projeto.supabase.co.');
 if(key.startsWith('sb_secret_'))throw Error('Use somente a chave pública publishable ou anon, nunca uma chave secreta.');
 if(!key.startsWith('sb_publishable_')){
  try {const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')throw Error();}
  catch {throw Error('Chave pública inválida. Use publishable ou anon.');}
 }
 return {url,key};
}
export class SyncError extends Error {code:string;constructor(message:string,code='REMOTE'){super(message);this.code=code;}}
export class SupabaseClient {
 readonly config:SyncConfig;private session:Session|null;private saveSession:(session:Session)=>Promise<void>;
 constructor(config:SyncConfig,session:Session|null,saveSession:(session:Session)=>Promise<void>){this.config=config;this.session=session;this.saveSession=saveSession;}
 private async request(path:string,body:unknown,token?:string):Promise<unknown>{
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),15000);
  try {
   const response=await fetch(this.config.url+path,{method:body===undefined?'GET':'POST',headers:{apikey:this.config.key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:abort.signal,credentials:'omit'});
   const data=await response.json().catch(()=>null);
   if(!response.ok){
    if(data?.code==='40001'||String(data?.message).includes('SYNC_CONFLICT'))throw new SyncError('Outro dispositivo alterou a cópia. Sincronize novamente.','CONFLICT');
    if(response.status===401)throw new SyncError('Entre novamente para continuar a sincronização.','AUTH');
    if(response.status===404||data?.code==='PGRST202'||data?.code==='42P01')throw new SyncError('Configure o banco com o arquivo supabase/setup.sql antes de sincronizar.','SETUP');
    throw new SyncError(path.startsWith('/auth/')?'Não foi possível entrar. Confira e-mail, senha e confirmação do e-mail.':'Não foi possível sincronizar. Confira a configuração e a conexão.');
   }
   return data;
  }catch(error){if(error instanceof SyncError)throw error;throw new SyncError('Sem conexão com a nuvem. Os dados locais continuam salvos.','NETWORK');}
  finally{clearTimeout(timer);}
 }
 private async accept(value:unknown){
  const session=value as Session&{expires_in?:number};
  if(!session?.access_token||!session.refresh_token||!session.user?.id)throw new SyncError('Confirme seu e-mail e depois entre com sua senha.','CONFIRM_EMAIL');
  session.expires_at=session.expires_at||Math.floor(Date.now()/1000)+(session.expires_in||3600);
  if(this.session&&this.session.user.id!==session.user.id)throw new SyncError('O login mudou. Entre novamente para conectar os dados explicitamente.','AUTH');
  this.session=session;await this.saveSession(session);return session;
 }
 async login(email:string,password:string){return this.accept(await this.request('/auth/v1/token?grant_type=password',{email,password}));}
 async signup(email:string,password:string){
  if(password.length<8)throw Error('Use uma senha com pelo menos 8 caracteres.');
  await this.request('/auth/v1/signup',{email,password});
 }
 private async token(){
  if(!this.session)throw new SyncError('Entre para sincronizar.','AUTH');
  if(this.session.expires_at<Date.now()/1000+30)await this.accept(await this.request('/auth/v1/token?grant_type=refresh_token',{refresh_token:this.session.refresh_token}));
  return this.session!.access_token;
 }
 async revision():Promise<number>{
  const data=await this.request('/rest/v1/controlai_vaults?select=revision',undefined,await this.token()) as {revision:number}[];
  if(!Array.isArray(data)||data.length>1)throw Error('Resposta de sincronização inválida.');
  return data.length?Number(data[0].revision):0;
 }
 async read():Promise<RemoteVault|null>{
  const data=await this.request('/rest/v1/controlai_vaults?select=revision,snapshot',undefined,await this.token()) as RemoteVault[];
  if(!Array.isArray(data)||data.length>1)throw Error('Resposta de sincronização inválida.');
  if(!data.length)return null;
  if(!Number.isSafeInteger(data[0].revision)||data[0].revision<1)throw Error('Revisão remota inválida.');
  return data[0];
 }
 async push(expected:number,snapshot:unknown):Promise<number>{
  const revision=await this.request('/rest/v1/rpc/controlai_push',{expected_revision:expected,next_snapshot:snapshot},await this.token());
  if(typeof revision!=='number'||!Number.isSafeInteger(revision)||revision!==expected+1)throw Error('Revisão de sincronização inesperada.');
  return revision;
 }
}
