-- Unified sign-in/sign-up: one form, the server decides.
-- Flow: client calls enter(name, pin) with p_create=false.
--   - name exists + PIN matches  -> ok, status 'existing'
--   - name exists + PIN wrong    -> error, status 'wrong_pin'
--   - name unknown               -> status 'not_found' (client asks "create account?")
-- Client confirms, calls again with p_create=true -> creates, status 'created'.
-- Name matching is case-insensitive; stored casing is returned on login.

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
      return json_build_object('ok', true, 'status', 'existing', 'player_id', v_player.id, 'name', v_player.name);
    end if;
    return json_build_object('ok', false, 'status', 'wrong_pin',
      'error', 'That name already exists, but the PIN is wrong. Ask a parent if you forgot it!');
  end if;

  if not p_create then
    return json_build_object('ok', false, 'status', 'not_found');
  end if;

  insert into arcade.players (name, pin) values (v_name, p_pin) returning * into v_player;
  return json_build_object('ok', true, 'status', 'created', 'player_id', v_player.id, 'name', v_player.name);
end $$;

grant execute on function arcade.enter(text, text, boolean) to anon, authenticated;
