# Devlog — V2.2

**Title:** Goal Defender V2.2 — Six New Balls, and the Interface Finally Finished
**Genre:** One-tap reflex arcade · Endless score attack · Collection
**Platform:** Browser (desktop + mobile), free on itch.io
**Engine:** Phaser 3, vanilla JS, no build step
**Date:** 3 October 2025

---

## The short version

V2.2 is the biggest content release the game has had: **six new balls** taking the
shop to **20**, and the **first real pass over the interface as a design object**
rather than a set of screens that happened to exist.

Twelve new achievements, a rebalance of three older balls, achievements
rewritten to measure something that does not move underneath you, a Settings
page that no longer pushes its own close button off the screen, and **ten bugs
fixed** — including one that had been telling players the game had 14 balls when
it had 20.

---

## Balls: 6 → 20

Every ball changes the physics rather than a number on a stat card. The shop is
sorted by price, and there is no stat difference between balls — cost is the only
axis.

| Price | Ball | What it changes |
|---:|---|---|
| $150 | **Golden Ball** | Hitbox shrinks 15% slower |
| $900 | **Steel Ball** | Speed increases 10% slower |
| $3,600 | **Rubber Ball** | Bounces 25% higher |
| $4,500 | **Ice Ball** | Hitbox shrinks 50% slower |
| $6,000 | **Anchor Ball** | Speed increases 50% slower |
| $10,000 | **Revive Ball** | Saves you once — bounce off the goal |
| $14,500 | **Fire Ball** | +2 score per deflect |
| $15,000 | **Neon Ball** | Speed boost +8% per hit |
| $15,250 | **Sprung Ball** | Bounces 60% higher |
| $15,750 | **Ghost Ball** | Minimum hitbox 130% of ball |
| $24,500 | **Money Ball** | $5 per deflect instead of $3 |
| $30,000 | **Spark Ball** | Max speed boost 210% |
| $50,000 | **Candy Ball** | +3 score per deflect |
| $60,000 | **Life Ball** *(new)* | Saves you three times |
| $65,000 | **Rally Ball** *(new)* | Each deflect earns $1 more than the last |
| $90,000 | **Focus Ball** *(new)* | Dead-centre taps are Perfect: +5 score |
| $100,000 | **Void Ball** | Hitbox starts at minimum, max speed 170% |
| $500,000 | **Inverted Ball** *(new)* | Hitbox stays 150%, max speed stays 150% |
| $1,500,000 | **Gauntlet Ball** | Hitbox 170%, max speed 130%, +5 score |

### The three that change how the game feels

**Focus Ball** turns the game from *positioning* into *aiming*. A tap within 20px
of centre is a Perfect worth +5. At 25px it is an ordinary hit. It is the first
ball that rewards precision rather than reaction, and it is the first one where
the hitbox is smaller than the ball you can see.

**Inverted Ball** is the only ball immune to both pressure curves at once. Its
hitbox never shrinks and its speed never grows — so a 500-run on Inverted is a
completely different object from a 500-run on Default. Expensive, and for a
reason that is not "bigger numbers".

**Rally Ball** pays a triangular amount: 10 taps earns $55 rather than $30. It
rewards surviving rather than peaking, which is the opposite of what the other
expensive balls ask for.

### Rebalances

- **Anchor Ball** — base speed *and* boost rate halved. Copy now reads "Speed
  increases 50% slower". It is the most forgiving ball in the game and finally
  behaves like it.
- **Steel Ball** — boost rate tuned to 1.036 per hit.
- **Void Ball** — max speed raised 150% → 170%, since starting at minimum hitbox
  made the early game so punishing the tail was never reached.

---

## Achievements: 30 → 39, and remeasured

**All deflection achievements now measure a single run, not a lifetime total.**

This is the most important change in the release and it was not a balance change
— it was a correctness one. "Score 250 in one run" moves whenever the ball's
score multiplier changes. Aim for 250 on the Default Ball and the achievement is
a warm-up; aim for it with Candy Ball and it is trivial. **The difficulty of an
achievement was silently determined by which ball you had equipped.** Deflections
don't move, so they measure the thing the player is actually doing.

The `score_*` achievement IDs were deliberately **kept**, so nobody is re-paid for
one they already earned, and nobody who earned one has it re-locked.

The `snapshot()` is taken before the unlock loop runs, which is fine for every
other achievement but would make "all others unlocked" always one step behind
itself — so **Hacker is tested after the loop** against the live unlock map.
Verified in both directions: it stays locked at 37 with the streak unmet, and it
fires on the same pass as the 38th.

**Achievement pool: $1,012,857,380.**

New this release: First Ever, Twenty-Five Hundred, Regular, The Real Hat Trick,
Novice Collector, Serious Collector, On the Go, Reflex, and Hacker.

---

## The interface pass

Thirteen screens photographed and measured, then **10 bugs, 10 must-do fixes and
17 polish items** applied. The bugs were the interesting part.

### The bugs

**The Account page said "1 of 14 balls" and "14 of 30 achievements".** There are
20 balls and 39. The totals were hardcoded string literals. So the page where you
check your progress contradicted the Shop and the Achievements page *in the same
session* — a player would reasonably conclude the shop was lying.

**A line was struck through "Win the Qualifiers Cup first."** Not a graphics bug:
two different unlock messages were being drawn 4px apart, one on top of the
other, and the one that got hit was the only sentence on the screen explaining
why the cup was locked.

**The bracket and the tournament result screen had no background at all** — flat
black voids while every other screen was a stadium. The bracket is the one
content-heavy screen in the tournament, showing 16 team names and five round
headers, and it looked like a debug view.

**The Settings page pushed its own close button off the screen.** The panel was
sized to its contents, so every setting added made the page taller. With Ball
Trail added, BACK sat 8 pixels past the bottom of the 720px canvas — genuinely
unreachable on any device.

**Trophy art overflowed its own card** and the card labels fell *outside* the
card, so the text looked like it had dropped out of the box.

**A full-height seam ran through the pause dialog** — the red hit-zone guide
showing through a 78%-opacity overlay.

### The fixes

**One close control.** There were four different close patterns: an X in one
place, BACK bottom-left elsewhere, BACK bottom-centre elsewhere, and nothing on
the rest. Every sub-screen now has the same red X in the same place.

**A real type scale.** The game was using **26 distinct font sizes**, and
Achievements used three different ones *inside a single card* — 10px, 11px and
13px. On a small Android, 10px renders at about 5px. There are now six sizes and
a hard 13px floor.

**Real gradients.** `drawPanel` was drawing the darker colour as a full rectangle
and then the lighter colour on top of it, completely covering the first. **Every
"gradient" panel and button in the game was flat**, and the second colour was dead
code.

**The menu hierarchy was inverted.** The version stamp was 19px while TOURNAMENT
— a whole game mode with brackets, cups and a trophy room — was 15px. AWARDS and
RANKS, which are the only route to a billion-dollar collection and the
leaderboard, were the smallest, most cramped controls on the page.

**The account slot was a coloured blob.** The name and SIGN IN had a "glow" behind
them that used the same colour as the text with a 7px stroke, so it was a thick
ring of the text's own colour fighting a dark outline of the same text. It's now a
proper pill with a drawn person glyph, matching every other chip in the game.

**Two identical-looking text inputs** — the tournament name box had a gold ring
and an inner panel; the welcome name box had no border at all and looked disabled.
Now one shared style.

---

## Quality of life

**The tutorial has a SKIP button.** It used to be four timed beats plus a HOME
button that was deliberately locked for the first second. If you had already
learned the game, there was no way out.

**Best-run records** are tracked separately from lifetime totals, so "100
deflections in a single run" and "100 deflections ever" can both exist and mean
different things.

**The shop no longer prints every price twice.** It showed `$150` in gold above
the button and `BUY $150` inside it.

**EQUIPPED now looks like a success** instead of a disabled grey button.

---

## Under the hood

- **Zero console errors** across all 17 scenes and all 20 balls.
- **14 automated suites**, including audits that fail the build if a scene
  hardcodes a version string, if any font drops below 13px, or if any
  documentation would ship.
- **Ball asset audit**: every texture path resolves on disk, hyphen/underscore
  mixups are caught, no orphaned art, and the shop count must equal `BALL_COUNT`.
- Offline-first with an authoritative cloud console — edit your save from the
  Firebase console and the game adopts it over local state rather than merging.
- Anonymous play by default; signing in carries your stats and retires the
  anonymous row.

---

## Thanks

This one is for everyone who told me a button looked wrong before I could see
what was actually wrong with it.

---

*Goal Defender — V2.2*
