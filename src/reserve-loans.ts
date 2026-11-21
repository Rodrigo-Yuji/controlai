import {validDate} from './assistant.ts';
import {ensureOpenMonth} from './account-guards.ts';
import type {Conta,DevolucaoEmprestimo,EmprestimoReserva,Reserva} from './db.ts';
import type {Database} from './storage/types.ts';

// Family loans taken from the couple's reserve.
//
// A loan is NOT an expense: it never becomes a Lancamento, so it stays out of the
// monthly variable budget, weekly budget, categories and reports. It lives in the
// account document (Conta.emprestimosReserva), which already travels with backups
// and Supabase synchronization, and it is mirrored in the reserve table by one
// withdrawal (loan) or one deposit (repayment) tagged with emprestimoId, so every
// existing reserve total keeps working.
export const MAX_LOAN_PERSON_LENGTH=60;
const isCouple=(account:Pick<Conta,'tipo'|'conjunta'>)=>account.tipo==='casal'||(!account.tipo&&account.conjunta);
const positiveCents=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;

export const normalizePerson=(name:string)=>name.replace(/\s+/g,' ').trim();
export const personKey=(name:string)=>normalizePerson(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const loanRepaid=(loan:EmprestimoReserva)=>loan.devolucoes.reduce((sum,r)=>sum+r.valorCentavos,0);
export const loanOutstanding=(loan:EmprestimoReserva)=>loan.valorCentavos-loanRepaid(loan);

export function validateReserveLoans(account:Conta){
 const loans=account.emprestimosReserva;
 if(loans===undefined)return;
 if(!Array.isArray(loans))throw Error('Empréstimos da reserva inválidos.');
 if(loans.length>0&&!isCouple(account))throw Error('Empréstimos da reserva exigem uma conta Casal.');
 const ids=new Set<string>();
 const unique=(id:unknown)=>{if(typeof id!=='string'||!id||ids.has(id))throw Error('Identificador de empréstimo inválido ou repetido.');ids.add(id);};
 for(const loan of loans){
  unique(loan.id);
  const person=typeof loan.pessoa==='string'?normalizePerson(loan.pessoa):'';
  if(!person||person.length>MAX_LOAN_PERSON_LENGTH)throw Error('Informe quem recebeu o empréstimo (até 60 caracteres).');
  if(!positiveCents(loan.valorCentavos)||!validDate(loan.data))throw Error('Empréstimo com valor ou data inválidos.');
  if(loan.observacao!==undefined&&(typeof loan.observacao!=='string'||loan.observacao.length>200))throw Error('Observação do empréstimo inválida.');
  if(loan.anterior!==undefined&&loan.anterior!==true)throw Error('Marcação de empréstimo anterior inválida.');
  if(!Array.isArray(loan.devolucoes))throw Error('Devoluções do empréstimo inválidas.');
  let repaid=0;
  for(const repayment of loan.devolucoes){
   unique(repayment.id);
   if(!positiveCents(repayment.valorCentavos)||!validDate(repayment.data)||repayment.data<loan.data)throw Error('Devolução com valor ou data inválidos.');
   repaid+=repayment.valorCentavos;
  }
  if(repaid>loan.valorCentavos)throw Error('A devolução ultrapassa o valor emprestado.');
 }
}

export interface PersonLoanSummary{pessoa:string;emprestadoCentavos:number;devolvidoCentavos:number;pendenteCentavos:number;emprestimos:EmprestimoReserva[]}
// Groups by person (case/accents ignored). Only movements up to `through` count.
export function loansByPerson(loans:readonly EmprestimoReserva[]=[],through='9999-12-31'):PersonLoanSummary[]{
 const groups=new Map<string,PersonLoanSummary>();
 for(const original of loans){
  if(original.data>through)continue;
  const loan={...original,devolucoes:original.devolucoes.filter(r=>r.data<=through)};
  const key=personKey(loan.pessoa),group=groups.get(key)??{pessoa:normalizePerson(loan.pessoa),emprestadoCentavos:0,devolvidoCentavos:0,pendenteCentavos:0,emprestimos:[]};
  group.emprestadoCentavos+=loan.valorCentavos;group.devolvidoCentavos+=loanRepaid(loan);group.pendenteCentavos=group.emprestadoCentavos-group.devolvidoCentavos;group.emprestimos.push(loan);groups.set(key,group);
 }
 return [...groups.values()].map(g=>({...g,emprestimos:[...g.emprestimos].sort((a,b)=>b.data.localeCompare(a.data))})).sort((a,b)=>b.pendenteCentavos-a.pendenteCentavos||a.pessoa.localeCompare(b.pessoa,'pt-BR'));
}
export const totalOutstanding=(loans:readonly EmprestimoReserva[]=[],through='9999-12-31')=>loansByPerson(loans,through).reduce((sum,p)=>sum+p.pendenteCentavos,0);

// Money lent and not yet returned has left the account: it reduces the total
// balance by exactly what it takes out of the reserve, so the spendable balance
// (total minus reserve) is unchanged by a loan or a repayment. A loan made before
// the app (`anterior`) never left the recorded money, so only its repayments count.
export function netLent(loans:readonly EmprestimoReserva[]=[],through:string,from?:string){
 let total=0;
 for(const loan of loans){
  if(!loan.anterior&&loan.data<=through&&(!from||loan.data>=from))total+=loan.valorCentavos;
  for(const r of loan.devolucoes)if(r.data<=through&&(!from||r.data>=from))total-=r.valorCentavos;
 }
 return total;
}

// The reserve may never go below zero on any date, deposits first on the same day.
export function reserveStaysNonNegative(rows:readonly Pick<Reserva,'data'|'valorCentavos'>[]){
 let balance=0;
 for(const row of [...rows].sort((a,b)=>a.data.localeCompare(b.data)||b.valorCentavos-a.valorCentavos)){balance+=row.valorCentavos;if(balance<0)return false;}
 return true;
}

type Store=Pick<Database,'transaction'|'contas'|'reservas'|'fechamentos'>;
const stores=(db:Store)=>[db.contas,db.reservas,db.fechamentos];
async function coupleAccount(tx:Pick<Database,'contas'>,accountId:string){
 const account=await tx.contas.get(accountId);
 if(!account)throw Error('Conta não encontrada.');
 if(!isCouple(account))throw Error('Empréstimos da reserva exigem uma conta Casal.');
 return account;
}
async function save(tx:Pick<Database,'contas'>,account:Conta,loans:EmprestimoReserva[]){
 const next={...account,emprestimosReserva:loans};
 validateReserveLoans(next);
 await tx.contas.update(account.id,{emprestimosReserva:loans});
}
const reserveRows=(tx:Pick<Database,'reservas'>,accountId:string)=>tx.reservas.where('contaId').equals(accountId).toArray();

// `anterior`: money lent before using the app. It is tracked as a debt but never
// leaves the reserve; repayments still go to the reserve.
export interface NewLoan{pessoa:string;valorCentavos:number;data:string;observacao?:string;anterior?:boolean}
export async function lendFromReserve(db:Store,accountId:string,input:NewLoan,newId:()=>string=()=>crypto.randomUUID()){
 const pessoa=normalizePerson(input.pessoa),observacao=input.observacao?.trim();
 if(!pessoa||pessoa.length>MAX_LOAN_PERSON_LENGTH)throw Error('Informe quem recebeu o empréstimo (até 60 caracteres).');
 if(!positiveCents(input.valorCentavos))throw Error('Informe um valor maior que zero.');
 if(!validDate(input.data))throw Error('Informe uma data válida.');
 return db.transaction(stores(db),async tx=>{
  const account=await coupleAccount(tx,accountId);
  await ensureOpenMonth(tx,accountId,input.data);
  if(!input.anterior){const rows=await reserveRows(tx,accountId);
  if(!reserveStaysNonNegative([...rows,{data:input.data,valorCentavos:-input.valorCentavos}]))throw Error('Saldo da reserva insuficiente para este empréstimo. Se o empréstimo foi feito antes de usar o ControlAI, marque essa opção.');}
  const loan:EmprestimoReserva={id:newId(),pessoa,valorCentavos:input.valorCentavos,data:input.data,...(observacao?{observacao}:{}),devolucoes:[],...(input.anterior?{anterior:true as const}:{})};
  await save(tx,account,[...(account.emprestimosReserva??[]),loan]);
  if(!input.anterior)await tx.reservas.add({contaId:accountId,descricao:`Empréstimo para ${pessoa}`,valorCentavos:-input.valorCentavos,data:input.data,emprestimoId:loan.id});
  return loan;
 });
}

export interface NewRepayment{valorCentavos:number;data:string}
export async function registerLoanRepayment(db:Store,accountId:string,loanId:string,input:NewRepayment,newId:()=>string=()=>crypto.randomUUID()){
 if(!positiveCents(input.valorCentavos))throw Error('Informe um valor maior que zero.');
 if(!validDate(input.data))throw Error('Informe uma data válida.');
 return db.transaction(stores(db),async tx=>{
  const account=await coupleAccount(tx,accountId),loans=account.emprestimosReserva??[],loan=loans.find(l=>l.id===loanId);
  if(!loan)throw Error('Empréstimo não encontrado. Reabra a lista.');
  if(input.data<loan.data)throw Error('A devolução não pode ser anterior ao empréstimo.');
  if(input.valorCentavos>loanOutstanding(loan))throw Error('A devolução ultrapassa o valor que ainda está em aberto.');
  await ensureOpenMonth(tx,accountId,input.data);
  const repayment:DevolucaoEmprestimo={id:newId(),data:input.data,valorCentavos:input.valorCentavos};
  await save(tx,account,loans.map(l=>l.id===loanId?{...l,devolucoes:[...l.devolucoes,repayment]}:l));
  await tx.reservas.add({contaId:accountId,descricao:`Devolução de ${loan.pessoa}`,valorCentavos:input.valorCentavos,data:input.data,emprestimoId:loanId,devolucaoId:repayment.id});
  return repayment;
 });
}

export async function removeLoanRepayment(db:Store,accountId:string,loanId:string,repaymentId:string){
 return db.transaction(stores(db),async tx=>{
  const account=await coupleAccount(tx,accountId),loans=account.emprestimosReserva??[],loan=loans.find(l=>l.id===loanId),repayment=loan?.devolucoes.find(r=>r.id===repaymentId);
  if(!loan||!repayment)throw Error('Devolução não encontrada. Reabra a lista.');
  await ensureOpenMonth(tx,accountId,repayment.data);
  const rows=await reserveRows(tx,accountId),linked=rows.filter(r=>r.emprestimoId===loanId&&r.devolucaoId===repaymentId);
  const remaining=rows.filter(r=>!linked.includes(r));
  if(!reserveStaysNonNegative(remaining))throw Error('Excluir esta devolução deixaria a reserva negativa em alguma data. Ajuste as retiradas posteriores primeiro.');
  await save(tx,account,loans.map(l=>l.id===loanId?{...l,devolucoes:l.devolucoes.filter(r=>r.id!==repaymentId)}:l));
  for(const row of linked)if(row.id!==undefined)await tx.reservas.delete(row.id);
 });
}

export async function removeLoan(db:Store,accountId:string,loanId:string){
 return db.transaction(stores(db),async tx=>{
  const account=await coupleAccount(tx,accountId),loans=account.emprestimosReserva??[],loan=loans.find(l=>l.id===loanId);
  if(!loan)throw Error('Empréstimo não encontrado. Reabra a lista.');
  if(loan.devolucoes.length>0)throw Error('Exclua primeiro as devoluções deste empréstimo.');
  await ensureOpenMonth(tx,accountId,loan.data);
  const linked=(await reserveRows(tx,accountId)).filter(r=>r.emprestimoId===loanId);
  await save(tx,account,loans.filter(l=>l.id!==loanId));
  for(const row of linked)if(row.id!==undefined)await tx.reservas.delete(row.id);
 });
}
