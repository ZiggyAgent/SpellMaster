-- Admin-only usage stats for the in-app admin panel:
-- per-player totals plus games-per-day for the last 14 days.

create or replace function spelling.get_usage(p_player_id uuid, p_pin text)
returns json
language sql security definer
set search_path = spelling, arcade, pg_temp
as $$
  select case when not exists (
      select 1 from arcade.players where id = p_player_id and pin = p_pin and is_admin
    )
    then json_build_object('ok', false, 'error', 'Admins only.')
    else json_build_object('ok', true,
      'players', coalesce((select json_agg(row_to_json(t)) from (
        select p.name,
               count(g.id) as games,
               round(avg(g.score), 1) as avg_score,
               max(g.played_at)::date as last_played,
               count(distinct g.played_at::date) as days_active
        from arcade.players p
        left join spelling.games g on g.player_id = p.id
        group by p.name
        order by count(g.id) desc, p.name
      ) t), '[]'::json),
      'daily', coalesce((select json_agg(row_to_json(d)) from (
        select g.played_at::date as day, p.name, count(*) as games
        from spelling.games g
        join arcade.players p on p.id = g.player_id
        where g.played_at > now() - interval '14 days'
        group by g.played_at::date, p.name
        order by g.played_at::date desc, count(*) desc
      ) d), '[]'::json))
  end;
$$;

grant execute on function spelling.get_usage(uuid, text) to anon, authenticated;
