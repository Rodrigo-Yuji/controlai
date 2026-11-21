import {accountType} from './finance.ts';
import type {Conta,EmprestimoFamiliar} from './db.ts';
import {validDate} from './assistant.ts';

export function loanPaid(loan:EmprestimoFamiliar){return loan.devolucoes.reduce((sum,payment)=>sum+payment.valorCentavos,0);}
export function loanOutstanding(loan:EmprestimoFamiliar){return loan.valorCentavos-loanPaid(loan);}

export function validateFamilyLoans(account:Conta){
 const loans=account.emprestimosFamiliares??[];
 if(loans.length&&accountType(account)!=='casal')throw Error('Empréstimos familiares exigem uma conta Casal.');
 const loanIds=new Set<string>();
 for(const loan of loans){
  if(!loan.id||loanIds.has(loan.id)||!loan.pessoa.trim()||!validDate(loan.data)||!Number.isSafeInteger(loan.valorCentavos)||loan.valorCentavos<=0||!Array.isArray(loan.devolucoes))throw Error('Empréstimo familiar inválido.');
  loanIds.add(loan.id);const paymentIds=new Set<string>();
  for(const payment of loan.devolucoes){if(!payment.id||paymentIds.has(payment.id)||!validDate(payment.data)||!Number.isSafeInteger(payment.valorCentavos)||payment.valorCentavos<=0)throw Error('Devolução de empréstimo inválida.');paymentIds.add(payment.id);}
  if(loanPaid(loan)>loan.valorCentavos)throw Error('Devoluções ultrapassam o valor emprestado.');
 }
}
