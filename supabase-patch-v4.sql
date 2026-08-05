-- Patch v4: allow all-same secrets, ban only on guesses + room chat
-- Run in Supabase SQL editor for project zjqlkvhtgruelgpaadrr

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

-- Keep name nd_valid_number for guesses (still bans 1111…)
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

create or replace function public.nd_set_secret(p_code text, p_player_id uuid, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  r public.nd_rooms%rowtype;
  both_ready boolean;
begin
  select * into r from public.nd_rooms where code = v_code for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'الغرفة غير موجودة');
  end if;
  if p_player_id is distinct from r.p1_id and p_player_id is distinct from r.p2_id then
    return jsonb_build_object('ok', false, 'error', 'لست في هذه الغرفة');
  end if;
  if r.status not in ('waiting', 'setup') then
    return jsonb_build_object('ok', false, 'error', 'ما تقدر تغيّر الرقم الآن');
  end if;
  if not public.nd_valid_digits(p_secret, r.digit_count) then
    return jsonb_build_object('ok', false, 'error', 'رقم غير صالح');
  end if;

  insert into public.nd_secrets(room_code, player_id, secret)
  values (v_code, p_player_id, p_secret)
  on conflict (room_code, player_id) do update set secret = excluded.secret;

  if p_player_id = r.p1_id then
    update public.nd_rooms set p1_ready = true, status = 'setup', updated_at = now() where code = v_code;
  else
    update public.nd_rooms set p2_ready = true, status = 'setup', updated_at = now() where code = v_code;
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

create table if not exists public.nd_chat (
  id bigserial primary key,
  room_code text not null references public.nd_rooms(code) on delete cascade,
  player_id uuid not null,
  player_name text not null,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists nd_chat_room_created_idx on public.nd_chat(room_code, created_at);

alter table public.nd_chat enable row level security;

drop policy if exists nd_chat_select on public.nd_chat;
create policy nd_chat_select on public.nd_chat for select using (true);

alter table public.nd_chat replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'nd_chat'
  ) then
    alter publication supabase_realtime add table public.nd_chat;
  end if;
end $$;

create or replace function public.nd_send_chat(p_code text, p_player_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_body text := trim(p_body);
  r public.nd_rooms%rowtype;
  v_name text;
  v_msg public.nd_chat%rowtype;
begin
  if v_body is null or char_length(v_body) < 1 then
    return jsonb_build_object('ok', false, 'error', 'رسالة فارغة');
  end if;
  if char_length(v_body) > 200 then
    return jsonb_build_object('ok', false, 'error', 'الرسالة طويلة');
  end if;

  select * into r from public.nd_rooms where code = v_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'الغرفة غير موجودة');
  end if;
  if p_player_id is distinct from r.p1_id and p_player_id is distinct from r.p2_id then
    return jsonb_build_object('ok', false, 'error', 'لست في هذه الغرفة');
  end if;

  v_name := case when p_player_id = r.p1_id then coalesce(r.p1_name, 'لاعب') else coalesce(r.p2_name, 'لاعب') end;

  insert into public.nd_chat(room_code, player_id, player_name, body)
  values (v_code, p_player_id, v_name, v_body)
  returning * into v_msg;

  return jsonb_build_object(
    'ok', true,
    'message', jsonb_build_object(
      'id', v_msg.id,
      'playerId', v_msg.player_id,
      'playerName', v_msg.player_name,
      'body', v_msg.body,
      'createdAt', v_msg.created_at
    )
  );
end;
$$;

create or replace function public.nd_list_chat(p_code text, p_player_id uuid, p_limit int default 80)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  r public.nd_rooms%rowtype;
  v_limit int := least(greatest(coalesce(p_limit, 80), 1), 120);
  v_msgs jsonb;
begin
  select * into r from public.nd_rooms where code = v_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'الغرفة غير موجودة');
  end if;
  if p_player_id is distinct from r.p1_id and p_player_id is distinct from r.p2_id then
    return jsonb_build_object('ok', false, 'error', 'لست في هذه الغرفة');
  end if;

  select coalesce(jsonb_agg(m order by (m->>'id')::bigint), '[]'::jsonb)
  into v_msgs
  from (
    select jsonb_build_object(
      'id', c.id,
      'playerId', c.player_id,
      'playerName', c.player_name,
      'body', c.body,
      'createdAt', c.created_at
    ) as m
    from public.nd_chat c
    where c.room_code = v_code
    order by c.id desc
    limit v_limit
  ) t;

  select coalesce(jsonb_agg(elem order by ord desc), '[]'::jsonb)
  into v_msgs
  from jsonb_array_elements(coalesce(v_msgs, '[]'::jsonb)) with ordinality as x(elem, ord);

  return jsonb_build_object('ok', true, 'messages', coalesce(v_msgs, '[]'::jsonb));
end;
$$;

grant execute on function public.nd_send_chat(text, uuid, text) to anon, authenticated;
grant execute on function public.nd_list_chat(text, uuid, int) to anon, authenticated;
grant execute on function public.nd_set_secret(text, uuid, text) to anon, authenticated;
