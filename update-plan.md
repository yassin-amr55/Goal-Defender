# Update Plan — Goal Defender

Status: **planning only — nothing implemented yet.**

Naming note: this file is `update-plan.md`. Existing docs are `BETTER.md`,
`GAME_DISCRIPTION.md`, `TOURNAMENT.md`.

---

## Part 1 — Trophy prizes (paid every win)

**New values**

| Cup | Prize per win |
|---|---|
| Qualifiers | **$500** |
| Champions | **$10,000** |

**Where:** `scenes/TournamentGameScene.js`, the "Won the tournament!" branch
(~line 658), inside the `mode === 'qualifiers'` / `mode === 'champions'` blocks.

```js
const TROPHY_PRIZE = { qualifiers: 500, champions: 10000 };
// flat add to goalDefenderMoney — pays on every cup win,
// no counter or tracking required
```

Flat add to `goalDefenderMoney`. Pays on **every** win, independent of
achievements.

**Victory screen:** `scenes/TournamentVictoryScene.js:33` currently prints only
`Money Earned: $X` from match deflections. Add a separate
**`Trophy Prize: +$500`** line so the two are visibly different. Without it the
prize is credited silently and the player never learns cups pay.

Trophy counters already increment correctly — `TournamentVictoryScene.js:84-89`
writes `tournamentQualifiersWinCount` / `tournamentChampionsWinCount`, and
`TrophyRoomScene.js:43-44` reads them. No change needed.

---

## Part 2 — Tournament match rates

| Tournament | Rate | Was |
|---|---|---|
| Qualifiers | **$5 / score** | $3 |
| Champions | **$10 / score** | $3 |

**Where:** `scenes/TournamentGameScene.js:632`

```js
const money = this.score * 3;      // before
const money = this.score * RATE;   // after, RATE = 5 | 10 by mode
```

Flows automatically into `progress.moneyEarned` (line 644) and the victory
screen. No other call sites.

Scope: **tournament matches only.** Tutorial ($6 fixed) and endless mode are
unchanged.

---

## Part 3 — Champions score goals → 60 / 70 / 80 / 90 / 100

**Where:** `getRequiredScore()` in `scenes/TournamentGameScene.js`

```js
champions: {
    roundOf32: 60,
    roundOf16: 70,
    quarterFinals: 80,
    semiFinals: 90,
    finals: 100
}
```

Qualifiers unchanged (20 / 30 / 40 / 50).

**Resulting money totals**

| Round | Score | Qualifiers @$5 | Champions @$10 |
|---|---|---|---|
| Round of 32 | 60 | — | $600 |
| Round of 16 | 70 | $100 | $700 |
| Quarter finals | 80 | $150 | $800 |
| Semi finals | 90 | $200 | $900 |
| Final | 100 | $250 | $1,000 |
| **Match total** | | **$700** | **$4,000** |
| **+ trophy prize** | | **$1,200** | **$14,000** |

---

## Part 4 — Achievement revalues

| ID | Was | Becomes | Fires on |
|---|---|---|---|
| `tourn_qual` | $600 | **$300** | first Qualifiers win |
| `tourn_champ` | $15,000 | **$5,000** | first Champions win |

`achievements.js:88-89`. `tourn_3` ($3,000) and `tourn_10` ($60,000) unchanged.

All five tournament achievements already use `goal: 1` (or `3`/`10` for the
multi-win pair), so "first win only" is already the behaviour — nothing to
change.

---

## Part 4.2 — Global price & reward rebalance

**Goal:** raise all 13 ball prices and cut all 30 achievement rewards by the
**same proportional rate**, so the economy keeps its shape.

### Balls (`scenes/ShopScene.js` → `ballData`)

Current prices: $0 / 150 / 300 / 1,200 / 1,500 / 2,000 / 3,000 / 5,000 /
5,250 / 7,500 / 8,000 / 20,000 / 500,000

### Achievements (`achievements.js` → `LIST`)

Current total payout **$12,276,845**. Median $1,200. Min $20. Max $10,000,000.

### Method

Pick a single multiplier `k` (e.g. `0.6`) and apply to every entry:

```
newPrice  = round(oldPrice  * k)
newReward = round(oldReward * k)
```

- Round consistently, then **hand-review the top 5 rewards** — they hold 99% of
  the pool, so rounding matters most there.
- **Keep the $0 and $500,000 endpoints** or the ladder loses its shape.
- Rebalance and Part 1–3 interact: trophy prizes and per-score rates are set
  explicitly and should be excluded from the multiplier.
- **Order matters:** do 4.2 *after* 1–4 so the new prize values are the ones
  that get reviewed against the rebalanced ball prices.

### Open

The multiplier `k` is **not chosen**. Pick before implementing.

---

## Part 5 — Player name

- **First launch** (no `playerName` key): prompt for a name before the menu.
  Default **`PLAYER`**.
- Max ~14 characters, sanitised, stored as `playerName`.
- **Editable** in `SettingsScene` via a new name field.
- Add `playerName` to the `settings.js` do-not-change key contract.

Needed before Part 6 — the leaderboard ranks by name.

---

## Part 6 — Leaderboard

### UI

- New button **under the settings gear** in `MenuScene`, following the existing
  `UI.iconButton` pattern (depth 50, top-right cluster). Requires a **new SVG
  icon** loaded in `BootScene`. No emoji.
- **`LeaderboardScene`** with two tabs:
  - **HIGH SCORE** — ranked by `goalDefenderHighScore`
  - **TROPHIES** — ranked by total trophies
    (`tournamentQualifiersWinCount + tournamentChampionsWinCount`)
- **Scrollable** when the list overflows, following the `AchievementsScene`
  paging pattern.

### ⚠️ Backend is required

`localStorage` is per-browser. Your score and your friend's can never appear on
the same board, so a real leaderboard needs a shared server. This is the one
part that cannot ship offline.

**Option A — Firebase (recommended)**

- Firestore collection `players/{id}`: `name`, `highScore`, `trophies`,
  `updatedAt`
- One collection serves both tabs (`orderBy('highScore')` /
  `orderBy('trophies')`, `limit(50)`)
- Client SDK from CDN, **anonymous auth** — no login wall
- Free tier covers a small game indefinitely; hosted, no ops

Costs: one external dependency; `firebase-config.js` containing your keys
(**safe** — Firestore *security rules*, not the config, protect data); rules
must be written so players can only write their own document.

**Option B — own backend**

Node + Express + SQLite on Render / Railway / Fly.io. Full control, no vendor,
no quotas. But: you pay for uptime and handle hosting, backups, HTTPS, rate
limiting and abuse protection — none of which Firebase gives you for free.

**Recommendation: Firebase.** Right-sized for a browser game with no server
logic. Own a backend only when anti-cheat, analytics or cloud saves justify it.

### Cheating (applies to both)

Client scores are self-reported. Mitigations:

- Write only when a score is **beaten**, not on every run
- Cap writes per session
- **Server-side range validation** — a 30,000,000 score gets rejected

---

## Part 7 — Launch v2.1

1. Implement Parts 1–6 (and 4.2) with `node --check` on every `.js`
2. Verify all scenes boot clean
3. Tag `v2.1`, push to GitHub
4. Rebuild the itch zip, re-upload to itch.io
5. Update the devlog / add a v2.1 post
6. Retag note: `v2.0` → `d17df65` excludes the medal, ceiling and wall fixes
   that are on `main`. Decide whether to move it.

Parts 1–4 need no network and can ship ahead of the leaderboard.

---

## Part 8 — Optional login / signup

**Username + password only**, and **optional** — the game must remain fully
playable with no account. Purpose is **saving progress across devices**.

- When a username is set, it **replaces the Part 5 name** everywhere (menu,
  leaderboard).
- Accounts store `highScore`, `trophies`, `deflections`, money, owned balls,
  achievements.
- Strong password hashing (Firebase Auth handles this if Option A is used).
- Needs its own backend — builds directly on Part 6's.

---

## Part 9 — More balls

Grow the roster beyond 13. Each needs:

- New texture + `ballData` entry (price-sorted), `loadBallAbilities()` entry in
  `GameScene.js`, `getBallTexture()` maps in `MenuScene` and
  `TournamentGameScene`
- A **distinct ability**, not a reskin — review whether each still makes sense
  once stronger balls exist
- Name/price/ability review as a set, per the 4.2 rebalance

Candidates already implied by the system: anything altering `boostStepMain`,
`boostStepLate`, `maxSpeedBoost`, `minHitboxMultiplier`, `scoreMultiplier`,
`hitboxShrinkMultiplier`, `speedMultiplier`, `jumpMultiplier`,
`startHitboxMin`.

Caution: 300% speed boost compounds to **~19× real speed** (pre-existing,
deliberately untouched). Successive speed-boost balls will hit that ceiling
fast — balance against diminishing real returns, not displayed percentage.

---

## Part 9.2 — Launch v2.2

Ships the new balls from Part 9. Sequence:

1. Implement Part 9 (new balls: textures, `ballData`, abilities, texture maps)
2. `node --check` every `.js`; verify all scenes boot clean
3. Verify each new ball's ability **behaviourally**, not by reading the code —
   the same standard the original 13 were held to
4. Confirm the shop grid still lays out cleanly (4 cols × 2 rows, 8 per page,
   2+ pages) and that **price order is still correct** with new entries
5. Balance pass: re-check price order against ability strength
6. Tag `v2.2`, push to GitHub, rebuild the itch zip, re-upload to itch.io
7. Devlog post for the new balls

Depends on: Part 9, and Part 4.2's price ladder — new balls must be priced
relative to the rebalanced scale, not the original one.

Carries forward from v2.1: the "not using the screenshot column" note if theme
layout changed, and any Part 4.2 price/reward values as shipped in v2.1.

---

## Part 10 — Play Store preparation

- **Wrap for Android** — Phaser HTML5 → APK via Capacitor / Cordova / WebView
  wrapper
- Icons + splash, version code, app listing, screenshots
- **Google Play policy:** needs a privacy policy URL, data-safety form, and
  **declaration on AI-generated content** (the game uses SVG icons — the itch
  listing already discloses this)
- Monetisation decision: free, ad-supported, or purchase. Ad SDKs need their
  own consent flow and a privacy-policy update
- Test on low-RAM devices — Android WebView is the same engine as his browser,
  so the **Part 4.2-style performance findings apply directly**
- Note: mobile rotation already works; verify the rotated viewport survives
  the app wrapper

---

## Part 11 — Multiplayer

The largest item. Scope it before writing code.

Options:

| Model | Notes |
|---|---|
| **Async** ghost races | Best value. Replay recorded input, race a stored score. No netcode, no servers. Fits a reflex game perfectly. |
| Turn-based | Bracket + head-to-head rounds |
| Real-time | Authoritative server, lag compensation, anti-cheat. Weeks of work, needs the Part 6 backend regardless |

**Recommendation: async ghost races.** The game is one-tap reflex with no
spatial simulation, so real-time netcode buys very little. Async ghosts reuse
existing physics and need only Part 6's backend.

Reuses: Part 6 infrastructure, Part 3's round targets, the Part 8 account system.

---

## Build order

| Order | Part | Network? | Version |
|---|---|---|---|
| 1 | 1–4 — trophy prizes, rates, scores, achievements | No | v2.1 |
| 2 | 4.2 — price & reward rebalance | No | v2.1 |
| 3 | 5 — player name | No | v2.1 |
| 4 | 6 — leaderboard | **Yes** | v2.1 |
| 5 | 7 — launch v2.1 | — | — |
| 6 | 8 — accounts | Yes | v2.2 |
| 7 | 9 — more balls | No | v2.2 |
| 8 | 9.2 — launch v2.2 | — | — |
| — | 10 — Play Store | Yes | v2.3+ |
| — | 11 — multiplayer | Yes | v2.3+ |

**In progress: Parts 1–4.** 4.2 is sequenced after them deliberately — the new
trophy prizes and per-score rates must be the values reviewed against the
rebalanced price ladder, not values that get multiplied again.

Every part gets its own `node --check` pass plus a scene boot check before
anything is pushed.

---

## Decisions needed

1. **Champions trophy prize** — only Qualifiers was specified at $500.
   Assumed **$10,000**. With $10/score Champions match money is now $4,000, so
   $10,000 still reads as the bigger prize.
2. **Multiplier `k` for Part 4.2** — not chosen.
3. **Part 2 scope** — tournament matches only. Confirm tutorial/endless stay put.
4. **Leaderboard backend** — Firebase (recommended) or own?

## Known bugs found while planning (not yet fixed)

- **Achievements header can go stale.** `AchievementsScene` renders the
  `UNCLAIMED` total once in `create()`. If anything unlocks an achievement
  afterwards, the header and the CLAIM ALL button show an outdated figure until
  something calls `refreshHeader()`. Confirmed live: header read `$1,400` while
  the true value was `$2,150`. Cannot normally happen while merely viewing the
  page, but it did under scripted scene entry.
- **No `localStorage` key contract.** Renaming any key now silently wipes every
  existing player's save. Needs a do-not-change comment block in
  `settings.js`.
- **`assets/wall.png`** (80KB) is bundled but unused.
- **Tournament right wall** uses the goal art rather than `new-wall.png`.