# BALL-UPGRADES — future update plan

**Status: not started. Design only.** Nothing in this file is implemented. It
records the request, the shape it should take, and five things that will break
the build if they are not handled first.

---

## 1. What was asked

> add in md files for future update is to add upgrades to each ball that you can
> buy so you buy upgrades for each ball and could possibaly have diffrent look for
> upgrades and their could be upgrades that is same for multiple balls

Three requirements:

1. **Upgrades are bought per ball.** Each ball has its own upgrade track.
2. **Upgrades may change the ball's appearance.** Higher tier, different look.
3. **Some upgrades are shared between multiple balls.**

---

## 2. The decision to make first

Requirement 3 is ambiguous and it changes the whole data model, so it has to be
answered before anything else:

> What does "the same upgrade for multiple balls" mean?

**Option A — family perk (recommended).** Every ball carries a tag. An upgrade
bought for a tag applies to every ball carrying it, and you benefit on whichever
one you equip.

**Option B — global perk.** One shared upgrade list that applies to all 20 balls.

**Option C — both.** Per-ball tiers for depth, plus family perks on top.

**Recommendation: Option C**, and the reason is that A and the per-ball track
answer different questions. The per-ball tier asks *"how much have I invested in
this ball?"* — it should be visible on that ball and nobody else. The family perk
asks *"have I bought into this kind of ball?"* — it should reward a player who
owns five safety balls over one who owns five unrelated ones. If both were
per-ball, owning a ball would be a series of unrelated purchases with no
direction.

Tags proposed from the actual 20 balls (see `DESCRIPTION.md` for the full list):

| Tag | Balls |
|---|---|
| `safety` | golden, ice, ghost, revive, life, void, inverted |
| `speed` | steel, anchor, neon, spark |
| `score` | fire, candy, focus |
| `economy` | money, rally |
| `physics` | rubber, sprung |
| `mixed` | gauntlet, default |

---

## 3. Data model — and why it must be ONE key

**This is the single most important line in this document.**

Upgrade state must be stored as **one JSON blob under one `localStorage` key**,
not as one key per ball. The reason is arithmetic:

```
SAVE_KEYS now       30
rules save.size cap 40
headroom            10
```

A key per ball for 20 balls needs **+20 keys**. That is over the cap, and
`firestore.rules` denies any account write whose `save` map exceeds 40 keys.

This has happened before and it is the worst kind of bug: it does not fail for a
new player, it fails for the player who has played the most. The comment in
`firestore.rules` records it — the cap sat at 20 while `SAVE_KEYS` grew to 26,
so anyone owning a ball or having won a cup crossed 20 and **every account
write was silently denied** — sign-up, sync and rename all failed with
permission-denied for exactly the most-engaged players.

So:

```
goalDefenderUpgrades = {
  "anchor": { "tier": 2 },
  "steel":  { "tier": 1 },
  "rally":  { "tier": 3 }
}
```

One key. Headroom becomes 9. Add it to `SAVE_KEYS` in `account.js`, and while
there confirm the cap in `firestore.rules` is still above the new count.

A related subtlety: **upgrade tiers must never count toward `balls_all`**
("Full Rack", 500,000). It is measured against `BALL_COUNT` in
`achievements.js`, which is 20 and counts *owned balls*. A tier is not a ball.
If tiers ever leak into that count the achievement becomes trivially farmable by
upgrading one ball instead of buying twenty.

---

## 4. Five things that will break this if ignored

### 4.1 Upgrades must not apply in tournaments

`TournamentGameScene` deliberately resets every ability field to neutral so all
32 entrants start on identical footing. `audit-abilities.js` asserts this
(`no ability switch in tournaments`, `every field reset to its neutral value`).

Upgrades are ability changes. They must be neutralised in tournament play or the
cup stops being fair and that audit starts failing. The cleanest place is
`TournamentGameScene.loadBallAbilities()`, which already exists for exactly this
purpose.

**Also worth deciding:** should a player's upgrades carry into their tournament
run at all? If not, a player can grind upgrades in endless then enter a cup and
be at a disadvantage they did nothing to earn. If yes, the tournament is no longer
level. There is a defensible middle answer (upgrades apply, but every entrant's
tier is normalised to the same level) — it is a design call, not a technical one.

### 4.2 An upgrade must never remove a ball's trade-off

Every ball is balanced around something it gives up. An upgrade that fixes a
ball's weakness deletes the reason the ball costs what it costs.

| Ball | Its trade-off | Upgrade must NOT do this |
|---|---|---|
| Anchor | boost ramps at +2% instead of +4% | raise the ramp rate back toward default |
| Void | starts at min hitbox, ceiling 170% | raise the ceiling, or raise the starting hitbox |
| Gauntlet | can never exceed 130% speed | raise the ceiling |
| Inverted | hitbox pinned 150%, speed pinned 150% | unpin either |
| Steel | base speed 90% | restore base speed |
| Spark | ceiling 210% | raise the ceiling |

An upgrade should **deepen a ball's identity**, not cure it. Anchor's upgrade
should make the slow ramp *less punishing* (more total boost by the end of a run)
without ever making the ball fast early.

### 4.3 Art: 60 textures is not a realistic ask

Requirement 2 wants a different look per upgrade. Taken literally that is:

```
20 balls x 3 tiers = 60 textures
```

There are currently 19 ball PNGs plus `assets/ball.png` for the Default Ball.
Tripling that is a large art job, and placeholder art is not acceptable on this
project.

**Recommendation — tint first, real art only for flagships.** Phaser can recolour
a loaded texture at draw time with `setTint()`, so three looks per ball cost zero
new files.

Caveat, stated honestly: the current ball art has dark outlines, and a tint
multiplies, so it will tint the outlines too and may look muddy on a football
pattern. **Test one ball before committing to the approach.** If tinting looks bad,
the fallback is real art for a small number of balls (the expensive tier only) and
no visual change on the others — not 60 files.

Whatever is chosen, the naming convention is fixed and has been got wrong before:

```
art file      assets/balls/ball-anchor-t2.png     <- HYPHENS
texture key   ball_anchor_t2                     <- UNDERSCORES
load in       BootScene.js
map in        GameScene.getBallTexture()
```

### 4.4 Achievements must be re-measured, not assumed

There are 39 achievements with thresholds tuned against the current ability
set. Any upgrade that moves a number an achievement measures can make it
unreachable or trivial. Known ones to watch:

- `spd_210` "Spark Ceiling — reach 210%" — any upgrade that raises a ceiling
- score-based achievements — any `score` tier upgrade
- `balls_all` "Full Rack" — see 4.2 above, tiers must not count as balls

Re-run the audit suites after adding upgrades and re-measure anything that moved.

### 4.5 The shop has no room for this

`ShopScene` paginates 8 cards across 3 pages for 20 balls, and each card already
carries a name, an ability line that can wrap to two, a price and a BUY button.
There is nowhere to put three upgrade rows.

Upgrades need their own view — a per-ball detail or upgrade screen reached from
the card — rather than being crammed into the existing card. Budget for a new
scene, not a tweak.

---

## 5. Recommended shape, concretely

**Three tiers per ball.** Tier 0 is the ball as it is today, which means no
existing save changes behaviour and every ball keeps its current value.

| Tier | Grants |
|---|---|
| 0 | the ball as it is today |
| 1 | one small step in the ball's own direction |
| 2 | second step |
| 3 | third step, and the only tier with art |

**The pricing is not settled and should not be guessed.** Percentage-of-ball-price
was the first idea and it does not survive arithmetic. At 25% / 60% / 140% of
each ball's price, fully upgrading all 20 balls costs:

```
sum of tiers 1-3 across all 20 balls   $5,668,088
stated money pool                   $1,012,857,380
share of pool consumed                          0.6%
```

That is not a meaningful sink. For scale, the total price of **all 20 balls
put together** is $2,519,150 — so the existing ball prices are already tiny
against the stated pool, which means the pool figure and the per-player budget
are not the same thing and I cannot derive sane upgrade costs from them.

**This needs an owner answer: what is a single player's realistic lifetime
earnings?** Once that number exists, tier costs can be set so that a fully
upgraded save represents a meaningful slice of a career without pricing out
players who are still working through the ball ladder. Guessing here is how the
Gauntlet Ball's $1.5M price ended up flagged as undecided (F-23 in
`KNOWN-ISSUES.md`) — the ladder has no agreed budget behind it.

**Plus family perks.** One shared purchase per tag, applying to every ball with
that tag. Should cost more than any single ball's tier 3, so it is a real
commitment rather than a rounding error.

---

## 6. Open questions for the owner

1. **What is a single player's realistic lifetime earnings?** Upgrade prices
   cannot be set without it, and the ball ladder has no agreed budget behind it
   either (section 5, F-23).
2. Family perks, global perks, or both? (section 2)
3. Do upgrades apply in tournament matches, or are they normalised there? (4.1)
4. Tint-based tier looks, or real art — and for how many balls? (4.3)
5. Should upgrades be earnable through play (a deflect-count unlock) as well as
   bought? A free tier 1 gives new players something to aim at.
6. Is the price of every ball still correct once upgrades exist? Several were
   priced as complete packages.

---

## 7. Where the work will land

Roughly, when it is time to build:

| File | Change |
|---|---|
| `scenes/ShopScene.js` | upgrade entry point on each card; price display |
| `scenes/GameScene.js` | `getBallTexture()` variant lookup; tier effects in `loadBallAbilities()` |
| `scenes/BootScene.js` | load any new variant textures |
| `account.js` | one new `SAVE_KEYS` entry |
| `firestore.rules` | confirm the `save.size()` cap still clears |
| `achievements.js` | re-measure anything a tier moves; confirm tiers are not balls |
| `scenes/TournamentGameScene.js` | neutralise upgrades |
| new scene | upgrade screen |
| `audit-abilities.js` | assert upgrades never touch a ball's trade-off |

---

## Related

- `IMPORTANT.md` — hard rules, including the account-write one this plan runs into
- `TOURNAMENT.md` — the fairness model that upgrades must respect (4.1)
- `DESCRIPTION.md` — all 20 balls and their abilities, which is what an upgrade
  has to respect (4.2)
- `DESIGN-RULES.md` — asset and colour conventions (4.3)
- `firestore.rules` — the `save.size()` cap (section 3)
