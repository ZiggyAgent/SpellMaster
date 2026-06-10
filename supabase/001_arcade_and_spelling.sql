-- SpellMaster setup: shared "arcade" accounts schema + "spelling" game schema
-- Convention for the Kids Games Supabase project: one schema per game,
-- shared player accounts in "arcade". All client access goes through
-- SECURITY DEFINER functions; tables have RLS on and no direct grants.

create schema if not exists arcade;
create schema if not exists spelling;

grant usage on schema arcade to anon, authenticated;
grant usage on schema spelling to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared player accounts (PINs stored in plaintext by design: the parent
-- recovers forgotten PINs by reading them in the dashboard)
-- ---------------------------------------------------------------------------
create table if not exists arcade.players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin text not null check (pin ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists players_name_lower_idx on arcade.players (lower(name));
alter table arcade.players enable row level security;

create or replace function arcade.signup(p_name text, p_pin text)
returns json
language plpgsql security definer
set search_path = arcade, pg_temp
as $$
declare
  v_id uuid;
  v_name text := trim(p_name);
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 20 then
    return json_build_object('ok', false, 'error', 'Name must be 2-20 characters.');
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    return json_build_object('ok', false, 'error', 'PIN must be exactly 4 digits.');
  end if;
  if exists (select 1 from arcade.players where lower(name) = lower(v_name)) then
    return json_build_object('ok', false, 'error', 'That name is already taken. Pick another one.');
  end if;
  insert into arcade.players (name, pin) values (v_name, p_pin) returning id into v_id;
  return json_build_object('ok', true, 'player_id', v_id, 'name', v_name);
end $$;

create or replace function arcade.login(p_name text, p_pin text)
returns json
language plpgsql security definer
set search_path = arcade, pg_temp
as $$
declare
  v_player arcade.players%rowtype;
begin
  select * into v_player from arcade.players
   where lower(name) = lower(trim(p_name)) and pin = p_pin;
  if not found then
    return json_build_object('ok', false, 'error', 'Wrong name or PIN. Ask a parent if you forgot your PIN!');
  end if;
  return json_build_object('ok', true, 'player_id', v_player.id, 'name', v_player.name);
end $$;

-- Internal helper for game schemas to validate a player credential pair
create or replace function arcade.check_player(p_player_id uuid, p_pin text)
returns boolean
language sql security definer
set search_path = arcade, pg_temp
as $$
  select exists (select 1 from arcade.players where id = p_player_id and pin = p_pin);
$$;

-- ---------------------------------------------------------------------------
-- Spelling game data
-- ---------------------------------------------------------------------------
create table if not exists spelling.games (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references arcade.players(id) on delete cascade,
  grade smallint not null check (grade between 1 and 12),
  score numeric(6,1) not null,
  max_score numeric(6,1) not null,
  played_at timestamptz not null default now()
);
create index if not exists games_grade_score_idx on spelling.games (grade, score desc);
create index if not exists games_player_idx on spelling.games (player_id, played_at desc);
alter table spelling.games enable row level security;

create table if not exists spelling.game_words (
  id bigint generated always as identity primary key,
  game_id uuid not null references spelling.games(id) on delete cascade,
  word text not null,
  points numeric(5,1) not null,
  first_try_correct boolean not null,
  retry_correct boolean,           -- null when there was no retry (first try was correct)
  earned numeric(5,1) not null
);
create index if not exists game_words_game_idx on spelling.game_words (game_id);
alter table spelling.game_words enable row level security;

-- Save a finished game. Words jsonb: [{word, points, first_try_correct, retry_correct}]
-- Scoring is computed server-side: full points on first try, half on retry.
create or replace function spelling.save_game(p_player_id uuid, p_pin text, p_grade int, p_words jsonb)
returns json
language plpgsql security definer
set search_path = spelling, arcade, pg_temp
as $$
declare
  v_game_id uuid;
  v_score numeric(6,1) := 0;
  v_max numeric(6,1) := 0;
  w jsonb;
  v_points numeric(5,1);
  v_first boolean;
  v_retry boolean;
  v_earned numeric(5,1);
begin
  if not arcade.check_player(p_player_id, p_pin) then
    return json_build_object('ok', false, 'error', 'Invalid player credentials.');
  end if;
  if p_grade < 1 or p_grade > 12 or jsonb_array_length(p_words) <> 10 then
    return json_build_object('ok', false, 'error', 'Invalid game data.');
  end if;

  insert into spelling.games (player_id, grade, score, max_score)
  values (p_player_id, p_grade, 0, 0) returning id into v_game_id;

  for w in select * from jsonb_array_elements(p_words) loop
    v_points := (w->>'points')::numeric;
    v_first  := (w->>'first_try_correct')::boolean;
    v_retry  := (w->>'retry_correct')::boolean;  -- null-safe
    v_earned := case
      when v_first then v_points
      when coalesce(v_retry, false) then v_points / 2
      else 0
    end;
    v_score := v_score + v_earned;
    v_max := v_max + v_points;
    insert into spelling.game_words (game_id, word, points, first_try_correct, retry_correct, earned)
    values (v_game_id, w->>'word', v_points, v_first, v_retry, v_earned);
  end loop;

  update spelling.games set score = v_score, max_score = v_max where id = v_game_id;
  return json_build_object('ok', true, 'game_id', v_game_id, 'score', v_score, 'max_score', v_max);
end $$;

-- Top 10 games for a grade (arcade style: a player can hold several slots)
create or replace function spelling.get_leaderboard(p_grade int)
returns json
language sql security definer
set search_path = spelling, arcade, pg_temp
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select p.name, g.score, g.max_score, g.played_at::date as played_on
    from spelling.games g join arcade.players p on p.id = g.player_id
    where g.grade = p_grade
    order by g.score desc, g.played_at asc
    limit 10
  ) t;
$$;

-- Full game history for a player, newest first, with the words missed on first try
create or replace function spelling.get_history(p_player_id uuid, p_pin text)
returns json
language sql security definer
set search_path = spelling, arcade, pg_temp
as $$
  select case when not arcade.check_player(p_player_id, p_pin)
    then json_build_object('ok', false, 'error', 'Invalid player credentials.')
    else json_build_object('ok', true, 'games', coalesce((
      select json_agg(row_to_json(t)) from (
        select g.id, g.grade, g.score, g.max_score, g.played_at,
          coalesce((
            select json_agg(json_build_object('word', gw.word, 'retry_correct', gw.retry_correct)
                            order by gw.id)
            from spelling.game_words gw
            where gw.game_id = g.id and not gw.first_try_correct
          ), '[]'::json) as missed_words
        from spelling.games g
        where g.player_id = p_player_id
        order by g.played_at desc
      ) t), '[]'::json))
  end;
$$;

-- Aggregate: every word this player ever missed on first try, with counts
create or replace function spelling.get_missed_words(p_player_id uuid, p_pin text)
returns json
language sql security definer
set search_path = spelling, arcade, pg_temp
as $$
  select case when not arcade.check_player(p_player_id, p_pin)
    then json_build_object('ok', false, 'error', 'Invalid player credentials.')
    else json_build_object('ok', true, 'words', coalesce((
      select json_agg(row_to_json(t)) from (
        select gw.word, count(*) as times_missed, max(g.played_at)::date as last_missed
        from spelling.game_words gw
        join spelling.games g on g.id = gw.game_id
        where g.player_id = p_player_id and not gw.first_try_correct
        group by gw.word
        order by count(*) desc, gw.word
      ) t), '[]'::json))
  end;
$$;

-- Personal best score per grade level
create or replace function spelling.get_personal_bests(p_player_id uuid, p_pin text)
returns json
language sql security definer
set search_path = spelling, arcade, pg_temp
as $$
  select case when not arcade.check_player(p_player_id, p_pin)
    then json_build_object('ok', false, 'error', 'Invalid player credentials.')
    else json_build_object('ok', true, 'bests', coalesce((
      select json_agg(row_to_json(t)) from (
        select grade, max(score) as best_score, count(*) as games_played
        from spelling.games
        where player_id = p_player_id
        group by grade
        order by grade
      ) t), '[]'::json))
  end;
$$;

-- Lock down: helper not callable from the API, public RPCs are
revoke execute on function arcade.check_player(uuid, text) from anon, authenticated, public;
grant execute on function arcade.signup(text, text) to anon, authenticated;
grant execute on function arcade.login(text, text) to anon, authenticated;
grant execute on function spelling.save_game(uuid, text, int, jsonb) to anon, authenticated;
grant execute on function spelling.get_leaderboard(int) to anon, authenticated;
grant execute on function spelling.get_history(uuid, text) to anon, authenticated;
grant execute on function spelling.get_missed_words(uuid, text) to anon, authenticated;
grant execute on function spelling.get_personal_bests(uuid, text) to anon, authenticated;
