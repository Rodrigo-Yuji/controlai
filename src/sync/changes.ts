import type {TableName} from '../storage/types.ts';
import {TABLE_NAMES} from '../storage/types.ts';
import {stable} from './snapshot.ts';
interface Change{table:TableName;id:string|number;before?:Record<string,unknown>;after?:Record<string,unknown>}
const clean=(row:unknown)=>{const copy=JSON.parse(JSON.stringify(row)) as Record<string,unknown>;delete copy.atividades;return copy;};
export function changesBetween(before:Partial<Record<TableName,unknown[]>>,after:Partial<Record<TableName,unknown[]>>){const changes:Change[]=[];for(const table of TABLE_NAMES){if(!before[table])continue;const old=new Map(before[table]!.map(r=>{const row=clean(r);return [row.id,row];})),next=new Map((after[table]||[]).map(r=>{const row=clean(r);return [row.id,row];}));for(const id of new Set([...old.keys(),...next.keys()])){const a=old.get(id),b=next.get(id);if(stable(a)!==stable(b))changes.push({table,id:id as string|number,...(a?{before:a}:{}),...(b?{after:b}:{})});}}return changes;}
