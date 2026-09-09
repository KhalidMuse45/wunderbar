-- Apply after 001_mvp.sql. Existing availability and recorded outcomes are preserved.
begin;
alter table public.profiles drop constraint profiles_availability_check;
alter table public.profiles add constraint profiles_availability_check check (cardinality(availability) <= 672);
alter table public.sessions drop constraint sessions_status_check;
alter table public.sessions add constraint sessions_status_check check(status in ('upcoming','completed','cancelled','no_show'));
alter table public.sessions add column outcome_recorded_at timestamptz;
alter table public.sessions add column outcome_recorded_by uuid references auth.users(id) on delete set null;
create or replace function public.validate_profile() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then raise exception 'Choose a valid timezone.'; end if;
  if exists(select 1 from unnest(new.availability) slot where slot !~ '^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-([01][0-9]|2[0-3]):(00|15|30|45)$') then raise exception 'Choose valid availability slots.'; end if;
  if exists(select 1 from unnest(new.skip_weeks) week where week !~ '^\d{4}-\d{2}-\d{2}$') then raise exception 'Choose valid weeks to skip.'; end if;
  return new;
end;
$$;
create or replace function public.create_match(p_host uuid, p_guest uuid, p_starts timestamptz, p_focus text, p_link text, p_questions text[]) returns uuid language plpgsql security definer set search_path = '' as $$
declare member public.profiles; session_id uuid; member_local timestamp; matched_count integer := 0;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  if p_host = p_guest or p_starts <= now() then raise exception 'Choose two different members and a future time.'; end if;
  if p_link <> '' and p_link !~ '^https://(meet\.google\.com|([a-zA-Z0-9-]+\.)?zoom\.us)/[^[:space:]]*$' then raise exception 'Use a valid Meet or Zoom link.'; end if;
  -- Stable row-lock order serializes competing approvals for either participant.
  for member in select * from public.profiles where id in (p_host,p_guest) order by id for update loop
    matched_count := matched_count + 1;
    member_local := p_starts at time zone member.timezone;
    if exists(select 1 from unnest(array[-120,-60,-30,30,60,120]) minutes where (p_starts + minutes * interval '1 minute') at time zone member.timezone = member_local) then raise exception 'Choose a time within both members’ saved availability.'; end if;
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
create or replace function public.update_session(p_session uuid, p_operation text, p_link text default '') returns void language plpgsql security definer set search_path = '' as $$
declare target public.sessions;
begin
  select * into target from public.sessions where id=p_session for update;
  if target.id is null or (auth.uid() is distinct from target.host_id and auth.uid() is distinct from target.guest_id and not public.is_admin()) then raise exception 'Session access denied.'; end if;
  if target.status <> 'upcoming' then raise exception 'This session is no longer upcoming.'; end if;
  if target.starts_at + interval '1 hour' <= now() then raise exception 'This session has ended. Record its outcome.'; end if;
  if p_operation = 'cancel' then update public.sessions set status='cancelled' where id=p_session;
  elsif p_operation = 'link' then
    if p_link <> '' and p_link !~ '^https://(meet\.google\.com|([a-zA-Z0-9-]+\.)?zoom\.us)/[^[:space:]]*$' then raise exception 'Use a valid Meet or Zoom link.'; end if;
    update public.sessions set meeting_link=p_link where id=p_session;
  else raise exception 'Unknown session action.'; end if;
end;
$$;

create function public.record_session_outcome(p_session uuid, p_outcome text) returns void language plpgsql security definer set search_path = '' as $$
declare target public.sessions;
begin
  select * into target from public.sessions where id=p_session for update;
  if target.id is null or auth.uid() is null or (auth.uid() not in (target.host_id,target.guest_id) and not public.is_admin()) then raise exception 'Session access denied.'; end if;
  if p_outcome is null or p_outcome not in ('completed','no_show') then raise exception 'Choose a valid outcome.'; end if;
  if target.status='cancelled' then raise exception 'This session was cancelled.'; end if;
  if target.starts_at + interval '1 hour' > now() then raise exception 'You can record the outcome after the scheduled hour ends.'; end if;
  if target.status=p_outcome then return; end if;
  if target.status <> 'upcoming' then raise exception 'This session already has a different outcome.'; end if;
  update public.sessions set status=p_outcome,outcome_recorded_at=now(),outcome_recorded_by=auth.uid() where id=p_session;
end;
$$;
revoke all on function public.record_session_outcome(uuid,text) from public;
grant execute on function public.record_session_outcome(uuid,text) to authenticated;
create or replace function public.submit_review(p_session uuid,p_score integer,p_strength text,p_improvement text) returns void language plpgsql security definer set search_path = '' as $$
declare target public.sessions; recipient uuid; author text;
begin
  select * into target from public.sessions where id=p_session for update;
  if target.id is null or auth.uid() is null or auth.uid() not in (target.host_id,target.guest_id) then raise exception 'Only session participants can leave feedback.'; end if;
  if target.status='cancelled' then raise exception 'This session was cancelled.'; end if;
  if target.status <> 'completed' then raise exception 'Record a completed session before leaving feedback.'; end if;
  recipient := case when auth.uid()=target.host_id then target.guest_id else target.host_id end;
  select name into author from public.profiles where id=auth.uid();
  insert into public.reviews(session_id,reviewer_id,recipient_id,author_name,score,strength,improvement) values(p_session,auth.uid(),recipient,author,p_score,p_strength,p_improvement)
  on conflict(session_id,reviewer_id) do update set score=excluded.score,strength=excluded.strength,improvement=excluded.improvement;
end;
$$;

create or replace function public.queue_session_notifications() returns trigger language plpgsql security definer set search_path = '' as $$
declare participant uuid;
begin
  foreach participant in array array[new.host_id,new.guest_id] loop
    if tg_op='INSERT' then
      insert into public.notifications(session_id,user_id,kind,due_at) values(new.id,participant,'confirmed',now()),(new.id,participant,'feedback',new.starts_at + interval '70 minutes');
      if new.starts_at - interval '24 hours' > now() then insert into public.notifications(session_id,user_id,kind,due_at) values(new.id,participant,'day_before',new.starts_at - interval '24 hours'); end if;
      if new.starts_at - interval '1 hour' > now() then insert into public.notifications(session_id,user_id,kind,due_at) values(new.id,participant,'hour_before',new.starts_at - interval '1 hour'); end if;
    elsif new.status='no_show' and old.status<>'no_show' then
      delete from public.notifications where session_id=new.id and user_id=participant and sent_at is null;
    elsif new.status='completed' and old.status<>'completed' then
      delete from public.notifications where session_id=new.id and user_id=participant and sent_at is null and kind in ('day_before','hour_before');
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
commit;
