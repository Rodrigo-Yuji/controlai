const MAX_CENTS=BigInt(Number.MAX_SAFE_INTEGER);
export function moneyValueCents(value:string):number|null{
 let text=value.trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');if(!text)return null;
 if(text.includes(','))text=text.replace(/\./g,'').replace(',','.');
 const match=text.match(/^(\d+)(?:\.(\d{0,2}))?$/);if(!match)return null;
 const cents=BigInt(match[1])*100n+BigInt((match[2]??'').padEnd(2,'0'));return cents<=MAX_CENTS?Number(cents):null;
}
export function moneyDigitsValue(raw:string,deleting=false):string{
 if(!raw.trim())return '';if(raw.includes('-'))throw Error('Informe um valor positivo.');
 const digits=raw.replace(/\D/g,'');if(!digits)throw Error('Digite apenas números.');
 const cents=BigInt(digits);if(cents>MAX_CENTS)throw Error('Valor muito alto.');if(deleting&&cents===0n)return '';
 return `${cents/100n}.${String(cents%100n).padStart(2,'0')}`;
}
export function formatMoneyValue(value:string):string{
 const cents=moneyValueCents(value);if(cents===null)return value;
 const integer=String(Math.floor(cents/100)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');return `${integer},${String(cents%100).padStart(2,'0')}`;
}
