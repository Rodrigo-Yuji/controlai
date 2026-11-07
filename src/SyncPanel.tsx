import AccountSecurity from './AccountSecurity';
import {readViewerSession,saveViewerSession,viewerChoiceKey} from './viewer-session';
import PasswordInput from './PasswordInput';
import {readOwnerSession,saveOwnerSession,ownerAutoLogin,setOwnerAutoLogin} from './owner-session';
import {useEffect,useRef,useState} from 'react';
import {db} from './db';
import {defaultSyncConfig} from './sync/config';
import {exportBackupFile} from './storage/backup';
import {SupabaseClient,validateConfig,type Session,type SyncConfig} from './sync/client';
import {SyncEngine,type SyncResult} from './sync/engine';
import {backupPayload,snapshotKey,type Snapshot} from './sync/snapshot';

export default function SyncPanel({onStatus}:{onStatus:(message:string)=>void}){
 const [config,setConfig]=useState<SyncConfig|null>(null),[session,setSession]=useState<Session|null>(null);
 const [url,setUrl]=useState(''),[key,setKey]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [remember,setRemember]=useState(ownerAutoLogin);
 const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [result,setResult]=useState<SyncResult>({kind:'choose',message:'Conecte a mesma conta de login no celular e no computador.'});
 useEffect(()=>{onStatus(!session?'':busy?'Sincronizando…':error?'Sincronização pendente · abrir Ajustes':result.kind==='conflict'?'Conflito de sincronização · abrir Ajustes':result.kind==='choose'?'Conectar dados · abrir Ajustes':result.kind==='retry'?'Sincronização pendente':'Sincronizado');},[onStatus,session,busy,error,result.kind]);
 useEffect(()=>{const refresh=(event:Event)=>{const done=(event as CustomEvent<{done:()=>void}>).detail.done;run.current().finally(done);};window.addEventListener('controlai-refresh',refresh);return()=>window.removeEventListener('controlai-refresh',refresh);},[]);
 const engine=useRef<SyncEngine|null>(null),working=useRef(false),paused=useRef(true),generation=useRef(0);
 useEffect(()=>{let active=true;Promise.all([db.getLocalState('sync.config'),readOwnerSession(db)]).then(([c,s])=>{
  if(!active)return;const settings=validateConfig((c as SyncConfig)||defaultSyncConfig);setConfig(settings);setUrl(settings.url);setKey(settings.key);if(s&&(s as {url:string}).url===settings.url)setSession((s as {session:Session}).session);setLoaded(true);
 }).catch(()=>{if(active){setError('Confira a configuração de sincronização. Seus dados locais estão preservados.');setLoaded(true);}});return()=>{active=false;};},[]);
 const run=useRef<()=>Promise<void>>(async()=>{});
 useEffect(()=>{
  if(!config||!session){engine.current=null;return;}
  const owner=config.url+':'+session.user.id;const current=++generation.current;
  const client=new SupabaseClient(config,session,async next=>{await saveOwnerSession(db,{url:config.url,session:next});});
  const instance=new SyncEngine(db,client,owner);engine.current=instance;paused.current=false;
  run.current=async()=>{
   if(working.current||paused.current||current!==generation.current)return;
   working.current=true;setBusy(true);
   try {const next=await instance.step();if(current!==generation.current)return;setResult(next);setError('');if(next.kind==='choose'||next.kind==='conflict')paused.current=true;}
   catch(reason){if(current===generation.current)setError(reason instanceof Error?reason.message:'Não foi possível sincronizar.');}
   finally{working.current=false;if(current===generation.current)setBusy(false);}
  };
  void run.current();const timer=setInterval(()=>{void run.current();},10000);
  const onResume=()=>{if(!document.hidden)void run.current();};window.addEventListener('online',onResume);document.addEventListener('visibilitychange',onResume);
  let debounce:ReturnType<typeof setTimeout>|undefined,last='';
  const unsubscribe=db.subscribe(()=>db.snapshot(),{next:snapshot=>{const currentKey=snapshotKey(snapshot);if(currentKey===last)return;last=currentKey;clearTimeout(debounce);debounce=setTimeout(()=>{void run.current();},600);},error:()=>{}});
  return()=>{generation.current=current+1;engine.current=null;clearInterval(timer);clearTimeout(debounce);unsubscribe();window.removeEventListener('online',onResume);document.removeEventListener('visibilitychange',onResume);};
 },[config,session]);
 async function action(work:()=>Promise<void>){if(working.current)return;working.current=true;setBusy(true);setError('');try{await work();}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível concluir.');}finally{working.current=false;setBusy(false);}}
 async function saveConfig(){await action(async()=>{const next=validateConfig({url,key});await db.setLocalState('sync.config',next);setConfig(next);setResult({kind:'choose',message:'Configuração salva. Entre com a mesma conta nos dois dispositivos.'});});}
 async function authenticate(signup=false){await action(async()=>{
  if(!config)throw Error('Configure o projeto Supabase primeiro.');
  const client=new SupabaseClient(config,null,async next=>{await saveOwnerSession(db,{url:config.url,session:next});});
  if(signup){await client.signup(email.trim(),password);setPassword('');setResult({kind:'choose',message:'Confira a confirmação no seu e-mail. Depois entre com sua senha.'});}
  else{const next=await client.login(email.trim(),password);setPassword('');setSession(next);}
 });}
 async function recoverPassword(){await action(async()=>{if(!config)throw Error('Configure o projeto Supabase primeiro.');const client=new SupabaseClient(config,null,async()=>{});await client.requestPasswordRecovery(email.trim());setPassword('');setResult({kind:'choose',message:'Se houver um cadastro para esse e-mail, você receberá um link para definir uma nova senha. Abra o link no navegador; depois use a nova senha também no APK.'});});}
 async function choose(source:'local'|'cloud'){
  const text=source==='local'?'Usar os dados DESTE DISPOSITIVO como cópia da nuvem? Nos demais dispositivos, sincronize antes de continuar.':'Usar os dados DA NUVEM neste dispositivo? Os dados locais atuais serão substituídos.';
  if(!confirm(text+' Uma cópia de recuperação será mantida neste dispositivo.'))return;
  await action(async()=>{if(!engine.current)throw Error('Entre novamente.');const next=await engine.current.connect(source);setResult(next);paused.current=next.kind!=='ready';});
 }
 async function downloadRecovery(side:'local'|'cloud'){await action(async()=>{
  const recovery=await db.getLocalState('sync.recovery') as {owner:string;local:Snapshot;cloud?:{snapshot:Snapshot}}|undefined;
  if(!recovery||recovery.owner!==config?.url+':'+session?.user.id)throw Error('Não há cópia de recuperação para este login neste dispositivo.');
  const snapshot=side==='local'?recovery.local:recovery.cloud?.snapshot;if(!snapshot)throw Error('Não há cópia da nuvem neste arquivo de recuperação.');
  await exportBackupFile(JSON.stringify(backupPayload(snapshot),null,2),`controlai-recuperacao-${side}.json`);
 });}
 async function protectSecurity(work:()=>Promise<void>){if(working.current)throw Error('Aguarde a sincronização terminar e tente novamente.');const wasPaused=paused.current,current=generation.current;paused.current=true;working.current=true;setBusy(true);try{await work();}finally{working.current=false;setBusy(false);if(generation.current===current)paused.current=wasPaused;}}
 async function finishSecurity(action:'password'|'delete'){if(!session||!config)return;const user=session.user.id,owner=config.url+':'+user;generation.current++;paused.current=true;engine.current=null;let cleanupFailed=false;try{await saveOwnerSession(db,null);if(action==='delete'){const binding=await db.getLocalState('sync.binding') as {owner?:string}|null;if(binding?.owner===owner)await db.setLocalState('sync.binding',null);const recovery=await db.getLocalState('sync.recovery') as {owner?:string}|null;if(recovery?.owner===owner)await db.setLocalState('sync.recovery',null);localStorage.removeItem(viewerChoiceKey(user));}if(readViewerSession()?.user.id===user)saveViewerSession(null);}catch{cleanupFailed=true;}finally{setSession(null);setResult({kind:'choose',message:(action==='delete'?'Login e dados da nuvem excluídos. Os dados financeiros offline foram mantidos.':'Senha alterada. Entre novamente com a nova senha.')+(cleanupFailed?' A saída local não terminou; feche o aplicativo antes de entrar novamente.':'')});}}
 if(!loaded)return null;
 return <section className="panel sync-panel"><h3>Sincronização entre dispositivos</h3>
 <p><a href="?consulta=1">Entrar em contas compartilhadas · somente leitura</a></p><p className="muted">Use o mesmo projeto e login no celular e computador. O SQLite continua no Android; as alterações sincronizam quando há internet. A nuvem guarda uma cópia dos dados de todas as contas financeiras deste dispositivo.</p>
 <fieldset disabled={busy} className="sync-fields">
 {!session&&<><details open={!config}><summary>Configurar Supabase</summary><div className="fields sync-config">
 <label>URL do projeto<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://projeto.supabase.co"/></label>
 <label>Chave pública publishable ou anon<input autoComplete="off" value={key} onChange={e=>setKey(e.target.value)}/></label>
 <p className="muted">Nunca informe chaves secretas ou service_role. O banco precisa ser configurado com o arquivo supabase/setup.sql.</p>
 <button className="secondary" type="button" onClick={saveConfig}>Salvar configuração da nuvem</button></div></details>
 {config&&<form className="fields sync-login" onSubmit={e=>{e.preventDefault();void authenticate();}}>
 <label>E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Senha<PasswordInput autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <label className="check"><input type="checkbox" checked={remember} onChange={e=>{setRemember(e.target.checked);setOwnerAutoLogin(e.target.checked);}}/>Entrar automaticamente neste dispositivo</label><div className="sync-actions"><button className="primary">Entrar para sincronizar</button><button type="button" className="secondary" onClick={()=>{void authenticate(true);}}>Criar login</button></div><button type="button" className="textbutton" onClick={()=>void action(async()=>{if(!config)throw Error('Configure o projeto primeiro.');await new SupabaseClient(config,null,async()=>{}).resendConfirmation(email.trim());setResult({kind:'choose',message:'Se o e-mail aguarda confirmação, um novo link será enviado.'});})}>Reenviar confirmação do e-mail</button><button type="button" className="textbutton recovery-action" onClick={()=>{void recoverPassword();}}>Esqueci minha senha</button></form>}</>}
 {session&&<><p>Conectado como <strong>{session.user.email||email}</strong></p>
 <div className="sync-actions sync-primary-actions"><button type="button" className="primary" onClick={()=>{paused.current=false;void run.current();}}>Sincronizar agora</button>
 <button type="button" className="secondary" onClick={()=>{void action(async()=>{generation.current++;paused.current=true;await saveOwnerSession(db,null);setSession(null);setResult({kind:'choose',message:'Desconectado. Os dados locais foram mantidos.'});});}}>Sair do login</button></div>
 {(result.kind==='choose'||result.kind==='conflict'||Boolean(error))&&<div className="sync-choice"><p className="muted">Na primeira conexão, envie os dados do APK. Depois, no computador, escolha usar a cópia da nuvem. Se houver alterações nos dois lados, exporte os backups antes de escolher; a escolha mantém uma cópia completa e não mescla os lançamentos.</p>
 <div className="sync-actions"><button type="button" className="secondary" onClick={()=>{void choose('local');}}>Usar dados deste dispositivo</button><button type="button" className="secondary" onClick={()=>{void choose('cloud');}}>Usar dados da nuvem</button></div></div>}
 <div className="sync-actions sync-backup-actions"><button type="button" className="secondary" onClick={()=>{void downloadRecovery('local');}}>Backup local de recuperação</button><button type="button" className="secondary" onClick={()=>{void downloadRecovery('cloud');}}>Backup remoto de recuperação</button></div></>}
 </fieldset>
 {session&&config&&<AccountSecurity session={session} config={config} owner disabled={busy} protect={protectSecurity} onComplete={finishSecurity}/>}
 <p className="muted sync-status-message" role="status">{busy?'Sincronizando…':result.message}</p>{error&&<p className="error" role="alert">{error}</p>}
 </section>;
}
