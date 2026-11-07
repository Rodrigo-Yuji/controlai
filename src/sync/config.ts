import {validateConfig} from './client';
// Supabase publishable keys are public identifiers, never administrative secrets.
export const defaultSyncConfig={
 url:'https://ipjsyzwwfbnxuegbnowc.supabase.co',
 key:'sb_publishable_QvBCwyfA1iqp4t4tIDmhWQ_YaMH5vTs',
};

export function configuredLogin(){try{return validateConfig(JSON.parse(localStorage.getItem('controlai.login.config')||'null'));}catch{return defaultSyncConfig;}}
