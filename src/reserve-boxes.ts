import {validDate} from './assistant.ts';
import {ensureOpenMonth} from './account-guards.ts';
import type {Caixinha,Conta,Reserva} from './db.ts';
import type {Database} from './storage/types.ts';

// Caixinhas: extra reserves (travel, car, gifts...) besides the main reserve.
//
// A caixinha is listed in the account document (Conta.caixinhas) and its money is
// kept in the same `reservas` table, tagged with `caixinhaId`. Rows without it are
// the main reserve, so every existing total keeps counting all reserves together.
// A loan may come from any of them (its `caixinhaId`), and repayments go back to
// the same one. Each reserve has its own balance and can never go below zero.
//
// Implantação de saldo (`implantacao: true`): money that was already saved before
// using the app. It enters the reserve and the account total at the same time, so
// the spendable balance (total minus reserve) does not change.
export const MAX_BOX_NAME=40;
export const MAX_BOXES=50;
export const MAIN_RESERVE='';
export const MAIN_RESERVE_LABEL='Reserva principal';
const positiveCents=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
const cleanName=(name:string)=>name.replace(/\s+/g,' ').trim();
const nameKey=(name:string)=>cleanName(name).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

export const boxOf=(row:Pick<Reserva,'caixinhaId'>)=>row.caixinhaId??MAIN_RESERVE;
export const rowsOfBox=<T extends Pick<Reserva,'caixinhaId'>>(rows:readonly T[],boxId:string)=>rows.filter(r=>boxOf(r)===boxId);
export const boxBalance=(rows:readonly Pick<Reserva,'caixinhaId'|'data'|'valorCentavos'>[],boxId:string,through='9999-12-31')=>rowsOfBox(rows,boxId).filter(r=>r.data<=through).reduce((s,r)=>s+r.valorCentavos,0);
// The main reserve can be renamed and get a goal (Conta.reservaPrincipal).
export const mainReserveName=(account:Pick<Conta,'reservaPrincipal'>|undefined)=>account?.reservaPrincipal?.nome||MAIN_RESERVE_LABEL;
export const boxName=(account:Pick<Conta,'caixinhas'|'reservaPrincipal'>|undefined,boxId:string)=>boxId?account?.caixinhas?.find(c=>c.id===boxId)?.nome??'Caixinha':mainReserveName(account);
// Caixinhas marked `foraDaReserva` hold money kept apart (for example, savings from
// before the couple). They don't count in the reserve nor in the account total:
// guardar into them takes money out of the account and resgatar brings it back.
export const separateBoxIds=(account:Pick<Conta,'caixinhas'>|undefined)=>new Set((account?.caixinhas??[]).filter(c=>c.foraDaReserva).map(c=>c.id));
export const inSeparateBox=(row:Pick<Reserva,'caixinhaId'>,separate:ReadonlySet<string>)=>!!row.caixinhaId&&separate.has(row.caixinhaId);
export const isImplantation=(row:Pick<Reserva,'implantacao'>)=>row.implantacao===true;
// Rendimento (`rendimento: true`): net yield paid by the bank on a reserve. Like
// implantação it is new money: it raises the reserve and the total, never the
// spendable balance, and it is not income of the month (budget and reports ignore it).
export const isYield=(row:Pick<Reserva,'rendimento'>)=>row.rendimento===true;
// Money that entered the reserves from outside the account (implantação and
// rendimentos) up to `through` (and from `from`, when given).
export function reserveImplanted(rows:readonly Pick<Reserva,'implantacao'|'rendimento'|'data'|'valorCentavos'>[]=[],through:string,from?:string){
 let total=0;
 for(const row of rows)if((row.implantacao||row.rendimento)&&row.data<=through&&(!from||row.data>=from))total+=row.valorCentavos;
 return total;
}
// Yield of one reserve (or of the given rows) whose date starts with `period` (YYYY or YYYY-MM).
export const yieldIn=(rows:readonly Pick<Reserva,'rendimento'|'data'|'valorCentavos'>[],period:string)=>rows.filter(r=>r.rendimento&&r.data.startsWith(period)).reduce((s,r)=>s+r.valorCentavos,0);

// The reserve may never go below zero on any date, deposits first on the same day.
export function staysNonNegative(rows:readonly Pick<Reserva,'data'|'valorCentavos'>[]){
 let balance=0;
 for(const row of [...rows].sort((a,b)=>a.data.localeCompare(b.data)||b.valorCentavos-a.valorCentavos)){balance+=row.valorCentavos;if(balance<0)return false;}
 return true;
}

export function validateBoxes(account:Conta){
 const main=account.reservaPrincipal;
 if(main!==undefined){
  if(!main||typeof main!=='object')throw Error('Reserva principal inválida.');
  if(main.nome!==undefined&&(typeof main.nome!=='string'||!cleanName(main.nome)||cleanName(main.nome).length>MAX_BOX_NAME))throw Error(`Informe o nome da reserva (até ${MAX_BOX_NAME} caracteres).`);
  if(main.metaCentavos!==undefined&&!positiveCents(main.metaCentavos))throw Error('Meta da reserva principal inválida.');
 }
 const boxes=account.caixinhas;
 if(boxes===undefined)return;
 if(!Array.isArray(boxes)||boxes.length>MAX_BOXES)throw Error('Caixinhas inválidas.');
 const ids=new Set<string>(),names=new Set<string>();
 for(const box of boxes){
  if(!box||typeof box.id!=='string'||!box.id||ids.has(box.id))throw Error('Identificador de caixinha inválido ou repetido.');
  const name=typeof box.nome==='string'?cleanName(box.nome):'';
  if(!name||name.length>MAX_BOX_NAME)throw Error(`Informe o nome da caixinha (até ${MAX_BOX_NAME} caracteres).`);
  if(names.has(nameKey(name))||nameKey(name)===nameKey(mainReserveName(account)))throw Error('Já existe uma reserva com esse nome.');
  if(box.metaCentavos!==undefined&&!positiveCents(box.metaCentavos))throw Error('Meta da caixinha inválida.');
  if(box.foraDaReserva!==undefined&&box.foraDaReserva!==true)throw Error('Marcação de caixinha fora da reserva inválida.');
  ids.add(box.id);names.add(nameKey(name));
 }
}
export function validateBoxRow(row:Reserva){
 if(row.caixinhaId!==undefined&&(typeof row.caixinhaId!=='string'||!row.caixinhaId||row.caixinhaId.length>64))throw Error('Caixinha do movimento inválida.');
 if(row.rendimento!==undefined&&(row.rendimento!==true||!positiveCents(row.valorCentavos)||row.gasto||row.implantacao!==undefined||row.emprestimoId!==undefined))throw Error('Rendimento da reserva inválido.');
 if(row.implantacao===undefined)return;
 if(row.implantacao!==true||!positiveCents(row.valorCentavos)||row.gasto||row.emprestimoId!==undefined)throw Error('Implantação de saldo inválida.');
}
// Every movement must point to a caixinha that still exists in its account.
export function validateBoxReferences(accounts:readonly Conta[],rows:readonly Reserva[]){
 const boxes=new Map(accounts.map(a=>[a.id,new Set((a.caixinhas??[]).map(c=>c.id))]));
 for(const row of rows)if(row.caixinhaId&&!boxes.get(row.contaId??'')?.has(row.caixinhaId))throw Error('Movimento de reserva aponta para uma caixinha inexistente.');
}

type Store=Pick<Database,'transaction'|'contas'|'reservas'|'fechamentos'>;
const stores=(db:Store)=>[db.contas,db.reservas,db.fechamentos];
async function accountWithBox(tx:Pick<Database,'contas'>,accountId:string,boxId:string){
 const account=await tx.contas.get(accountId);
 if(!account)throw Error('Conta não encontrada.');
 if(boxId&&!account.caixinhas?.some(c=>c.id===boxId))throw Error('Caixinha não encontrada. Reabra a reserva.');
 return account;
}

export interface BoxInput{nome:string;metaCentavos?:number;foraDaReserva?:boolean}
export async function saveBox(db:Store,accountId:string,input:BoxInput,boxId?:string,newId:()=>string=()=>crypto.randomUUID()){
 const nome=cleanName(input.nome);
 if(!nome||nome.length>MAX_BOX_NAME)throw Error(`Informe o nome da caixinha (até ${MAX_BOX_NAME} caracteres).`);
 if(input.metaCentavos!==undefined&&!positiveCents(input.metaCentavos))throw Error('A meta precisa ser maior que zero.');
 return db.transaction(stores(db),async tx=>{
  const account=await accountWithBox(tx,accountId,boxId??MAIN_RESERVE),boxes=account.caixinhas??[];
  if(!boxId&&boxes.length>=MAX_BOXES)throw Error(`Limite de ${MAX_BOXES} caixinhas atingido.`);
  const box:Caixinha={id:boxId??newId(),nome,...(input.metaCentavos?{metaCentavos:input.metaCentavos}:{}),...(input.foraDaReserva?{foraDaReserva:true as const}:{})};
  const next=boxId?boxes.map(c=>c.id===boxId?box:c):[...boxes,box];
  validateBoxes({...account,caixinhas:next});
  await tx.contas.update(accountId,{caixinhas:next});
  return box;
 });
}
// Renames the main reserve and sets (or clears) its goal; the default name comes back when cleared.
export async function saveMainReserve(db:Store,accountId:string,input:BoxInput){
 const nome=cleanName(input.nome);
 if(!nome||nome.length>MAX_BOX_NAME)throw Error(`Informe o nome da reserva (até ${MAX_BOX_NAME} caracteres).`);
 if(input.metaCentavos!==undefined&&!positiveCents(input.metaCentavos))throw Error('A meta precisa ser maior que zero.');
 return db.transaction(stores(db),async tx=>{
  const account=await accountWithBox(tx,accountId,MAIN_RESERVE);
  const main={...(nome!==MAIN_RESERVE_LABEL?{nome}:{}),...(input.metaCentavos?{metaCentavos:input.metaCentavos}:{})};
  validateBoxes({...account,reservaPrincipal:main});
  await tx.contas.update(accountId,{reservaPrincipal:main});
  return main;
 });
}
export async function removeBox(db:Store,accountId:string,boxId:string){
 return db.transaction(stores(db),async tx=>{
  const account=await accountWithBox(tx,accountId,boxId);
  if((await tx.reservas.where('contaId').equals(accountId).toArray()).some(r=>r.caixinhaId===boxId))throw Error('Esta caixinha tem movimentos. Exclua os movimentos antes de excluir a caixinha.');
  if(account.emprestimosReserva?.some(l=>l.caixinhaId===boxId))throw Error('Há empréstimos ligados a esta caixinha. Troque a caixinha deles antes de excluir.');
  await tx.contas.update(accountId,{caixinhas:(account.caixinhas??[]).filter(c=>c.id!==boxId)});
 });
}

export type ReserveOperation='deposito'|'retirada'|'implantacao'|'rendimento';
export interface ReserveMove{caixinhaId:string;operacao:ReserveOperation;descricao:string;valorCentavos:number;data:string}
export async function moveReserve(db:Store,accountId:string,input:ReserveMove){
 const descricao=cleanName(input.descricao);
 if(!descricao||descricao.length>80)throw Error('Informe a descrição (até 80 caracteres).');
 if(!positiveCents(input.valorCentavos))throw Error('Informe um valor maior que zero.');
 if(!validDate(input.data))throw Error('Informe uma data válida.');
 return db.transaction(stores(db),async tx=>{
  await accountWithBox(tx,accountId,input.caixinhaId);
  await ensureOpenMonth(tx,accountId,input.data);
  const value=input.operacao==='retirada'?-input.valorCentavos:input.valorCentavos;
  if(value<0){const rows=rowsOfBox(await tx.reservas.where('contaId').equals(accountId).toArray(),input.caixinhaId);if(!staysNonNegative([...rows,{data:input.data,valorCentavos:value}]))throw Error('Saldo insuficiente nesta reserva para esta data.');}
  const row:Reserva={contaId:accountId,descricao,valorCentavos:value,data:input.data,...(input.caixinhaId?{caixinhaId:input.caixinhaId}:{}),...(input.operacao==='implantacao'?{implantacao:true as const}:{}),...(input.operacao==='rendimento'?{rendimento:true as const}:{})};
  const id=await tx.reservas.add(row);
  return {...row,id:Number(id)};
 });
}
// Deleting a movement must not leave its reserve negative on any date.
export async function removeReserveRow(db:Store,accountId:string,rowId:number){
 return db.transaction(stores(db),async tx=>{
  const rows=await tx.reservas.where('contaId').equals(accountId).toArray(),row=rows.find(r=>r.id===rowId);
  if(!row)throw Error('Movimento não encontrado.');
  if(row.emprestimoId)throw Error('Este movimento pertence a um empréstimo da reserva. Para desfazê-lo, use Empréstimos da reserva.');
  await ensureOpenMonth(tx,accountId,row.data);
  if(!staysNonNegative(rowsOfBox(rows,boxOf(row)).filter(r=>r.id!==rowId)))throw Error('Excluir este movimento deixaria a reserva negativa em alguma data. Exclua antes os resgates ou gastos posteriores.');
  await tx.reservas.delete(rowId);
 });
}
