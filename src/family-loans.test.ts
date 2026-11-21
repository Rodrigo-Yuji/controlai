import assert from 'node:assert/strict';
import {loanOutstanding,validateFamilyLoans} from './family-loans.ts';

const loan={id:'loan-1',pessoa:'Ana',data:'2026-11-20',valorCentavos:15000,devolucoes:[{id:'pay-1',data:'2026-11-21',valorCentavos:5000}]};
assert.equal(loanOutstanding(loan),10000);
assert.doesNotThrow(()=>validateFamilyLoans({id:'casal',nome:'Casa',tipo:'casal',conjunta:true,padrao:true,emprestimosFamiliares:[loan]}));
assert.throws(()=>validateFamilyLoans({id:'solo',nome:'Eu',tipo:'solo',conjunta:false,padrao:true,emprestimosFamiliares:[loan]}),/Casal/);
assert.throws(()=>validateFamilyLoans({id:'casal',nome:'Casa',tipo:'casal',conjunta:true,padrao:true,emprestimosFamiliares:[{...loan,devolucoes:[...loan.devolucoes,{id:'pay-2',data:'2026-11-22',valorCentavos:10001}]}]}),/ultrapassam/);
