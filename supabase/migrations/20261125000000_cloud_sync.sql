-- Add the permitted auth.users UUID to shadow_allowed_users after the first sign-in.
create table public.shadow_allowed_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on public.shadow_allowed_users from public, anon, authenticated;

create function public.shadow_is_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shadow_allowed_users where user_id = auth.uid());
$$;
revoke all on function public.shadow_is_allowed() from public;
grant execute on function public.shadow_is_allowed() to authenticated;

create table public.shadow_cloud_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null check (revision > 0),
  data jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.shadow_conflict_backups (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  versions jsonb not null
);
alter table public.shadow_cloud_state enable row level security;
alter table public.shadow_conflict_backups enable row level security;
create policy "Read own allowed cloud state" on public.shadow_cloud_state for select to authenticated
  using (user_id = auth.uid() and public.shadow_is_allowed());
create policy "Read own allowed conflict backups" on public.shadow_conflict_backups for select to authenticated
  using (user_id = auth.uid() and public.shadow_is_allowed());
revoke all on public.shadow_cloud_state, public.shadow_conflict_backups from public, anon, authenticated;
grant select on public.shadow_cloud_state, public.shadow_conflict_backups to authenticated;

create function public.shadow_save(
  expected_revision bigint, next_data jsonb, next_metadata jsonb, conflict_versions jsonb default '[]'::jsonb
) returns setof public.shadow_cloud_state
language plpgsql security definer set search_path = '' as $$
declare saved public.shadow_cloud_state;
begin
  if auth.uid() is null or not public.shadow_is_allowed() then
    raise exception 'This account is not permitted to use the journal' using errcode = '42501';
  end if;
  if expected_revision < 0 or jsonb_typeof(next_data) <> 'object'
     or jsonb_typeof(next_metadata) <> 'object'
     or conflict_versions is null or jsonb_typeof(conflict_versions) <> 'array' then
    raise exception 'Invalid sync data';
  end if;
  if expected_revision = 0 then
    insert into public.shadow_cloud_state (user_id, revision, data, metadata)
      values (auth.uid(), 1, next_data, next_metadata)
      on conflict (user_id) do nothing returning * into saved;
  else
    update public.shadow_cloud_state
      set revision = revision + 1, data = next_data, metadata = next_metadata, updated_at = now()
      where user_id = auth.uid() and revision = expected_revision returning * into saved;
  end if;
  if saved.user_id is not null then
    insert into public.shadow_conflict_backups (user_id, versions)
      select auth.uid(), value from jsonb_array_elements(conflict_versions);
    return next saved;
  end if;
end;
$$;
revoke all on function public.shadow_save(bigint, jsonb, jsonb, jsonb) from public;
grant execute on function public.shadow_save(bigint, jsonb, jsonb, jsonb) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                     and schemaname = 'public' and tablename = 'shadow_cloud_state') then
    alter publication supabase_realtime add table public.shadow_cloud_state;
  end if;
end;
$$;
