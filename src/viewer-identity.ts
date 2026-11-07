import type {Conta,Salario} from './db.ts';
export interface ViewerIdentity{pessoa_id:string;nome:string}
export function viewerIdentityOptions(account:Conta,salaries:Salario[]):ViewerIdentity[]{
 if(account.tipo==='gestora')return(account.pessoas??[]).map(p=>({pessoa_id:p.id,nome:p.nome}));
 if(account.tipo==='casal'||(!account.tipo&&account.conjunta))return[1,2].map(n=>({pessoa_id:'titular:'+n,nome:salaries.find(s=>s.contaId===account.id&&s.id===account.id+':'+n)?.titular?.trim()||'Titular '+n}));
 return[];
}
export function resolveViewerIdentity(value:unknown,account:Conta,salaries:Salario[]):ViewerIdentity|null{
 if(!value||typeof value!=='object'||typeof(value as ViewerIdentity).pessoa_id!=='string')return null;
 return viewerIdentityOptions(account,salaries).find(p=>p.pessoa_id===(value as ViewerIdentity).pessoa_id)??null;
}
