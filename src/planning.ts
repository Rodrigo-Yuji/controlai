import {amountPercentage,validAllocationAmount} from './allocation.ts';
import type {Configuracao,PlanejamentoMensal} from './db.ts';
import type {Database} from './storage/types.ts';
import {validDate} from './assistant.ts';
import {monthlyFixedBudget} from './budget.ts';
import {projectRecurrences} from './finance.ts';
import {ensureOpenMonth} from './account-guards.ts';
type Settings=Pick<Configuracao,'baseReceita'|'variaveis'|'reserva'|'valoresDistribuicao'>;
export function makeMonthlyPlan(month:string,base:number,fixed:number,settings:Settings):PlanejamentoMensal{
 const percentage=base>0?Math.round(fixed/base*10000)/100:NaN;
 const amounts=settings.valoresDistribuicao;
 if(amounts!==undefined&&(!amounts||!validAllocationAmount(amounts.variaveis)||!validAllocationAmount(amounts.reserva)||amounts.variaveis>base||amounts.reserva>base||fixed+amounts.variaveis+amounts.reserva!==base))throw Error('Os valores de fixos, variáveis e reserva devem somar a base de renda.');
 const variablePercentage=amounts?amountPercentage(amounts.variaveis,base):settings.variaveis,reservePercentage=amounts?amountPercentage(amounts.reserva,base):settings.reserva;
 const values=[percentage,variablePercentage,reservePercentage];
 if(!validDate(`${month}-01`)||!Number.isSafeInteger(base)||base<=0||!Number.isSafeInteger(fixed)||fixed<0||!['atual','prevista'].includes(settings.baseReceita??'')||values.some(n=>!Number.isFinite(n)||n<0||n>100||Math.abs(n*100-Math.round(n*100))>.000001)||(!amounts&&Math.round(values.reduce((s,n)=>s+n,0)*100)!==10000))throw Error('A distribuição deve somar 100%, com uma base maior que zero.');
 const variable=amounts?.variaveis??Math.round(base*settings.variaveis/100),reserve=amounts?.reserva??base-fixed-variable;
 if(reserve<0)throw Error('A distribuição ultrapassa a base de renda.');
 return {mes:month,baseReceita:settings.baseReceita!,baseCentavos:base,fixosCentavos:fixed,variaveisCentavos:variable,reservaCentavos:reserve,fixos:percentage,variaveis:variablePercentage,reserva:reservePercentage,...(amounts?{valoresDistribuicao:{...amounts}}:{}),travadoEm:new Date().toISOString()};
}
export function validatePlanning(config:Configuracao){
 if(config.valoresDistribuicao!==undefined&&(!config.valoresDistribuicao||!validAllocationAmount(config.valoresDistribuicao.variaveis)||!validAllocationAmount(config.valoresDistribuicao.reserva)))throw Error('Valores da distribuição inválidos.');
 if(config.planejamentos===undefined)return;
 if(!Array.isArray(config.planejamentos))throw Error('Planejamentos inválidos.');
 const months=new Set<string>();for(const plan of config.planejamentos){if(!plan||months.has(plan.mes)||typeof plan.travadoEm!=='string'||!Number.isFinite(Date.parse(plan.travadoEm)))throw Error('Planejamento mensal inválido ou repetido.');const expected=makeMonthlyPlan(plan.mes,plan.baseCentavos,plan.fixosCentavos,plan);if(plan.fixos!==expected.fixos||plan.variaveis!==expected.variaveis||plan.reserva!==expected.reserva||plan.variaveisCentavos!==expected.variaveisCentavos||plan.reservaCentavos!==expected.reservaCentavos)throw Error('Valores do planejamento mensal inconsistentes.');months.add(plan.mes);}
}
export async function saveMonthlyBudget(db:Database,accountId:string,month:string,settings:Settings,reviewed:{base:number;fixed:number},lock:boolean){
 await db.transaction([db.contas,db.configuracoes,db.fechamentos,db.lancamentos,db.recorrencias,db.salarios],async tx=>{
  const account=await tx.contas.get(accountId);if(!account||account.tipo==='gestora')throw Error('Selecione uma conta Solo ou Casal.');await ensureOpenMonth(tx,accountId,month);
  const config=await tx.configuracoes.get(accountId);if(config?.planejamentos?.some(p=>p.mes===month))throw Error('Destrave o planejamento deste mês antes de alterá-lo.');
  const entries=await tx.lancamentos.where('contaId').equals(accountId).toArray(),recurrences=await tx.recorrencias.where('contaId').equals(accountId).toArray(),projections=projectRecurrences(month,accountId,recurrences,entries,account.cartoes);
  const salaries=await tx.salarios.where('contaId').equals(accountId).toArray();
  const base=settings.baseReceita==='atual'?[...entries,...projections].filter(e=>e.tipo==='receita'&&e.data.slice(0,7)===month).reduce((s,e)=>s+e.valorCentavos,0):salaries.filter(s=>s.id===`${accountId}:1`||(account.conjunta&&s.id===`${accountId}:2`)).reduce((s,v)=>s+v.liquido+v.refeicao+v.beneficio+v.adicional,0);
  const fixed=monthlyFixedBudget([...entries,...projections],base,month).totalCentavos;
  if(base!==reviewed.base||fixed!==reviewed.fixed)throw Error('A renda ou os compromissos mudaram. Confira os valores atualizados e tente novamente.');
  const plan=makeMonthlyPlan(month,base,fixed,settings);
  await tx.configuracoes.put({...config,id:accountId,contaId:accountId,baseReceita:settings.baseReceita,fixos:plan.fixos,variaveis:plan.variaveis,reserva:plan.reserva,valoresDistribuicao:plan.valoresDistribuicao,...(lock?{planejamentos:[...(config?.planejamentos??[]),plan]}:{})});
 });
}
export async function unlockMonthlyBudget(db:Database,accountId:string,plan:PlanejamentoMensal){
 await db.transaction([db.configuracoes,db.fechamentos],async tx=>{await ensureOpenMonth(tx,accountId,plan.mes);const config=await tx.configuracoes.get(accountId),fresh=config?.planejamentos?.find(p=>p.mes===plan.mes);if(JSON.stringify(fresh)!==JSON.stringify(plan))throw Error('O planejamento mudou. Confira a versão atualizada.');await tx.configuracoes.update(accountId,{planejamentos:config!.planejamentos!.filter(p=>p.mes!==plan.mes)});});
}
