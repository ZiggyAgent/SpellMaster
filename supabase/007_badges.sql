-- Tier 2 rewards: badges (trophy case) + XP.
-- XP is NOT stored — it's the lifetime sum of game scores (derived). Badges ARE
-- stored (sticky, and so we can detect newly-earned ones for a celebration).
-- All badge criteria are DERIVED from existing games/game_words, so sync_badges
-- recomputes eligibility and inserts any newly-earned badges idempotently.

create table if not exists spelling.badges (
  player_id uuid not null references arcade.players(id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (player_id, badge_id)
);
alter table spelling.badges enable row level security;

create or replace function spelling.sync_badges(p_player_id uuid, p_pin text)
returns json
language plpgsql security definer
set search_path = spelling, arcade, pg_temp
as $$
declare
  v_games int; v_perfect int; v_grades int;
  v_xp numeric; v_best_streak int; v_distinct int;
  v_got25 boolean; v_comeback boolean;
  v_qualify text[] := array[]::text[];
  v_new text[];
begin
  if not arcade.check_player(p_player_id, p_pin) then
    return json_build_object('ok', false, 'error', 'Invalid player credentials.');
  end if;

  select count(*), coalesce(sum(score), 0),
         count(*) filter (where max_score > 0 and score = max_score),
         count(distinct grade)
    into v_games, v_xp, v_perfect, v_grades
  from spelling.games where player_id = p_player_id;

  -- longest run of consecutive first-try-correct words within any single game
  select coalesce(max(run_len), 0) into v_best_streak from (
    select count(*) as run_len
    from (
      select gw.game_id, gw.first_try_correct,
             row_number() over (partition by gw.game_id order by gw.id)
               - row_number() over (partition by gw.game_id, gw.first_try_correct order by gw.id) as grp
      from spelling.game_words gw
      join spelling.games g on g.id = gw.game_id
      where g.player_id = p_player_id
    ) t
    where first_try_correct
    group by game_id, grp
  ) r;

  select exists(
    select 1 from spelling.game_words gw join spelling.games g on g.id = gw.game_id
    where g.player_id = p_player_id and gw.points = 25 and gw.first_try_correct
  ) into v_got25;

  select count(distinct gw.word) into v_distinct
  from spelling.game_words gw join spelling.games g on g.id = gw.game_id
  where g.player_id = p_player_id and (gw.first_try_correct or coalesce(gw.retry_correct, false));

  select exists(
    select 1
    from spelling.game_words gw1
    join spelling.games g1 on g1.id = gw1.game_id and g1.player_id = p_player_id
    join spelling.game_words gw2 on gw2.word = gw1.word
    join spelling.games g2 on g2.id = gw2.game_id and g2.player_id = p_player_id
    where gw1.first_try_correct = false and gw2.first_try_correct = true
      and g2.played_at > g1.played_at
  ) into v_comeback;

  if v_games    >= 1   then v_qualify := array_append(v_qualify, 'first-game'); end if;
  if v_games    >= 10  then v_qualify := array_append(v_qualify, 'games-10'); end if;
  if v_games    >= 50  then v_qualify := array_append(v_qualify, 'games-50'); end if;
  if v_perfect  >= 1   then v_qualify := array_append(v_qualify, 'perfect-1'); end if;
  if v_perfect  >= 10  then v_qualify := array_append(v_qualify, 'perfect-10'); end if;
  if v_best_streak >= 5  then v_qualify := array_append(v_qualify, 'streak-5'); end if;
  if v_best_streak >= 10 then v_qualify := array_append(v_qualify, 'streak-10'); end if;
  if v_got25           then v_qualify := array_append(v_qualify, 'bigword'); end if;
  if v_distinct >= 50  then v_qualify := array_append(v_qualify, 'collector-50'); end if;
  if v_distinct >= 200 then v_qualify := array_append(v_qualify, 'collector-200'); end if;
  if v_grades   >= 5   then v_qualify := array_append(v_qualify, 'explorer-5'); end if;
  if v_comeback        then v_qualify := array_append(v_qualify, 'comeback'); end if;

  with ins as (
    insert into spelling.badges (player_id, badge_id)
    select p_player_id, unnest(v_qualify)
    on conflict (player_id, badge_id) do nothing
    returning badge_id
  )
  select coalesce(array_agg(badge_id), array[]::text[]) into v_new from ins;

  return json_build_object(
    'ok', true,
    'xp', v_xp,
    'games', v_games,
    'new', to_jsonb(v_new),
    'earned', coalesce((
      select json_agg(json_build_object('id', badge_id, 'at', earned_at) order by earned_at)
      from spelling.badges where player_id = p_player_id), '[]'::json)
  );
end $$;

grant execute on function spelling.sync_badges(uuid, text) to anon, authenticated;
