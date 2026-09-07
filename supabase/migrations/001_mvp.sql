-- Apply to a dedicated Wunderbar Supabase project, never the chapter site's database.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.admins (user_id uuid primary key references auth.users(id) on delete cascade);

create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (length(name) <= 70),
  role text not null default 'Software engineer' check (length(role) between 1 and 100),
  focus text not null default 'Teamwork' check (focus in ('Teamwork','Leadership','Conflict','Ownership','Adaptability','Communication')),
  timezone text not null default 'America/Chicago',
  availability text[] not null default '{}', skip_weeks text[] not null default '{}',
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  check (not onboarded or length(trim(name)) > 0), check (cardinality(availability) <= 28), check (cardinality(skip_weeks) <= 52)
);
create function public.validate_profile() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then raise exception 'Choose a valid timezone.'; end if;
  if exists(select 1 from unnest(new.availability) slot where slot !~ '^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-(09|12|15|18):00$') then raise exception 'Choose valid availability slots.'; end if;
  if exists(select 1 from unnest(new.skip_weeks) week where week !~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Choose valid weeks to skip.'; end if;
  return new;
end;
$$;
create trigger profile_validation before insert or update on public.profiles for each row execute function public.validate_profile();

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  guest_id uuid not null references public.profiles(id) on delete cascade,
  host_name text not null, guest_name text not null, host_role text not null, guest_role text not null,
  starts_at timestamptz not null,
  focus text not null check (focus in ('Teamwork','Leadership','Conflict','Ownership','Adaptability','Communication')),
  meeting_link text not null default '' check (length(meeting_link) <= 500),
  status text not null default 'upcoming' check (status in ('upcoming','completed','cancelled')),
  question_ids text[] not null, created_at timestamptz not null default now(),
  check (host_id <> guest_id), check (cardinality(question_ids) between 1 and 7)
);
create index sessions_host_date on public.sessions(host_id, starts_at);
create index sessions_guest_date on public.sessions(guest_id, starts_at);
create table public.session_notes (
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notes jsonb not null default '{}' check (jsonb_typeof(notes) = 'object' and octet_length(notes::text) <= 100000),
  primary key (session_id, user_id)
);
create table public.stories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 150),
  competency text not null check (competency in ('Teamwork','Leadership','Conflict','Ownership','Adaptability','Communication')),
  situation text not null default '' check(length(situation) <= 10000),
  task text not null default '' check(length(task) <= 10000),
  action text not null default '' check(length(action) <= 10000),
  result text not null default '' check(length(result) <= 10000),
  updated_at timestamptz not null default now()
);
create table public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null check(question_id ~ '^q-[1-6]-[1-7]$'), primary key(user_id, question_id)
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.sessions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  score integer not null check (score between 1 and 5),
  strength text not null check (length(trim(strength)) between 10 and 3000),
  improvement text not null check (length(trim(improvement)) between 10 and 3000),
  created_at timestamptz not null default now(), unique(session_id, reviewer_id), check(reviewer_id <> recipient_id)
);
create table public.product_feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(trim(title)) between 3 and 140),
  body text not null check(length(trim(body)) between 10 and 3000),
  status text not null default 'Submitted' check(status in ('Submitted','Reviewed','Planned','Shipped')),
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('confirmed','day_before','hour_before','feedback','cancelled','link_updated')),
  due_at timestamptz not null, delivery_key uuid not null default gen_random_uuid(), sent_at timestamptz, attempts integer not null default 0,
  leased_until timestamptz, failed boolean not null default false,
  unique(session_id,user_id,kind)
);

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.session_notes enable row level security;
alter table public.stories enable row level security;
alter table public.bookmarks enable row level security;
alter table public.reviews enable row level security;
alter table public.product_feedback enable row level security;
alter table public.notifications enable row level security;
revoke all on public.profiles, public.sessions, public.session_notes, public.stories, public.bookmarks, public.reviews, public.product_feedback, public.notifications from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.sessions, public.reviews to authenticated;
grant select, insert, update, delete on public.stories, public.bookmarks, public.session_notes to authenticated;
grant select, insert on public.product_feedback to authenticated;
grant all on public.profiles, public.sessions, public.session_notes, public.stories, public.bookmarks, public.reviews, public.product_feedback, public.notifications to service_role;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_create on public.profiles for insert to authenticated with check(id = auth.uid());
create policy profiles_edit on public.profiles for update to authenticated using(id = auth.uid()) with check(id = auth.uid());
create policy sessions_read on public.sessions for select to authenticated using(auth.uid() in (host_id,guest_id) or public.is_admin());
create policy notes_owner on public.session_notes for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid() and exists(select 1 from public.sessions s where s.id = session_id and auth.uid() in (s.host_id,s.guest_id)));
create policy stories_owner on public.stories for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy bookmarks_owner on public.bookmarks for all to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy reviews_read on public.reviews for select to authenticated using(auth.uid() in (reviewer_id,recipient_id));
create policy feedback_read on public.product_feedback for select to authenticated using(user_id = auth.uid() or public.is_admin());
create policy feedback_create on public.product_feedback for insert to authenticated with check(user_id = auth.uid() and status = 'Submitted');

create function public.create_match(p_host uuid, p_guest uuid, p_starts timestamptz, p_focus text, p_link text, p_questions text[]) returns uuid language plpgsql security definer set search_path = '' as $$
declare member public.profiles; session_id uuid; member_local timestamp; matched_count integer := 0;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  if p_host = p_guest or p_starts <= now() then raise exception 'Choose two different members and a future time.'; end if;
  if p_link <> '' and p_link !~ '^https://(meet\.google\.com|([a-zA-Z0-9-]+\.)?zoom\.us)/[^[:space:]]*$' then raise exception 'Use a valid Meet or Zoom link.'; end if;
  -- Stable row-lock order serializes competing approvals for either participant.
  for member in select * from public.profiles where id in (p_host,p_guest) order by id for update loop
    matched_count := matched_count + 1;
    member_local := p_starts at time zone member.timezone;
    if not member.onboarded then raise exception 'Both members must finish their profiles.'; end if;
    if not (to_char(member_local,'Dy-HH24:MI') = any(member.availability)) or extract(second from member_local) <> 0 then raise exception 'Choose a time within both members’ saved availability.'; end if;
    if to_char(date_trunc('week',member_local),'YYYY-MM-DD') = any(member.skip_weeks) then raise exception 'One member is skipping this week.'; end if;
    if exists(select 1 from public.sessions where status <> 'cancelled' and member.id in (host_id,guest_id) and starts_at < p_starts + interval '1 hour' and starts_at + interval '1 hour' > p_starts) then raise exception 'A member already has a session at that time.'; end if;
  end loop;
  if matched_count <> 2 then raise exception 'Both members must exist.'; end if;
  insert into public.sessions(host_id,guest_id,host_name,guest_name,host_role,guest_role,starts_at,focus,meeting_link,question_ids)
  select p_host,p_guest,h.name,g.name,h.role,g.role,p_starts,p_focus,p_link,p_questions from public.profiles h,public.profiles g where h.id=p_host and g.id=p_guest returning id into session_id;
  return session_id;
end;
$$;
create function public.update_session(p_session uuid, p_operation text, p_link text default '') returns void language plpgsql security definer set search_path = '' as $$
declare target public.sessions;
begin
  select * into target from public.sessions where id=p_session for update;
  if target.id is null or (auth.uid() is distinct from target.host_id and auth.uid() is distinct from target.guest_id and not public.is_admin()) then raise exception 'Session access denied.'; end if;
  if target.status <> 'upcoming' then raise exception 'This session is no longer upcoming.'; end if;
  if p_operation = 'cancel' then update public.sessions set status='cancelled' where id=p_session;
  elsif p_operation = 'link' then
    if p_link <> '' and p_link !~ '^https://(meet\.google\.com|([a-zA-Z0-9-]+\.)?zoom\.us)/[^[:space:]]*$' then raise exception 'Use a valid Meet or Zoom link.'; end if;
    update public.sessions set meeting_link=p_link where id=p_session;
  else raise exception 'Unknown session action.'; end if;
end;
$$;
create function public.submit_review(p_session uuid,p_score integer,p_strength text,p_improvement text) returns void language plpgsql security definer set search_path = '' as $$
declare target public.sessions; recipient uuid; author text;
begin
  select * into target from public.sessions where id=p_session for update;
  if target.id is null or auth.uid() is null or auth.uid() not in (target.host_id,target.guest_id) then raise exception 'Only session participants can leave feedback.'; end if;
  if target.status='cancelled' then raise exception 'This session was cancelled.'; end if;
  if target.starts_at > now() then raise exception 'You can submit feedback after the session starts.'; end if;
  recipient := case when auth.uid()=target.host_id then target.guest_id else target.host_id end;
  select name into author from public.profiles where id=auth.uid();
  insert into public.reviews(session_id,reviewer_id,recipient_id,author_name,score,strength,improvement) values(p_session,auth.uid(),recipient,author,p_score,p_strength,p_improvement)
  on conflict(session_id,reviewer_id) do update set score=excluded.score,strength=excluded.strength,improvement=excluded.improvement;
  update public.sessions set status='completed' where id=p_session;
end;
$$;

create function public.queue_session_notifications() returns trigger language plpgsql security definer set search_path = '' as $$
declare participant uuid;
begin
  foreach participant in array array[new.host_id,new.guest_id] loop
    if tg_op='INSERT' then
      insert into public.notifications(session_id,user_id,kind,due_at) values(new.id,participant,'confirmed',now()),(new.id,participant,'feedback',new.starts_at + interval '70 minutes');
      if new.starts_at - interval '24 hours' > now() then insert into public.notifications(session_id,user_id,kind,due_at) values(new.id,participant,'day_before',new.starts_at - interval '24 hours'); end if;
      if new.starts_at - interval '1 hour' > now() then insert into public.notifications(session_id,user_id,kind,due_at) values(new.id,participant,'hour_before',new.starts_at - interval '1 hour'); end if;
    elsif new.status='cancelled' and old.status<>'cancelled' then
      delete from public.notifications where session_id=new.id and user_id=participant and sent_at is null;
      insert into public.notifications(session_id,user_id,kind,due_at) values(new.id,participant,'cancelled',now()) on conflict do nothing;
    elsif new.meeting_link is distinct from old.meeting_link then
      insert into public.notifications(session_id,user_id,kind,due_at) values(new.id,participant,'link_updated',now())
      on conflict(session_id,user_id,kind) do update set due_at=now(),delivery_key=gen_random_uuid(),sent_at=null,attempts=0,failed=false;
    end if;
  end loop;
  return new;
end;
$$;
create trigger session_notifications after insert or update on public.sessions for each row execute function public.queue_session_notifications();

create function public.claim_notifications() returns setof public.notifications language sql security definer set search_path = '' as $$
  update public.notifications set leased_until=now()+interval '5 minutes', attempts=attempts+1
  where id in (select id from public.notifications where due_at<=now() and sent_at is null and not failed and attempts<5 and (leased_until is null or leased_until<now()) order by due_at for update skip locked limit 5)
  returning *;
$$;
revoke all on function public.create_match(uuid,uuid,timestamptz,text,text,text[]), public.update_session(uuid,text,text), public.submit_review(uuid,integer,text,text), public.claim_notifications(), public.queue_session_notifications(), public.validate_profile() from public;
grant execute on function public.create_match(uuid,uuid,timestamptz,text,text,text[]), public.update_session(uuid,text,text), public.submit_review(uuid,integer,text,text) to authenticated;
grant execute on function public.claim_notifications() to service_role;
commit;
