import {useState} from 'react';
import {Trash2} from 'lucide-react';
import type {Cartao,Lancamento} from './db';
import {installmentGroups} from './installments';
import {dataBR,hoje,moeda} from './utils';

const MONTHS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const monthLabel=(m:string)=>`${MONTHS[Number(m.slice(5,7))-1]}/${m.slice(0,4)}`;
export default function InstallmentsList({entries,cards,onRemove}:{entries:Lancamento[];cards:Cartao[];onRemove:(grupo:string)=>void}){
 const [view,setView]=useState<'ativas'|'quitadas'>('ativas');
 const today=hoje(),groups=installmentGroups(entries,cards,today),active=groups.filter(g=>g.falta>0),done=groups.filter(g=>g.falta<=0);
 const list=view==='ativas'?active:done,monthly=active.reduce((s,g)=>s+(g.proxima?.valorCentavos??0),0),remaining=active.reduce((s,g)=>s+g.falta,0);
 if(!groups.length)return <p className="muted">Nenhuma compra parcelada cadastrada.</p>;
 return <div className="installments">
  <div className="installments-summary"><div><small>Compras ativas</small><strong>{active.length}</strong></div><div><small>Próximas parcelas</small><strong>{moeda(monthly)}</strong></div><div><small>Falta pagar</small><strong className="red">{moeda(remaining)}</strong></div></div>
  <div className="filters segmented installments-tabs" role="tablist"><button type="button" role="tab" aria-selected={view==='ativas'} className={view==='ativas'?'active':''} onClick={()=>setView('ativas')}>Ativas <span className="count">{active.length}</span></button><button type="button" role="tab" aria-selected={view==='quitadas'} className={view==='quitadas'?'active':''} onClick={()=>setView('quitadas')}>Quitadas <span className="count">{done.length}</span></button></div>
  {!list.length&&<p className="muted">{view==='ativas'?'Nenhuma compra parcelada em aberto.':'Nenhuma compra quitada ainda.'}</p>}
  <div className="installments-list">{list.map(g=>{const pct=Math.round(g.pagas/Math.max(1,g.total)*100);return <div className={`installment-card${g.atrasadas?' late':''}${g.falta<=0?' done':''}`} key={g.grupo}>
   <div className="installment-head"><strong>{g.nome}</strong>{g.falta>0&&<button type="button" className="iconbutton" title="Remover parcelas previstas" aria-label={`Remover parcelas previstas de ${g.nome}`} onClick={()=>onRemove(g.grupo)}><Trash2 size={15}/></button>}</div>
   <small className="installment-meta">{g.cartao?`${g.cartao} · `:''}{g.total}× de {moeda(g.parcela)} · total {moeda(g.valorTotal)}</small>
   <div className="installment-progress" aria-label={`${g.pagas} de ${g.total} pagas`}><span style={{width:`${pct}%`}}/></div>
   <div className="installment-foot"><span><b>{g.pagas}</b> de {g.total} pagas{g.registradas<g.total?` · ${g.registradas} registradas`:''}</span>{g.falta>0?<span>Falta <b className="red">{moeda(g.falta)}</b></span>:<span className="green">✓ Quitada</span>}</div>
   {g.proxima&&<small className={`installment-next${g.atrasadas?' late':''}`}>{g.atrasadas?`⚠ ${g.atrasadas} atrasada${g.atrasadas===1?'':'s'} · `:''}Próxima: {g.proxima.parcela?.numero}/{g.total} em {dataBR(g.proxima.data)} · termina em {monthLabel(g.ultima)}</small>}
  </div>;})}</div>
 </div>;
}
