# ARCHITECTURE

No build step. No bundler. No framework. Plain ES5-ish JavaScript loaded by
`index.html` in script order, running on Phaser 3.

That is a deliberate constraint: the game ships as a folder of files to itch.io
and runs from `file://`-ish hosting with nothing to compile.

---

## File map

| File | Responsibility |
|---|---|
| `index.html` | Script load order, DOM overlays, canvas |
| `scenes/BootScene.js` | Loads every texture and audio |
| `scenes/MenuScene.js` | Title screen, ball preview, top-right button cluster |
| `scenes/GameScene.js` | The run. 1134 lines. All ball abilities live here |
| `scenes/GameOverScene.js` | Payout, best-run records, navigation |
| `scenes/TutorialScene.js` | First-run explainer |
| `scenes/ShopScene.js` | `ballData` — the 20 balls, price-sorted |
| `scenes/SettingsScene.js` | 5 toggles + name, scrollable panel |
| `scenes/AchievementsScene.js` | 39 achievements, paged, claimable |
| `scenes/LeaderboardScene.js` | High scores / trophies, scrollable |
| `scenes/NamePromptScene.js` | DOM `<input>` name entry |
| `scenes/AccountScene.js` | Sign in / sign up / rename |
| `scenes/Tournament*.js` | Menu, name, bracket, game, victory |
| `scenes/TrophyRoomScene.js` | Earned trophies |
| `account.js` | `SAVE_KEYS`, `MONOTONE_NUMBERS`, cloud watcher |
| `player.js` | Name, anonymous UID, row retirement, `fetchBoard` |
| `achievements.js` | 39 entries, `METRICS`, `BALL_COUNT`, `evaluate()` |
| `settings.js` | Setting defaults, `isOn` / `toggle` / `setOn` |
| `layout.js` | `registerOverlay`, `placeAllOverlays`, `scale()`, `rotated()` |
| `ui.js` (or `UI`) | `panel()`, `button()`, `topRight()` helpers |
| `firestore.rules` | Deployed security rules |
| `build-itch-zip.js` | Explicit allow-list packager |

---

## GameScene — where the difficulty actually lives

The single most important function in the project:

```js
GameScene.loadBallAbilities()
```

A `switch` over ball id that sets every ability field. Everything downstream —
hitbox shrink rate, speed curve, jump height, score multiplier, payout — reads
from these fields. A ball that does not appear here plays as the default.

**`audit-abilities.js` verifies:** 0 dead fields (declared but never read), 0
unwired fields (read but never set), and that `TournamentGameScene` neutralises
every one of the 15 for fairness.

### Key fields

| Field | Meaning |
|---|---|
| `hitboxScale` | Hitbox as a fraction of ball size |
| `hitboxMin` | Floor the hitbox shrinks to |
| `hitboxShrinkRate` | How fast it shrinks per hit |
| `baseSpeed` / `boostStepMain` / `maxSpeedBoost` | The speed curve |
| `jumpMultiplier` | How high the ball rises after a tap |
| `scoreMultiplier` | Score per deflect |
| `payoutPerDeflect` | Money per deflect |
| `tapDistance` | Radius counted as a hit |
| `revives` | Lives |

### The roof clamp

`maxBallHeight` = goal top minus one ball radius. Measured clearance:

| Ball | Rise | Clearance |
|---|---|---|
| Default | 162px | +119px |
| Rubber | 246px | +35px |
| **Sprung** | **287px** | **−6px (hits it)** |

Sprung still delivers +77% rise, so its "60% higher" copy is honest — but
pushing its `jumpMultiplier` past 1.6 achieves nothing. This is a real ceiling,
not a bug.

---

## Container coordinate model

The rule that caused the Settings bug, restated because it is easy to forget:

> `container.add(child)` reinterprets `child.x/y` as **local**. The container's
> transform is added on top.

If children were authored in absolute scene coordinates, the container must be
offset by **only** the delta it needs to move:

```js
// WRONG — counts viewTop twice, pushes content down by contentTop
this.content.y = this.viewTop + this.baseOffset - this.scroll;

// RIGHT
this.content.y = this.baseOffset - this.scroll;
this.baseOffset = this.maxScroll > 0 ? 0
    : (this.viewTop + (this.viewH - this.contentHeight) / 2) - this.contentTop;
```

The `- this.contentTop` at the end is what converts "where I want the list" back
into "how far to move it".

---

## Masks vs input

Independent systems, and conflating them causes both silent failures:

- `setMask()` clips **rendering** only. It has no effect on hit-testing.
- An interactive `Zone` over a container **does** compete with the container's
  children for hit priority, decided by depth alone.

Pattern used in `SettingsScene`: listen on the scene's `InputPlugin` and
bounds-check, so the drag surface can never shadow a control.

---

## Save model

### Local

`localStorage`, single namespace, prefixed `goalDefender*` and `gd*`.

### Cloud

Firestore, project `goal-defender`, one document per account.

**`SAVE_KEYS`** lists every key that syncs — 30 of them, against a rules cap of
40. The margin is asserted by an audit: `SAVE_KEYS ≤ cap − 5`.

**`MONOTONE_NUMBERS`** — keys that may only ever increase. Prevents a stale
device clobbering progress with a lower value.

Deliberately **excluded**:

- `gdPlayedOnMobile` — describes the *device*. Syncing would award it to someone
  who has never held a phone.
- `goalDefenderTournamentStreak` — synced, but not monotone, because a loss
  legitimately resets it to zero. The losing device is the one that applies the
  new value.

### Reconciliation: console is authoritative

A fingerprint poll every 10s, plus on focus and on visibility change, compares a
signature of the cloud doc against the last seen one. If it changed externally,
the cloud state is **adopted over** local — not merged.

Merging is wrong here: if the console lowers your score, a merge would keep the
higher local value and the edit would never stick. Same for a removed ball — it
would reappear.

Verified live: removing the equipped ball from the console auto-falls back to
`default`.

### Identity

Anonymous by default. On sign-in or sign-up, `retireAnonymousIdentity()` carries
stats to the account and deletes the old anonymous row. Verified: `OLDGAMER:1234`
deleted, 999/888/7 carried.

---

## Achievements

```js
achievements.evaluate()
```

1. `snapshot()` — read every metric **once**
2. loop all 39 achievements, unlock any whose metric passes
3. **Hacker is tested after the loop** against the live unlock map

Step 3 exists because `snapshot()` is taken before step 2. A snapshot-based
"all others unlocked" metric would always be one unlock behind and could never
fire. Verified both directions: stays locked at 37 with the streak unmet, fires
on the same pass as the 38th.

`BALL_COUNT = 20` must match the shop. Asserted by `audit-ball-assets.js`.

---

## Build

`build-itch-zip.js` uses an **explicit allow-list**, not a glob. Dev files are
never shipped: `firebase.json`, `.firebaserc`, `firestore.rules`,
`TEST-RESULTS.md`, `build-itch-zip.js`, `audit-abilities.js`, `update-plan.md`,
`To-Do.md`, and now `md/`.

This is why `assets/balls/*.png` shipping is a **deliberate decision per file**
— collectAssets picks them up, and a stray test file in `assets/` would ship.
