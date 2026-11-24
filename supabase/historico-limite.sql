-- Histórico mais leve. Execute depois de supabase/historico-compacto.sql.
-- 1) Criações guardam só um resumo (descrição, valor, data...), não o registro inteiro.
-- 2) Mais de 20 lançamentos criados de uma vez (importação) viram um único registro.
-- 3) Limite por usuário: 500 registros e 60 dias. Exclusões ainda na lixeira (30 dias)
--    ficam fora do corte, para continuar restauráveis.
-- Não altera lançamentos nem a cópia sincronizada; só o histórico de alterações.
begin;

create or replace function public.controlai_prune_history(p_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.controlai_history h where h.owner=p_owner and h.created_at<=now()-interval '60 days'
  and not (h.recovery is not null and h.restored_at is null and h.trash_until>now());
 delete from public.controlai_history where owner=p_owner and id in (
  select h.id from public.controlai_history h where h.owner=p_owner
   and not (h.recovery is not null and h.restored_at is null and h.trash_until>now())
  order by h.id desc offset 500);
 update public.controlai_history set recovery=null where owner=p_owner and recovery is not null and (trash_until<=now() or restored_at is not null);
 update public.controlai_history set recovery=null where owner=p_owner and id in (select id from public.controlai_history where owner=p_owner and recovery is not null order by id desc offset 300);
end $$;
revoke all on function public.controlai_prune_history(uuid) from public,anon,authenticated;

create or replace function public.controlai_capture_history()
returns trigger language plpgsql security definer set search_path='' as $$
declare tab text; r record; key text; delta jsonb; before_value jsonb; after_value jsonb; saved jsonb; who uuid:=auth.uid(); email text; account text; act text; batch jsonb:='{}'::jsonb; b record;
begin
 select u.email into email from auth.users u where u.id=who;
 -- Lançamentos criados em lote (importação): um registro por conta em vez de um por linha.
 select coalesce(jsonb_object_agg(q.acc,q.n),'{}'::jsonb) into batch from (
  select n.value->>'contaId' acc,count(*) n
  from jsonb_array_elements(coalesce(new.snapshot->'lancamentos','[]'::jsonb)) n(value)
  where n.value->>'contaId' is not null and not exists(select 1 from jsonb_array_elements(coalesce(old.snapshot->'lancamentos','[]'::jsonb)) o(value) where o.value->>'id'=n.value->>'id')
  group by 1 having count(*)>20) q;
 for b in select * from jsonb_each(batch) loop
  insert into public.controlai_history(owner,account_id,entity,entity_id,action,label,actor,actor_email,changes)
  values(new.owner,b.key,'lancamentos','lote:'||floor(extract(epoch from clock_timestamp())*1000)::bigint||':'||left(b.key,40),'criado',
   'Importação: '||b.value::text||' lançamentos',who,email,jsonb_build_object('quantidade',jsonb_build_object('antes',null,'depois',b.value)));
 end loop;
 foreach tab in array array['contas','lancamentos','reservas','recorrencias','categorias','salarios','configuracoes','fechamentos'] loop
  for r in
   select coalesce(a.value->>'id',c.value->>'id') entry_id,a.value before_row,c.value after_row
   from jsonb_array_elements(coalesce(old.snapshot->tab,'[]'::jsonb)) a(value)
   full join jsonb_array_elements(coalesce(new.snapshot->tab,'[]'::jsonb)) c(value) on a.value->>'id'=c.value->>'id'
   where a.value is distinct from c.value
  loop
   account:=case when tab='contas' then r.entry_id else coalesce(r.after_row->>'contaId',r.before_row->>'contaId') end;
   if account is null or r.entry_id is null then continue;end if;
   act:=case when r.before_row is null then 'criado' when r.after_row is null then 'excluido' else 'alterado' end;
   if tab='lancamentos' and r.before_row is null and r.entry_id=current_setting('controlai.history.restoring_id',true) then act:='restaurado';end if;
   if act='criado' and tab='lancamentos' and batch ? account then continue;end if;
   delta:='{}'::jsonb;
   for key in select jsonb_object_keys(coalesce(r.before_row,'{}'::jsonb)||coalesce(r.after_row,'{}'::jsonb)) loop
    if key in ('atividades','id') then continue;end if;
    -- Criação: só o resumo; o registro completo já está na cópia sincronizada.
    if act in ('criado','restaurado') and key not in ('descricao','nome','titular','valorCentavos','data','tipo','categoria','status','mes') then continue;end if;
    before_value:=r.before_row->key;after_value:=r.after_row->key;
    if before_value is not distinct from after_value then continue;end if;
    if octet_length(before_value::text)>512 then before_value:=jsonb_build_object('resumo','Conteúdo anterior','bytes',octet_length(before_value::text));end if;
    if octet_length(after_value::text)>512 then after_value:=jsonb_build_object('resumo','Conteúdo atualizado','bytes',octet_length(after_value::text));end if;
    delta:=delta||jsonb_build_object(key,jsonb_build_object('antes',before_value,'depois',after_value));
   end loop;
   if delta='{}'::jsonb then
    if act in ('criado','restaurado') then delta:=jsonb_build_object('registro',jsonb_build_object('antes',null,'depois',tab));else continue;end if;
   end if;
   if octet_length(delta::text)>8192 then delta:=jsonb_build_object('resumo','Alteração extensa: apenas nomes dos campos foram guardados','campos',(select jsonb_agg(k) from (select left(jsonb_object_keys(delta),80) k limit 30) q));end if;
   saved:=null;
   if tab='lancamentos' and r.after_row is null and octet_length(r.before_row::text)<=16384 then saved:=r.before_row;end if;
   insert into public.controlai_history(owner,account_id,entity,entity_id,action,label,actor,actor_email,changes,recovery,trash_until)
   values(new.owner,account,tab,r.entry_id,act,left(coalesce(r.after_row->>'descricao',r.before_row->>'descricao',r.after_row->>'nome',r.before_row->>'nome',r.after_row->>'titular',r.before_row->>'titular',tab),160),who,email,delta,saved,case when saved is not null then now()+interval '30 days' end);
  end loop;
 end loop;
 perform public.controlai_prune_history(new.owner);
 return new;
end $$;
revoke all on function public.controlai_capture_history() from public,anon,authenticated;

-- Limpeza do que já existe: importações antigas viram um registro, criações viram resumo.
with lotes as (
 select owner,account_id,created_at,count(*) n,min(actor::text) actor,min(actor_email) actor_email
 from public.controlai_history where entity='lancamentos' and action='criado'
 group by owner,account_id,created_at having count(*)>20),
apagados as (
 delete from public.controlai_history h using lotes l
 where h.owner=l.owner and h.account_id=l.account_id and h.created_at=l.created_at and h.entity='lancamentos' and h.action='criado'
 returning h.id)
insert into public.controlai_history(owner,account_id,entity,entity_id,action,label,actor,actor_email,created_at,changes)
select l.owner,l.account_id,'lancamentos','lote:'||floor(extract(epoch from l.created_at)*1000)::bigint||':'||left(l.account_id,40),'criado','Importação: '||l.n||' lançamentos',l.actor::uuid,l.actor_email,l.created_at,
 jsonb_build_object('quantidade',jsonb_build_object('antes',null,'depois',l.n))
from lotes l where (select count(*) from apagados)>=0;

update public.controlai_history h set changes=coalesce((select jsonb_object_agg(e.key,e.value) from jsonb_each(h.changes) e
 where e.key in ('descricao','nome','titular','valorCentavos','data','tipo','categoria','status','mes','quantidade')),jsonb_build_object('registro',jsonb_build_object('antes',null,'depois',h.entity)))
where h.action in ('criado','restaurado') and not h.changes ? 'quantidade';

select public.controlai_prune_history(o.owner) from (select distinct owner from public.controlai_history) o;
commit;
-- Para devolver o espaço ao disco depois de executar, rode separadamente:
-- vacuum full public.controlai_history;
