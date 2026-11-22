import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createSqliteDatabase,type SqlDriver} from './storage/sqlite.ts';
import {registeredBalance} from './account-balance.ts';
import {validateSnapshot} from './sync/snapshot.ts';
import {validateManagement} from './management.ts';
import {lendFromReserve,registerLoanRepayment,removeLoan,removeLoanRepayment,loansByPerson,loanOutstanding,netLent,reserveStaysNonNegative,totalOutstanding,validateReserveLoans} from './reserve-loans.ts';
import type {Conta,EmprestimoReserva,Lancamento} from './db.ts';
function device(){const raw=new DatabaseSync(':memory:');const driver:SqlDriver={all:async(sql,v=[])=>raw.prepare(sql).all(...v),run:async(sql,v=[])=>{const r=raw.prepare(sql).run(...v);return {changes:Number(r.changes),lastId:Number(r.lastInsertRowid)};},begin:async()=>{raw.exec('BEGIN IMMEDIATE');},commit:async()=>{raw.exec('COMMIT');},rollback:async()=>{raw.exec('ROLLBACK');}};return createSqliteDatabase(async()=>driver);}
const ids=()=>{let n=0;return ()=>`id${++n}`;};
async function seed(type:'casal'|'solo'='casal'){
 const db=device();await db.contas.add({id:'A',nome:'Casal',padrao:true,conjunta:type==='casal',tipo:type});
 await db.reservas.add({contaId:'A',descricao:'Guardado',valorCentavos:100000,data:'2026-10-01'});
 return db;
}
const reserveTotal=async(db:Awaited<ReturnType<typeof seed>>)=>(await db.reservas.toArray()).reduce((s,r)=>s+r.valorCentavos,0);
const income:Lancamento={contaId:'A',descricao:'Salário',valorCentavos:500000,tipo:'receita',natureza:'fixo',categoria:'Salário',data:'2026-10-05',status:'confirmado'};

test('a loan leaves the reserve without creating an expense entry',async()=>{
 const db=await seed(),next=ids();
 const loan=await lendFromReserve(db,'A',{pessoa:'  Tia   Ana ',valorCentavos:30000,data:'2026-11-03',observacao:' conserto '},next);
 assert.equal(loan.pessoa,'Tia Ana');assert.equal(loan.observacao,'conserto');
 assert.equal(await reserveTotal(db),70000);assert.equal(await db.lancamentos.count(),0);
 const account=(await db.contas.get('A'))!;assert.equal(account.emprestimosReserva?.length,1);
 const rows=await db.reservas.toArray();assert.equal(rows.at(-1)?.emprestimoId,'id1');assert.equal(rows.at(-1)?.valorCentavos,-30000);
});
test('spendable balance is unchanged by loans and repayments, total follows the money outside',async()=>{
 const db=await seed(),next=ids();const loan=await lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:30000,data:'2026-11-03'},next);
 const account=(await db.contas.get('A'))!;const reserves=await db.reservas.toArray();
 const before=registeredBalance([income],reserves.filter(r=>!r.emprestimoId),[],'2026-11');
 const lent=registeredBalance([income],reserves,[],'2026-11',undefined,account.emprestimosReserva);
 assert.equal(lent.current,before.current);assert.equal(lent.reserve,before.reserve-30000);assert.equal(lent.total,before.total-30000);
 await registerLoanRepayment(db,'A',loan.id,{valorCentavos:10000,data:'2026-11-20'},next);
 const account2=(await db.contas.get('A'))!,reserves2=await db.reservas.toArray();
 const part=registeredBalance([income],reserves2,[],'2026-11',undefined,account2.emprestimosReserva);
 assert.equal(part.current,before.current);assert.equal(part.reserve,before.reserve-20000);assert.equal(part.total,before.total-20000);
 const early=registeredBalance([income],reserves2,[],'2026-11-10',undefined,account2.emprestimosReserva);assert.equal(early.reserve,before.reserve-30000);
});
test('repayments go back to the reserve and settle the loan; anything above the debt is an extra',async()=>{
 const db=await seed(),next=ids();const loan=await lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:30000,data:'2026-11-03'},next);
 await assert.rejects(registerLoanRepayment(db,'A',loan.id,{valorCentavos:100,data:'2026-11-02'},next),/anterior/);
 await registerLoanRepayment(db,'A',loan.id,{valorCentavos:12000,data:'2026-11-10'},next);
 assert.equal(await reserveTotal(db),82000);
 const r=await registerLoanRepayment(db,'A',loan.id,{valorCentavos:20000,data:'2026-11-11'},next);
 assert.equal(r.valorCentavos,18000);assert.equal(r.acrescimoCentavos,2000);
 const account=(await db.contas.get('A'))!;assert.equal(loanOutstanding(account.emprestimosReserva![0]),0);assert.equal(await reserveTotal(db),102000);
 assert.match((await db.reservas.toArray()).at(-1)!.descricao,/acréscimo/);
 const extra=await registerLoanRepayment(db,'A',loan.id,{valorCentavos:500,data:'2026-11-12'},next);
 assert.equal(extra.valorCentavos,0);assert.equal(extra.acrescimoCentavos,500);assert.equal(await reserveTotal(db),102500);
 const summary=loansByPerson((await db.contas.get('A'))!.emprestimosReserva)[0];
 assert.equal(summary.devolvidoCentavos,30000);assert.equal(summary.pendenteCentavos,0);assert.equal(summary.acrescimoCentavos,2500);
 await removeLoanRepayment(db,'A',loan.id,r.id);assert.equal(await reserveTotal(db),82500);assert.equal(loanOutstanding((await db.contas.get('A'))!.emprestimosReserva![0]),18000);
});
test('an extra on the repayment raises reserve and total but not the spendable balance',async()=>{
 const db=await seed(),next=ids();const loan=await lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:30000,data:'2026-11-03'},next);
 const before=registeredBalance([income],[{contaId:'A',descricao:'Guardado',valorCentavos:100000,data:'2026-10-01'}],[],'2026-11');
 await registerLoanRepayment(db,'A',loan.id,{valorCentavos:35000,data:'2026-11-20'},next);
 const b=registeredBalance([income],await db.reservas.toArray(),[],'2026-11',undefined,(await db.contas.get('A'))!.emprestimosReserva);
 assert.equal(b.current,before.current);assert.equal(b.reserve,before.reserve+5000);assert.equal(b.total,before.total+5000);
 const old=await lendFromReserve(db,'A',{pessoa:'Cunhado',valorCentavos:50000,data:'2025-03-10',anterior:true},next);
 await registerLoanRepayment(db,'A',old.id,{valorCentavos:51000,data:'2026-11-21'},next);
 const c=registeredBalance([income],await db.reservas.toArray(),[],'2026-11',undefined,(await db.contas.get('A'))!.emprestimosReserva);
 assert.equal(c.current,before.current);assert.equal(c.reserve,before.reserve+5000+51000);assert.equal(c.total,before.total+5000+51000);
});
test('malformed extras are rejected in synchronized copies',()=>{
 const account:Conta={id:'A',nome:'Casal',padrao:true,conjunta:true,tipo:'casal'};
 const loan=(r:object):EmprestimoReserva=>({id:'l1',pessoa:'Ana',data:'2026-11-01',valorCentavos:1000,devolucoes:[{id:'r1',data:'2026-11-02',valorCentavos:1000,...r}]});
 assert.doesNotThrow(()=>validateReserveLoans({...account,emprestimosReserva:[loan({acrescimoCentavos:200})]}));
 assert.doesNotThrow(()=>validateReserveLoans({...account,emprestimosReserva:[loan({valorCentavos:0,acrescimoCentavos:200})]}));
 assert.throws(()=>validateReserveLoans({...account,emprestimosReserva:[loan({acrescimoCentavos:0})]}),/Acréscimo/);
 assert.throws(()=>validateReserveLoans({...account,emprestimosReserva:[loan({acrescimoCentavos:-5})]}),/Acréscimo/);
 assert.throws(()=>validateReserveLoans({...account,emprestimosReserva:[loan({valorCentavos:0})]}),/inválidos/);
 assert.throws(()=>validateReserveLoans({...account,emprestimosReserva:[loan({valorCentavos:1200})]}),/ultrapassa/);
});
test('a loan larger than the available reserve is rejected and nothing is saved',async()=>{
 const db=await seed();
 await assert.rejects(lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:100001,data:'2026-11-03'}),/insuficiente/);
 await assert.rejects(lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:5000,data:'2026-09-01'}),/insuficiente/);
 assert.equal((await db.contas.get('A'))!.emprestimosReserva,undefined);assert.equal(await db.reservas.count(),1);
 await assert.rejects(lendFromReserve(db,'A',{pessoa:'',valorCentavos:100,data:'2026-11-03'}),/quem recebeu/);
 await assert.rejects(lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:0,data:'2026-11-03'}),/maior que zero/);
 await assert.rejects(lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:1.5,data:'2026-11-03'}),/maior que zero/);
 await assert.rejects(lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:100,data:'2026-13-03'}),/data válida/);
});
test('closed months and non-couple accounts are protected',async()=>{
 const db=await seed(),next=ids();
 await db.fechamentos.put({id:'A:2026-11',contaId:'A',mes:'2026-11',fechadoEm:'2026-12-01'});
 await assert.rejects(lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:100,data:'2026-11-03'},next),/fechado/);
 const loan=await lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:5000,data:'2026-10-03'},next);
 await assert.rejects(registerLoanRepayment(db,'A',loan.id,{valorCentavos:100,data:'2026-11-05'},next),/fechado/);
 const solo=await seed('solo');await assert.rejects(lendFromReserve(solo,'A',{pessoa:'Ana',valorCentavos:100,data:'2026-11-03'}),/Casal/);
});
test('deleting a repayment or a loan restores the reserve; a loan with repayments cannot be deleted first',async()=>{
 const db=await seed(),next=ids();const loan=await lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:30000,data:'2026-11-03'},next);
 const repayment=await registerLoanRepayment(db,'A',loan.id,{valorCentavos:10000,data:'2026-11-10'},next);
 await assert.rejects(removeLoan(db,'A',loan.id),/devoluções/);
 await removeLoanRepayment(db,'A',loan.id,repayment.id);assert.equal(await reserveTotal(db),70000);assert.equal(loanOutstanding((await db.contas.get('A'))!.emprestimosReserva![0]),30000);
 await removeLoan(db,'A',loan.id);assert.equal(await reserveTotal(db),100000);assert.equal((await db.contas.get('A'))!.emprestimosReserva?.length,0);
 assert.equal(await db.reservas.count(),1);
});
test('removing a repayment cannot leave the reserve negative on a later date',async()=>{
 const db=await seed(),next=ids();
 const a=await lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:100000,data:'2026-11-01'},next);
 const repayment=await registerLoanRepayment(db,'A',a.id,{valorCentavos:40000,data:'2026-11-05'},next);
 await lendFromReserve(db,'A',{pessoa:'Bia',valorCentavos:40000,data:'2026-11-06'},next);
 await assert.rejects(removeLoanRepayment(db,'A',a.id,repayment.id),/negativa/);
 assert.equal(await reserveTotal(db),0);
});
test('totals group people ignoring case and accents, and respect the cutoff date',()=>{
 const loans:EmprestimoReserva[]=[
  {id:'1',pessoa:'José',valorCentavos:10000,data:'2026-11-01',devolucoes:[{id:'r1',data:'2026-11-20',valorCentavos:4000}]},
  {id:'2',pessoa:'jose ',valorCentavos:5000,data:'2026-12-01',devolucoes:[]},
  {id:'3',pessoa:'Ana',valorCentavos:20000,data:'2026-11-05',devolucoes:[]}];
 const all=loansByPerson(loans);assert.deepEqual(all.map(p=>[p.pessoa,p.pendenteCentavos]),[['Ana',20000],['José',11000]]);
 assert.equal(totalOutstanding(loans),31000);assert.equal(totalOutstanding(loans,'2026-11-10'),30000);assert.equal(totalOutstanding(loans,'2026-11-30'),26000);
 assert.equal(netLent(loans,'2026-11-30'),26000);assert.equal(netLent(loans,'2026-11-30','2026-11-10'),-4000);
 assert.equal(reserveStaysNonNegative([{data:'2026-11-01',valorCentavos:100},{data:'2026-11-02',valorCentavos:-100}]),true);
 assert.equal(reserveStaysNonNegative([{data:'2026-11-02',valorCentavos:-100},{data:'2026-11-01',valorCentavos:99}]),false);
 assert.equal(reserveStaysNonNegative([{data:'2026-11-02',valorCentavos:-100},{data:'2026-11-02',valorCentavos:100}]),true);
});
test('account validation, backups and sync snapshots carry loans and reject corrupt data',async()=>{
 const base:Conta={id:'A',nome:'Casal',padrao:true,conjunta:true,tipo:'casal',emprestimosReserva:[{id:'1',pessoa:'Ana',valorCentavos:100,data:'2026-11-01',devolucoes:[{id:'r',data:'2026-11-02',valorCentavos:100}]}]};
 validateReserveLoans(base);validateManagement(base);
 const bad=(patch:Partial<EmprestimoReserva>)=>({...base,emprestimosReserva:[{...base.emprestimosReserva![0],...patch}]});
 assert.throws(()=>validateReserveLoans(bad({valorCentavos:0})),/valor/);assert.throws(()=>validateReserveLoans(bad({pessoa:'  '})),/quem/);
 assert.throws(()=>validateReserveLoans(bad({devolucoes:[{id:'r',data:'2026-11-02',valorCentavos:101}]})),/ultrapassa/);
 assert.throws(()=>validateReserveLoans(bad({devolucoes:[{id:'1',data:'2026-11-02',valorCentavos:10}]})),/repetido/);
 assert.throws(()=>validateReserveLoans(bad({devolucoes:[{id:'r',data:'2026-10-31',valorCentavos:10}]})),/data/);
 assert.throws(()=>validateManagement({...base,conjunta:false,tipo:'solo'}),/Casal/);
 const db=await seed();await lendFromReserve(db,'A',{pessoa:'Ana',valorCentavos:100,data:'2026-11-03'});
 const snapshot=validateSnapshot(await db.snapshot());assert.equal(snapshot.contas[0].emprestimosReserva?.length,1);assert.equal(snapshot.reservas.some(r=>r.emprestimoId),true);
});
test('a loan made before the app is tracked without touching the reserve; repayments still fill it',async()=>{
 const db=await seed(),next=ids();
 await assert.rejects(lendFromReserve(db,'A',{pessoa:'Cunhado',valorCentavos:500000,data:'2025-03-10'},next),/insuficiente/);
 const loan=await lendFromReserve(db,'A',{pessoa:'Cunhado',valorCentavos:500000,data:'2025-03-10',anterior:true},next);
 assert.equal(loan.anterior,true);assert.equal(await reserveTotal(db),100000);assert.equal(await db.lancamentos.count(),0);
 const account=(await db.contas.get('A'))!,reserves=await db.reservas.toArray();
 const before=registeredBalance([income],reserves,[],'2026-11');
 const withLoan=registeredBalance([income],reserves,[],'2026-11',undefined,account.emprestimosReserva);
 assert.deepEqual(withLoan,before);assert.equal(totalOutstanding(account.emprestimosReserva),500000);
 await registerLoanRepayment(db,'A',loan.id,{valorCentavos:20000,data:'2026-11-05'},next);
 const account2=(await db.contas.get('A'))!,after=registeredBalance([income],await db.reservas.toArray(),[],'2026-11',undefined,account2.emprestimosReserva);
 assert.equal(after.reserve,before.reserve+20000);assert.equal(after.total,before.total+20000);assert.equal(after.current,before.current);
 assert.equal(totalOutstanding(account2.emprestimosReserva),480000);
 assert.throws(()=>validateReserveLoans({...account2,emprestimosReserva:[{...account2.emprestimosReserva![0],anterior:'sim' as unknown as true}]}),/anterior/);
});
