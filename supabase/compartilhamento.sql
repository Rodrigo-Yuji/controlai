-- Execute AFTER supabase/setup.sql. Keeps the original owner-only vault policy.
-- Readers never receive the owner's complete snapshot and cannot update it.
create table if not exists public.controlai_account_viewers (
 owner uuid not null references auth.users(id) on delete cascade,
 account_id text not null check (length(account_id) between 1 and 200),
 email text not null check (email = lower(btrim(email)) and length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 created_at timestamptz not null default now(),
 primary key (owner,account_id,email)
);
alter table public.controlai_account_viewers enable row level security;
revoke all on public.controlai_account_viewers from public,anon,authenticated;

create or replace function public.controlai_verified_email()
returns text language sql stable security definer set search_path='' as $$
 select lower(btrim(email)) from auth.users where id=auth.uid() and email_confirmed_at is not null;
$$;
revoke all on function public.controlai_verified_email() from public,anon,authenticated;

create or replace function public.controlai_set_account_viewer(p_account text,p_email text,p_allow boolean)
returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); recipient text:=lower(btrim(p_email));
begin
 if who is null or public.controlai_verified_email() is null then raise exception 'Confirme seu e-mail e entre novamente'; end if;
 if p_allow is null or recipient is null or recipient=public.controlai_verified_email() or length(recipient)>254 or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'E-mail inválido'; end if;
 if p_allow and not exists(select 1 from public.controlai_vaults v cross join lateral jsonb_array_elements(v.snapshot->'contas') a where v.owner=who and a->>'id'=p_account and coalesce(a->>'tipo',case when a->>'conjunta'='true' then 'casal' else 'solo' end) in ('casal','gestora')) then raise exception 'Sincronize esta conta Casal ou Gestora antes de compartilhar'; end if;
 if p_allow then insert into public.controlai_account_viewers(owner,account_id,email) values(who,p_account,recipient) on conflict do nothing;
 else delete from public.controlai_account_viewers where owner=who and account_id=p_account and email=recipient; end if;
end $$;
revoke all on function public.controlai_set_account_viewer(text,text,boolean) from public,anon;
grant execute on function public.controlai_set_account_viewer(text,text,boolean) to authenticated;

create or replace function public.controlai_account_viewers(p_account text)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('email',email,'created_at',created_at) order by email),'[]'::jsonb) from public.controlai_account_viewers where owner=auth.uid() and account_id=p_account;
$$;
revoke all on function public.controlai_account_viewers(text) from public,anon;
grant execute on function public.controlai_account_viewers(text) to authenticated;

create or replace function public.controlai_shared_accounts()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('owner',s.owner,'account_id',s.account_id,'nome',a->>'nome','tipo',coalesce(a->>'tipo','casal')) order by a->>'nome'),'[]'::jsonb)
 from public.controlai_account_viewers s join public.controlai_vaults v on v.owner=s.owner
 cross join lateral jsonb_array_elements(v.snapshot->'contas') a
 where s.email=public.controlai_verified_email() and a->>'id'=s.account_id and coalesce(a->>'tipo',case when a->>'conjunta'='true' then 'casal' else 'solo' end) in ('casal','gestora');
$$;
revoke all on function public.controlai_shared_accounts() from public,anon;
grant execute on function public.controlai_shared_accounts() to authenticated;

create or replace function public.controlai_shared_account(p_owner uuid,p_account text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare source jsonb; account jsonb; result jsonb; revision bigint; updated timestamptz; tab text;
begin
 if not exists(select 1 from public.controlai_account_viewers where owner=p_owner and account_id=p_account and email=public.controlai_verified_email()) then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 select v.snapshot,v.revision,v.updated_at into source,revision,updated from public.controlai_vaults v where v.owner=p_owner;
 select a into account from jsonb_array_elements(source->'contas') a where a->>'id'=p_account and coalesce(a->>'tipo',case when a->>'conjunta'='true' then 'casal' else 'solo' end) in ('casal','gestora');
 if account is null then raise exception 'Conta indisponível' using errcode='42501'; end if;
 result:=jsonb_build_object('contas',jsonb_build_array(account));
 foreach tab in array array['lancamentos','reservas','recorrencias','salarios','categorias','configuracoes','fechamentos'] loop
  result:=result||jsonb_build_object(tab,coalesce((select jsonb_agg(r) from jsonb_array_elements(coalesce(source->tab,'[]'::jsonb)) r where r->>'contaId'=p_account),'[]'::jsonb));
 end loop;
 return jsonb_build_object('revision',revision,'updated_at',updated,'snapshot',result);
end $$;
revoke all on function public.controlai_shared_account(uuid,text) from public,anon;
grant execute on function public.controlai_shared_account(uuid,text) to authenticated;

-- Owner-controlled viewer identity.
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
