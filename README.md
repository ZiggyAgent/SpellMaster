# 🐝 SpellMaster

A spelling game for kids. Words are read aloud (with an example sentence) using the
browser's built-in text-to-speech; the player types the spelling.

**Play it:** https://ziggyagent.github.io/SpellMaster/

## How it works

- Pick a grade level (1–12). Each round is 10 random words from that grade's word
  bank — no repeats within a round.
- Words are worth 10–25 points based on difficulty; you earn points only for
  correct spelling.
- Words missed on the first try come back in a **retry round** worth half points.
- Per-grade Top 10 leaderboards, full game history, a "tricky words" table
  (every word you've ever missed and how often), and personal bests per grade.
- Accounts are name + 4-digit PIN. Names are unique. PINs are stored in plain
  text **on purpose** so a parent can recover them from the database dashboard —
  don't reuse a PIN that matters anywhere else.

## Architecture

- **Frontend:** static HTML/CSS/JS, hosted on GitHub Pages. No build step.
- **Audio:** Web Speech API (`speechSynthesis`) — free, offline, no API key.
- **Backend:** the shared "Kids Games" Supabase project. Convention: one schema
  per game (`spelling` here) plus a shared `arcade` schema for player accounts
  used across games.
- **Security model:** tables have RLS enabled and no grants; all client access
  goes through `SECURITY DEFINER` RPC functions (see `supabase/001_arcade_and_spelling.sql`).
  The anon key in `app.js` is public by design.
- **Keep-alive:** the `supabase-keepalive` GitHub Action in the
  CapitalCityGlobeGame repo pings the shared project every 3 days so the free
  tier never pauses it.

## Word bank

`words.js` — ~30 words per grade with a spoken example sentence (sentences
disambiguate homophones like *eight*/*ate*) and a point value (10/15/20/25).
