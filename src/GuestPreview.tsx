import {useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight,Eye,X} from 'lucide-react';
import {db,type Conta} from './db';
import SharedDashboard from './SharedDashboard';
import {shiftMonth} from './finance';
import type {Snapshot} from './sync/snapshot';
import {mesAtual} from './utils';
import {viewerIdentityOptions,type ViewerIdentity} from './viewer-identity';

// "Ver como convidado": the owner previews the consulta screen of one account with the
// data of this device, filtered exactly like the server does (only that account).
export default function GuestPreview({account,onClose}:{account:Conta;onClose:()=>void}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[error,setError]=useState('');
 const [month,setMonth]=useState(mesAtual),[tab,setTab]=useState<'inicio'|'lancamentos'>('inicio'),[who,setWho]=useState('');
 useEffect(()=>{let active=true;db.snapshot().then(all=>{if(!active)return;const only=<T extends {contaId?:string}>(rows:T[])=>rows.filter(r=>r.contaId===account.id);setSnapshot({...all,contas:all.contas.filter(c=>c.id===account.id),lancamentos:only(all.lancamentos),reservas:only(all.reservas),recorrencias:only(all.recorrencias),salarios:only(all.salarios),categorias:only(all.categorias),configuracoes:only(all.configuracoes),fechamentos:only(all.fechamentos)});}).catch(reason=>setError(reason instanceof Error?reason.message:'Não foi possível montar a prévia.'));return()=>{active=false;};},[account.id]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
 const options:ViewerIdentity[]=snapshot?viewerIdentityOptions(snapshot.contas[0],snapshot.salarios):[];
 const identity=options.find(o=>o.pessoa_id===who)??null;
 return <div className="guest-preview" role="dialog" aria-modal="true" aria-label="Prévia da visão do convidado">
  <div className="guest-preview-bar">
   <span className="guest-preview-title"><Eye size={18}/>Visão do convidado · {account.nome}</span>
   <button type="button" className="iconbutton" aria-label="Fechar prévia" title="Fechar prévia" onClick={onClose}><X size={20}/></button>
  </div>
  <div className="guest-preview-controls">
   <label>Ver como<select value={who} onChange={e=>setWho(e.target.value)}><option value="">Convidado sem pessoa associada</option>{options.map(o=><option key={o.pessoa_id} value={o.pessoa_id}>{o.nome}</option>)}</select></label>
   <div className="periodwrap"><button type="button" className="montharrow" aria-label="Mês anterior" onClick={()=>setMonth(shiftMonth(month,-1))}><ChevronLeft size={18}/></button><span className="guest-preview-month">{new Date(`${month}-02T12:00:00`).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}).replace('.','')}</span><button type="button" className="montharrow" aria-label="Próximo mês" onClick={()=>setMonth(shiftMonth(month,1))}><ChevronRight size={18}/></button></div>
   <div className="filters segmented"><button type="button" className={tab==='inicio'?'active':''} onClick={()=>setTab('inicio')}>Início</button><button type="button" className={tab==='lancamentos'?'active':''} onClick={()=>setTab('lancamentos')}>Lançamentos</button></div>
  </div>
  <p className="muted guest-preview-note">Somente leitura, com os dados deste aparelho. O convidado vê a versão sincronizada; ele também pode enviar solicitações quando tem pessoa associada.</p>
  <main className="viewer-app guest-preview-body">{error?<p className="error">{error}</p>:!snapshot?<p className="muted">Montando a prévia…</p>:<SharedDashboard key={`${who}:${month}`} snapshot={snapshot} month={month} tab={tab} identity={identity} onEntries={()=>setTab('lancamentos')}/>}</main>
 </div>;
}
