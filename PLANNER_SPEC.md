# Daily plan spec (Claude scheduled task + Haiku fallback)

## Input: `My Drive/SoloSystem/system-db.json`
- `settings`: `tz` (5), `resetHour` (4), `dailyMinutes`, `maxQuests`, `name`
- `tasks`: map id → `{id, title, notes, hint (the hunter's own message to you about THAT task — obey it when splitting and scheduling it), done, deleted, deadline 'YYYY-MM-DD', rank E-S, stat STR|INT|AGI|VIT|PER, subtasks[{id,title,done}], repeat{type,every,days}, nextDay, pinDay, origin}`
  - A task is **open today** when `!deleted && !done && (!nextDay || nextDay <= today)`
  - A task with **`sealed: true`** is off limits to the quest system. **Never put it in `quests`** — not when it is overdue, not when it is due today, never. You may still `split` it into subtasks and set its rank and stat in `updates`; that help is welcome. The app drops it from `quests` anyway if you try.
- `log`: map id → `{type: done|sub|bonus|buy, day, xp, gold, stat, taskId}`. Use it for streak and history.
- `plans`: map date → the plans that have already been applied. A quest with `blocked: true` was pushed back by the hunter; `reason` says why, and it doesn't count for or against the day.
- `notes`: map date → `{date, text}` — what the hunter wrote to the coach that day. **Read the last 3 days and act on it.**
- `settings.standing`: permanent standing orders. Always obey them.
- `settings.restDays`: rest weekdays (0=Sunday). `restDates`: map date → `{rest:true|false}` — a day marked in the calendar (holiday, day off, or a weekend he decided to work) **overrides** the weekday rule. On a rest day: at most 3 short quests, ≤45 minutes total, only repeating habits and accepted side quests, and never a penalty — except that anything overdue or due today/tomorrow still goes in, on top of that limit.
- `log` entries of `type: "focus"` hold real measured minutes (`minutes`, `taskId`) — use them so your `minutes` estimates are honest.

**Today** = the current date in UTC+5, where the day starts at 04:00.

## Processed marker
If a file named `ai-plan-<today>.json` exists anywhere in Drive, **today is processed. Do nothing.**

## Output: create `ai-plan-<today>.json` in the `SoloSystem` folder (plain JSON only)
```json
{"date":"YYYY-MM-DD","source":"claude","title":"Daily Quest: <theme>","message":"1-3 sentences, System voice",
 "splits":[{"taskId":"<existing id>","subtasks":["concrete step","..."],"rank":"B"}],
 "updates":[{"taskId":"<id>","rank":"C","stat":"INT"}],
 "newTasks":[{"ref":"n1","title":"...","rank":"E","stat":"STR"}],
 "quests":[{"taskId":"<id>","subtask":"exact subtask title (optional)","newTaskRef":"n1 (optional)","minutes":30,"xp":40,"gold":20,"note":"why today"}],
 "bonus":{"text":"reward for clearing all","xp":60,"gold":40},
 "penalty":{"title":"Penalty Quest: ...","rank":"C","stat":"STR"}}
```
## Paid work in the daily plan
`"paidOpportunities":[{"ref","title","company","url","why","pay","place","kind":"job|contract|freelance","deadline","subtasks":[...]}]`
3-5 fresh, verified, currently open: remote jobs and contracts in Python/backend/AI/GPU that accept a contractor registered in Uzbekistan, plus freelance gigs for quick money. Never an invented link, company or salary. Don't repeat what appeared in recent plans' `paid`. Accepting one in the app creates a task in its own APPLICATIONS section. **Never put a task whose `origin` is `job` or `opportunity` into `quests`** — not even when it is overdue or due today. He works those from the Tasks screen himself; the app refuses them anyway.

## Rules
- **The deadline rule overrides everything.** Every task that is overdue, due today or due tomorrow goes into `quests` no matter what — rest day, time budget, quest cap, standing orders, a bad note, all of it. Two exceptions, and only two: tasks with `origin` `job` or `opportunity` (applications), and tasks with `sealed: true`. Neither is ever scheduled, whatever its deadline. Give each one a `note` saying why ("overdue — it cannot wait" / "deadline due today"). The app enforces this after reading your file, so a plan that leaves one out is simply corrected; write it in yourself so the wording is yours.
- These forced quests do **not** count against `dailyMinutes` or `maxQuests`. Fill the rest of the day up to those limits as usual, so habits are not pushed out by a deadline.
- The minutes of the remaining (non-forced) quests added together must be ≤ `dailyMinutes`, with at most `maxQuests` of them. Priority order: overdue, then deadline ≤ 2 days, then pinned (`pinDay == today`), then penalty tasks, then repeating tasks, then balancing the stats.
- Big or vague tasks (rank A/S, more than 90 min, or several steps with no subtasks): split them into 3-8 concrete subtasks and assign only 1-2 of those subtasks today, using the exact subtask titles.
- XP guide: E10 D20 C40 B70 A120 S200. A subtask quest is worth 10-40 XP. Gold is about XP/2.
- Base the message on real facts: the streak, the last 7 days, yesterday's result, upcoming deadlines, and the hunter's note. Don't add fluff.
- Don't re-assign a task that was blocked yesterday if the reason still stands. Adjust the load to what the note and the standing orders say.
- A subtask title that isn't already on a task is created automatically.

---

# Weekly review (Friday evening scheduled task)

## Input
Same `system-db.json`. Look at the last 7 days: `log` (done/sub/bonus/focus by `day`), `plans` (cleared vs failed, blocked quests and their reasons), `notes`, `tasks` (what is overdue or untouched), `settings.restDays` and `settings.standing`.

## Output: create `weekly-review-<friday-date>.json` in the `SoloSystem` folder
```json
{"date":"YYYY-MM-DD","weekOf":"Sep 21-27",
 "summary":"2-4 sentences, System voice, grounded in the real numbers",
 "wins":["what actually got cleared"],
 "slips":["what slipped, with the honest reason"],
 "focus":"one sentence: the single thing next week turns on",
 "sideQuests":[{"ref":"sq1","title":"Volleyball with friends on Saturday evening","why":"one line grounded in his week","rank":"D","stat":"STR","gold":80,"minutes":120}]}
```
## Opportunities (same file)
`"opportunities":[{"ref","title","url","why","deadline","cost","place","rank","stat","subtasks":[...]}]`
Real and verified only: free, funded or paid-to-participate; remote, Germany or Uzbekistan; deadline inside 1-3 months; the page opened and checked. Accepting one in the app creates a task in the APPLICATIONS section with the link, the steps and the deadline; it is never scheduled as a quest. Dismissed and untouched ones vanish with the next review. Don't repeat anything already in an earlier review's `opportunities`.

## Rules for side quests
- 3-4 of them, for **living**, not productivity: sport with other people, being outdoors, something with friends or family, hands-on or cultural, something restful. Never work, study or chores.
- Invent them yourself from what the week looked like: long screen streaks → get outside; no social entries → something with people; heavy training week → something calm.
- Concrete and doable on the coming rest days, each with a gold reward (60-150). The hunter accepts the ones he wants in the app; they become tasks due at the end of the rest block.
- Rest days (`settings.restDays`) get at most 3 short quests, ≤45 minutes total, and never a penalty — anything overdue or due today/tomorrow is the one exception and goes in anyway.
