import {useState} from 'react';
import {Palette} from 'lucide-react';
import {db,type Conta} from './db';
import {accountHeaderStyle} from './account-color';

const palette=[['Azul','#2459e0'],['Laranja','#ec7000'],['Verde','#15803d'],['Roxo','#7c3aed'],['Vermelho','#dc2626'],['Rosa','#be185d'],['Turquesa','#0f766e'],['Cinza','#475569']];
export default function AccountColorPicker({account}:{account:Conta}){
 const [open,setOpen]=useState(false),[color,setColor]=useState(account.cor??'#2459e0'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(value?:string){if(busy)return;setBusy(true);setError('');try{await db.transaction([db.contas],async tx=>{if(!await tx.contas.get(account.id))throw Error('Conta não encontrada.');await tx.contas.update(account.id,{cor:value});});setOpen(false);}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível salvar a cor.');}finally{setBusy(false);}}
 return <><button type="button" className={`iconbutton account-color-button${account.cor?' has-account-color':''}`} style={accountHeaderStyle(account.cor)} title={`Cor da conta ${account.nome}`} aria-label={`Cor da conta ${account.nome}`} onClick={()=>{setColor(account.cor??'#2459e0');setError('');setOpen(true);}}><Palette size={19}/></button>
 {open&&<div className="overlay"><section className="dialog" role="dialog" aria-modal="true" aria-label={`Cor da conta ${account.nome}`}><h3>Cor da conta · {account.nome}</h3><p className="muted">O cabeçalho usará esta cor quando esta conta estiver aberta.</p><fieldset disabled={busy} className="plain-fields"><div className="account-color-options" role="group" aria-label="Cores sugeridas">{palette.map(([name,value])=><button type="button" key={value} aria-label={name} aria-pressed={color===value} style={{backgroundColor:value}} onClick={()=>setColor(value)}>{color===value?'✓':''}</button>)}</div><label className="account-custom-color">Cor personalizada<input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><div className="account-color-preview" style={accountHeaderStyle(color)}>ControlAI · {account.nome}</div><div className="button-row"><button type="button" className="primary" onClick={()=>void save(color)}>Salvar cor</button><button type="button" className="secondary" onClick={()=>void save()}>Usar padrão</button><button type="button" className="textbutton" onClick={()=>setOpen(false)}>Cancelar</button></div></fieldset>{error&&<p role="alert" className="error">{error}</p>}</section></div>}
 </>;
}
