import { QBody, mcq, nat } from "./helpers";

export const GA: QBody[] = [
  mcq("verbal", 1, "The committee ___ its final report to the ministry last week.", ["submit", "submitted", "submitting", "has submit"], 1, "Past tense is needed because of 'last week'."),
  mcq("verbal", 1, "Choose the word closest in meaning to 'ephemeral'.", ["Lasting", "Short-lived", "Ancient", "Obvious"], 1, "Ephemeral means lasting for a very short time."),
  mcq("verbal", 1, "Choose the antonym of 'candid'.", ["Frank", "Honest", "Evasive", "Open"], 2, "Candid means frank and straightforward; evasive is the opposite."),
  mcq("verbal", 1, "Neither the manager nor the employees ___ aware of the change.", ["is", "are", "was", "has been"], 1, "With 'neither…nor', the verb agrees with the nearer subject ('employees', plural)."),
  mcq("verbal", 2, "The scientist was ___ by the committee for her ___ contribution to the field.", ["honoured … significant", "honour … significance", "honouring … significantly", "honoured … significantly"], 0,
    "A past participle is needed after 'was', and an adjective ('significant') must modify 'contribution'."),
  mcq("verbal", 2, "Which sentence is grammatically correct?", [
    "Each of the students have submitted their assignment.",
    "Each of the students has submitted his or her assignment.",
    "Each of the student has submitted their assignment.",
    "Each of the students are submitting his or her assignment."], 1, "'Each' is singular, so it takes 'has', and the possessive should match."),
  nat("di", 1, "Find the next number in the series: 2, 6, 12, 20, 30, ?", 42, 0.01, "Differences are 4, 6, 8, 10, so the next difference is 12: 30 + 12 = 42."),
  nat("di", 2, "Find the next number in the series: 3, 6, 11, 18, 27, ?", 38, 0.01, "Differences are 3, 5, 7, 9, so the next is 11: 27 + 11 = 38. (The terms are n² + 2.)"),
  nat("di", 2, "Quarterly sales (in lakhs): Q1 = 40, Q2 = 50, Q3 = 45, Q4 = 65. What is the percentage increase from Q3 to Q4? (Nearest integer)", 44, 0.6,
    "(65 − 45) / 45 × 100 = 44.4%."),
  mcq("reasoning", 1, "All roses are flowers. Some flowers fade quickly. Which conclusion necessarily follows?",
    ["Some roses fade quickly", "All flowers are roses", "Some flowers are roses", "No rose fades quickly"], 2, "From 'all roses are flowers' it follows (by conversion) that some flowers are roses. The other statements are not forced."),
  nat("reasoning", 1, "A walks 5 km north and then 12 km east. What is the shortest distance from the starting point, in km?", 13, 0.01, "√(5² + 12²) = 13."),
  nat("reasoning", 2, "In a row of 30 students, Ravi is 12th from the left and Sita is 8th from the right. How many students are between them?", 10, 0.01,
    "Sita is 30 − 8 + 1 = 23rd from the left. Students between = 23 − 12 − 1 = 10."),
];
