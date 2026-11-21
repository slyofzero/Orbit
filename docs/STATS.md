# Orbit stats: what is recorded and how it is calculated

This is the plan for every statistic Orbit shows. It covers **what data is recorded**, **how time is measured**, and **how topic strength is scored**. The tables it uses are in `types/tables/` (`question_answers`, `question_stats`, `questions`).

Nothing here is GATE-specific: the same rules apply to any exam or question pack.

---

## 1. What is recorded

### `question_answers`: the source of truth
One row per question **per sitting**. A sitting is one practice session or one mock attempt.

| Field | Meaning |
|---|---|
| `question_id` | the question |
| `recorded_at` | when it was answered, or when the sitting ended if it was left unanswered |
| `outcome` | `correct`, `incorrect` or `skipped` (shown but never answered) |
| `time_ms` | active time spent on the question in that sitting (see §2) |
| `attempt_id` | the mock attempt it came from; empty for practice |

- A question answered in one sitting and again a week later has **two rows**.
- A question shown and left unanswered still gets a row (`skipped`), so its time is not lost.
- Rows are never edited after the sitting ends.

### `question_stats`: a summary
One row per question: `visited`, `correct`, `incorrect`. Every field can be rebuilt by counting `question_answers`:

```
visited   = number of rows for the question
correct   = rows with outcome = correct
incorrect = rows with outcome = incorrect
skipped   = visited − correct − incorrect
```

It exists so simple counts are instant. If it is ever wrong, rebuild it from `question_answers`.

---

## 2. How `time_ms` is measured

The clock for a question runs **only while that question is on screen and the user is active**. Time is **summed across every visit in the same sitting**.

```
Q3 shown 40s → skip to Q4 … Q7 → back to Q3 for 25s → answer
time_ms for Q3 = 40s + 25s = 65s
```

Rules:
1. **Leaving a question pauses its clock**; coming back resumes it.
2. **Hidden tab or unfocused window pauses the clock.**
3. **Idle cutoff:** after **2 minutes** with no mouse, keyboard or scroll activity the clock stops, and restarts on the next activity. (Thinking time up to the cutoff still counts.)
4. **One sitting only.** Returning to the question in a later sitting starts a new row with a fresh clock.
5. **Mocks follow the same rules**: each question's clock runs only while it is the one on screen.
6. When a sitting ends, every question that was shown and not answered is written as `skipped` with the time spent on it.

---

## 3. Topic strength (strongest / weakest topics)

Raw accuracy (`correct ÷ answered`) misleads: 1 right out of 1 looks like 100%, old mistakes count forever, and easy and hard questions count the same. Strength fixes this in four steps.

**Which answers count:** only `correct` and `incorrect`. `skipped` rows count towards time and visits, never towards accuracy.

### Step 1: weight each answer
Each answer gets a weight `w = recency × difficulty`.

**Recency:** an answer counts half as much every 14 days.
```
recency = 0.5 ^ (age_in_days / 14)
```

**Difficulty:** a right answer on a hard question shows more skill; a wrong answer on an easy one shows a bigger gap.

| | easy | medium | hard |
|---|---|---|---|
| correct | 0.8 | 1.0 | 1.3 |
| incorrect | 1.3 | 1.0 | 0.8 |

### Step 2: weighted accuracy per topic
Over every counted answer to a question in the topic:
```
W_right = Σ w of correct answers
W_all   = Σ w of correct + incorrect answers
```

### Step 3: smooth towards the user's average
So a topic with few answers starts at the user's overall level and only moves away as evidence piles up:
```
p        = W_right ÷ W_all over ALL topics          (the user's overall weighted accuracy)
strength = (W_right + K · p) ÷ (W_all + K)          K = 5
```
A topic with no answers has strength `p` but is shown as "not started", never ranked.

### Step 4: coverage
```
coverage = questions in the topic with at least one correct/incorrect answer
           ÷ questions in the topic (not retired)
```

### Ranking
- **Weakest topics:** lowest `strength` among topics with at least one counted answer.
- **Strongest topics:** highest `strength` among topics with **coverage ≥ 20%** (a topic tried on 3 of 50 questions is not called strong).
- Always show the evidence next to the label, e.g. *"Weakest: Probability: 48% · 30 of 40 questions tried"*.

### Tunable constants
| Constant | Default | Effect of raising it |
|---|---|---|
| Recency half-life | 14 days | old answers matter longer |
| Smoothing `K` | 5 | more answers needed before a topic leaves the average |
| Strongest-topic coverage | 20% | stricter "strong" label |
| Difficulty weights | table above | bigger gap between easy and hard |
| Idle cutoff | 2 min | more thinking time counted |

---

## 4. Other stats and where they come from

All from `question_answers` (+ `questions` for topic and difficulty) unless noted.

| Stat | Rule |
|---|---|
| Accuracy (question / topic / subject) | `correct ÷ (correct + incorrect)`; `question_stats` is enough |
| Questions tried / not started | has / has no `question_stats` row |
| Mistake log | questions whose **latest** non-skipped answer is `incorrect`. Leaves the log as soon as the latest answer is `correct` |
| Streak per question | number of `correct` answers in a row, counting back from the latest (skips ignored) |
| Mastered | streak ≥ 3 |
| Average time per question | mean `time_ms` of counted answers |
| Time sinks | questions or topics with the highest total `time_ms`, skips included |
| Daily activity, "this week", trends | group rows by the IST calendar day of `recorded_at` |
| Practice vs mock | `attempt_id` empty = practice, set = mock |

---

## 5. Open points
- Mock answers only count once a mock is **submitted**: submitting writes one row per visited question, with `attempt_id` set. Abandoned or failed attempts write nothing. Unvisited questions write nothing either; visited but unanswered ones are `skipped`. During the test, responses and clocks live in `mock_attempt_items` (`types/tables/mocks/`).
- Code questions in a mock are not marked automatically: they earn nothing, are left out of the maximum score, and a visited one is written as `skipped` (its time still counts). Built in `mock.submit` (`lib/db/queries/mock.ts`, rules in `lib/exam.ts`).
- The user's own rating of a topic (know / shaky / no idea, `topic_ratings`) can be shown next to the computed strength to spot over- or under-confidence.
