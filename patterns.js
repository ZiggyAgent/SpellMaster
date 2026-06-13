// Spelling-pattern categories for adaptive recommendations (phases 2-4).
// Each category maps to a tutorial and has a detector that recognizes words
// exercising the pattern, returning the salient substring (or null). The
// analyzer counts a player's misses per category; a typo "gate" skips a miss
// when the typed attempt still contains the correct pattern substring (meaning
// the child got THIS pattern right and erred elsewhere). When no attempt was
// recorded, the miss counts on detection alone.
//
// Tutorial titles below must match tutorials.js EXACTLY (lookup is by title).
// Not every tutorial has a detector — etymology/strategy lessons that can't be
// reliably spotted from spelling are intentionally browse-only (never
// auto-recommended). Detectors favor precision over recall to avoid silly
// recommendations.

const C = "[bcdfghjklmnpqrstvwxz]"; // consonant (no y)
const reMatch = (re) => (w) => { const m = w.match(re); return m ? (m[1] || m[0]) : null; };

const PATTERN_CATEGORIES = [
  // ---- Grade 1: foundational phonics ----
  { id: "short-vowels", tutorial: { grade: 1, title: "Short Vowel Sounds" },
    // 3-letter CVC words; the error is usually the vowel choice (pen/pin)
    detect: reMatch(new RegExp(`^${C}([aeiou])${C}$`)) },
  { id: "digraphs", tutorial: { grade: 1, title: "Two Letters, One Sound" },
    detect: reMatch(/(sh|ch|th)/) },
  { id: "magic-e", tutorial: { grade: 1, title: "The Magic E" },
    detect: reMatch(new RegExp(`([aeiou]${C}e)$`)) },

  // ---- Grade 2: long-vowel teams ----
  { id: "long-a", tutorial: { grade: 2, title: "The Long A Team" },
    detect: reMatch(new RegExp(`(ai|ay|a${C}e$)`)) },
  { id: "long-e", tutorial: { grade: 2, title: "The Long E Team" },
    detect: reMatch(/(ee|ea)/) },
  { id: "long-o", tutorial: { grade: 2, title: "The Long O Team" },
    detect: reMatch(new RegExp(`(oa|ow|o${C}e$)`)) },

  // ---- Grade 3 ----
  { id: "bossy-r", tutorial: { grade: 3, title: "Bossy R" },
    // r-controlled vowel in a closed syllable (vowel + r + consonant): barn, corn, bird
    detect: reMatch(new RegExp(`((?:ar|or|ir|ur|er)${C})`)) },
  { id: "ck", tutorial: { grade: 3, title: "The /k/ Sound: c, k, or ck?" },
    detect: reMatch(/(ck)/) },
  { id: "ing-ed", tutorial: { grade: 3, title: "Adding -ing and -ed" },
    // plain/drop-e endings; doubled-consonant endings belong to "Double or Not?"
    detect: (w) => (/([bcdfghjklmnpqrstvwxz])\1(ing|ed)$/.test(w) ? null : (w.match(/(ing|ed)$/)?.[0] || null)) },

  // ---- Grade 4 ----
  { id: "j-sound", tutorial: { grade: 4, title: "The /j/ Sound: j, g, or dge?" },
    detect: reMatch(/(dge|g[eiy])/) },
  { id: "y-to-i", tutorial: { grade: 4, title: "Y Changes to I" },
    detect: reMatch(/(ies|ied)$/) },
  { id: "tch", tutorial: { grade: 4, title: "The /ch/ Sound: ch or tch?" },
    detect: reMatch(/(tch)/) },

  // ---- Grade 5 ----
  { id: "ie-ei", tutorial: { grade: 5, title: "I Before E…" },
    detect: reMatch(/(ie|ei)/) },
  { id: "silent-letters", tutorial: { grade: 5, title: "Silent Letters" },
    detect: reMatch(/(^kn|^wr|mb$)/) },
  { id: "tion-sion", tutorial: { grade: 5, title: "-tion vs -sion" },
    detect: reMatch(/(tion|sion)/) },

  // ---- Grade 6 ----
  { id: "doubling", tutorial: { grade: 6, title: "Double or Not?" },
    detect: reMatch(/(([bcdfghjklmnpqrstvwxz])\2)(?:ing|ed)$/) },
  { id: "able-ible", tutorial: { grade: 6, title: "-able vs -ible" },
    detect: reMatch(/(able|ible)$/) },
  // "The Schwa Trap" — browse-only (schwa can't be spotted reliably)

  // ---- Grade 7 ----
  { id: "greek-disguise", tutorial: { grade: 7, title: "Greek Disguises" },
    detect: reMatch(/(ph)/) },
  { id: "ant-ent", tutorial: { grade: 7, title: "-ant or -ent?" },
    detect: reMatch(/(ant|ent|ance|ence)$/) },
  // "Tricky Doubles" — browse-only

  // ---- Grade 8 ----
  { id: "french-endings", tutorial: { grade: 8, title: "French Endings" },
    detect: reMatch(/(que$|gue$|eau)/) },
  { id: "cede", tutorial: { grade: 8, title: "-cede, -ceed, or -sede?" },
    detect: reMatch(/(cede|ceed|sede)$/) },
  { id: "silent-history", tutorial: { grade: 8, title: "Silent Letters from History" },
    detect: reMatch(/(^ps|^pn|^gn|bt)/) },

  // ---- Grade 9 ----
  { id: "roots", tutorial: { grade: 9, title: "Roots Are Anchors" },
    detect: reMatch(/(spect|dict|ject)/) },
  { id: "ous-family", tutorial: { grade: 9, title: "The -ous Family" },
    detect: reMatch(/(ous)$/) },
  // "-er, -or, or -ar?" — browse-only (overlaps Bossy R too broadly)

  // ---- Grade 10 ----
  { id: "greek-forms", tutorial: { grade: 10, title: "Greek Combining Forms" },
    detect: reMatch(/(psych|chron|phon)/) },
  { id: "prefix-root", tutorial: { grade: 10, title: "Prefix Meets Root" },
    // prefix immediately followed by a doubled letter: misspell, unnecessary, irregular
    detect: reMatch(/^(?:mis|dis|un|ir|im|il)([bcdfghjklmnpqrstvwxz])\1/) },
  // "Say It in French" — browse-only (overlaps French Endings)

  // ---- Grade 11 ----
  { id: "classical-vowels", tutorial: { grade: 11, title: "Classical Vowel Pairs" },
    detect: reMatch(/(eu|ae|oe)/) },
  // "Latin Doubles", "Pronounce It Wrong on Purpose" — browse-only

  // ---- Grade 12 ----
  { id: "silent-french-finale", tutorial: { grade: 12, title: "Silent French Finales" },
    detect: reMatch(/(et|ois|oir|gne|que)$/) },
  // "Borrowed Words…", "The Chunking Strategy" — browse-only
];
