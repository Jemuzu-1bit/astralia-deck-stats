-- Also upgrades installations that applied the earlier code-activation version.
-- Existing administrators and monitoring history are preserved.
drop function if exists public.claim_site_admin(text);
drop function if exists public.create_admin_setup_code();
drop table if exists public.admin_setup;

-- Role assignments are backend-only, including the very first administrator.
-- In Supabase SQL Editor: select public.set_site_admin('YOUR_AUTH_USER_UUID', true);
create or replace function public.set_site_admin(p_user_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(190001);
  if p_user_id is null or p_enabled is null then raise exception 'Select a user and role.'; end if;
  if p_enabled then
    insert into public.site_admins(user_id) values (p_user_id) on conflict do nothing;
    if not found then return; end if;
  else
    if exists (select 1 from public.site_admins where user_id = p_user_id)
      and (select count(*) from public.site_admins) <= 1 then
      raise exception 'The last administrator cannot be removed.';
    end if;
    delete from public.site_admins where user_id = p_user_id;
    if not found then return; end if;
  end if;
  insert into public.admin_audit(actor_id, target_id, action)
    values (null, p_user_id, case when p_enabled then 'admin_granted_backend' else 'admin_revoked_backend' end);
end;
$$;
-- Neither players nor site administrators can change roles with a browser token.
-- This is callable only by trusted backend/database roles, such as SQL Editor.
revoke all on function public.set_site_admin(uuid, boolean) from public, anon, authenticated;
