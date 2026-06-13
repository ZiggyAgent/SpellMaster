-- Phase 3: feed the client analyzer. Returns the player's recent FIRST-TRY
-- misses (the diagnostic signal — retries happen after the answer is shown)
-- with the typed attempt, so the client can detect repeated pattern mistakes.

create or replace function spelling.get_mistakes(p_player_id uuid, p_pin text)
returns json
language sql security definer
set search_path = spelling, arcade, pg_temp
as $$
  select case when not arcade.check_player(p_player_id, p_pin)
    then json_build_object('ok', false, 'error', 'Invalid player credentials.')
    else json_build_object('ok', true, 'mistakes', coalesce((
      select json_agg(row_to_json(t)) from (
        select gw.word, gw.first_attempt as attempt, g.grade, g.played_at
        from spelling.game_words gw
        join spelling.games g on g.id = gw.game_id
        where g.player_id = p_player_id and not gw.first_try_correct
        order by g.played_at desc
        limit 500
      ) t), '[]'::json))
  end;
$$;

grant execute on function spelling.get_mistakes(uuid, text) to anon, authenticated;
