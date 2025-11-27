# 🎮 GAME DESIGN DOCUMENT — "GOAL DEFENDER"

## 📌 Core Concept

"Goal Defender" is a fast-reaction, skill-based arcade game where the player must prevent a football from entering their goal by clicking the ball to deflect it. The ball constantly moves toward the player's goal (left side), bounces off the right wall and ground, and repeats — becoming faster and harder to click as the game progresses.

Your score increases each time you successfully "tap-deflect" the ball, and each score = $1 used in the in-game shop to buy new balls with special abilities.

---

## ⚽ GAMEPLAY DESCRIPTION

### 🎯 Field Layout

- **Background:** A stadium interior view that fills the screen above the ground
- **Ground:** A 100px high ground texture at the bottom with decorative grass on top
- **Left side:** Your goal (if the ball fully enters it, you lose)
- **Right side:** A solid wall (ball bounces off it)
- **Ball:** Starts at position (640, 400) and immediately moves toward your goal at 300px/s

### 🖱️ Core Interaction

You defend your goal by clicking the ball at the right moment.

**Click Requirements:**
- Ball must be **left of the middle line** (x < 640)
- Ball must be **moving toward your goal** (velocity.x < 0)
- Click must be **within the hitbox radius** of the ball

**When successfully clicked:**
- Ball reverses direction toward the wall (right) with upward velocity (-350px/s ± 20px variation)
- Ball speed increases by 4% (up to 150% boost), then 2% (up to 300% max boost)
- Score increases based on equipped ball ability (default +1)
- Screen shakes slightly (100ms, 0.005 intensity)
- Score text scales up briefly (1.3x → 1.0x over 200ms)
- Click sound plays (800Hz sine wave, 0.1s duration)

**If the ball's right edge passes the goal opening, the run ends.**

### 🔵 Hitbox Shrinking Mechanic

To increase challenge over time:

- **Starting hitbox:** 120px radius
- **Shrinks every:** 20 seconds (not 10 seconds as originally planned)
- **Shrink amount:** 15px × hitbox shrink multiplier (affected by ball ability)
- **Minimum size:** Ball radius × min hitbox multiplier (default 1.0, Ghost Ball 1.2)
- **Visual feedback:** Hitbox circle pulses when shrinking (alpha 0.5 → 0.3 → 0.5)
- **Countdown display:** Shows "Hitbox shrinks in: Xs" or "Hitbox: MIN SIZE"

**Hitbox visibility:**
- **Visible (alpha 0.3):** When ball is left of middle and moving left
- **Dimmed (alpha 0.1):** When ball is not clickable

### ⚙️ Ball Physics

**Gravity:** 500px/s² downward

**Ground Bounce:**
- When ball touches ground, it jumps with -400px/s vertical velocity
- Horizontal velocity remains constant
- Bounce sound plays (300Hz sine wave, 0.15s duration)

**Wall Bounce:**
- Ball reverses horizontal direction
- 50% chance to add upward velocity (-200 to -300px/s)
- If moving slowly, adds random velocity (-150 to 150px/s)
- Creates 10 particle effects at bounce point
- Bounce sound plays

**Height Restriction:**
- Ball cannot go higher than the top of the goal sprite
- If it tries, velocity is reversed downward at 50% speed

### ⏱️ Difficulty Scaling

**Speed Increase (per successful deflect):**
- **0-150% boost:** +4% per deflect
- **150-300% boost:** +2% per deflect  
- **300% boost:** Maximum reached, no more increase

**Hitbox Shrinking:**
- Every 20 seconds
- Affected by Golden Ball ability (15% slower shrink rate)

**Ball Behavior:**
- Random angle variation on deflect (±20 degrees)
- Random vertical velocity on wall bounce
- Unpredictable trajectory increases difficulty

### 💀 Lose Condition

**Game Over triggers when:**
- The ball's right edge (x + displayWidth/2) passes the goal opening (goal.x + displayWidth/2)

**Game Over Sequence:**
1. Explosion sound plays (white noise, 0.5s fade out)
2. 20 particle effects burst from ball position
3. Ball stops and becomes invisible
4. Screen fades to black over 1 second
5. Transitions to Game Over Scene

**High Score:**
- Automatically saved if current score exceeds previous high score
- Stored in localStorage as 'goalDefenderHighScore'

---

## 🛒 SHOP SYSTEM

### Available Balls (6 total)

| Ball Name      | Cost  | Ability                                              |
|----------------|-------|------------------------------------------------------|
| Default Ball   | Free  | None                                                 |
| Golden Ball    | $50   | Hitbox shrinks 15% slower (multiplier 0.85)          |
| Steel Ball     | $100  | Ball moves 10% slower (speed multiplier 0.9)         |
| Fireball       | $200  | +2 score per deflect (score multiplier 2)            |
| Ghost Ball     | $350  | Min hitbox 120% of ball size (min multiplier 1.2)    |
| Spark Ball     | $500  | +5% extra score (score multiplier 1.05)              |

### Shop Features

**Ball Cards Display:**
- 3 balls per row in a grid layout
- Each card (280×200px) shows:
  - Ball icon (scaled to 0.2)
  - Ball name (20px font)
  - Ability description (14px italic, gray)
  - Price in yellow ($X format, 22px font)
  - Button (160×40px)

**Button States:**
- **BUY** (green): Not owned, can purchase if enough money
- **EQUIP** (blue): Owned but not equipped
- **EQUIPPED** (gray): Currently equipped, not clickable

**Money Display:**
- Top left corner (150, 40)
- Shows "MONEY: $X" in yellow text
- Updates after purchases

**Purchase System:**
- Money deducted from localStorage 'goalDefenderMoney'
- Ball added to 'goalDefenderOwnedBalls' array
- Scene restarts to refresh UI

**Equip System:**
- Sets 'goalDefenderEquippedBall' in localStorage
- Scene restarts to show new equipped state
- Equipped ball is used in next game

### Data Persistence

All data stored in localStorage:
- `goalDefenderMoney`: Total money (integer)
- `goalDefenderOwnedBalls`: JSON array of ball IDs (default: ["default"])
- `goalDefenderEquippedBall`: Currently equipped ball ID (default: "default")
- `goalDefenderHighScore`: Highest score achieved (integer)
- `goalDefenderMuted`: Sound mute state (boolean string)

---

## 🏠 MAIN MENU

### Visual Elements

**Background:**
- Stadium interior background (alpha 0.7)
- Ground texture at bottom (alpha 0.5)
- Decorative grass (alpha 0.4)

**Title:**
- "GOAL DEFENDER" at (640, 180)
- 80px font, white with orange stroke (6px)
- Shadow effect (3px offset, 5px blur)
- Pulsing animation (scale 1.0 ↔ 1.05, 1.5s duration)

**High Score Display:**
- Black container (400×70px) with yellow border at (640, 300)
- "HIGH SCORE: X" in yellow (40px font)
- Reads from localStorage 'goalDefenderHighScore'

**PLAY Button:**
- Green rectangle (250×80px) at (640, 420)
- "PLAY" text in 52px white font
- Hover: scales to 1.05, changes to bright green
- Click: starts GameScene

**SHOP Button:**
- Orange rectangle (250×80px) at (640, 520)
- "SHOP" text in 52px white font
- Hover: scales to 1.05, changes to bright orange
- Click: starts ShopScene

**Floating Ball Animation:**
- Default ball at starting position (200, 400)
- Scaled to 0.3
- Vertical bounce: y 350 ↔ 450 (1.5s)
- Horizontal float: x 150 ↔ 250 (2s)
- Continuous rotation: 360° every 3s

**Mute Button:**
- Volume icon at top right (1230, 30)
- Scaled to 0.08 (hover: 0.1)
- Toggles between volume-unmute and volume-mute icons
- Saves state to localStorage

---

## 🎮 IN-GAME UI

**Score Display:**
- Top left (20, 20)
- "Score: X" in 32px white font with black stroke

**Hitbox Countdown:**
- Below score (20, 60)
- "Hitbox shrinks in: Xs" or "Hitbox: MIN SIZE"
- 24px yellow font with black stroke

**Speed Boost Display:**
- Below countdown (20, 95)
- "Speed Boost: X%" in 24px green font
- Updates after each deflect

**Hitbox Circle:**
- Semi-transparent white circle (alpha 0.3 when clickable, 0.1 when not)
- Follows ball position
- Radius updates smoothly as it shrinks
- Depth 5 (above background, below goal)

**Middle Line:**
- Red vertical line at x=640 (alpha 0.3)
- Indicates clickable zone boundary
- Depth 5

**Ball Trail:**
- Particle emitter following the ball
- Uses equipped ball texture
- Scale 0.15 → 0, alpha 0.5 → 0
- 300ms lifespan, emits every 50ms
- Depth 0 (behind ball)

**Mute Button:**
- Same as menu (top right, 1230, 30)
- Depth 100 (always on top)

---

## 🎬 GAME OVER SCENE

### Display Elements

**Background:**
- Stadium interior background (alpha 0.6)
- Ground and grass (alpha 0.5 and 0.4)

**Title:**
- "GAME OVER" at (640, 130)
- 72px red font with dark red stroke (8px)
- Shadow effect

**Stats Container:**
- Black rectangle (500×180px) with white border at (640, 290)

**Score Display:**
- "SCORE: X" at (640, 230)
- 52px white font with black stroke

**Money Earned:**
- "Money Earned: $X" at (640, 300)
- 38px yellow font
- Amount equals final score

**Total Money:**
- "Total Money: $X" at (640, 350)
- 34px green font
- Shows updated total after adding earned money

**PLAY AGAIN Button:**
- Green rectangle (280×70px) at (640, 450)
- "PLAY AGAIN" in 42px white font
- Hover: scales to 1.05, brightens
- Click: restarts GameScene

**HOME Button:**
- Orange rectangle (280×70px) at (640, 540)
- "HOME" in 42px white font
- Hover: scales to 1.05, brightens
- Click: returns to MenuScene

**Mute Button:**
- Same as other scenes (top right)

### Money System

**On Game Over:**
1. Money earned = final score
2. Current money read from localStorage
3. New total = current + earned
4. New total saved to localStorage 'goalDefenderMoney'
5. Displayed on screen

---

## 🎵 SOUND SYSTEM

All sounds generated using Web Audio API (no external files).

### Sound Effects

**Click/Deflect Sound:**
- 800Hz sine wave oscillator
- 0.3 gain, exponential decay to 0.01
- 0.1 second duration
- Plays on successful ball deflect

**Bounce Sound:**
- 300Hz sine wave oscillator
- 0.2 gain, exponential decay to 0.01
- 0.15 second duration
- Plays on wall and ground bounces

**Explosion Sound:**
- White noise buffer (0.5s)
- 0.5 gain, exponential decay to 0.01
- Plays on game over

**Mute System:**
- Global `isMuted` variable
- Stored in localStorage as 'goalDefenderMuted'
- All sound functions check `if (isMuted) return;` before playing
- Mute button appears in all scenes

---

## 🎨 VISUAL EFFECTS

### Implemented Effects

**Screen Shake:**
- Triggers on successful deflect
- 100ms duration, 0.005 intensity
- Camera shake effect

**Score Flash:**
- Score text scales to 1.3x on increment
- Tweens back to 1.0x over 200ms
- Back.easeOut easing

**Hitbox Pulse:**
- When hitbox shrinks
- Alpha pulses 0.5 → 0.3 → 0.5
- 500ms duration, repeats once

**Ball Trail:**
- Particle emitter following ball
- More visible at higher speeds
- Uses equipped ball texture
- Automatically follows ball position

**Wall Bounce Particles:**
- 10 particles spawn at bounce point
- Speed 100-200px/s
- Scale 0.15 → 0, alpha 0.8 → 0
- 400ms lifespan
- Auto-destroys after 500ms

**Explosion Particles:**
- 20 particles on game over
- Speed 100-300px/s
- Scale 0.3 → 0, alpha 1 → 0
- 800ms lifespan
- Additive blend mode

**Button Hover Effects:**
- All buttons scale to 1.05 on hover
- Color brightens on hover
- Smooth transitions

**Title Animation:**
- Main menu title pulses continuously
- Scale 1.0 ↔ 1.05
- 1.5s duration, infinite loop
- Sine.easeInOut easing

---

## 🎮 GAME CONFIGURATION

**Resolution:** 1280×720 pixels

**Scaling:**
- Mode: Phaser.Scale.FIT
- Auto-center: CENTER_BOTH
- Responsive on all screen sizes

**Physics:**
- Engine: Arcade Physics
- Global gravity: 0 (gravity applied per-object)
- Debug mode: false

**Scenes (in order):**
1. BootScene - Asset loading
2. MenuScene - Main menu
3. ShopScene - Ball shop
4. GameScene - Main gameplay
5. GameOverScene - Results screen

**Assets Loaded:**
- background.png - Stadium interior texture
- ground.png - Ground texture
- grass.png - Decorative grass
- ball.png - Default ball
- goal.png - Goal sprite
- wall.png - Wall sprite
- ball-golden.png - Golden ball skin
- ball-fire.png - Fire ball skin
- ball-steel.png - Steel ball skin
- ball-ghost.png - Ghost ball skin
- ball-spark.png - Spark ball skin
- volume-unmute.png - Unmute icon
- volume-mute.png - Mute icon

---

## 📱 MOBILE SUPPORT

**Responsive Design:**
- Game scales to fit any screen size
- Maintains 16:9 aspect ratio
- Centers horizontally and vertically
- Canvas fills viewport without overflow

**Touch Support:**
- All pointer events work with touch
- Hitbox sized for touch accuracy
- Buttons have adequate touch targets

**Performance:**
- Particle systems optimized
- Auto-cleanup of temporary effects
- Efficient collision detection

---

**END OF DOCUMENT**
