import { useEffect, useState } from 'react';
import { initializeStorage } from './db';
import App from './App';
import PasswordRecovery from './PasswordRecovery';

export default function Bootstrap() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setError('');
    initializeStorage().then(() => { if (mounted) setReady(true); }).catch(reason => {
      if (mounted) setError(reason instanceof Error ? reason.message : 'Falha ao abrir o banco local.');
    });
    return () => { mounted = false; };
  }, [attempt]);
  if (ready) return <PasswordRecovery>{openLogin=><App openLogin={openLogin||new URLSearchParams(window.location.search).get('login')==='1'}/>}</PasswordRecovery>;
  return <main className="storage-startup"><h1>ControlAI</h1>{error
    ? <><p role="alert">Não foi possível abrir seus dados: {error}</p><p>A origem dos dados não foi apagada. Não limpe os dados do aplicativo para tentar corrigir.</p><button className="primary" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></>
    : <p role="status">Abrindo seus dados…</p>}</main>;
}
