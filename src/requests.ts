export interface EntryRequest{id:string;owner:string;account_id:string;requester:string;requester_email:string;payload:{reembolsoPessoaId?:string;descricao:string;tipo:'receita'|'despesa';status:'previsto'|'confirmado';data:string;valorCentavos:number;observacao:string};status:'pendente'|'aprovado'|'recusado'|'cancelado';display_state?:RequestVisualState;reimbursement_remaining?:number;reimbursement_paid?:number;receipt_path?:string;created_at:string;resolved_at?:string;reason?:string}

export type RequestVisualState='pendente'|'aprovada'|'concluida'|'recusada'|'cancelada'|'reembolso_pendente';
export interface RequestOverview{active:EntryRequest[];history:EntryRequest[];history_count:number;pending_count:number}
