-- Number Duel v5 security hardening.
-- Apply after supabase-setup.sql and patches v3/v4.

create extension if not exists pgcrypto;

alter table public.nd_rooms add column if not exists p1_token_hash bytea;
alter table public.nd_rooms add column if not exists p2_token_hash bytea;
alter table public.nd_rooms add column if not exists timer_seconds int not null default 0;
alter table public.nd_rooms add column if not exists turn_deadline timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'nd_rooms_timer_seconds_check'
  ) then
    alter table public.nd_rooms add constraint nd_rooms_timer_seconds_check
      check (timer_seconds in (0, 30, 45, 60));
  end if;
end $$;

-- Game data is available only through authenticated capability RPCs.
drop policy if exists nd_rooms_select on public.nd_rooms;
create policy nd_rooms_deny_direct on public.nd_rooms for all using (false) with check (false);
drop policy if exists nd_chat_select on public.nd_chat;
create policy nd_chat_deny_direct on public.nd_chat for all using (false) with check (false);
revoke all on public.nd_rooms, public.nd_secrets, public.nd_chat from anon, authenticated;

create table if not exists public.nd_rate_limits (
  bucket text not null,
  client_key text not null,
  window_start timestamptz not null,
  hits int not null,
  primary key (bucket, client_key)
);
create index if not exists nd_rate_limits_window_idx on public.nd_rate_limits(window_start);
alter table public.nd_rate_limits enable row level security;
revoke all on public.nd_rate_limits from public, anon, authenticated;

create or replace function public.nd_request_key()
returns text language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
begin
  return encode(digest(coalesce(claims->>'sub', headers->>'x-forwarded-for', headers->>'user-agent', 'unknown'), 'sha256'), 'hex');
end;
$$;

create or replace function public.nd_take_rate_limit(
  p_bucket text, p_key text, p_max int, p_window_seconds int
) returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  v_row public.nd_rate_limits%rowtype;
begin
  select * into v_row from public.nd_rate_limits
  where bucket = p_bucket and client_key = p_key for update;
  if not found or v_row.window_start <= now() - make_interval(secs => p_window_seconds) then
    insert into public.nd_rate_limits(bucket, client_key, window_start, hits)
    values (p_bucket, p_key, now(), 1)
    on conflict (bucket, client_key) do update set window_start = now(), hits = 1;
    return true;
  end if;
  if v_row.hits >= p_max then return false; end if;
  update public.nd_rate_limits set hits = hits + 1
  where bucket = p_bucket and client_key = p_key;
  return true;
end;
$$;

create or replace function public.nd_player_ok(
  p_code text, p_player_id uuid, p_player_token text
) returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.nd_rooms r
    where r.code = upper(trim(p_code))
      and (
        (r.p1_id = p_player_id and r.p1_token_hash = digest(coalesce(p_player_token, ''), 'sha256'))
        or
        (r.p2_id = p_player_id and r.p2_token_hash = digest(coalesce(p_player_token, ''), 'sha256'))
      )
  );
$$;

create or replace function public.nd_sync_timer(p_code text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare r public.nd_rooms%rowtype; v_next uuid;
begin
  select * into r from public.nd_rooms where code = upper(trim(p_code)) for update;
  if not found or r.status <> 'playing' or r.timer_seconds = 0
     or r.turn_deadline is null or r.turn_deadline > now() then return; end if;
  v_next := case when r.turn = r.p1_id then r.p2_id else r.p1_id end;
  update public.nd_rooms set turn = v_next,
    turn_deadline = now() + make_interval(secs => r.timer_seconds), updated_at = now()
  where code = r.code;
end;
$$;

create or replace function public.nd_public_room(
  p_code text, p_player_id uuid, p_player_token text
) returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r public.nd_rooms%rowtype; my_secret text; opp_secret text; my_guesses jsonb;
  my_hint boolean; opp_id uuid; opp_seen timestamptz; away numeric; presence text;
begin
  if not public.nd_player_ok(p_code, p_player_id, p_player_token) then
    raise exception 'جلسة اللاعب غير صالحة';
  end if;
  select * into r from public.nd_rooms where code = upper(trim(p_code));
  opp_id := case when p_player_id = r.p1_id then r.p2_id else r.p1_id end;
  my_hint := case when p_player_id = r.p1_id then r.p1_hint_used else r.p2_hint_used end;
  opp_seen := case when p_player_id = r.p1_id then r.p2_last_seen else r.p1_last_seen end;
  if opp_id is null then presence := 'none';
  elsif r.left_by = opp_id then presence := 'left';
  elsif opp_seen is null then presence := 'unknown';
  elsif extract(epoch from (now() - opp_seen)) < 12 then presence := 'online';
  elsif extract(epoch from (now() - opp_seen)) < 35 then presence := 'slow';
  else presence := 'offline'; end if;
  away := coalesce(extract(epoch from (now() - opp_seen)), 0);
  select secret into my_secret from public.nd_secrets
    where room_code = r.code and player_id = p_player_id;
  if r.status = 'finished' and opp_id is not null then
    select secret into opp_secret from public.nd_secrets
      where room_code = r.code and player_id = opp_id;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'guess', g->>'guess', 'correctPositions', (g->>'correctPositions')::int
  ) order by ord), '[]'::jsonb) into my_guesses
  from jsonb_array_elements(r.guesses) with ordinality as t(g, ord)
  where (g->>'by')::uuid = p_player_id;
  return jsonb_build_object(
    'code', r.code, 'status', r.status, 'turn', r.turn, 'winner', r.winner,
    'digitCount', r.digit_count, 'timerSeconds', r.timer_seconds,
    'secondsLeft', case when r.timer_seconds > 0 and r.turn_deadline is not null
      then greatest(0, ceil(extract(epoch from (r.turn_deadline - now())))::int) else null end,
    'hintUsed', coalesce(my_hint, false), 'vsAi', false,
    'turnNumber', greatest(1, (jsonb_array_length(r.guesses) / 2) + 1),
    'myGuessCount', jsonb_array_length(my_guesses), 'mySecret', my_secret,
    'opponentSecret', opp_secret, 'opponentPresence', presence,
    'opponentAwaySec', away, 'guesses', my_guesses,
    'players', jsonb_build_array(
      jsonb_build_object('id', r.p1_id, 'name', r.p1_name, 'ready', r.p1_ready,
        'isYou', r.p1_id = p_player_id,
        'hasSecret', exists(select 1 from public.nd_secrets s where s.room_code=r.code and s.player_id=r.p1_id))
    ) || case when r.p2_id is null then '[]'::jsonb else jsonb_build_array(
      jsonb_build_object('id', r.p2_id, 'name', r.p2_name, 'ready', r.p2_ready,
        'isYou', r.p2_id = p_player_id,
        'hasSecret', exists(select 1 from public.nd_secrets s where s.room_code=r.code and s.player_id=r.p2_id))
    ) end
  );
end;
$$;

create or replace function public.nd_create_room(
  p_name text, p_digit_count int default 4, p_timer_seconds int default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_code text; v_player uuid := gen_random_uuid(); v_token text := encode(gen_random_bytes(32),'hex');
  v_name text := left(trim(coalesce(nullif(p_name,''),'لاعب 1')),20);
begin
  if p_digit_count not in (3,4,5) or p_timer_seconds not in (0,30,45,60) then
    return jsonb_build_object('ok',false,'error','إعدادات المباراة غير صالحة'); end if;
  if not public.nd_take_rate_limit('create', public.nd_request_key(), 12, 60) then
    return jsonb_build_object('ok',false,'error','محاولات كثيرة، انتظر دقيقة'); end if;
  delete from public.nd_rate_limits where window_start < now()-interval '1 day';
  delete from public.nd_rooms where (status='waiting' and updated_at < now()-interval '30 minutes')
    or (status='finished' and updated_at < now()-interval '24 hours');
  v_code := public.nd_gen_code();
  insert into public.nd_rooms(code,status,p1_id,p1_name,digit_count,timer_seconds,p1_last_seen,p1_token_hash)
  values(v_code,'waiting',v_player,v_name,p_digit_count,p_timer_seconds,now(),digest(v_token,'sha256'));
  return jsonb_build_object('ok',true,'playerId',v_player,'playerToken',v_token,
    'room',public.nd_public_room(v_code,v_player,v_token));
end;
$$;

create or replace function public.nd_join_room(p_code text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.nd_rooms%rowtype; v_code text:=upper(trim(p_code)); v_player uuid:=gen_random_uuid();
  v_token text:=encode(gen_random_bytes(32),'hex'); v_name text:=left(trim(coalesce(nullif(p_name,''),'لاعب 2')),20);
begin
  if not public.nd_take_rate_limit('join', public.nd_request_key(), 30, 60) then
    return jsonb_build_object('ok',false,'error','محاولات كثيرة، انتظر دقيقة'); end if;
  select * into r from public.nd_rooms where code=v_code for update;
  if not found then return jsonb_build_object('ok',false,'error','الغرفة غير موجودة'); end if;
  if r.p2_id is not null or r.status<>'waiting' then return jsonb_build_object('ok',false,'error','الغرفة غير متاحة'); end if;
  update public.nd_rooms set p2_id=v_player,p2_name=v_name,p2_token_hash=digest(v_token,'sha256'),
    p2_last_seen=now(),status='setup',left_by=null,updated_at=now() where code=v_code;
  return jsonb_build_object('ok',true,'playerId',v_player,'playerToken',v_token,
    'room',public.nd_public_room(v_code,v_player,v_token));
end;
$$;

create or replace function public.nd_random_match(p_name text, p_digit_count int, p_timer_seconds int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select code into v_code from public.nd_rooms where status='waiting' and p2_id is null
    and digit_count=p_digit_count and timer_seconds=p_timer_seconds
    order by created_at for update skip locked limit 1;
  if v_code is not null then return public.nd_join_room(v_code,p_name); end if;
  return public.nd_create_room(p_name,p_digit_count,p_timer_seconds);
end;
$$;

create or replace function public.nd_set_secret(p_code text,p_player_id uuid,p_player_token text,p_secret text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype; both_ready boolean;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  select * into r from public.nd_rooms where code=upper(trim(p_code)) for update;
  if r.status not in ('waiting','setup') or not public.nd_valid_digits(p_secret,r.digit_count) then
    return jsonb_build_object('ok',false,'error','لا يمكن تثبيت هذا الرقم الآن'); end if;
  insert into public.nd_secrets(room_code,player_id,secret) values(r.code,p_player_id,p_secret)
    on conflict(room_code,player_id) do update set secret=excluded.secret;
  if p_player_id=r.p1_id then update public.nd_rooms set p1_ready=true,status='setup',updated_at=now() where code=r.code;
  else update public.nd_rooms set p2_ready=true,status='setup',updated_at=now() where code=r.code; end if;
  select p1_ready and p2_ready into both_ready from public.nd_rooms where code=r.code;
  if both_ready then update public.nd_rooms set status='playing',turn=case when random()<.5 then p1_id else p2_id end,
    turn_deadline=case when timer_seconds>0 then now()+make_interval(secs=>timer_seconds) end,updated_at=now() where code=r.code; end if;
  return jsonb_build_object('ok',true,'room',public.nd_public_room(r.code,p_player_id,p_player_token));
end;
$$;

create or replace function public.nd_guess(p_code text,p_player_id uuid,p_player_token text,p_guess text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype; opp_id uuid; opp_secret text; correct int:=0; i int;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  perform public.nd_sync_timer(p_code);
  select * into r from public.nd_rooms where code=upper(trim(p_code)) for update;
  if r.status<>'playing' or r.turn is distinct from p_player_id then return jsonb_build_object('ok',false,'error','مو دورك'); end if;
  if not public.nd_valid_number(p_guess,r.digit_count) then return jsonb_build_object('ok',false,'error','التخمين غير صالح'); end if;
  opp_id:=case when p_player_id=r.p1_id then r.p2_id else r.p1_id end;
  select secret into opp_secret from public.nd_secrets where room_code=r.code and player_id=opp_id;
  for i in 1..r.digit_count loop if substr(p_guess,i,1)=substr(opp_secret,i,1) then correct:=correct+1; end if; end loop;
  update public.nd_rooms set guesses=guesses||jsonb_build_array(jsonb_build_object('by',p_player_id,'guess',p_guess,'correctPositions',correct)),
    status=case when correct=r.digit_count then 'finished' else status end,
    winner=case when correct=r.digit_count then p_player_id else winner end,
    turn=case when correct=r.digit_count then null else opp_id end,
    turn_deadline=case when correct=r.digit_count or timer_seconds=0 then null else now()+make_interval(secs=>timer_seconds) end,
    updated_at=now() where code=r.code;
  return jsonb_build_object('ok',true,'correctPositions',correct,'won',correct=r.digit_count,
    'room',public.nd_public_room(r.code,p_player_id,p_player_token));
end;
$$;

create or replace function public.nd_get_room(p_code text,p_player_id uuid,p_player_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  perform public.nd_sync_timer(p_code);
  return jsonb_build_object('ok',true,'room',public.nd_public_room(p_code,p_player_id,p_player_token));
end;
$$;

create or replace function public.nd_heartbeat(p_code text,p_player_id uuid,p_player_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  perform public.nd_sync_timer(p_code); select * into r from public.nd_rooms where code=upper(trim(p_code));
  if p_player_id=r.p1_id then update public.nd_rooms set p1_last_seen=now() where code=r.code;
  else update public.nd_rooms set p2_last_seen=now() where code=r.code; end if;
  return jsonb_build_object('ok',true,'room',public.nd_public_room(r.code,p_player_id,p_player_token));
end;
$$;

create or replace function public.nd_use_hint(p_code text,p_player_id uuid,p_player_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype; last_guess jsonb; positions int[]:='{}'; pick int; i int; v_guess text; used boolean; opp uuid;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  select * into r from public.nd_rooms where code=upper(trim(p_code)) for update;
  if r.status<>'playing' then return jsonb_build_object('ok',false,'error','التلميح وقت اللعب فقط'); end if;
  used:=case when p_player_id=r.p1_id then r.p1_hint_used else r.p2_hint_used end;
  if used then return jsonb_build_object('ok',false,'error','استخدمت التلميح مسبقاً'); end if;
  select elem into last_guess from jsonb_array_elements(r.guesses) with ordinality t(elem,ord)
    where (elem->>'by')::uuid=p_player_id order by ord desc limit 1;
  if last_guess is null or coalesce((last_guess->>'correctPositions')::int,0)<1 then
    return jsonb_build_object('ok',false,'error','تحتاج تخميناً فيه خانة صحيحة أولاً'); end if;
  v_guess:=last_guess->>'guess'; opp:=case when p_player_id=r.p1_id then r.p2_id else r.p1_id end;
  for i in 1..r.digit_count loop if substr(v_guess,i,1)=(select substr(secret,i,1) from public.nd_secrets where room_code=r.code and player_id=opp)
    then positions:=array_append(positions,i); end if; end loop;
  pick:=positions[1+floor(random()*array_length(positions,1))::int];
  if p_player_id=r.p1_id then update public.nd_rooms set p1_hint_used=true where code=r.code;
  else update public.nd_rooms set p2_hint_used=true where code=r.code; end if;
  return jsonb_build_object('ok',true,'hintPosition',pick,'message','الخانة رقم '||pick||' من آخر تخمينك صحيحة',
    'room',public.nd_public_room(r.code,p_player_id,p_player_token));
end;
$$;

create or replace function public.nd_rematch(p_code text,p_player_id uuid,p_player_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  select * into r from public.nd_rooms where code=upper(trim(p_code)) for update;
  if r.status <> 'finished' then return jsonb_build_object('ok',false,'error','إعادة اللعب متاحة بعد انتهاء المباراة'); end if;
  if r.p2_id is null then return jsonb_build_object('ok',false,'error','تحتاج خصم'); end if;
  delete from public.nd_secrets where room_code=r.code;
  update public.nd_rooms set status='setup',turn=null,winner=null,guesses='[]',p1_ready=false,p2_ready=false,
    p1_hint_used=false,p2_hint_used=false,turn_deadline=null,updated_at=now() where code=r.code;
  return jsonb_build_object('ok',true,'room',public.nd_public_room(r.code,p_player_id,p_player_token));
end;
$$;

create or replace function public.nd_leave_room(p_code text,p_player_id uuid,p_player_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',true); end if;
  select * into r from public.nd_rooms where code=upper(trim(p_code)) for update;
  if r.p2_id is null then delete from public.nd_rooms where code=r.code; return jsonb_build_object('ok',true); end if;
  delete from public.nd_secrets where room_code=r.code;
  if p_player_id=r.p1_id then update public.nd_rooms set p1_id=r.p2_id,p1_name=r.p2_name,p1_token_hash=r.p2_token_hash,
    p1_last_seen=r.p2_last_seen,p2_id=null,p2_name=null,p2_token_hash=null,p2_last_seen=null,status='waiting',
    turn=null,winner=null,guesses='[]',p1_ready=false,p2_ready=false,p1_hint_used=false,p2_hint_used=false,
    turn_deadline=null,left_by=p_player_id,updated_at=now() where code=r.code;
  else update public.nd_rooms set p2_id=null,p2_name=null,p2_token_hash=null,p2_last_seen=null,status='waiting',
    turn=null,winner=null,guesses='[]',p1_ready=false,p2_ready=false,p1_hint_used=false,p2_hint_used=false,
    turn_deadline=null,left_by=p_player_id,updated_at=now() where code=r.code; end if;
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.nd_send_chat(p_code text,p_player_id uuid,p_player_token text,p_body text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype; v_body text:=trim(p_body); v_msg public.nd_chat%rowtype; v_name text;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  if v_body is null or char_length(v_body) not between 1 and 200 then return jsonb_build_object('ok',false,'error','الرسالة غير صالحة'); end if;
  if not public.nd_take_rate_limit('chat',encode(digest(p_player_token,'sha256'),'hex'),6,10) then
    return jsonb_build_object('ok',false,'error','أرسلت رسائل كثيرة، تمهّل قليلاً'); end if;
  select * into r from public.nd_rooms where code=upper(trim(p_code));
  v_name:=case when p_player_id=r.p1_id then r.p1_name else r.p2_name end;
  insert into public.nd_chat(room_code,player_id,player_name,body) values(r.code,p_player_id,v_name,v_body) returning * into v_msg;
  return jsonb_build_object('ok',true,'message',jsonb_build_object('id',v_msg.id,'playerId',v_msg.player_id,
    'playerName',v_msg.player_name,'body',v_msg.body,'createdAt',v_msg.created_at));
end;
$$;

create or replace function public.nd_list_chat(p_code text,p_player_id uuid,p_player_token text,p_limit int default 80)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_msgs jsonb; v_limit int:=least(greatest(coalesce(p_limit,80),1),120);
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  select coalesce(jsonb_agg(m order by (m->>'id')::bigint),'[]') into v_msgs from (
    select jsonb_build_object('id',id,'playerId',player_id,'playerName',player_name,'body',body,'createdAt',created_at) m
    from public.nd_chat where room_code=upper(trim(p_code)) order by id desc limit v_limit
  ) q;
  return jsonb_build_object('ok',true,'messages',v_msgs);
end;
$$;

-- Remove access to every legacy RPC that trusted a public player UUID.
revoke execute on function public.nd_public_room(text,uuid) from public,anon,authenticated;
revoke execute on function public.nd_set_secret(text,uuid,text) from public,anon,authenticated;
revoke execute on function public.nd_guess(text,uuid,text) from public,anon,authenticated;
revoke execute on function public.nd_use_hint(text,uuid) from public,anon,authenticated;
revoke execute on function public.nd_rematch(text,uuid) from public,anon,authenticated;
revoke execute on function public.nd_get_room(text,uuid) from public,anon,authenticated;
revoke execute on function public.nd_heartbeat(text,uuid) from public,anon,authenticated;
revoke execute on function public.nd_leave_room(text,uuid) from public,anon,authenticated;
revoke execute on function public.nd_skip_turn(text,uuid) from public,anon,authenticated;
revoke execute on function public.nd_send_chat(text,uuid,text) from public,anon,authenticated;
revoke execute on function public.nd_list_chat(text,uuid,int) from public,anon,authenticated;
revoke execute on function public.nd_create_room(text,int) from public,anon,authenticated;

revoke execute on function public.nd_request_key() from public,anon,authenticated;
revoke execute on function public.nd_take_rate_limit(text,text,int,int) from public,anon,authenticated;
revoke execute on function public.nd_player_ok(text,uuid,text) from public,anon,authenticated;
revoke execute on function public.nd_sync_timer(text) from public,anon,authenticated;
revoke execute on function public.nd_public_room(text,uuid,text) from public,anon,authenticated;

grant execute on function public.nd_create_room(text,int,int) to anon,authenticated;
grant execute on function public.nd_join_room(text,text) to anon,authenticated;
grant execute on function public.nd_random_match(text,int,int) to anon,authenticated;
grant execute on function public.nd_set_secret(text,uuid,text,text) to anon,authenticated;
grant execute on function public.nd_guess(text,uuid,text,text) to anon,authenticated;
grant execute on function public.nd_use_hint(text,uuid,text) to anon,authenticated;
grant execute on function public.nd_rematch(text,uuid,text) to anon,authenticated;
grant execute on function public.nd_get_room(text,uuid,text) to anon,authenticated;
grant execute on function public.nd_heartbeat(text,uuid,text) to anon,authenticated;
grant execute on function public.nd_leave_room(text,uuid,text) to anon,authenticated;
grant execute on function public.nd_send_chat(text,uuid,text,text) to anon,authenticated;
grant execute on function public.nd_list_chat(text,uuid,text,int) to anon,authenticated;

notify pgrst, 'reload schema';
