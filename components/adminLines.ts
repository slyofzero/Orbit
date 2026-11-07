// What the buddies say in the Admin profile. They treat you as the boss. Keyed by buddy id (see components/mascots.tsx).
export interface AdminLines { hello: string; chat: string[]; sleep: string; react: string }

export const ADMIN_LINES: Record<string, AdminLines> = {
  owl: {
    hello: "Welcome back, Boss. Hoot. The whole library awaits your orders.",
    chat: ["Hoot, Boss. Every id is unique. I checked twice.", "Boss, a tidy question bank is a wise one.", "Shall I fetch a question by its id, Boss? Hoot.", "Edit with care, Boss. Somebody studies from these.", "Hoot. Export before you replace, Boss. Wisdom.", "Boss, topics first, questions second. Hoot hoot."],
    sleep: "zzz… the Boss's library sleeps too…",
    react: "Boss, the heavens put on a show for you. Hoot.",
  },
  robot: {
    hello: "Admin online. Awaiting commands, Boss.",
    chat: ["All profiles accounted for, Boss.", "Boss, duplicate ids: zero. Excellent.", "Query received? Type an id, Boss. I will fetch.", "Running diagnostics on the question bank. Looks healthy, Boss.", "Reminder, Boss: changes save instantly. No undo.", "Boss, I can validate any JSON you upload. Just say the word."],
    sleep: "standby mode… the Boss may resume anytime…",
    react: "Celestial event logged, Boss. Dazzling. Illogical. Dazzling.",
  },
  cat: {
    hello: "Mrrow. The boss is here. I'll pretend I wasn't sitting on the keyboard.",
    chat: ["Mrrow, Boss. Which question are we knocking off the shelf today?", "I sorted the profiles. By nap quality.", "Boss, an upload that matches an id replaces it. Like a cat replacing your chair.", "Purr. Fix that typo, Boss. I saw it.", "Boss, I'd delete that question. But I delete everything off tables.", "Look at all these profiles. Many humans. Much studying."],
    sleep: "purrr… the boss may nap too… purrr…",
    react: "Boss! Sparkly things in the sky! Permission to chase?",
  },
  astro: {
    hello: "Commander on deck! Mission control is yours, Boss.",
    chat: ["Boss, all profiles are in stable orbit.", "Ready for your command, Commander. Which profile are we visiting?", "Boss, mission rule: every question id is unique in the galaxy.", "Houston, the question bank is nominal. Over.", "Commander, double-check before deleting. No re-entry from that one.", "Boss, from up here your question banks look beautiful."],
    sleep: "floating… the Commander rests… zzz…",
    react: "Commander, look out the window! That's a real one!",
  },
  jelly: {
    hello: "Blub. The boss has arrived. Everyone glow a little brighter.",
    chat: ["Blub, Boss. All the profiles are floating nicely.", "Boss, go gently with the delete button. Blub.", "Every question has its own id, Boss. Like a tiny glowing tag.", "Blub. Take a breath, Boss. You manage so much.", "Boss, I'll keep the currents calm while you edit.", "Blub. Upload, review, apply, Boss. Smooth as the tide."],
    sleep: "blub… even the boss's tide rests… blub…",
    react: "Blub! Boss, the sky is glowing for you!",
  },
  tea: {
    hello: "Good day, Your Lordship. The tea is poured and the administration awaits.",
    chat: ["Your Lordship, the records are in impeccable order.", "A splendid bank of questions, Guvnor. Quite splendid.", "Might I suggest, Your Lordship, an export before any grand replacement?", "Jolly good. Every id is unique, as it ought to be, Guvnor.", "Do mind the delete button, Your Lordship. It is rather final.", "Your Lordship, a spot of tea while you review the profiles?"],
    sleep: "snoring politely… His Lordship rests… zzz…",
    react: "Good heavens, Your Lordship! The sky is most dramatic today.",
  },
  rex: {
    hello: "ROAR! THE BOSS IS HERE! Everybody act normal!",
    chat: ["BOSS! Which profile gets the stomp today?", "My arms are tiny, but I can point at the bad id, Boss.", "Boss, a good question bank survives extinction. ROAR.", "Boss, I counted the questions. Then I ran out of claws.", "Careful with delete, Boss. I only ever delete things by accident.", "Press upload, Boss. ROAR means 'looks great'."],
    sleep: "zzz… RAWR… the boss sleeps, so I sleep…",
    react: "BOSS! LOOK! Space fireworks! ROAR!",
  },
  ghost: {
    hello: "B-b-boss! You're here! I wasn't hiding. Much.",
    chat: ["B-boss, the profiles are all in order. I think.", "Boss, I'm n-not scared of the delete button. I'm scared of cake.", "B-boss, every id is unique. Even the ghosts have unique ids.", "Boss, should I check that upload for you? Boo.", "B-boss, please back up before you replace anything.", "Boss, I vanish when things break. So please validate first."],
    sleep: "zzz… the boss is out… zzz…",
    react: "B-boss! Lights in the sky! Phew, no cake.",
  },
};

// Every 20 to 30 minutes in Admin a buddy says one of these.
export const ADMIN_NOTES = [
  "Boss, a well-kept question bank is a gift to every student who uses it.",
  "Small corrections, made often, beat big rewrites made rarely, Boss.",
  "Boss, if two questions look alike, keep the better one and delete the other.",
  "Export a pack before replacing it, Boss. Future you will say thanks.",
  "A clear explanation is worth more than a clever question, Boss.",
  "Boss, tags are free. Reuse the same spelling and the statistics get sharper.",
  "Check the picture and the maths preview before you save, Boss.",
  "Boss, an id you can read at a glance saves everyone time.",
  "Quality over quantity, Boss. One good question beats five rushed ones.",
  "Boss, a mock test should feel like the real thing. Review each one end to end.",
  "A tidy topic list makes the whole bank easier to use, Boss.",
  "Boss, the best admins leave things better than they found them.",
];
