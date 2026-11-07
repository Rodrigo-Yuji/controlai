-- Self-service deletion of the authenticated login only. Run after setup.sql
-- and compartilhamento.sql. Never put an admin/service_role key in the app.
create or replace function public.controlai_delete_my_account(p_confirmation text)
returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); mail text; claims jsonb:=auth.jwt();
begin
 if who is null or p_confirmation is distinct from 'EXCLUIR' then raise exception 'Confirmação de exclusão inválida' using errcode='42501'; end if;
 if not exists(select 1 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) factor where factor->>'method'='password' and case when coalesce(factor->>'timestamp','') ~ '^[0-9]{1,12}$' then (factor->>'timestamp')::bigint between extract(epoch from now())::bigint-300 and extract(epoch from now())::bigint+30 else false end) then raise exception 'Confirme sua senha novamente antes de excluir' using errcode='42501'; end if;
 if exists(select 1 from auth.mfa_factors where user_id=who and status='verified') and coalesce(claims->>'aal','aal1')<>'aal2' then raise exception 'Confirme o segundo fator antes de excluir' using errcode='42501'; end if;
 select lower(btrim(email)) into mail from auth.users where id=who for update;
 if not found then raise exception 'Login não encontrado' using errcode='42501'; end if;
 -- Remove received grants too: recreating this e-mail must not restore them.
 delete from public.controlai_account_viewers where email=mail;
 -- Existing foreign keys cascade only this user's vault and owned grants.
 delete from auth.users where id=who;
end $$;
revoke all on function public.controlai_delete_my_account(text) from public,anon;
grant execute on function public.controlai_delete_my_account(text) to authenticated;
