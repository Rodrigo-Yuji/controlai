import type { Lancamento } from './db.ts';
import { isMonthlyCommitment } from './budget.ts';
const iso = (date: Date) => date.toISOString().slice(0,10);
const advance = (date: Date, days: number) => new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()+days));
// Salary-payment convention: Saturdays count; Sundays and fixed national
// holidays do not. State/municipal holidays need a local calendar.
export function fifthBusinessDay(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mês inválido.');
  const [year,number]=month.split('-').map(Number);
  const holidays=new Set(['01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25',...(year>=2024?['11-20']:[])]);
  let count=0;
  for(let day=1;day<=31;day++) {
    const date=new Date(Date.UTC(year,number-1,day));
    if(date.getUTCDay()!==0&&!holidays.has(iso(date).slice(5))) count++;
    if(count===5) return iso(date);
  }
  throw new Error('Não foi possível calcular o pagamento.');
}
export function payCycleWeeks(month:string, entries:Lancamento[], budgetCentavos:number) {
  const start=fifthBusinessDay(month);
  const [year,number]=month.split('-').map(Number);
  const nextMonth=iso(new Date(Date.UTC(year,number,1))).slice(0,7);
  const end=iso(advance(new Date(`${fifthBusinessDay(nextMonth)}T00:00:00Z`),-1));
  const weeks:{inicio:string;fim:string;gasto:number;limite:number}[]=[];
  for(let current=new Date(`${start}T00:00:00Z`);iso(current)<=end;) {
    const inicio=iso(current),sunday=iso(advance(current,(7-current.getUTCDay())%7)),fim=sunday<end?sunday:end;
    const gasto=entries.filter(entry=>entry.status==='confirmado'&&entry.tipo==='despesa'&&!isMonthlyCommitment(entry)&&entry.data>=inicio&&entry.data<=fim).reduce((sum,entry)=>sum+entry.valorCentavos,0);
    weeks.push({inicio,fim,gasto,limite:0});
    current=advance(new Date(`${fim}T00:00:00Z`),1);
  }
  const budget=Math.max(0,Math.round(budgetCentavos));
  const totalDays=Math.round((Date.parse(end)-Date.parse(start))/86400000)+1;
  // Cumulative rounding prorates partial weeks and conserves every cent.
  let daysPassed=0,allocated=0;
  for(const week of weeks){
    daysPassed+=Math.round((Date.parse(week.fim)-Date.parse(week.inicio))/86400000)+1;
    const cumulative=Number(BigInt(budget)*BigInt(daysPassed)/BigInt(totalDays));
    week.limite=cumulative-allocated;allocated=cumulative;
  }
  return {inicio:start,fim:end,semanas:weeks};
}
export const percentageText = (value:number) => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(value);

export function weeklyDailyReference(week:{inicio:string;fim:string;limite:number}){
 const days=Math.round((Date.parse(`${week.fim}T00:00:00Z`)-Date.parse(`${week.inicio}T00:00:00Z`))/86400000)+1;
 return {dias:days,centavos:days>0?Math.floor(Math.max(0,week.limite)/days):0};
}
