# DESIGN — measured audit of every page

Every number below was read from the **live scene object tree**, not from the
source. Screenshots were captured by reading the WebGL canvas directly.

**Scope limit, stated honestly:** this is a measurement audit. Colour harmony,
imagery quality and animation feel were not judged by eye.

---

## The headline: there is no type scale

Distinct font sizes in use across the app:

```
10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 27 30 34 36 40 44 46 54 58 70 82
```

**26 sizes.** "Make this bigger" currently means guessing. A 6-step scale would
fix the inconsistency and make future edits safe.

Proposed: `12 / 14 / 18 / 24 / 36 / 54`, with a hard 13px floor.

---

## Per page

### MenuScene — a hierarchy inversion

| Text | Size |
|---|---|
| `GOAL DEFENDER` | 82px |
| `PLAY` | 40px |
| `SHOP` | 34px |
| `SIGN IN` | 21px |
| `V2.1` | **19px** |
| `TOURNAMENT` | **15px** |
| `LEARN TO PLAY` | **15px** |
| `AWARDS` | **15px** |
| `RANKS` | **15px** |

**The version stamp is bigger than four navigational labels.**

More seriously: `TOURNAMENT` is a whole game mode — brackets, cups, streaks, its
own leaderboard — and it is the third-smallest text on the menu, visually
demoted far below PLAY and SHOP. `AWARDS` and `RANKS` are 15px icon captions and
are the *only* route to a 39-item collection worth over a billion dollars and to
the leaderboard. Smallest labels on the page carry the deepest content.

Fix: drop `V2.1` to 12px. Raise TOURNAMENT to 21px and give AWARDS/RANKS real
buttons rather than captions.

### AchievementsScene — the worst page in the game

60 text objects. The list uses **three different sizes inside a single row**:

| Size | Count |
|---|---|
| 10px | 10 |
| 11px | 10 |
| 13px | 10 |
| 15px | 1 |
| 17px | 1 |
| 18px | 12 |
| 19px | 10 |
| 20px | 3 |

Three hand-tuned text calls per row is not a scale — and `AchievementsScene.js:266`
floors at 10px, which becomes **5px on a small Android** (F-13).

The descriptions are the entire point of 39 achievements and they are the least
readable thing on the page.

Fix: collapse each row to name + reward, move the description behind a tap,
raise the floor to 14px, and use one ramp.

### TournamentBracketScene — shrinking content while ignoring free space

30 of 39 texts are **12px**. Champions is a 32-team bracket.

Measured max y = **590** of 720. The bracket leaves **~130px of empty canvas** at
the bottom while compressing the only variable content to 12px. That is
backwards.

Fix: 16px team names using the space already there. No paging needed — verified
all 5 rounds fit.

### ShopScene — the ability line is the smallest text on the page

| Size | Count |
|---|---|
| 12px | 8 |
| 16px | 8 |
| 20px | 10 |
| 22px | 8 |

The 12px lines are the **ability descriptions** — the entire reason to buy a
$500,000 ball instead of a $250 one. That is the most important text on the page
and it is the smallest.

Fix: 14px minimum.

### LeaderboardScene — the cleanest page

46px title, 22px body, **nothing under 16px**. This is what the others should
look like.

### SettingsScene — rebuilt this phase

Fixed viewport `128..692`, 72px reserved header band, content viewport
`200..672`, rows at 66px tall / 72px spacing, red X inside the panel.

Verified: 25px clearance between the last row and the PLAYER NAME label, 28px
between the X and the first row, and the list is centred when it fits so the
signed-in build shows padding rather than an empty band.

Remaining nit: the header band is visibly empty on the left. Acceptable — it is
where the X lives and reserving it is what keeps the X safe forever.

### GameOverScene, TournamentVictoryScene, TrophyRoomScene, AccountScene,
### NamePromptScene, TournamentNameScene, GameScene

All healthy — no text under 16px, nothing off-canvas. `GameOverScene` at 70px
and `TournamentVictoryScene` at 44px read well.

---

## Cross-cutting problems

### 1. Close is inconsistent

Settings now has a top-right X. **Shop, Achievements, Leaderboard, TrophyRoom,
Account, Bracket and TournamentName all still have a bottom BACK.**

Settings is the odd one out, and it is the page people open most. Bottom placement
is also worse on phones — thumb reach plus letterboxing. Give everyone the X.

### 2. Four patterns for long lists

| Screen | Pattern |
|---|---|
| Settings | drag + wheel + indicator |
| Leaderboard | drag |
| Achievements, Shop | PREV/NEXT paging |
| Bracket | neither (fits, so none needed) |

Pick two. Scrolling is the better one — paging forces you to remember which page
a thing is on.

### 3. Bottom-anchored controls

`V2.1` at y=692 and every `BACK` sit where phones are least reachable.

### 4. Contrast is fine

The lowest measured contrast ratios are all intentional drop shadows — the
`#000000` layer behind titles and the `#1a1a1a` shadow on buttons. Real body
text sits comfortably above 4.5:1. **No action needed.**

---

## Prioritised

1. **A shared type scale with a 13px floor.** Fixes the 10/11/13 mess and the
   hierarchy inversion at once, and makes every future text change safe.
2. **Collapse achievement rows** to name + reward, description behind a tap.
3. **Bracket names to 16px** using the 130px already empty.
4. **Shop ability lines to 14px.**
5. **X on every screen** instead of bottom BACK.
6. Drop `V2.1` to 12px.
