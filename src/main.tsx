import React from 'react';
import ReactDOM from 'react-dom/client';
import Bootstrap from './Bootstrap';
import { Capacitor } from '@capacitor/core';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Bootstrap/></React.StrictMode>);
