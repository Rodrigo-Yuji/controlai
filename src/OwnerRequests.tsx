import {useState} from 'react';
import {useLiveQuery} from './storage/useLiveQuery';
import RequestsPanel from './RequestsPanel';
import MoneyInput from './MoneyInput';
import {db,type Conta,type Categoria} from './db';
import type {EntryRequest} from './requests';
import {requestReimbursement,recordRequestReimbursement} from './request-reimbursement';
import {readLogin,refreshLogin} from './workspace-session';
import {SupabaseClient} from './sync/client';
import {snapshotKey,validateSnapshot} from './sync/snapshot';
import {hoje,moeda,paraCentavos} from './utils';
export default function OwnerRequests({account,categories}:{account:Conta;categories:Categoria[]}){
 const login=readLogin(),entries=useLiveQuery(()=>db.lancamentos.where('contaId').equals(account.id).toArray(),[account.id])??[];
 const [client]=useState(()=>{const s=readLogin();return s?new SupabaseClient(s.config,s.session,async next=>refreshLogin(s.config,next,s.epoch)):null;});
 const [request,setRequest]=useState<EntryRequest|null>(null),[amount,setAmount]=useState(''),[date,setDate]=useState(hoje),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const balance=request?requestReimbursement(request,account,entries):null;
 return <><RequestsPanel client={client} owner={login?.session.user.id??''} account={account.id} accountInfo={account} entries={entries} categories={categories} onReimburse={row=>{const due=requestReimbursement(row,account,entries);if(!due)return;setRequest(row);setAmount(String(due.remaining/100));setDate(hoje());setError('');setMessage('');}} approve={async(row,category)=>{
  if(!client||!login)throw Error('Entre novamente.');const local=await db.snapshot(),cloud=await client.read();if(!cloud||snapshotKey(local)!==snapshotKey(validateSnapshot(cloud.snapshot)))throw Error('Há alterações aguardando sincronização. Sincronize antes de aprovar para preservar os dados.');
  await client.resolveRequest(row.id,'aprovado',category,cloud.revision);const next=await client.read();if(!next)throw Error('Aprovado, mas a consulta da nova cópia falhou. Sincronize para atualizar.');await db.applySnapshot(snapshotKey(local),validateSnapshot(next.snapshot),'sync.binding',{owner:login.config.url+':'+login.session.user.id,revision:next.revision,base:next.snapshot});
 }}/>{message&&<p className="success" role="status">{message}</p>}
 {request&&<div className="overlay"><section className="dialog" role="dialog" aria-modal="true" aria-label="Confirmar reembolso ao convidado"><h3>Confirmar reembolso</h3><p>{request.payload.descricao} · {account.pessoas?.find(p=>p.id===request.payload.reembolsoPessoaId)?.nome}</p><div className="payment-summary"><p>Falta reembolsar: <strong>{balance?moeda(balance.remaining):'Aguardando atualização'}</strong></p><p>Restante após este envio: <strong>{balance?moeda(Math.max(0,balance.remaining-(paraCentavos(amount)||0))):'—'}</strong></p></div><p className="muted">Confirme somente o valor que você já enviou. Pode ser parcial; o restante continua pendente.</p><form className="fields" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{const remaining=await recordRequestReimbursement(db,account.id,request.id,paraCentavos(amount),date);setMessage(remaining?'Reembolso parcial registrado. Falta '+moeda(remaining)+'.':'Reembolso concluído. A saída foi registrada uma única vez.');setRequest(null);}catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar.');}finally{setBusy(false);}}}><label>Valor reembolsado (R$)<MoneyInput required autoFocus selectOnFocus value={amount} onChange={setAmount} max={(balance?.remaining??0)/100}/></label><label>Data do reembolso<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}<div className="button-row"><button className="primary" disabled={busy||!balance||balance.remaining<=0}>Confirmar envio do dinheiro</button><button type="button" className="secondary" disabled={busy} onClick={()=>setRequest(null)}>Cancelar</button></div></form></section></div>}</>;
}
