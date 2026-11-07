import type {Lancamento} from './db.ts';
import type {Database} from './storage/types.ts';

export function managementEntryMonth(entry:Lancamento):string {
 const reference=entry.gestao?.tipo==='contribuicao'?entry.gestao.mesReferencia:undefined;
 return reference&&/^\d{4}-(0[1-9]|1[0-2])$/.test(reference)?reference:entry.data.slice(0,7);
}

// Label-only migration: never changes amounts, receipt dates, status or targets.
export async function normalizeGestoraCategories(db:Database,accountId:string){
 await db.transaction([db.contas,db.categorias,db.lancamentos,db.recorrencias],async tx=>{
  const account=await tx.contas.get(accountId);if(account?.tipo!=='gestora')return;
  const entries=await tx.lancamentos.where('contaId').equals(accountId).toArray();
  const recurrences=await tx.recorrencias.where('contaId').equals(accountId).toArray();
  const categories=await tx.categorias.where('contaId').equals(accountId).toArray();
  const old=categories.find(c=>c.tipo==='receita'&&c.nome==='Contribuições');
  const needsContribution=Boolean(old)||entries.some(e=>e.gestao?.tipo==='contribuicao'&&e.categoria!=='Contribuição')||recurrences.some(r=>r.tipo==='receita'&&r.categoria==='Contribuições');
  const legacyMarket=(e:Lancamento)=>['compraMercado','repasseMercado'].includes(e.gestao?.tipo??'')&&!account.mercados?.some(p=>p.id===e.gestao?.compraId&&p.categoria);
  const needsMarket=entries.some(e=>legacyMarket(e)&&e.categoria!=='Mercado');
  if(needsContribution){
   if(!categories.some(c=>c.tipo==='receita'&&c.nome==='Contribuição'))await tx.categorias.add({contaId:accountId,nome:'Contribuição',tipo:'receita',natureza:old?.natureza??'fixo'});
   await tx.lancamentos.filter(e=>e.contaId===accountId&&e.tipo==='receita'&&(e.categoria==='Contribuições'||e.gestao?.tipo==='contribuicao')).modify({categoria:'Contribuição'});
   await tx.recorrencias.filter(r=>r.contaId===accountId&&r.tipo==='receita'&&r.categoria==='Contribuições').modify({categoria:'Contribuição'});
   if(old?.id)await tx.categorias.delete(old.id);
  }
  if(needsMarket){
   if(!categories.some(c=>c.tipo==='despesa'&&c.nome==='Mercado'))await tx.categorias.add({contaId:accountId,nome:'Mercado',tipo:'despesa',natureza:'variavel'});
   await tx.lancamentos.filter(e=>e.contaId===accountId&&legacyMarket(e)).modify({categoria:'Mercado'});
  }
 });
}
