-- Version 1.30. Run after the previous request/sharing setup.
-- Removes audit copies only; retains accounts, financial entries and receipts.
begin;
create or replace function public.controlai_push(expected_revision bigint, next_snapshot jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare who uuid := auth.uid(); new_revision bigint;
begin
  if who is null then raise exception 'Login obrigatório'; end if;
  if jsonb_typeof(next_snapshot->'contas')='array' then next_snapshot:=jsonb_set(next_snapshot,'{contas}',coalesce((select jsonb_agg(a-'atividades') from jsonb_array_elements(next_snapshot->'contas') a),'[]'::jsonb));end if;
  if expected_revision < 0 or next_snapshot is null or jsonb_typeof(next_snapshot) <> 'object' or octet_length(next_snapshot::text) > 8388608 then
    raise exception 'Cópia inválida';
  end if;
  if expected_revision = 0 then
    insert into public.controlai_vaults(owner, revision, snapshot) values (who,1,next_snapshot)
    on conflict (owner) do nothing returning revision into new_revision;
  else
    update public.controlai_vaults set snapshot=next_snapshot, revision=revision+1, updated_at=now()
    where owner=who and revision=expected_revision returning revision into new_revision;
  end if;
  if new_revision is null then raise exception 'SYNC_CONFLICT' using errcode = '40001'; end if;
  return new_revision;
end $$;

create or replace function public.controlai_resolve_request(p_id uuid,p_status text,p_category text,p_revision bigint,p_reason text default '')
returns bigint language plpgsql security definer set search_path='' as $$
declare r public.controlai_requests; v public.controlai_vaults; c jsonb; cat jsonb; entry jsonb; next_id bigint; rows jsonb; next_snapshot jsonb;
begin
 select * into r from public.controlai_requests where id=p_id for update;
 if not found or r.owner<>auth.uid() then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if r.status<>'pendente' then raise exception 'Solicitação já resolvida'; end if;
 if p_status not in ('aprovado','recusado') or p_status is null then raise exception 'Status inválido'; end if;
 if p_status='recusado' then update public.controlai_requests set status=p_status,resolved_at=now(),reason=left(p_reason,500) where id=p_id;return null;end if;
 -- Revocation also blocks approval of pending requests from that participant.
 if not exists(select 1 from public.controlai_account_viewers where owner=r.owner and account_id=r.account_id and email=r.requester_email) then raise exception 'Acesso do participante foi revogado'; end if;
 select * into v from public.controlai_vaults where owner=auth.uid() for update;
 if v.revision<>p_revision or p_revision is null then raise exception 'SYNC_CONFLICT' using errcode='40001'; end if;
 select a into c from jsonb_array_elements(v.snapshot->'contas') a where a->>'id'=r.account_id;
 if c is null or coalesce(c->>'tipo',case when c->>'conjunta'='true' then 'casal' else 'solo' end) not in ('casal','gestora') then raise exception 'Conta não encontrada'; end if;
 if exists(select 1 from jsonb_array_elements(v.snapshot->'fechamentos') f where f->>'contaId'=r.account_id and f->>'mes'=left(r.payload->>'data',7)) then raise exception 'Mês fechado'; end if;
 select a into cat from jsonb_array_elements(v.snapshot->'categorias') a where a->>'contaId'=r.account_id and a->>'tipo'=r.payload->>'tipo' and a->>'nome'=p_category;
 if cat is null then raise exception 'Categoria inválida'; end if;
 rows:=coalesce(v.snapshot->'lancamentos','[]'::jsonb);
 if exists(select 1 from jsonb_array_elements(rows) a where a->>'solicitacaoId'=r.id::text) then raise exception 'Solicitação já registrada'; end if;
 select coalesce(max((a->>'id')::bigint),0)+1 into next_id from jsonb_array_elements(rows) a;
 if next_id>9007199254740991 then raise exception 'Limite de identificadores atingido'; end if;
 entry:=r.payload||jsonb_build_object('id',next_id,'contaId',r.account_id,'categoria',p_category,'natureza',cat->>'natureza','solicitacaoId',r.id::text);
 next_snapshot:=jsonb_set(v.snapshot,'{lancamentos}',rows||jsonb_build_array(entry));

 if octet_length(next_snapshot::text)>8388608 then raise exception 'Cofre sem espaço'; end if;
 update public.controlai_vaults set snapshot=next_snapshot,revision=revision+1,updated_at=now() where owner=auth.uid();
 update public.controlai_requests set status=p_status,resolved_at=now() where id=p_id;
 return v.revision+1;
end $$;

drop policy if exists controlai_receipts_insert on storage.objects;
drop function if exists public.controlai_attach_receipt(uuid,text);
update public.controlai_vaults v set snapshot=jsonb_set(v.snapshot,'{contas}',(select jsonb_agg(a-'atividades') from jsonb_array_elements(v.snapshot->'contas') a)),revision=v.revision+1,updated_at=now() where exists(select 1 from jsonb_array_elements(v.snapshot->'contas') a where a?'atividades');
create or replace function public.controlai_my_receipts()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(r.requester::text||'/'||r.id::text||'/comprovante'),'[]'::jsonb) from public.controlai_requests r where (r.owner=auth.uid() or r.requester=auth.uid()) and exists(select 1 from storage.objects o where o.bucket_id='controlai-comprovantes' and o.name=r.requester::text||'/'||r.id::text||'/comprovante');
$$;

commit;
