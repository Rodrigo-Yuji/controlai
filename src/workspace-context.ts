import type {Login} from './workspace-session.ts';
export interface PersonalContext {name:string;owner?:string;login?:Login;legacy:boolean}
let context:PersonalContext={name:'ControlAI',legacy:true};
export function setPersonalContext(next:PersonalContext){context=next;}
export function personalContext(){return context;}
export const LEGACY_OWNER='controlai.legacy.owner';
export function profileStorageName(owner:string){return 'controlai_u_'+Array.from(new TextEncoder().encode(owner),b=>b.toString(16).padStart(2,'0')).join('');}
export function personalPreferenceKey(key:string){const owner=context.owner;return owner?key+':'+owner:key;}
