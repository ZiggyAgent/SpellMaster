# Kids Arcade — Playbook for building a new game

Instructions for an AI agent (or human) starting work on a new game in Tal's
kids arcade. Read this first; SpellMaster (this repo) is the reference
implementation for every pattern mentioned.

## What this is

A family arcade of small browser games for Tal's kids (~10 users max).
**Hard constraint: everything stays $0** — free tiers only. Flag anything
that risks a paid tier during planning, before building.

## Architecture (same for every game)

- **Frontend:** static HTML/CSS/JS, no build step. One public GitHub repo per
  game under the `ZiggyAgent` account, hosted on GitHub Pages at
  `https://ziggyagent.github.io/<RepoName>/`.
- **Backend:** ONE shared Supabase project for all games — **"Kids Games"**,
  ref `jdmjfwuugddkyzsazwzg`. Do NOT create new Supabase projects (free tier
  caps at 2 and both slots are used).
- **Audio (if needed):** Web Speech API — free, no key.

## Supabase conventions

- **One Postgres schema per game** (`spelling`, `mathfacts`, …) plus the shared
  **`arcade`** schema. Never put game tables in `public` (that's the old
  CapitalCity game).
- **Shared accounts live in `arcade`** — kids use ONE account across all games:
  - `arcade.players`: unique name (case-insensitive), 4-digit PIN stored in
    **plaintext on purpose** (Tal recovers forgotten PINs in the dashboard),
    `is_admin` flag (true for Tal's account).
  - `arcade.enter(name, pin, create)` — unified login/signup. Unknown name
    returns `not_found`; only create after the client confirms (typo guard).
  - `arcade.check_player(id, pin)` — internal credential check for game RPCs.
  - `arcade.feedback` + `submit_feedback`/`get_feedback` — shared feedback
    system; pass your game's name in `p_game`.
- **Security model:** RLS enabled on every table, NO grants to anon — all
  client access goes through `SECURITY DEFINER` RPC functions that validate
  player id + PIN. Admin-only RPCs check `is_admin` server-side. The anon key
  ships in client JS (public by design; it's in SpellMaster's `app.js`).
- **New schemas must be exposed to the API:** PATCH the PostgREST config
  (`db_schema` list) via the Management API — see below. Client calls RPCs
  with a `Content-Profile: <schema>` header (see `rpc()` helper in `app.js`).
- **Running SQL/DDL:** the personal access token is in
  `~/.supabase_access_token`. Use the Management API **with curl** (python
  urllib gets Cloudflare-blocked, error 1010):
  ```bash
  TOKEN=$(cat ~/.supabase_access_token); REF=jdmjfwuugddkyzsazwzg
  # run SQL (write the JSON body to a file to avoid quoting bugs)
  python3 -c "import json; open('/tmp/q.json','w').write(json.dumps({'query': open('supabase/001_init.sql').read()}))"
  curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
       -d @/tmp/q.json https://api.supabase.com/v1/projects/$REF/database/query
  # expose a new schema (GET current config first, then append)
  curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
       -d '{"db_schema":"public, graphql_public, arcade, spelling, <newschema>"}' \
       https://api.supabase.com/v1/projects/$REF/postgrest
  ```
- **Migrations are files:** save every SQL change as a numbered file in the
  repo's `supabase/` folder, then run it yourself via the API. Never leave DB
  work for Tal.
- **Keep-alive already exists** (GitHub Action in the CapitalCityGlobeGame
  repo pings the project every 3 days, project-wide). Don't add another.

## Git & hosting

- `gh` CLI is authenticated as ZiggyAgent. New game:
  ```bash
  gh repo create ZiggyAgent/<Name> --public --source=. --push
  gh api -X POST repos/ZiggyAgent/<Name>/pages -f "source[branch]=main" -f "source[path]=/"
  ```
- **Commit and push every response that produces results.** After pushing,
  poll the live URL until the deploy is confirmed (~60–90s) — don't claim
  "live" without checking.

## Working rules (Tal's standing preferences)

1. **Test from the user's perspective** in a real browser (preview tools):
   click through the actual flows, take screenshots. DOM-only checks miss
   real bugs (a CSS rule once overrode `hidden` — only a screenshot caught it).
   Check the console for errors. Clean up: delete ONLY your named test
   accounts/rows — **never blanket-delete**; real users appear within hours
   of deploying.
2. **Never force users to log out** on changes. Validate saved sessions on
   boot; if invalid, sign out WITH an explanation and self-heal when the same
   name+PIN exists again. Surface save failures loudly (see SpellMaster's
   `boot()` and `forceSignOut()`).
3. **Don't kill processes without asking.** Run migrations yourself.
4. **UX:** kid-friendly but not childish — clean modern look (see
   `style.css`: Outfit font, indigo/slate palette), big tap targets, one idea
   per screen, friendly error messages, an Exit button in any game loop
   (instant exit for no-stakes modes, two-tap confirm when progress would be
   lost). `[hidden] { display:none !important }` belongs in every stylesheet.
5. **Admin features** (feedback inbox, usage stats) are gated by
   `arcade.players.is_admin`, enforced server-side, surfaced in-app to Tal
   only. Reuse the pattern from SpellMaster's admin panel.
6. When designing scoring/leaderboards, compute scores **server-side** in the
   save RPC from raw per-item results (don't trust client totals).

## Reference

- SpellMaster live: https://ziggyagent.github.io/SpellMaster/
- SpellMaster repo: https://github.com/ZiggyAgent/SpellMaster (this repo —
  `app.js` for the rpc/auth/session patterns, `supabase/*.sql` for the schema
  and RPC patterns, `words.js` + the eval dup-check one-liner for content
  banks).
- Local path on Tal's machine: `/Users/tal/SpellMaster`
