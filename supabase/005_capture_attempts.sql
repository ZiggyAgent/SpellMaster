-- Phase 1 of mistake analysis: store WHAT the player actually typed when they
-- get a word wrong (first try and retry). The typo is where the diagnosis
-- lives ("beleive" = ie/ei confusion; "runing" = doubling rule). Attempts are
-- only stored for incorrect answers; truncated server-side as a guard.

alter table spelling.game_words
  add column if not exists first_attempt text,
  add column if not exists retry_attempt text;

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
    insert into spelling.game_words
      (game_id, word, points, first_try_correct, retry_correct, earned, first_attempt, retry_attempt)
    values
      (v_game_id, w->>'word', v_points, v_first, v_retry, v_earned,
       left(nullif(trim(w->>'first_attempt'), ''), 60),
       left(nullif(trim(w->>'retry_attempt'), ''), 60));
  end loop;

  update spelling.games set score = v_score, max_score = v_max where id = v_game_id;
  return json_build_object('ok', true, 'game_id', v_game_id, 'score', v_score, 'max_score', v_max);
end $$;
