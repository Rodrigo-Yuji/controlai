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
 const rows=confirmed.filter(e=>reportMonth(e,basis)===month),income=sum(rows,'receita'),expense=sum(rows,'despesa'),categories=Object.entries(rows.filter(e=>e.tipo==='despesa').reduce<Record<string,number>>((s,e)=>{s[e.categoria]=(s[e.categoria]??0)+e.valorCentavos;return s;},{})).filter(([,value])=>value>0).map(([name,value])=>({name,value:value/100})).sort((a,b)=>b.value-a.value);
 // Média mensal por categoria: últimos 12 meses até o mês escolhido, a partir do primeiro mês com despesa
 // confirmada (e do início do controle), para não diluir a média com meses sem registros.
 const shift=(m:string,n:number)=>{const d=new Date(Date.UTC(Number(m.slice(0,4)),Number(m.slice(5,7))-1+n,1));return d.toISOString().slice(0,7);};
 const expenses=confirmed.filter(e=>e.tipo==='despesa'),first=expenses.reduce((m,e)=>{const r=reportMonth(e,basis);return r<m?r:m;},'9999-12'),start=account?.inicioControle?.data.slice(0,7)??'';
 const window=Array.from({length:12},(_,i)=>shift(month,-i)).filter(m=>m>=first&&m>=start),inWindow=new Set(window);
 const totals=expenses.filter(e=>inWindow.has(reportMonth(e,basis))).reduce<Record<string,number>>((acc,e)=>{acc[e.categoria]=(acc[e.categoria]??0)+e.valorCentavos;return acc;},{});
 const averages=Object.fromEntries(Object.entries(totals).map(([name,value])=>[name,window.length?Math.round(value/window.length):0]));
 return {year,annual,categories,income,expense,weight:income>0?expense/income*100:null,averages,averageMonths:window.length};
}
