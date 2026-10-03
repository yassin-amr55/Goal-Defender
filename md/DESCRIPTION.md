# DESCRIPTION — what Goal Defender is

Live: **https://yassin-amr55.itch.io/goal-defender**

---

## The game in one paragraph

You are a goalkeeper. A ball falls toward your goal and you tap it to deflect
it. Every tap makes the ball faster and your hitbox smaller. There is no drag,
no aim, no movement — one input, and the entire game is how long you can hold a
shrinking hitbox against an accelerating ball.

A run ends when the ball passes you. Your score is the number of deflections.

---

## Core loop

| Step | What happens |
|---|---|
| Tap the ball | +1 deflection, +1 score, the ball resets to the top |
| Each tap | Ball speed rises, hitbox shrinks |
| The hitbox shrinks | Below a floor you cannot react at all — this is the real difficulty curve |
| Ball passes you | Run over |
| Run over | You are paid, and your best-run records update |

**The hitbox is the game.** It shrinks continuously, not per-tap, so the
difficulty is a smooth curve rather than steps. Most of the tuning work went
into how fast it shrinks and where the floor is.

---

## Balls — 20 of them, sorted by price

Every ball is a different way to change the physics. Price is the only cost;
there is no stat difference. Ownership is **account-authoritative** — your ball
list lives on your account, so signing into another account gives you that
account's balls and not the union of both.

| Price | Ball | Ability |
|---:|---|---|
| $0 | **Default Ball** | None |
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
| $24,500 | **Money Ball** | Earns $5 per deflect instead of $3 |
| $30,000 | **Spark Ball** | Max speed boost 210% |
| $50,000 | **Candy Ball** | +3 score per deflect |
| $60,000 | **Life Ball** | Saves you three times |
| $65,000 | **Rally Ball** | Each deflect earns $1 more than the last |
| $90,000 | **Focus Ball** | Dead-centre taps are Perfect: +5 score |
| $100,000 | **Void Ball** | Hitbox starts minimum, max speed 170% |
| $500,000 | **Inverted Ball** | Hitbox stays 150%, max speed stays 150% |
| $1,500,000 | **Gauntlet Ball** | Hitbox 170%, max speed 130%, +5 score |

### Notes on specific balls

- **Anchor** — halves *both* base speed and the boost rate. Copy says "Speed
  increases 50% slower". It is the most forgiving ball in the game.
- **Sprung** — bounces 60% higher, giving it a genuinely different rhythm. It
  rises 287px vs the default's 162px. It hits the roof clamp 6px above the
  goal, so pushing its jump multiplier past 1.6 achieves nothing.
- **Rally** — pays a triangular amount. 10 taps = $55.
- **Focus** — a tap within 20px of centre counts as Perfect and is worth +5
  score. At 25px it is an ordinary hit.
- **Inverted** — no shrink, no growth. Both bounds fixed. Its value is that it
  is immune to both pressure curves at once.
- **Gauntlet** — the only ball that is strictly worse at shrinking (170% of the
  default) *and* slower (130%). It pays +5 score per deflect. The trade is
  deliberate, but see `KNOWN-ISSUES.md` F-23 on its price.

---

## Achievements — 39, worth $1,012,857,380 total

All deflection-based achievements measure **a single run**, not a lifetime
total. This changed during the current phase: they used to be score-based.

**Why:** score moves whenever a ball's score multiplier changes, so
"score 250 in a run" silently changed the difficulty of the achievement
depending on which ball you had equipped. Deflections are stable.

The `score_*` achievement IDs were **kept** despite the metric change, so
anyone who already earned one is not re-paid and is not re-locked.

### The ladder

| Achievement | Requirement |
|---|---|
| First Ten | 10 deflections in one run |
| Getting Serious | 25 |
| High Fifty | 50 |
| Century | 100 |
| Unstoppable | 250 |
| Double Century / Four Figures / Five Figures / Fifty Thousand / Six Figures / Million Deflections | score tiers |
| Bit of a Pace / Picking Up / Double Speed / Double Again / Spark Ceiling / Terminal Velocity | speed tiers |
| Entering the Cup / Qualifiers Champion / Champions of Champions / Hat Trick / Tournament Machine / The Real Hat Trick | tournament |
| Regular / Ball Collector / Novice Collector / Serious Collector / Full Rack | ball collection |
| First Ever / Graduate / Pocket Change / Tycoon / Twenty-Five Hundred / On the Go / Reflex | special |
| **Hacker** | **Every other achievement unlocked** |

### Hacker is special-cased

It cannot be evaluated from a snapshot, because `snapshot()` is taken *before*
the unlock loop runs — so a snapshot-based metric would always be one unlock
behind and could never fire. It is tested explicitly after the loop against the
live unlock map.

Verified in both directions: stays locked at 37 with the streak requirement
unmet, and fires on the same evaluation pass as the 38th.

---

## Tournaments

Three modes with a bracket, a trophy room and a streak counter.

**Tournaments disable every ball ability.** `TournamentGameScene` neutralises
all 15 ability fields and forces `jumpMultiplier = 1`. This is intentional and
correct: if your ball gave you an edge, it would not be a competition. The
`audit-abilities.js` suite asserts this parity so nobody "fixes" it later.

- **Qualifiers** → unlocks the Champions Cup
- **Champions Cup** → 32-team bracket, 5 rounds
- **Tournament streak** — a win increments, a loss resets it to zero. It is
  synced but deliberately *not* in `MONOTONE_NUMBERS`, because a loss legitimately
  lowers it. The resetting device is the one that applies the value.

Full detail in `TOURNAMENT.md`.

---

## Accounts

- **Anonymous** by default. Name, money, balls, stats, achievements all in
  `localStorage`.
- **Email/password** optional. On sign-in or sign-up the anonymous identity is
  **retired**: stats carry over to the account and the old anonymous row is
  deleted.
- **Offline-first with an authoritative console.** A cloud fingerprint poll
  (every 10s, plus on focus and visibility change) adopts external edits
  *over* local state rather than merging. Lowered scores stick; removed balls
  stay removed.
- Ball ownership is account-authoritative, not a union — which is what stopped
  purchases leaking across accounts.

---

## Settings

Five toggles, in a fixed panel with scrollable content:

| Setting | Key | Default |
|---|---|---|
| Screen Shake | `gdShake` | on |
| Particles | `gdParticles` | on |
| Ball Trail | `gdBallTrail` | on |
| Always Show Hitbox | `gdHitboxAlways` | off |
| Sound (inverted: on = unmuted) | `gdMuted` | on |

Plus **Player Name** when signed out. When signed in the account owns the name
and it is changed from the account page, throttled to once a week.

The panel is a **fixed viewport with clipped, scrollable content** — adding a
setting can never push a control off the page. See `KNOWN-ISSUES.md` for the
history of that panel overflowing.

---

## Scenes

```
BootScene            loads all textures
MenuScene            title, PLAY / SHOP / TOURNAMENT / LEARN TO PLAY
GameScene            the run itself
GameOverScene        payout, best-run records, menu
TutorialScene        first-run explainer
ShopScene            20 balls, paged, price-sorted
SettingsScene        5 toggles + name, scrollable
AchievementsScene    39 achievements, paged, claimable
LeaderboardScene     high scores / trophies, scrollable
NamePromptScene      DOM text input overlay
AccountScene         sign in / sign up / rename
TournamentMenuScene  mode select + trophy room entry
TournamentNameScene  DOM text input overlay for tournament name
TournamentBracketScene  32-team bracket, all 5 rounds fit on one screen
TournamentGameScene  a tournament run, abilities neutralised
TournamentVictoryScene   streak win/loss logic
TrophyRoomScene      earned trophies
```

---

## Design language

- Dark navy panels, gold accents, white text, green for "on"
- Rounded corners everywhere; no square or pixelated buttons
- No emoji, ever — text only, and custom SVG/PNG art
- Ball art is 512×512 PNG, one per ball
- Titles use a two-layer treatment: a black shadow offset 2px behind white text
  with a gold stroke
