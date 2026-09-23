# Daily plan spec (Claude scheduled task + Haiku fallback)

## Input: `My Drive/SoloSystem/system-db.json`
- `settings`: `tz` (5), `resetHour` (4), `dailyMinutes`, `maxQuests`, `name`
- `tasks`: map id → `{id, title, notes, done, deleted, deadline 'YYYY-MM-DD', rank E-S, stat STR|INT|AGI|VIT|PER, subtasks[{id,title,done}], repeat{type,every,days}, nextDay, pinDay, origin}`
  - A task is **open today** when `!deleted && !done && (!nextDay || nextDay <= today)`
- `log`: map id → `{type: done|sub|bonus|buy, day, xp, gold, stat, taskId}`. Use it for streak and history.
- `plans`: map date → the plans that have already been applied. A quest with `blocked: true` was pushed back by the hunter; `reason` says why, and it doesn't count for or against the day.
- `notes`: map date → `{date, text}` — what the hunter wrote to the coach that day. **Read the last 3 days and act on it.**
- `settings.standing`: permanent standing orders. Always obey them.
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
## Rules
- The minutes of all quests added together must be ≤ `dailyMinutes`, with at most `maxQuests` quests. Priority order: overdue, then deadline ≤ 2 days, then pinned (`pinDay == today`), then penalty tasks, then repeating tasks, then balancing the stats.
- Big or vague tasks (rank A/S, more than 90 min, or several steps with no subtasks): split them into 3-8 concrete subtasks and assign only 1-2 of those subtasks today, using the exact subtask titles.
- XP guide: E10 D20 C40 B70 A120 S200. A subtask quest is worth 10-40 XP. Gold is about XP/2.
- Base the message on real facts: the streak, the last 7 days, yesterday's result, upcoming deadlines, and the hunter's note. Don't add fluff.
- Don't re-assign a task that was blocked yesterday if the reason still stands. Adjust the load to what the note and the standing orders say.
- A subtask title that isn't already on a task is created automatically.
