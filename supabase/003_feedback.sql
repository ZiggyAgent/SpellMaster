-- Feedback box + admin inbox.
-- Players submit free-text feedback; accounts flagged is_admin (the parent)
-- see a "View Feedback" inbox inside the app. The admin check happens
-- server-side in get_feedback, so nothing secret lives in the public JS.

alter table arcade.players add column if not exists is_admin boolean not null default false;
update arcade.players set is_admin = true where lower(name) = 'tal';

create table if not exists arcade.feedback (
  id bigint generated always as identity primary key,
  player_id uuid references arcade.players(id) on delete set null,
  game text not null default 'spelling',
  message text not null check (length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table arcade.feedback enable row level security;

-- enter() now also reports is_admin so the app knows to show the inbox button
create or replace function arcade.enter(p_name text, p_pin text, p_create boolean default false)
returns json
language plpgsql security definer
set search_path = arcade, pg_temp
as $$
declare
  v_name text := trim(p_name);
  v_player arcade.players%rowtype;
begin
  if v_name is null or length(v_name) < 2 or length(v_name) > 20 then
    return json_build_object('ok', false, 'status', 'invalid', 'error', 'Name must be 2-20 characters.');
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    return json_build_object('ok', false, 'status', 'invalid', 'error', 'PIN must be exactly 4 digits.');
  end if;

  select * into v_player from arcade.players where lower(name) = lower(v_name);
  if found then
    if v_player.pin = p_pin then
      return json_build_object('ok', true, 'status', 'existing', 'player_id', v_player.id,
                               'name', v_player.name, 'is_admin', v_player.is_admin);
    end if;
    return json_build_object('ok', false, 'status', 'wrong_pin',
      'error', 'That name already exists, but the PIN is wrong. Ask a parent if you forgot it!');
  end if;

  if not p_create then
    return json_build_object('ok', false, 'status', 'not_found');
  end if;

  insert into arcade.players (name, pin) values (v_name, p_pin) returning * into v_player;
  return json_build_object('ok', true, 'status', 'created', 'player_id', v_player.id,
                           'name', v_player.name, 'is_admin', v_player.is_admin);
end $$;

create or replace function arcade.submit_feedback(p_player_id uuid, p_pin text, p_game text, p_message text)
returns json
language plpgsql security definer
set search_path = arcade, pg_temp
as $$
begin
  if not arcade.check_player(p_player_id, p_pin) then
    return json_build_object('ok', false, 'error', 'Invalid player credentials.');
  end if;
  if p_message is null or length(trim(p_message)) < 1 or length(trim(p_message)) > 2000 then
    return json_build_object('ok', false, 'error', 'Feedback must be 1-2000 characters.');
  end if;
  insert into arcade.feedback (player_id, game, message) values (p_player_id, coalesce(p_game, 'spelling'), trim(p_message));
  return json_build_object('ok', true);
end $$;

create or replace function arcade.get_feedback(p_player_id uuid, p_pin text)
returns json
language sql security definer
set search_path = arcade, pg_temp
as $$
  select case when not exists (
      select 1 from arcade.players where id = p_player_id and pin = p_pin and is_admin
    )
    then json_build_object('ok', false, 'error', 'Admins only.')
    else json_build_object('ok', true, 'feedback', coalesce((
      select json_agg(row_to_json(t)) from (
        select f.id, f.game, f.message, f.created_at,
               coalesce(p.name, '(deleted account)') as name
        from arcade.feedback f
        left join arcade.players p on p.id = f.player_id
        order by f.created_at desc
      ) t), '[]'::json))
  end;
$$;

grant execute on function arcade.submit_feedback(uuid, text, text, text) to anon, authenticated;
grant execute on function arcade.get_feedback(uuid, text) to anon, authenticated;
