import type {Conta} from './db.ts';
import {validDate} from './assistant.ts';
export function validPersonalPercentages(percentages:unknown):percentages is [number,number]{return Array.isArray(percentages)&&percentages.length===2&&percentages.every(p=>Number.isInteger(p)&&p>=0&&p<=5000)&&percentages[0]+percentages[1]===5000;}
export function splitCoupleBudget(total:number,percentages:[number,number]=[2500,2500]){
 if(!Number.isSafeInteger(total)||total<0)throw Error('Orçamento variável inválido.');
 if(!validPersonalPercentages(percentages))throw Error('Os percentuais pessoais devem somar 50% do orçamento variável.');
 const personal=Math.floor(total/2),first=Number(BigInt(personal)*BigInt(percentages[0])/5000n);
 return {comum:total-personal,pessoais:[first,personal-first] as [number,number]};
}
export function validPersonalPercentage(value:unknown):value is number{return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=10000;}
export function splitSharedBudget(total:number,percentage=5000){
 if(!Number.isSafeInteger(total)||total<0||!validPersonalPercentage(percentage))throw Error('Informe um percentual pessoal entre 0% e 100%.');
 const personal=Number(BigInt(total)*BigInt(percentage)/10000n),first=Math.floor(personal/2);
 return {comum:total-personal,pessoais:[first,personal-first] as [number,number]};
}
export function personalBalances(account:Conta,through='9999-12-31'){
 return ([1,2] as const).map(holder=>{const credited=(account.distribuicoesCasal??[]).filter(d=>`${d.mes}-01`<=through).reduce((s,d)=>s+d.pessoais[holder-1],0);const sent=(account.transferenciasPessoais??[]).filter(t=>t.titular===holder&&t.data<=through).reduce((s,t)=>s+t.valorCentavos,0);return {creditado:credited,transferido:sent,pendente:credited-sent};});
}
export function validateCoupleBudget(account:Conta){
 if(((account.distribuicoesCasal?.length??0)>0||(account.transferenciasPessoais?.length??0)>0)&&!(account.tipo==='casal'||(!account.tipo&&account.conjunta)))throw Error('Saldos pessoais exigem uma conta Casal.');
 if(account.percentuaisPessoaisCasal!==undefined&&!validPersonalPercentages(account.percentuaisPessoaisCasal))throw Error('Percentuais pessoais inválidos.');
 if(account.percentualPessoalCasal!==undefined&&!validPersonalPercentage(account.percentualPessoalCasal))throw Error('Percentual pessoal inválido.');
 const months=new Set<string>(),ids=new Set<string>();const events:{date:string;holder:number;value:number}[]=[];
 for(const d of account.distribuicoesCasal??[]){if(!validDate(`${d.mes}-01`)||months.has(d.mes)||!validDate(d.confirmadaEm)||!Array.isArray(d.pessoais)||d.pessoais.length!==2)throw Error('Distribuição mensal do casal inválida ou repetida.');const split=d.percentualPessoal!==undefined?splitSharedBudget(d.totalCentavos,d.percentualPessoal):splitCoupleBudget(d.totalCentavos,d.percentuaisPessoais);if(d.comumCentavos!==split.comum||d.pessoais.some((v,i)=>v!==split.pessoais[i]))throw Error('A divisão deve corresponder ao percentual pessoal definido, com ajuste de centavos.');months.add(d.mes);d.pessoais.forEach((value,i)=>events.push({date:`${d.mes}-01`,holder:i,value}));}
 for(const t of account.transferenciasPessoais??[]){if(!t.id||ids.has(t.id)||![1,2].includes(t.titular)||!validDate(t.data)||!Number.isSafeInteger(t.valorCentavos)||t.valorCentavos<=0)throw Error('Transferência pessoal inválida.');ids.add(t.id);events.push({date:t.data,holder:t.titular-1,value:-t.valorCentavos});}
 const balance=[0,0];events.sort((a,b)=>a.date.localeCompare(b.date)||b.value-a.value);for(const e of events){balance[e.holder]+=e.value;if(balance[e.holder]<0)throw Error('A transferência ultrapassa o saldo pessoal liberado nessa data.');}
}
