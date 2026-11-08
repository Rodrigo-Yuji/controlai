import {APP_SITE_URL} from './recovery.ts';
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
 private async request(path:string,body:unknown,token?:string,method?:'GET'|'POST'|'PUT'|'DELETE'):Promise<unknown>{
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),15000);
  try {
   const response=await fetch(this.config.url+path,{method:method??(body===undefined?'GET':'POST'),headers:{apikey:this.config.key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:abort.signal,credentials:'omit'});
   const data=await response.json().catch(()=>null);
   if(!response.ok){
    if(response.status===429)throw new SyncError('Limite de envios ou tentativas atingido. Tente novamente mais tarde.','RATE_LIMIT');
    if(['reauthentication_needed','reauthentication_not_valid'].includes(data?.code))throw new SyncError('O projeto exige confirmação adicional. Use Esqueci minha senha para alterar pelo e-mail.','REAUTH');
    if(data?.code==='weak_password')throw new SyncError('A senha não atende às regras do projeto. Use uma senha mais forte com pelo menos 8 caracteres.','PASSWORD');
    if(data?.code==='40001'||String(data?.message).includes('SYNC_CONFLICT'))throw new SyncError('Outro dispositivo alterou a cópia. Sincronize novamente.','CONFLICT');
    const requestMessages:Record<string,string>={'Participante não encontrado nesta gestora':'A pessoa não está disponível na data da compra. Para compras anteriores ao início da participação, o titular precisa executar supabase/solicitacoes-retroativas.sql.',REQUEST_NOT_PENDING:'Esta solicitação já foi analisada. Só é possível desistir enquanto estiver pendente.',REQUEST_HAS_PAYMENTS:'Estorne os reembolsos desta compra em Gestão antes de desfazer a aprovação.',REQUEST_MODIFIED:'O lançamento ou a compra foi alterado, pago em partes ou conciliado. Revise os vínculos antes de desfazer a aprovação.',REQUEST_CLOSED:'Reabra o mês em Orçamento antes de desfazer a aprovação.',REQUEST_CHANGED:'A solicitação mudou em outro dispositivo. Aguarde a atualização e tente novamente.'};
    Object.assign(requestMessages,{VIEWER_IDENTITY_REQUIRED:'O titular precisa associar seu e-mail a uma pessoa em Acessos de consulta antes de enviar compras com reembolso.',VIEWER_IDENTITY_MISMATCH:'A pessoa do pedido não corresponde à identificação definida pelo titular.',VIEWER_IDENTITY_CHANGED:'A identificação deste e-mail mudou. Solicite um novo envio com o nome definido pelo titular.',VIEWER_PERSON_INVALID:'A pessoa não está disponível nesta conta ou data. Sincronize e confira a identificação em Acessos de consulta.',VIEWER_IDENTITY_SETUP:'O titular precisa executar supabase/identidade-consulta.sql para ativar o envio identificado.'});
    if(requestMessages[data?.message])throw new SyncError(requestMessages[data.message],'REQUEST');
    if(data?.code==='same_password')throw new SyncError('A nova senha precisa ser diferente da senha atual.','PASSWORD');
    if(data?.code==='42501'&&String(data?.message).startsWith('Confirme'))throw new SyncError(String(data.message),'REAUTH');
    if(response.status===403||data?.code==='42501')throw new SyncError('Acesso não autorizado ou revogado.','FORBIDDEN');
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
 async signup(email:string,password:string,viewer=false){
  if(password.length<8)throw Error('Use uma senha com pelo menos 8 caracteres.');
  await this.request('/auth/v1/signup?redirect_to='+encodeURIComponent(APP_SITE_URL+(viewer?'?consulta=1':'')),{email,password});
 }
 async resendConfirmation(email:string,viewer=false){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw Error('Informe seu e-mail.');await this.request('/auth/v1/resend?redirect_to='+encodeURIComponent(APP_SITE_URL+(viewer?'?consulta=1':'')),{type:'signup',email:email.trim()});}
 async confirmationUser(accessToken:string){const user=await this.request('/auth/v1/user',undefined,accessToken) as {id?:string;email?:string;email_confirmed_at?:string};if(!user?.id||!user.email_confirmed_at)throw Error('Não foi possível confirmar o e-mail. Entre com sua senha ou solicite um novo link.');return user;}
 async requestPasswordRecovery(email:string){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw Error('Informe seu e-mail para receber o link de recuperação.');
  await this.request('/auth/v1/recover?redirect_to='+encodeURIComponent(APP_SITE_URL),{email:email.trim()});
 }
 async recoveryUser(accessToken:string):Promise<{id:string;email?:string}>{
  const user=await this.request('/auth/v1/user',undefined,accessToken) as {id?:string;email?:string};
  if(!user?.id)throw new SyncError('Link inválido ou expirado. Solicite outro e-mail.','AUTH');
  return {id:user.id,email:user.email};
 }
 async updatePassword(accessToken:string,password:string){
  if(password.length<8)throw Error('Use uma senha com pelo menos 8 caracteres.');
  await this.request('/auth/v1/user',{password},accessToken,'PUT');
 }
 private async token(){
  if(!this.session)throw new SyncError('Entre para sincronizar.','AUTH');
  if(this.session.expires_at<Date.now()/1000+30)await this.accept(await this.request('/auth/v1/token?grant_type=refresh_token',{refresh_token:this.session.refresh_token}));
  return this.session!.access_token;
 }
 async accountViewers(accountId:string){return await this.request('/rest/v1/rpc/controlai_account_viewers',{p_account:accountId},await this.token()) as {email:string;created_at:string;pessoa_id?:string|null;nome?:string|null}[];}
 async setAccountViewerIdentity(accountId:string,email:string,allow:boolean,personId:string|null){try{await this.request('/rest/v1/rpc/controlai_set_account_viewer_identity',{p_account:accountId,p_email:email,p_allow:allow,p_pessoa_id:personId},await this.token());}catch(e){if(e instanceof SyncError&&e.code==='SETUP')throw new SyncError('Execute supabase/identidade-consulta.sql no Supabase para associar e-mails às pessoas.','SETUP');throw e;}}
 async setAccountViewer(accountId:string,email:string,allow:boolean){await this.request('/rest/v1/rpc/controlai_set_account_viewer',{p_account:accountId,p_email:email,p_allow:allow},await this.token());}
 async sharedAccounts(){return await this.request('/rest/v1/rpc/controlai_shared_accounts',{},await this.token()) as {owner:string;account_id:string;nome:string;tipo:string}[];}
 async sharedAccount(owner:string,accountId:string){return await this.request('/rest/v1/rpc/controlai_shared_account',{p_owner:owner,p_account:accountId},await this.token()) as {revision:number;updated_at:string;snapshot:unknown;viewer_identity?:import('../viewer-identity').ViewerIdentity|null};}
 async deleteMyAccount(confirmation:string){if(confirmation!=='EXCLUIR')throw Error('Digite EXCLUIR para confirmar.');const token=await this.token();let files:unknown;try{files=await this.request('/rest/v1/rpc/controlai_my_receipts',{},token);}catch(e){if(!(e instanceof SyncError&&e.code==='SETUP'))throw e;}if(Array.isArray(files)&&files.length)for(let i=0;i<files.length;i+=100)await this.request('/storage/v1/object/controlai-comprovantes',{prefixes:files.slice(i,i+100)},token,'DELETE');await this.request('/rest/v1/rpc/controlai_delete_my_account',{p_confirmation:confirmation},token);}
 async logout(scope:'local'|'global'='local'){await this.request('/auth/v1/logout?scope='+scope,{},await this.token());this.session=null;}
 async submitRequest(owner:string,account:string,payload:unknown){const identified=(payload as {finalidade?:string})?.finalidade==='reembolsoCasa',household=identified||Boolean((payload as {reembolsoPessoaId?:string})?.reembolsoPessoaId);try{return await this.request('/rest/v1/rpc/'+(identified?'controlai_submit_identified_household_request':household?'controlai_submit_household_request':'controlai_submit_request'),{p_owner:owner,p_account:account,p_payload:payload},await this.token()) as string;}catch(e){if(identified&&e instanceof SyncError&&e.code==='SETUP')throw new SyncError('O titular precisa executar supabase/identidade-consulta.sql no Supabase para identificar os solicitantes.','SETUP');if(household&&e instanceof SyncError&&e.code==='SETUP')throw new SyncError('O titular precisa executar supabase/solicitacoes-reembolso.sql no Supabase para habilitar compras com reembolso.','SETUP');throw e;}}
 async listRequests(owner:string,account:string){return await this.request('/rest/v1/rpc/controlai_list_requests',{p_owner:owner,p_account:account},await this.token()) as import('../requests').EntryRequest[];}
 async requestOverview(owner:string,account:string,limit:number,offset=0){try{return await this.request('/rest/v1/rpc/controlai_requests_overview',{p_owner:owner,p_account:account,p_limit:limit,p_offset:offset},await this.token()) as import('../requests').RequestOverview;}catch(e){if(!(e instanceof SyncError)||e.code!=='SETUP')throw e;const rows=(await this.listRequests(owner,account)).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id));return{active:[],history:rows.slice(offset,offset+limit),history_count:rows.length,pending_count:rows.filter(r=>r.status==='pendente').length};}}
 async cancelRequest(id:string){try{await this.request('/rest/v1/rpc/controlai_cancel_request',{p_id:id},await this.token());}catch(e){if(e instanceof SyncError&&e.code==='SETUP')throw new SyncError('Execute supabase/solicitacoes-ciclo.sql no Supabase para habilitar a desistência.','SETUP');throw e;}}
 async undoRequest(id:string,status:'aprovado'|'recusado',revision:number){try{return await this.request('/rest/v1/rpc/controlai_undo_request',{p_id:id,p_expected_status:status,p_revision:revision},await this.token()) as number;}catch(e){if(e instanceof SyncError&&e.code==='SETUP')throw new SyncError('Execute supabase/solicitacoes-ciclo.sql no Supabase para habilitar desfazer a decisão.','SETUP');throw e;}}
 async resolveRequest(id:string,status:'aprovado'|'recusado',category:string,revision:number,reason=''){return await this.request('/rest/v1/rpc/controlai_resolve_request',{p_id:id,p_status:status,p_category:category,p_revision:revision,p_reason:reason},await this.token()) as number|null;}
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
