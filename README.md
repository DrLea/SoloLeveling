# THE SYSTEM: a daily quest tracker in the style of Solo Leveling

A static PWA that you can install on desktop and phone. You don't need a server.

- **Tasks.** Type a task and press Enter, then tick it when it's done. Press the ⌛ chip for a deadline (today / tomorrow / +3 days / +1 week / Saturday / end of month), or type `!tom`, `!3d`, `!fri` at the end of the line. Press ✎ for subtasks, a reward (text and bonus gold), a difficulty rank from E to S, a stat, and a repeat rule. The repeat rules are: daily, certain weekdays, every N days, N days after you finish, or monthly.
- **Daily Quest.** Each day the System picks a set of quests you can manage from your tasks. You get a clear reward if you finish them all. If you miss any, a **Penalty Quest** appears the next day. The day resets at 04:00 (UTC+5).
- **Game layer.** You earn XP and levels, move up through Hunter ranks (E → S → National), and raise five stats (STR/INT/AGI/VIT/PER). Status shows a hologram of you drawn from those stats. You also get streaks, titles to unlock, and a gold **Shop** where you set your own rewards.
- **Sync** runs through your own Google Drive: `My Drive/SoloSystem/system-db.json`.
- **AI plans.** Claude, run as a scheduled task at 04:00, writes `ai-plan-YYYY-MM-DD.json`. If no plan exists by the fallback hour, the app calls Haiku **once**. When a plan file exists for the day, that day counts as processed, so no second AI call is made.

## Security model (what the password actually protects)
| Where | What | Protection |
|---|---|---|
| GitHub repo | code only | public, holds no secrets (the OAuth Client ID is not a secret) |
| Google Drive | tasks, log, plans | only your Google account can read it. It is stored as plaintext on purpose, so scheduled Claude can read it |
| Google Drive | Anthropic API key | **AES-256-GCM encrypted** with a key derived from your password (PBKDF2, 250k iterations) |
| Device cache | everything | encrypted with your password key |

If someone opens your public GitHub Pages URL, they get an empty lock screen. Your data needs your Google login, and the API key also needs your password. The password **cannot be recovered**.

---

## Setup (about 15 minutes, once)

### 1. Put the app on GitHub Pages
1. Create a repo, e.g. `system`, and push every file in this folder to it.
2. In the repo, go to **Settings → Pages → Source: Deploy from branch → main / root**.
3. The URL will be `https://<your-username>.github.io/system/`

### 2. Google OAuth Client ID (for Drive)
1. Go to https://console.cloud.google.com/ and create a project called "System".
2. **APIs & Services → Library →** enable **Google Drive API**.
3. **OAuth consent screen:** choose External, give the app a name, and add your email. Under **Test users**, add your own Gmail. You can leave the app in *Testing* mode.
4. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized JavaScript origins: `https://<your-username>.github.io`. For local testing, also add `http://localhost:8000`.
   - You don't need redirect URIs.
5. Copy the Client ID (`xxxx.apps.googleusercontent.com`). Paste it into `config.js`, or type it in on the first screen of the app.

> The app asks for the full `drive` scope. It needs this to read plan files that Claude's Drive connector creates, because files made by another app are hidden under the narrower `drive.file` scope. Google will warn you that the app is "unverified". That's expected for a personal app: click *Continue*.

### 3. First launch
- **Desktop:** open the URL, enter the Client ID, create a password, then press **Accept** and sign in with Google.
- **Phone:** open the URL, choose "Add to Home screen", then **Restore from Google Drive** and enter the same password.
- Tick **Remember this device** so you don't have to type the password every time. The key is kept as a non-extractable key in IndexedDB.
- Google tokens last about 1 hour. When sync shows **⟳ reconnect**, tap it. Unlocking the app also reconnects.

### 4. Haiku (optional fallback)
Go to **System tab → AI** and paste your Anthropic API key. The default model is `claude-haiku-4-5`, and the default fallback hour is 06:00. The app makes at most one automatic request per day. It also has two manual buttons: "⚡ Split with AI" in the edit screen, and "Re-plan" on the quest screen. Each press costs one request.

### 5. Scheduled Claude planner
1. In Claude, connect the **Google Drive** connector.
2. The scheduled task runs every day at 04:00 Tashkent (23:00 UTC). It reads `system-db.json` and writes `ai-plan-<date>.json` into the `SoloSystem` folder, following `PLANNER_SPEC.md`.

## v2 additions
- **Record tab:** a month calendar. Darker squares mean more EXP, a gold dot means the daily quest was cleared, red means it was failed. Tap a day to see everything you did.
- **Dungeons:** tick "⚔ Dungeon" on a big task. It gets its own progress bar on the Tasks tab, and clearing it gives you a **medal** kept on the Status tab. Tasks the AI splits into 4+ subtasks become dungeons automatically.
- **Shadow army:** every finished task rises as a shadow, shown by rank on the Status tab.
- **System items** (Shop): Skip Token (drop one quest with no penalty), Streak Shield (used automatically when a daily quest fails, so the streak survives), EXP Potion (double EXP until the reset).
- **Awakening:** levels never cap. From level 30 you can Awaken — level back to 1, every stat, medal, title and coin kept, plus a permanent +10% EXP each time.
- **Android back button** steps back through tabs and closes dialogs instead of closing the app.
- **Sync:** changes save locally at once and go to Drive about a second later. The Google token lasts an hour, so the app renews it in the background, retries when you tap the screen, and syncs when you open, leave or close the app. Nothing is lost while offline — the sync badge shows "saved here" and it uploads on the next connection.

## v4 additions
- **⤺ Blocked:** push a quest back to Tasks when it can't be done through no fault of yours. Type a reason, the goal count shrinks (3/4 → 3/3), no penalty, and Claude reads the reason the next morning and doesn't hand you the same wall again.
- **Quick add on the Quests screen:** type an urgent task and it becomes a quest for today as well as a normal task.
- **⟳ Reroll:** swap a quest for the next best task from your list. Instant, no AI request.
- **▶ Focus timer (optional):** start it if you want the real minutes measured. Ticking a quest done never needs it, and the measured times teach Claude how long things actually take you.
- **Note to the System:** a note you edit through the day on the Quests screen. Claude reads the last 3 days of notes when planning and adjusts. Each day's note is kept and shown in Record.
- **Standing orders** (System tab): permanent rules every plan must respect.
- **💬 Message to the System per task:** the 💬 button on a task row (or the field in its edit screen) holds a note about that one task — how to split it, when it can be scheduled, what it needs. Claude reads it when it splits and assigns that task.

## v7-v8
- The star is gone. **⊕** on a task puts it into today's quests right away (⊘ tap again to take it out). If the task has unfinished steps it assigns the **next step**, not the whole task.
- **Steps in the task list:** the ▸ arrow opens a task's subtasks. Each one has its own checkbox and its own ⊕, so you can assign exactly the step you want — several from one task if you like. Auto-pick and reroll follow the same rule.
- **The penalty is issued once.** The penalty task has a fixed id per date, and with Drive on the app waits for the first sync before judging yesterday, so phone and desktop can't both create one.
- Emoji replaced by thin line icons; the dungeon checkbox is now a ⚔ DUNGEON chip.

## v11
- **Rest days** (System tab, pick the weekdays): only repeating habits, anything due within 2 days and accepted side quests. No penalty, and the streak holds even on an empty day.
- **Weekly review**, written by Claude on Friday evening: what was cleared, what slipped, the focus for next week, plus 3-4 **side quests for living** (volleyball, a hike, something with friends). Accept the ones you want and they become tasks due by the end of the weekend, each paying gold.
- **Shadows are spendable.** Every cleared task is a shadow; now you can call them: Double EXP (10), Extraction for 200 gold (15), Shadow Shield (25). Spending lowers the army, so it is a real choice.
- Medals stay a permanent record and unlock the Dungeon Conqueror title.

## v12
- **Medals removed**; dungeon clears still count towards the Dungeon Conqueror title.
- **No more buying system items with gold.** Skip tokens, shields and EXP potions are summoned with **mana**, which gathers +10 a day and +10 more for each cleared daily quest. Gold is only for your own rewards in the Shop.
- **The army is immortal and weighted by rank** (E1 D2 C4 B7 A12 S20). Army power counts standing shadows; rank A and S shadows are listed separately as **Elite**.
- **Shadows can fall.** Lose a day and one shadow falls per missed quest — chosen identically on every device. A fallen shadow is never deleted, only dimmed, and mana raises it again (rank × 3). Reviving 25 of them earns the **Dark Heart** title.
- Every rank now has its own outline: dotted E, dashed D, solid C, double B, glowing A, pulsing S.
- **Rest days in the calendar:** open any day in Record — past or future — and mark it as a rest day. Useful for holidays and leave; it overrides the weekday setting both ways.

## v14
- **Opportunity dungeons.** The Friday task now also searches the web for real, currently open scholarships, hackathons, free certifications, grants and CFPs that fit you (free/funded only, remote or Germany or Uzbekistan, deadline inside 1-3 months, link verified). They appear in the review card under OPPORTUNITIES — **accept** turns one into a dungeon with the link, the steps and the real deadline, **✕** dismisses it. Whatever you don't take disappears with the next review.
- Tasks can carry a **link** (field in the editor, "open ↗" chip on the row and on the dungeon card).
- **Classes.** At level 10 you choose Shadow Assassin, Scholar of the Abyss or Berserker; each level after gives a **skill point**. Skills: Mana Flow (+3 mana/day), EXP Surge (+5% EXP), Shadow Bond (revive 20% cheaper), plus one class-only skill each. An Awakening refunds the points.
- **Analytics** (Record → Analytics): when you actually work by hour, which ranks you drop, how long a task lives, planned minutes vs measured, EXP by week.
- **Hunter license**: Status → "Export hunter license" saves a PNG card with level, rank, class, stats, army and titles.

## v16
- **Paid opportunities.** The 4 AM task now also searches for work: remote jobs and contracts (Python/backend/AI/GPU, contractor-friendly) and freelance gigs. They land in a **PAID OPPORTUNITIES** panel on the Quests screen with company, pay, place and a verified link. **apply** opens an application dungeon (read the posting → tailor the CV → write the message → send → follow up in a week), **✕** dismisses. The list refreshes with each day's plan.
- **Collapsible panels.** PAID OPPORTUNITIES, WEEKLY REVIEW, OPPORTUNITIES and SIDE QUESTS are collapsed by default with a counter of unhandled items in the header; they fold back when you leave the tab.
- **Fixed:** sharing a dungeon failed with "Drive 400 — invalid JSON payload" because party files were sent to Drive's metadata endpoint instead of its upload endpoint.

## v17
- **Deadlines take three taps instead of a date picker.** Every task row has a ⌛ chip showing what is actually left — *tomorrow*, *3d left*, *overdue 4d* — in gold as it gets close and red once it's past. Tap it and a row of chips opens: today · tomorrow · +3 days · +1 week · Saturday · end of month · a date picker · clear. The same chips sit above the date field in the editor.
- **Shorthand in the add box.** Type `Finish the CV !tom` and it is filed with tomorrow's deadline. `!today` `!tom` `!3d` `!2w` `!fri` `!eom` `!2026-11-01` all work, in the Tasks box and in the quick-add on the Quests screen. An unknown `!word` is left alone as part of the title.
- **A deadline is now absolute.** Anything overdue, due today or due tomorrow goes into today's quests whatever the day looks like — rest day, holiday, time budget, quest cap, whichever plan Claude wrote. They are marked on the quest card with the time left and a coloured edge (gold for due, red for overdue). They ride **on top** of the day's allowance rather than spending it, so a deadline never pushes your habits out of the day. Setting a deadline of today or tomorrow puts the task into today's quests on the spot.
- **The Shop is a shop now.** Gold earned / spent / in hand across the top; twelve ready-made rewards you can take as they are with one tap; **Today's Offer** — one of your own rewards at -30%, the same one on every device, once a day; **System Services**, gold for things that buy you air rather than power: a *Rest Day Pass* (250 G, marks tomorrow a rest day) and *Deadline Grace* (150 G, pushes your most urgent deadline back a day); and the **Army Summons** mirrored from Status so the mana items are visible here too. Gold still cannot buy skip tokens, shields or potions — those are the army's.
- **The hologram.** Status opens with a figure of you, drawn by code from your own numbers: STR widens the frame, VIT feeds the core, AGI thins the build, INT grows the ring above the head, PER puts marks in orbit around it. It gains its gear with your Hunter rank — outline at E, reinforced at D, plated at C, cloaked at B, shadow-wreathed at A, crowned at S, a sovereign aura above that — and it is tinted by your class. It boots with a flicker and a scan sweep, and it tells you what changes it next.

## v15 — party
Any dungeon can be shared. Press **⇪ share** on its card: the app makes a folder inside `SoloSystem`, marks it "anyone with the link can edit", writes `party.json` (title, steps, link, deadline) into it, and opens the phone's share sheet (on desktop the link is copied).

A friend opening the link gets the dungeon with the same steps and starts their own run of it. Each member writes only a small `member-<id>.json` — name, how many steps are done, when they last moved. **Nothing else is shared**: your other tasks, stats, notes and army stay private, because only this one folder is link-shared, not your database.

The party board sits on the dungeon card and shows everyone's progress.

**The friend needs Google Drive sync too.** Opening a link in local-only mode shows a clear explanation and the exact steps (System → Google Drive sync → Client ID → connect), and the link can simply be opened again afterwards.

## Backups
The Friday task copies `SoloSystem/system-db.json` to `backup-system-db-<date>.json` in the same folder before it writes the review, and keeps the 8 newest copies (about 60 KB each today). The app ignores those files — it only ever reads `system-db.json`, `ai-plan-*` and `weekly-review-*`.

**To restore:** rename the current `system-db.json` to something else (e.g. `broken-system-db.json`), rename the backup you want to `system-db.json`, then in the app press ⟳ to sync. On the device that still holds the bad data, unlock and let it sync — the merge keeps whichever record is newer, so if the damage was a deletion it comes back; if the damage was a bad edit, clear that device's local copy first (System tab → Lock now, then reload) before syncing.

There is also **Export JSON** in the System tab for a copy on disk at any time.

## Files
`index.html`, `style.css`, `app.js` (all the logic), `config.js` (Client ID), `sw.js` (offline cache: bump `VERSION` whenever you deploy), `manifest.json`, `icon.svg`, `PLANNER_SPEC.md` (the plan format shared by Claude and Haiku).

## Local test
`python -m http.server 8000`, then open http://localhost:8000
