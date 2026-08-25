-- Number Duel v2: difficulty, hints, reveal, vs AI flag

create extension if not exists pgcrypto;

create table if not exists public.nd_rooms (
  code text primary key,
  status text not null check (status in ('waiting', 'setup', 'playing', 'finished')),
  turn uuid null,
  winner uuid null,
  p1_id uuid not null,
  p2_id uuid null,
  p1_name text not null,
  p2_name text null,
  p1_ready boolean not null default false,
  p2_ready boolean not null default false,
  guesses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nd_rooms add column if not exists digit_count int;
alter table public.nd_rooms add column if not exists p1_hint_used boolean;
alter table public.nd_rooms add column if not exists p2_hint_used boolean;
alter table public.nd_rooms add column if not exists vs_ai boolean;

update public.nd_rooms set digit_count = 4 where digit_count is null;
update public.nd_rooms set p1_hint_used = false where p1_hint_used is null;
update public.nd_rooms set p2_hint_used = false where p2_hint_used is null;
update public.nd_rooms set vs_ai = false where vs_ai is null;

alter table public.nd_rooms alter column digit_count set default 4;
alter table public.nd_rooms alter column p1_hint_used set default false;
alter table public.nd_rooms alter column p2_hint_used set default false;
alter table public.nd_rooms alter column vs_ai set default false;
alter table public.nd_rooms alter column digit_count set not null;
alter table public.nd_rooms alter column p1_hint_used set not null;
alter table public.nd_rooms alter column p2_hint_used set not null;
alter table public.nd_rooms alter column vs_ai set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'nd_rooms_digit_count_check'
  ) then
    alter table public.nd_rooms
      add constraint nd_rooms_digit_count_check check (digit_count in (3, 4, 5));
  end if;
end $$;

create table if not exists public.nd_secrets (
  room_code text not null references public.nd_rooms(code) on delete cascade,
  player_id uuid not null,
  secret text not null,
  primary key (room_code, player_id)
);

alter table public.nd_rooms enable row level security;
alter table public.nd_secrets enable row level security;

drop policy if exists nd_rooms_select on public.nd_rooms;
create policy nd_rooms_select on public.nd_rooms
  for select to anon, authenticated
  using (true);

alter table public.nd_rooms replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'nd_rooms'
  ) then
    alter publication supabase_realtime add table public.nd_rooms;
  end if;
end $$;

-- Digits only (all-same allowed) — used for secrets
create or replace function public.nd_valid_digits(p_value text, p_digits int)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_digits not in (3, 4, 5) then
    return false;
  end if;
  if p_value is null or length(p_value) <> p_digits or p_value !~ ('^\d{' || p_digits || '}$') then
    return false;
  end if;
  return true;
end;
$$;

-- Guesses: bans all-same like 1111
create or replace function public.nd_valid_number(p_secret text, p_digits int)
returns boolean
language plpgsql
immutable
as $$
begin
  if not public.nd_valid_digits(p_secret, p_digits) then
    return false;
  end if;
  if p_secret = repeat(substr(p_secret, 1, 1), p_digits) then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.nd_gen_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  i int;
begin
  for i in 1..5 loop
    v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  if exists(select 1 from public.nd_rooms r where r.code = v_code) then
    return public.nd_gen_code();
  end if;
  return v_code;
end;
$$;

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
  insert into public.nd_rooms(code, status, p1_id, p1_name, digit_count)
  values (v_code, 'waiting', v_player, v_name, v_digits);
  return jsonb_build_object(
    'ok', true,
    'playerId', v_player,
    'room', public.nd_public_room(v_code, v_player)
  );
end;
$$;

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
      status = 'setup',
      updated_at = now()
  where code = v_code;

  return jsonb_build_object(
    'ok', true,
    'playerId', v_player,
    'room', public.nd_public_room(v_code, v_player)
  );
end;
$$;

create or replace function public.nd_set_secret(p_code text, p_player_id uuid, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.nd_rooms%rowtype;
  v_code text := upper(trim(p_code));
  both_ready boolean;
begin
  select * into r from public.nd_rooms where code = v_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'لست في غرفة');
  end if;
  if r.status <> 'setup' then
    return jsonb_build_object('ok', false, 'error', 'لا يمكن تعيين الرقم الآن');
  end if;
  if p_player_id is distinct from r.p1_id and p_player_id is distinct from r.p2_id then
    return jsonb_build_object('ok', false, 'error', 'لاعب غير موجود');
  end if;
  if not public.nd_valid_digits(p_secret, r.digit_count) then
    return jsonb_build_object(
      'ok', false,
      'error',
      'لازم ' || r.digit_count || ' أرقام صحيحة'
    );
  end if;

  insert into public.nd_secrets(room_code, player_id, secret)
  values (v_code, p_player_id, p_secret)
  on conflict (room_code, player_id) do update set secret = excluded.secret;

  if p_player_id = r.p1_id then
    update public.nd_rooms set p1_ready = true, updated_at = now() where code = v_code;
  else
    update public.nd_rooms set p2_ready = true, updated_at = now() where code = v_code;
  end if;

  select p1_ready and p2_ready into both_ready from public.nd_rooms where code = v_code;
  if both_ready then
    update public.nd_rooms
    set status = 'playing',
        turn = case when random() < 0.5 then p1_id else p2_id end,
        updated_at = now()
    where code = v_code;
  end if;

  return jsonb_build_object('ok', true, 'room', public.nd_public_room(v_code, p_player_id));
end;
$$;

create or replace function public.nd_guess(p_code text, p_player_id uuid, p_guess text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.nd_rooms%rowtype;
  v_code text := upper(trim(p_code));
  opp_id uuid;
  opp_secret text;
  correct int := 0;
  i int;
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
  if p_player_id is distinct from r.p1_id and p_player_id is distinct from r.p2_id then
    return jsonb_build_object('ok', false, 'error', 'لاعب غير موجود');
  end if;
  if not public.nd_valid_number(p_guess, r.digit_count) then
    return jsonb_build_object(
      'ok', false,
      'error',
      'التخمين لازم ' || r.digit_count || ' أرقام بدون تكرار كامل'
    );
  end if;

  opp_id := case when p_player_id = r.p1_id then r.p2_id else r.p1_id end;
  select s.secret into opp_secret from public.nd_secrets s
  where s.room_code = v_code and s.player_id = opp_id;

  if opp_secret is null then
    return jsonb_build_object('ok', false, 'error', 'خطأ في حالة اللعبة');
  end if;

  for i in 1..r.digit_count loop
    if substr(p_guess, i, 1) = substr(opp_secret, i, 1) then
      correct := correct + 1;
    end if;
  end loop;

  update public.nd_rooms
  set guesses = guesses || jsonb_build_array(jsonb_build_object(
        'by', p_player_id,
        'guess', p_guess,
        'correctPositions', correct
      )),
      status = case when correct = r.digit_count then 'finished' else status end,
      winner = case when correct = r.digit_count then p_player_id else winner end,
      turn = case when correct = r.digit_count then null else opp_id end,
      updated_at = now()
  where code = v_code;

  return jsonb_build_object(
    'ok', true,
    'correctPositions', correct,
    'won', correct = r.digit_count,
    'room', public.nd_public_room(v_code, p_player_id)
  );
end;
$$;

create or replace function public.nd_use_hint(p_code text, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.nd_rooms%rowtype;
  v_code text := upper(trim(p_code));
  last_guess jsonb;
  positions int[] := '{}';
  pick int;
  i int;
  v_guess text;
  hint_used boolean;
begin
  select * into r from public.nd_rooms where code = v_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'لست في غرفة');
  end if;
  if r.status <> 'playing' then
    return jsonb_build_object('ok', false, 'error', 'التلميح وقت اللعب فقط');
  end if;
  if p_player_id is distinct from r.p1_id and p_player_id is distinct from r.p2_id then
    return jsonb_build_object('ok', false, 'error', 'لست في غرفة');
  end if;

  hint_used := case when p_player_id = r.p1_id then r.p1_hint_used else r.p2_hint_used end;
  if hint_used then
    return jsonb_build_object('ok', false, 'error', 'استخدمت التلميح مسبقاً بهالجولة');
  end if;

  select elem into last_guess
  from jsonb_array_elements(r.guesses) with ordinality as t(elem, ord)
  where (elem->>'by')::uuid = p_player_id
  order by ord desc
  limit 1;

  if last_guess is null then
    return jsonb_build_object('ok', false, 'error', 'خمّن مرة أولاً بعدين استخدم التلميح');
  end if;
  if coalesce((last_guess->>'correctPositions')::int, 0) < 1 then
    return jsonb_build_object('ok', false, 'error', 'آخر تخمين ما فيه أي خانة صحيحة');
  end if;

  v_guess := last_guess->>'guess';
  for i in 1..r.digit_count loop
    -- compare against opponent secret
    if substr(v_guess, i, 1) = (
      select substr(s.secret, i, 1)
      from public.nd_secrets s
      where s.room_code = v_code
        and s.player_id = case when p_player_id = r.p1_id then r.p2_id else r.p1_id end
    ) then
      positions := array_append(positions, i);
    end if;
  end loop;

  if coalesce(array_length(positions, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'error', 'ما قدرنا نطلع تلميح');
  end if;

  pick := positions[1 + floor(random() * array_length(positions, 1))::int];

  if p_player_id = r.p1_id then
    update public.nd_rooms set p1_hint_used = true, updated_at = now() where code = v_code;
  else
    update public.nd_rooms set p2_hint_used = true, updated_at = now() where code = v_code;
  end if;

  return jsonb_build_object(
    'ok', true,
    'hintPosition', pick,
    'message', 'الخانة رقم ' || pick || ' من آخر تخمينك صحيحة (بدون كشف الرقم)',
    'room', public.nd_public_room(v_code, p_player_id)
  );
end;
$$;

create or replace function public.nd_rematch(p_code text, p_player_id uuid)
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
    return jsonb_build_object('ok', false, 'error', 'لست في غرفة');
  end if;
  if p_player_id is distinct from r.p1_id and p_player_id is distinct from r.p2_id then
    return jsonb_build_object('ok', false, 'error', 'لست في غرفة');
  end if;
  if r.p2_id is null then
    return jsonb_build_object('ok', false, 'error', 'تحتاج خصم');
  end if;

  delete from public.nd_secrets where room_code = v_code;
  update public.nd_rooms
  set status = 'setup',
      turn = null,
      winner = null,
      guesses = '[]'::jsonb,
      p1_ready = false,
      p2_ready = false,
      p1_hint_used = false,
      p2_hint_used = false,
      updated_at = now()
  where code = v_code;

  return jsonb_build_object('ok', true, 'room', public.nd_public_room(v_code, p_player_id));
end;
$$;

create or replace function public.nd_get_room(p_code text, p_player_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  room jsonb;
begin
  room := public.nd_public_room(upper(trim(p_code)), p_player_id);
  if room is null then
    return jsonb_build_object('ok', false, 'error', 'الغرفة غير موجودة');
  end if;
  return jsonb_build_object('ok', true, 'room', room);
end;
$$;

-- recreate create_room with new signature: drop old 1-arg overload if needed
drop function if exists public.nd_create_room(text);

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
  insert into public.nd_rooms(code, status, p1_id, p1_name, digit_count)
  values (v_code, 'waiting', v_player, v_name, v_digits);
  return jsonb_build_object(
    'ok', true,
    'playerId', v_player,
    'room', public.nd_public_room(v_code, v_player)
  );
end;
$$;

grant execute on function public.nd_create_room(text, int) to anon, authenticated;
grant execute on function public.nd_join_room(text, text) to anon, authenticated;
grant execute on function public.nd_set_secret(text, uuid, text) to anon, authenticated;
grant execute on function public.nd_guess(text, uuid, text) to anon, authenticated;
grant execute on function public.nd_use_hint(text, uuid) to anon, authenticated;
grant execute on function public.nd_rematch(text, uuid) to anon, authenticated;
grant execute on function public.nd_get_room(text, uuid) to anon, authenticated;
grant execute on function public.nd_valid_number(text, int) to anon, authenticated;
