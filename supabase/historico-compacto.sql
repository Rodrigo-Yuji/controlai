-- Compact server history. Execute after existing ControlAI migrations.
-- Does not restore legacy atividades or rewrite any financial records.
begin;
create table if not exists public.controlai_history (
 id bigint generated always as identity primary key,
 owner uuid not null references auth.users(id) on delete cascade,
 account_id text not null,
 entity text not null,
 entity_id text not null,
 action text not null check(action in ('criado','alterado','excluido','restaurado')),
 label text not null,
 actor uuid,
 actor_email text,
 created_at timestamptz not null default now(),
 changes jsonb not null check(octet_length(changes::text)<=8192),
 recovery jsonb check(recovery is null or octet_length(recovery::text)<=16384),
 trash_until timestamptz,
 restored_at timestamptz
);
create index if not exists controlai_history_owner_page on public.controlai_history(owner,id desc);
create index if not exists controlai_history_owner_account on public.controlai_history(owner,account_id,id desc);
alter table public.controlai_history enable row level security;
revoke all on public.controlai_history from public,anon,authenticated;
grant select on public.controlai_history to authenticated;
drop policy if exists controlai_history_owner on public.controlai_history;
create policy controlai_history_owner on public.controlai_history for select to authenticated using(owner=(select auth.uid()));

create or replace function public.controlai_prune_history(p_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.controlai_history where owner=p_owner and created_at<=now()-interval '90 days';
 delete from public.controlai_history where owner=p_owner and id in (select id from public.controlai_history where owner=p_owner order by id desc offset 3000);
 update public.controlai_history set recovery=null where owner=p_owner and recovery is not null and (trash_until<=now() or restored_at is not null);
 update public.controlai_history set recovery=null where owner=p_owner and id in (select id from public.controlai_history where owner=p_owner and recovery is not null order by id desc offset 300);
end $$;
revoke all on function public.controlai_prune_history(uuid) from public,anon,authenticated;

create or replace function public.controlai_capture_history()
returns trigger language plpgsql security definer set search_path='' as $$
declare tab text; r record; key text; delta jsonb; before_value jsonb; after_value jsonb; saved jsonb; who uuid:=auth.uid(); email text; account text; act text;
begin
 select u.email into email from auth.users u where u.id=who;
 foreach tab in array array['contas','lancamentos','reservas','recorrencias','categorias','salarios','configuracoes','fechamentos'] loop
  for r in
   select coalesce(a.value->>'id',b.value->>'id') entry_id,a.value before_row,b.value after_row
   from jsonb_array_elements(coalesce(old.snapshot->tab,'[]'::jsonb)) a(value)
   full join jsonb_array_elements(coalesce(new.snapshot->tab,'[]'::jsonb)) b(value) on a.value->>'id'=b.value->>'id'
   where a.value is distinct from b.value
  loop
   account:=case when tab='contas' then r.entry_id else coalesce(r.after_row->>'contaId',r.before_row->>'contaId') end;
   if account is null or r.entry_id is null then continue;end if;
   delta:='{}'::jsonb;
   for key in select jsonb_object_keys(coalesce(r.before_row,'{}'::jsonb)||coalesce(r.after_row,'{}'::jsonb)) loop
    if key in ('atividades','id') then continue;end if;
    before_value:=r.before_row->key;after_value:=r.after_row->key;
    if before_value is not distinct from after_value then continue;end if;
    if octet_length(before_value::text)>512 then before_value:=jsonb_build_object('resumo','Conteúdo anterior','bytes',octet_length(before_value::text));end if;
    if octet_length(after_value::text)>512 then after_value:=jsonb_build_object('resumo','Conteúdo atualizado','bytes',octet_length(after_value::text));end if;
    delta:=delta||jsonb_build_object(key,jsonb_build_object('antes',before_value,'depois',after_value));
   end loop;
   if delta='{}'::jsonb then continue;end if;
   if octet_length(delta::text)>8192 then delta:=jsonb_build_object('resumo','Alteração extensa: apenas nomes dos campos foram guardados','campos',(select jsonb_agg(k) from (select left(jsonb_object_keys(delta),80) k limit 30) q));end if;
   saved:=null;
   if tab='lancamentos' and r.after_row is null and octet_length(r.before_row::text)<=16384 then saved:=r.before_row;end if;
   act:=case when r.before_row is null then 'criado' when r.after_row is null then 'excluido' else 'alterado' end;
   if tab='lancamentos' and r.before_row is null and r.entry_id=current_setting('controlai.history.restoring_id',true) then act:='restaurado';end if;
   insert into public.controlai_history(owner,account_id,entity,entity_id,action,label,actor,actor_email,changes,recovery,trash_until)
   values(new.owner,account,tab,r.entry_id,act,left(coalesce(r.after_row->>'descricao',r.before_row->>'descricao',r.after_row->>'nome',r.before_row->>'nome',r.after_row->>'titular',r.before_row->>'titular',tab),160),who,email,delta,saved,case when saved is not null then now()+interval '30 days' end);
  end loop;
 end loop;
 perform public.controlai_prune_history(new.owner);
 return new;
end $$;
revoke all on function public.controlai_capture_history() from public,anon,authenticated;
drop trigger if exists controlai_compact_history on public.controlai_vaults;
create trigger controlai_compact_history after update of snapshot on public.controlai_vaults for each row execute function public.controlai_capture_history();

create or replace function public.controlai_history_page(p_account text default null,p_deleted boolean default false,p_before bigint default null,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); rows jsonb; total bigint; more boolean;
begin
 if who is null then raise exception 'Login obrigatório' using errcode='42501';end if;
 if p_limit is null or p_limit<1 or p_limit>50 or (p_before is not null and p_before<1) then raise exception 'Paginação inválida';end if;
 perform public.controlai_prune_history(who);
 select count(*) into total from public.controlai_history h where h.owner=who and (p_account is null or h.account_id=p_account) and (not p_deleted or (h.action='excluido' and h.recovery is not null and h.restored_at is null));
 select coalesce(jsonb_agg(v order by (v->>'id')::bigint desc),'[]'::jsonb) into rows from (
  select jsonb_build_object('id',h.id,'account_id',h.account_id,'entity',h.entity,'entity_id',h.entity_id,'action',h.action,'label',h.label,'actor_email',coalesce(h.actor_email,'Sistema'),'created_at',h.created_at,'changes',h.changes,'recoverable',h.recovery is not null and h.trash_until>now() and h.restored_at is null,'trash_until',h.trash_until,'restored_at',h.restored_at) v
  from public.controlai_history h where h.owner=who and (p_account is null or h.account_id=p_account) and (not p_deleted or (h.action='excluido' and h.recovery is not null and h.restored_at is null)) and (p_before is null or h.id<p_before) order by h.id desc limit p_limit
 ) q;
 select exists(select 1 from public.controlai_history h where h.owner=who and (p_account is null or h.account_id=p_account) and (not p_deleted or (h.action='excluido' and h.recovery is not null and h.restored_at is null)) and h.id<(select min((x->>'id')::bigint) from jsonb_array_elements(rows) x)) into more;
 return jsonb_build_object('rows',rows,'total',total,'has_more',more,'stored_bytes',(select coalesce(sum(octet_length(h.changes::text)+coalesce(octet_length(h.recovery::text),0)),0) from public.controlai_history h where h.owner=who));
end $$;
revoke all on function public.controlai_history_page(text,boolean,bigint,integer) from public,anon;
grant execute on function public.controlai_history_page(text,boolean,bigint,integer) to authenticated;

create or replace function public.controlai_restore_history(p_id bigint,p_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare h public.controlai_history; v public.controlai_vaults; c jsonb; e jsonb; row jsonb; next_id bigint; next_snapshot jsonb; reference text;
begin
 if auth.uid() is null then raise exception 'Login obrigatório' using errcode='42501';end if;
 -- Lock vault before history: the same order as updates that capture history.
 select * into v from public.controlai_vaults where owner=auth.uid() for update;
 if not found or p_revision is null or v.revision<>p_revision then raise exception 'SYNC_CONFLICT' using errcode='40001';end if;
 select * into h from public.controlai_history where id=p_id and owner=auth.uid() for update;
 if not found then raise exception 'HISTORY_NOT_FOUND';end if;
 if h.restored_at is not null then raise exception 'HISTORY_ALREADY_RESTORED';end if;
 if h.recovery is null or h.trash_until<=now() or h.created_at<=now()-interval '30 days' then raise exception 'HISTORY_EXPIRED';end if;
 if h.action<>'excluido' or h.entity<>'lancamentos' then raise exception 'HISTORY_UNSUPPORTED';end if;
 row:=h.recovery;
 if row->>'contaId' is distinct from h.account_id or coalesce(row->>'data','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(row->>'tipo','') not in ('receita','despesa') or coalesce(row->>'status','') not in ('previsto','confirmado') or coalesce(row->>'valorCentavos','') !~ '^[1-9][0-9]{0,11}$' then raise exception 'HISTORY_UNSUPPORTED';end if;
 if (row->'parcial' is not null and row->'parcial'<>'null'::jsonb) or (row->'gestao' is not null and row->'gestao'<>'null'::jsonb) or row->>'solicitacaoId' is not null or jsonb_array_length(coalesce(nullif(row->'extratoIds','null'::jsonb),'[]'::jsonb))>0 then raise exception 'HISTORY_LINKED';end if;
 select a into c from jsonb_array_elements(v.snapshot->'contas') a where a->>'id'=h.account_id;
 if c is null then raise exception 'HISTORY_ACCOUNT_MISSING';end if;
 reference:=coalesce(row->>'competencia',left(coalesce(row->>'dataPrevista',row->>'data'),7));
 if exists(select 1 from jsonb_array_elements(coalesce(v.snapshot->'fechamentos','[]'::jsonb)) f where f->>'contaId'=h.account_id and (f->>'mes'=left(row->>'data',7) or f->>'mes'=reference or f->>'mes'=left(row->>'dataPrevista',7) or f->>'mes'=row->>'faturaMes')) then raise exception 'HISTORY_CLOSED';end if;
 if not exists(select 1 from jsonb_array_elements(coalesce(v.snapshot->'categorias','[]'::jsonb)) a where a->>'contaId'=h.account_id and a->>'nome'=row->>'categoria' and a->>'tipo'=row->>'tipo') then raise exception 'HISTORY_CATEGORY_MISSING';end if;
 if row->>'cartaoId' is not null and not exists(select 1 from jsonb_array_elements(coalesce(c->'cartoes','[]'::jsonb)) a where a->>'id'=row->>'cartaoId') then raise exception 'HISTORY_CARD_MISSING';end if;
 for e in select a from jsonb_array_elements(coalesce(v.snapshot->'lancamentos','[]'::jsonb)) a where a->>'contaId'=h.account_id loop
  if (row->>'recorrenciaId' is not null and e->>'recorrenciaId'=row->>'recorrenciaId' and (left(coalesce(e->'parcial'->>'dataPrevista',e->>'dataPrevista',e->>'data'),7)=left(coalesce(row->>'dataPrevista',row->>'data'),7) or (row->>'cartaoId' is not null and e->>'cartaoId'=row->>'cartaoId' and row->>'faturaMes' is not null and e->>'faturaMes'=row->>'faturaMes')))
   or (row->'parcela'->>'grupo' is not null and e->'parcela'->>'grupo'=row->'parcela'->>'grupo' and e->'parcela'->>'numero'=row->'parcela'->>'numero')
   or (row->>'grupoRecorrencia' is not null and e->>'grupoRecorrencia'=row->>'grupoRecorrencia' and left(coalesce(e->>'dataPrevista',e->>'data'),7)=left(coalesce(row->>'dataPrevista',row->>'data'),7)) then raise exception 'HISTORY_DUPLICATE';end if;
 end loop;
 select coalesce(max((a->>'id')::bigint),0)+1 into next_id from jsonb_array_elements(coalesce(v.snapshot->'lancamentos','[]'::jsonb)) a;
 if next_id>9007199254740991 then raise exception 'Limite de identificadores atingido';end if;
 row:=row||jsonb_build_object('id',next_id);
 next_snapshot:=jsonb_set(v.snapshot,'{lancamentos}',coalesce(v.snapshot->'lancamentos','[]'::jsonb)||jsonb_build_array(row));
 if octet_length(next_snapshot::text)>8388608 then raise exception 'Cofre sem espaço';end if;
 perform set_config('controlai.history.restoring_id',next_id::text,true);
 update public.controlai_vaults set snapshot=next_snapshot,revision=revision+1,updated_at=now() where owner=auth.uid();
 perform set_config('controlai.history.restoring_id','',true);
 update public.controlai_history set restored_at=now(),recovery=null where id=h.id;
 return v.revision+1;
end $$;
revoke all on function public.controlai_restore_history(bigint,bigint) from public,anon;
grant execute on function public.controlai_restore_history(bigint,bigint) to authenticated;
commit;
