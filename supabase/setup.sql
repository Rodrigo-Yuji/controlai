-- Execute once in Supabase SQL Editor. No service_role key goes in the app.
create table if not exists public.controlai_vaults (
  owner uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 8388608),
  updated_at timestamptz not null default now()
);
alter table public.controlai_vaults enable row level security;
revoke all on public.controlai_vaults from anon, authenticated;
grant select on public.controlai_vaults to authenticated;
drop policy if exists own_vault on public.controlai_vaults;
create policy own_vault on public.controlai_vaults for select to authenticated using (owner = (select auth.uid()));

create or replace function public.controlai_push(expected_revision bigint, next_snapshot jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare who uuid := auth.uid(); new_revision bigint;
begin
  if who is null then raise exception 'Login obrigatório'; end if;
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
revoke all on function public.controlai_push(bigint,jsonb) from public, anon;
grant execute on function public.controlai_push(bigint,jsonb) to authenticated;
