-- Integration test for a disposable database with auth.uid() and two test users.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select public.controlai_push(0,'{"test":"user1"}'::jsonb);
do $$ begin
 if (select count(*) from public.controlai_vaults) <> 1 then raise exception 'Own copy missing'; end if;
 begin
  perform public.controlai_push(0,'{"test":"stale"}'::jsonb);
  raise exception 'Stale create accepted';
 exception when sqlstate '40001' then null; end;
 begin
  update public.controlai_vaults set snapshot='{}';
  raise exception 'Direct write accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$ begin
 if (select count(*) from public.controlai_vaults) <> 0 then raise exception 'Cross-user read'; end if;
 begin
  perform public.controlai_push(1,'{"test":"cross-user"}'::jsonb);
  raise exception 'Cross-user overwrite';
 exception when sqlstate '40001' then null; end;
end $$;
select public.controlai_push(0,'{"test":"user2"}'::jsonb);
select public.controlai_push(1,'{"test":"user2-new"}'::jsonb);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
do $$ begin
 if (select revision from public.controlai_vaults) <> 1 then raise exception 'Other user modified my copy'; end if;
 if (select snapshot->>'test' from public.controlai_vaults) <> 'user1' then raise exception 'Other user modified my data'; end if;
end $$;
reset role;
set role anon;
do $$ begin
 begin
  perform public.controlai_push(0,'{}');
  raise exception 'Anonymous RPC allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform * from public.controlai_vaults;
  raise exception 'Anonymous read allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
