# Goal Defender — Play Store listing copy

Paste-ready. Character counts are enforced by `check-listing.js`.

---

## App name

```
Goal Defender
```

**Not used:** "Goal Defender 2", "Goal Defender - Soccer", or anything with
`V2.2` in it. Google Play rejects titles that look like version numbers or
keyword lists, and the app has no sequel. The in-game menu shows `V2.2` in its
bottom-right corner, which is fine - that is a build stamp, not a title.

---

## Short description — 80 characters max

```
One-tap arcade football. Defend the goal, collect 20 balls, win the cup.
```

That is the version to paste. A second option, if you want the offline angle:

```
Defend the goal in one-tap arcade football. 20 balls, cups, no ads.
```

---

## Full description — 4000 characters max

```
Defend the goal. Nothing else.

The ball comes at you. Tap it and it bounces back the other way. Every tap makes
it faster and its target smaller, so the run always ends exactly one tap too
late - and then you go again.

That is the whole game, and it is hard to put down.

ONE TAP
No drag, no swipe, no buttons to hold. Anywhere on the screen counts. It plays
identically on a phone and a desktop, and it works with one hand.

20 BALLS, EACH ONE A DIFFERENT TRADE
Every ball changes the game rather than just the numbers on it.

- Anchor Ball - normal speed, but the speed boost builds at half rate
- Void Ball - starts at the smallest hitbox and can never top out
- Gauntlet Ball - a huge target, but it will never move fast
- Candy Ball - every deflect is worth triple
- Rally Ball - each tap in a run earns one more dollar than the last
- Inverted Ball - the hitbox never shrinks and the speed never rises

Twenty of them, from a $150 Golden Ball to a $1.5M Gauntlet Ball. Each one gives
something up.

TOURNAMENT MODE
The real game. Enter a 16-team Qualifiers Cup or a 32-team Champions Cup, win
matches, and walk the bracket through to the final. The bracket shows both halves
of the draw converging on the centre.

Win cups, keep the trophies, build a streak. Your opponent's abilities are
switched off inside a tournament, so everyone starts on identical ground.

39 ACHIEVEMENTS
Deflection ladders, score records, perfect-tap counters, ball collecting and cup
streaks. Each one pays out. Unlock all of them if you can.

A LEADERBOARD THAT IS ACTUALLY FAIR
No minimum-score filter and no inflated entries. Your best run is the only thing
that gets published.

ACCOUNTS, IF YOU WANT ONE
Play signed out, or make a username and password and your progress follows you
between devices. The game plays completely offline either way - an account only
ever adds sync, the leaderboard and the trophy room.

NO ADS. NO ENERGY TIMERS. NO CASH SHOP.
Everything in the shop is bought with money you earn by playing. Nothing is for
sale.
```

---

## Category, tags and contact

| Field | Value |
|---|---|
| Application type | Game |
| Category | Arcade |
| Tags | Arcade, Casual, Sports, Single player, Offline, Free |
| Content rating | Fill the IARC questionnaire honestly - no violence, no user content, no purchases |
| Ads | No |
| In-app purchases | **Read the policy note before declaring none** - see below |
| Target audience | 13+ if unsure; contains no objectionable content |
| Support email / website | yours - Play requires both |
| Privacy policy URL | **required**, and this one is not optional - see below |

### Two fields that are mandatory and not code

**Privacy policy URL.** Play requires one for any app that requests a device
identifier, and Firebase anonymous auth creates a persistent identifier. Point it
at a page that says what the game stores: a username you chose, an email derived
from it for sign-in, and game progress. Nothing else is collected, there are no
ads, and no data is sold.

**Data safety form.** Declared as:
- collected: user IDs, game progress, purchase history (in-game currency only)
- shared: nothing
- used for: app functionality, authentication
- encrypted in transit: yes (Firebase is https)
- user can request deletion: yes, by deleting the account

Mark anything you do not actually do as not collected. An inaccurate Data safety
form is a policy violation, not a formatting error.

### The in-app purchase question, honestly

The game sells **no real-money purchases**, and money cannot be bought with
fiat - it is only earned by playing and by achievement rewards. On that basis
"no in-app purchases" is the correct declaration.

The one thing to know: Google requires Play Billing for any digital item sold for
real money *inside* the app, and reaching into Goal Defender to buy currency with
a card would put it squarely in that category. It does not do that, and the store
copy above promises it never will - so keep that promise.

---

## What is NOT in the listing yet

- **Full-screen or tablet-specific screenshots.** Play accepts the 8 phone shots
  in `screenshots/`. Since the app supports large screens it will also be shown
  on tablets; you can add a 7-inch set later, but it is not required for review.
- **A promo video.** Optional, and the honest advice is to skip it: the game is
  one tap, so a video of it is hard to make interesting, and Play does not
  require one.