# Roadmap — agreed October 2026, to build later

Nothing here is implemented yet. Kept so the next session can pick it up without re-deciding.

## 1. Classes and a skill tree
A class chosen at a milestone level (Assassin / Tank / Mage or similar), each with passives that change the rules rather than the numbers only: more EXP for morning quests, cheaper summons, a softer penalty. Branches bought with points earned per level.

## 2. Real dungeons — the AI finds worthwhile things in the real world
The scheduled Claude task looks for scholarships, hackathons, certifications, grants, CFPs and similar opportunities that fit his field (backend, GPU/systems, AI), then creates a **dungeon** for each:
- a task with a **clickable link** to the source,
- subtasks that break the application or preparation into steps,
- the real deadline of the opportunity.

Goal: the System keeps him busy with profitable things, not only with what he already wrote down. Open questions for next time: how often to search, how to filter noise, whether he confirms each dungeon before it lands.

## 3. Hunter certificate
An exportable card (PNG/PDF): level, hunter rank, stats, army power, top achievements for the period. Meant to be shown to people; also the natural closing card of a season.

## 4. Analytics — "must-have"
Which hours he actually clears quests in, which ranks he fails most, how long a task lives from creation to completion, estimate vs measured focus time, stat growth over months.

## 5. Google integrations (reuse the existing OAuth)
Already has a Google account + Drive scope, so the marginal cost is scopes and API calls:
- **Calendar** — a loaded day plans itself lighter without him writing a note.
- **Google Fit** — steps and workouts raise STR/VIT by themselves.
- Others as they prove useful (Tasks, Gmail for deadlines, Photos for proof of a side quest).
Verified data also makes achievements real rather than self-reported.

## 6. Party with friends (link-shared, still no backend)
- Create a dungeon (e.g. "learn some technology"), press **share** → native share sheet on the phone, copy on desktop.
- The link carries the id of a **link-shared Drive folder**; a friend who opens it joins the challenge.
- Each member keeps their own state file in that folder; the app reads the others to show progress and a small party board.
- **Keep everything inside one Drive folder** — no clutter spread around the account.
Open questions: merge rules for shared dungeon progress, what a joiner needs (own Client ID? own API key?), how to leave a party.

## Deliberately parked
Clans, wars, global leaderboards — they need a backend, accounts and an anti-cheat story (self-reported tasks are trivially gamed). Only worth it if the app is ever aimed at other people.
