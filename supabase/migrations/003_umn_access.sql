-- Apply after 002_availability_outcomes.sql. Restricts new profiles to University
-- of Minnesota addresses. Existing profiles are untouched; invited members keep access.
begin;

-- Twin Cities only, matching the chapter. To admit every UMN campus
-- (d.umn.edu, r.umn.edu, morris.umn.edu, crk.umn.edu) change the pattern to
-- '^[^@]+@([a-z0-9-]+\.)*umn\.edu$'. Keep lib/access.ts in step with this.
create function public.is_umn_email(address text) returns boolean
language sql immutable set search_path = '' as $$
  select address is not null and lower(address) ~ '^[^@]+@umn\.edu$';
$$;
revoke all on function public.is_umn_email(text) from public;
grant execute on function public.is_umn_email(text) to authenticated;

create function public.is_umn_member() returns boolean
language sql stable set search_path = '' as $$
  select public.is_umn_email(auth.jwt() ->> 'email');
$$;
revoke all on function public.is_umn_member() from public;
grant execute on function public.is_umn_member() to authenticated;

-- The workspace creates a member's profile on first sign-in, so this is the
-- gate every connected account passes through before it can be matched.
drop policy profiles_create on public.profiles;
create policy profiles_create on public.profiles for insert to authenticated
  with check (id = auth.uid() and public.is_umn_member());
commit;
