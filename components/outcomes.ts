import type { Outcome } from "@/lib/outcome";

// What each buddy says about your answers. Keyed by buddy id.
export const OUTCOME_LINES: Record<string, Record<Outcome, string[]>> = {
  owl: {
    right: ["Hoot! Correct.", "Sharp eyes. Next one?", "That's the way. Hoot hoot."],
    wrong: ["Hoot. Wrong, but now you know. Log it.", "Even owls miss the mouse. Check why.", "Not quite. Read the explanation, then try again."],
    skip: ["Skipped? Come back to it, I'll remember.", "A skip is a debt. Pay it later."],
    giveup: ["You walked out of the mock. It happens. Read the review, then return.", "Hoot… that one got away. The next one won't."],
    quit: ["Leaving with questions unsolved? Hoot. They'll wait for you.", "Half-done is half-learned. Come back soon."],
    progress: ["Hoot! Good session. Rest your wings.", "Progress made. Wise owls call that a win."],
  },
  robot: {
    right: ["Answer verified. Correct.", "Match found. Nice.", "Output: correct. Satisfaction: high."],
    wrong: ["Error detected. Debug the explanation.", "Mismatch. Logging to your mistakes list.", "Wrong output. Not a crash, just a learning step."],
    skip: ["Question skipped. Added to the backlog.", "Null answer received. I'll flag it."],
    giveup: ["Process terminated early. Core dump: review the questions.", "Mock aborted. Restart when ready. No hard feelings."],
    quit: ["Session closed with unsolved items. Added to your backlog.", "Exiting early. Unfinished questions remain in memory."],
    progress: ["Session saved. Progress logged. Well done.", "Questions answered: more than zero. Efficiency up."],
  },
  cat: {
    right: ["Mrrow! Nailed it.", "Purr. That was a good one.", "Correct! Treat? No? Fine."],
    wrong: ["Mrrow… wrong. I'd knock it off the table.", "Missed it. Land on your feet next time.", "Wrong, but cats get nine tries."],
    skip: ["Skipping? Very cat of you. Come back later.", "Walked right past it. Respect. Return soon."],
    giveup: ["You left the mock. I won't judge. Much.", "Tail between legs, but you can start again."],
    quit: ["Leaving already? The questions are still sitting there. Staring.", "Mrrow. You left some unsolved. I noticed."],
    progress: ["Mrrow. Good session. You may pet me now.", "Some progress, some naps. Perfect."],
  },
  astro: {
    right: ["Houston, that's a correct answer!", "Perfect landing.", "Mission success on that one."],
    wrong: ["Small course correction needed. Check the explanation.", "Off target. Recalculate and relaunch.", "Not this orbit. Try again."],
    skip: ["Skipping this one. We'll circle back.", "Question parked in orbit. Return when ready."],
    giveup: ["Mission aborted. Debrief with the review page.", "Abort logged. Next launch window is whenever you choose."],
    quit: ["Leaving the topic before it's cleared? Mission incomplete.", "Questions still in orbit. Dock with them next time."],
    progress: ["Good orbit today. Progress logged.", "Mission segment complete. Resume from here next time."],
  },
  jelly: {
    right: ["Blub! You got it.", "Glowing with pride. Correct!", "Smooth swimming. Correct."],
    wrong: ["Blub… wrong. Drift back and read why.", "A little current pushed you off. Try again.", "Wrong, but you're still afloat."],
    skip: ["Floating past this one. Blub.", "Skipped. It'll bob back up later."],
    giveup: ["You swam out of the mock. The tide comes back.", "Blub… that was a rough one. Rest, then return."],
    quit: ["Blub… swimming off with questions left behind?", "You drifted away. The rest will float until you return."],
    progress: ["Blub. Nice swim. Every answer counts.", "You made waves today. Rest, then return."],
  },
  tea: {
    right: ["Splendid! Quite correct.", "Jolly good. A biscuit for you.", "Impeccable. Do carry on."],
    wrong: ["Oh dear. Incorrect. Tea and the explanation, I think.", "A minor misstep. Happens to the best of us.", "Not quite right, old chap. Try again."],
    skip: ["Skipped? How unlike one. Return to it presently.", "Leaving it for later, are we? Very well."],
    giveup: ["Abandoning the mock? Most irregular. Do come back.", "A retreat, not a defeat. Regroup over tea."],
    quit: ["Leaving the questions unfinished? How unlike one. Do return.", "A tidy desk is a finished one. Pray come back."],
    progress: ["Jolly good session. Time for a cuppa.", "Steady progress, old chap. Do carry on later."],
  },
  rex: {
    right: ["ROAR! Correct! +100 points.", "Level up! Right answer.", "Nailed it. My tiny arms applaud."],
    wrong: ["Rawr… wrong. Insert coin to continue.", "Game over on that one. Try again.", "Wrong answer. Not extinct yet, though."],
    skip: ["Skipped this level. Bonus stage later.", "Boss question skipped. It'll be back."],
    giveup: ["You quit the mock. Game over, man. Press start again.", "Rage-quit detected. Respawn when ready."],
    quit: ["Quitting mid-level? Unsolved questions remain. Rawr.", "You left with questions undone. Continue? Press start."],
    progress: ["Checkpoint saved! Nice run.", "ROAR! Progress made. Press start when you return."],
  },
  ghost: {
    right: ["Whooo! Correct! No cake needed.", "Correct! I'm so happy I'm floating higher.", "Boo-tiful answer!"],
    wrong: ["Eek! Wrong. But no cake, so it's fine.", "Wrong! I got a fright. Try again.", "Whoops. Wrong. Not scary, though. Cake is scary."],
    skip: ["Skipped! Hope there's no cake in the next one.", "B-boo. Skipped. I'll hide with you."],
    giveup: ["You ran away from the mock! I would too, if there was cake.", "Eek, you left! It's okay. I vanish all the time."],
    quit: ["Eek, you left some unsolved! Are you running from the cake?", "B-boo, leaving already? The questions will haunt you."],
    progress: ["Whooo! Good session. No cake required.", "B-boo-tiful progress. See you next time!"],
  },
};
