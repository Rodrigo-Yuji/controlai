import type {Lancamento,Tipo} from './db.ts';
import {matchesEntry} from './finance.ts';
export type GuestFilters={query:string;type:'todos'|Tipo;status:'todos'|'previsto'|'confirmado';card:string};
export function filterGuestEntries(entries:Lancamento[],filters:GuestFilters){return entries.filter(e=>(filters.type==='todos'||e.tipo===filters.type)&&matchesEntry(e,filters.query,filters.status,filters.card)).sort((a,b)=>b.data.localeCompare(a.data)||((b.id??0)-(a.id??0)));}
