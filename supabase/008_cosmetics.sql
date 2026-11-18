-- Tier 3: bee-buddy cosmetic shop + word-collection meter.
-- Coins are SPENDABLE and = lifetime XP (sum of game scores) minus what's been
-- spent on cosmetics. XP/level/leaderboards are untouched by spending — only
-- the spendable coin balance goes down, so buying never lowers a kid's rank.

create table if not exists spelling.cosmetics (
  player_id uuid not null references arcade.players(id) on delete cascade,
  item_id text not null,
  cost int not null,
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (player_id, item_id)
);
alter table spelling.cosmetics enable row level security;

-- Server-authoritative prices (client can't fake a cheaper cost).
create or replace function spelling._cosmetic_price(p_item text)
returns int language sql immutable
set search_path = spelling, pg_temp
as $$
  select case p_item
    when 'cap' then 150 when 'bow' then 150 when 'flower' then 150
    when 'shades' then 350 when 'star' then 350 when 'honey' then 350
    when 'tophat' then 700 when 'grad' then 700 when 'rainbow' then 700
    when 'crown' then 1500 when 'cape' then 1500
    when 'rocket' then 3000 when 'dragon' then 3000
    else null end;
$$;

create or replace function spelling.get_cosmetics(p_player_id uuid, p_pin text)
returns json language plpgsql security definer
set search_path = spelling, arcade, pg_temp
as $$
declare v_xp numeric; v_spent int;
begin
  if not arcade.check_player(p_player_id, p_pin) then
    return json_build_object('ok', false, 'error', 'Invalid player credentials.');
  end if;
  select coalesce(sum(score), 0) into v_xp from spelling.games where player_id = p_player_id;
  select coalesce(sum(cost), 0) into v_spent from spelling.cosmetics where player_id = p_player_id;
  return json_build_object('ok', true, 'coins', v_xp - v_spent,
    'owned', coalesce((select json_agg(json_build_object('item', item_id, 'equipped', equipped) order by acquired_at)
                       from spelling.cosmetics where player_id = p_player_id), '[]'::json));
end $$;

create or replace function spelling.buy_cosmetic(p_player_id uuid, p_pin text, p_item text)
returns json language plpgsql security definer
set search_path = spelling, arcade, pg_temp
as $$
declare v_price int; v_xp numeric; v_spent int; v_coins numeric;
begin
  if not arcade.check_player(p_player_id, p_pin) then
    return json_build_object('ok', false, 'error', 'Invalid player credentials.');
  end if;
  v_price := spelling._cosmetic_price(p_item);
  if v_price is null then return json_build_object('ok', false, 'error', 'Unknown item.'); end if;
  if exists(select 1 from spelling.cosmetics where player_id = p_player_id and item_id = p_item) then
    return json_build_object('ok', false, 'error', 'You already own this one!');
  end if;
  select coalesce(sum(score), 0) into v_xp from spelling.games where player_id = p_player_id;
  select coalesce(sum(cost), 0) into v_spent from spelling.cosmetics where player_id = p_player_id;
  v_coins := v_xp - v_spent;
  if v_coins < v_price then
    return json_build_object('ok', false, 'error', 'Not enough coins yet — keep playing!');
  end if;
  insert into spelling.cosmetics (player_id, item_id, cost) values (p_player_id, p_item, v_price);
  return json_build_object('ok', true, 'coins', v_coins - v_price, 'bought', p_item);
end $$;

-- Equip one owned item (empty/null item unequips everything).
create or replace function spelling.equip_cosmetic(p_player_id uuid, p_pin text, p_item text)
returns json language plpgsql security definer
set search_path = spelling, arcade, pg_temp
as $$
begin
  if not arcade.check_player(p_player_id, p_pin) then
    return json_build_object('ok', false, 'error', 'Invalid player credentials.');
  end if;
  if p_item is null or p_item = '' then
    update spelling.cosmetics set equipped = false where player_id = p_player_id;
    return json_build_object('ok', true, 'equipped', null);
  end if;
  if not exists(select 1 from spelling.cosmetics where player_id = p_player_id and item_id = p_item) then
    return json_build_object('ok', false, 'error', 'You do not own this one.');
  end if;
  update spelling.cosmetics set equipped = (item_id = p_item) where player_id = p_player_id;
  return json_build_object('ok', true, 'equipped', p_item);
end $$;

-- Distinct words ever spelled correctly, per grade (Pokédex-style collection).
create or replace function spelling.get_collection(p_player_id uuid, p_pin text)
returns json language plpgsql security definer
set search_path = spelling, arcade, pg_temp
as $$
begin
  if not arcade.check_player(p_player_id, p_pin) then
    return json_build_object('ok', false, 'error', 'Invalid player credentials.');
  end if;
  return json_build_object('ok', true, 'grades', coalesce((
    select json_agg(json_build_object('grade', grade, 'mastered', cnt) order by grade) from (
      select g.grade, count(distinct gw.word) as cnt
      from spelling.game_words gw join spelling.games g on g.id = gw.game_id
      where g.player_id = p_player_id and (gw.first_try_correct or coalesce(gw.retry_correct, false))
      group by g.grade
    ) t), '[]'::json));
end $$;

-- Leaderboard now also returns each player's equipped bee accessory (social flex).
create or replace function spelling.get_leaderboard(p_grade int)
returns json language sql security definer
set search_path = spelling, arcade, pg_temp
as $$
  select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
    select p.name, g.score, g.max_score, g.played_at::date as played_on,
           (select c.item_id from spelling.cosmetics c where c.player_id = p.id and c.equipped limit 1) as bee
    from spelling.games g join arcade.players p on p.id = g.player_id
    where g.grade = p_grade
    order by g.score desc, g.played_at asc
    limit 10
  ) t;
$$;

grant execute on function spelling.get_cosmetics(uuid, text) to anon, authenticated;
grant execute on function spelling.buy_cosmetic(uuid, text, text) to anon, authenticated;
grant execute on function spelling.equip_cosmetic(uuid, text, text) to anon, authenticated;
grant execute on function spelling.get_collection(uuid, text) to anon, authenticated;
grant execute on function spelling.get_leaderboard(int) to anon, authenticated;
