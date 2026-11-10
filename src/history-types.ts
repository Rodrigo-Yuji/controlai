export interface HistoryRow{id:number;account_id:string;entity:string;entity_id:string;action:'criado'|'alterado'|'excluido'|'restaurado';label:string;actor_email:string;created_at:string;changes:Record<string,unknown>;recoverable:boolean;trash_until:string|null;restored_at:string|null}
export interface HistoryPage{rows:HistoryRow[];total:number;has_more:boolean;stored_bytes:number}
