import {useEffect,useState,type FormEvent} from 'react';
import {createClient} from '@supabase/supabase-js';
import {dataBR,moeda} from './utils';

const groceries=createClient('https://vdlmvlycofddjmdzffyd.supabase.co','sb_publishable_L7OvV-QDf12iD3L3IAAJag_jZ8QCK9z',{
 auth:{storageKey:'controlai-groceries-session',detectSessionInUrl:false}
});
type House={id:string;name:string};
export type GroceryReceipt={id:string;market:string;date:string;total:number;lines:{name:string;quantity:number;unit:string;total:number}[]};
type Props={accountId:string;reviewed:Set<string>;onReview:(receipt:GroceryReceipt)=>void};

export default function GroceryReceipts({accountId,reviewed,onReview}:Props){
 const key='controlai-groceries-house:'+accountId;
 const [house,setHouse]=useState(()=>localStorage.getItem(key)||'');
 const [houses,setHouses]=useState<House[]>([]);
 const [signedIn,setSignedIn]=useState(false);
 const [receipts,setReceipts]=useState<GroceryReceipt[]>([]);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  async function load(){
   try{
    const {data:{session},error:authError}=await groceries.auth.getSession();
    if(authError)throw authError;
    if(!active)return;
    setSignedIn(Boolean(session));
    if(!session){setHouses([]);setReceipts([]);return;}
    const {data:available,error:houseError}=await groceries.from('grocery_households').select('id,name').order('name');
    if(houseError)throw houseError;
    if(!active)return;
    setHouses(available??[]);
    if(!available?.some(row=>row.id===house)){setReceipts([]);return;}
    const next:GroceryReceipt[]=[];
    for(let offset=0;;offset+=250){
     const {data,error:receiptError}=await groceries.from('grocery_records').select('id,data').eq('household_id',house).eq('kind','purchase').eq('deleted',false).contains('data',{controlAIEligible:true}).order('id').range(offset,offset+249);
     if(receiptError)throw receiptError;
     if(!active)return;
     next.push(...(data??[]).map(row=>({...row.data,id:row.id}) as GroceryReceipt));
     if(!data||data.length<250)break;
    }
    setReceipts(next.sort((a,b)=>b.date.localeCompare(a.date)));
    setError('');
   }catch{if(active){setReceipts([]);setError('Não foi possível consultar os cupons do Groceries.');}}
  }
  void load();
  const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},15000);
  const refresh=()=>{void load();};
  window.addEventListener('focus',refresh);
  const {data:{subscription}}=groceries.auth.onAuthStateChange(()=>{window.setTimeout(refresh,0);});
  return ()=>{active=false;subscription.unsubscribe();clearInterval(interval);window.removeEventListener('focus',refresh);};
 },[house]);
 async function signIn(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');
  const form=event.currentTarget;
  const fields=new FormData(form);
  try{
   const {error}=await groceries.auth.signInWithPassword({email:String(fields.get('email')).trim(),password:String(fields.get('password'))});
   if(error)throw error;
   form.reset();
  }catch{setError('Não foi possível entrar no Groceries. Confira o e-mail, a senha e a confirmação da conta.');}
  finally{setBusy(false);}
 }
 function selectHouse(id:string){setReceipts([]);localStorage.setItem(key,id);setHouse(id);}
 const pending=receipts.filter(receipt=>!reviewed.has(receipt.id));
 return <details><summary>Cupons do Groceries ({pending.length} pendentes)</summary>
  {signedIn?<><label>Casa vinculada<select value={house} onChange={e=>selectHouse(e.target.value)}><option value="">Selecione a casa</option>{houses.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><button type="button" className="textbutton" onClick={()=>{selectHouse('');void groceries.auth.signOut({scope:'local'});}}>Desvincular Groceries</button></>:<form className="fields" onSubmit={signIn}><label>E-mail do Groceries<input type="email" name="email" required autoComplete="username"/></label><label>Senha do Groceries<input type="password" name="password" required autoComplete="current-password"/></label><button type="submit" className="secondary" disabled={busy}>Vincular Groceries</button></form>}
  {error&&<p role="alert">{error}</p>}
  {pending.map(receipt=><div className="record" key={receipt.id}><div className="recordbody"><strong>{receipt.market}</strong><small>{dataBR(receipt.date)} · {moeda(Math.round(receipt.total*100))}</small></div><button type="button" className="secondary" onClick={()=>onReview(receipt)}>Revisar cupom</button></div>)}
 </details>;
}
