# THE SYSTEM: a daily quest tracker in the style of Solo Leveling

A static PWA that you can install on desktop and phone. You don't need a server.

- **Tasks.** Type a task and press Enter, then tick it when it's done. Press ✎ to set a deadline, subtasks, a reward (text and bonus gold), a difficulty rank from E to S, a stat, and a repeat rule. The repeat rules are: daily, certain weekdays, every N days, N days after you finish, or monthly.
- **Daily Quest.** Each day the System picks a set of quests you can manage from your tasks. You get a clear reward if you finish them all. If you miss any, a **Penalty Quest** appears the next day. The day resets at 04:00 (UTC+5).
- **Game layer.** You earn XP and levels, move up through Hunter ranks (E → S → National), and raise five stats (STR/INT/AGI/VIT/PER). You also get streaks, titles to unlock, and a gold **Shop** where you set your own rewards.
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

## Files
`index.html`, `style.css`, `app.js` (all the logic), `config.js` (Client ID), `sw.js` (offline cache: bump `VERSION` whenever you deploy), `manifest.json`, `icon.svg`, `PLANNER_SPEC.md` (the plan format shared by Claude and Haiku).

## Local test
`python -m http.server 8000`, then open http://localhost:8000
