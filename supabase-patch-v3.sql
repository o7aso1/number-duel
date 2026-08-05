-- v3: presence, leave, skip turn for timer

alter table public.nd_rooms add column if not exists p1_last_seen timestamptz;
alter table public.nd_rooms add column if not exists p2_last_seen timestamptz;
alter table public.nd_rooms add column if not exists left_by uuid;

create or replace function public.nd_public_room(p_code text, p_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.nd_rooms%rowtype;
  my_secret text;
  opp_secret text;
  my_guesses jsonb;
  my_hint boolean;
  opp_id uuid;
  turn_no int;
  opp_seen timestamptz;
  away numeric;
  presence text;
begin
  select * into r from public.nd_rooms where code = p_code;
  if not found then
    return null;
  end if;

  if p_player_id is distinct from r.p1_id and p_player_id is distinct from r.p2_id then
    raise exception 'لست في هذه الغرفة';
  end if;

  opp_id := case when p_player_id = r.p1_id then r.p2_id else r.p1_id end;
  my_hint := case when p_player_id = r.p1_id then r.p1_hint_used else r.p2_hint_used end;
  opp_seen := case when p_player_id = r.p1_id then r.p2_last_seen else r.p1_last_seen end;

  if opp_id is null then
    presence := 'none';
  elsif r.left_by is not null and r.left_by = opp_id then
    presence := 'left';
  elsif opp_seen is null then
    presence := 'unknown';
  else
    away := extract(epoch from (now() - opp_seen));
    if away < 12 then
      presence := 'online';
    elsif away < 35 then
      presence := 'slow';
    else
      presence := 'offline';
    end if;
  end if;

  select s.secret into my_secret
  from public.nd_secrets s
  where s.room_code = p_code and s.player_id = p_player_id;

  if r.status = 'finished' and opp_id is not null then
    select s.secret into opp_secret
    from public.nd_secrets s
    where s.room_code = p_code and s.player_id = opp_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'guess', g->>'guess',
    'correctPositions', (g->>'correctPositions')::int
  ) order by ord), '[]'::jsonb)
  into my_guesses
  from jsonb_array_elements(r.guesses) with ordinality as t(g, ord)
  where (g->>'by')::uuid = p_player_id;

  turn_no := greatest(1, (jsonb_array_length(r.guesses) / 2) + 1);

  return jsonb_build_object(
    'code', r.code,
    'status', r.status,
    'turn', r.turn,
    'winner', r.winner,
    'digitCount', r.digit_count,
    'hintUsed', coalesce(my_hint, false),
    'vsAi', coalesce(r.vs_ai, false),
    'turnNumber', turn_no,
    'myGuessCount', jsonb_array_length(my_guesses),
    'mySecret', my_secret,
    'opponentSecret', opp_secret,
    'opponentPresence', presence,
    'opponentAwaySec', coalesce(away, 0),
    'guesses', my_guesses,
    'players', (
      select coalesce(jsonb_agg(p order by ord), '[]'::jsonb)
      from (
        select 1 as ord, jsonb_build_object(
          'id', r.p1_id,
          'name', r.p1_name,
          'ready', r.p1_ready,
          'isYou', r.p1_id = p_player_id,
          'hasSecret', exists(select 1 from public.nd_secrets s where s.room_code = r.code and s.player_id = r.p1_id)
        ) as p
        union all
        select 2 as ord, jsonb_build_object(
          'id', r.p2_id,
          'name', r.p2_name,
          'ready', coalesce(r.p2_ready, false),
          'isYou', r.p2_id = p_player_id,
          'hasSecret', exists(select 1 from public.nd_secrets s where s.room_code = r.code and s.player_id = r.p2_id)
        ) as p
        where r.p2_id is not null
      ) x
    )
  );
end;
$$;

create or replace function public.nd_heartbeat(p_code text, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.nd_rooms%rowtype;
  v_code text := upper(trim(p_code));
begin
  select * into r from public.nd_rooms where code = v_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'الغرفة غير موجودة');
  end if;
  if p_player_id is distinct from r.p1_id and p_player_id is distinct from r.p2_id then
    return jsonb_build_object('ok', false, 'error', 'لست في غرفة');
  end if;

  if p_player_id = r.p1_id then
    update public.nd_rooms set p1_last_seen = now() where code = v_code;
  else
    update public.nd_rooms set p2_last_seen = now() where code = v_code;
  end if;

  return jsonb_build_object('ok', true, 'room', public.nd_public_room(v_code, p_player_id));
end;
$$;

create or replace function public.nd_leave_room(p_code text, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.nd_rooms%rowtype;
  v_code text := upper(trim(p_code));
  remaining uuid;
begin
  select * into r from public.nd_rooms where code = v_code for update;
  if not found then
    return jsonb_build_object('ok', true);
  end if;
  if p_player_id is distinct from r.p1_id and p_player_id is distinct from r.p2_id then
    return jsonb_build_object('ok', true);
  end if;

  remaining := case when p_player_id = r.p1_id then r.p2_id else r.p1_id end;

  if remaining is null then
    delete from public.nd_rooms where code = v_code;
    return jsonb_build_object('ok', true);
  end if;

  delete from public.nd_secrets where room_code = v_code;
  if p_player_id = r.p1_id then
    update public.nd_rooms
    set p1_id = r.p2_id,
        p1_name = r.p2_name,
        p1_ready = false,
        p1_hint_used = false,
        p1_last_seen = r.p2_last_seen,
        p2_id = null,
        p2_name = null,
        p2_ready = false,
        p2_hint_used = false,
        p2_last_seen = null,
        status = 'waiting',
        turn = null,
        winner = null,
        guesses = '[]'::jsonb,
        left_by = p_player_id,
        updated_at = now()
    where code = v_code;
  else
    update public.nd_rooms
    set p2_id = null,
        p2_name = null,
        p2_ready = false,
        p2_hint_used = false,
        p2_last_seen = null,
        status = 'waiting',
        turn = null,
        winner = null,
        guesses = '[]'::jsonb,
        p1_ready = false,
        p1_hint_used = false,
        left_by = p_player_id,
        updated_at = now()
    where code = v_code;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.nd_skip_turn(p_code text, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.nd_rooms%rowtype;
  v_code text := upper(trim(p_code));
  opp_id uuid;
begin
  select * into r from public.nd_rooms where code = v_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'لست في غرفة');
  end if;
  if r.status <> 'playing' then
    return jsonb_build_object('ok', false, 'error', 'اللعبة غير جارية');
  end if;
  if r.turn is distinct from p_player_id then
    return jsonb_build_object('ok', false, 'error', 'مو دورك');
  end if;

  opp_id := case when p_player_id = r.p1_id then r.p2_id else r.p1_id end;
  if opp_id is null then
    return jsonb_build_object('ok', false, 'error', 'ما فيه خصم');
  end if;

  update public.nd_rooms
  set turn = opp_id,
      updated_at = now()
  where code = v_code;

  return jsonb_build_object('ok', true, 'room', public.nd_public_room(v_code, p_player_id));
end;
$$;

-- clear left_by when someone joins again
create or replace function public.nd_join_room(p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.nd_rooms%rowtype;
  v_player uuid := gen_random_uuid();
  v_name text := left(trim(coalesce(nullif(p_name, ''), 'لاعب 2')), 20);
  v_code text := upper(trim(p_code));
begin
  select * into r from public.nd_rooms where code = v_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'الغرفة غير موجودة');
  end if;
  if r.p2_id is not null then
    return jsonb_build_object('ok', false, 'error', 'الغرفة ممتلئة');
  end if;
  if r.status <> 'waiting' then
    return jsonb_build_object('ok', false, 'error', 'اللعبة بدأت بالفعل');
  end if;

  update public.nd_rooms
  set p2_id = v_player,
      p2_name = v_name,
      p2_last_seen = now(),
      status = 'setup',
      left_by = null,
      updated_at = now()
  where code = v_code;

  return jsonb_build_object(
    'ok', true,
    'playerId', v_player,
    'room', public.nd_public_room(v_code, v_player)
  );
end;
$$;

create or replace function public.nd_create_room(p_name text, p_digit_count int default 4)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_player uuid := gen_random_uuid();
  v_name text := left(trim(coalesce(nullif(p_name, ''), 'لاعب 1')), 20);
  v_digits int := coalesce(p_digit_count, 4);
begin
  if v_digits not in (3, 4, 5) then
    return jsonb_build_object('ok', false, 'error', 'اختر صعوبة صحيحة');
  end if;
  v_code := public.nd_gen_code();
  insert into public.nd_rooms(code, status, p1_id, p1_name, digit_count, p1_last_seen)
  values (v_code, 'waiting', v_player, v_name, v_digits, now());
  return jsonb_build_object(
    'ok', true,
    'playerId', v_player,
    'room', public.nd_public_room(v_code, v_player)
  );
end;
$$;

grant execute on function public.nd_heartbeat(text, uuid) to anon, authenticated;
grant execute on function public.nd_leave_room(text, uuid) to anon, authenticated;
grant execute on function public.nd_skip_turn(text, uuid) to anon, authenticated;
grant execute on function public.nd_join_room(text, text) to anon, authenticated;
grant execute on function public.nd_create_room(text, int) to anon, authenticated;

notify pgrst, 'reload schema';
