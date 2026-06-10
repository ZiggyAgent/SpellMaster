// SpellMaster game logic. Backend: Supabase "Kids Games" project, accessed
// exclusively through RPC functions in the `arcade` (accounts) and `spelling`
// (game data) schemas. The anon key is public by design; tables are locked
// behind SECURITY DEFINER functions.

const SUPA_URL = "https://jdmjfwuugddkyzsazwzg.supabase.co";
const SUPA_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkbWpmd3V1Z2Rka3l6c2F6d3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3ODA4NTYsImV4cCI6MjA5MjM1Njg1Nn0.G1HPQabERHzyQdvX66_r8Rj71MsflfQavUE76UrBJS4";

async function rpc(schema, fn, args) {
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPA_ANON,
      Authorization: `Bearer ${SUPA_ANON}`,
      "Content-Type": "application/json",
      "Content-Profile": schema,
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Server error (${res.status})`);
  return res.json();
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const PLAYER_KEY = "spellmaster_player";
const GRADE_KEY = "spellmaster_grade";

let player = null; // { id, name, pin }
let game = null;   // current round state

const $ = (id) => document.getElementById(id);

function show(screenId) {
  document.querySelectorAll(".screen").forEach((s) => (s.hidden = true));
  $(screenId).hidden = false;
}

function fmt(n) {
  const x = Number(n);
  return Number.isInteger(x) ? String(x) : x.toFixed(1);
}

// ---------------------------------------------------------------------------
// Speech
// ---------------------------------------------------------------------------
const canSpeak = "speechSynthesis" in window;
let cachedVoice = null;

// Prefer the highest-quality English voice the device offers. On macOS,
// downloadable "Premium"/"Enhanced" voices (System Settings -> Accessibility
// -> Spoken Content) are picked up automatically once installed.
function voiceRank(v) {
  const n = v.name.toLowerCase();
  if (/natural|neural/.test(n)) return 0;          // Edge online natural voices
  if (/premium|enhanced/.test(n)) return 1;        // macOS/iOS downloaded voices
  if (/\b(ava|zoe|allison|samantha|nicky|joelle)\b/.test(n)) return 2; // better Apple voices
  if (/google us english/.test(n)) return 3;       // Chrome
  if (v.lang === "en-US") return 4;
  return 5;
}

function pickVoice() {
  const en = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  en.sort((a, b) => voiceRank(a) - voiceRank(b));
  return en[0] || null;
}

if (canSpeak) {
  cachedVoice = pickVoice();
  speechSynthesis.onvoiceschanged = () => { cachedVoice = pickVoice(); };
}

function utter(text, rate) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = rate;
  if (cachedVoice) u.voice = cachedVoice;
  speechSynthesis.speak(u);
}

function sayCurrentWord(slow = false) {
  if (!canSpeak || !game) return;
  const item = game.queue[game.index];
  const wordRate = slow ? 0.45 : 0.65;
  const sentenceRate = slow ? 0.7 : 0.85;
  speechSynthesis.cancel();
  utter(item.w + ".", wordRate);   // the word: slow and clear
  utter(item.s, sentenceRate);     // the sentence: a bit slower than normal speech
  utter(item.w + ".", wordRate);
}

// Lookup for practice mode: any word ever missed can be found in the bank
const WORD_INDEX = new Map();
for (const words of Object.values(WORD_BANK)) {
  for (const item of words) WORD_INDEX.set(item.w.toLowerCase(), item);
}

// ---------------------------------------------------------------------------
// Auth — one form for everyone; the server tells us if the name is new.
// An unknown name needs an explicit second click ("Create my account") so a
// typo never silently creates an account.
// ---------------------------------------------------------------------------
let pendingCreate = false;

function resetAuthMode() {
  pendingCreate = false;
  $("auth-submit").textContent = "Let's Go";
  $("auth-notice").hidden = true;
  $("auth-error").hidden = true;
}

["auth-name", "auth-pin"].forEach((id) =>
  $(id).addEventListener("input", resetAuthMode)
);

$("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("auth-name").value.trim();
  const pin = $("auth-pin").value.trim();
  const errEl = $("auth-error");
  errEl.hidden = true;
  $("auth-submit").disabled = true;
  try {
    const r = await rpc("arcade", "enter", { p_name: name, p_pin: pin, p_create: pendingCreate });
    if (r.ok) {
      player = { id: r.player_id, name: r.name, pin, admin: !!r.is_admin };
      localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
      enterHome(r.status === "created");
      resetAuthMode();
      return;
    }
    if (r.status === "not_found") {
      pendingCreate = true;
      $("auth-notice").textContent = `We haven't met "${name}" yet! Press "Create my account" to join — or fix the spelling if that's not quite your name.`;
      $("auth-notice").hidden = false;
      $("auth-submit").textContent = "Create my account";
      return;
    }
    errEl.textContent = r.error;
    errEl.hidden = false;
  } catch (err) {
    errEl.textContent = "Could not reach the game server. Check your internet and try again.";
    errEl.hidden = false;
  } finally {
    $("auth-submit").disabled = false;
  }
});

$("btn-signout").addEventListener("click", () => {
  localStorage.removeItem(PLAYER_KEY);
  player = null;
  $("auth-name").value = "";
  $("auth-pin").value = "";
  resetAuthMode();
  show("screen-auth");
});

// Sign out a session that's no longer valid on the server, and say why —
// players should never be silently stranded or silently logged out.
function forceSignOut(message) {
  localStorage.removeItem(PLAYER_KEY);
  player = null;
  game = null;
  $("auth-name").value = "";
  $("auth-pin").value = "";
  resetAuthMode();
  $("auth-notice").textContent = message;
  $("auth-notice").hidden = false;
  show("screen-auth");
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
function fillGradeSelect(sel) {
  sel.innerHTML = "";
  for (let g = 1; g <= 12; g++) {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = `Grade ${g}`;
    sel.appendChild(opt);
  }
}
fillGradeSelect($("grade-select"));
fillGradeSelect($("lb-grade-select"));

function enterHome(isNew = false) {
  $("home-name").textContent = player.name;
  $("home-new").hidden = !isNew;
  $("home-msg").hidden = true;
  $("btn-admin-feedback").hidden = !player.admin;
  $("grade-select").value = localStorage.getItem(GRADE_KEY) || "1";
  $("tts-note").hidden = canSpeak;
  show("screen-home");
}

$("grade-select").addEventListener("change", (e) => localStorage.setItem(GRADE_KEY, e.target.value));

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------
function pickWords(grade, count) {
  const pool = [...WORD_BANK[grade]];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function startGame() {
  const grade = Number($("grade-select").value);
  game = {
    mode: "scored",
    grade,
    round: "main", // "main" | "retry"
    queue: pickWords(grade, 10),
    index: 0,
    score: 0,
    results: [], // { w, s, p, first_try_correct, retry_correct, earned }
  };
  $("game-round").hidden = true;
  $("game-points").hidden = false;
  $("score-line").hidden = false;
  $("game-score").textContent = "0";
  show("screen-game");
  nextWordUI();
}

// Practice mode: drill this player's own tricky words. Unscored, never saved,
// and a word missed during practice comes back once more at the end.
async function startPractice() {
  $("home-msg").hidden = true;
  try {
    const r = await rpc("spelling", "get_missed_words", { p_player_id: player.id, p_pin: player.pin });
    if (!r.ok) {
      $("home-msg").textContent = "Couldn't load your tricky words — try signing out and back in.";
      $("home-msg").hidden = false;
      return;
    }
    const entries = r.words.map((x) => WORD_INDEX.get(x.word.toLowerCase())).filter(Boolean);
    if (!entries.length) {
      $("home-msg").textContent = "No tricky words yet — play a game first! 🎉";
      $("home-msg").hidden = false;
      return;
    }
    game = {
      mode: "practice",
      round: "main",
      queue: entries.slice(0, 10), // most-missed first (server sorts by miss count)
      index: 0,
      results: [],      // { w, s, p, first_try_correct }
      requeued: new Set(),
    };
    $("game-round").hidden = true;
    $("game-points").hidden = true;
    $("score-line").hidden = true;
    show("screen-game");
    nextWordUI();
  } catch {
    $("home-msg").textContent = "Could not reach the game server. Check your internet and try again.";
    $("home-msg").hidden = false;
  }
}

function nextWordUI() {
  const item = game.queue[game.index];
  const total = game.queue.length;
  const label = game.mode === "practice" ? "Practice" : game.round === "main" ? "Word" : "Retry";
  $("game-progress").textContent = `${label} ${game.index + 1} of ${total}`;
  const pts = game.round === "main" ? item.p : item.p / 2;
  $("game-points").textContent = `Worth ${fmt(pts)} points`;
  $("game-input").disabled = false;
  $("game-input").value = "";
  $("game-feedback").hidden = true;
  $("btn-continue").hidden = true;
  $("game-input").focus();
  sayCurrentWord();
}

function showFeedback(correct, earned, word) {
  const el = $("game-feedback");
  el.className = "feedback " + (correct ? "good" : "bad");
  if (correct) {
    el.innerHTML = earned === null ? "✅ Correct!" : `✅ Correct! +${fmt(earned)} points`;
  } else {
    el.innerHTML = `❌ Not quite! It's spelled:<span class="spelled">${word.toUpperCase()}</span>`;
  }
  el.hidden = false;
}

let advancing = false;

$("game-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (advancing || !game) return;
  const guess = $("game-input").value.trim().toLowerCase();
  if (!guess) return;
  const item = game.queue[game.index];
  const correct = guess === item.w.toLowerCase();

  if (game.mode === "practice") {
    if (!game.results.some((r) => r.w === item.w)) {
      game.results.push({ ...item, first_try_correct: correct });
    }
    showFeedback(correct, null, item.w);
    advancing = true;
    if (correct) {
      setTimeout(advanceWord, 1100);
    } else {
      if (!game.requeued.has(item.w)) {
        game.requeued.add(item.w);
        game.queue.push(item); // one more try at the end of the session
      }
      $("game-input").disabled = true;
      $("btn-continue").hidden = false;
      $("btn-continue").focus();
    }
    return;
  }

  let earned = 0;
  if (game.round === "main") {
    earned = correct ? item.p : 0;
    game.results.push({ ...item, first_try_correct: correct, retry_correct: null, earned });
  } else {
    earned = correct ? item.p / 2 : 0;
    const r = game.results.find((x) => x.w === item.w);
    r.retry_correct = correct;
    r.earned = earned;
  }
  game.score += earned;
  $("game-score").textContent = fmt(game.score);
  showFeedback(correct, earned, item.w);
  advancing = true;

  if (correct) {
    // Correct answers move on by themselves; misses wait for "Continue" so
    // there's time to study the right spelling.
    setTimeout(advanceWord, 1100);
  } else {
    $("game-input").disabled = true;
    $("btn-continue").hidden = false;
    $("btn-continue").focus();
  }
});

function advanceWord() {
  if (!game) return;
  advancing = false;
  game.index++;
  if (game.index < game.queue.length) {
    nextWordUI();
    return;
  }
  if (game.mode === "practice") {
    finishPractice();
    return;
  }
  if (game.round === "main") {
    const missed = game.results.filter((r) => !r.first_try_correct);
    if (missed.length > 0) {
      game.round = "retry";
      game.queue = missed.map((r) => ({ w: r.w, s: r.s, p: r.p }));
      game.index = 0;
      $("game-round").hidden = false;
      nextWordUI();
      return;
    }
  }
  finishGame();
}

$("btn-continue").addEventListener("click", advanceWord);
$("btn-hear").addEventListener("click", () => sayCurrentWord(false));
$("btn-hear-slow").addEventListener("click", () => sayCurrentWord(true));

function finishPractice() {
  if (canSpeak) speechSynthesis.cancel();
  const total = game.results.length;
  const good = game.results.filter((r) => r.first_try_correct).length;
  $("result-title").textContent = "🎯 Practice Complete!";
  $("result-summary").innerHTML =
    `You spelled <strong>${good}</strong> of <strong>${total}</strong> tricky words right on the first try`;
  const list = $("result-words");
  list.innerHTML = "";
  for (const r of game.results) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${r.first_try_correct ? "✅" : "❌"} ${r.w}</span>`;
    list.appendChild(li);
  }
  $("result-lb-card").hidden = true;
  $("btn-play-again").textContent = "🎯 Practice Again";
  lastMode = "practice";
  show("screen-results");
}

async function finishGame() {
  if (canSpeak) speechSynthesis.cancel();
  const words = game.results.map((r) => ({
    word: r.w,
    points: r.p,
    first_try_correct: r.first_try_correct,
    retry_correct: r.retry_correct,
  }));
  const maxScore = game.results.reduce((s, r) => s + r.p, 0);

  $("result-title").textContent = "🎉 Round Complete!";
  $("result-summary").innerHTML =
    `You scored <strong>${fmt(game.score)}</strong> out of ${fmt(maxScore)} points`;
  $("result-lb-card").hidden = false;
  $("btn-play-again").textContent = "▶️ Play Again";
  lastMode = "scored";
  const list = $("result-words");
  list.innerHTML = "";
  for (const r of game.results) {
    const li = document.createElement("li");
    const badge = r.first_try_correct ? "✅" : r.retry_correct ? "🔁" : "❌";
    li.innerHTML = `<span>${badge} ${r.w}</span><span class="pts">+${fmt(r.earned)} / ${fmt(r.p)}</span>`;
    list.appendChild(li);
  }
  $("result-lb-title").textContent = `🏆 Top 10 — Grade ${game.grade}`;
  $("result-lb-congrats").hidden = true;
  show("screen-results");

  try {
    const saved = await rpc("spelling", "save_game", {
      p_player_id: player.id,
      p_pin: player.pin,
      p_grade: game.grade,
      p_words: words,
    });
    if (!saved.ok) {
      $("result-lb-congrats").textContent =
        "⚠️ Your score could NOT be saved — your sign-in is out of date. Sign out, sign back in, and play again.";
      $("result-lb-congrats").hidden = false;
      const lb = await rpc("spelling", "get_leaderboard", { p_grade: game.grade });
      renderLeaderboard($("result-lb-table").querySelector("tbody"), lb, null);
      return;
    }
    const lb = await rpc("spelling", "get_leaderboard", { p_grade: game.grade });
    const madeIt = saved.ok && lb.some((row) => row.name === player.name && Number(row.score) === Number(saved.score));
    $("result-lb-congrats").hidden = !madeIt;
    renderLeaderboard($("result-lb-table").querySelector("tbody"), lb, saved.ok ? Number(saved.score) : null);
  } catch (err) {
    $("result-lb-table").querySelector("tbody").innerHTML =
      `<tr><td colspan="4">Couldn't save your game — check your internet. 😢</td></tr>`;
  }
}

function renderLeaderboard(tbody, rows, highlightScore) {
  tbody.innerHTML = "";
  rows.forEach((row, i) => {
    const tr = document.createElement("tr");
    const isMe = player && row.name === player.name && highlightScore !== null && Number(row.score) === highlightScore;
    if (isMe) tr.className = "me";
    const medal = ["🥇", "🥈", "🥉"][i] || `${i + 1}`;
    tr.innerHTML = `<td>${medal}</td><td>${escapeHtml(row.name)}</td><td>${fmt(row.score)} / ${fmt(row.max_score)}</td><td>${row.played_on}</td>`;
    tbody.appendChild(tr);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let lastMode = "scored";

$("btn-start").addEventListener("click", startGame);
$("btn-practice").addEventListener("click", startPractice);
$("btn-play-again").addEventListener("click", () => (lastMode === "practice" ? startPractice() : startGame()));
$("btn-results-home").addEventListener("click", () => enterHome());

// ---------------------------------------------------------------------------
// Leaderboard screen
// ---------------------------------------------------------------------------
async function loadLeaderboard() {
  const grade = Number($("lb-grade-select").value);
  const tbody = $("lb-table").querySelector("tbody");
  tbody.innerHTML = `<tr><td colspan="4">Loading…</td></tr>`;
  try {
    const lb = await rpc("spelling", "get_leaderboard", { p_grade: grade });
    $("lb-empty").hidden = lb.length > 0;
    renderLeaderboard(tbody, lb, null);
  } catch {
    tbody.innerHTML = `<tr><td colspan="4">Couldn't load — check your internet.</td></tr>`;
  }
}

$("btn-leaderboard").addEventListener("click", () => {
  $("lb-grade-select").value = $("grade-select").value;
  show("screen-leaderboard");
  loadLeaderboard();
});
$("lb-grade-select").addEventListener("change", loadLeaderboard);
$("btn-lb-home").addEventListener("click", () => enterHome());

// ---------------------------------------------------------------------------
// History screen
// ---------------------------------------------------------------------------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
    ["games", "words", "bests"].forEach((t) => ($("tab-" + t).hidden = t !== btn.dataset.tab));
  });
});

async function loadHistory() {
  const creds = { p_player_id: player.id, p_pin: player.pin };
  $("history-games").innerHTML = `<tr><td colspan="4">Loading…</td></tr>`;
  $("history-words").innerHTML = "";
  $("history-bests").innerHTML = "";
  try {
    const [hist, missed, bests] = await Promise.all([
      rpc("spelling", "get_history", creds),
      rpc("spelling", "get_missed_words", creds),
      rpc("spelling", "get_personal_bests", creds),
    ]);

    const games = hist.ok ? hist.games : [];
    $("history-games").innerHTML = "";
    $("history-games-empty").hidden = games.length > 0;
    for (const g of games) {
      const tr = document.createElement("tr");
      const missedWords = g.missed_words.map((m) => m.word).join(", ") || "—";
      const date = new Date(g.played_at).toLocaleDateString();
      tr.innerHTML = `<td>${date}</td><td>${g.grade}</td><td>${fmt(g.score)} / ${fmt(g.max_score)}</td><td>${escapeHtml(missedWords)}</td>`;
      $("history-games").appendChild(tr);
    }

    const words = missed.ok ? missed.words : [];
    $("history-words-empty").hidden = words.length > 0;
    for (const w of words) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(w.word)}</td><td>${w.times_missed}</td><td>${w.last_missed}</td>`;
      $("history-words").appendChild(tr);
    }

    const bestRows = bests.ok ? bests.bests : [];
    $("history-bests-empty").hidden = bestRows.length > 0;
    for (const b of bestRows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>Grade ${b.grade}</td><td>${fmt(b.best_score)}</td><td>${b.games_played}</td>`;
      $("history-bests").appendChild(tr);
    }
  } catch {
    $("history-games").innerHTML = `<tr><td colspan="4">Couldn't load — check your internet.</td></tr>`;
  }
}

$("btn-history").addEventListener("click", () => {
  show("screen-history");
  loadHistory();
});
$("btn-history-home").addEventListener("click", () => enterHome());

// ---------------------------------------------------------------------------
// Feedback (players) + admin inbox (parent account flagged is_admin in DB)
// ---------------------------------------------------------------------------
$("btn-feedback").addEventListener("click", () => {
  $("feedback-text").value = "";
  $("feedback-msg").hidden = true;
  show("screen-feedback");
  $("feedback-text").focus();
});
$("btn-feedback-home").addEventListener("click", () => enterHome());

$("btn-send-feedback").addEventListener("click", async () => {
  const msg = $("feedback-text").value.trim();
  if (!msg) return;
  $("btn-send-feedback").disabled = true;
  try {
    const r = await rpc("arcade", "submit_feedback", {
      p_player_id: player.id, p_pin: player.pin, p_game: "spelling", p_message: msg,
    });
    if (r.ok) {
      enterHome();
      $("home-msg").textContent = "Thanks! Your feedback was sent. 💛";
      $("home-msg").hidden = false;
    } else {
      $("feedback-msg").textContent = r.error;
      $("feedback-msg").hidden = false;
    }
  } catch {
    $("feedback-msg").textContent = "Could not reach the game server — try again.";
    $("feedback-msg").hidden = false;
  } finally {
    $("btn-send-feedback").disabled = false;
  }
});

$("btn-admin-feedback").addEventListener("click", async () => {
  show("screen-admin");
  const tbody = $("admin-feedback-rows");
  tbody.innerHTML = `<tr><td colspan="3">Loading…</td></tr>`;
  $("admin-empty").hidden = true;
  try {
    const r = await rpc("arcade", "get_feedback", { p_player_id: player.id, p_pin: player.pin });
    tbody.innerHTML = "";
    if (!r.ok) {
      tbody.innerHTML = `<tr><td colspan="3">${escapeHtml(r.error)}</td></tr>`;
      return;
    }
    $("admin-empty").hidden = r.feedback.length > 0;
    for (const f of r.feedback) {
      const tr = document.createElement("tr");
      const date = new Date(f.created_at).toLocaleDateString();
      tr.innerHTML = `<td>${date}</td><td>${escapeHtml(f.name)}</td><td>${escapeHtml(f.message)}</td>`;
      tbody.appendChild(tr);
    }
  } catch {
    tbody.innerHTML = `<tr><td colspan="3">Couldn't load — check your internet.</td></tr>`;
  }
});
$("btn-admin-home").addEventListener("click", () => enterHome());

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async function boot() {
  const saved = localStorage.getItem(PLAYER_KEY);
  if (saved) {
    try {
      player = JSON.parse(saved);
    } catch {
      player = null;
    }
  }
  if (!player) {
    show("screen-auth");
    return;
  }
  enterHome();
  // Re-validate the saved session in the background so an account change on
  // the server (or an app update) never leaves a stale session failing
  // silently. Offline? Keep the cached session and let them play.
  try {
    const r = await rpc("arcade", "enter", { p_name: player.name, p_pin: player.pin, p_create: false });
    if (r.ok) {
      if (r.player_id !== player.id || player.admin !== !!r.is_admin) {
        player.id = r.player_id;
        player.admin = !!r.is_admin;
        localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
        $("btn-admin-feedback").hidden = !player.admin;
      }
    } else {
      forceSignOut("You were signed out because your account changed on the server. Please sign in again — sorry about that!");
    }
  } catch { /* network hiccup — keep the cached session */ }
})();
