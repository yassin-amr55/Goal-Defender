# PROGRESS — work log

Newest first.

---

## Menu account slot: the coloured blob behind the name

The last thing looking wrong on the menu. `SIGN IN` and the username were bare
outlined text with a "glow" copy behind them — and the glow used **the same
colour as the fill** with a 7px stroke at 12% alpha. That is not a glow; it is a
thick ring of the text's own colour sitting behind a dark-outlined copy of the
same text. Around round letters it extended past the glyphs, so `yassin` wore an
amber blob and `SIGN IN` wore a white cloud. Both looked like smudges.

It is now a **pill**, built from the same parts as every other chip in the game
(the shop's money pill and the menu's BEST pill):

- dark gradient body, radius = height/2
- **gold** border + gold text when signed in, neutral blue when signed out
- a crisp label with **no outline at all** — the pill provides the contrast
- a drawn person glyph (head circle + shoulder arc, since there's no icon asset
  and the game uses no emoji) so it's identifiable without reading it
- width computed from the **measured** text, right-anchored at 1244 so it grows
  leftwards and can never run off the canvas

Two suites asserted the *old* implementation (`glow layer added for legibility`,
`text has an outline stroke`) and had to be rewritten to assert the actual
requirement instead — including a check that the glow never comes back.

Verified by screenshot in both states and by a real mouse click landing on the
pill (padded 6px beyond the drawn edge, per the mobile touch-target rule).

---

## The full design pass — every item in DESIGN-IMPROVMENTS.md

Executed against screenshots of 13 screens. All 10 bugs, all 10 must-dos and
all 17 polish items are done and verified.

### Shared infrastructure added to `ui.js`

| Added | Reason |
|---|---|
| `UI.TYPE` | 6-step scale (12/14/18/24/36/54). 26 ad-hoc sizes existed. |
| `UI.stadium()` | One background builder. Three scenes were flat black. |
| `UI.title()` | One title treatment. Returns a **container**. |
| `UI.closeButton()` | One close control. Four patterns existed. |

**Bug found while building it:** `drawPanel()` filled `fillBottom` as a full
rect then filled `fillTop` over it — the second completely covered the first.
Every "gradient" panel and button in the game was **flat**, and the darker
colour was dead code. Now a real `fillGradientStyle`. Also inset the drop
shadow by 2px and pulled its radius in, which removed the notch that showed at
the bottom corners of every pill-shaped chip.

### Bugs fixed

| # | Bug | Root cause |
|---|---|---|
| B1 | Account said "1 of 14" balls, "14 of 30" achievements | Hardcoded literals; there are 20 and 39 |
| B2 | "Total Deflects" typo | 3 sites |
| B3 | Line struck through "Win the Qualifiers Cup first" | Two unlock messages drawn 4px apart |
| B4 | Bracket + tournament result were flat black | No background at all |
| B5 | Player's bracket entry rendered as a speck | 1-char name in a 160px box, no marker |
| B6 | Trophy art overflowed its card top | 612px art at 0.4 scale in a 300px card |
| B7 | Trophy labels fell outside the card | Card was 300 tall, content ran to 568 |
| B8 | Full-height seam through the pause card | `middleLine` visible through a 78% overlay |
| B9 | Last bracket team clipped | Measured against the canvas, not the button |
| B10 | Last leaderboard row clipped by the panel | Same class as B9 |

Note on **B4**: `TutorialScene` turned out to be fine — it extends `GameScene`
and inherits the background. A grep for the string `'background'` missed that,
so B4 was 2 scenes, not 3.

### Must-dos

Type scale · one close control on every sub-screen · menu hierarchy (`V2.1`
19px → 12px, TOURNAMENT 15px → 20px) · AWARDS/RANKS uncramped and 18px ·
trophy shelves finished · tournament-name titles un-overlapped · the two name
inputs made identical · shop price shown once · pause panel sized to contents ·
achievement footers de-duplicated.

### Polish

Corner balance, ball contact shadow, leaderboard zebra removed, locked-card
descriptions 14px, green reserved for state, `N of M` promoted with a progress
rail, one bottom-bar alignment, HUD scrim, TROPHIES/mute collision, locked cup
art, shop ball/name gap, EQUIPPED reads as success, ability copy 14px,
"None" → "Standard ball", tournament title language, pill notch, tab scrim.

### Also fixed: F-22, the tutorial had no way out

The lesson was four timed beats plus a locked-for-1s HOME button on the results
screen, so a returning player had to sit through all of it with no exit. Added a
small SKIP control, deliberately understated so it does not pull the eye off the
ball.

---

## Settings: scrollable panel + red X inside the box

### The problem
Three stacked bugs, plus a fourth found by inspection:

1. **The page overflowed the canvas.** The panel was sized to its contents, so
   each added toggle made it taller. With Ball Trail added, `BACK` sat at y=700
   with height 56 and ended at **728 — eight pixels past the 720px canvas**.
2. **The list rendered 203px too low.** `content.y = viewTop + baseOffset`, but
   container children use **local** coordinates and the rows were already
   authored in **absolute** coordinates — so `viewTop` counted twice. Row 1
   landed at world y=464 instead of 261.
3. **Every control was unclickable** — a consequence of (2).
4. **Flick inertia glided the wrong way.** Velocity is negative travelling up,
   and travelling up must *increase* scroll.

### The fix
Fixed viewport `128..692` with a **72px header band reserved as panel space**
for the close button — that reservation is what guarantees the X can never
collide with the first toggle. Content viewport `200..672`, clipped by a
geometry mask. Rows re-laid out at 66px tall / 72px spacing. Drag scroll moved
to `InputPlugin` listeners so it never competes with the switch zones for hit
priority. Content centres when it fits.

### Verified
All 5 switches, mute, name button and the red X respond to real DOM mouse
events. A drag across a switch does not toggle it. Forced 900px content drags,
flicks (forward), wheels and clamps correctly.

### Two test traps this exposed

**Fake events.** `zone.emit('pointerup')` bypasses hit-testing, so it reported
all five switches as working while they were 203px from where a player would
tap. Documented as `IMPORTANT.md` §6.

**A wrong story.** I wrote a comment claiming a full-panel `Zone` was shadowing
the switch zones — a bug I had inferred but never observed. The 203px offset was
the real cause. The comment was corrected; the plugin-level approach was kept
because it genuinely avoids the priority question, not because it fixed a bug.

---

## New ball textures never appeared

**Root cause:** my own patch script generated texture *paths* from the texture
key, producing `assets/balls/ball_inverted.png` instead of `ball-inverted.png`.
**All five 404'd.**

**Why nothing broke:** every game scene guards with
`textures.exists(tex) ? tex : 'ball_default'` — correct at runtime, but it makes
a path typo completely invisible. The game ran perfectly and five new balls
silently played as the default one.

Fixed the paths, added a `loaderror` hook in `BootScene`, and wrote
`audit-ball-assets.js` (7 checks) so it cannot recur.

---

## Measured design audit of all 17 scenes

Walked every scene's live object tree. Findings in `DESIGN.md`. Worst:
`AchievementsScene` (31 of 60 text objects under 16px, three sizes inside one
row) and `TournamentBracketScene` (30 team names at 12px while leaving 130px of
canvas empty).

---

## Prior phase: the To-Do list

Implemented in full and verified: Ball Trail setting · Anchor (base speed *and*
boost rate halved) · Steel · Void 170% · six new balls (Life, Sprung, Inverted,
Focus, Rally, Spark) · all score achievements converted to single-run
deflections keeping the `score_*` IDs · Champions of Champions $20,000 · Full
Rack $500,000 with the count at 20 · Hacker last at $1,000,000,000.

`gdPlayedOnMobile` deliberately **not** synced — it describes the device.

---

## v2.1 shipped

Pushed `d813d54` and `ca1070d`. itch zip verified byte-identical to the repo.
Firestore rules deployed. Real email/password round-trip proven. `player.js`
stopped being binary to git.


---

## Earlier

Parts 1–8 of `update-plan.md` shipped: the console-authoritative cloud watcher,
anonymous identity retirement, leaderboard YOU-row, tournament DOM overlay leak,
account-authoritative ball ownership, Champions Cup unlock from synced
`tournamentQualifiersWon`.
