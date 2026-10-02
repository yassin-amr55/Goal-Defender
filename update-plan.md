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

0. Read **9.2.1** (ability audit — two old "bugs" are not bugs, one new dead
   field found) and **9.2.2** (UI/design review — font floor, bracket
   truncation) before touching anything
1. Implement Part 9 (new balls: textures, `ballData`, abilities, texture maps)
2. `node --check` every `.js`; verify all scenes boot clean
3. Verify each new ball's ability **behaviourally**, not by reading the code —
   the same standard the original 13 were held to, and the standard that caught
   the dead `scoreRate` field
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

## Part 9.2.1 — Ball ability audit (all 14 balls, verified in play)

Run before adding new balls. **Two previously reported defects turned out not
to exist**, and one real defect was found that nobody had reported.

### `audit-abilities.js` — structural pass

Every ability is a field assigned in `loadBallAbilities()`. If nothing *reads*
that field outside the loader, the ball costs money and does nothing. The
audit finds the loader body by counting braces, then reports reads with line
numbers so the count can be checked rather than trusted.

### F-07 is wrong — the Rubber Ball works

`TEST-RESULTS.md` F-07/F-27 report that `jumpMultiplier` is "assigned but never
read" and that the $3,600 Rubber Ball buys nothing. **Both are false.** The read
was missed because the audit only looked inside the loader:

```js
// scenes/GameScene.js:719
const jumpVelocity = -400 * (this.jumpMultiplier || 1);
```

Measured in play, ball parked on the ground then bounced:

| Ball | `jumpMultiplier` | launch velocity | peak rise |
|---|---|---|---|
| Default | 1.00 | −400 | 162px |
| Rubber | 1.25 | −500 | **246px** |

**No fix is needed for the ball.** Correct `TEST-RESULTS.md` F-07 and F-27
instead of shipping a "fix" for a bug that isn't there.

`TournamentGameScene` does set `jumpMultiplier = 1` and never reads it. That is
**correct**, not the same bug: tournaments deliberately neutralise *every*
ability so all entrants are on identical footing. The audit asserts this rather
than trusting the comment.

### The real Rubber Ball defect: the description is wrong in the other direction

Shop copy says **"Bounces 25% higher"**. That is the *velocity*. Height follows
`h = v²/2g`, so +25% velocity is **+52% height** — measured 162px → 246px.

The ball under-delivers on its own marketing and over-delivers in play. Two
clean options:

- **Restate the copy** as *"Bounces over 50% higher"* and keep `1.25`.
- **Or keep the promise literal**: set `jumpMultiplier ≈ 1.118` so the rise is
  genuinely 25% — but a less round number is harder to reason about later.

Recommendation: **restate the copy.** The stronger bounce is good for the player
and the current number is the easier one to tune.

### Roof headroom — a ceiling nobody has hit yet

Height is clamped at `maxBallHeight` (goal top minus one ball radius,
`GameScene.js:851`):

| Ball | peak | roof | clearance |
|---|---|---|---|
| Default | 407 | 288 | 119px |
| Rubber | 323 | 288 | **35px** |

The Rubber Ball clears the roof by 35px. Any Part 9 ball that raises
`jumpMultiplier` further starts losing height to the clamp, so it would deliver
less than its number says — silently, because the clamp looks like normal play.
**Check clearance before tuning that stat past ~1.3.**

### New finding: `scoreRate` is dead state

```js
// scenes/GameScene.js:396 — the comment is false
// Pays more per deflect. scoreRate is read by GameOverScene.
this.scoreRate = 5;
```

`scoreRate` is assigned in `GameScene` and **read nowhere in the codebase**.
The Money Ball still works, because `GameOverScene` ignores the field and reads
the equipped ball directly:

```js
// scenes/GameOverScene.js:50
const rate = (this.equippedBall === 'money') ? 5 : 3;
```

Verified in play: default pays $3/deflect, Money Ball pays $5/deflect.

So this is a trap rather than a bug — the field looks like the Money Ball's
wiring, and a future edit to `scoreRate` would compile, pass review and do
nothing. Either delete it or wire `GameOverScene` to read it; **deleting is
safer**, since one source of truth for the rate is better than two.

### All 14 abilities confirmed working

Endless mode only, by design. Every description maps to a field that is read:

| Ball | Price | Ability | Field |
|---|---|---|---|
| Golden | $150 | hitbox shrinks 15% slower | `hitboxShrinkMultiplier` |
| Steel | $900 | moves 10% slower | `speedMultiplier` |
| Rubber | $3,600 | bounces higher | `jumpMultiplier` |
| Ice | $4,500 | hitbox shrinks 50% slower | `hitboxShrinkMultiplier` |
| Anchor | $6,000 | moves 50% slower | `speedMultiplier` |
| Revive | $10,000 | saves you once | `revivesLeft` |
| Fire | $14,500 | +2 score per deflect | `scoreMultiplier` |
| Neon | $15,000 | speed boost +8% per hit | `boostStepMain` |
| Ghost | $15,750 | min hitbox 130% | `minHitboxMultiplier` |
| Money | $24,500 | $5 per score | *(read in GameOverScene)* |
| Candy | $50,000 | +3 score per deflect | `scoreMultiplier` |
| Void | $100,000 | starts min, max 150% | `startHitboxMin`, `maxSpeedBoost` |
| Gauntlet | $1.5M | hitbox 170%, max 130%, +5 score | `scoreMultiplier`, `maxSpeedBoost` |

**Price sanity:** Golden ($150) and Ice ($4,500) share one field at 0.85 vs
0.5, and Steel ($900) / Anchor ($6,000) at 0.9 vs 0.5. The multipliers are
close but the prices are 8× and 6.7× apart. That is defensible — slow shrink and
slow speed compound, so the stronger version is worth much more — but it is the
kind of thing to sanity-check before Part 9 piles more entries onto the ladder.

---

## Part 9.2.2 — UI and design review

Every scene booted and every text object measured from the live scene tree
(rather than read off the source), so the numbers below are what actually
renders.

### The one that matters: the font floor

12px text does not survive contact with a phone. Measured effective size after
the layout scale is applied:

| Device | 12px renders as |
|---|---|
| phone portrait / landscape | 6.50px |
| phone large | 6.90px |
| phone small Android | **6.00px** |
| tiny legacy | **4.50px** |

`AchievementsScene` is the worst offender and goes **below** the 12px that was
measured:

| Line | Size | Renders as (small Android) |
|---|---|---|
| `AchievementsScene.js:266` | 10px (category label) | **5.0px** |
| `AchievementsScene.js:241` | 11px (progress `22 / 50`) | **5.5px** |
| `AchievementsScene.js:219` | 13px (description) | **6.5px** |
| `ShopScene` ability lines | 12px | 6.0px |
| `TournamentBracketScene` team names | 12px | 6.0px |
| `AccountScene` field labels | 13px | 6.5px |

**Proposed floor: 16px authored.** That renders at ~8px on the worst device
tested and ~9px on a large phone — still small, but legible. `AchievementsScene`
needs the most work: 10px and 11px are carrying real information (category and
progress) rather than decoration, and they are the parts a player actually reads
to decide what to chase.

This was raised as F-13 and declined. It is listed again because the numbers
above are worse than the original report assumed — the floor is 10px, not 12px.

### Bracket team names are truncated

`TournamentBracketScene.js:339` shortens any team name over its max length:

```js
return name.length > maxLength ? name.substring(0, maxLength - 3) + '...' : name;
```

At 12px in a fixed column this renders as `Thunder Stri...`. Two problems: the
ellipsis eats two of the few characters available, and Champions runs 32 teams,
so the bracket is at its densest exactly when names get truncated. Raising the
12px floor to 16px will make this worse before it makes it better — budget the
column width at the same time, or drop the abbreviation for initials-only rivals.

### Smaller items worth a pass

- **Button label sizes are inconsistent.** Menu `TOURNAMENT` / `LEARN TO PLAY`
  are 15px while the main `PLAY` / `SHOP` buttons are 20px+. The two small side
  buttons read as secondary, which may be intended, but nothing in the layout
  says they are a different tier.
- **`ALREADY HAVE AN ACCOUNT` is 15px** (`AccountScene`) and is the only route
  between the signup and login forms. The lowest-priority-looking element on
  the screen is the one that has to be found.
- **Repeated 12px ability text in the shop** — 14 near-identical lines at the
  same unreadable size. Bumping the floor fixes legibility; grouping balls by
  *kind* of ability (hitbox / speed / score / survival) would do more for
  comprehension at that price point.
- **No confirmation when a ball is equipped** beyond the `EQUIPPED` tag. A ball
  change alters difficulty substantially (Void starts at minimum hitbox), and
  nothing tells the player that is about to happen.

### What is already right — don't regress it

- Buttons are rounded `Graphics`, never square `Phaser.Rectangle`
- Rotation on upright phones is correct at every aspect ratio tested, including
  a 2400×400 letterbox slot, and input coordinates map correctly through the
  rotation (all four corners verified in bounds)
- iPhone notch safe area: painted area fits inside the insets
- Every scene boots clean; no text overlaps a panel edge; no emoji anywhere

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

- **`TEST-RESULTS.md` F-07 and F-27 are wrong and must not be actioned.**
  They report the Rubber Ball's `jumpMultiplier` as assigned-but-never-read and
  its shop description as a false promise. Measured in play, the ball bounces
  246px against the default's 162px. The audit missed the read at
  `GameScene.js:719`. See **Part 9.2.1**. The real defect is the opposite one:
  the copy says "25% higher" (the velocity) when the rise is 52%.
- **`scoreRate` is dead state** (`GameScene.js:396`). Assigned, never read; the
  comment claims `GameOverScene` reads it and it does not. The Money Ball works
  via a separate direct read of `equippedBall`. See **Part 9.2.1**.
- **Font floor is 10px, not 12px** — `AchievementsScene.js:266`. Renders at
  5.0px on a small Android. See **Part 9.2.2**.
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