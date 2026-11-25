import {useState} from 'react';
import {CalendarCheck,X} from 'lucide-react';
import {db,type Conta,type Lancamento,type Recorrencia,type Reserva} from './db';
import {ensureOpenMonth} from './account-guards';
import {projectRecurrences,shiftMonth} from './finance';
import {inControlPeriod} from './control-start';
import {financialReports} from './reporting';
import {MAIN_RESERVE,mainReserveName,moveReserve} from './reserve-boxes';
import {toggleSkip} from './recurring-status';
import {dataBR,hoje,moeda,paraCentavos} from './utils';
import MoneyInput from './MoneyInput';

const MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const monthName=(m:string)=>`${MONTHS[Number(m.slice(5,7))-1]} de ${m.slice(0,4)}`;
const lastDay=(m:string)=>{const [y,mm]=m.split('-').map(Number);return `${m}-${String(new Date(Date.UTC(y,mm,0)).getUTCDate()).padStart(2,'0')}`;};
// Same day in the next month (end of month when it does not exist).
const nextMonthDate=(date:string)=>{const next=shiftMonth(date.slice(0,7),1),last=Number(lastDay(next).slice(8));return `${next}-${String(Math.min(Number(date.slice(8)),last)).padStart(2,'0')}`;};

// Fechamento do mês guiado: resumo, pendências, sobra e fechamento.
export default function MonthCloseWizard({account,month,entries,recurrences,reserves,onPay,onCancel,onClose}:{account:Conta;month:string;entries:Lancamento[];recurrences:Recorrencia[];reserves:Reserva[];onPay:(entry:Lancamento)=>void;onCancel:()=>void;onClose:()=>Promise<void>}){
 const gestora=account.tipo==='gestora';
 const steps=gestora?['Resumo','Pendências','Fechar']:['Resumo','Pendências','Sobra','Fechar'];
 const [step,setStep]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(0);
 const today=hoje();
 const own=entries.filter(e=>e.contaId===account.id&&inControlPeriod(account,e));
 const inMonth=own.filter(e=>e.data.slice(0,7)===month),confirmed=inMonth.filter(e=>e.status==='confirmado');
 const income=confirmed.filter(e=>e.tipo==='receita').reduce((s,e)=>s+e.valorCentavos,0),expense=confirmed.filter(e=>e.tipo==='despesa').reduce((s,e)=>s+e.valorCentavos,0),result=income-expense;
 const prev=shiftMonth(month,-1),prevExpense=own.filter(e=>e.status==='confirmado'&&e.tipo==='despesa'&&e.data.slice(0,7)===prev).reduce((s,e)=>s+e.valorCentavos,0);
 const top=financialReports(entries,account,month,'pagamento').categories.slice(0,3);
 const projected=projectRecurrences(month,account.id,recurrences,entries,account.cartoes).filter(e=>inControlPeriod(account,e));
 const pending=[...inMonth.filter(e=>e.status==='previsto'),...projected].sort((a,b)=>a.data.localeCompare(b.data));
 const boxes=[{id:MAIN_RESERVE,nome:mainReserveName(account)},...(account.caixinhas??[]).filter(c=>!c.foraDaReserva)];
 const [box,setBox]=useState(MAIN_RESERVE),[amount,setAmount]=useState(()=>result>0?String(result/100).replace('.',','):'');
 const reserved=reserves.filter(r=>r.data.slice(0,7)===month&&!r.gasto&&!r.emprestimoId&&!r.implantacao&&!r.rendimento&&r.valorCentavos>0).reduce((s,r)=>s+r.valorCentavos,0);
 async function work(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível concluir.');}finally{setBusy(false);}}
 const postpone=(e:Lancamento)=>work(async()=>{if(e.id===undefined||e.id<0)return;const target=nextMonthDate(e.data);await db.transaction([db.lancamentos,db.fechamentos],async tx=>{await ensureOpenMonth(tx,account.id,e.data);await ensureOpenMonth(tx,account.id,target);await tx.lancamentos.update(e.id!,{data:target,competencia:target.slice(0,7)});});});
 const skip=(e:Lancamento)=>work(async()=>{const r=recurrences.find(x=>x.id===e.recorrenciaId);if(!r?.id)return;await db.recorrencias.update(r.id,toggleSkip(r,e.data.slice(0,7),true));});
 const save=()=>work(async()=>{const cents=paraCentavos(amount);if(!Number.isSafeInteger(cents)||cents<=0)throw Error('Informe um valor maior que zero.');await moveReserve(db,account.id,{caixinhaId:box,operacao:'deposito',descricao:`Sobra de ${monthName(month)}`,valorCentavos:cents,data:month===today.slice(0,7)?today:lastDay(month)});setSaved(s=>s+cents);setAmount('');});
 const current=steps[step];
 return <div className="overlay month-close-overlay"><section className="dialog month-close" role="dialog" aria-modal="true" aria-label={`Fechar ${monthName(month)}`}>
  <div className="month-close-head"><span><CalendarCheck size={20}/>Fechar {monthName(month)}</span><button type="button" className="iconbutton" aria-label="Sair sem fechar" onClick={onCancel}><X size={18}/></button></div>
  <ol className="month-close-steps">{steps.map((s,i)=><li key={s} className={i===step?'active':i<step?'done':''}><button type="button" onClick={()=>setStep(i)}>{i<step?'✓':i+1}</button><span>{s}</span></li>)}</ol>
  {error&&<p className="error" role="alert">{error}</p>}
  {current==='Resumo'&&<div className="month-close-body">
   <div className="month-close-hero"><small>Resultado do mês</small><strong className={result<0?'red':'green'}>{moeda(result)}</strong><span>{result>=0?'sobrou no mês':'faltou no mês'}</span></div>
   <div className="insight-stats"><div><small>Recebido</small><strong className="green">{moeda(income)}</strong></div><div><small>Pago</small><strong className="red">{moeda(expense)}</strong></div><div><small>Pendências</small><strong>{pending.length}</strong></div></div>
   {prevExpense>0&&<p className="muted">Gastos {expense>prevExpense?'maiores':'menores'} que em {monthName(prev)}: {moeda(Math.abs(expense-prevExpense))} ({Math.round(Math.abs(expense-prevExpense)/prevExpense*100)}%).</p>}
   {top.length>0&&<div className="month-close-top"><small>Onde mais gastou</small>{top.map(c=><div key={c.name}><span>{c.name}</span><strong>{moeda(Math.round(c.value*100))}</strong></div>)}</div>}
  </div>}
  {current==='Pendências'&&<div className="month-close-body">
   {!pending.length?<p className="success">Nada pendente neste mês. 🎉</p>:<><p className="muted">Resolva o que ficou para trás antes de fechar. O que continuar previsto fica bloqueado com o mês.</p><div className="insight-rows">{pending.map(e=>{const projectedRow=(e.id??0)<0,recurring=e.recorrenciaId!==undefined;return <div className={`insight-row ${e.data<today?'late':e.tipo==='receita'?'receber':'pagar'}`} key={`${e.id}-${e.data}`}><span className="insight-dot" aria-hidden="true"/><div className="insight-body"><strong>{e.descricao}</strong><small>{dataBR(e.data).slice(0,5)} · {e.tipo==='receita'?'A receber':'A pagar'} {moeda(e.valorCentavos)}</small></div><div className="month-close-actions"><button type="button" className="recurring-pay" disabled={busy} onClick={()=>onPay(e)}>{e.tipo==='receita'?'Receber':'Pagar'}</button>{projectedRow&&recurring?<button type="button" className="textbutton" disabled={busy} onClick={()=>void skip(e)}>Pular</button>:!projectedRow&&!e.parcial&&!e.cartaoId&&<button type="button" className="textbutton" disabled={busy} onClick={()=>void postpone(e)}>Próximo mês</button>}</div></div>;})}</div></>}
  </div>}
  {current==='Sobra'&&<div className="month-close-body">
   {result<=0?<p className="muted">Não sobrou dinheiro neste mês, então não há o que guardar.</p>:<><p>Sobraram <strong className="green">{moeda(result)}</strong> em {monthName(month)}. Quer guardar uma parte?</p>
   <div className="fields"><label>Guardar em<select value={box} onChange={e=>setBox(e.target.value)}>{boxes.map(b=><option key={b.id||'main'} value={b.id}>{b.nome}</option>)}</select></label><label>Valor (R$)<MoneyInput min="0.01" value={amount} onChange={setAmount}/></label><button type="button" className="primary" disabled={busy} onClick={()=>void save()}>Guardar na reserva</button></div></>}
   {(saved>0||reserved>0)&&<p className="success">Guardado neste mês: {moeda(reserved)}{saved>0?` (agora: ${moeda(saved)})`:''}.</p>}
  </div>}
  {current==='Fechar'&&<div className="month-close-body">
   <ul className="month-close-check"><li className={result>=0?'ok':'warn'}>Resultado do mês: {moeda(result)}</li><li className={pending.length?'warn':'ok'}>{pending.length?`${pending.length} pendência(s) ainda prevista(s)`:'Sem pendências'}</li>{!gestora&&<li className="ok">Guardado na reserva no mês: {moeda(reserved)}</li>}</ul>
   <p className="muted">Ao fechar, os lançamentos de {monthName(month)} ficam protegidos contra alterações. Você pode reabrir quando precisar corrigir algo.</p>
   <button type="button" className="primary" disabled={busy} onClick={()=>void work(onClose)}>Fechar {monthName(month)}</button>
  </div>}
  <div className="wizard-actions"><button type="button" className="secondary" disabled={step===0} onClick={()=>setStep(step-1)}>Voltar</button>{step<steps.length-1&&<button type="button" className="primary" onClick={()=>setStep(step+1)}>Próxima</button>}</div>
 </section></div>;
}
