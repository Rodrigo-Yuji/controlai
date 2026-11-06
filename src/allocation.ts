export function amountPercentage(amount:number,base:number){
 if(!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(base)||base<=0)return 0;
 return Number((BigInt(amount)*10000n+BigInt(base)/2n)/BigInt(base))/100;
}
export function validAllocationAmount(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
