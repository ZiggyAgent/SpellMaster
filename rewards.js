// Tier 2 rewards: badge definitions + the Speller Level ladder.
// Badge ids and criteria mirror spelling.sync_badges (server is the source of
// truth for what's earned; these are just labels/icons for display).

const BADGE_DEFS = {
  "first-game":    { e: "🎮", n: "Getting Started", d: "Play your first game" },
  "games-10":      { e: "🔟", n: "Regular",         d: "Play 10 games" },
  "games-50":      { e: "🏅", n: "Dedicated",       d: "Play 50 games" },
  "perfect-1":     { e: "💯", n: "Perfectionist",   d: "Get a perfect round" },
  "perfect-10":    { e: "🌟", n: "Flawless",        d: "Get 10 perfect rounds" },
  "streak-5":      { e: "🔥", n: "On Fire",         d: "Spell 5 in a row in one game" },
  "streak-10":     { e: "⚡", n: "Unstoppable",     d: "Spell 10 in a row in one game" },
  "bigword":       { e: "🧠", n: "Big Brain",       d: "Nail a 25-point word" },
  "collector-50":  { e: "📚", n: "Word Collector",  d: "Spell 50 different words" },
  "collector-200": { e: "📖", n: "Word Wizard",     d: "Spell 200 different words" },
  "explorer-5":    { e: "🗺️", n: "Explorer",        d: "Play 5 different grade levels" },
  "comeback":      { e: "💪", n: "Comeback Kid",    d: "Nail a word you once missed" },
};

// Display order for the trophy case.
const BADGE_ORDER = [
  "first-game", "games-10", "games-50",
  "perfect-1", "perfect-10", "streak-5", "streak-10",
  "bigword", "collector-50", "collector-200", "explorer-5", "comeback",
];

// Speller Level ladder. XP is the lifetime sum of game scores (~100–150/game).
const RANKS = [
  { min: 0,    icon: "🐣", name: "Novice Speller" },
  { min: 200,  icon: "🐝", name: "Busy Bee" },
  { min: 600,  icon: "🔎", name: "Word Scout" },
  { min: 1200, icon: "📘", name: "Spelling Pro" },
  { min: 2500, icon: "🏆", name: "Spelling Champion" },
  { min: 5000, icon: "🎓", name: "Spelling Master" },
  { min: 9000, icon: "👑", name: "Grand Master Speller" },
];

// Returns { level, rank, next, intoLevel, span, pct } for an XP total.
function rankFor(xp) {
  xp = Number(xp) || 0;
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (xp >= RANKS[k].min) i = k;
  const rank = RANKS[i];
  const next = RANKS[i + 1] || null;
  const intoLevel = xp - rank.min;
  const span = next ? next.min - rank.min : 0;
  const pct = next ? Math.min(100, Math.round((intoLevel / span) * 100)) : 100;
  return { level: i + 1, rank, next, intoLevel, span, pct };
}
