import {validDate} from './assistant.ts';
import {ensureOpenMonth} from './account-guards.ts';
import {reserveStaysNonNegative} from './reserve-loans.ts';
import {MAIN_RESERVE,rowsOfBox,validateBoxRow} from './reserve-boxes.ts';
import type {Reserva} from './db.ts';
import type {Database} from './storage/types.ts';

// One-off spending paid straight from the reserve ("gasto avulso da reserva").
//
// It is NOT a Lancamento: it never touches the monthly/weekly variable budget,
// fixed commitments or the expense reports. It is a reserve withdrawal tagged
// with `gasto`, and the money leaves the account, so the total balance drops by
// the same amount the reserve drops. The spendable balance (total minus reserve)
// stays the same.
export const MAX_SPEND_DESCRIPTION=80;
const positiveCents=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;

export const isReserveSpending=(row:Pick<Reserva,'gasto'>)=>row.gasto===true;
// Reserve rows that move money between the spendable balance and the reserve.
// Spending and loan rows leave the account, implantação brings in money that was
// already saved and rendimento is yield paid by the bank, so none of them change it.
export const movesSpendable=(row:Pick<Reserva,'gasto'|'emprestimoId'|'implantacao'|'rendimento'>)=>!row.gasto&&!row.emprestimoId&&!row.implantacao&&!row.rendimento;

// Total spent from the reserve up to `through` (and from `from`, when given), positive cents.
export function reserveSpent(rows:readonly Pick<Reserva,'gasto'|'data'|'valorCentavos'>[]=[],through:string,from?:string){
 let total=0;
 for(const row of rows)if(row.gasto&&row.data<=through&&(!from||row.data>=from))total-=row.valorCentavos;
 return total;
}

export function validateReserveRow(row:Reserva){
 validateBoxRow(row);
 if(row.gasto===undefined)return;
 if(row.gasto!==true||!positiveCents(-row.valorCentavos))throw Error('Gasto da reserva com valor inválido.');
 if(row.categoria!==undefined&&(typeof row.categoria!=='string'||row.categoria.length>60))throw Error('Categoria do gasto da reserva inválida.');
}

type Store=Pick<Database,'transaction'|'contas'|'reservas'|'fechamentos'>;
export interface NewReserveSpending{descricao:string;valorCentavos:number;data:string;categoria?:string;caixinhaId?:string}
export async function spendFromReserve(db:Store,accountId:string,input:NewReserveSpending){
 const descricao=input.descricao.replace(/\s+/g,' ').trim(),categoria=input.categoria?.trim();
 if(!descricao||descricao.length>MAX_SPEND_DESCRIPTION)throw Error('Informe com o que gastou (até 80 caracteres).');
 if(!positiveCents(input.valorCentavos))throw Error('Informe um valor maior que zero.');
 if(!validDate(input.data))throw Error('Informe uma data válida.');
 return db.transaction([db.contas,db.reservas,db.fechamentos],async tx=>{
  const account=await tx.contas.get(accountId),box=input.caixinhaId??MAIN_RESERVE;
  if(!account)throw Error('Conta não encontrada.');
  if(box&&!account.caixinhas?.some(c=>c.id===box))throw Error('Caixinha não encontrada. Reabra a reserva.');
  await ensureOpenMonth(tx,accountId,input.data);
  const rows=rowsOfBox(await tx.reservas.where('contaId').equals(accountId).toArray(),box);
  if(!reserveStaysNonNegative([...rows,{data:input.data,valorCentavos:-input.valorCentavos}]))throw Error('Saldo insuficiente nesta reserva para este gasto nesta data.');
  const row:Reserva={contaId:accountId,descricao,valorCentavos:-input.valorCentavos,data:input.data,gasto:true,...(categoria?{categoria}:{}),...(box?{caixinhaId:box}:{})};
  const id=await tx.reservas.add(row);
  return {...row,id:Number(id)};
 });
}
