import NoteText from './NoteText';
import {useState} from 'react';
import MoneyInput from './MoneyInput';
import {db,type Conta,type Reserva} from './db';
import {MAX_LOAN_PERSON_LENGTH,loanOutstanding,loansByPerson,lendFromReserve,registerLoanRepayment,removeLoan,removeLoanRepayment,totalOutstanding} from './reserve-loans';
import {dataBR,hoje,moeda,paraCentavos} from './utils';

// Loans taken from the couple's reserve. They never create an expense, so the
// monthly variable budget is untouched; repayments go straight back to the reserve.
export default function ReserveLoansPanel({account,reserves}:{account:Conta;reserves:Reserva[]}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [person,setPerson]=useState(''),[value,setValue]=useState(''),[date,setDate]=useState(hoje()),[note,setNote]=useState(''),[before,setBefore]=useState(false);
 const [repaying,setRepaying]=useState<string|null>(null),[repayValue,setRepayValue]=useState(''),[repayDate,setRepayDate]=useState(hoje());
 const loans=account.emprestimosReserva??[],people=loansByPerson(loans),outstanding=totalOutstanding(loans);
 const reserveBalance=reserves.reduce((sum,r)=>sum+r.valorCentavos,0);
 async function work(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível salvar.');}finally{setBusy(false);}}
 async function lend(e:React.FormEvent){
  e.preventDefault();
  const cents=paraCentavos(value);
  if(!person.trim()){setError('Informe quem recebeu o empréstimo.');return;}
  if(!Number.isSafeInteger(cents)||cents<=0){setError('Informe um valor maior que zero.');return;}
  await work(async()=>{await lendFromReserve(db,account.id,{pessoa:person,valorCentavos:cents,data:date,observacao:note,anterior:before});setPerson('');setValue('');setNote('');setBefore(false);});
 }
 function startRepayment(loanId:string,remaining:number){setRepaying(loanId);setRepayValue(String(remaining/100));setRepayDate(hoje());setError('');}
 async function repay(e:React.FormEvent,loanId:string){
  e.preventDefault();
  const cents=paraCentavos(repayValue);
  if(!Number.isSafeInteger(cents)||cents<=0){setError('Informe um valor maior que zero.');return;}
  await work(async()=>{await registerLoanRepayment(db,account.id,loanId,{valorCentavos:cents,data:repayDate});setRepaying(null);setRepayValue('');});
 }
 async function deleteRepayment(loanId:string,repaymentId:string){if(!confirm('Excluir esta devolução? O valor sai da reserva e volta a ficar em aberto.'))return;await work(()=>removeLoanRepayment(db,account.id,loanId,repaymentId));}
 async function deleteLoan(loanId:string,previous?:boolean){if(!confirm(previous?'Excluir este empréstimo antigo? A reserva não muda.':'Excluir este empréstimo? O valor volta para a reserva.'))return;await work(()=>removeLoan(db,account.id,loanId));}
 return <details className="panel couple-budget collapsible-panel"><summary>Empréstimos da reserva</summary>
  <p className="muted">Registre dinheiro da reserva emprestado a familiares. O valor sai da reserva sem virar despesa, então não consome o orçamento variável nem entra nos relatórios de gastos. Quando a pessoa devolver, registre a devolução: o valor volta direto para a reserva.</p>
  <p>Reserva disponível: <strong>{moeda(reserveBalance)}</strong> · Em aberto com terceiros: <strong>{moeda(outstanding)}</strong></p>
  <fieldset disabled={busy} className="plain-fields">
   <form className="fields" onSubmit={lend}>
    <label>Quem recebeu<input required list="reserve-loan-people" maxLength={MAX_LOAN_PERSON_LENGTH} value={person} onChange={e=>setPerson(e.target.value)} placeholder="Nome da pessoa"/></label>
    <datalist id="reserve-loan-people">{people.map(p=><option key={p.pessoa} value={p.pessoa}/>)}</datalist>
    <label>Valor emprestado (R$)<MoneyInput required min="0.01" max={before?undefined:Math.max(0,reserveBalance)/100} value={value} onChange={setValue}/></label>
    <label>Data do empréstimo<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>Observação (opcional)<textarea className="note-input" rows={2} maxLength={200} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <label className="check loan-before"><input type="checkbox" checked={before} onChange={e=>setBefore(e.target.checked)}/><span>Emprestado antes de usar o ControlAI<small>Registra só a dívida, sem tirar da reserva. As devoluções entram na reserva normalmente.</small></span></label>
    <button className="primary" disabled={!before&&reserveBalance<=0}>{before?'Registrar empréstimo antigo':'Registrar empréstimo'}</button>
   </form>
   {people.length===0?<p className="muted">Nenhum empréstimo registrado.</p>:people.map(p=><div className="panel" key={p.pessoa}>
    <h4>{p.pessoa}</h4>
    <p>Deve agora: <strong className={p.pendenteCentavos>0?'red':'green'}>{moeda(p.pendenteCentavos)}</strong><br/><small className="muted">Emprestado {moeda(p.emprestadoCentavos)} · Devolvido {moeda(p.devolvidoCentavos)}</small></p>
    {p.emprestimos.map(loan=>{const remaining=loanOutstanding(loan);return <div className="record" key={loan.id}><div className="recordbody">
     <strong>{moeda(loan.valorCentavos)} em {dataBR(loan.data)}</strong>
     <small>{remaining>0?`Em aberto: ${moeda(remaining)}`:'Quitado'}{loan.anterior?' · Anterior ao app':''}</small>{loan.observacao&&<NoteText className="card-note" text={loan.observacao}/>}
     {loan.devolucoes.map(r=><small key={r.id}>Devolução de {moeda(r.valorCentavos)} em {dataBR(r.data)} <button type="button" className="textbutton" onClick={()=>void deleteRepayment(loan.id,r.id)}>Excluir devolução</button></small>)}
     {repaying===loan.id?<form className="fields" onSubmit={e=>void repay(e,loan.id)}>
      <label>Valor devolvido (R$)<MoneyInput autoFocus selectOnFocus required min="0.01" max={remaining/100} value={repayValue} onChange={setRepayValue}/></label>
      <label>Data da devolução<input required type="date" min={loan.data} value={repayDate} onChange={e=>setRepayDate(e.target.value)}/></label>
      <button className="primary">Registrar devolução na reserva</button>
      <button type="button" className="secondary" onClick={()=>{setRepaying(null);setError('');}}>Cancelar</button>
     </form>:<div className="button-row">
      {remaining>0&&<button type="button" className="secondary" onClick={()=>startRepayment(loan.id,remaining)}>Registrar devolução</button>}
      {loan.devolucoes.length===0&&<button type="button" className="textbutton" onClick={()=>void deleteLoan(loan.id,loan.anterior)}>Excluir empréstimo</button>}
     </div>}
    </div></div>;})}
   </div>)}
  </fieldset>
  {error&&<p role="alert" className="error">{error}</p>}
 </details>;
}
