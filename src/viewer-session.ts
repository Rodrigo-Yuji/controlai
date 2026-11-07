import {readLogin,refreshLogin,clearLogin,hasUsedLogin} from './workspace-session.ts';
import type {Session} from './sync/client';
const KEY='controlai.viewer.session',PREF='controlai.viewer.auto-login';
export function viewerAutoLogin(){return localStorage.getItem(PREF)==='true';}
export function setViewerAutoLogin(remember:boolean){localStorage.setItem(PREF,String(remember));}
export function readViewerSession():Session|null{const login=readLogin();if(login)return login.session;if(hasUsedLogin())return null;try{const s=JSON.parse(sessionStorage.getItem(KEY)||localStorage.getItem(KEY)||'null');return s?.access_token&&s?.refresh_token&&s?.user?.id&&Number.isFinite(s.expires_at)?s:null;}catch{return null;}}
export function saveViewerSession(session:Session|null){const login=readLogin();if(login){if(session)refreshLogin(login.config,session,login.epoch);else clearLogin();return;}if(session&&hasUsedLogin())throw Error('O login foi encerrado. Entre novamente.');sessionStorage.removeItem(KEY);localStorage.removeItem(KEY);if(session)(viewerAutoLogin()?localStorage:sessionStorage).setItem(KEY,JSON.stringify(session));}
export function viewerChoiceKey(user:string){return 'controlai.viewer.account:'+user;}
