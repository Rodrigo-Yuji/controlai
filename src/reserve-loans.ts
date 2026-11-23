import {validDate} from './assistant.ts';
import {ensureOpenMonth} from './account-guards.ts';
import {MAIN_RESERVE,rowsOfBox} from './reserve-boxes.ts';
import type {Conta,DevolucaoEmprestimo,EmprestimoReserva,ParcelamentoEmprestimo,Reserva} from './db.ts';
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
// Extra paid on top of the amount lent (a thank-you or interest). It also goes to the reserve.
export const repaymentExtra=(r:DevolucaoEmprestimo)=>r.acrescimoCentavos??0;
export const repaymentTotal=(r:DevolucaoEmprestimo)=>r.valorCentavos+repaymentExtra(r);
export const loanExtra=(loan:EmprestimoReserva)=>loan.devolucoes.reduce((sum,r)=>sum+repaymentExtra(r),0);
// Splits what the person handed back into the part that pays the loan and the extra.
export const splitRepayment=(outstanding:number,received:number)=>{const principal=Math.max(0,Math.min(outstanding,received));return {valorCentavos:principal,acrescimoCentavos:received-principal};};

// Installment plan: the person returns the loan in N monthly parts. The plan is only
// a schedule; repayments keep being registered as before and are applied to the
// installments in order, so an installment past its due date and not fully paid is late.
export const MAX_LOAN_INSTALLMENTS=60;
export type InstallmentStatus='paga'|'parcial'|'atrasada'|'a-vencer';
export interface LoanInstallment{numero:number;vencimento:string;valorCentavos:number;pagoCentavos:number;status:InstallmentStatus}
// Same day N months later; days past the end of a month fall on its last day.
export function addMonths(date:string,months:number){
 const [y,m,d]=date.split('-').map(Number),first=new Date(Date.UTC(y,m-1+months,1));
 const last=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 return `${first.toISOString().slice(0,7)}-${String(Math.min(d,last)).padStart(2,'0')}`;
}
// Splits the amount in equal parts; leftover cents go to the first installments.
export function installmentSchedule(totalCentavos:number,plan:ParcelamentoEmprestimo){
 const base=Math.floor(totalCentavos/plan.parcelas),rest=totalCentavos-base*plan.parcelas;
 return Array.from({length:plan.parcelas},(_,i)=>({numero:i+1,vencimento:addMonths(plan.primeiroVencimento,i),valorCentavos:base+(i<rest?1:0)}));
}
export function loanInstallments(loan:EmprestimoReserva,today:string):LoanInstallment[]{
 if(!loan.parcelamento)return [];
 let paid=loanRepaid(loan);
 return installmentSchedule(loan.valorCentavos,loan.parcelamento).map(p=>{
  const pagoCentavos=Math.min(p.valorCentavos,paid);paid-=pagoCentavos;
  const status:InstallmentStatus=pagoCentavos>=p.valorCentavos?'paga':p.vencimento<today?'atrasada':pagoCentavos>0?'parcial':'a-vencer';
  return {...p,pagoCentavos,status};
 });
}
export interface LoanLateness{parcelas:number;centavos:number;desde?:string}
export function loanLateness(loan:EmprestimoReserva,today:string):LoanLateness{
 const late=loanInstallments(loan,today).filter(p=>p.status==='atrasada');
 return {parcelas:late.length,centavos:late.reduce((s,p)=>s+p.valorCentavos-p.pagoCentavos,0),desde:late[0]?.vencimento};
}
export const nextInstallment=(loan:EmprestimoReserva,today:string)=>loanInstallments(loan,today).find(p=>p.status!=='paga');
function validatePlan(plan:unknown,loanDate:string){
 if(plan===undefined)return;
 const p=plan as ParcelamentoEmprestimo;
 if(!p||typeof p!=='object'||!Number.isSafeInteger(p.parcelas)||p.parcelas<2||p.parcelas>MAX_LOAN_INSTALLMENTS)throw Error(`Informe de 2 a ${MAX_LOAN_INSTALLMENTS} parcelas.`);
 if(!validDate(p.primeiroVencimento)||p.primeiroVencimento<loanDate)throw Error('O primeiro vencimento precisa ser uma data válida, a partir do dia do empréstimo.');
}

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
  if(loan.caixinhaId!==undefined&&(typeof loan.caixinhaId!=='string'||!account.caixinhas?.some(c=>c.id===loan.caixinhaId)))throw Error('Caixinha do empréstimo não encontrada.');
  validatePlan(loan.parcelamento,loan.data);
  if(!Array.isArray(loan.devolucoes))throw Error('Devoluções do empréstimo inválidas.');
  let repaid=0;
  for(const repayment of loan.devolucoes){
   unique(repayment.id);
   const extra=repayment.acrescimoCentavos;
   if(extra!==undefined&&!positiveCents(extra))throw Error('Acréscimo da devolução inválido.');
   const principalOk=positiveCents(repayment.valorCentavos)||(repayment.valorCentavos===0&&extra!==undefined);
   if(!principalOk||!validDate(repayment.data)||repayment.data<loan.data)throw Error('Devolução com valor ou data inválidos.');
   repaid+=repayment.valorCentavos;
  }
  if(repaid>loan.valorCentavos)throw Error('A devolução ultrapassa o valor emprestado.');
 }
}

export interface PersonLoanSummary{pessoa:string;emprestadoCentavos:number;devolvidoCentavos:number;pendenteCentavos:number;acrescimoCentavos:number;emprestimos:EmprestimoReserva[]}
// Groups by person (case/accents ignored). Only movements up to `through` count.
export function loansByPerson(loans:readonly EmprestimoReserva[]=[],through='9999-12-31'):PersonLoanSummary[]{
 const groups=new Map<string,PersonLoanSummary>();
 for(const original of loans){
  if(original.data>through)continue;
  const loan={...original,devolucoes:original.devolucoes.filter(r=>r.data<=through)};
  const key=personKey(loan.pessoa),group=groups.get(key)??{pessoa:normalizePerson(loan.pessoa),emprestadoCentavos:0,devolvidoCentavos:0,pendenteCentavos:0,acrescimoCentavos:0,emprestimos:[]};
  group.emprestadoCentavos+=loan.valorCentavos;group.devolvidoCentavos+=loanRepaid(loan);group.acrescimoCentavos+=loanExtra(loan);group.pendenteCentavos=group.emprestadoCentavos-group.devolvidoCentavos;group.emprestimos.push(loan);groups.set(key,group);
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
  for(const r of loan.devolucoes)if(r.data<=through&&(!from||r.data>=from))total-=repaymentTotal(r);
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
// Rows of the reserve the loan belongs to (main reserve or one caixinha).
const reserveRows=async(tx:Pick<Database,'reservas'>,accountId:string,boxId=MAIN_RESERVE)=>rowsOfBox(await tx.reservas.where('contaId').equals(accountId).toArray(),boxId);
const boxTag=(boxId?:string)=>boxId?{caixinhaId:boxId}:{};

// `anterior`: money lent before using the app. It is tracked as a debt but never
// leaves the reserve; repayments still go to the reserve.
// `caixinhaId`: the money leaves that caixinha and repayments go back to it.
export interface NewLoan{pessoa:string;valorCentavos:number;data:string;observacao?:string;anterior?:boolean;parcelamento?:ParcelamentoEmprestimo;caixinhaId?:string}
export async function lendFromReserve(db:Store,accountId:string,input:NewLoan,newId:()=>string=()=>crypto.randomUUID()){
 const pessoa=normalizePerson(input.pessoa),observacao=input.observacao?.trim();
 if(!pessoa||pessoa.length>MAX_LOAN_PERSON_LENGTH)throw Error('Informe quem recebeu o empréstimo (até 60 caracteres).');
 if(!positiveCents(input.valorCentavos))throw Error('Informe um valor maior que zero.');
 if(!validDate(input.data))throw Error('Informe uma data válida.');
 validatePlan(input.parcelamento,input.data);
 return db.transaction(stores(db),async tx=>{
  const account=await coupleAccount(tx,accountId);
  await ensureOpenMonth(tx,accountId,input.data);
  const box=input.caixinhaId||MAIN_RESERVE;
  if(box&&!account.caixinhas?.some(c=>c.id===box))throw Error('Caixinha não encontrada. Reabra a reserva.');
  if(!input.anterior){const rows=await reserveRows(tx,accountId,box);
  if(!reserveStaysNonNegative([...rows,{data:input.data,valorCentavos:-input.valorCentavos}]))throw Error('Saldo insuficiente nesta reserva para este empréstimo. Se o empréstimo foi feito antes de usar o ControlAI, marque essa opção.');}
  const loan:EmprestimoReserva={id:newId(),pessoa,valorCentavos:input.valorCentavos,data:input.data,...(observacao?{observacao}:{}),devolucoes:[],...(input.anterior?{anterior:true as const}:{}),...(input.parcelamento?{parcelamento:{parcelas:input.parcelamento.parcelas,primeiroVencimento:input.parcelamento.primeiroVencimento}}:{}),...boxTag(box)};
  await save(tx,account,[...(account.emprestimosReserva??[]),loan]);
  if(!input.anterior)await tx.reservas.add({contaId:accountId,descricao:`Empréstimo para ${pessoa}`,valorCentavos:-input.valorCentavos,data:input.data,emprestimoId:loan.id,...boxTag(box)});
  return loan;
 });
}

// `valorCentavos` is everything the person handed back; what goes beyond the
// open balance is stored as `acrescimoCentavos` and also enters the reserve.
export interface NewRepayment{valorCentavos:number;data:string}
export async function registerLoanRepayment(db:Store,accountId:string,loanId:string,input:NewRepayment,newId:()=>string=()=>crypto.randomUUID()){
 if(!positiveCents(input.valorCentavos))throw Error('Informe um valor maior que zero.');
 if(!validDate(input.data))throw Error('Informe uma data válida.');
 return db.transaction(stores(db),async tx=>{
  const account=await coupleAccount(tx,accountId),loans=account.emprestimosReserva??[],loan=loans.find(l=>l.id===loanId);
  if(!loan)throw Error('Empréstimo não encontrado. Reabra a lista.');
  if(input.data<loan.data)throw Error('A devolução não pode ser anterior ao empréstimo.');
  const split=splitRepayment(loanOutstanding(loan),input.valorCentavos);
  await ensureOpenMonth(tx,accountId,input.data);
  const repayment:DevolucaoEmprestimo={id:newId(),data:input.data,valorCentavos:split.valorCentavos,...(split.acrescimoCentavos>0?{acrescimoCentavos:split.acrescimoCentavos}:{})};
  await save(tx,account,loans.map(l=>l.id===loanId?{...l,devolucoes:[...l.devolucoes,repayment]}:l));
  await tx.reservas.add({contaId:accountId,descricao:`Devolução de ${loan.pessoa}${split.acrescimoCentavos>0?' (com acréscimo)':''}`,valorCentavos:input.valorCentavos,data:input.data,emprestimoId:loanId,devolucaoId:repayment.id,...boxTag(loan.caixinhaId)});
  return repayment;
 });
}

export async function removeLoanRepayment(db:Store,accountId:string,loanId:string,repaymentId:string){
 return db.transaction(stores(db),async tx=>{
  const account=await coupleAccount(tx,accountId),loans=account.emprestimosReserva??[],loan=loans.find(l=>l.id===loanId),repayment=loan?.devolucoes.find(r=>r.id===repaymentId);
  if(!loan||!repayment)throw Error('Devolução não encontrada. Reabra a lista.');
  await ensureOpenMonth(tx,accountId,repayment.data);
  const rows=await reserveRows(tx,accountId,loan.caixinhaId),linked=rows.filter(r=>r.emprestimoId===loanId&&r.devolucaoId===repaymentId);
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
  const linked=(await tx.reservas.where('contaId').equals(accountId).toArray()).filter(r=>r.emprestimoId===loanId);
  await save(tx,account,loans.filter(l=>l.id!==loanId));
  for(const row of linked)if(row.id!==undefined)await tx.reservas.delete(row.id);
 });
}

// Adds, changes or (with undefined) removes the installment plan of a loan. It only
// changes the schedule: no money moves, so the reserve and closed months are untouched.
export async function setLoanInstallments(db:Store,accountId:string,loanId:string,plan:ParcelamentoEmprestimo|undefined){
 return db.transaction(stores(db),async tx=>{
  const account=await coupleAccount(tx,accountId),loans=account.emprestimosReserva??[],loan=loans.find(l=>l.id===loanId);
  if(!loan)throw Error('Empréstimo não encontrado. Reabra a lista.');
  validatePlan(plan,loan.data);
  await save(tx,account,loans.map(l=>{if(l.id!==loanId)return l;const next={...l};if(plan)next.parcelamento={parcelas:plan.parcelas,primeiroVencimento:plan.primeiroVencimento};else delete next.parcelamento;return next;}));
 });
}

// Changes which reserve a loan belongs to: its withdrawal and repayments move
// together, so the total reserve is the same and only the two balances change.
export async function setLoanBox(db:Store,accountId:string,loanId:string,boxId:string){
 return db.transaction(stores(db),async tx=>{
  const account=await coupleAccount(tx,accountId),loans=account.emprestimosReserva??[],loan=loans.find(l=>l.id===loanId);
  if(!loan)throw Error('Empréstimo não encontrado. Reabra a lista.');
  if(boxId&&!account.caixinhas?.some(c=>c.id===boxId))throw Error('Caixinha não encontrada. Reabra a reserva.');
  const from=loan.caixinhaId??MAIN_RESERVE;
  if(from===boxId)return;
  const all=await tx.reservas.where('contaId').equals(accountId).toArray(),linked=all.filter(r=>r.emprestimoId===loanId);
  const moved=all.map(r=>r.emprestimoId===loanId?{...r,caixinhaId:boxId||undefined}:r);
  if(!reserveStaysNonNegative(rowsOfBox(moved,boxId))||!reserveStaysNonNegative(rowsOfBox(moved,from)))throw Error('Trocar a caixinha deixaria uma das reservas negativa em alguma data.');
  await save(tx,account,loans.map(l=>{if(l.id!==loanId)return l;const next={...l};if(boxId)next.caixinhaId=boxId;else delete next.caixinhaId;return next;}));
  for(const row of linked)if(row.id!==undefined){const next={...row};if(boxId)next.caixinhaId=boxId;else delete next.caixinhaId;await tx.reservas.put(next);}
 });
}
