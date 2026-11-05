import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceMonth,dueDate,matchesEntry,projectRecurrences,accountType} from './finance.ts';
import {contributionTarget,contributionPaid,marketSettlement,marketPaid,personMarketBalance,validateFinancialReferences,validateManagement} from './management.ts';
import type {Cartao,CompraMercado,Lancamento,PessoaGestora,Recorrencia} from './db.ts';
const card:Cartao={id:'C',nome:'Gestão',fechamento:25,vencimento:5};
const entry=(patch:Partial<Lancamento>={}):Lancamento=>({id:1,contaId:'A',descricao:'Compra',valorCentavos:1234,tipo:'despesa',natureza:'variavel',categoria:'Outros',data:'2026-11-05',status:'previsto',...patch});
const purchase=(payer?:string):CompraMercado=>({id:'M',descricao:'Mercado',data:'2026-11-05',cartaoId:'C',pagadorPessoaId:payer,totalCentavos:10000,itens:[{id:'i1',pessoaId:'Ana',descricao:'Café pessoal',valorCentavos:2000},{id:'i2',pessoaId:'Bia',descricao:'Chocolate pessoal',valorCentavos:1000}]});
test('closing, due dates, leap months and year transitions use invoice due month',()=>{
 assert.equal(invoiceMonth('',card),'');assert.equal(invoiceMonth('2026-11-25',undefined),'');assert.equal(invoiceMonth('2026-11-25',card),'2026-12');assert.equal(invoiceMonth('2026-11-26',card),'2027-01');assert.equal(invoiceMonth('2026-12-26',card),'2027-02');assert.equal(invoiceMonth('2026-11-10',{...card,fechamento:10,vencimento:20}),'2026-11');assert.equal(invoiceMonth('2026-11-11',{...card,fechamento:10,vencimento:20}),'2026-12');assert.equal(dueDate('2028-02',31),'2028-02-29');assert.equal(dueDate('2027-02',31),'2027-02-28');
});
test('notes are searchable, with accents ignored, and planned filters combine with cards',()=>{
 const value=entry({observacao:'Refeição da família',cartaoId:'C'});assert.equal(matchesEntry(value,'REFEICAO','previsto','C'),true);assert.equal(matchesEntry(value,'família','confirmado','C'),false);assert.equal(matchesEntry(value,'12,34','todos','other'),false);assert.equal(matchesEntry(value,'12.34','todos'),true);assert.equal(matchesEntry(entry({valorCentavos:123456}),'R$ 1.234,56','todos'),true);
});
test('recurring income projects once and existing confirmed or planned entries suppress duplicates',()=>{
 const r:Recorrencia={id:8,contaId:'A',descricao:'Aluguel recebido',valorCentavos:50000,categoria:'Outras receitas',natureza:'fixo',tipo:'receita',inicio:'2026-11-30',dia:30,ativa:true};
 assert.equal(projectRecurrences('2027-02','A',[r],[])[0].tipo,'receita');assert.equal(projectRecurrences('2027-02','A',[r],[])[0].data,'2027-02-28');for(const status of ['previsto','confirmado'] as const)assert.equal(projectRecurrences('2027-02','A',[r],[entry({recorrenciaId:8,data:'2027-02-28',status})]).length,0);assert.equal(projectRecurrences('2026-10','A',[r],[]).length,0);assert.equal(projectRecurrences('2026-11','B',[r],[]).length,0);
});
test('management card receives each personal total; personal card pays total minus payer own items',()=>{
 assert.deepEqual(marketSettlement(purchase()),{pessoais:{Ana:2000,Bia:1000},comumCentavos:7000,receber:{Ana:2000,Bia:1000},pagarCentavos:0});assert.deepEqual(marketSettlement(purchase('Ana')),{pessoais:{Ana:2000,Bia:1000},comumCentavos:7000,receber:{Bia:1000},pagarCentavos:8000});const p=purchase('Ana');p.itens=[];assert.equal(marketSettlement(p).pagarCentavos,10000);
});
test('market cents are exact, personal totals cannot exceed receipt and duplicate items are rejected',()=>{
 const p=purchase();p.totalCentavos=3001;assert.equal(marketSettlement(p).comumCentavos,1);p.totalCentavos=2999;assert.throws(()=>marketSettlement(p),/ultrapassam/);p.totalCentavos=10000;p.itens[0].valorCentavos=1.5;assert.throws(()=>marketSettlement(p),/valor/);p.itens=[{id:'x',pessoaId:'Ana',descricao:'x',valorCentavos:1},{id:'x',pessoaId:'Ana',descricao:'y',valorCentavos:1}];assert.throws(()=>marketSettlement(p),/repetido/);
});
test('monthly contribution histories preserve prior months and partial payments remain distinct from reimbursements',()=>{
 const p:PessoaGestora={id:'Ana',nome:'Ana',inicioMes:'2026-11',contribuicoes:[{desde:'2026-11',valorCentavos:50000},{desde:'2027-01',valorCentavos:60000}]};assert.equal(contributionTarget(p,'2026-10'),0);assert.equal(contributionTarget(p,'2026-12'),50000);assert.equal(contributionTarget(p,'2027-01'),60000);assert.equal(contributionTarget({...p,fimMes:'2026-12'},'2027-01'),0);
 const contributions=[entry({tipo:'receita',status:'confirmado',valorCentavos:20000,gestao:{tipo:'contribuicao',pessoaId:'Ana',mesReferencia:'2026-11'}}),entry({tipo:'receita',status:'confirmado',valorCentavos:5000,gestao:{tipo:'contribuicao',pessoaId:'Ana',mesReferencia:'2026-11'}}),entry({tipo:'receita',status:'confirmado',valorCentavos:1000,gestao:{tipo:'reembolsoMercado',pessoaId:'Ana',compraId:'M'}})];assert.equal(contributionPaid(contributions,'Ana','2026-11'),25000);assert.equal(marketPaid(contributions,'M','Ana','receber'),1000);assert.equal(marketPaid(contributions,'M','Ana','pagar'),0);
});
test('legacy solo/couple accounts remain compatible and management validates references',()=>{
 assert.equal(accountType({id:'A',nome:'A',conjunta:false,padrao:true}),'solo');assert.equal(accountType({id:'A',nome:'A',conjunta:true,padrao:true}),'casal');assert.throws(()=>validateManagement({id:'A',nome:'A',conjunta:false,padrao:true,mercados:[purchase()]}),/inexistente/);
});

test('person market summary aggregates items while keeping both payment directions separate',()=>{
 const management=purchase(),personal={...purchase('Ana'),id:'M2'};const ana=personMarketBalance([management,personal],[],'Ana');assert.deepEqual(ana,{pessoais:4000,receber:2000,recebido:0,pagar:8000,pago:0});assert.equal(personMarketBalance([management,personal],[],'Bia').receber,2000);
});

test('synchronized snapshots reject double market expenses, excessive reimbursements and cross-account cards',()=>{
 const account={id:'A',nome:'Casa',tipo:'gestora' as const,conjunta:false,padrao:true,pessoas:['Ana','Bia'].map(id=>({id,nome:id,inicioMes:'2026-11',contribuicoes:[{desde:'2026-11',valorCentavos:50000}]})),cartoes:[card],mercados:[purchase()]};const original=entry({valorCentavos:10000,cartaoId:'C',gestao:{tipo:'compraMercado',compraId:'M'}});validateFinancialReferences([account],[original],[]);assert.throws(()=>validateFinancialReferences([account],[original,{...original,id:2}],[]),/duplicado/);assert.throws(()=>validateFinancialReferences([account],[original,entry({id:2,tipo:'receita',status:'confirmado',valorCentavos:2500,gestao:{tipo:'reembolsoMercado',pessoaId:'Ana',compraId:'M'}})],[]),/ultrapassam/);assert.throws(()=>validateFinancialReferences([account],[{...original,cartaoId:'foreign'}],[]),/outra conta/);
});


test('couple split preserves every cent and fixed 50/25/25 shares',async()=>{
 const {splitCoupleBudget}=await import('./couple-budget.ts');assert.deepEqual(splitCoupleBudget(200000),{comum:100000,pessoais:[50000,50000]});for(let total=0;total<1000;total++){const d=splitCoupleBudget(total);assert.equal(d.comum+d.pessoais[0]+d.pessoais[1],total);assert.ok(Math.abs(d.pessoais[0]-d.pessoais[1])<=1);}assert.throws(()=>splitCoupleBudget(1.5));
});
test('personal entitlement carries across years, records partial transfers and keeps historical balances',async()=>{
 const {personalBalances,validateCoupleBudget}=await import('./couple-budget.ts');const account={id:'C',nome:'Casal',tipo:'casal' as const,conjunta:true,padrao:true,distribuicoesCasal:[{mes:'2025-12',totalCentavos:200000,comumCentavos:100000,pessoais:[50000,50000] as [number,number],confirmadaEm:'2025-12-05'},{mes:'2026-01',totalCentavos:200000,comumCentavos:100000,pessoais:[50000,50000] as [number,number],confirmadaEm:'2026-01-05'}],transferenciasPessoais:[{id:'T',titular:1 as const,data:'2026-01-06',valorCentavos:20000}]};validateCoupleBudget(account);assert.deepEqual(personalBalances(account)[0],{creditado:100000,transferido:20000,pendente:80000});assert.equal(personalBalances(account,'2025-12-31')[0].pendente,50000);assert.equal(personalBalances(account)[1].pendente,100000);
});
test('couple ledger rejects duplicate months, wrong proportions and duplicate transfers',async()=>{
 const {validateCoupleBudget}=await import('./couple-budget.ts');const d={mes:'2026-11',totalCentavos:200000,comumCentavos:100000,pessoais:[50000,50000] as [number,number],confirmadaEm:'2026-11-05'},a={id:'C',nome:'C',tipo:'casal' as const,conjunta:true,padrao:true};assert.throws(()=>validateCoupleBudget({...a,distribuicoesCasal:[d,d]}),/repetida/);assert.throws(()=>validateCoupleBudget({...a,distribuicoesCasal:[{...d,comumCentavos:99999}]}),/50%/);const t={id:'T',titular:1 as const,data:'2026-11-05',valorCentavos:100};assert.throws(()=>validateCoupleBudget({...a,distribuicoesCasal:[d],transferenciasPessoais:[t,t]}),/inválida/);
});
test('historical transfers cannot spend future releases even when lifetime balance is positive',async()=>{
 const {validateCoupleBudget}=await import('./couple-budget.ts');const a={id:'C',nome:'C',tipo:'casal' as const,conjunta:true,padrao:true,distribuicoesCasal:[{mes:'2026-11',totalCentavos:200000,comumCentavos:100000,pessoais:[50000,50000] as [number,number],confirmadaEm:'2026-11-05'}]};assert.throws(()=>validateCoupleBudget({...a,transferenciasPessoais:[{id:'T',titular:1,data:'2026-10-31',valorCentavos:100}]}),/nessa data/);assert.throws(()=>validateCoupleBudget({...a,transferenciasPessoais:[{id:'T',titular:1,data:'2026-11-05',valorCentavos:50001}]}),/ultrapassa/);
});
