-- Number Duel v6: game modes, 3-6 digits, repeat rules, attempts, scores and varied hints.
-- Apply after supabase-patch-v5.sql.

alter table public.nd_rooms drop constraint if exists nd_rooms_digit_count_check;
alter table public.nd_rooms add constraint nd_rooms_digit_count_check check (digit_count in (3,4,5,6));
alter table public.nd_rooms drop constraint if exists nd_rooms_timer_seconds_check;
alter table public.nd_rooms add constraint nd_rooms_timer_seconds_check check (timer_seconds in (0,20,30,45,60));

alter table public.nd_rooms add column if not exists game_mode text not null default 'normal';
alter table public.nd_rooms add column if not exists allow_repeats boolean not null default true;
alter table public.nd_rooms add column if not exists max_attempts int not null default 12;
alter table public.nd_rooms add column if not exists hint_limit int not null default 3;
alter table public.nd_rooms add column if not exists p1_hints_used int not null default 0;
alter table public.nd_rooms add column if not exists p2_hints_used int not null default 0;
alter table public.nd_rooms add column if not exists started_at timestamptz;
alter table public.nd_rooms add column if not exists p1_score int not null default 0;
alter table public.nd_rooms add column if not exists p2_score int not null default 0;

alter table public.nd_rooms drop constraint if exists nd_rooms_game_mode_check;
alter table public.nd_rooms add constraint nd_rooms_game_mode_check check (game_mode in ('normal','quick','expert','one-shot'));
alter table public.nd_rooms drop constraint if exists nd_rooms_attempts_check;
alter table public.nd_rooms add constraint nd_rooms_attempts_check check (max_attempts between 1 and 20);
alter table public.nd_rooms drop constraint if exists nd_rooms_hint_limit_check;
alter table public.nd_rooms add constraint nd_rooms_hint_limit_check check (hint_limit between 0 and 5);

create or replace function public.nd_rule_number(p_value text, p_length int, p_allow_repeats boolean, p_is_guess boolean)
returns boolean language sql immutable security definer set search_path=public as $$
  select p_value ~ ('^[0-9]{' || p_length || '}$')
    and (p_allow_repeats or p_length = (select count(distinct substr(p_value,i,1)) from generate_series(1,p_length) i))
    and (not p_is_guess or p_value <> repeat(substr(p_value,1,1),p_length));
$$;

create or replace function public.nd_score(p_digits int,p_mode text,p_attempts int,p_max int,p_seconds int,p_hints int)
returns int language sql immutable security definer set search_path=public as $$
  select greatest(100, round((p_digits*1000 + greatest(0,p_max-p_attempts)*140 + greatest(0,900-p_seconds*6) - p_hints*180)
    * case p_mode when 'quick' then 1.25 when 'expert' then 1.6 when 'one-shot' then 2.4 else 1 end)::int);
$$;

create or replace function public.nd_sync_timer(p_code text)
returns void language plpgsql volatile security definer set search_path=public as $$
declare r public.nd_rooms%rowtype; v_next uuid; v_next_count int;
begin
  select * into r from public.nd_rooms where code=upper(trim(p_code)) for update;
  if not found or r.status<>'playing' or r.timer_seconds=0 or r.turn_deadline is null or r.turn_deadline>now() then return; end if;
  v_next:=case when r.turn=r.p1_id then r.p2_id else r.p1_id end;
  select count(*) into v_next_count from jsonb_array_elements(r.guesses) g where (g->>'by')::uuid=v_next;
  if v_next_count>=r.max_attempts then v_next:=r.turn; end if;
  update public.nd_rooms set turn=v_next,turn_deadline=now()+make_interval(secs=>r.timer_seconds),updated_at=now() where code=r.code;
end; $$;

create or replace function public.nd_public_room(p_code text,p_player_id uuid,p_player_token text)
returns jsonb language plpgsql volatile security definer set search_path=public as $$
declare r public.nd_rooms%rowtype; my_secret text; opp_secret text; my_guesses jsonb;
  my_hints int; my_score int; opp_id uuid; opp_seen timestamptz; away numeric; presence text;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then raise exception 'جلسة اللاعب غير صالحة'; end if;
  select * into r from public.nd_rooms where code=upper(trim(p_code));
  opp_id:=case when p_player_id=r.p1_id then r.p2_id else r.p1_id end;
  my_hints:=case when p_player_id=r.p1_id then r.p1_hints_used else r.p2_hints_used end;
  my_score:=case when p_player_id=r.p1_id then r.p1_score else r.p2_score end;
  opp_seen:=case when p_player_id=r.p1_id then r.p2_last_seen else r.p1_last_seen end;
  if opp_id is null then presence:='none'; elsif r.left_by=opp_id then presence:='left';
  elsif opp_seen is null then presence:='unknown'; elsif extract(epoch from(now()-opp_seen))<12 then presence:='online';
  elsif extract(epoch from(now()-opp_seen))<35 then presence:='slow'; else presence:='offline'; end if;
  away:=coalesce(extract(epoch from(now()-opp_seen)),0);
  select secret into my_secret from public.nd_secrets where room_code=r.code and player_id=p_player_id;
  if r.status='finished' and opp_id is not null then select secret into opp_secret from public.nd_secrets where room_code=r.code and player_id=opp_id; end if;
  select coalesce(jsonb_agg(jsonb_build_object('guess',g->>'guess','correctPositions',(g->>'correctPositions')::int) order by ord),'[]') into my_guesses
    from jsonb_array_elements(r.guesses) with ordinality t(g,ord) where (g->>'by')::uuid=p_player_id;
  return jsonb_build_object(
    'code',r.code,'status',r.status,'turn',r.turn,'winner',r.winner,'digitCount',r.digit_count,
    'timerSeconds',r.timer_seconds,'gameMode',r.game_mode,'allowRepeats',r.allow_repeats,
    'maxAttempts',r.max_attempts,'hintLimit',r.hint_limit,'hintsUsed',my_hints,'score',my_score,'startedAt',r.started_at,
    'secondsLeft',case when r.timer_seconds>0 and r.turn_deadline is not null then greatest(0,ceil(extract(epoch from(r.turn_deadline-now())))::int) end,
    'turnNumber',greatest(1,(jsonb_array_length(r.guesses)/2)+1),'myGuessCount',jsonb_array_length(my_guesses),
    'mySecret',my_secret,'opponentSecret',opp_secret,'opponentPresence',presence,'opponentAwaySec',away,'guesses',my_guesses,
    'players',jsonb_build_array(jsonb_build_object('id',r.p1_id,'name',r.p1_name,'ready',r.p1_ready,'isYou',r.p1_id=p_player_id,
      'hasSecret',exists(select 1 from public.nd_secrets s where s.room_code=r.code and s.player_id=r.p1_id)))
      || case when r.p2_id is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('id',r.p2_id,'name',r.p2_name,'ready',r.p2_ready,
      'isYou',r.p2_id=p_player_id,'hasSecret',exists(select 1 from public.nd_secrets s where s.room_code=r.code and s.player_id=r.p2_id))) end);
end; $$;

create or replace function public.nd_create_room(p_name text,p_digit_count int,p_timer_seconds int,p_game_mode text,p_allow_repeats boolean,p_max_attempts int,p_hint_limit int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_code text; v_player uuid:=gen_random_uuid(); v_token text:=encode(gen_random_bytes(32),'hex');
  v_name text:=left(trim(coalesce(nullif(p_name,''),'لاعب 1')),20);
begin
  if p_digit_count not in(3,4,5,6) or p_timer_seconds not in(0,20,30,45,60) or p_game_mode not in('normal','quick','expert','one-shot')
    or p_max_attempts not between 1 and 20 or p_hint_limit not between 0 and 5 then return jsonb_build_object('ok',false,'error','إعدادات المباراة غير صالحة'); end if;
  if not public.nd_take_rate_limit('create',public.nd_request_key(),12,60) then return jsonb_build_object('ok',false,'error','محاولات كثيرة، انتظر دقيقة'); end if;
  v_code:=public.nd_gen_code();
  insert into public.nd_rooms(code,status,p1_id,p1_name,digit_count,timer_seconds,game_mode,allow_repeats,max_attempts,hint_limit,p1_last_seen,p1_token_hash)
  values(v_code,'waiting',v_player,v_name,p_digit_count,p_timer_seconds,p_game_mode,p_allow_repeats,p_max_attempts,p_hint_limit,now(),digest(v_token,'sha256'));
  return jsonb_build_object('ok',true,'playerId',v_player,'playerToken',v_token,'room',public.nd_public_room(v_code,v_player,v_token));
end; $$;

create or replace function public.nd_random_match(p_name text,p_digit_count int,p_timer_seconds int,p_game_mode text,p_allow_repeats boolean,p_max_attempts int,p_hint_limit int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_code text;
begin
  select code into v_code from public.nd_rooms where status='waiting' and p2_id is null and digit_count=p_digit_count
    and timer_seconds=p_timer_seconds and game_mode=p_game_mode and allow_repeats=p_allow_repeats and max_attempts=p_max_attempts and hint_limit=p_hint_limit
    order by created_at for update skip locked limit 1;
  if v_code is not null then return public.nd_join_room(v_code,p_name); end if;
  return public.nd_create_room(p_name,p_digit_count,p_timer_seconds,p_game_mode,p_allow_repeats,p_max_attempts,p_hint_limit);
end; $$;

create or replace function public.nd_set_secret(p_code text,p_player_id uuid,p_player_token text,p_secret text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype; both_ready boolean;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  select * into r from public.nd_rooms where code=upper(trim(p_code)) for update;
  if r.status not in('waiting','setup') or not public.nd_rule_number(p_secret,r.digit_count,r.allow_repeats,false) then return jsonb_build_object('ok',false,'error','الرقم السري لا يطابق قواعد الغرفة'); end if;
  insert into public.nd_secrets(room_code,player_id,secret) values(r.code,p_player_id,p_secret) on conflict(room_code,player_id) do update set secret=excluded.secret;
  if p_player_id=r.p1_id then update public.nd_rooms set p1_ready=true,status='setup',updated_at=now() where code=r.code;
  else update public.nd_rooms set p2_ready=true,status='setup',updated_at=now() where code=r.code; end if;
  select p1_ready and p2_ready into both_ready from public.nd_rooms where code=r.code;
  if both_ready then update public.nd_rooms set status='playing',turn=case when random()<.5 then p1_id else p2_id end,started_at=now(),
    turn_deadline=case when timer_seconds>0 then now()+make_interval(secs=>timer_seconds) end,updated_at=now() where code=r.code; end if;
  return jsonb_build_object('ok',true,'room',public.nd_public_room(r.code,p_player_id,p_player_token));
end; $$;

create or replace function public.nd_guess(p_code text,p_player_id uuid,p_player_token text,p_guess text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype; opp_id uuid; opp_secret text; correct int:=0; i int; own_count int; opp_count int; next_own int;
  finished boolean:=false; v_winner uuid:=null; new_score int:=0;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  perform public.nd_sync_timer(p_code); select * into r from public.nd_rooms where code=upper(trim(p_code)) for update;
  if r.status<>'playing' or r.turn is distinct from p_player_id then return jsonb_build_object('ok',false,'error','مو دورك'); end if;
  if not public.nd_rule_number(p_guess,r.digit_count,r.allow_repeats,true) then return jsonb_build_object('ok',false,'error','التخمين لا يطابق قواعد الغرفة'); end if;
  opp_id:=case when p_player_id=r.p1_id then r.p2_id else r.p1_id end;
  select count(*) into own_count from jsonb_array_elements(r.guesses) g where (g->>'by')::uuid=p_player_id;
  select count(*) into opp_count from jsonb_array_elements(r.guesses) g where (g->>'by')::uuid=opp_id;
  if own_count>=r.max_attempts then return jsonb_build_object('ok',false,'error','انتهت محاولاتك'); end if;
  select secret into opp_secret from public.nd_secrets where room_code=r.code and player_id=opp_id;
  for i in 1..r.digit_count loop if substr(p_guess,i,1)=substr(opp_secret,i,1) then correct:=correct+1; end if; end loop;
  next_own:=own_count+1;
  if correct=r.digit_count then finished:=true; v_winner:=p_player_id;
    new_score:=public.nd_score(r.digit_count,r.game_mode,next_own,r.max_attempts,greatest(0,extract(epoch from(now()-r.started_at))::int),
      case when p_player_id=r.p1_id then r.p1_hints_used else r.p2_hints_used end);
  elsif next_own>=r.max_attempts and opp_count>=r.max_attempts then finished:=true; end if;
  update public.nd_rooms set guesses=guesses||jsonb_build_array(jsonb_build_object('by',p_player_id,'guess',p_guess,'correctPositions',correct)),
    status=case when finished then 'finished' else status end,winner=case when finished then v_winner else winner end,
    turn=case when finished then null when opp_count>=max_attempts then p_player_id else opp_id end,
    turn_deadline=case when finished or timer_seconds=0 then null else now()+make_interval(secs=>timer_seconds) end,
    p1_score=case when p_player_id=p1_id and v_winner=p_player_id then new_score else p1_score end,
    p2_score=case when p_player_id=p2_id and v_winner=p_player_id then new_score else p2_score end,updated_at=now() where code=r.code;
  return jsonb_build_object('ok',true,'correctPositions',correct,'won',v_winner=p_player_id,'room',public.nd_public_room(r.code,p_player_id,p_player_token));
end; $$;

create or replace function public.nd_use_hint(p_code text,p_player_id uuid,p_player_token text,p_hint_type text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype; last_guess jsonb; positions int[]:='{}'; pick int; i int; v_guess text; used int; opp uuid; secret_value text;
  selected_position int; excluded_digit int; message text;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  select * into r from public.nd_rooms where code=upper(trim(p_code)) for update;
  if r.status<>'playing' or p_hint_type not in('position','parity','exclude') then return jsonb_build_object('ok',false,'error','التلميح غير متاح'); end if;
  used:=case when p_player_id=r.p1_id then r.p1_hints_used else r.p2_hints_used end;
  if used>=r.hint_limit then return jsonb_build_object('ok',false,'error','انتهت تلميحاتك'); end if;
  opp:=case when p_player_id=r.p1_id then r.p2_id else r.p1_id end;
  select secret into secret_value from public.nd_secrets where room_code=r.code and player_id=opp;
  if p_hint_type='position' then
    select elem into last_guess from jsonb_array_elements(r.guesses) with ordinality t(elem,ord) where (elem->>'by')::uuid=p_player_id order by ord desc limit 1;
    if last_guess is null or coalesce((last_guess->>'correctPositions')::int,0)<1 then return jsonb_build_object('ok',false,'error','تحتاج تخميناً فيه خانة صحيحة أولاً'); end if;
    v_guess:=last_guess->>'guess';
    for i in 1..r.digit_count loop if substr(v_guess,i,1)=substr(secret_value,i,1) then positions:=array_append(positions,i); end if; end loop;
    pick:=positions[1+floor(random()*array_length(positions,1))::int]; message:='الخانة رقم '||pick||' من آخر تخمينك صحيحة';
  elsif p_hint_type='parity' then
    selected_position:=1+floor(random()*r.digit_count)::int;
    message:='رقم الخانة '||selected_position||case when substr(secret_value,selected_position,1)::int%2=0 then ' زوجي' else ' فردي' end;
  else
    selected_position:=1+floor(random()*r.digit_count)::int; excluded_digit:=(substr(secret_value,selected_position,1)::int+1+floor(random()*9)::int)%10;
    message:='استبعد الرقم '||excluded_digit||' من الخانة '||selected_position;
  end if;
  if p_player_id=r.p1_id then update public.nd_rooms set p1_hints_used=p1_hints_used+1,updated_at=now() where code=r.code;
  else update public.nd_rooms set p2_hints_used=p2_hints_used+1,updated_at=now() where code=r.code; end if;
  return jsonb_build_object('ok',true,'message',message,'room',public.nd_public_room(r.code,p_player_id,p_player_token));
end; $$;

create or replace function public.nd_rematch(p_code text,p_player_id uuid,p_player_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',false,'error','جلسة غير صالحة'); end if;
  select * into r from public.nd_rooms where code=upper(trim(p_code)) for update;
  if r.status<>'finished' or r.p2_id is null then return jsonb_build_object('ok',false,'error','إعادة اللعب غير متاحة الآن'); end if;
  delete from public.nd_secrets where room_code=r.code;
  update public.nd_rooms set status='setup',turn=null,winner=null,guesses='[]',p1_ready=false,p2_ready=false,p1_hint_used=false,p2_hint_used=false,
    p1_hints_used=0,p2_hints_used=0,p1_score=0,p2_score=0,started_at=null,turn_deadline=null,updated_at=now() where code=r.code;
  return jsonb_build_object('ok',true,'room',public.nd_public_room(r.code,p_player_id,p_player_token));
end; $$;

create or replace function public.nd_leave_room(p_code text,p_player_id uuid,p_player_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.nd_rooms%rowtype;
begin
  if not public.nd_player_ok(p_code,p_player_id,p_player_token) then return jsonb_build_object('ok',true); end if;
  select * into r from public.nd_rooms where code=upper(trim(p_code)) for update;
  if r.p2_id is null then delete from public.nd_rooms where code=r.code; return jsonb_build_object('ok',true); end if;
  delete from public.nd_secrets where room_code=r.code;
  if p_player_id=r.p1_id then
    update public.nd_rooms set p1_id=r.p2_id,p1_name=r.p2_name,p1_token_hash=r.p2_token_hash,p1_last_seen=r.p2_last_seen,
      p2_id=null,p2_name=null,p2_token_hash=null,p2_last_seen=null,status='waiting',turn=null,winner=null,guesses='[]',
      p1_ready=false,p2_ready=false,p1_hint_used=false,p2_hint_used=false,p1_hints_used=0,p2_hints_used=0,
      p1_score=0,p2_score=0,started_at=null,turn_deadline=null,left_by=p_player_id,updated_at=now() where code=r.code;
  else
    update public.nd_rooms set p2_id=null,p2_name=null,p2_token_hash=null,p2_last_seen=null,status='waiting',turn=null,winner=null,guesses='[]',
      p1_ready=false,p2_ready=false,p1_hint_used=false,p2_hint_used=false,p1_hints_used=0,p2_hints_used=0,
      p1_score=0,p2_score=0,started_at=null,turn_deadline=null,left_by=p_player_id,updated_at=now() where code=r.code;
  end if;
  return jsonb_build_object('ok',true);
end; $$;

revoke execute on function public.nd_rule_number(text,int,boolean,boolean) from public,anon,authenticated;
revoke execute on function public.nd_score(int,text,int,int,int,int) from public,anon,authenticated;
revoke execute on function public.nd_use_hint(text,uuid,text) from public,anon,authenticated;
grant execute on function public.nd_create_room(text,int,int,text,boolean,int,int) to anon,authenticated;
grant execute on function public.nd_random_match(text,int,int,text,boolean,int,int) to anon,authenticated;
grant execute on function public.nd_use_hint(text,uuid,text,text) to anon,authenticated;

notify pgrst,'reload schema';
