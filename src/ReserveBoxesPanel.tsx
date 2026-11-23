import {useState} from 'react';
import {Pencil, Plus, Trash2} from 'lucide-react';
import MoneyInput from './MoneyInput';
import {db,type Conta,type Reserva} from './db';
import {MAIN_RESERVE,mainReserveName,saveMainReserve,MAX_BOX_NAME,inSeparateBox,separateBoxIds,boxBalance,boxName,boxOf,moveReserve,removeBox,removeReserveRow,saveBox} from './reserve-boxes';
import {reserveSpent,spendFromReserve} from './reserve-spending';
import {dataBR,hoje,moeda,paraCentavos} from './utils';

export type ReserveAction='deposito'|'retirada'|'gasto'|'implantacao';
const ACTIONS:{id:ReserveAction;label:string}[]=[{id:'deposito',label:'Guardar'},{id:'retirada',label:'Resgatar'},{id:'gasto',label:'Gastar'},{id:'implantacao',label:'Implantar saldo'}];
const HINTS:Record<ReserveAction,string>={
 deposito:'Tira do saldo corrente e guarda nesta reserva.',
 retirada:'Devolve dinheiro desta reserva para o saldo corrente.',
 gasto:'Paga uma despesa avulsa direto com esta reserva. Não entra no orçamento mensal, nas semanas nem nos relatórios de gastos.',
 implantacao:'Registra dinheiro que já estava guardado antes de usar o app (por exemplo, o saldo atual de uma caixinha do banco). Entra na reserva e no total, sem tirar do saldo corrente.',
};
const BUTTONS:Record<ReserveAction,string>={deposito:'Guardar na reserva',retirada:'Registrar resgate',gasto:'Registrar gasto da reserva',implantacao:'Implantar saldo'};

// Reserva financeira: the main reserve plus as many caixinhas (travel, car...) as needed.
export default function ReserveBoxesPanel({account,reserves,month,categories,operation,setOperation}:{account:Conta;reserves:Reserva[];month:string;categories:string[];operation:ReserveAction;setOperation:(op:ReserveAction)=>void}){
 const boxes=account.caixinhas??[];
 const [selected,setSelected]=useState(MAIN_RESERVE),box=boxes.some(c=>c.id===selected)?selected:MAIN_RESERVE;
 const [desc,setDesc]=useState(''),[value,setValue]=useState(''),[date,setDate]=useState(hoje()),[category,setCategory]=useState('');
 const [boxForm,setBoxForm]=useState<{id?:string;main?:boolean;nome:string;meta:string;separada:boolean}|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const separate=separateBoxIds(account),total=reserves.filter(r=>!inSeparateBox(r,separate)).reduce((s,r)=>s+r.valorCentavos,0),apart=reserves.filter(r=>inSeparateBox(r,separate)).reduce((s,r)=>s+r.valorCentavos,0),balance=boxBalance(reserves,box);
 const monthRows=reserves.filter(r=>r.data.startsWith(month)).sort((a,b)=>b.data.localeCompare(a.data)),spentInMonth=reserveSpent(monthRows.filter(r=>!inSeparateBox(r,separate)),'9999-12-31');
 const withdraws=operation==='retirada'||operation==='gasto';
 async function work(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError('');try{await fn();}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível salvar.');}finally{setBusy(false);}}
 async function submit(e:React.FormEvent){
  e.preventDefault();
  const cents=paraCentavos(value);
  if(!desc.trim()||!Number.isSafeInteger(cents)||cents<=0){setError('Informe descrição e um valor maior que zero.');return;}
  await work(async()=>{
   if(operation==='gasto')await spendFromReserve(db,account.id,{descricao:desc,valorCentavos:cents,data:date,categoria:category,caixinhaId:box});
   else await moveReserve(db,account.id,{caixinhaId:box,operacao:operation,descricao:desc,valorCentavos:cents,data:date});
   setDesc('');setValue('');setCategory('');
  });
 }
 async function submitBox(e:React.FormEvent){
  e.preventDefault();if(!boxForm)return;
  const meta=boxForm.meta?paraCentavos(boxForm.meta):undefined;
  if(meta!==undefined&&(!Number.isSafeInteger(meta)||meta<=0)){setError('A meta precisa ser maior que zero.');return;}
  await work(async()=>{if(boxForm.main){await saveMainReserve(db,account.id,{nome:boxForm.nome,metaCentavos:meta});setSelected(MAIN_RESERVE);}else{const saved=await saveBox(db,account.id,{nome:boxForm.nome,metaCentavos:meta,foraDaReserva:boxForm.separada},boxForm.id);setSelected(saved.id);}setBoxForm(null);});
 }
 async function deleteBox(id:string){if(!confirm('Excluir esta caixinha? Só é possível quando ela não tem movimentos.'))return;await work(async()=>{await removeBox(db,account.id,id);setSelected(MAIN_RESERVE);setBoxForm(null);});}
 async function deleteRow(row:Reserva){
  if(row.emprestimoId){alert('Este movimento pertence a um empréstimo da reserva. Para desfazê-lo, use Empréstimos da reserva.');return;}
  if(row.id===undefined||!confirm(row.gasto?'Excluir este gasto da reserva? O valor volta para a reserva.':row.implantacao?'Excluir esta implantação de saldo? O valor sai da reserva e do total.':'Excluir este movimento da reserva?'))return;
  await work(()=>removeReserveRow(db,account.id,row.id!));
 }
 const card=(id:string,name:string,goal?:number,apartBox?:boolean)=>{const amount=boxBalance(reserves,id),pct=goal?Math.min(100,Math.max(0,amount/goal*100)):0;return <button type="button" key={id||'main'} className={`reserve-box${box===id?' selected':''}${apartBox?' apart':''}`} aria-pressed={box===id} onClick={()=>{setSelected(id);setBoxForm(null);setError('');}}>
  <small>{name}</small><strong className={amount<0?'red':''}>{moeda(amount)}</strong>{apartBox&&<span className="reserve-box-tag">Fora da reserva</span>}
  {goal?<><span className="reserve-box-goal" aria-hidden="true"><span style={{width:`${pct}%`}}/></span><small>{Math.floor(pct)}% de {moeda(goal)}</small></>:null}
 </button>;};
 const label=(row:Reserva)=>row.gasto?'Gasto da reserva':row.implantacao?'Implantação de saldo':row.emprestimoId?(row.valorCentavos<0?'Empréstimo':'Devolução de empréstimo'):row.valorCentavos<0?'Resgate':'Depósito';
 return <details id="reserva-panel" className="panel collapsible-panel"><summary>Reserva financeira</summary>
  <p className="muted">Separe dinheiro na reserva principal ou em caixinhas (viagem, carro, presentes...). Não conta como despesa de consumo.</p>
  <div className="reserve-summary"><div><small>Total guardado</small><strong>{moeda(total)}</strong></div>{separate.size>0&&<div><small>Fora da reserva</small><strong>{moeda(apart)}</strong></div>}{spentInMonth>0&&<div><small>Gasto da reserva no mês</small><strong className="red">{moeda(spentInMonth)}</strong></div>}</div>
  <div className="reserve-boxes" role="group" aria-label="Escolha a reserva">
   {card(MAIN_RESERVE,mainReserveName(account),account.reservaPrincipal?.metaCentavos)}
   {boxes.map(c=>card(c.id,c.nome,c.metaCentavos,c.foraDaReserva))}
   <button type="button" className="reserve-box add" onClick={()=>{setBoxForm({nome:'',meta:'',separada:false});setError('');}}><Plus size={18}/><small>Nova caixinha</small></button>
  </div>
  <fieldset disabled={busy} className="plain-fields">
  {boxForm?<form className="fields reserve-box-form" onSubmit={submitBox}>
   <h4>{boxForm.main?'Editar reserva principal':boxForm.id?'Editar caixinha':'Nova caixinha'}</h4>
   <label>Nome<input autoFocus required maxLength={MAX_BOX_NAME} placeholder="Ex.: Viagem" value={boxForm.nome} onChange={e=>setBoxForm({...boxForm,nome:e.target.value})}/></label>
   <label>Meta (opcional, R$)<MoneyInput min="0.01" placeholder="0,00" value={boxForm.meta} onChange={meta=>setBoxForm({...boxForm,meta})}/></label>
   {!boxForm.main&&<label className="check loan-split"><input type="checkbox" checked={boxForm.separada} onChange={e=>setBoxForm({...boxForm,separada:e.target.checked})}/><span>Fora da reserva e do total<small>Para dinheiro separado, como economias de antes do casal. O saldo dela não entra na Reserva nem no Total da conta. Guardar nela tira do saldo corrente e resgatar devolve.</small></span></label>}
   {!boxForm.id&&!boxForm.main&&<small>Se a caixinha já tem dinheiro guardado, depois de criar use Implantar saldo.</small>}
   <button className="primary">{boxForm.main?'Salvar reserva':boxForm.id?'Salvar caixinha':'Criar caixinha'}</button>
   {boxForm.id&&<button type="button" className="secondary" onClick={()=>void deleteBox(boxForm.id!)}><Trash2 size={16}/>Excluir caixinha</button>}
   <button type="button" className="secondary" onClick={()=>{setBoxForm(null);setError('');}}>Cancelar</button>
  </form>:<>
   <div className="reserve-box-head"><h4>{boxName(account,box)} · {moeda(balance)}</h4><button type="button" className="textbutton" onClick={()=>{if(!box){const m=account.reservaPrincipal;setBoxForm({main:true,nome:mainReserveName(account),meta:m?.metaCentavos?String(m.metaCentavos/100):'',separada:false});setError('');return;}const c=boxes.find(x=>x.id===box)!;setBoxForm({id:c.id,nome:c.nome,meta:c.metaCentavos?String(c.metaCentavos/100):'',separada:!!c.foraDaReserva});setError('');}}><Pencil size={14}/>Editar</button></div>
   <div className="filters segmented reserve-actions" role="tablist" aria-label="Tipo de movimento da reserva">{ACTIONS.map(a=><button type="button" key={a.id} role="tab" aria-selected={operation===a.id} className={operation===a.id?'active':''} onClick={()=>setOperation(a.id)}>{a.label}</button>)}</div>
   <p className="muted reserve-hint">{HINTS[operation]}</p>
   <form className="fields reserve-form" onSubmit={submit}>
    <label>{operation==='gasto'?'Com o que gastou':'Descrição'}<input required maxLength={80} placeholder={operation==='gasto'?'Ex.: Conserto do carro':operation==='implantacao'?'Ex.: Saldo da caixinha do banco':'Ex.: Guardar para a viagem'} value={desc} onChange={e=>setDesc(e.target.value)}/></label>
    <label>{operation==='gasto'?'Valor gasto (R$)':'Valor (R$)'}<MoneyInput required min="0.01" max={withdraws?Math.max(0,balance)/100:undefined} placeholder="0,00" value={value} onChange={setValue}/></label>
    <label>Data<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    {operation==='gasto'&&<label>Categoria (opcional)<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Sem categoria</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label>}
    <small>O movimento aparecerá no mês da data informada.</small>
    <button className="primary" disabled={withdraws&&balance<=0}>{BUTTONS[operation]}</button>
   </form>
  </>}
  </fieldset>
  {error&&<p role="alert" className="error">{error}</p>}
  <div className="records">{monthRows.map(r=><div className="record reserve-record" key={r.id}><div className="recordbody reserve-record-body"><strong>{r.descricao}</strong><small>{dataBR(r.data)} · {label(r)} · {boxName(account,boxOf(r))}{r.categoria?` · ${r.categoria}`:''}</small></div><strong className={`reserve-record-amount ${r.valorCentavos<0?'red':'green'}`}>{moeda(r.valorCentavos)}</strong><button className="iconbutton" title="Excluir" aria-label={`Excluir movimento de reserva ${r.descricao}`} disabled={busy} onClick={()=>void deleteRow(r)}><Trash2 size={17}/></button></div>)}</div>
 </details>;
}
