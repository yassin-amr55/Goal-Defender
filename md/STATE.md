# STATE — current state of the repository

> Read `IMPORTANT.md` before acting on anything in this file.

---

## Version

- **Live version:** `v2.2` (in development), published build is `v2.1` at
  https://yassin-amr55.itch.io/goal-defender
- **Version label:** `UI.VERSION` in `ui.js` is the single source of truth. The
  bottom-right stamp on the menu is the only label in the game that reads it, so
  that one line is the whole bump.
- **`v2.1` git tag:** points at `795f13f`, which is **pre-fix**. Deliberate —
  do not move it.
- **HEAD:** `ca1070d`
- **Working tree:** **DIRTY — 12 modified files, 7 untracked. Nothing pushed.**
- **itch zip:** `D:\Desktop\goal-defender-itch.zip` (56 entries, 3.93 MB), built
  from `ca1070d` and verified byte-identical to the repo.

---

## Do not push

The owner instructed that this phase must not be pushed. The tree is
intentionally dirty. Committing is fine when asked; pushing is not.

---

## Uncommitted changes

### Modified

| File | Change |
|---|---|
| `account.js` | Best-run save keys, `MONOTONE_NUMBERS`, cloud watcher, `retireAnonymousIdentity` |
| `achievements.js` | 39 achievements, deflection metrics, `BALL_COUNT`, `HACKER_ID` |
| `scenes/BootScene.js` | 5 new ball textures, `loaderror` hook |
| `scenes/GameOverScene.js` | Rally / Money / default payout, On-The-Go mobile flag |
| `scenes/GameScene.js` | 6 new ball abilities, Anchor/Steel/Void rebalance, Rally, best-run records |
| `scenes/MenuScene.js` | Ball texture map |
| `scenes/SettingsScene.js` | **Scrollable viewport, red X inside the panel, Ball Trail toggle** |
| `scenes/ShopScene.js` | 20 balls price-sorted, ball-count guard |
| `scenes/TournamentGameScene.js` | Ability neutralisation for fairness |
| `scenes/TournamentVictoryScene.js` | `goalDefenderTournamentStreak` win/loss logic |
| `settings.js` | `gdBallTrail` default |
| `md/update-plan.md` | Parts 1–8 marked done |

### Untracked

- `md/` — all documentation (this folder)
- `assets/balls/ball-focus.png`
- `assets/balls/ball-inverted.png`
- `assets/balls/ball-life.png`
- `assets/balls/ball-rally.png`
- `assets/balls/ball-sprung.png`

---

## Backend

- **Firestore project:** `goal-defender`
- **Rules:** deployed. `save.size()` cap raised 20 → 40. `isRealUser()` blocks
  anonymous account writes. Players may delete their own row, or any row with
  `anon == true` while signed in. `anon` is allowed in `validFields()`.
  - Backups: `%TEMP%\opencode\firestore.rules.backup{,2,3}`
- **Email/password auth:** confirmed enabled and working end to end.
- **Live leaderboard (needs cleaning):**

| Player | Score | Action |
|---|---|---|
| HAMZA | 207 | keep |
| exizt | 72 | keep |
| **EXIZT** | 71 | **delete — duplicate of `exizt:72`, legacy casing** |
| yassin | 56 | keep |
| HIM | 39 | keep |
| vaiseek | 38 | keep |
| Max | 0 | keep |

**Test accounts to delete:** `admintest`, `hamzatest`, `realrenamed`,
`balltest784`, `plainacct690`, and board rows `admintest:999`, `hamzatest:1234`.

---

## Test status

All **14** suites exit 0. Every `.js` file parses. Zero console errors across
all 17 scenes and all 20 balls.

| Suite | Proves |
|---|---|
| `test-account.js` | 39 checks — auth, save sync, retirement |
| `test-sync.js` | 36 checks — cloud reconciliation |
| `test-deflections.js` | Deflection accounting |
| `layout-check.js` | Panel geometry contains all controls |
| `static-check.js` | Source-level invariants (incl. Settings geometry) |
| `audit-cross.js` | 57 cross-module checks |
| `audit-sim.js` | 29 simulation checks |
| `audit-economy.js` | 18 economy checks, 2 warnings |
| `audit-static.js` | Save key coverage |
| `audit-layout.js` / `audit-layout2.js` | Geometry |
| `audit-radix.js` | Radix/formatting |
| `audit-abilities.js` | 0 dead fields, 0 unwired, tournament parity |
| `audit-ball-assets.js` | Every texture exists, loaded, and matches a shop ball |

---

## Known defects

See `KNOWN-ISSUES.md` for the full list with reasons. Summary:

- **F-13** — **RESOLVED.** The 10/11/13px mess inside achievement cards is gone;
  there is now a 6-step type scale with a 13px floor, and `static-check.js`
  fails the build if any hardcoded font below 13px reappears.
- **F-22** — **RESOLVED.** The tutorial has a SKIP control throughout.
- **F-23** — Gauntlet Ball pricing. Still an owner decision.
- **F-24** — `assets/wall.png` unused. Safe to delete.
- **F-25** — No tournament wall art. Optional.
- **F-26** — Build script committed to git. Harmless; excluded from the zip.
- **`v2.1` tag** — pre-fix (deliberate, leave it)

### Design pass — complete

Every item in `DESIGN-IMPROVMENTS.md` is implemented and verified against
browser screenshots: 10 bugs, 10 must-dos, 17 polish items.

New shared helpers in `ui.js` — `UI.TYPE` (6-step scale), `UI.stadium()`,
`UI.title()`, `UI.closeButton()`.

Also found and fixed while building them: `drawPanel()` drew two full rects, so
every "gradient" panel and button in the game was actually **flat**. Now a real
`fillGradientStyle`.

Two test traps are now documented in `IMPORTANT.md` §6: emitting events on a
game object proves nothing, and container children use local coordinates.


---

## Next steps, in order

1. Owner deletes the test data listed above.
2. Decide on `KNOWN-ISSUES.md` items F-13 / F-22 / F-23.
3. Commit the tree. **Ask before pushing.**
4. Rebuild the itch zip if pushing.
