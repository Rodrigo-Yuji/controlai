import React from 'react';
import ReactDOM from 'react-dom/client';
const Root=React.lazy(()=>new URLSearchParams(window.location.search).get('consulta')==='1'?import('./ViewerApp'):import('./Bootstrap'));
import { Capacitor } from '@capacitor/core';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><React.Suspense fallback={<main><p>Abrindo ControlAI…</p></main>}><Root/></React.Suspense></React.StrictMode>);
