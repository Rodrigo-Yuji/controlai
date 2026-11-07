-- Run after setup.sql and compartilhamento.sql. Requests never grant write
-- access to a vault. Only its owner can approve; approval and the ledger update
-- commit atomically, with revision checking and idempotence.
create table if not exists public.controlai_requests (
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 account_id text not null, requester uuid not null references auth.users(id) on delete cascade,
 requester_email text not null, payload jsonb not null, status text not null default 'pendente' check(status in ('pendente','aprovado','recusado')),
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
declare result uuid;
begin
 if not public.controlai_request_access(p_owner,p_account) then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or coalesce(length(btrim(p_payload->>'descricao')),0) not between 1 and 200 or coalesce(p_payload->>'tipo','') not in ('receita','despesa') or coalesce(p_payload->>'status','') not in ('previsto','confirmado') or coalesce(p_payload->>'valorCentavos','') !~ '^[1-9][0-9]{0,11}$' or coalesce(p_payload->>'data','') !~ '^\d{4}-\d{2}-\d{2}$' or length(coalesce(p_payload->>'observacao',''))>1000 then raise exception 'Solicitação inválida'; end if;
 if to_char((p_payload->>'data')::date,'YYYY-MM-DD')<>p_payload->>'data' then raise exception 'Data inválida'; end if;
 if (select count(*) from public.controlai_requests where requester=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'Limite diário de solicitações atingido'; end if;
 insert into public.controlai_requests(owner,account_id,requester,requester_email,payload) values(p_owner,p_account,auth.uid(),public.controlai_verified_email(),jsonb_build_object('descricao',btrim(p_payload->>'descricao'),'tipo',p_payload->>'tipo','status',p_payload->>'status','data',p_payload->>'data','valorCentavos',(p_payload->>'valorCentavos')::bigint,'observacao',coalesce(p_payload->>'observacao',''))) returning id into result;
 return result;
end $$;
create or replace function public.controlai_list_requests(p_owner uuid,p_account text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(auth.uid()=p_owner or public.controlai_request_access(p_owner,p_account)) then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (select * from public.controlai_requests where owner=p_owner and account_id=p_account and (auth.uid()=p_owner or requester=auth.uid()) order by created_at desc limit 100) r),'[]'::jsonb);
end $$;
create or replace function public.controlai_attach_receipt(p_id uuid,p_path text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.controlai_requests;
begin
 select * into r from public.controlai_requests where id=p_id for update;
 if not found or r.requester<>auth.uid() or r.status<>'pendente' or not public.controlai_request_access(r.owner,r.account_id) or p_path<>auth.uid()::text||'/'||p_id::text||'/comprovante' then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 update public.controlai_requests set receipt_path=p_path where id=p_id;
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
 next_snapshot:=jsonb_set(next_snapshot,'{contas}',(select jsonb_agg(case when a->>'id'=r.account_id then jsonb_set(a,'{atividades}',coalesce(a->'atividades','[]'::jsonb)||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'at',now(),'actor',public.controlai_verified_email(),'changes',jsonb_build_array(jsonb_build_object('table','lancamentos','id',next_id,'after',entry))))) else a end) from jsonb_array_elements(next_snapshot->'contas') a));
 if octet_length(next_snapshot::text)>8388608 then raise exception 'Cofre sem espaço'; end if;
 update public.controlai_vaults set snapshot=next_snapshot,revision=revision+1,updated_at=now() where owner=auth.uid();
 update public.controlai_requests set status=p_status,resolved_at=now() where id=p_id;
 return v.revision+1;
end $$;
revoke all on function public.controlai_submit_request(uuid,text,jsonb),public.controlai_list_requests(uuid,text),public.controlai_attach_receipt(uuid,text),public.controlai_resolve_request(uuid,text,text,bigint,text) from public,anon;
grant execute on function public.controlai_submit_request(uuid,text,jsonb),public.controlai_list_requests(uuid,text),public.controlai_attach_receipt(uuid,text),public.controlai_resolve_request(uuid,text,text,bigint,text) to authenticated;
-- Private receipts: only the submitting participant (while authorized) and owner.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('controlai-comprovantes','controlai-comprovantes',false,2097152,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.controlai_receipt_access(p_name text,p_write boolean)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.controlai_requests r where split_part(p_name,'/',1)=r.requester::text and split_part(p_name,'/',2)=r.id::text and p_name=r.requester::text||'/'||r.id::text||'/comprovante' and ((not p_write and r.owner=auth.uid()) or (r.requester=auth.uid() and public.controlai_request_access(r.owner,r.account_id) and (not p_write or r.status='pendente'))));
$$;
revoke all on function public.controlai_receipt_access(text,boolean) from public,anon;
grant execute on function public.controlai_receipt_access(text,boolean) to authenticated;
drop policy if exists controlai_receipts_read on storage.objects;
create policy controlai_receipts_read on storage.objects for select to authenticated using(bucket_id='controlai-comprovantes' and public.controlai_receipt_access(name,false));
drop policy if exists controlai_receipts_insert on storage.objects;
create policy controlai_receipts_insert on storage.objects for insert to authenticated with check(bucket_id='controlai-comprovantes' and public.controlai_receipt_access(name,true));
-- File cleanup before self-service login deletion, including revoked invitations.
create or replace function public.controlai_my_receipts()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(requester::text||'/'||id::text||'/comprovante'),'[]'::jsonb) from public.controlai_requests where owner=auth.uid() or requester=auth.uid();
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
