import {useEffect,useState,type ReactNode} from 'react';
import {db} from './db';
import {defaultSyncConfig} from './sync/config';
import {SupabaseClient,validateConfig,type Session,type SyncConfig} from './sync/client';
import {consumeAuthReturn} from './sync/recovery';
const initialReturn=typeof window==='undefined'?null:consumeAuthReturn();

export default function PasswordRecovery({children}:{children:(openLogin:boolean)=>ReactNode}){
 const [active,setActive]=useState(Boolean(initialReturn)),[openLogin,setOpenLogin]=useState(false);
 const [client,setClient]=useState<SupabaseClient|null>(null),[verified,setVerified]=useState<{id:string;email?:string}|null>(null);
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[email,setEmail]=useState('');
 const [busy,setBusy]=useState(initialReturn?.kind==='recovery'),[error,setError]=useState(initialReturn?.kind==='error'?'Link inválido ou expirado. Solicite outro e-mail.':''),[message,setMessage]=useState(''),[done,setDone]=useState(false);
 useEffect(()=>{
  document.documentElement.dataset.theme=localStorage.getItem('controlai-tema')==='escuro'?'escuro':'claro';
  if(!initialReturn)return;let mounted=true;
  (async()=>{const config=validateConfig((await db.getLocalState('sync.config') as SyncConfig)||defaultSyncConfig);const api=new SupabaseClient(config,null,async()=>{});if(mounted)setClient(api);
   if(initialReturn.kind==='recovery'){try{const user=await api.recoveryUser(initialReturn.accessToken);if(mounted){setVerified(user);setEmail(user.email??'');}}catch(reason){if(mounted)setError(reason instanceof Error&&'code' in reason&&reason.code==='NETWORK'?reason.message:'Link inválido ou expirado. Solicite outro e-mail.');}}
  })().catch(()=>{if(mounted)setError('Não foi possível verificar o link. Confira a conexão e tente novamente.');}).finally(()=>{if(mounted)setBusy(false);});
  return()=>{mounted=false;};
 },[]);
 async function save(e:React.FormEvent){e.preventDefault();if(busy||!client||!verified||initialReturn?.kind!=='recovery')return;setError('');if(password!==confirmation){setError('As senhas não coincidem.');return;}setBusy(true);
  try{await client.updatePassword(initialReturn.accessToken,password);
   const stored=await db.getLocalState('sync.session') as {session?:Session}|null;
   if(stored?.session?.user.id===verified.id)await db.setLocalState('sync.session',null);
   setPassword('');setConfirmation('');setDone(true);setMessage('Senha atualizada. Entre novamente com seu e-mail e a nova senha. Seus dados financeiros foram preservados.');
  }catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível atualizar a senha.');}finally{setBusy(false);}
 }
 async function resend(e:React.FormEvent){e.preventDefault();if(busy||!client)return;setBusy(true);setError('');try{await client.requestPasswordRecovery(email);setMessage('Se houver um cadastro para esse e-mail, você receberá um novo link de recuperação.');}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível enviar o link.');}finally{setBusy(false);}}
 if(!active)return <>{children(openLogin)}</>;
 return <main className="password-recovery"><section className="panel"><h1>Recuperar senha</h1>{busy&&!verified&&<p role="status">Verificando o link…</p>}
 {verified&&!done&&<form className="fields" onSubmit={save}><p className="muted">Defina uma nova senha para {verified.email||'sua conta'}. Esta ação não recria o usuário e não apaga os dados.</p><label>Nova senha<input required minLength={8} type="password" autoComplete="new-password" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label><label>Confirmar nova senha<input required minLength={8} type="password" autoComplete="new-password" value={confirmation} disabled={busy} onChange={e=>setConfirmation(e.target.value)}/></label><button className="primary" disabled={busy}>Salvar nova senha</button></form>}
 {!verified&&!busy&&<form className="fields" onSubmit={resend}><label>E-mail para recuperação<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="primary" disabled={!client}>Enviar novo link</button></form>}
 {error&&<p className="error" role="alert">{error}</p>}{message&&<p className="success" role="status">{message}</p>}
 <button type="button" className="secondary" disabled={busy} onClick={()=>{setOpenLogin(true);setActive(false);}}>{done?'Ir para o login':'Voltar ao aplicativo'}</button></section></main>;
}
