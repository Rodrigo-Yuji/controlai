import type {EntryRequest} from './requests.ts';
export function unseenPendingRequests(rows:EntryRequest[],seen:string[]){const known=new Set(seen);return rows.filter(row=>row.status==='pendente'&&!known.has(row.id));}
export function rememberRequestIds(seen:string[],rows:EntryRequest[]){return [...new Set([...seen,...rows.map(row=>row.id)])];}
