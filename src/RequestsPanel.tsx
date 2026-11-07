import {useEffect,useState} from 'react';
import type {Categoria,Conta,Lancamento} from './db';
import type {SupabaseClient} from './sync/client';
import type {EntryRequest} from './requests';
import {requestReimbursement} from './request-reimbursement';
import MoneyInput from './MoneyInput';
import {paraCentavos,hoje,moeda,dataBR} from './utils';
export default function RequestsPanel({client,owner,account,accountInfo,entries=[],categories=[],approve,onReimburse,heading=true}:{client:SupabaseClient|null;owner:string;account:string;accountInfo?:Conta;entries?:Lancamento[];categories?:Categoria[];approve?:(request:EntryRequest,category:string)=>Promise<void>;onReimburse?:(request:EntryRequest)=>void;heading?:boolean}){
 const [rows,setRows]=useState<EntryRequest[]>([]),[refresh,setRefresh]=useState(0),[description,setDescription]=useState(''),[amount,setAmount]=useState(''),[date,setDate]=useState(hoje),[type,setType]=useState<'receita'|'despesa'>('despesa'),[status,setStatus]=useState<'previsto'|'confirmado'>('previsto'),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[message,setMessage]=useState(''),[category,setCategory]=useState<Record<string,string>>({}),[page,setPage]=useState(1);
 const gestora=accountInfo?.tipo==='gestora',people=accountInfo?.pessoas??[];
 const [household,setHousehold]=useState(gestora),[payer,setPayer]=useState(people.length===1?people[0].id:'');
 useEffect(()=>{
  setRows([]);setPage(1);if(!client)return;
  let active=true,loading=false;
  async function load(){if(loading)return;loading=true;try{const next=await client!.listRequests(owner,account);if(active){setRows(Array.isArray(next)?next:[]);setLoadError('');}}catch(e){if(active)setLoadError(e instanceof Error&&e.message.includes('setup.sql')?'Ative as solicitações executando supabase/solicitacoes.sql no Supabase.':e instanceof Error?e.message:'Falha ao consultar solicitações.');}finally{loading=false;}}
  void load();const timer=setInterval(()=>void load(),30000),focus=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[client,owner,account,refresh]);
 async function action(work:()=>Promise<void>){if(busy||!client)return;setBusy(true);setError('');setMessage('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Não foi possível concluir.');}finally{setBusy(false);setRefresh(n=>n+1);}}
 const pending=rows.filter(r=>r.status==='pendente').length;
 const rank=(r:EntryRequest)=>r.status==='pendente'?0:requestReimbursement(r,accountInfo,entries)?.remaining?1:2;
 const ordered=[...rows].sort((a,b)=>rank(a)-rank(b)||b.created_at.localeCompare(a.created_at));
 return <>{heading&&<h3>{approve?'Solicitações dos convidados':'Enviar solicitação ao titular'}{approve&&pending>0&&<span className="request-count">{pending} aguardando aprovação</span>}</h3>}
 {!client?<p className="muted">Entre no seu login para usar as solicitações.</p>:<>
 {!approve&&<form className="fields" onSubmit={e=>{e.preventDefault();void action(async()=>{
  const cents=paraCentavos(amount);if(!Number.isSafeInteger(cents)||cents<=0)throw Error('Informe um valor maior que zero.');
  if(household&&(!gestora||!people.some(p=>p.id===payer)))throw Error('Selecione a pessoa que pagou a compra.');
  await client.submitRequest(owner,account,{descricao:description,tipo:household?'despesa':type,status:household?'confirmado':status,data:date,valorCentavos:cents,observacao:note,...(household?{reembolsoPessoaId:payer}:{})});
  setDescription('');setAmount('');setNote('');setMessage(household?'Solicitação enviada. Após a aprovação, o reembolso continua pendente até o titular confirmar o envio.':'Solicitação enviada. O titular precisa aprovar antes de entrar nas contas.');
 });}}><fieldset disabled={busy} className="plain-fields fields">
 {gestora&&<label>O que deseja solicitar?<select value={household?'reembolso':'lancamento'} onChange={e=>setHousehold(e.target.value==='reembolso')}><option value="reembolso">Compra para casa · preciso de reembolso</option><option value="lancamento">Lançamento da conta · sem reembolso</option></select></label>}
 {household&&<><p className="request-notice">Você já pagou a compra. A aprovação reconhece o valor a devolver; o reembolso só fica quitado quando o titular confirmar o pagamento.</p><label>Pessoa que pagou a compra<select required value={payer} onChange={e=>setPayer(e.target.value)}><option value="">Selecione seu nome</option>{people.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>{!people.length&&<p className="muted">O titular precisa cadastrar os participantes da gestora antes do envio.</p>}</>}
 <label>Descrição<input required maxLength={200} value={description} onChange={e=>setDescription(e.target.value)}/></label><div className="twocol"><label>Valor (R$)<MoneyInput required value={amount} onChange={setAmount}/></label><label>{household?'Data da compra':'Data'}<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label></div>
 {!household&&<div className="twocol"><label>Tipo<select value={type} onChange={e=>setType(e.target.value as typeof type)}><option value="despesa">Despesa</option><option value="receita">Receita</option></select></label><label>Situação proposta<select value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="previsto">Previsto</option><option value="confirmado">Pago / recebido</option></select></label></div>}
 <label>Observação (opcional)<textarea maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></label><button className="primary" disabled={household&&!people.length}>Enviar para aprovação</button></fieldset></form>}
 <p className="muted">{approve?'Aprovar uma compra paga pelo convidado mantém o reembolso pendente. Confirme o reembolso somente após enviar o dinheiro. Sincronize antes de aprovar.':'Você acompanha aqui o resultado dos envios. Seu acesso aos dados continua somente leitura.'} As solicitações são atualizadas automaticamente.</p>
 <div className="records">{ordered.slice(0,page*8).map(row=>{const reimbursement=requestReimbursement(row,accountInfo,entries),isHousehold=Boolean(row.payload.reembolsoPessoaId),person=people.find(p=>p.id===row.payload.reembolsoPessoaId);return <article className="request-row" key={row.id}>
 <div className="split"><strong>{row.payload.descricao}</strong><strong>{moeda(row.payload.valorCentavos)}</strong></div>
 <small>{dataBR(row.payload.data)} · {isHousehold?'Compra paga pelo convidado':row.payload.tipo+' · '+(row.payload.status==='confirmado'?'Pago / recebido':'Previsto')} · {row.status}</small>
 {approve&&<small>Enviado por {row.requester_email}</small>}{isHousehold&&<p>Devolver a <strong>{person?.nome??'Participante'}</strong></p>}
 {isHousehold&&row.status!=='recusado'&&<div className={'request-reimbursement '+(reimbursement?.remaining===0?'settled':'pending')} role="status">{row.status==='pendente'?'Aguarda aprovação · reembolso ainda não realizado':!reimbursement?'Aprovado · aguardando sincronização do reembolso':reimbursement.remaining===0?'Reembolso concluído':<>Reembolso pendente: <strong>{moeda(reimbursement.remaining)}</strong>{reimbursement.paid>0&&<small>Já reembolsado: {moeda(reimbursement.paid)}</small>}</>}</div>}
 {row.payload.observacao&&<p>{row.payload.observacao}</p>}{row.reason&&<p>Motivo: {row.reason}</p>}
 {approve&&row.status==='pendente'&&<><label>Categoria para aprovação<select value={category[row.id]??''} onChange={e=>setCategory(v=>({...v,[row.id]:e.target.value}))}><option value="">Selecione</option>{categories.filter(c=>c.tipo===row.payload.tipo).map(c=><option key={c.id}>{c.nome}</option>)}</select></label><div className="button-row"><button className="primary" disabled={busy||!category[row.id]} onClick={()=>void action(async()=>{await approve(row,category[row.id]);setMessage(isHousehold?'Compra aprovada. O reembolso continua pendente até a confirmação do envio.':'Solicitação aprovada. O lançamento foi registrado uma única vez.');})}>{isHousehold?'Aprovar compra':'Aprovar lançamento'}</button><button className="secondary" disabled={busy} onClick={()=>{const reason=prompt('Motivo da recusa (opcional):','');if(reason!==null)void action(async()=>{await client.resolveRequest(row.id,'recusado','',0,reason);setMessage('Solicitação recusada.');});}}>Recusar</button></div></>}
 {approve&&onReimburse&&reimbursement&&reimbursement.remaining>0&&<button className="secondary" disabled={busy} onClick={()=>onReimburse(row)}>Confirmar reembolso</button>}
 </article>;})}</div>
 {!rows.length&&<p className="muted">Nenhuma solicitação.</p>}{rows.length>page*8&&<button className="secondary" onClick={()=>setPage(p=>p+1)}>Ver mais 8</button>}</>}
 {loadError&&<p role="alert" className="error">{loadError}</p>}{error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}</>;
}
