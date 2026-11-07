import {remainingDaily} from './insights';
import {hoje,moeda} from './utils';
export default function DailyAvailable({week}:{week:{inicio:string;fim:string;limite:number;gasto:number}}){const available=remainingDaily(week,hoje());return <span className={`daily-available${available.remaining<0?' red':''}`}>{available.days?`${moeda(available.daily)}/dia disponível · ${available.days} dia(s) restante(s)`:'Semana encerrada'}</span>;}
