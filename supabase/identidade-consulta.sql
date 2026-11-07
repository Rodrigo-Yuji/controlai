-- Run after solicitacoes-ciclo.sql. Only the account owner assigns an email's person.
alter table public.controlai_account_viewers add column if not exists pessoa_id text;
create or replace function public.controlai_viewer_identity(p_account jsonb,p_snapshot jsonb,p_person text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare person jsonb;person_name text;holder integer;kind text;
begin
 if p_person is null or p_person='' then return null;end if;
 kind:=coalesce(p_account->>'tipo',case when p_account->>'conjunta'='true' then 'casal' else 'solo' end);
 if kind='gestora' then
  select a into person from jsonb_array_elements(coalesce(p_account->'pessoas','[]'::jsonb)) a where a->>'id'=p_person;
  if person is null then return null;end if;person_name:=person->>'nome';
 elsif kind='casal' and p_person in ('titular:1','titular:2') then
  holder:=right(p_person,1)::integer;
  select a->>'titular' into person_name from jsonb_array_elements(coalesce(p_snapshot->'salarios','[]'::jsonb)) a where a->>'contaId'=p_account->>'id' and a->>'id'=(p_account->>'id')||':'||holder;
  person_name:=coalesce(nullif(btrim(person_name),''),'Titular '||holder);
 else return null;end if;
 return jsonb_build_object('pessoa_id',p_person,'nome',person_name);
end $$;
revoke all on function public.controlai_viewer_identity(jsonb,jsonb,text) from public,anon,authenticated;
create or replace function public.controlai_set_account_viewer_identity(p_account text,p_email text,p_allow boolean,p_pessoa_id text default null)
returns void language plpgsql security definer set search_path='' as $$
declare snap jsonb;c jsonb;recipient text:=lower(btrim(p_email));person text:=nullif(btrim(p_pessoa_id),'');
begin
 perform public.controlai_set_account_viewer(p_account,p_email,p_allow);
 if not p_allow then return;end if;
 perform 1 from public.controlai_account_viewers where owner=auth.uid() and account_id=p_account and email=recipient for update;
 select snapshot into snap from public.controlai_vaults where owner=auth.uid() for share;
 select a into c from jsonb_array_elements(coalesce(snap->'contas','[]'::jsonb)) a where a->>'id'=p_account;
 if person is not null and public.controlai_viewer_identity(c,snap,person) is null then raise exception 'VIEWER_PERSON_INVALID';end if;
 update public.controlai_account_viewers set pessoa_id=person where owner=auth.uid() and account_id=p_account and email=recipient;
end $$;
revoke all on function public.controlai_set_account_viewer_identity(text,text,boolean,text) from public,anon;
grant execute on function public.controlai_set_account_viewer_identity(text,text,boolean,text) to authenticated;
create or replace function public.controlai_account_viewers(p_account text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare snap jsonb;c jsonb;result jsonb;
begin
 select snapshot into snap from public.controlai_vaults where owner=auth.uid();
 select a into c from jsonb_array_elements(coalesce(snap->'contas','[]'::jsonb)) a where a->>'id'=p_account;
 select coalesce(jsonb_agg(jsonb_build_object('email',v.email,'created_at',v.created_at,'pessoa_id',v.pessoa_id,'nome',public.controlai_viewer_identity(c,snap,v.pessoa_id)->>'nome') order by v.email),'[]'::jsonb) into result from public.controlai_account_viewers v where v.owner=auth.uid() and v.account_id=p_account;
 return result;
end $$;
create or replace function public.controlai_shared_account(p_owner uuid,p_account text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare source jsonb;account jsonb;result jsonb;revision bigint;updated timestamptz;tab text;person text;
begin
 select pessoa_id into person from public.controlai_account_viewers where owner=p_owner and account_id=p_account and email=public.controlai_verified_email();
 if not found then raise exception 'Acesso não autorizado' using errcode='42501';end if;
 select v.snapshot,v.revision,v.updated_at into source,revision,updated from public.controlai_vaults v where v.owner=p_owner;
 select a into account from jsonb_array_elements(source->'contas') a where a->>'id'=p_account and coalesce(a->>'tipo',case when a->>'conjunta'='true' then 'casal' else 'solo' end) in ('casal','gestora');
 if account is null then raise exception 'Conta indisponível' using errcode='42501';end if;
 result:=jsonb_build_object('contas',jsonb_build_array(account));
 foreach tab in array array['lancamentos','reservas','recorrencias','salarios','categorias','configuracoes','fechamentos'] loop
  result:=result||jsonb_build_object(tab,coalesce((select jsonb_agg(r) from jsonb_array_elements(coalesce(source->tab,'[]'::jsonb)) r where r->>'contaId'=p_account),'[]'::jsonb));
 end loop;
 return jsonb_build_object('revision',revision,'updated_at',updated,'snapshot',result,'viewer_identity',public.controlai_viewer_identity(account,source,person));
end $$;
revoke all on function public.controlai_account_viewers(text),public.controlai_shared_account(uuid,text) from public,anon;
grant execute on function public.controlai_account_viewers(text),public.controlai_shared_account(uuid,text) to authenticated;

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
