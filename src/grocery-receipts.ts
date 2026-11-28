// Compras vindas do Groceries. Toda compra da casa vale, menos as marcadas
// `controlAIEligible: false`; registros sem mercado, data ou total válidos ficam de fora.
export type GroceryLine={name:string;quantity:number;unit:string;total:number};
export type GroceryReceipt={id:string;market:string;date:string;total:number;lines:GroceryLine[]};
export function toReceipt(id:string,data:unknown):GroceryReceipt|null{
 if(!data||typeof data!=='object')return null;
 const row=data as Record<string,unknown>;
 if(row.controlAIEligible===false)return null;
 const date=typeof row.date==='string'?row.date.slice(0,10):'',total=Number(row.total);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(total)||total<=0)return null;
 const lines=Array.isArray(row.lines)?row.lines.filter((l):l is GroceryLine=>!!l&&typeof l==='object'&&typeof (l as GroceryLine).name==='string'&&Number.isFinite(Number((l as GroceryLine).total))):[];
 return {id,market:typeof row.market==='string'&&row.market.trim()?row.market.trim():'Mercado',date,total,lines};
}
