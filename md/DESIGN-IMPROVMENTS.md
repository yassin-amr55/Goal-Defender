# DESIGN-IMPROVMENTS

Full visual audit from screenshots of **13 screens**.

> **STATUS: ALL IMPLEMENTED AND VERIFIED.**
> Every bug, every must-do and every polish item below has been fixed and
> confirmed against a browser screenshot. See `PROGRESS.md` for the change log
> and `STATE.md` for the current tree state.

This supersedes `DESIGN.md`, which was measurement-only — the numbers there are
still useful, but these are things you can actually *see* in a screenshot.

Every issue is marked:

| Mark | Meaning |
|---|---|
| **[BUG]** | Wrong data or visibly broken rendering. Fix regardless of taste. |
| **[MUST]** | Reads as broken or unprofessional to a player. High priority. |
| **[SHOULD]** | Clearly an improvement. Worth doing. |
| **[NIT]** | Polish. Do if there is time. |

---

## What was built to do this

Three shared helpers in `ui.js` were added so these fixes could not drift apart
again:

| Helper | Why |
|---|---|
| `UI.TYPE` | 6-step type scale: 12 / 14 / 18 / 24 / 36 / 54. 13px floor. |
| `UI.stadium()` | The only place the stadium background is built. Every scene calls it. |
| `UI.title()` | The only place a screen title is drawn. Returns a **container** so a pulse tween moves the shadow with the text. |
| `UI.closeButton()` | The only close control. Red X, one position, every sub-screen. |

And one real bug found along the way: `drawPanel()` drew `fillBottom` as a full
rect and then `fillTop` over the top of it, so **every "gradient" panel in the
game was flat** and the second colour was dead code. Now a real
`fillGradientStyle`.

---

# Part 1 — Bugs found in the screenshots

These are not opinions. Three are wrong numbers, one is a visible artifact.

---

## B1. [BUG] The Account page reports the wrong totals

**Screenshot:** `BALLS OWNED 1 of 14` and `ACHIEVEMENTS 14 of 30 claimed`

**Reality:** 20 balls and 39 achievements.

**Cause:** hardcoded literals at `scenes/AccountScene.js:464-465`

```js
['BALLS OWNED', st.ownedBalls.length + ' of 14'],
['ACHIEVEMENTS', st.achievementsClaimed + ' of 30 claimed']
```

**Why this is the worst bug in the list:** it is on the page where a player
checks their progress, it contradicts the Shop (20 balls) and the Achievements
page (14 of 39) *on the same session*, and it understates the whole collection by
a third. A player would conclude the Shop is lying.

**Fix:** derive both from the real sources.

```js
var totalBalls = (window.GDShop && window.GDShop.BALL_COUNT) || 20;
var totalAchievements = (window.GDAchievements && window.GDAchievements.TOTAL) || 39;
```

**And add an audit check** so a hardcoded total can never reappear:
`AccountScene` totals must equal `ballData.length` and `ACHIEVEMENTS.length`.

---

## B2. [BUG] "Deflects" is a typo — in three places

| File | Line | Text |
|---|---|---|
| `scenes/TournamentVictoryScene.js` | 38 | `Total Deflects: 0` |
| `scenes/TournamentVictoryScene.js` | 84 | `Total Deflects: 0` |
| `scenes/TrophyRoomScene.js` | 185 | `Deflects: 0` |

Should be **Deflections**. Visible on the Tournament Lost screen in the
screenshot. The internal variable `totalDeflects` is fine — only the displayed
string is wrong.

**Fix:** change the strings. Do not rename the variable; it is referenced across
`TournamentGameScene` and the save format.

---

## B3. [BUG] A line is struck through the locked tournament card

**Screenshot:** `TOURNAMENT MODE`, Champions Cup card — a horizontal line runs
straight through **"Win the Qualifiers Cup first"**.

The text sits at the same y as a graphics element — almost certainly a lock
badge backing plate or a card divider drawn at the wrong y, now overlapping the
copy. Because the copy is the only thing telling a locked player *why* it is
locked, it is the worst possible place for a stray line.

**Fix:** find the element at that y in `TournamentMenuScene` (lock icon container
or the requirement text row) and either raise the text or lower the plate. Add a
check: no `Graphics` bounds may overlap a text object's bounds.

---

## B4. [BUG] Three screens have no stadium background

| Scene | Background |
|---|---|
| `TournamentBracketScene` | **missing** |
| `TournamentVictoryScene` | **missing** |
| `TutorialScene` | **missing** |

Verified by source inspection — the other 14 scenes all draw
`textures.exists('background')`.

This is why the bracket and the Tournament Lost screen are **flat black** while
every other screen is a stadium. It is the single most jarring inconsistency in
the game: a player goes from a full stadium to a black void and back.

The bracket is the worst case. It is a *content* screen showing 16 team names and
5 round headers, and it looks like a debug view.

**Fix:** factor the background block into `UI.stadium(scene)` and call it from
all 17 scenes. Then audit that every scene draws it.

---

## B5. [BUG] The player's own bracket entry renders tiny and unlabelled

**Screenshot:** the player's row at the top of ROUND OF 16 is a yellow box with
**"e"** in what looks like ~9px, while every opponent name renders legibly.

The player's name is passed through `truncateTeamName()` like an opponent, so a
short name like `e` renders as a speck in a 200px-wide gold box. It looks like a
rendering error rather than "you are here".

**Fix:** render the player's own entry with the same font size as opponents, and
add a marker — `YOUR TEAM` label, or a left accent bar in a distinct colour.
A 1-character name is legitimate input, so the box must not look broken for it.

---

## B6. [BUG] Trophy art overflows the top of its card

**Screenshot:** `TROPHIES` — both the Qualifiers Cup trophy and the Champions Cup
trophy extend **above** the card's top border. The Champions ball/trophy pokes
out of the top of its panel entirely.

The art is drawn with its origin above the card rect, so it escapes the panel.
**Fix:** set origin to centre, or clip to the card, and scale the art to fit
inside with padding.

---

## B7. [BUG] Trophy card labels fall outside the card

**Screenshot:** `Qualifiers Cup` and `Champions Cup` labels sit **below** the
card's bottom border, and `Won: 0` sits below that, outside the panel. They read
as if the text fell out of the box.

**Fix:** bring both inside the card, or make the card tall enough to contain them
with padding.

---

## B8. [BUG] A vertical seam runs down the whole screen

**Screenshot:** the pause screen has a thin vertical line at roughly x≈680 running
top to bottom — **over the pause panel and the stadium**.

A full-height line that crosses a modal panel is a compositing/letterbox seam,
not scene content. It is visible on every frame the player looks at while paused,
which is exactly when they are most likely to notice it.

**Fix:** check for a `Graphics` fill or rectangle drawn at x≈640 with a height
covering the full canvas in `GameScene`'s pause overlay, and check the camera
bounds. Audit: no scene may draw a full-height rect at x=640.

---

## B9. [BUG] The last bracket team is clipped

**Screenshot:** `Mighty Ducks` at the bottom of ROUND OF 16 is cut off by the
bottom of the list area and collides with the BACK button row.

The Round-of-16 column needs 16 rows and does not fit between the header and the
bottom bar. Earlier measurement said max y = 590, which was wrong — it did not
account for the bottom bar or the last row's box height.

**Fix:** reduce row pitch, or start the column higher, or scroll. Re-measure
including the bottom bar's top edge.

---

## B10. [BUG] Leaderboard's last row is clipped by the panel edge

**Screenshot:** rank 7 `PLAYER 0` — the row box is cut by the panel's bottom
border, which passes through it.

Same class of bug as B9: the list height was measured against the canvas, not
against the panel it lives in.

---

# Part 2 — Must-do design improvements

---

## M1. [MUST] Adopt a type scale

**26 distinct font sizes** are in use across the game:
`10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 27 30 34 36 40 44 46 54 58 70 82`

And `AchievementsScene` uses **three different sizes inside one card** — name,
description, and progress label at 10px / 11px / 13px.

This is the root cause of most of the "looks slightly off" feeling on every page.

**Proposed scale:**

| Step | Size | Use |
|---|---|---|
| micro | 12px | version stamp, tertiary labels |
| small | 14px | descriptions, ability copy, progress labels |
| body | 18px | list rows, button labels |
| lead | 24px | card names, stat values, tab labels |
| title | 36px | screen titles |
| hero | 54px+ | menu title |

**Hard floor: 13px, prefer 14px.** The 10px text becomes **5px on a small
Android**.

---

## M2. [MUST] Give every screen the same close control

Currently, four different patterns:

| Screen | Close |
|---|---|
| Settings | **X inside the panel** (new, red) |
| Shop, Achievements, TournamentBracket | `BACK` bottom-**left** |
| Leaderboard, Account, TrophyRoom, TournamentName | `BACK` bottom-**centre** |
| Menu, GameOver, TournamentMenu, TournamentVictory | none (they are roots) |

The same action is in three different places in three different positions. The
red X is the best of them — unambiguous, thumb-reachable on desktop, and inside
the panel it belongs to.

**Fix:** X top-right inside the panel on every sub-screen. Remove bottom BACK
entirely.

---

## M3. [MUST] Fix the Menu hierarchy — the version stamp outranks the navigation

From the screenshot:

| Text | Size |
|---|---|
| `GOAL DEFENDER` | 82px |
| `PLAY` | 40px |
| `SHOP` | 34px |
| `TOURNAMENT` | ~20px |
| `LEARN TO PLAY` | ~20px |
| `V2.1` | **19px** |

**The version stamp is nearly as large as the two mode buttons.** It is bottom
right, in the corner, in grey — and it is competing with real navigation.

**Also:** `TOURNAMENT` is a full game mode with brackets, cups, streaks and its
own trophy room, and it is rendered smaller than `SHOP`.

**Fix:**
- `V2.1` → 12px, `micro`, 40% opacity
- `TOURNAMENT` → 24px, same weight as a real destination
- `LEARN TO PLAY` → 18px, tertiary
- Keep `PLAY` 40px, `SHOP` 34px

---

## M4. [MUST] AWARDS and RANKS are the smallest labels carrying the deepest content

**Screenshot:** both are ~15px captions crammed under their icons in the
top-left corner, and **the captions overlap the bottom edge of their own icons**.

These two buttons are the only route to:
- a 39-item achievement collection worth **$1,012,857,380**
- the leaderboard

The largest content in the game is behind the smallest, most cramped controls on
the menu.

**Fix:** give them real buttons, or at minimum: 18px labels, 12px more gap
between icon and caption, and a hit area that matches the icon rather than the
caption.

---

## M5. [MUST] TrophyRoom's shelves look like broken placeholder bars

**Screenshot:** dull tan/grey rectangles under each trophy that read as
**loading placeholders**, and they extend past the card width.

They are the only element on the page that does not look designed. Either finish
them as pedestals — shaded, rounded, with a highlight — or remove them.

---

## M6. [MUST] TournamentNameScene: the two titles overlap and the hierarchy is inverted

**Screenshot:** `QUALIFIERS CUP` and `ENTER YOUR TEAM NAME` are stacked so close
they collide, and **the instruction is larger than the context**.

**Fix:** ~30px of separation; instruction at `lead` (24px), context at `small`
(14px) above it.

---

## M7. [MUST] Fix the inconsistent input fields

Two text inputs, two different treatments:

| Screen | Treatment |
|---|---|
| `TournamentNameScene` | gold focus ring + **lighter inner rect** |
| `NamePromptScene` | **flat dark rect, no border** |

The `NamePromptScene` field looks disabled. Worse, the tournament field's
lighter inner rectangle does not match any other panel in the game, so it looks
like a rendering artifact.

**Fix:** one shared input style — one panel colour, one border, one radius, one
focus state.

---

## M8. [MUST] The Shop shows every price twice

**Screenshot:** every purchasable card has `$150` in gold **and** `BUY $150`
inside the button.

Pure redundancy, and it is the most repeated element in the shop. Pick one:
either the button says `BUY` and the price sits above it (recommended — the
button label stops wrapping on narrow cards), or drop the standalone price.

---

## M9. [MUST] Fix the pause panel proportions

**Screenshot:** the `PAUSED` panel is very tall. `CONTINUE` and `MAIN MENU` sit
in the top half and the **entire bottom half is empty void**.

**Fix:** size the panel to its contents plus padding. It should feel like a
dialog, not a wall.

---

## M10. [MUST] Achievement card footers are inconsistent and contradictory

From the screenshot, the footer under each card's progress bar is:

| Card state | Footer left | Footer right |
|---|---|---|
| Claimed | `CLAIMED` | `CLAIMED` |
| In progress | `381 / 500` | `DEFLECTIONS` |

Three problems:
1. `CLAIMED` appears **twice** on the same card.
2. A claimed card shows a **full progress bar**, which reads as "in progress" to
   anyone not looking closely. A completed achievement should not show an
   unfinished-looking gauge.
3. "Claimed" (a status) and "Deflections" (a unit) are not the same kind of word
   in the same position.

**Fix:** one footer per card — left = progress `381 / 500`, right = a single
status word (`CLAIMED`, or the unit). On claimed cards replace the bar with a
solid check or tint it gold so it does not read as active.

---

# Part 3 — Should-do improvements

---

## S1. [SHOULD] Two AUDWARDS/RANKS icons and the settings gear/mute cluster are unbalanced

Top-left has two stacked circular icons with captions. Top-right has a mute icon,
a gear, and the `yassin` name badge — which has a heavy white glow that makes it
look like a pasted sticker rather than part of the scene.

**Fix:** give both corners equal visual weight. Tone the name badge's glow down,
or set it in the same rounded-pill language as the `BEST 66` pill.

---

## S2. [SHOULD] The menu's decorative ball floats in the crowd with no ground

The ball sits mid-height on the left, overlapping the crowd, with nothing under
it. It reads as a sticker that slipped, not as an object in the scene.

**Fix:** rest it on the pitch with a contact shadow, or move it into the sky as a
deliberate "in play" element.

---

## S3. [SHOULD] Leaderboard: zebra striping fights the YOU highlight

**Screenshot:** rows alternate light/dark, and **the green `YOU` row happens to
land on a dark zebra row**, so the highlight is weaker than it should be.

Also the rank numbers change colour partway down — gold for the top ranks, then
grey — with no rule the player can see.

**Fix:** drop zebra striping (the row separation is not needed at this density),
or make the YOU row override it completely with a stronger fill and a left accent
bar. Define rank-colour tiers explicitly or use one colour.

---

## S4. [SHOULD] Achievement locked-card descriptions are too small for what they say

`Deflect 500 balls in total` at ~12px. On the two pages where players look up
*what they still need*, the requirement is the smallest text on screen.

**Fix:** 14px minimum. If space is tight, widen the cards rather than shrinking
the type.

---

## S5. [SHOULD] Green is doing two jobs on the Achievements page

The `LIFETIME DEFLECTIONS` stat panel has a **green border**, and green means
"on"/"active" for every toggle in the game. A stat is not a toggle.

**Fix:** stats get a neutral border. Reserve green for state.

---

## S6. [SHOULD] "14 of 39 unlocked" is important information rendered weakly

Small, low-contrast grey — the single most useful number on the page.

**Fix:** 24px, white, with the fraction emphasised. Consider a progress ring or
bar since the collection is the page's whole point.

---

## S7. [SHOULD] Bottom bars mix alignments

| Screen | Layout |
|---|---|
| Shop, Achievements | `BACK` far left, `PREV / PAGE / NEXT` centred |
| Leaderboard, Account, TrophyRoom | `BACK` centred alone |
| TournamentBracket | `BACK` left, `PLAY MATCH` centre |

**Fix:** one pattern — `BACK` left, primary action centre, `PREV / PAGE / NEXT`
right.

---

## S8. [SHOULD] Game HUD text sits directly on the stadium

`Score: 0`, `Hitbox shrinks in: 18s`, `Speed Boost: 0%` — three lines, three
different colours (white, gold, green), no panel behind them, overlapping the
crowd.

Legibility varies with what's behind them. Green `Speed Boost: 0%` also reads as
disabled.

**Fix:** a subtle dark panel or scrim behind the HUD block; one colour for
labels and one for values.

---

## S9. [SHOULD] TournamentMode: the TROPHIES button collides with the mute icon

**Screenshot:** the gold `TROPHIES` button's right edge touches the speaker icon
in the top-right corner.

**Fix:** move the mute icon, or move TROPHIES inside the content area.

---

## S10. [SHOULD] Locked tournament card art is nearly invisible

The Champions Cup trophy is so dark it reads as a smudge, with a lock icon
floating over it at an awkward position.

**Fix:** dim deliberately and consistently — a uniform overlay plus a clear lock
badge in a reserved position, not accidentally unreadable art.

---

## S11. [SHOULD] Shop card text touches the ball art

`Default Ball`, `Anchor Ball`, `Revive Ball` — the name baseline sits right on
the bottom edge of the ball. No breathing room.

**Fix:** ~10px gap, and shrink the ball slightly.

---

## S12. [SHOULD] The EQUIPPED button looks broken rather than positive

Grey with a lighter grey fill — reads as disabled or as a loading state. Equipped
is a *success* state and should look like one.

**Fix:** gold or green fill with a check, clearly distinct from both BUY and
disabled.

---

## S13. [SHOULD] Shop ability copy at 12px

The ability line is what distinguishes a $500,000 ball from a $250 one — the most
decision-relevant text in the shop, at the smallest size.

**Fix:** 14px.

---

## S14. [SHOULD] "None" as the Default Ball's ability reads oddly

**Fix:** leave it blank, or say "Standard ball".

---

## S15. [SHOULD] Tournament Lost screen breaks the title language

Every other title in the game is white with a gold stroke and a drop shadow.
`TOURNAMENT LOST` is plain red with neither — and the team name below it is a
tiny orphaned `e`.

**Fix:** same two-layer title treatment, tinted red. Render the team name at
`body` with a label.

---

## S16. [SHOULD] Money pill has a visible notch

**Screenshot:** the `$5,960` pill has a small step at its bottom-left corner.
Same inner-rect artifact appears on several buttons.

**Fix:** the inner highlight rect is misaligned or mis-sized on some button
variants. Normalise the inner-rect inset so every button highlights evenly.

---

## S17. [SHOULD] Leaderboard tabs overlap the floodlights

`HIGH SCORE` / `TROPHIES` sit on top of the stadium lights, and the contrast
varies across the two.

**Fix:** add a scrim behind the tab strip.

---

# Part 4 — Cross-cutting

---

## X1. Two of four list patterns for long content

| Screen | Pattern |
|---|---|
| Settings | drag + wheel + indicator |
| Leaderboard | drag |
| Shop, Achievements | `PREV` / `NEXT` paging |
| TournamentBracket | neither — and it overflows (B9) |

Pick **one**. Scrolling beats paging: paging forces the player to remember which
page an item is on, and 39 achievements across 4 pages is exactly the case where
that hurts.

---

## X2. Ball art is consistent; UI chrome is not

The 20 balls all read as one family — same size, same lighting, same style. That
is the strongest thing in the game visually.

The **UI around them is not consistent**: four close-control patterns, three
bottom-bar layouts, two input styles, two title treatments, three backgrounds,
26 font sizes.

**The art direction is done. The interface design is not.** That is where the
remaining work is, and almost all of it is mechanical rather than creative.

---

## X3. Prioritised order

**Fix now (bugs):** B1 wrong totals · B2 typo · B3 strikethrough · B4 missing
backgrounds · B5 tiny team name · B6/B7 trophy clipping · B8 seam · B9/B10
row clipping

**Then (must):** M1 type scale · M2 one close control · M3 menu hierarchy ·
M4 AWARDS/RANKS · M5 trophy shelves · M6 tournament title overlap · M7 input
consistency · M8 duplicate price · M9 pause panel · M10 achievement footers

**Then (should):** S1–S17 in order.

**Highest value per hour:** B1–B4, then M1. Those four bugs are visible and
wrong; the type scale makes every other screen better at once.

---

## X4. What is genuinely working

Worth protecting while making changes:

- **The ball art.** 20 balls, one family, instantly distinguishable.
- **Colour semantics.** Gold = score/primary, green = on/success, blue =
  neutral, grey = inactive. Consistent almost everywhere.
- **The Settings panel** as rebuilt — fixed viewport, reserved header band,
  centred content, red X. It is the model the other panels should follow.
- **Leaderboard `YOU` replacing the username.** One row, one YOU, no duplicates.
- **Round buttons and cards.** Rounded, consistent, never pixelated.
