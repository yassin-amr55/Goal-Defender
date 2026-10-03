# KNOWN-ISSUES

Every known defect and every deliberate non-fix, with the reason. Nothing here
is accidental — each is either a bug to schedule, or a decision not to revisit.

---

## Bugs

### F-13 — Achievement text floors at 10px, which becomes 5px on small Android

**File:** `scenes/AchievementsScene.js:266`

The list row uses three sizes — 10px, 11px, 13px — with ten items at each. On a
small Android device the 10px text renders at roughly **5px** and is
unreadable.

This is the highest-severity visual defect in the game: it affects the page that
holds a $1,012,857,380 pay-out, and it is worst on exactly the devices least
likely to have a large screen.

**Related:** 20 of the 60 text objects on that page are under 13px. See
`DESIGN.md`.

**Suggested fix:** collapse each row to name + reward, put the description
behind a tap, floor at 14px.

---

### F-22 — Tutorial has no skip button

**File:** `scenes/TutorialScene.js`

A returning player who has already learned the game must tap through every page
again. Only 4 text objects on the scene, so the page is thin — it has room for a
skip control.

**Not fixed** because the placement of a skip control on a 4-text page is a
design decision, not a bug fix.

---

### F-23 — Gauntlet Ball pricing

**Price:** $1,500,000, the most expensive ball in the game.

Its ability: hitbox 170%, max speed 130%, +5 score per deflect.

The trade is deliberate — it is strictly worse than the default ball at both
shrinking *and* accelerating, paid back in score per deflect. But at $1.5M it
sits 15× above the next ball (Inverted, $500,000) for a trade that is arguably
worse. The gap is steep enough that it reads as a mistake rather than a tier.

**Needs an owner decision**, not a code fix.

---

### F-24 — `assets/wall.png` is unused

Loaded nowhere, referenced nowhere. Dead weight in the repo and in any build that
globs assets.

**Note:** the itch build uses an explicit allow-list, so it does not currently
ship. Deleting it is safe; keeping it is also safe.

---

### F-25 — No tournament wall art

`TournamentBracketScene` is a flat bracket with no stadium, crowd or pitch
imagery. Not a bug — a known gap versus the rest of the game's art.

---

### F-26 — Build script is committed to git

`build-itch-zip.js` sits in the repo root and is tracked. It is developer tooling
and should arguably live beside the other dev files or in `md/`.

Harmless: the itch allow-list explicitly excludes it, so it never ships.

---

### F-27 — *FALSE* — "`jumpMultiplier` is not read in TournamentGameScene"

**This was reported as a bug and it is wrong. Do not "fix" it.**

`jumpMultiplier` **is** read, at `scenes/GameScene.js:719`. Measured:

| Ball | Rise |
|---|---|
| Default | 162px |
| Rubber | 246px |

`TournamentGameScene` sets `jumpMultiplier = 1` and does not read it. **That is
correct.** Tournaments deliberately neutralise all 15 ability fields so that a
tournament is winnable with the default ball. If abilities worked there, a
player who spent $1.5M on Gauntlet Ball would have an unfair bracket.

`audit-abilities.js` asserts this parity so the behaviour cannot be accidentally
changed.

---

### F-28 — `v2.1` git tag points at a pre-fix commit

**Tag:** `795f13f`, which predates the fixes in `d813d54` and `ca1070d`.

**Deliberate, at the owner's request.** Do not move, retag or delete it.

---

## Deliberate non-fixes

### The roof clamp on Sprung Ball

`maxBallHeight` = goal top minus one ball radius.

| Ball | Rise | Clearance |
|---|---|---|
| Default | 162px | +119px |
| Rubber | 246px | +35px |
| **Sprung** | **287px** | **−6px (hits it)** |

Sprung hits the ceiling. It still delivers +77% rise, so its "bounces 60% higher"
copy is honest and the ability works as advertised. Pushing `jumpMultiplier` past
1.6 achieves nothing — that is the physics ceiling, not a defect.

### `gdPlayedOnMobile` is not synced

It describes the *device*, not the player. Syncing it would award the achievement
to someone who has never held a phone.

### `goalDefenderTournamentStreak` is synced but not monotone

A loss legitimately resets the streak to zero, so it cannot be in
`MONOTONE_NUMBERS` — a stale device would keep restoring a higher value forever.
The losing device is the one that applies the new value.

### Ball textures fall back to `ball_default` when missing

Correct at runtime: a missing art file must never crash the game. It hid a
path typo for a whole phase, which is why `BootScene` now logs the failure and
`audit-ball-assets.js` exists. The fallback stays; the silence does not.

### `score_*` achievement IDs kept despite the metric change

The achievements now measure single-run deflections instead of score, but the
IDs were left as `score_*`. Renaming them would re-lock achievements people had
already earned and re-pay the ones they had not. The IDs are internal; keeping
them is the correct trade.

---

## Test-data cleanup — outstanding

Delete from the live backend:

**Accounts:** `admintest`, `hamzatest`, `realrenamed`, `balltest784`,
`plainacct690`

**Board rows:** `admintest:999`, `hamzatest:1234`, and the legacy `EXIZT:71`
which is a casing duplicate of `exizt:72`.

Until this is done, the public leaderboard shows inflated test scores. That
contradicts `IMPORTANT.md` §2 and is the owner's call to action.
