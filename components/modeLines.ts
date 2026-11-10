// What each study buddy says in each mode (see lib/petMode.ts). Keyed by buddy id. Every buddy needs every list.

// Asleep (the owl sleeps in the daytime, everyone else after midnight). A click is the only way to hear these.
export const SLEEP_LINES: Record<string, string[]> = {
  owl: ["zzz… sleep is revision too…", "Hoot… five more minutes… zzz…", "zzz… I dreamed of eigenvalues…", "Shhh. Day shift is for sleeping. Hoot…"],
  robot: ["standby mode… 01111010 01111010…", "zzz… defragmenting dreams…", "Low power. Please try again after charging…", "bzzt… no input… zzz…"],
  cat: ["purrr… zzz… purrr…", "Mrrow… ten more minutes… zzz…", "zzz… chasing a laser dot… purr…", "Do not disturb. Cat is sleeping."],
  astro: ["floating… zzz… drifting…", "zzz… sleeping bag attached to the wall…", "Houston… five more minutes of orbit… zzz…", "Quiet cabin. Crew is resting…"],
  jelly: ["blub… zzz… blub…", "zzz… drifting with the tide…", "blub… the sea is so quiet… zzz…", "Glow off. Sleeping… blub…"],
  tea: ["snoring politely… zzz…", "A nap before the next pot… zzz…", "Hmm? Not now, old chap… zzz…", "zzz… the kettle can wait…"],
  rex: ["zzz… RAWR… zzz…", "zzz… dreaming of tiny arms… rawr…", "Five more minutes… then ROAR… zzz…", "Shhh. Dinosaur is hibernating."],
  ghost: ["zzz… no cake… zzz…", "zzz… floating through a dream… boo…", "Eek… no… zzz… just a pillow…", "Shhh. Ghosts sleep too. Mostly."],
};

// Night study (18:00 to midnight): the buddy studies beside a lamp.
export const NIGHT_LINES: Record<string, string[]> = {
  owl: ["Night shift! The best hours for revision.", "Hoot. The lamp is on. Let's read.", "Night study suits me. Quiet and sharp.", "One chapter more, then we rest."],
  robot: ["Night mode on. Screen brightness lowered.", "Reading at low power. Efficient.", "Lamp online. Studying in progress.", "Evening session: one solved problem, then log off."],
  cat: ["Lamp on, rain outside. Perfect study weather.", "Purr. I'll sit on your notes. For warmth.", "Evening reading. Mrrow.", "Quiet hours. Great for hard problems."],
  astro: ["Night cycle. Time to review the day's mission.", "Reading by the cabin light. Cosy.", "Evening orbit: one more topic.", "The stars are out. So is my notebook."],
  jelly: ["Blub. Reading by my own glow.", "Quiet tide. Good time to learn.", "Evening swim through the notes.", "Soft light, steady focus. Blub."],
  tea: ["An evening cuppa and a chapter, I think.", "Lamp lit, kettle warm. Splendid.", "Night study is quite civilised, really.", "Tea cools, revision warms. Carry on."],
  rex: ["Night level unlocked: study mode.", "Rawr. Quiet reading. Tiny arms hold the book.", "Evening quest: finish one topic.", "Lamp on. Press start."],
  ghost: ["B-boo. Night study is my favourite. No cake in sight.", "Spooky hours, scholarly hours.", "Whooo reads at night? Me.", "The lamp is cosy. Please keep the cake away."],
};

// Party (15 minutes after you tick the last task of the day).
export const PARTY_LINES: Record<string, string[]> = {
  owl: ["Hoot hoot! Every task done. Party time!", "Wise move, finishing early. Celebrate!", "Confetti for the scholar! Hoot!", "A perfect day. Even owls dance."],
  robot: ["All tasks complete. Dance protocol started.", "Beep boop! Celebration mode: ON.", "Checklist: 100%. Confetti: deployed.", "Mission accomplished. Disco subroutine running."],
  cat: ["Mrrow! All done. Treats? Please?", "Party time. I knocked the confetti off the shelf.", "You did it. I'll allow one head scratch.", "Purr-fect day. Celebrate!"],
  astro: ["Mission complete! Zero-g dance party!", "All tasks docked. Confetti in orbit!", "Houston, the checklist is empty. Celebrate!", "One small step for you. One giant party for us."],
  jelly: ["Blub blub! Everything's done. Party bubbles!", "Glowing with pride. Party time!", "You did it! Splash!", "A whole day completed. Float and celebrate."],
  tea: ["Splendid! All done. A toast with tea!", "Jolly good show. Do enjoy the party.", "Every task ticked. Quite remarkable.", "Biscuits for everyone. You've earned it."],
  rex: ["ROAR! All tasks done! Party level unlocked!", "Victory stomp! Rawr!", "Checklist cleared. Insert confetti.", "You win the day. Dino dance!"],
  ghost: ["Whooo! All done! Party! (Is there cake?)", "Confetti is fine. Confetti is not cake. Yay!", "You did it! I'm floating higher than ever.", "Boo-tiful work today!"],
};

// Signature hour: one per buddy (see SPECIALS in lib/petMode.ts).
export const SPECIAL_LINES: Record<string, string[]> = {
  owl: ["Midnight hunt! My eyes see every detail now.", "Hoot. The quiet hours are for hard problems.", "Wide awake. Ask me anything."],
  robot: ["Overclock engaged. Fans spinning. Ready to solve.", "Afternoon boost: processing at full speed.", "Temperature rising. Productivity too."],
  cat: ["Zoomies! Mrrow! Solve something before I run past!", "Evening zoomies. Energy for one more problem.", "I ran round the room twice. Your turn to focus."],
  astro: ["Spacewalk time! Tethered to the study plan.", "Floating outside the capsule. Great view of your progress.", "EVA in progress. Keep going."],
  jelly: ["Glow hour! I shine brightest now.", "Blub. Bioluminescence on. Let's study bright.", "Evening glow. Everything looks calmer."],
  tea: ["Tea time! Quite the highlight of the afternoon.", "Steam rising, spirits too. A short break, then onward.", "Four o'clock sharp. Marvellous."],
  rex: ["RAMPAGE! Smashing through those problems!", "Rawr! Stomp-stomp. Strong start to the day.", "Morning rampage: eat problems, not time."],
  ghost: ["Witching hour! Whooo! Study before the stroke of midnight.", "B-boo. Almost midnight. Finish strong.", "The cake is just a rumour, right? Study on."],
};
