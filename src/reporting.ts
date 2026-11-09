import type {Conta,Lancamento} from './db.ts';
import {inControlPeriod} from './control-start.ts';
export type ReportBasis='referencia'|'pagamento';
export function referenceMonth(entry:Lancamento):string{
 if(entry.gestao?.tipo==='contribuicao'&&entry.gestao.mesReferencia)return entry.gestao.mesReferencia;
 return entry.competencia??(entry.parcial?.dataPrevista??entry.dataPrevista??entry.data).slice(0,7);
}
export function reportMonth(entry:Lancamento,basis:ReportBasis){return basis==='pagamento'?entry.data.slice(0,7):referenceMonth(entry);}
export function financialReports(entries:Lancamento[],account:Conta|undefined,month:string,basis:ReportBasis='referencia'){
 const year=Number(month.slice(0,4)),confirmed=entries.filter(e=>(!account||e.contaId===account.id)&&e.status==='confirmado'&&inControlPeriod(account,e));
 const sum=(rows:Lancamento[],type:'receita'|'despesa')=>rows.filter(e=>e.tipo===type).reduce((s,e)=>s+e.valorCentavos,0);
 const annual=Array.from({length:12},(_,i)=>{const prefix=`${year}-${String(i+1).padStart(2,'0')}`,rows=confirmed.filter(e=>reportMonth(e,basis)===prefix),income=sum(rows,'receita'),expense=sum(rows,'despesa');return {mes:new Date(year,i,1).toLocaleDateString('pt-BR',{month:'short'}),receitas:income/100,despesas:expense/100,saldo:(income-expense)/100};});
 const rows=confirmed.filter(e=>reportMonth(e,basis)===month),income=sum(rows,'receita'),expense=sum(rows,'despesa'),categories=Object.entries(rows.filter(e=>e.tipo==='despesa').reduce<Record<string,number>>((s,e)=>{s[e.categoria]=(s[e.categoria]??0)+e.valorCentavos;return s;},{})).map(([name,value])=>({name,value:value/100})).sort((a,b)=>b.value-a.value);
 return {year,annual,categories,income,expense,weight:income>0?expense/income*100:null};
}
