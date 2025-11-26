# 📌 GAME DEVELOPMENT PHASES — "GOAL DEFENDER"

---

## PHASE 1 — Project Setup ✅

**Create Phaser project structure:**
- [x] `index.html`
- [x] `main.js`
- [x] `scenes/`

**Add all assets folders:**
```
/assets/pitch.png
/assets/ball_default.png
/assets/goal.png
/assets/wall.png
/assets/balls/ball1.png → ball10.png
```
- [x] Created assets folders structure

**Create scenes:**
- [x] `BootScene` (load assets)
- [x] `MenuScene`
- [x] `ShopScene`
- [x] `GameScene`
- [x] `GameOverScene`

**Configure game settings:**
- [x] Set resolution (1280×720)

---

## PHASE 2 — Basic World Setup ✅

**In the GameScene:**
- [x] Display football pitch background
- [x] Place the goal sprite on the left
- [x] Place the wall sprite on the right
- [x] Add physics boundaries if using static bodies
- [x] Add score text UI (temporary)

---

## PHASE 3 — Create the Ball (default ball) ✅

- [x] Add the ball sprite in the middle
- [x] Add circular physics body
- [x] Set initial movement direction: moving toward your goal (left)

**Add collision with:**
- [x] Left goal → triggers "lose" (when ball is 10px inside goal)
- [x] Right wall → bounce

---

## PHASE 4 — Click-to-Deflect Mechanic ✅

**Add pointer input so that clicking the ball:**
- [x] Instantly reverses direction toward the wall
- [x] Adds +1 score

**Add a temporary circular "big hitbox" around the ball:**
- [x] Transparent circle graphic
- [x] Registers the click event
- [x] Visible for testing (semi-transparent white circle)

---

## PHASE 5 — Hitbox Shrinking System ✅

- [x] Add line in middle where ball can only be clicked left of the line
- [x] Start the game with a large hitbox (200px radius)
- [x] Every 10 seconds, shrink the hitbox by a fixed amount (15px)
- [x] Minimum size becomes exactly the size of the ball (20px)
- [x] Smooth animation shrink effect

---

## PHASE 6 — Difficulty Scaling ✅

- [x] Ball speed increases every click by 4%

**Optional:**
- [x] Slight variation of angle on each bounce to avoid repetitiveness
- [x] Add "whistle click" sound or bounce sound

---

## PHASE 7 — Explosion on Goal + Game Over Flow ✅

**When ball enters the goal:**
- [x] Play an explosion animation (particle burst)
- [x] Fade screen
- [x] Move to `GameOverScene`

**In GameOverScene:**

**Show:**
- [x] "Score: X"

**Two buttons:**
- [x] Play Again
- [x] Home

- [x] Add animation (fade effect and particle explosion)

---

## PHASE 8 — Main Menu (Home Screen) ✅

**Create a beautiful start screen:**
- [x] Football pitch blurred background
- [x] Title: **GOAL DEFENDER**
  - [x] Animated glow or pulse

**Buttons:**
- [x] PLAY
- [x] SHOP

- [x] Display high score prominently on main menu
- [x] Add bouncing floating ball animation on menu

---

## PHASE 9 — SHOP SYSTEM ✅

**Shop screen shows 10 balls, arranged in a grid.**

**Display:**
- [x] Icon
- [x] Price
- [x] Ability description (will be added in Phase 10)
- [x] Buy button OR Equip button if already purchased

- [x] Show player money at top

**Save via localStorage:**
- [x] Owned balls
- [x] Equipped ball
- [x] Player money

**Game Over Screen:**
- [x] Shows money earned (equal to score)
- [x] Shows total money

---

## PHASE 10 — Add the 10 Ball Types ✅ (5/10 complete)

All balls cost more than the previous.

### Here are the 10 ball types:

#### 1️⃣ Default Ball
- **Cost:** Free
- **Ability:** None

#### 2️⃣ Golden Ball
- **Cost:** $50
- **Ability:** Hitbox shrinks 15% slower

#### 3️⃣ Fireball
- **Cost:** $100
- **Ability:** Ball moves 10% slower overall

#### 4️⃣ Steel Ball
- **Cost:** $200
- **Ability:** Each click gives +2 score

#### 5️⃣ Ghost Ball
- **Cost:** $350
- **Ability:** Minimum hitbox stays at 120% of ball size

#### 6️⃣ Spark Ball
- **Cost:** $500
- **Ability:** +5% extra score per deflect. Example: every 20 deflects gives +1 bonus

#### 7️⃣ Shadow Ball
- **Cost:** $700
- **Ability:** 1 auto-deflect every 25 seconds

#### 8️⃣ Cosmic Ball
- **Cost:** $1000
- **Ability:** When hitbox shrinks, ball speed decreases by 3% (helps control)

#### 9️⃣ Plasma Ball
- **Cost:** $1500
- **Ability:** 5% chance the ball slows to half speed for 1 second

#### 🔟 Titan Ball
- **Cost:** $2000
- **Ability:**
  - Hitbox shrinks 30% slower
  - Auto-deflect every 40 seconds
  - +2 score per deflect

**These abilities greatly increase gameplay variety.**

---

## PHASE 11 — Ability System Integration ✅

**Add logic:**

When loading the equipped ball:
- [x] Apply movement modifiers (Fireball: 10% slower)
- [x] Apply hitbox modifiers (Golden Ball: shrinks 15% slower, Ghost Ball: min 120%)
- [x] Modify score rewards (Steel Ball: +2 score, Spark Ball: +5%)
- [ ] Enable auto-deflect timer (not needed for current balls)

- [x] Ball abilities loaded via `loadBallAbilities()` function

---

## PHASE 12 — Full UI Polish

- [ ] Screen shake on click
- [ ] Flash effect when score increments
- [x] Ball trail at higher speed
- [x] Particles on wall bounce
- [x] Shrinking hitbox pulse animation
- [x] Improve main menu and game over screen and make them professional

---

## PHASE 13 — Sound & Effects ✅

**Add:**
- [x] Button click sound (not needed - buttons are visual only)
- [x] Deflect sound
- [x] Goal explosion sound
- [x] Bounce sound (wall and ground)

---

## PHASE 14 — Testing & Optimization

- [ ] Test on PC + mobile
- [ ] Adjust ball speed scaling
- [ ] Optimize hitbox for mobile touch accuracy
- [ ] Balance ball prices

---

## PHASE 15 — Final Build & Deployment

- [ ] Export to web build
- [ ] Deploy on Netlify or your domain

---

**END OF PHASES**
