import {useState} from 'react';
import {Pencil, Plus, Trash2} from 'lucide-react';
import {db,type Cartao,type Lancamento,type Recorrencia} from './db';
import {recurringMonth,recurringSummary,toggleSkip,type RecurringMonth,type RecurringState} from './recurring-status';
import {dataBR,hoje,moeda} from './utils';

const MONTHS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const monthLabel=(m:string)=>`${MONTHS[Number(m.slice(5,7))-1]}/${m.slice(0,4)}`;
const STATE_LABEL:Record<RecurringState,[string,string]>={pago:['Paga','Recebida'],parcial:['Parcial','Parcial'],pendente:['A pagar','A receber'],atrasado:['Atrasada','Atrasada'],pulado:['Pulada este mês','Pulada este mês']};

// Recorrentes: what of this month was already paid, what is missing and what was skipped.
export default function RecurringMonthPanel({recurrences,entries,month,cards,onPay,onEdit,onEnd,onAdd}:{recurrences:Recorrencia[];entries:Lancamento[];month:string;cards:Cartao[];onPay:(entry:Lancamento)=>void;onEdit:(r:Recorrencia)=>void;onEnd:(r:Recorrencia)=>void;onAdd:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const today=hoje();
 const rows=recurrences.map(r=>recurringMonth(r,month,entries,today,cards)).filter((x):x is RecurringMonth=>x!==null);
 const others=recurrences.filter(r=>!rows.some(x=>x.recurrence.id===r.id));
 const expenses=rows.filter(x=>x.recurrence.tipo==='despesa'),income=rows.filter(x=>x.recurrence.tipo==='receita');
 const order:RecurringState[]=['atrasado','pendente','parcial','pulado','pago'];
 const sorted=(list:RecurringMonth[])=>[...list].sort((a,b)=>order.indexOf(a.state)-order.indexOf(b.state)||a.due.localeCompare(b.due));
 async function skip(row:RecurringMonth,value:boolean){
  if(busy||row.recurrence.id===undefined)return;
  if(value&&!confirm(`Não vai pagar ${row.recurrence.descricao} em ${monthLabel(month)}? A previsão deste mês some e volta no próximo.`))return;
  setBusy(true);setError('');
  try{await db.recorrencias.update(row.recurrence.id,toggleSkip(row.recurrence,row.dueMonth,value));}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível salvar.');}finally{setBusy(false);}
 }
 const group=(title:string,list:RecurringMonth[],income:boolean)=>{if(!list.length)return null;const s=recurringSummary(list),done=s.pagos+s.pulados,pct=s.total?Math.round(done/s.total*100):0;return <section className={`recurring-group ${income?'income':'expense'}`}>
  <div className="recurring-summary">
   <div className="recurring-summary-top"><strong>{title} de {monthLabel(month)}</strong><span>{s.pagos} de {s.total} {income?'recebidas':'pagas'}</span></div>
   <div className="recurring-progress" aria-label={`${pct}% concluído`}><span style={{width:`${pct}%`}}/></div>
   <div className="recurring-chips">{s.atrasados>0&&<span className="rchip late">{s.atrasados} atrasada{s.atrasados===1?'':'s'}</span>}{s.pendentes>0&&<span className="rchip open">{s.pendentes} {income?'a receber':'a pagar'}</span>}{s.pagos>0&&<span className="rchip paid">{s.pagos} {income?'recebida':'paga'}{s.pagos===1?'':'s'}</span>}{s.pulados>0&&<span className="rchip skip">{s.pulados} pulada{s.pulados===1?'':'s'}</span>}{s.faltaCentavos>0&&<span className="rchip total">Faltam {moeda(s.faltaCentavos)}</span>}</div>
  </div>
  <div className="recurring-rows">{sorted(list).map(row=>{const r=row.recurrence,payTarget=row.projected??row.entries.find(e=>e.status==='previsto');return <div className={`recurring-row ${row.state}`} key={r.id}>
   <span className="recurring-dot" aria-hidden="true"/>
   <div className="recurring-body"><strong>{r.descricao}</strong><small>{r.referenciaAnterior?`Conta de ${monthLabel(month)} · `:''}vence {dataBR(row.due).slice(0,5)} · {r.categoria}{row.state==='parcial'?` · pago ${moeda(row.paid)}`:''}</small></div>
   <div className="recurring-side"><strong>{moeda(row.value)}</strong><span className={`recurring-state ${row.state}`}>{STATE_LABEL[row.state][income?1:0]}</span></div>
   <div className="recurring-actions">
    {payTarget&&<button type="button" className="recurring-pay" disabled={busy} onClick={()=>onPay(payTarget)}>{income?'Receber':'Pagar'}</button>}
    {row.state==='pulado'?<button type="button" className="textbutton" disabled={busy} onClick={()=>void skip(row,false)}>Desfazer</button>:row.projected&&!row.entries.length&&<button type="button" className="textbutton" disabled={busy} title="Não vou pagar este mês" onClick={()=>void skip(row,true)}>Pular mês</button>}
    <button type="button" className="iconbutton" title="Editar recorrência" aria-label={`Editar recorrência ${r.descricao}`} onClick={()=>onEdit(r)}><Pencil size={15}/></button>
    <button type="button" className="iconbutton" title="Encerrar recorrência" aria-label={`Encerrar recorrência ${r.descricao}`} onClick={()=>onEnd(r)}><Trash2 size={15}/></button>
   </div>
  </div>;})}</div>
 </section>;};
 return <div className="recurring-panel">
  <div className="sectiontitle"><h3>Recorrentes</h3><button type="button" className="secondary" onClick={onAdd}><Plus size={16}/>Adicionar recorrente</button></div>
  <p className="muted">Contas e receitas de todo mês. Veja o que já foi pago neste mês, o que falta e marque “Pular mês” quando não for pagar (ex.: corte de cabelo).</p>
  {error&&<p className="error" role="alert">{error}</p>}
  {!rows.length&&<p className="muted">Nenhuma recorrência para {monthLabel(month)}.</p>}
  {group('Contas',expenses,false)}
  {group('Receitas',income,true)}
  {others.length>0&&<details className="recurring-others"><summary>Encerradas ou que começam depois ({others.length})</summary>{others.map(r=><div className="recurring-other" key={r.id}><span>{r.descricao} · {r.ativa?`começa em ${dataBR(r.inicio)}`:'encerrada'}</span><span>{moeda(r.valorCentavos)}</span>{r.ativa&&<button type="button" className="iconbutton" title="Editar recorrência" aria-label={`Editar recorrência ${r.descricao}`} onClick={()=>onEdit(r)}><Pencil size={15}/></button>}</div>)}</details>}
 </div>;
}
