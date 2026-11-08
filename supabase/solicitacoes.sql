-- Run after setup.sql and compartilhamento.sql. Requests never grant write
-- access to a vault. Only its owner can approve; approval and the ledger update
-- commit atomically, with revision checking and idempotence.
create table if not exists public.controlai_requests (
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 account_id text not null, requester uuid not null references auth.users(id) on delete cascade,
 requester_email text not null, payload jsonb not null, status text not null default 'pendente' check(status in ('pendente','aprovado','recusado','cancelado')),
 receipt_path text, created_at timestamptz not null default now(), resolved_at timestamptz, reason text,
 check(octet_length(payload::text)<=10000)
);
create index if not exists controlai_requests_owner_idx on public.controlai_requests(owner,account_id,created_at desc);
alter table public.controlai_requests enable row level security;
revoke all on public.controlai_requests from public,anon,authenticated;
create or replace function public.controlai_request_access(p_owner uuid,p_account text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.controlai_account_viewers a join public.controlai_vaults v on v.owner=a.owner cross join lateral jsonb_array_elements(v.snapshot->'contas') c where a.owner=p_owner and a.account_id=p_account and a.email=public.controlai_verified_email() and c->>'id'=p_account and coalesce(c->>'tipo',case when c->>'conjunta'='true' then 'casal' else 'solo' end) in ('casal','gestora'));
$$;
revoke all on function public.controlai_request_access(uuid,text) from public,anon,authenticated;
create or replace function public.controlai_submit_request(p_owner uuid,p_account text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; c jsonb; person jsonb; clean_payload jsonb;
begin
 if not public.controlai_request_access(p_owner,p_account) then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or coalesce(length(btrim(p_payload->>'descricao')),0) not between 1 and 200 or coalesce(p_payload->>'tipo','') not in ('receita','despesa') or coalesce(p_payload->>'status','') not in ('previsto','confirmado') or coalesce(p_payload->>'valorCentavos','') !~ '^[1-9][0-9]{0,11}$' or coalesce(p_payload->>'data','') !~ '^\d{4}-\d{2}-\d{2}$' or length(coalesce(p_payload->>'observacao',''))>1000 then raise exception 'Solicitação inválida'; end if;
 if to_char((p_payload->>'data')::date,'YYYY-MM-DD')<>p_payload->>'data' then raise exception 'Data inválida'; end if;
 if p_payload ? 'reembolsoPessoaId' then
  select a into c from public.controlai_vaults v cross join lateral jsonb_array_elements(v.snapshot->'contas') a where v.owner=p_owner and a->>'id'=p_account;
  if c->>'tipo' is distinct from 'gestora' or jsonb_typeof(p_payload->'reembolsoPessoaId') is distinct from 'string' or p_payload->>'tipo' is distinct from 'despesa' or p_payload->>'status' is distinct from 'confirmado' then raise exception 'Compra para reembolso inválida'; end if;
  select a into person from jsonb_array_elements(coalesce(c->'pessoas','[]'::jsonb)) a where a->>'id'=p_payload->>'reembolsoPessoaId' and coalesce(a->>'fimMes','9999-12')>=left(p_payload->>'data',7);
  if person is null then raise exception 'Participante não encontrado nesta gestora'; end if;
 end if;
 if (select count(*) from public.controlai_requests where requester=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'Limite diário de solicitações atingido'; end if;
 clean_payload:=jsonb_build_object('descricao',btrim(p_payload->>'descricao'),'tipo',p_payload->>'tipo','status',p_payload->>'status','data',p_payload->>'data','valorCentavos',(p_payload->>'valorCentavos')::bigint,'observacao',coalesce(p_payload->>'observacao',''));
 if p_payload ? 'reembolsoPessoaId' then clean_payload:=clean_payload||jsonb_build_object('reembolsoPessoaId',p_payload->>'reembolsoPessoaId');end if;
 insert into public.controlai_requests(owner,account_id,requester,requester_email,payload) values(p_owner,p_account,auth.uid(),public.controlai_verified_email(),clean_payload) returning id into result;
 return result;
end $$;
-- Separate endpoint prevents old servers from silently treating this as an expense.
create or replace function public.controlai_submit_household_request(p_owner uuid,p_account text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not(p_payload ? 'reembolsoPessoaId') or p_payload->>'reembolsoPessoaId' is null then raise exception 'Informe quem pagou';end if;
 return public.controlai_submit_request(p_owner,p_account,p_payload);
end $$;
revoke all on function public.controlai_submit_household_request(uuid,text,jsonb) from public,anon;
grant execute on function public.controlai_submit_household_request(uuid,text,jsonb) to authenticated;
create or replace function public.controlai_list_requests(p_owner uuid,p_account text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(auth.uid()=p_owner or public.controlai_request_access(p_owner,p_account)) then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by (r.status='pendente') desc,r.created_at desc) from (select * from public.controlai_requests where owner=p_owner and account_id=p_account and (auth.uid()=p_owner or requester=auth.uid()) order by (status='pendente') desc,created_at desc limit 100) r),'[]'::jsonb);
end $$;
create or replace function public.controlai_resolve_request(p_id uuid,p_status text,p_category text,p_revision bigint,p_reason text default '')
returns bigint language plpgsql security definer set search_path='' as $$
declare r public.controlai_requests; v public.controlai_vaults; c jsonb; cat jsonb; entry jsonb; next_id bigint; rows jsonb; next_snapshot jsonb; person jsonb; purchase jsonb; purchase_id text;
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
 if r.payload ? 'reembolsoPessoaId' then
  if c->>'tipo' is distinct from 'gestora' or r.payload->>'tipo' is distinct from 'despesa' or r.payload->>'status' is distinct from 'confirmado' then raise exception 'Compra para reembolso inválida';end if;
  select a into person from jsonb_array_elements(coalesce(c->'pessoas','[]'::jsonb)) a where a->>'id'=r.payload->>'reembolsoPessoaId' and coalesce(a->>'fimMes','9999-12')>=left(r.payload->>'data',7);
  if person is null then raise exception 'Participante não encontrado nesta gestora';end if;
  purchase_id:='solicitacao:'||r.id::text;
  if exists(select 1 from jsonb_array_elements(coalesce(c->'mercados','[]'::jsonb)) a where a->>'id'=purchase_id or a->>'solicitacaoId'=r.id::text) or exists(select 1 from jsonb_array_elements(coalesce(v.snapshot->'lancamentos','[]'::jsonb)) a where a->>'solicitacaoId'=r.id::text) then raise exception 'Solicitação já registrada';end if;
  purchase:=jsonb_build_object('id',purchase_id,'solicitacaoId',r.id::text,'descricao',r.payload->>'descricao','data',r.payload->>'data','totalCentavos',(r.payload->>'valorCentavos')::bigint,'pagadorPessoaId',r.payload->>'reembolsoPessoaId','itens','[]'::jsonb,'categoria',p_category,'natureza',cat->>'natureza','observacao',coalesce(r.payload->>'observacao',''));
  c:=jsonb_set(c,'{mercados}',coalesce(c->'mercados','[]'::jsonb)||jsonb_build_array(purchase));
  select jsonb_agg(case when a->>'id'=r.account_id then c else a end order by position) into rows from jsonb_array_elements(v.snapshot->'contas') with ordinality as t(a,position);
  next_snapshot:=jsonb_set(v.snapshot,'{contas}',rows);
 else
 rows:=coalesce(v.snapshot->'lancamentos','[]'::jsonb);
 if exists(select 1 from jsonb_array_elements(rows) a where a->>'solicitacaoId'=r.id::text) then raise exception 'Solicitação já registrada'; end if;
 select coalesce(max((a->>'id')::bigint),0)+1 into next_id from jsonb_array_elements(rows) a;
 if next_id>9007199254740991 then raise exception 'Limite de identificadores atingido'; end if;
 entry:=r.payload||jsonb_build_object('id',next_id,'contaId',r.account_id,'categoria',p_category,'natureza',cat->>'natureza','solicitacaoId',r.id::text);
 next_snapshot:=jsonb_set(v.snapshot,'{lancamentos}',rows||jsonb_build_array(entry));
 end if;

 if octet_length(next_snapshot::text)>8388608 then raise exception 'Cofre sem espaço'; end if;
 update public.controlai_vaults set snapshot=next_snapshot,revision=revision+1,updated_at=now() where owner=auth.uid();
 update public.controlai_requests set status=p_status,resolved_at=now() where id=p_id;
 return v.revision+1;
end $$;
revoke all on function public.controlai_submit_request(uuid,text,jsonb),public.controlai_list_requests(uuid,text),public.controlai_resolve_request(uuid,text,text,bigint,text) from public,anon;
grant execute on function public.controlai_submit_request(uuid,text,jsonb),public.controlai_list_requests(uuid,text),public.controlai_resolve_request(uuid,text,text,bigint,text) to authenticated;
-- Attachments are retired. Existing files are retained; uploading is disabled.
drop policy if exists controlai_receipts_insert on storage.objects;
drop function if exists public.controlai_attach_receipt(uuid,text);
-- File cleanup before self-service login deletion, including revoked invitations.
create or replace function public.controlai_my_receipts()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(r.requester::text||'/'||r.id::text||'/comprovante'),'[]'::jsonb) from public.controlai_requests r where (r.owner=auth.uid() or r.requester=auth.uid()) and exists(select 1 from storage.objects o where o.bucket_id='controlai-comprovantes' and o.name=r.requester::text||'/'||r.id::text||'/comprovante');
$$;
revoke all on function public.controlai_my_receipts() from public,anon;
grant execute on function public.controlai_my_receipts() to authenticated;
create or replace function public.controlai_receipt_delete(p_name text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.controlai_requests r where (r.owner=auth.uid() or r.requester=auth.uid()) and p_name=r.requester::text||'/'||r.id::text||'/comprovante');
$$;
revoke all on function public.controlai_receipt_delete(text) from public,anon;
grant execute on function public.controlai_receipt_delete(text) to authenticated;
drop policy if exists controlai_receipts_delete on storage.objects;
create policy controlai_receipts_delete on storage.objects for delete to authenticated using(bucket_id='controlai-comprovantes' and public.controlai_receipt_delete(name));

-- Request lifecycle and paginated overview.
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

-- Enforce owner-assigned request identity.
-- Request identity enforcement. Triggers also protect older client/RPC versions.
create or replace function public.controlai_request_identity_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare person text;snap jsonb;c jsonb;needs_check boolean;
begin
 if not(new.payload ? 'reembolsoPessoaId') then return new;end if;
 needs_check:=tg_op='INSERT';
 if tg_op='UPDATE' then needs_check:=new.payload is distinct from old.payload or new.owner is distinct from old.owner or new.account_id is distinct from old.account_id or new.requester is distinct from old.requester or new.requester_email is distinct from old.requester_email or(new.status='aprovado' and old.status<>'aprovado');end if;
 if not needs_check then return new;end if;
 if tg_op='INSERT' then
  select pessoa_id into person from public.controlai_account_viewers where owner=new.owner and account_id=new.account_id and email=new.requester_email for share;
 else
  select pessoa_id into person from public.controlai_account_viewers where owner=new.owner and account_id=new.account_id and email=new.requester_email;
 end if;
 if not found or person is null then raise exception 'VIEWER_IDENTITY_REQUIRED';end if;
 if new.payload->>'reembolsoPessoaId' is distinct from person then
  if tg_op='UPDATE' then raise exception 'VIEWER_IDENTITY_CHANGED';else raise exception 'VIEWER_IDENTITY_MISMATCH';end if;
 end if;
 select snapshot into snap from public.controlai_vaults where owner=new.owner;
 select a into c from jsonb_array_elements(coalesce(snap->'contas','[]'::jsonb)) a where a->>'id'=new.account_id;
 if c->>'tipo' is distinct from 'gestora' or public.controlai_viewer_identity(c,snap,person) is null or new.payload->>'tipo' is distinct from 'despesa' or new.payload->>'status' is distinct from 'confirmado' then raise exception 'VIEWER_PERSON_INVALID';end if;
 return new;
end $$;
revoke all on function public.controlai_request_identity_guard() from public,anon,authenticated;
drop trigger if exists controlai_request_identity_guard on public.controlai_requests;
create trigger controlai_request_identity_guard before insert or update of payload,owner,account_id,requester,requester_email,status on public.controlai_requests for each row execute function public.controlai_request_identity_guard();
create or replace function public.controlai_submit_identified_household_request(p_owner uuid,p_account text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare person text;request_id uuid;stored text;
begin
 if not public.controlai_request_access(p_owner,p_account) then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 select pessoa_id into person from public.controlai_account_viewers where owner=p_owner and account_id=p_account and email=public.controlai_verified_email() for share;
 if person is null then raise exception 'VIEWER_IDENTITY_REQUIRED';end if;
 if p_payload ? 'identificacaoEsperada' and p_payload->>'identificacaoEsperada' is distinct from person then raise exception 'VIEWER_IDENTITY_CHANGED';end if;
 if p_payload ? 'reembolsoPessoaId' and p_payload->>'reembolsoPessoaId' is distinct from person then raise exception 'VIEWER_IDENTITY_MISMATCH';end if;
 request_id:=public.controlai_submit_request(p_owner,p_account,p_payload||jsonb_build_object('reembolsoPessoaId',person));
 select payload->>'reembolsoPessoaId' into stored from public.controlai_requests where id=request_id;
 if stored is distinct from person then raise exception 'VIEWER_IDENTITY_SETUP';end if;
 return request_id;
end $$;
revoke all on function public.controlai_submit_identified_household_request(uuid,text,jsonb) from public,anon;
grant execute on function public.controlai_submit_identified_household_request(uuid,text,jsonb) to authenticated;
