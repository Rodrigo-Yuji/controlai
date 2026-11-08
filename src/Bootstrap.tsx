import StartupScreen from './StartupScreen';
import { useEffect, useState } from 'react';
import { initializeStorage } from './db';
import App from './App';
import {personalContext} from './workspace-context';
import {SupabaseClient} from './sync/client';
import {refreshLogin,readLogin} from './workspace-session';
import {SyncEngine} from './sync/engine';
import {db} from './db';

let preparing:Promise<void>|undefined;
export default function Bootstrap() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setError('');
    (preparing??=initializeStorage().then(async()=>{const ctx=personalContext(),login=ctx.login;if(!login||!ctx.owner)return;if(readLogin()?.epoch!==login.epoch)throw Error('O login mudou. Abra novamente o aplicativo.');await db.setLocalState('sync.config',login.config);const binding=await db.getLocalState('sync.binding');if(!ctx.legacy&&!binding&&await db.contas.count()===0){const client=new SupabaseClient(login.config,login.session,async next=>refreshLogin(login.config,next,login.epoch));const engine=new SyncEngine(db,client,ctx.owner);const cloud=await client.read();if(cloud)await engine.connect('cloud');else{const base=await db.snapshot();const revision=await client.push(0,base);await db.setLocalState('sync.binding',{owner:ctx.owner,revision,base});}}}).catch(reason=>{preparing=undefined;throw reason;})).then(() => { if (mounted) setReady(true); }).catch(reason => {
      if (mounted) setError(reason instanceof Error ? reason.message : 'Falha ao abrir o banco local.');
    });
    return () => { mounted = false; };
  }, [attempt]);
  if (ready) return <App/>;
  if(!error)return <StartupScreen/>;
  return <main className="storage-startup"><h1>ControlAI</h1>{error
    ? <><p role="alert">Não foi possível abrir seus dados: {error}</p><p>A origem dos dados não foi apagada. Não limpe os dados do aplicativo para tentar corrigir.</p><button className="primary" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></>
    : <p role="status">Abrindo seus dados…</p>}</main>;
}
