import NoteText from './NoteText';
import {useState} from 'react';
import MoneyInput from './MoneyInput';
import {db,type Conta,type EmprestimoReserva,type Reserva} from './db';
import {MAX_LOAN_INSTALLMENTS,addMonths,installmentSchedule,loanInstallments,loanLateness,nextInstallment,setLoanInstallments,MAX_LOAN_PERSON_LENGTH,loanOutstanding,repaymentExtra,splitRepayment,loansByPerson,lendFromReserve,registerLoanRepayment,removeLoan,removeLoanRepayment,totalOutstanding} from './reserve-loans';
import {dataBR,hoje,moeda,paraCentavos} from './utils';

// Settled loans shown per person before "Mostrar mais".
const SETTLED_PREVIEW=3;
// Loans taken from the couple's reserve. They never create an expense, so the
// monthly variable budget is untouched; repayments go straight back to the reserve.
export default function ReserveLoansPanel({account,reserves}:{account:Conta;reserves:Reserva[]}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [person,setPerson]=useState(''),[value,setValue]=useState(''),[date,setDate]=useState(hoje()),[note,setNote]=useState(''),[before,setBefore]=useState(false);
 const [split,setSplit]=useState(false),[splitCount,setSplitCount]=useState('8'),[splitFirst,setSplitFirst]=useState('');
 const [planning,setPlanning]=useState<string|null>(null),[planCount,setPlanCount]=useState('8'),[planFirst,setPlanFirst]=useState('');
 const today=hoje();
 const [showAll,setShowAll]=useState<Set<string>>(new Set());
 const toggleSettled=(person:string)=>setShowAll(prev=>{const next=new Set(prev);if(next.has(person))next.delete(person);else next.add(person);return next;});
 const [repaying,setRepaying]=useState<string|null>(null),[repayValue,setRepayValue]=useState(''),[repayDate,setRepayDate]=useState(hoje());
 const loans=account.emprestimosReserva??[],people=loansByPerson(loans),outstanding=totalOutstanding(loans);
 const reserveBalance=reserves.reduce((sum,r)=>sum+r.valorCentavos,0),openCount=loans.filter(l=>loanOutstanding(l)>0).length,lateCount=loans.filter(l=>loanLateness(l,today).parcelas>0).length;
 async function work(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível salvar.');}finally{setBusy(false);}}
 async function lend(e:React.FormEvent){
  e.preventDefault();
  const cents=paraCentavos(value);
  if(!person.trim()){setError('Informe quem recebeu o empréstimo.');return;}
  if(!Number.isSafeInteger(cents)||cents<=0){setError('Informe um valor maior que zero.');return;}
  const parcelas=Number(splitCount),first=splitFirst||addMonths(date,1);
  if(split&&(!Number.isInteger(parcelas)||parcelas<2||parcelas>MAX_LOAN_INSTALLMENTS)){setError(`Informe de 2 a ${MAX_LOAN_INSTALLMENTS} parcelas.`);return;}
  await work(async()=>{await lendFromReserve(db,account.id,{pessoa:person,valorCentavos:cents,data:date,observacao:note,anterior:before,...(split?{parcelamento:{parcelas,primeiroVencimento:first}}:{})});setPerson('');setValue('');setNote('');setBefore(false);setSplit(false);setSplitFirst('');});
 }
 // Parcelado: sugere o valor atrasado ou, sem atraso, o que falta da próxima parcela.
 function startRepayment(loan:EmprestimoReserva,remaining:number){const late=loanLateness(loan,today),next=nextInstallment(loan,today),suggested=late.centavos>0?late.centavos:next?next.valorCentavos-next.pagoCentavos:remaining;setPlanning(null);setRepaying(loan.id);setRepayValue(suggested>0?String(suggested/100):"");setRepayDate(hoje());setError('');}
 function startPlan(loan:EmprestimoReserva){setRepaying(null);setPlanning(loan.id);setPlanCount(String(loan.parcelamento?.parcelas??8));setPlanFirst(loan.parcelamento?.primeiroVencimento??addMonths(loan.data,1));setError('');}
 async function savePlan(e:React.FormEvent,loanId:string){
  e.preventDefault();
  const parcelas=Number(planCount);
  if(!Number.isInteger(parcelas)||parcelas<2||parcelas>MAX_LOAN_INSTALLMENTS){setError(`Informe de 2 a ${MAX_LOAN_INSTALLMENTS} parcelas.`);return;}
  await work(async()=>{await setLoanInstallments(db,account.id,loanId,{parcelas,primeiroVencimento:planFirst});setPlanning(null);});
 }
 async function removePlan(loanId:string){if(!confirm('Remover o parcelamento? O valor em aberto continua igual, só deixa de ter vencimentos.'))return;await work(async()=>{await setLoanInstallments(db,account.id,loanId,undefined);setPlanning(null);});}
 async function repay(e:React.FormEvent,loanId:string){
  e.preventDefault();
  const cents=paraCentavos(repayValue);
  if(!Number.isSafeInteger(cents)||cents<=0){setError('Informe um valor maior que zero.');return;}
  await work(async()=>{await registerLoanRepayment(db,account.id,loanId,{valorCentavos:cents,data:repayDate});setRepaying(null);setRepayValue('');});
 }
 async function deleteRepayment(loanId:string,repaymentId:string){if(!confirm('Excluir esta devolução? O valor sai da reserva e volta a ficar em aberto.'))return;await work(()=>removeLoanRepayment(db,account.id,loanId,repaymentId));}
 async function deleteLoan(loanId:string,previous?:boolean){if(!confirm(previous?'Excluir este empréstimo antigo? A reserva não muda.':'Excluir este empréstimo? O valor volta para a reserva.'))return;await work(()=>removeLoan(db,account.id,loanId));}
 const renderLoan=(loan:EmprestimoReserva)=>{const remaining=loanOutstanding(loan),repaid=loan.valorCentavos-remaining,late=loanLateness(loan,today),plan=loanInstallments(loan,today),next=plan.find(p=>p.status!=='paga'),paidCount=plan.filter(p=>p.status==='paga').length;return <div className={`record loan-record ${remaining>0?'open':'settled'}${late.parcelas>0?' late':''}`} key={loan.id}><div className="recordbody">
     <div className="loan-record-head"><strong>{moeda(loan.valorCentavos)} em {dataBR(loan.data)}</strong><LoanBadge remaining={remaining} repaid={repaid} late={late.parcelas>0}/></div>
     <div className="loan-progress" role="progressbar" aria-label="Quanto já foi devolvido" aria-valuemin={0} aria-valuemax={loan.valorCentavos} aria-valuenow={repaid}><span style={{width:`${Math.min(100,repaid/loan.valorCentavos*100)}%`}}/></div>
     <small>{remaining>0?`Falta ${moeda(remaining)} · devolvido ${moeda(repaid)}`:`Devolvido ${moeda(repaid)} de ${moeda(loan.valorCentavos)}`}{loan.anterior?' · Anterior ao app':''}</small>
     {loan.parcelamento&&<small className="loan-plan">Parcelado em {plan.length}× · {paidCount} de {plan.length} paga{paidCount===1?'':'s'}{next&&late.parcelas===0?` · próxima ${next.numero}/${plan.length}: ${moeda(next.valorCentavos-next.pagoCentavos)} em ${dataBR(next.vencimento)}`:''}</small>}
     {late.parcelas>0&&<small className="loan-late" role="status">⚠ {late.parcelas} parcela{late.parcelas===1?' atrasada':'s atrasadas'} · {moeda(late.centavos)} desde {dataBR(late.desde!)}</small>}
     {loan.parcelamento&&<details className="loan-installments"><summary>Ver parcelas</summary><ol>{plan.map(p=><li key={p.numero} className={p.status}><span>{p.numero}/{plan.length} · {dataBR(p.vencimento)}</span><span>{moeda(p.valorCentavos)}{p.status==='parcial'||(p.status==='atrasada'&&p.pagoCentavos>0)?` (pago ${moeda(p.pagoCentavos)})`:''}</span><span className="installment-status">{INSTALLMENT_LABEL[p.status]}</span></li>)}</ol></details>}
     {loan.observacao&&<NoteText className="card-note" text={loan.observacao}/>}
     {loan.devolucoes.map(r=><small key={r.id}>{r.valorCentavos>0?`Devolução de ${moeda(r.valorCentavos)}`:'Valor extra'}{repaymentExtra(r)>0?` + acréscimo de ${moeda(repaymentExtra(r))}`:''} em {dataBR(r.data)} <button type="button" className="textbutton" onClick={()=>void deleteRepayment(loan.id,r.id)}>Excluir devolução</button></small>)}
     {planning===loan.id?<form className="fields" onSubmit={e=>void savePlan(e,loan.id)}>
      <div className="twocol"><label>Parcelas<input required type="number" min={2} max={MAX_LOAN_INSTALLMENTS} step={1} value={planCount} onChange={e=>setPlanCount(e.target.value)}/></label><label>1º vencimento<input required type="date" min={loan.data} value={planFirst} onChange={e=>setPlanFirst(e.target.value)}/></label></div>
      <PlanHint total={loan.valorCentavos} count={planCount} first={planFirst}/>
      <button className="primary">Salvar parcelamento</button>
      {loan.parcelamento&&<button type="button" className="secondary" onClick={()=>void removePlan(loan.id)}>Remover parcelamento</button>}
      <button type="button" className="secondary" onClick={()=>{setPlanning(null);setError('');}}>Cancelar</button>
     </form>:repaying===loan.id?<form className="fields" onSubmit={e=>void repay(e,loan.id)}>
      <label>{remaining>0?'Valor devolvido (R$)':'Valor extra recebido (R$)'}<MoneyInput autoFocus selectOnFocus required min="0.01" value={repayValue} onChange={setRepayValue}/><RepaymentHint remaining={remaining} received={paraCentavos(repayValue)}/></label>
      <label>Data da devolução<input required type="date" min={loan.data} value={repayDate} onChange={e=>setRepayDate(e.target.value)}/></label>
      <button className="primary">Registrar devolução na reserva</button>
      <button type="button" className="secondary" onClick={()=>{setRepaying(null);setError('');}}>Cancelar</button>
     </form>:<div className="button-row">
      {remaining>0?<button type="button" className="secondary" onClick={()=>startRepayment(loan,remaining)}>Registrar devolução</button>:<button type="button" className="textbutton" onClick={()=>startRepayment(loan,remaining)}>Registrar valor extra</button>}
      {remaining>0&&<button type="button" className="textbutton" onClick={()=>startPlan(loan)}>{loan.parcelamento?'Alterar parcelas':'Parcelar'}</button>}
      {loan.devolucoes.length===0&&<button type="button" className="textbutton" onClick={()=>void deleteLoan(loan.id,loan.anterior)}>Excluir empréstimo</button>}
     </div>}
    </div></div>;};
 return <details className="panel couple-budget collapsible-panel"><summary>Empréstimos da reserva</summary>
  <p className="muted">Registre dinheiro da reserva emprestado a familiares. O valor sai da reserva sem virar despesa, então não consome o orçamento variável nem entra nos relatórios de gastos. Quando a pessoa devolver, registre a devolução: o valor volta direto para a reserva.</p>
  <p>Reserva disponível: <strong>{moeda(reserveBalance)}</strong> · Em aberto com terceiros: <strong>{moeda(outstanding)}</strong></p>
  <fieldset disabled={busy} className="plain-fields">
   <form className="fields" onSubmit={lend}>
    <label>Quem recebeu<input required list="reserve-loan-people" maxLength={MAX_LOAN_PERSON_LENGTH} value={person} onChange={e=>setPerson(e.target.value)} placeholder="Nome da pessoa"/></label>
    <datalist id="reserve-loan-people">{people.map(p=><option key={p.pessoa} value={p.pessoa}/>)}</datalist>
    <label>Valor emprestado (R$)<MoneyInput required min="0.01" max={before?undefined:Math.max(0,reserveBalance)/100} value={value} onChange={setValue}/></label>
    <label>Data do empréstimo<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label className="check loan-split"><input type="checkbox" checked={split} onChange={e=>{setSplit(e.target.checked);if(e.target.checked&&!splitFirst)setSplitFirst(addMonths(date,1));}}/><span>Parcelar devolução<small>Defina em quantas vezes a pessoa vai devolver. O app mostra a próxima parcela e avisa quando alguma atrasar.</small></span></label>
    {split&&<><div className="twocol"><label>Parcelas<input required type="number" min={2} max={MAX_LOAN_INSTALLMENTS} step={1} value={splitCount} onChange={e=>setSplitCount(e.target.value)}/></label><label>1º vencimento<input required type="date" min={date} value={splitFirst} onChange={e=>setSplitFirst(e.target.value)}/></label></div><PlanHint total={paraCentavos(value)} count={splitCount} first={splitFirst}/></>}
    <label>Observação (opcional)<textarea className="note-input" rows={2} maxLength={200} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <label className="check loan-before"><input type="checkbox" checked={before} onChange={e=>setBefore(e.target.checked)}/><span>Emprestado antes de usar o ControlAI<small>Registra só a dívida, sem tirar da reserva. As devoluções entram na reserva normalmente.</small></span></label>
    <button className="primary" disabled={!before&&reserveBalance<=0}>{before?'Registrar empréstimo antigo':'Registrar empréstimo'}</button>
   </form>
   {loans.length>0&&<div className="loan-counts">{lateCount>0&&<span className="loan-badge late">{lateCount} atrasado{lateCount===1?'':'s'}</span>}<span className="loan-badge open">{openCount} em aberto</span><span className="loan-badge settled">{loans.length-openCount} quitado{loans.length-openCount===1?'':'s'}</span></div>}
   {people.length===0?<p className="muted">Nenhum empréstimo registrado.</p>:people.map(p=>{const personLate=p.emprestimos.reduce((s,l)=>s+loanLateness(l,today).centavos,0),open=p.emprestimos.filter(l=>loanOutstanding(l)>0),settled=p.emprestimos.filter(l=>loanOutstanding(l)<=0),all=showAll.has(p.pessoa),visible=all?settled:settled.slice(0,SETTLED_PREVIEW);return <details className={`panel loan-person ${p.pendenteCentavos>0?'open':'settled'}`} key={p.pessoa}>
    <summary className="loan-person-summary"><span className="loan-person-main"><strong>{p.pessoa}</strong><small>{open.length} em aberto · {settled.length} quitado{settled.length===1?'':'s'}{personLate>0?` · ${moeda(personLate)} atrasado`:''}</small></span><span className="loan-person-side">{p.pendenteCentavos>0?<><strong className="red">{moeda(p.pendenteCentavos)}</strong><LoanBadge remaining={p.pendenteCentavos} repaid={p.devolvidoCentavos} late={personLate>0}/></>:<LoanBadge remaining={0} repaid={p.devolvidoCentavos}/>}</span></summary>
    <small className="muted loan-person-totals">Emprestado {moeda(p.emprestadoCentavos)} · Devolvido {moeda(p.devolvidoCentavos)}{p.acrescimoCentavos>0?` · Acréscimo ${moeda(p.acrescimoCentavos)}`:''}</small>
    {open.map(renderLoan)}
    {settled.length>0&&<p className="loan-settled-title">Quitados{settled.length>SETTLED_PREVIEW&&!all?` · últimos ${SETTLED_PREVIEW} de ${settled.length}`:''}</p>}
    {visible.map(renderLoan)}
    {settled.length>SETTLED_PREVIEW&&<button type="button" className="textbutton loan-more" aria-expanded={all} onClick={()=>toggleSettled(p.pessoa)}>{all?'Mostrar menos':`Mostrar mais (${settled.length-SETTLED_PREVIEW})`}</button>}
   </details>;})}
  </fieldset>
  {error&&<p role="alert" className="error">{error}</p>}
 </details>;
}

// Explains how the amount typed will be split when it goes past what is still open.
function RepaymentHint({remaining,received}:{remaining:number;received:number}){
 const valid=Number.isSafeInteger(received)&&received>0,split=splitRepayment(remaining,valid?received:0);
 if(!valid||split.acrescimoCentavos<=0)return <small>Se a pessoa devolver mais do que o pendente, o excedente entra na reserva como acréscimo.</small>;
 return <small className="loan-extra-hint">{split.valorCentavos>0?`${moeda(split.valorCentavos)} quitam o empréstimo e `:''}{moeda(split.acrescimoCentavos)} entram como acréscimo na reserva.</small>;
}

const INSTALLMENT_LABEL={paga:'✓ Paga',parcial:'Parcial',atrasada:'Atrasada','a-vencer':'A vencer'} as const;
// Preview of the installments while the plan is typed.
function PlanHint({total,count,first}:{total:number;count:string;first:string}){
 const parcelas=Number(count);
 if(!Number.isSafeInteger(total)||total<=0||!Number.isInteger(parcelas)||parcelas<2||parcelas>MAX_LOAN_INSTALLMENTS||!first)return <small className="muted">Informe valor, parcelas e 1º vencimento para ver as parcelas.</small>;
 const s=installmentSchedule(total,{parcelas,primeiroVencimento:first}),same=s.every(p=>p.valorCentavos===s[0].valorCentavos);
 return <small className="loan-plan">{parcelas}× de {moeda(s.at(-1)!.valorCentavos)}{same?'':` (as primeiras com ${moeda(s[0].valorCentavos)})`} · de {dataBR(s[0].vencimento)} a {dataBR(s.at(-1)!.vencimento)}</small>;
}

// Status pill: Quitado (green), Atrasado (red, installment past due), Parcial (amber) or Em aberto (red).
function LoanBadge({remaining,repaid,late}:{remaining:number;repaid:number;late?:boolean}){
 if(remaining<=0)return <span className="loan-badge settled">✓ Quitado</span>;
 if(late)return <span className="loan-badge late">⚠ Atrasado</span>;
 return <span className={`loan-badge ${repaid>0?'partial':'open'}`}>{repaid>0?'Parcial':'Em aberto'}</span>;
}
