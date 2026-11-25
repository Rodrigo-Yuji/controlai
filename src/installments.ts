import type {Cartao,Lancamento} from './db.ts';

export interface InstallmentGroup{grupo:string;nome:string;total:number;registradas:number;pagas:number;valorTotal:number;pago:number;falta:number;parcela:number;proxima?:Lancamento;ultima:string;cartao?:string;atrasadas:number}
// Groups installment entries by purchase (parcela.grupo) with paid/remaining figures.
export function installmentGroups(entries:readonly Lancamento[],cards:readonly Cartao[],today:string):InstallmentGroup[]{
 const groups=new Map<string,Lancamento[]>();
 for(const e of entries)if(e.parcela)groups.set(e.parcela.grupo,[...(groups.get(e.parcela.grupo)??[]),e]);
 return [...groups.entries()].map(([grupo,items])=>{
  const open=items.filter(e=>e.status==='previsto').sort((a,b)=>a.data.localeCompare(b.data));
  const paidNumbers=new Set(items.filter(e=>e.status==='confirmado'&&!open.some(o=>o.parcela?.numero===e.parcela?.numero)).map(e=>e.parcela!.numero));
  const pago=items.filter(e=>e.status==='confirmado').reduce((s,e)=>s+e.valorCentavos,0),falta=open.reduce((s,e)=>s+e.valorCentavos,0);
  const first=items[0],card=first.cartaoId?cards.find(c=>c.id===first.cartaoId)?.nome:undefined;
  return {grupo,nome:first.descricao.replace(/ \(\d+\/\d+\)$/,''),total:first.parcela!.total,registradas:new Set(items.map(e=>e.parcela!.numero)).size,pagas:paidNumbers.size,valorTotal:pago+falta,pago,falta,
   parcela:Math.round((pago+falta)/Math.max(1,items.length)),proxima:open[0],ultima:items.reduce((m,e)=>(e.faturaMes??e.data.slice(0,7))>m?(e.faturaMes??e.data.slice(0,7)):m,''),...(card?{cartao:card}:{}),atrasadas:open.filter(e=>e.data<today).length};
 }).sort((a,b)=>(a.proxima?.data??'9999').localeCompare(b.proxima?.data??'9999')||a.nome.localeCompare(b.nome,'pt-BR'));
}
