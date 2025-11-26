# 🎮 GAME DESIGN DOCUMENT — "GOAL DEFENDER"

## 📌 Core Concept

"Goal Defender" is a fast-reaction, skill-based arcade game where the player must prevent a football from entering their goal by clicking the ball to deflect it. The ball constantly moves toward the player's goal (left side), bounces off the right wall, and repeats — becoming faster and harder to click as time passes.

Your score increases each time you successfully "tap-deflect" the ball, and each score = $1 used in the in-game shop to buy new balls with special abilities.

---

## ⚽ GAMEPLAY DESCRIPTION

### 🎯 Field Layout

- **Background:** A high-quality top-down football pitch
- **Left side:** Your goal (if the ball touches it, you lose)
- **Right side:** A solid wall (ball bounces off it)
- **Ball:** Starts in the center and immediately moves toward your goal

### 🖱️ Core Interaction

You defend your goal by clicking the ball at the right moment.

**When clicked:**
- The ball instantly changes direction (from left → right)
- You gain +1 score (which also = +$1 currency)
- You survive and continue the round

**If the ball touches your goal, the run ends.**

### 🔵 Hitbox Shrinking Mechanic

To increase challenge over time:

- At the start, the ball has a big circular clickable hitbox around it
- Every 10 seconds, the hitbox shrinks smoothly
- Eventually, the clickable area becomes the exact size of the ball
- This makes precise clicking harder as the game progresses

This mechanic creates difficulty scaling without changing the core rules.

### ⏱️ Difficulty Increase

The game gets harder over time because:

1. **Ball speed increases** every 20 seconds → higher reaction difficulty
2. **Hitbox shrinks** every 10 seconds → harder to click
3. **Optional:** Ball angle may slightly vary after each deflect to avoid repetition

### 💀 Lose Condition

If the ball collides with your goal (left side), the run ends.

**Show a Game Over screen with:**
- Final score
- Money earned
- Retry button
- Shop button

---

## 🛒 SHOP SYSTEM (with abilities)

Each ball is a skin + passive ability.

Players spend money earned from score (1 score = $1).

### Example Balls & Abilities

| Ball Name      | Cost  | Ability                                              |
|----------------|-------|------------------------------------------------------|
| Classic Ball   | Free  | No ability                                           |
| Golden Ball    | $50   | Larger hitbox shrink speed is reduced 20%            |
| Fireball       | $100  | Ball moves slower by 10% (easier)                    |
| Steel Ball     | $150  | Gives +2 score per deflect instead of +1             |
| Ghost Ball     | $200  | Hitbox never shrinks to ball size (minimum 120%)     |
| Magnetic Ball  | $300  | Auto-deflect once every 30 seconds                   |

**Each ball has:**
- Unique color/design
- Unique glow/particle effects (optional)
- Ability that changes gameplay
- Owned balls stay unlocked permanently (saved in localStorage)

---

## 🏠 MAIN MENU

The start screen should be beautiful & well-designed.

### ✨ Visual Style

**Background:**
- The football pitch background, slightly blurred or darkened

**Title at top:** GOAL DEFENDER
- Big, bold, clean font
- Subtle glow

**Buttons:**
- **PLAY**
  - Big green button
  - Hover animation
- **SHOP**
  - Smaller but still visible
  - Opens the shop screen

**High Score Display:**
- Show the player's highest score achieved
- Displayed prominently on the main menu

**Animated Touch:**
- The ball bouncing near the center
- Particles or shine effects moving slowly
- Smooth camera panning or subtle floating UI

---

## 🛒 SHOP SCREEN UI

Grid of ball cards.

**Each card shows:**
- Ball icon
- Name
- Price
- Ability (short description)
- "Buy / Equip" button depending on state

**Show player's money at the top** (e.g., "$148")

**Selected ball is highlighted**

---

## 🎮 IN-GAME UI

Gameplay screen includes:

- **Score** in top left
- **Money** (same as score) in top left or hidden until end
- **Current ball icon** top right
- **Hitbox circle** around the ball (semi-transparent)

---

## 📢 GAME FEEL / POLISH

To make the game feel satisfying:

### Effects to Add

- Bounce animation when clicking the ball
- Trail behind the ball when speed increases
- Screen shake on successful deflect (small)
- Glow effect when hitbox gets smaller

### Sound effects:

- Click deflect sound
- Wall bounce sound
- Goal loss sound
- Button clicks

---

**END OF DOCUMENT**
