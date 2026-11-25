import type {Cartao,Lancamento,Recorrencia} from './db.ts';
import {dueDate,invoiceMonth,projectRecurrences,shiftMonth} from './finance.ts';

// Situation of each recurrence in a reference month ("conta de novembro").
// With `referenciaAnterior` the bill of a month is the one due in the next month.
// `pulados` (due months) records months the person chose not to pay, such as a
// haircut that did not happen; nothing is projected for them.
export type RecurringState='pago'|'parcial'|'pendente'|'atrasado'|'pulado';
export interface RecurringMonth{recurrence:Recorrencia;state:RecurringState;dueMonth:string;due:string;value:number;paid:number;entries:Lancamento[];projected?:Lancamento}
export const recurringDueMonth=(r:Pick<Recorrencia,'referenciaAnterior'>,month:string)=>r.referenciaAnterior?shiftMonth(month,1):month;
const occurrenceOf=(r:Recorrencia,e:Lancamento,dueMonth:string,cards:readonly Cartao[])=>{
 const original=e.parcial?.dataPrevista??e.dataPrevista;
 if(original)return original.slice(0,7)===dueMonth;
 const card=r.cartaoId?cards.find(c=>c.id===r.cartaoId):undefined;
 if(card&&e.cartaoId===r.cartaoId&&e.faturaMes)return e.faturaMes===invoiceMonth(dueDate(dueMonth,r.dia),card);
 return e.data.slice(0,7)===dueMonth;
};
export function recurringMonth(r:Recorrencia,month:string,entries:readonly Lancamento[],today:string,cards:readonly Cartao[]=[]):RecurringMonth|null{
 const dueMonth=recurringDueMonth(r,month);
 if(!r.ativa||r.inicio.slice(0,7)>dueMonth)return null;
 const due=dueDate(dueMonth,r.dia);
 const stored=entries.filter(e=>e.contaId===r.contaId&&e.recorrenciaId===r.id&&occurrenceOf(r,e,dueMonth,cards));
 const projected=projectRecurrences(dueMonth,r.contaId??'',[r],[...entries],[...cards])[0];
 const paid=stored.filter(e=>e.status==='confirmado').reduce((s,e)=>s+e.valorCentavos,0);
 const open=stored.filter(e=>e.status==='previsto');
 const value=projected?projected.valorCentavos:paid+open.reduce((s,e)=>s+e.valorCentavos,0);
 if(r.pulados?.includes(dueMonth)&&!stored.length)return {recurrence:r,state:'pulado',dueMonth,due,value:r.valorCentavos,paid:0,entries:[]};
 const pending=Boolean(projected)||open.length>0;
 const late=pending&&(open[0]?.data??due)<today;
 const state:RecurringState=!pending?'pago':paid>0?'parcial':late?'atrasado':'pendente';
 return {recurrence:r,state,dueMonth,due,value,paid,entries:stored,...(projected?{projected}:{})};
}
export function recurringSummary(rows:readonly RecurringMonth[]){
 const count=(...states:RecurringState[])=>rows.filter(r=>states.includes(r.state)).length;
 const missing=rows.filter(r=>r.state!=='pago'&&r.state!=='pulado').reduce((s,r)=>s+Math.max(0,r.value-r.paid),0);
 return {total:rows.length,pagos:count('pago'),pendentes:count('pendente','parcial'),atrasados:count('atrasado'),pulados:count('pulado'),faltaCentavos:missing};
}
// Skips (or un-skips) the bill of a month. Only months with nothing recorded can be skipped.
export function toggleSkip(r:Recorrencia,dueMonth:string,skip:boolean):Pick<Recorrencia,'pulados'>{
 const current=new Set(r.pulados??[]);
 if(skip)current.add(dueMonth);else current.delete(dueMonth);
 return {pulados:[...current].sort()};
}
