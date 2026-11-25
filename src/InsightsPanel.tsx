import {useState} from 'react';
import {Pencil,Trash2} from 'lucide-react';
import type {Conta,Lancamento,Recorrencia,Reserva} from './db';
import type {PendingItem} from './insights';
import {balanceForecast,pendingItems} from './insights';
import {hoje,moeda,dataBR} from './utils';
import {AreaChart,Area,ResponsiveContainer,XAxis,YAxis,Tooltip} from 'recharts';

// Pendências e previsão de saldo num cartão só, com duas abas e listas curtas.
const PREVIEW=5;
// `actions`: o dono pode pagar/receber, pular a recorrência do mês, editar e excluir pela própria lista.
export interface PendingActions{pay:(e:Lancamento)=>void;edit:(e:Lancamento)=>void;remove:(e:Lancamento)=>void;skip:(e:Lancamento)=>void;settle?:(item:PendingItem)=>void}
const MONTHS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
export default function InsightsPanel({account,entries,recurrences,reserves,month,actions}:{account:Conta;entries:Lancamento[];recurrences:Recorrencia[];reserves:Reserva[];month:string;actions?:PendingActions}){
 const [view,setView]=useState<'pendencias'|'previsao'>('pendencias'),[kind,setKind]=useState('todos'),[all,setAll]=useState(false);
 const today=hoje(),items=pendingItems(account,entries,recurrences,month),late=items.filter(i=>i.date<today);
 const shown=items.filter(i=>kind==='todos'?true:kind==='atrasadas'?i.date<today:i.kind===kind);
 const forecast=balanceForecast(account,entries,reserves,recurrences,month,today);
 const toPay=items.filter(i=>i.direction==='pagar').reduce((s,i)=>s+i.amount,0),toReceive=items.filter(i=>i.direction==='receber').reduce((s,i)=>s+i.amount,0);
 const kinds:[string,string][]=[['todos','Todas'],['atrasadas','Atrasadas'],['conta','Previstos'],...(account.tipo==='gestora'?[['contribuicao','Contribuições'],['reembolso','Reembolsos'],['repasse','Repasses']] as [string,string][]:[])];
 return <div className="insights-compact">
  <div className="filters segmented insights-tabs" role="tablist" aria-label="Pendências ou previsão"><button type="button" role="tab" aria-selected={view==='pendencias'} className={view==='pendencias'?'active':''} onClick={()=>setView('pendencias')}>Pendências {items.length>0&&<span className="count">{items.length}</span>}</button><button type="button" role="tab" aria-selected={view==='previsao'} className={view==='previsao'?'active':''} onClick={()=>setView('previsao')}>Previsão de saldo</button></div>
  {view==='pendencias'?<>
   <div className="insight-stats"><div><small>A pagar</small><strong className="red">{moeda(toPay)}</strong></div><div><small>A receber</small><strong className="green">{moeda(toReceive)}</strong></div><div className={late.length?'alert':''}><small>Atrasadas</small><strong>{late.length}</strong></div></div>
   <div className="insight-kinds" role="group" aria-label="Filtrar pendências">{kinds.map(([id,label])=><button type="button" key={id} className={kind===id?'active':''} aria-pressed={kind===id} onClick={()=>{setKind(id);setAll(false);}}>{label}</button>)}</div>
   {!shown.length?<p className="success insight-empty">Tudo em dia nesta seleção.</p>:<div className="insight-rows">{(all?shown:shown.slice(0,PREVIEW)).map(item=>{const overdue=item.date<today;return <div className={`insight-row ${overdue?'late':item.direction}${actions&&(item.entry||actions.settle)?' with-actions':''}`} key={item.id}><span className="insight-dot" aria-hidden="true"/><div className="insight-body"><strong>{item.label}</strong><small>{item.referencia?`Conta de ${MONTHS[Number(item.referencia.slice(5,7))-1]} · vence `:''}{dataBR(item.date).slice(0,5)} · {overdue?'Atrasada':item.date===today?'Hoje':item.direction==='pagar'?'A pagar':'A receber'}</small></div><strong className={item.direction==='pagar'?'red':'green'}>{item.direction==='pagar'?'−':'+'}{moeda(item.amount)}</strong>{actions&&item.entry&&<Actions item={item} actions={actions}/>}{actions?.settle&&!item.entry&&<div className="insight-actions"><button type="button" className="recurring-pay" onClick={()=>actions.settle!(item)}>Registrar {item.kind==='contribuicao'?'contribuição':item.kind==='repasse'?'repasse':'reembolso'}</button></div>}</div>;})}</div>}
   {shown.length>PREVIEW&&<button type="button" className="textbutton insight-more" onClick={()=>setAll(v=>!v)}>{all?'Mostrar menos':`Mostrar mais (${shown.length-PREVIEW})`}</button>}
   <details className="insight-help"><summary>Como funciona</summary><p className="muted">{account.tipo==='gestora'?'Lista as contas previstas, as contribuições do mês ainda não recebidas e os reembolsos e repasses de mercado. Os prazos de contribuição e reembolso seguem Ajustes → Lembretes.':'Lista as contas e receitas previstas até este mês, incluindo contas deste mês que vencem depois (mês de referência). Pague, pule ou edite direto pela lista; cada pagamento entra na data informada.'}</p></details>
  </>:forecast.unavailable?<p className="muted">O controle da conta começa em {account.inicioControle?dataBR(account.inicioControle.data):month}.</p>:<>
   <div className="insight-stats two"><div><small>Ao fim do mês</small><strong className={forecast.closing<0?'red':'green'}>{moeda(forecast.closing)}</strong></div><div className={forecast.minimum<0?'alert':''}><small>Menor saldo</small><strong className={forecast.minimum<0?'red':''}>{moeda(forecast.minimum)}</strong></div></div>
   {forecast.firstNegative&&<p className="error insight-warning">⚠ Possível saldo negativo em {dataBR(forecast.firstNegative.date)}.</p>}
   <div className="chart insight-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={forecast.points.map(p=>({...p,balance:p.balance/100}))} margin={{top:6,right:4,left:0,bottom:0}}><XAxis dataKey="date" tickFormatter={d=>String(d).slice(8)} tick={{fontSize:11}} interval="preserveStartEnd"/><YAxis tick={{fontSize:11}} width={44}/><Tooltip labelFormatter={d=>dataBR(String(d))} formatter={v=>moeda(Math.round(Number(v)*100))}/><Area type="monotone" dataKey="balance" name="Saldo" stroke={forecast.minimum<0?'#dc3545':'#0d7a5f'} fill={forecast.minimum<0?'#fde4e8':'#dff4ea'} dot={false}/></AreaChart></ResponsiveContainer></div>
   <details className="insight-help"><summary>Como a previsão é feita</summary><p className="muted">Os previstos em atraso entram no primeiro dia da projeção. Usa os lançamentos registrados e as recorrências previstas, descontando movimentações de reserva e transferências pessoais. Não presume novos gastos nem recebimentos de contribuições e reembolsos ainda não lançados.</p></details>
  </>}
 </div>;
}
// Ações por linha: Pagar/Receber, Pular (recorrência ainda não registrada), Editar e Excluir.
function Actions({item,actions}:{item:PendingItem;actions:PendingActions}){
 const e=item.entry!,projected=(e.id??0)<0,recurring=e.recorrenciaId!==undefined;
 return <div className="insight-actions"><button type="button" className="recurring-pay" onClick={()=>actions.pay(e)}>{item.direction==='pagar'?'Pagar':'Receber'}</button>{projected&&recurring&&<button type="button" className="textbutton" onClick={()=>actions.skip(e)}>Pular mês</button>}<button type="button" className="iconbutton" title="Editar" aria-label={`Editar ${item.label}`} onClick={()=>actions.edit(e)}><Pencil size={15}/></button>{!projected&&<button type="button" className="iconbutton" title="Excluir" aria-label={`Excluir ${item.label}`} onClick={()=>actions.remove(e)}><Trash2 size={15}/></button>}</div>;
}
