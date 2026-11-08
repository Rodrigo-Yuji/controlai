import StartupScreen from './StartupScreen';
import {lazy,Suspense,useEffect,useState,type ComponentType} from 'react';
import {defaultSyncConfig} from './sync/config';
import {validateConfig,type Session} from './sync/client';
import {hasUsedLogin,readLogin,startLogin,onLoginChanged,spaceKey} from './workspace-session';
import {setPersonalContext} from './workspace-context';
import LoginPage from './LoginPage';
const Viewer=lazy(()=>import('./ViewerApp'));
let starting:Promise<ComponentType>|undefined;
async function preparePersonal():Promise<ComponentType>{
 let login=readLogin();const offline=new URLSearchParams(location.search).get('offline')==='1';const forceLogin=new URLSearchParams(location.search).get('login')==='1';
 if(forceLogin)return LoginPage;
 if(!login&&hasUsedLogin()&&!offline)return LoginPage;
 const profiles=await import('./storage/profiles');
 if(!login){
  const legacy=await profiles.legacyProfile();if(offline&&legacy.owner)return LoginPage;let tab:{url:string;session:Session}|null=null;
  try{tab=JSON.parse(sessionStorage.getItem('controlai.owner.session')||'null');}catch{/* Invalid old session. */}
  const saved=tab||legacy.stored;
  if(saved?.session?.user?.id){const config=validateConfig(legacy.config||{...defaultSyncConfig,url:saved.url});login=startLogin(config,saved.session,localStorage.getItem('controlai.owner.auto-login')!=='false');}
  else {let guest:Session|null=null;try{guest=JSON.parse(sessionStorage.getItem('controlai.viewer.session')||localStorage.getItem('controlai.viewer.session')||'null');}catch{/* Invalid old session. */}if(guest?.user?.id)login=startLogin(defaultSyncConfig,guest,localStorage.getItem('controlai.viewer.auto-login')==='true');else if(legacy.owner)return LoginPage;}
 }
 if(login){const preference=localStorage.getItem(spaceKey(login));if(!location.search&&preference==='consulta'){location.replace(location.pathname+'?consulta=1');return ()=>null;}localStorage.setItem(spaceKey(login),'pessoal');setPersonalContext(await profiles.resolvePersonalContext(login));}
 else setPersonalContext({name:'ControlAI',legacy:true});
 return (await import('./Bootstrap')).default;
}
export default function WorkspaceRoot(){const viewer=new URLSearchParams(location.search).get('consulta')==='1';const [Root,setRoot]=useState<ComponentType|null>(null),[error,setError]=useState(''),[changed,setChanged]=useState(false);useEffect(()=>onLoginChanged(()=>{setChanged(true);location.reload();}),[]);useEffect(()=>{if(viewer)return;let active=true;starting??=preparePersonal();starting.then(component=>{if(active)setRoot(()=>component);}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Não foi possível abrir seu espaço.');});return()=>{active=false;};},[viewer]);if(changed)return <main><p>O login mudou. Reabrindo seu espaço…</p></main>;if(viewer)return <Suspense fallback={<StartupScreen/>}><Viewer/></Suspense>;if(error)return <main className="password-recovery"><section className="panel"><h1>Não foi possível abrir seu espaço</h1><p role="alert">{error}</p><p>Seus dados continuam preservados neste dispositivo.</p><button className="primary" onClick={()=>location.reload()}>Tentar novamente</button><a className="secondary" href="?login=1">Ir para o login</a></section></main>;return Root?<Root/>:<StartupScreen/>;}
