// SpellMaster tutorials: spelling tips & tricks per grade.
// Each tutorial: { title, intro, patterns: [{ name, tip, words }] }.
// Pattern words are tappable in the UI (spoken aloud) and feed the
// end-of-tutorial spelling quiz. Lower grades teach phonics patterns,
// middle grades suffix/doubling rules, upper grades etymology tricks.

const TUTORIALS = {
  1: [
    {
      title: "Short Vowel Sounds",
      intro: "Small words with one vowel in the middle usually use the SHORT vowel sound.",
      patterns: [
        { name: "Short a, e, i", tip: "One vowel squeezed between consonants says its short sound.", words: ["cat", "bed", "pig", "map", "six"] },
        { name: "Short o", tip: "Short o sounds like 'ah' — top, box.", words: ["top", "box", "pot", "log"] },
        { name: "Short u", tip: "Short u sounds like 'uh' — bug, cup.", words: ["bug", "cup", "mud", "tub"] },
      ],
    },
    {
      title: "Two Letters, One Sound",
      intro: "Some letter pairs team up to make a single brand-new sound.",
      patterns: [
        { name: "sh", tip: "s + h say 'shhh' like a librarian.", words: ["ship", "shell", "fish", "shirt"] },
        { name: "ch", tip: "c + h say 'ch' like a train: ch-ch-ch.", words: ["chick", "chin", "much", "lunch"] },
        { name: "th", tip: "t + h make the tongue-between-teeth sound.", words: ["that", "thin", "bath", "thumb"] },
      ],
    },
    {
      title: "The Magic E",
      intro: "A silent e at the end of a word is magic: it makes the vowel before it say its own NAME.",
      patterns: [
        { name: "a_e", tip: "can becomes cane — the a says 'ay'.", words: ["cake", "gate", "name", "wave"] },
        { name: "i_e", tip: "The i says 'eye'.", words: ["bike", "ride", "kite", "hide"] },
        { name: "o_e", tip: "The o says 'oh'.", words: ["bone", "home", "note", "rope"] },
      ],
    },
  ],
  2: [
    {
      title: "The Long A Team",
      intro: "When you hear 'ay' (like in day), it's usually spelled one of three ways.",
      patterns: [
        { name: "ay — at the END", tip: "If the 'ay' sound ends the word, use ay.", words: ["day", "play", "way", "stay"] },
        { name: "ai — in the MIDDLE", tip: "Inside a word, the team is usually ai.", words: ["rain", "tail", "sail", "pail"] },
        { name: "a_e — with magic e", tip: "A silent e at the end makes the a say 'ay'.", words: ["cake", "gate", "wave", "race"] },
      ],
    },
    {
      title: "The Long E Team",
      intro: "The 'ee' sound (like in tree) has three favorite spellings.",
      patterns: [
        { name: "ee", tip: "Two e's holding hands — the most common team.", words: ["tree", "green", "sleep", "sweet"] },
        { name: "ea", tip: "e + a often says 'ee' too — you just have to meet these words.", words: ["beach", "dream", "eagle", "team"] },
        { name: "y — at the end", tip: "At the end of a longer word, y says 'ee'.", words: ["happy", "sunny", "penny", "bunny"] },
      ],
    },
    {
      title: "The Long O Team",
      intro: "The 'oh' sound is usually spelled one of three ways.",
      patterns: [
        { name: "o_e — with magic e", tip: "Silent e makes the o say 'oh'.", words: ["bone", "home", "stone", "nose"] },
        { name: "oa — in the middle", tip: "o + a team up inside words.", words: ["boat", "coat", "road", "soap"] },
        { name: "ow — at the end", tip: "At the end of a word, 'oh' is usually ow.", words: ["snow", "grow", "show", "yellow"] },
      ],
    },
  ],
  3: [
    {
      title: "Bossy R",
      intro: "When r follows a vowel, it bosses the vowel around and changes its sound.",
      patterns: [
        { name: "ar", tip: "ar says 'arr' like a pirate.", words: ["barn", "march", "star", "garden"] },
        { name: "or", tip: "or says 'or' like in corn.", words: ["corn", "north", "porch", "story"] },
        { name: "er, ir, ur", tip: "All three say 'er'! er is the most common; ir and ur you learn by sight.", words: ["better", "bird", "skirt", "turkey", "nurse"] },
      ],
    },
    {
      title: "The /k/ Sound: c, k, or ck?",
      intro: "Three ways to spell the same 'k' sound — the letters around it decide.",
      patterns: [
        { name: "c — before a, o, u", tip: "c does the job before a, o, and u.", words: ["cat", "coat", "cup", "carry"] },
        { name: "k — before e and i", tip: "Before e or i, use k (c would go soft).", words: ["kite", "kettle", "kick", "kitten"] },
        { name: "ck — right after a short vowel", tip: "Short vowel, then the 'k' sound? Use ck.", words: ["brick", "clock", "stick", "rocket"] },
      ],
    },
    {
      title: "Adding -ing and -ed",
      intro: "Before you add an ending, check the end of the word.",
      patterns: [
        { name: "Double it", tip: "Short vowel + one consonant: double the consonant first (run → running).", words: ["running", "stopped", "swimming", "hopped"] },
        { name: "Just add it", tip: "Two consonants or two vowels? Just add the ending.", words: ["jumping", "played", "eating", "resting"] },
        { name: "Drop the e", tip: "Magic e? Drop it before -ing or -ed (bake → baking).", words: ["baking", "smiled", "riding", "hoping"] },
      ],
    },
  ],
  4: [
    {
      title: "The /j/ Sound: j, g, or dge?",
      intro: "The 'j' sound has three disguises.",
      patterns: [
        { name: "j — at the start", tip: "Words usually start the 'j' sound with j.", words: ["jam", "jacket", "juggle", "jelly"] },
        { name: "g — before e, i, y", tip: "g goes soft and says 'j' before e, i, or y.", words: ["giant", "magic", "gentle", "gym"] },
        { name: "dge — after a short vowel", tip: "Right after a short vowel, the 'j' sound is dge.", words: ["bridge", "badge", "judge", "fudge"] },
      ],
    },
    {
      title: "Y Changes to I",
      intro: "When a word ends in y, adding an ending sometimes changes the y to i.",
      patterns: [
        { name: "Consonant + y → change it", tip: "penny → pennies: consonant before y means y becomes i.", words: ["pennies", "parties", "carried", "cities"] },
        { name: "Vowel + y → keep it", tip: "play → plays: a vowel before y protects it.", words: ["plays", "monkeys", "days", "enjoyed"] },
        { name: "Keep y before -ing", tip: "Never make ii: carry → carrying.", words: ["carrying", "playing", "studying", "crying"] },
      ],
    },
    {
      title: "The /ch/ Sound: ch or tch?",
      intro: "Two spellings for the 'ch' sound — the vowel before it decides.",
      patterns: [
        { name: "tch — right after a short vowel", tip: "Short vowel, then 'ch'? Use tch.", words: ["catch", "match", "stretch", "witch"] },
        { name: "ch — everywhere else", tip: "After long vowels, consonants, or at the start: plain ch.", words: ["chair", "lunch", "march", "teacher"] },
        { name: "The rebels", tip: "A few common words break the rule — learn them by heart.", words: ["much", "such", "rich", "which"] },
      ],
    },
  ],
  5: [
    {
      title: "I Before E…",
      intro: "I before e, except after c — or when it sounds like 'ay' as in neighbor and weigh.",
      patterns: [
        { name: "ie — the usual order", tip: "Most of the time it's ie.", words: ["believe", "field", "niece", "chief"] },
        { name: "ei — after c", tip: "Right after c, flip to ei.", words: ["receive", "ceiling", "receipt"] },
        { name: "ei — when it says 'ay'", tip: "If the pair sounds like 'ay', it's ei.", words: ["eight", "weight", "neighbor", "sleigh"] },
      ],
    },
    {
      title: "Silent Letters",
      intro: "Some words carry silent letters left over from how they were said long ago.",
      patterns: [
        { name: "kn — silent k", tip: "kn used to be pronounced 'k-n'! Now the k just watches.", words: ["knee", "knife", "knead", "knuckle"] },
        { name: "wr — silent w", tip: "wr words are usually about twisting — write, wrong, wrinkle.", words: ["write", "wrong", "wrinkle", "wreckage"] },
        { name: "mb — silent b", tip: "At the end of a word, mb hides its b.", words: ["thumb", "climb", "lamb", "plumber"] },
      ],
    },
    {
      title: "-tion vs -sion",
      intro: "That 'shun' sound at the end of words has two main spellings.",
      patterns: [
        { name: "-tion — the big winner", tip: "When in doubt, -tion: it's far more common.", words: ["station", "vacation", "nation", "action"] },
        { name: "-sion — says 'zhun'", tip: "If the ending buzzes like 'zhun', it's -sion.", words: ["vision", "television", "decision", "occasion"] },
        { name: "-sion — after l, n, r", tip: "mansion, tension — s follows certain letters.", words: ["mansion", "mission", "tension", "expression"] },
      ],
    },
  ],
  6: [
    {
      title: "Double or Not?",
      intro: "Longer words double their last letter only when the LAST syllable is stressed.",
      patterns: [
        { name: "Stressed end → double", tip: "be-GIN → beginning. Say it out loud: stress at the end means double.", words: ["beginning", "forgetting", "admitted", "occurred"] },
        { name: "Unstressed end → don't", tip: "O-pen → opening. No stress, no double.", words: ["opening", "visited", "offering", "happening"] },
        { name: "One syllable: short vowel rule", tip: "Short vowel + one consonant still doubles.", words: ["shopping", "grabbed", "winner", "slimmer"] },
      ],
    },
    {
      title: "-able vs -ible",
      intro: "Two endings that sound identical — but there's a trick.",
      patterns: [
        { name: "-able — after whole words", tip: "If you remove the ending and a real word remains, use -able.", words: ["comfortable", "enjoyable", "acceptable", "remarkable"] },
        { name: "-ible — after word pieces", tip: "If what's left isn't a word (poss-, terr-), use -ible.", words: ["possible", "terrible", "visible", "horrible"] },
        { name: "Watch the dropped e", tip: "value → valuable, but notice love → lovable drops its e.", words: ["valuable", "lovable", "believable", "usable"] },
      ],
    },
    {
      title: "The Schwa Trap",
      intro: "Unstressed vowels all mumble the same 'uh' sound — you can't trust your ears, so use tricks.",
      patterns: [
        { name: "Exaggerate the syllable", tip: "Say lem-ON, wag-ON out loud to hear the real vowel.", words: ["lemon", "wagon", "salad", "melon"] },
        { name: "Use a relative word", tip: "Can't hear the a in 'relative'? Hear it in 'relATE'.", words: ["definition", "competition", "celebrate", "memory"] },
        { name: "Just memorize the mumblers", tip: "Some schwas have no trick — picture the word.", words: ["banana", "balloon", "calendar", "elegant"] },
      ],
    },
  ],
  7: [
    {
      title: "Greek Disguises",
      intro: "Words from Greek wear costumes: ph for 'f', ch for 'k', and y where you'd expect i.",
      patterns: [
        { name: "ph says 'f'", tip: "Hear 'f' in a sciency word? Try ph.", words: ["phrase", "photograph", "physical", "alphabet"] },
        { name: "ch says 'k'", tip: "Greek ch sounds like k — chaos, chorus.", words: ["chaos", "choir", "chorus", "stomach"] },
        { name: "y instead of i", tip: "Greek words hide y in the middle.", words: ["gym", "rhythm", "cylinder", "mystery"] },
      ],
    },
    {
      title: "-ant or -ent?",
      intro: "These endings sound the same. There's no perfect rule — but families stick together.",
      patterns: [
        { name: "-ant / -ance family", tip: "If it's distant, it's distance: ant and ance travel together.", words: ["distant", "distance", "important", "brilliant"] },
        { name: "-ent / -ence family", tip: "different → difference: ent goes with ence.", words: ["different", "excellent", "frequent", "confident"] },
        { name: "Learn the famous ones", tip: "When unsure, picture these common words.", words: ["restaurant", "independent", "apparent", "ignorant"] },
      ],
    },
    {
      title: "Tricky Doubles",
      intro: "Some words are famous for their double letters. Mnemonics beat memory.",
      patterns: [
        { name: "Two pairs", tip: "emba-RR-a-SS: really red, so super shy.", words: ["embarrass", "committee", "accommodate"] },
        { name: "One double only", tip: "necessary: one collar (c), two sleeves (ss).", words: ["necessary", "occasion", "recommend", "tomorrow"] },
        { name: "Sneaky singles", tip: "These FEEL like doubles but aren't — say each syllable.", words: ["apartment", "imitate", "omitted", "until"] },
      ],
    },
  ],
  8: [
    {
      title: "French Endings",
      intro: "Words borrowed from French keep their French clothes on.",
      patterns: [
        { name: "-que says 'k'", tip: "antique, unique — the French k.", words: ["antique", "boutique", "unique", "technique"] },
        { name: "-gue says 'g'", tip: "The ue is silent: league, fatigue.", words: ["league", "fatigue", "intrigue", "dialogue"] },
        { name: "-eau says 'oh'", tip: "Three letters, one 'oh' sound.", words: ["bureau", "plateau", "chateau"] },
      ],
    },
    {
      title: "-cede, -ceed, or -sede?",
      intro: "The 'seed' ending has exactly one weird exception and three special cases.",
      patterns: [
        { name: "-sede — only ONE word", tip: "supersede is the only -sede word in English.", words: ["supersede"] },
        { name: "-ceed — only THREE words", tip: "succeed, proceed, exceed — that's the whole list.", words: ["succeed", "proceed", "exceed"] },
        { name: "-cede — everything else", tip: "All the rest take -cede.", words: ["precede", "recede", "concede", "intercede"] },
      ],
    },
    {
      title: "Silent Letters from History",
      intro: "Scholars once added letters to show off a word's Latin roots — and they stuck.",
      patterns: [
        { name: "Silent b", tip: "debt and doubt got their b from Latin debitum/dubitare.", words: ["debt", "doubt", "subtle"] },
        { name: "Silent ps, pn", tip: "Greek beginnings: the p is silent.", words: ["pseudonym", "psychology", "pneumonia"] },
        { name: "Silent g, h", tip: "gn- and h- openers from old roots.", words: ["gnaw", "gnarled", "honest", "heir"] },
      ],
    },
  ],
  9: [
    {
      title: "Roots Are Anchors",
      intro: "Latin roots keep their spelling in every word they appear in — spell the root, then build around it.",
      patterns: [
        { name: "spect = look", tip: "inspect, spectator, perspective — spect never changes.", words: ["inspect", "spectator", "perspective", "spectacle"] },
        { name: "dict = say", tip: "predict, dictionary, verdict.", words: ["predict", "dictionary", "verdict", "contradict"] },
        { name: "ject = throw", tip: "reject, eject, projector.", words: ["reject", "eject", "projector", "trajectory"] },
      ],
    },
    {
      title: "The -ous Family",
      intro: "The ending 'us' on adjectives is almost always -ous, with two fancier cousins.",
      patterns: [
        { name: "-ous", tip: "The plain workhorse.", words: ["famous", "dangerous", "enormous", "tremendous"] },
        { name: "-ious", tip: "After certain roots the i sneaks in.", words: ["curious", "various", "mysterious", "victorious"] },
        { name: "-eous", tip: "The rare one — learn these few.", words: ["courteous", "gorgeous", "miscellaneous", "simultaneous"] },
      ],
    },
    {
      title: "-er, -or, or -ar?",
      intro: "All three endings mumble 'er'. Origin decides the spelling.",
      patterns: [
        { name: "-er — everyday doers", tip: "Common English doer-words take -er.", words: ["teacher", "painter", "builder", "speaker"] },
        { name: "-or — Latin professionals", tip: "Formal/Latin jobs often take -or.", words: ["doctor", "professor", "sailor", "spectator"] },
        { name: "-ar — the rare rebels", tip: "A short list — memorize them.", words: ["burglar", "calendar", "grammar", "collar"] },
      ],
    },
  ],
  10: [
    {
      title: "Greek Combining Forms",
      intro: "Big Greek word-pieces snap together like LEGO — spell the piece once, use it everywhere.",
      patterns: [
        { name: "psych = mind", tip: "Silent p, y not i.", words: ["psychology", "psychic", "psychiatrist"] },
        { name: "chron = time", tip: "ch says 'k' — chronic, chronological.", words: ["chronic", "chronological", "synchronize"] },
        { name: "phon = sound", tip: "ph says 'f' — symphony, cacophony.", words: ["symphony", "telephone", "cacophony", "microphone"] },
      ],
    },
    {
      title: "Say It in French",
      intro: "French loanwords ignore English phonics. Trick: pronounce the word 'in French' while spelling it.",
      patterns: [
        { name: "Silent endings", tip: "rendezvous: say 'ren-dez-vous' letter by letter in your head.", words: ["rendezvous", "debris", "bourgeois", "ballet"] },
        { name: "-ette, -elle", tip: "Double letters + e, the French way.", words: ["silhouette", "etiquette", "gazelle"] },
        { name: "ou and eau teams", tip: "French vowel teams stay French.", words: ["camouflage", "boulevard", "bureau", "gourmet"] },
      ],
    },
    {
      title: "Prefix Meets Root",
      intro: "When a prefix ends with the same letter the root starts with, KEEP BOTH letters.",
      patterns: [
        { name: "Keep both", tip: "mis + spell = misspell. un + necessary = unnecessary.", words: ["misspell", "unnecessary", "irregular", "immature"] },
        { name: "No extra letters", tip: "dis + appear has one s; dis + appoint, too.", words: ["disappear", "disappoint", "apartment"] },
        { name: "Assimilated doubles", tip: "Latin ad- morphs to match: ad+count → account.", words: ["account", "accommodate", "occasion", "attraction"] },
      ],
    },
  ],
  11: [
    {
      title: "Latin Doubles",
      intro: "Those mysterious double letters usually mark where a Latin prefix fused onto a root.",
      patterns: [
        { name: "acc-, occ-", tip: "ad/ob + c-root → cc.", words: ["accommodate", "accumulate", "occurrence", "acquiesce"] },
        { name: "comm-, coll-", tip: "com/con + root → mm or ll.", words: ["commemorate", "committee", "collaborate", "colloquial"] },
        { name: "-nn- from annus", tip: "Year-words double the n: mille+annus.", words: ["millennium", "anniversary", "perennial", "annual"] },
      ],
    },
    {
      title: "Pronounce It Wrong on Purpose",
      intro: "The oldest spelling trick: say the word the way it's WRITTEN, not the way it's spoken.",
      patterns: [
        { name: "Hidden syllables", tip: "Say def-i-NITE-ly, sep-A-rate in your head.", words: ["definitely", "separate", "business", "interesting"] },
        { name: "Mumbled middles", tip: "lab-OR-atory, temp-ER-ature.", words: ["laboratory", "temperature", "miniature", "literature"] },
        { name: "Silent-ish letters", tip: "Hit every letter: en-vi-RON-ment.", words: ["environment", "government", "february", "wednesday"] },
      ],
    },
    {
      title: "Classical Vowel Pairs",
      intro: "ae, oe, and eu are fingerprints of Greek and Latin — when you hear those words, expect a vowel pair.",
      patterns: [
        { name: "eu", tip: "Greek eu- means 'good': euphemism, eulogy.", words: ["euphemism", "eulogy", "euphoria", "eureka"] },
        { name: "ae", tip: "Latin leftovers keep the ae.", words: ["archaeology", "aesthetic", "algae"] },
        { name: "oe", tip: "The rarest pair — collect them.", words: ["amoeba", "onomatopoeia", "phoenix"] },
      ],
    },
  ],
  12: [
    {
      title: "Borrowed Words Keep Their Clothes",
      intro: "Identify the source language, then spell by ITS rules, not English ones.",
      patterns: [
        { name: "German guests", tip: "sch-, -ei-, and compound monsters.", words: ["schadenfreude", "zeitgeist", "doppelganger", "weltschmerz"] },
        { name: "French guests", tip: "Silent finals and vowel teams.", words: ["milieu", "rapprochement", "denouement", "hors d'oeuvre"] },
        { name: "Italian & friends", tip: "Vowel endings survive intact.", words: ["bravado", "vendetta", "maestro", "ratatouille"] },
      ],
    },
    {
      title: "The Chunking Strategy",
      intro: "No one spells giant words letter by letter — break them into meaningful chunks and spell chunk by chunk.",
      patterns: [
        { name: "Prefix chunks", tip: "anti + dis + establish + ment + arian + ism.", words: ["antidisestablishmentarianism", "incomprehensible"] },
        { name: "Root chains", tip: "pneumono + ultra + microscopic + silico + volcano + coniosis.", words: ["pneumonoultramicroscopicsilicovolcanoconiosis"] },
        { name: "Sing-song chunks", tip: "super-cali-fragil-istic-expi-ali-docious — rhythm is memory.", words: ["supercalifragilisticexpialidocious", "floccinaucinihilipilification"] },
      ],
    },
    {
      title: "Silent French Finales",
      intro: "Elite vocabulary loves French endings where the last letters go quiet.",
      patterns: [
        { name: "-et says 'ay'", tip: "ballet, bouquet, gourmet — the t is decoration.", words: ["ballet", "bouquet", "gourmet", "sobriquet"] },
        { name: "-ois, -oir", tip: "bourgeois, repertoire — spell the silent crowd.", words: ["bourgeois", "repertoire", "reservoir", "patois"] },
        { name: "-gne, -que", tip: "champagne, baroque: the ending is a costume.", words: ["champagne", "cologne", "baroque", "grotesque"] },
      ],
    },
  ],
};
