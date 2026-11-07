import {validatePartialPayments} from './partial-payments.ts';
import {validateCoupleBudget} from './couple-budget.ts';
import type {CompraMercado,Conta,Lancamento,PessoaGestora} from './db.ts';
export function contributionTarget(person:PessoaGestora,month:string){
 if(month<person.inicioMes||(person.fimMes&&month>person.fimMes))return 0;
 return [...person.contribuicoes].filter(c=>c.desde<=month).sort((a,b)=>b.desde.localeCompare(a.desde))[0]?.valorCentavos??0;
}
export function contributionPaid(entries:Lancamento[],personId:string,month:string){return entries.filter(e=>e.status==='confirmado'&&e.tipo==='receita'&&e.gestao?.tipo==='contribuicao'&&e.gestao.pessoaId===personId&&e.gestao.mesReferencia===month).reduce((s,e)=>s+e.valorCentavos,0);}
export function marketSettlement(purchase:CompraMercado){
 if(!Number.isSafeInteger(purchase.totalCentavos)||purchase.totalCentavos<=0)throw Error('Informe o total do mercado em centavos válidos.');
 const personal:Record<string,number>={};const ids=new Set<string>();
 for(const item of purchase.itens){if(!item.id||ids.has(item.id))throw Error('Item pessoal repetido.');ids.add(item.id);if(!item.descricao.trim()||!item.pessoaId||!Number.isSafeInteger(item.valorCentavos)||item.valorCentavos<=0)throw Error('Preencha pessoa, descrição e valor de cada item pessoal.');personal[item.pessoaId]=(personal[item.pessoaId]??0)+item.valorCentavos;}
 const personalTotal=Object.values(personal).reduce((s,n)=>s+n,0);
 if(personalTotal>purchase.totalCentavos)throw Error('Os itens pessoais ultrapassam o valor total do mercado.');
 const receivables=Object.fromEntries(Object.entries(personal).filter(([id])=>id!==purchase.pagadorPessoaId));
 return {pessoais:personal,comumCentavos:purchase.totalCentavos-personalTotal,receber:receivables,pagarCentavos:purchase.pagadorPessoaId?purchase.totalCentavos-(personal[purchase.pagadorPessoaId]??0):0};
}
export function marketPaid(entries:Lancamento[],purchaseId:string,personId:string,direction:'receber'|'pagar'){
 return entries.filter(e=>e.status==='confirmado'&&e.gestao?.compraId===purchaseId&&e.gestao.pessoaId===personId&&e.gestao.tipo===(direction==='receber'?'reembolsoMercado':'repasseMercado')&&e.tipo===(direction==='receber'?'receita':'despesa')).reduce((s,e)=>s+e.valorCentavos,0);
}
export function validateManagement(account:Conta){
 validateCoupleBudget(account);
 if(account.lembretes){const c=account.lembretes;if(typeof c.ativo!=='boolean'||![c.antecedenciaDias,c.hora,c.contribuicaoDia,c.reembolsoDias].every(Number.isInteger)||c.antecedenciaDias<0||c.antecedenciaDias>30||c.hora<0||c.hora>23||c.contribuicaoDia<1||c.contribuicaoDia>31||c.reembolsoDias<0||c.reembolsoDias>60)throw Error('Preferências de lembretes inválidas.');}
 if(account.cor!==undefined&&(typeof account.cor!=='string'||!/^#[\da-f]{6}$/i.test(account.cor)))throw Error('Cor da conta inválida.');
 const ids=new Set<string>();
 for(const person of account.pessoas??[]){if(!person.id||ids.has(person.id)||!person.nome.trim())throw Error('Pessoa gestora inválida.');ids.add(person.id);for(const target of person.contribuicoes)if(!Number.isSafeInteger(target.valorCentavos)||target.valorCentavos<0)throw Error('Contribuição mensal inválida.');}
 const cards=new Set<string>();for(const card of account.cartoes??[]){if(!card.id||cards.has(card.id)||!card.nome.trim()||![card.fechamento,card.vencimento].every(n=>Number.isInteger(n)&&n>=1&&n<=31))throw Error('Cartão inválido.');if(card.pessoaId&&!ids.has(card.pessoaId))throw Error('Titular do cartão não encontrado.');cards.add(card.id);}
 const purchases=new Set<string>();for(const purchase of account.mercados??[]){if(!purchase.id||purchases.has(purchase.id))throw Error('Compra de mercado repetida.');purchases.add(purchase.id);marketSettlement(purchase);if((purchase.cartaoId&&!cards.has(purchase.cartaoId))||(purchase.pagadorPessoaId&&!ids.has(purchase.pagadorPessoaId))||purchase.itens.some(i=>!ids.has(i.pessoaId)))throw Error('Compra de mercado com cartão ou pessoa inexistente.');}
}

export function validateFinancialReferences(accounts:Conta[],entries:Lancamento[],recurrences:import('./db.ts').Recorrencia[]){
 validatePartialPayments(entries);
 const byId=new Map(accounts.map(a=>[a.id,a]));const originals=new Set<string>();
 for(const entry of [...entries,...recurrences]){
  if(entry.cartaoId&&!byId.get(entry.contaId??'')?.cartoes?.some(c=>c.id===entry.cartaoId))throw Error('Lançamento com cartão de outra conta ou inexistente.');
 }
 for(const entry of entries){
  const movement=entry.gestao;if(!movement)continue;const account=byId.get(entry.contaId??'');
  if(!account||account.tipo!=='gestora'||entry.valorCentavos<=0)throw Error('Movimento da gestora inválido.');
  const purchase=account.mercados?.find(p=>p.id===movement.compraId),person=account.pessoas?.find(p=>p.id===movement.pessoaId);
  if(movement.tipo==='compraMercado'){
   const key=`${account.id}:${movement.compraId}`;
   if(!purchase||purchase.pagadorPessoaId||entry.tipo!=='despesa'||entry.valorCentavos!==purchase.totalCentavos||originals.has(key))throw Error('Lançamento original de mercado inválido ou duplicado.');originals.add(key);
  }else{
   if(!person)throw Error('Pessoa do movimento não encontrada.');
   if(movement.tipo==='contribuicao'){if(entry.tipo!=='receita'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(movement.mesReferencia??''))throw Error('Contribuição sem referência mensal válida.');}
   else if(movement.tipo==='receitaPessoa'){if(entry.tipo!=='receita')throw Error('Entrada avulsa inválida.');}
   else if(movement.tipo==='reembolsoMercado'){if(!purchase||entry.tipo!=='receita'||!(marketSettlement(purchase).receber[person.id]>0))throw Error('Reembolso sem compra ou pessoa válida.');}
   else if(movement.tipo==='repasseMercado'){if(!purchase||entry.tipo!=='despesa'||purchase.pagadorPessoaId!==person.id)throw Error('Repasse para titular incorreto.');}
   else throw Error('Tipo de movimento da gestora inválido.');
  }
 }
 for(const account of accounts)for(const purchase of account.mercados??[]){
  if(!purchase.pagadorPessoaId&&!originals.has(`${account.id}:${purchase.id}`))throw Error('Compra de gestão sem lançamento original.');
  const movements=entries.filter(e=>e.contaId===account.id),settlement=marketSettlement(purchase);
  for(const [person,amount] of Object.entries(settlement.receber))if(marketPaid(movements,purchase.id,person,'receber')>amount)throw Error('Reembolsos ultrapassam os itens pessoais.');
  if(purchase.pagadorPessoaId&&marketPaid(movements,purchase.id,purchase.pagadorPessoaId,'pagar')>settlement.pagarCentavos)throw Error('Repasses ultrapassam o saldo do titular.');
 }
}

export function personMarketBalance(purchases:CompraMercado[],entries:Lancamento[],personId:string){
 return purchases.reduce((sum,purchase)=>{const settlement=marketSettlement(purchase);const receive=settlement.receber[personId]??0,pay=purchase.pagadorPessoaId===personId?settlement.pagarCentavos:0;return {pessoais:sum.pessoais+(settlement.pessoais[personId]??0),receber:sum.receber+receive,recebido:sum.recebido+marketPaid(entries,purchase.id,personId,'receber'),pagar:sum.pagar+pay,pago:sum.pago+marketPaid(entries,purchase.id,personId,'pagar')};},{pessoais:0,receber:0,recebido:0,pagar:0,pago:0});
}

export function marketProgress(purchase:CompraMercado,entries:Lancamento[]){
 const settlement=marketSettlement(purchase),people=Object.entries(settlement.pessoais).filter(([,amount])=>amount>0);
 const reimbursementPending=Object.entries(settlement.receber).reduce((sum,[id,amount])=>sum+Math.max(0,amount-marketPaid(entries,purchase.id,id,'receber')),0);
 const settledPeople=people.filter(([id,amount])=>id===purchase.pagadorPessoaId||marketPaid(entries,purchase.id,id,'receber')>=amount).length;
 const payoutPending=purchase.pagadorPessoaId?Math.max(0,settlement.pagarCentavos-marketPaid(entries,purchase.id,purchase.pagadorPessoaId,'pagar')):0;
 return {people:people.length,settledPeople,reimbursementPending,payoutPending,settled:reimbursementPending===0&&payoutPending===0};
}
