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
  if (item.s) utter(item.s, sentenceRate); // sentence (tutorial quiz words have none)
  utter(item.w + ".", wordRate);
}

// Lookup for practice mode: any word ever missed can be found in the bank,
// along with the grade it belongs to (words are unique across grades).
const WORD_INDEX = new Map();
for (const [grade, words] of Object.entries(WORD_BANK)) {
  for (const item of words) WORD_INDEX.set(item.w.toLowerCase(), { ...item, grade: Number(grade) });
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

// Practice mode: drill this player's own tricky words. The setup screen shows
// every grade with its tricky-word count (0 included) and lets the player
// select any combination of levels, or all of them. Sessions are unscored,
// never saved, and a word missed during practice comes back once more at the
// end.
let practiceData = null; // { all: entries[], byGrade: Map<grade, entries[]>, selected: Set<grade> }

async function openPracticeSetup() {
  $("home-msg").hidden = true;
  try {
    const r = await rpc("spelling", "get_missed_words", { p_player_id: player.id, p_pin: player.pin });
    if (!r.ok) {
      $("home-msg").textContent = "Couldn't load your tricky words — try signing out and back in.";
      $("home-msg").hidden = false;
      return;
    }
    // server returns most-missed first; keep that order for session building
    const all = r.words.map((x) => WORD_INDEX.get(x.word.toLowerCase())).filter(Boolean);
    const byGrade = new Map();
    for (let g = 1; g <= 12; g++) byGrade.set(g, []);
    for (const e of all) byGrade.get(e.grade).push(e);
    // keep the previous selection when it still has words; default to the home grade
    const prev = practiceData ? [...practiceData.selected] : [Number($("grade-select").value)];
    const selected = new Set(prev.filter((g) => byGrade.get(g)?.length));
    practiceData = { all, byGrade, selected };
    renderPracticeSetup();
    show("screen-practice-setup");
  } catch {
    $("home-msg").textContent = "Could not reach the game server. Check your internet and try again.";
    $("home-msg").hidden = false;
  }
}

function renderPracticeSetup() {
  const { all, byGrade, selected } = practiceData;
  const withWords = [...byGrade.entries()].filter(([, e]) => e.length).map(([g]) => g);
  const grid = $("practice-grades");
  grid.innerHTML = "";

  const allOn = withWords.length > 0 && withWords.every((g) => selected.has(g));
  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "grade-chip" + (allOn ? " selected" : "");
  allChip.disabled = withWords.length === 0;
  allChip.innerHTML = `All levels<span class="cnt">${all.length} word${all.length === 1 ? "" : "s"}</span>`;
  allChip.addEventListener("click", () => {
    selected.clear();
    if (!allOn) withWords.forEach((g) => selected.add(g));
    renderPracticeSetup();
  });
  grid.appendChild(allChip);

  for (let g = 1; g <= 12; g++) {
    const n = byGrade.get(g).length;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "grade-chip" + (selected.has(g) ? " selected" : "");
    chip.disabled = n === 0;
    chip.innerHTML = `Grade ${g}<span class="cnt">${n} word${n === 1 ? "" : "s"}</span>`;
    chip.addEventListener("click", () => {
      if (selected.has(g)) selected.delete(g);
      else selected.add(g);
      renderPracticeSetup();
    });
    grid.appendChild(chip);
  }

  const total = [...selected].reduce((s, g) => s + byGrade.get(g).length, 0);
  $("practice-summary").textContent =
    all.length === 0
      ? "No tricky words yet — play a game first! 🎉"
      : total === 0
        ? "Pick at least one level to practice."
        : `${total} tricky word${total === 1 ? "" : "s"} selected — a session drills up to 10, most-missed first.`;
  $("btn-start-practice").disabled = total === 0;
}

function startPracticeSession() {
  const { all, byGrade, selected } = practiceData;
  const entries = all.filter((e) => selected.has(e.grade)).slice(0, 10);
  if (!entries.length) return;
  const sel = [...selected].sort((a, b) => a - b);
  const withWords = [...byGrade.entries()].filter(([, e]) => e.length).map(([g]) => g);
  const label = sel.length === 1
    ? `Grade ${sel[0]}`
    : sel.length === withWords.length
      ? "all levels"
      : `Grades ${sel.join(", ")}`;
  startDrill(entries, `🎯 Practicing ${label}`, "practice");
}

// Shared engine for unscored drills (practice sessions and tutorial quizzes)
function startDrill(entries, pillLabel, origin) {
  game = {
    mode: "practice",
    origin,           // "practice" | "tutorial" — decides where Play Again leads
    round: "main",
    queue: entries,
    index: 0,
    results: [],      // { w, s, p, first_try_correct }
    requeued: new Set(),
  };
  $("game-round").textContent = pillLabel;
  $("game-round").hidden = false;
  $("game-points").hidden = true;
  $("score-line").hidden = true;
  show("screen-game");
  nextWordUI();
}

$("btn-start-practice").addEventListener("click", startPracticeSession);
$("btn-practice-home").addEventListener("click", () => enterHome());

// ---------------------------------------------------------------------------
// Tutorials: spelling tips & tricks per grade, with tappable spoken examples
// and an unscored end-of-tutorial spelling quiz.
// ---------------------------------------------------------------------------
fillGradeSelect($("tut-grade-select"));
let currentTutorial = null;

function renderTutorialList() {
  const grade = Number($("tut-grade-select").value);
  const list = $("tutorial-list");
  list.innerHTML = "";
  for (const t of TUTORIALS[grade]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tutorial-item";
    btn.innerHTML = `${escapeHtml(t.title)}<span class="sub">${escapeHtml(t.patterns.map((p) => p.name).join("  ·  "))}</span>`;
    btn.addEventListener("click", () => openTutorial(t));
    list.appendChild(btn);
  }
}

function openTutorial(t) {
  currentTutorial = t;
  $("tut-title").textContent = `📚 ${t.title}`;
  $("tut-intro").textContent = t.intro;
  const wrap = $("tut-patterns");
  wrap.innerHTML = "";
  for (const p of t.patterns) {
    const card = document.createElement("div");
    card.className = "card pattern-card";
    card.innerHTML = `<div class="pattern-head"><h2>${escapeHtml(p.name)}</h2>` +
      `<button type="button" class="btn-listen">🔊 Listen</button></div>` +
      `<p class="pattern-tip">${escapeHtml(p.tip)}</p>` +
      `<div class="word-chips">` +
      p.words.map((w) => `<button type="button" class="word-chip">${escapeHtml(w)}</button>`).join("") +
      `</div>`;
    // Read the tip, then each example word slowly so the target sound stands out
    card.querySelector(".btn-listen").addEventListener("click", () => {
      if (!canSpeak) return;
      speechSynthesis.cancel();
      utter(p.tip, 0.9);
      utter("For example:", 0.95);
      for (const w of p.words) utter(w + ".", 0.6);
    });
    wrap.appendChild(card);
  }
  wrap.querySelectorAll(".word-chip").forEach((chip) =>
    chip.addEventListener("click", () => {
      if (!canSpeak) return;
      speechSynthesis.cancel();
      utter(chip.textContent, 0.7);
    })
  );
  show("screen-tutorial");
}

$("btn-tutorials").addEventListener("click", () => {
  $("tut-grade-select").value = $("grade-select").value;
  renderTutorialList();
  show("screen-tutorials");
});
$("tut-grade-select").addEventListener("change", renderTutorialList);
$("btn-tutorials-home").addEventListener("click", () => enterHome());
$("btn-tut-back").addEventListener("click", () => show("screen-tutorials"));
$("btn-tut-home").addEventListener("click", () => enterHome());

$("btn-tut-quiz").addEventListener("click", () => {
  const words = currentTutorial.patterns.flatMap((p) => p.words);
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }
  const entries = words.slice(0, 8).map((w) => ({ w, s: "", p: 10 }));
  startDrill(entries, `📚 ${currentTutorial.title}`, "tutorial");
});

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
  quitArmed = false;
  $("btn-quit").textContent = "🏠 Exit";
  $("game-input").focus();
  sayCurrentWord();
}

// Exiting practice is instant; exiting a scored round needs a second tap so
// one stray touch can't throw away a game in progress (unfinished rounds are
// never saved).
let quitArmed = false;
$("btn-quit").addEventListener("click", () => {
  if (game && game.mode === "scored" && !quitArmed) {
    quitArmed = true;
    $("btn-quit").textContent = "Tap again to exit — this round won't be saved";
    setTimeout(() => {
      quitArmed = false;
      $("btn-quit").textContent = "🏠 Exit";
    }, 3000);
    return;
  }
  if (canSpeak) speechSynthesis.cancel();
  game = null;
  advancing = false;
  quitArmed = false;
  $("btn-quit").textContent = "🏠 Exit";
  enterHome();
});

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
      $("game-round").textContent = "🔁 Retry Round — half points!";
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
  $("btn-play-again").textContent = game.origin === "tutorial" ? "📚 Back to Tutorial" : "🎯 Practice Again";
  lastMode = game.origin;
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
$("btn-practice").addEventListener("click", openPracticeSetup);
$("btn-play-again").addEventListener("click", () => {
  if (lastMode === "practice") openPracticeSetup();
  else if (lastMode === "tutorial") show("screen-tutorial");
  else startGame();
});
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
document.querySelectorAll("#screen-history .tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#screen-history .tab").forEach((b) => b.classList.toggle("active", b === btn));
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

document.querySelectorAll("#screen-admin .tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#screen-admin .tab").forEach((b) => b.classList.toggle("active", b === btn));
    ["feedback", "usage"].forEach((t) => ($("atab-" + t).hidden = t !== btn.dataset.atab));
  });
});

async function loadAdminFeedback() {
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
}

async function loadAdminUsage() {
  const playersBody = $("admin-usage-players");
  const dailyBody = $("admin-usage-daily");
  playersBody.innerHTML = `<tr><td colspan="5">Loading…</td></tr>`;
  dailyBody.innerHTML = "";
  $("admin-usage-empty").hidden = true;
  try {
    const r = await rpc("spelling", "get_usage", { p_player_id: player.id, p_pin: player.pin });
    playersBody.innerHTML = "";
    if (!r.ok) {
      playersBody.innerHTML = `<tr><td colspan="5">${escapeHtml(r.error)}</td></tr>`;
      return;
    }
    for (const p of r.players) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(p.name)}</td><td>${p.games}</td><td>${p.avg_score ?? "—"}</td><td>${p.last_played ?? "—"}</td><td>${p.days_active}</td>`;
      playersBody.appendChild(tr);
    }
    $("admin-usage-empty").hidden = r.daily.length > 0;
    for (const d of r.daily) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${d.day}</td><td>${escapeHtml(d.name)}</td><td>${d.games}</td>`;
      dailyBody.appendChild(tr);
    }
  } catch {
    playersBody.innerHTML = `<tr><td colspan="5">Couldn't load — check your internet.</td></tr>`;
  }
}

$("btn-admin-feedback").addEventListener("click", () => {
  show("screen-admin");
  loadAdminFeedback();
  loadAdminUsage();
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
