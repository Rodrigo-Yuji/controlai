-- Run after solicitacoes-reembolso.sql. Cancelling/undoing never creates payment.
alter table public.controlai_requests drop constraint if exists controlai_requests_status_check;
alter table public.controlai_requests add constraint controlai_requests_status_check check(status in ('pendente','aprovado','recusado','cancelado'));

create or replace function public.controlai_request_display(p_request public.controlai_requests,p_snapshot jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare c jsonb;p jsonb;total bigint;paid bigint;result text;
begin
 if p_request.status='pendente' then return jsonb_build_object('display_state','pendente');end if;
 if p_request.status='recusado' then return jsonb_build_object('display_state','recusada');end if;
 if p_request.status='cancelado' then return jsonb_build_object('display_state','cancelada');end if;
 if p_request.payload ? 'reembolsoPessoaId' then
  select a into c from jsonb_array_elements(coalesce(p_snapshot->'contas','[]'::jsonb)) a where a->>'id'=p_request.account_id;
  select a into p from jsonb_array_elements(coalesce(c->'mercados','[]'::jsonb)) a where a->>'solicitacaoId'=p_request.id::text and a->>'id'='solicitacao:'||p_request.id::text;
  if p is null then return jsonb_build_object('display_state','aprovada');end if;
  select (p->>'totalCentavos')::bigint-coalesce(sum((a->>'valorCentavos')::bigint),0) into total from jsonb_array_elements(coalesce(p->'itens','[]'::jsonb)) a where a->>'pessoaId'=p->>'pagadorPessoaId';
  select coalesce(sum((a->>'valorCentavos')::bigint),0) into paid from jsonb_array_elements(coalesce(p_snapshot->'lancamentos','[]'::jsonb)) a where a->>'contaId'=p_request.account_id and a->>'tipo'='despesa' and a->>'status'='confirmado' and a->'gestao'->>'tipo'='repasseMercado' and a->'gestao'->>'compraId'=p->>'id' and a->'gestao'->>'pessoaId'=p->>'pagadorPessoaId';
  return jsonb_build_object('display_state',case when paid>=total then 'concluida' else 'reembolso_pendente' end,'reimbursement_remaining',greatest(0,total-paid),'reimbursement_paid',paid);
 end if;
 select case when count(*)>0 and bool_and(a->>'status'='confirmado') then 'concluida' else 'aprovada' end into result from jsonb_array_elements(coalesce(p_snapshot->'lancamentos','[]'::jsonb)) a where a->>'solicitacaoId'=p_request.id::text and a->>'contaId'=p_request.account_id;
 return jsonb_build_object('display_state',result);
end $$;
revoke all on function public.controlai_request_display(public.controlai_requests,jsonb) from public,anon,authenticated;

create or replace function public.controlai_requests_overview(p_owner uuid,p_account text,p_limit integer default 5,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare snap jsonb;result jsonb;is_owner boolean:=coalesce(auth.uid()=p_owner,false);
begin
 if auth.uid() is null or not(is_owner or public.controlai_request_access(p_owner,p_account)) then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 if p_limit is null or p_limit<1 or p_limit>50 or p_offset is null or p_offset<0 then raise exception 'Paginação inválida';end if;
 select snapshot into snap from public.controlai_vaults where owner=p_owner;
 with scoped as(select r.*,public.controlai_request_display(r,snap) as view from public.controlai_requests r where r.owner=p_owner and r.account_id=p_account and (is_owner or r.requester=auth.uid())),classified as(select *,is_owner and (status='pendente' or(status='aprovado' and payload ? 'reembolsoPessoaId' and view->>'display_state'<>'concluida')) as active from scoped),history_page as(select * from classified where not active order by created_at desc,id desc limit p_limit offset p_offset)
 select jsonb_build_object('active',coalesce((select jsonb_agg((to_jsonb(a)-'view'-'active')||view order by created_at desc,id desc) from classified a where active),'[]'::jsonb),'history',coalesce((select jsonb_agg((to_jsonb(a)-'view'-'active')||view order by created_at desc,id desc) from history_page a),'[]'::jsonb),'history_count',(select count(*) from classified where not active),'pending_count',(select count(*) from classified where status='pendente')) into result;
 return result;
end $$;

create or replace function public.controlai_cancel_request(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.controlai_requests;
begin
 select * into r from public.controlai_requests where id=p_id for update;
 if not found or auth.uid() is null or r.requester<>auth.uid() then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 if r.status='cancelado' then return;end if;
 if r.status<>'pendente' then raise exception 'REQUEST_NOT_PENDING';end if;
 update public.controlai_requests set status='cancelado',resolved_at=now(),reason=null where id=p_id;
end $$;

create or replace function public.controlai_undo_request(p_id uuid,p_expected_status text,p_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare r public.controlai_requests;v public.controlai_vaults;c jsonb;p jsonb;e jsonb;next_snapshot jsonb;rows jsonb;count_entries integer;changed boolean:=false;purchase_id text;
begin
 select * into r from public.controlai_requests where id=p_id for update;
 if not found or auth.uid() is null or r.owner<>auth.uid() then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 if p_expected_status is null or p_expected_status not in ('aprovado','recusado') or r.status<>p_expected_status then raise exception 'REQUEST_CHANGED';end if;
 select * into v from public.controlai_vaults where owner=auth.uid() for update;
 if not found or p_revision is null or v.revision<>p_revision then raise exception 'SYNC_CONFLICT' using errcode='40001';end if;
 select a into c from jsonb_array_elements(coalesce(v.snapshot->'contas','[]'::jsonb)) a where a->>'id'=r.account_id;
 if c is null or c->>'tipo' is distinct from 'gestora' then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 next_snapshot:=v.snapshot;
 if r.status='aprovado' then
  purchase_id:='solicitacao:'||r.id::text;
  if r.payload ? 'reembolsoPessoaId' then
   if exists(select 1 from jsonb_array_elements(coalesce(v.snapshot->'lancamentos','[]'::jsonb)) a where a->'gestao'->>'compraId'=purchase_id or a->>'solicitacaoId'=r.id::text) then raise exception 'REQUEST_HAS_PAYMENTS';end if;
   select a into p from jsonb_array_elements(coalesce(c->'mercados','[]'::jsonb)) a where a->>'id'=purchase_id and a->>'solicitacaoId'=r.id::text;
   if p is not null then
    if p->>'data' is distinct from r.payload->>'data' or p->>'descricao' is distinct from r.payload->>'descricao' or p->>'totalCentavos' is distinct from r.payload->>'valorCentavos' or p->>'pagadorPessoaId' is distinct from r.payload->>'reembolsoPessoaId' or coalesce(p->'itens','[]'::jsonb)<>'[]'::jsonb then raise exception 'REQUEST_MODIFIED';end if;
    if exists(select 1 from jsonb_array_elements(coalesce(v.snapshot->'fechamentos','[]'::jsonb)) a where a->>'contaId'=r.account_id and a->>'mes'=left(p->>'data',7)) then raise exception 'REQUEST_CLOSED';end if;
    select coalesce(jsonb_agg(a order by position),'[]'::jsonb) into rows from jsonb_array_elements(c->'mercados') with ordinality as t(a,position) where a->>'id' is distinct from purchase_id;
    c:=jsonb_set(c,'{mercados}',rows);
    select jsonb_agg(case when a->>'id'=r.account_id then c else a end order by position) into rows from jsonb_array_elements(v.snapshot->'contas') with ordinality as t(a,position);
    next_snapshot:=jsonb_set(v.snapshot,'{contas}',rows);changed:=true;
   end if;
  else
   select count(*) into count_entries from jsonb_array_elements(coalesce(v.snapshot->'lancamentos','[]'::jsonb)) a where a->>'solicitacaoId'=r.id::text;
   if count_entries>1 then raise exception 'REQUEST_MODIFIED';end if;
   if count_entries=1 then
    select a into e from jsonb_array_elements(v.snapshot->'lancamentos') a where a->>'solicitacaoId'=r.id::text;
    if e->>'contaId' is distinct from r.account_id or e->>'descricao' is distinct from r.payload->>'descricao' or e->>'valorCentavos' is distinct from r.payload->>'valorCentavos' or e->>'tipo' is distinct from r.payload->>'tipo' or e->>'status' is distinct from r.payload->>'status' or e->>'data' is distinct from r.payload->>'data' or coalesce(e->>'observacao','') is distinct from coalesce(r.payload->>'observacao','') or coalesce(e->'parcial','null'::jsonb)<>'null'::jsonb or coalesce(e->'gestao','null'::jsonb)<>'null'::jsonb or coalesce(e->'extratoIds','[]'::jsonb)<>'[]'::jsonb or e->>'recorrenciaId' is not null or e->>'grupoRecorrencia' is not null or e->>'dataPrevista' is not null or e->>'cartaoId' is not null or e->>'parcela' is not null then raise exception 'REQUEST_MODIFIED';end if;
    if exists(select 1 from jsonb_array_elements(coalesce(v.snapshot->'fechamentos','[]'::jsonb)) a where a->>'contaId'=r.account_id and a->>'mes'=left(e->>'data',7)) then raise exception 'REQUEST_CLOSED';end if;
    select coalesce(jsonb_agg(a order by position),'[]'::jsonb) into rows from jsonb_array_elements(v.snapshot->'lancamentos') with ordinality as t(a,position) where a->>'solicitacaoId' is distinct from r.id::text;
    next_snapshot:=jsonb_set(v.snapshot,'{lancamentos}',rows);changed:=true;
   end if;
  end if;
 end if;
 if changed then update public.controlai_vaults set snapshot=next_snapshot,revision=revision+1,updated_at=now() where owner=auth.uid();end if;
 update public.controlai_requests set status='pendente',resolved_at=null,reason=null where id=p_id;
 return v.revision+case when changed then 1 else 0 end;
end $$;
revoke all on function public.controlai_requests_overview(uuid,text,integer,integer),public.controlai_cancel_request(uuid),public.controlai_undo_request(uuid,text,bigint) from public,anon;
grant execute on function public.controlai_requests_overview(uuid,text,integer,integer),public.controlai_cancel_request(uuid),public.controlai_undo_request(uuid,text,bigint) to authenticated;
