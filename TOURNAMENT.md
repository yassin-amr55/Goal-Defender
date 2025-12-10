# 🏆 TOURNAMENT MODE - IMPLEMENTATION PLAN

## 📋 OVERVIEW
Tournament mode is a single-elimination bracket system where the player competes against AI opponents from Round of 16 to Finals. Each round requires more deflects to score a goal and advance.

---

## 🎮 MAIN MENU CHANGES

### Add Tournament Button
**Location:** Next to PLAY and SHOP buttons (horizontal layout)
**Positions:**
- PLAY button: (440, 420) - 250×80px
- SHOP button: (640, 420) - 250×80px  
- TOURNAMENT button: (840, 420) - 250×80px

**Tournament Button Design:**
- Size: 250×80px rectangle
- Color: Purple/Gold (#9933cc background, #ffcc00 border)
- **ICON ONLY:** Large trophy/cup emoji 🏆 or icon (60px size)
- No text, just the cup icon centered
- Depth: Same as other buttons

**Hover Effect:**
- Scale to 1.05
- Brighten color to #bb55ee
- Cup icon scales to 1.1

**Click Action:**
- Start TournamentMenuScene (NOT intro scene)

---

## 🎬 SCENE 1: TOURNAMENT MENU

### Scene: TournamentMenuScene

**Visual:**
- Same background as menu (stadium, ground, grass)
- Title: "TOURNAMENT MODE" at (640, 100)
  - 64px gold font with black stroke
  - Glow effect

**Top Right - Trophies Button:**
- Position: (1180, 50)
- Size: 120×60px
- Icon: 🏆 trophy icon (32px)
- Text: "TROPHIES" (18px)
- Color: Gold background (#ffcc00)
- Click: Opens TrophyRoomScene

**Tournament Selection (Center):**

### QUALIFIERS CUP CARD
- Position: (400, 350) - **UNDER "TOURNAMENT MODE" title**
- Container: 350×400px card
- Background: Silver/blue gradient (#4488cc)
- **Trophy icon: Use actual qualifiers-trophie.png image (scale 0.3)**
- Icon position: (400, 250) - top of card
- Title: "QUALIFIERS CUP" (32px bold white)
- Title position: (400, 340)
- Description: "Round of 16" (20px gray)
- Description position: (400, 370)
- Difficulty: "⭐⭐ Medium" (18px yellow)
- Difficulty position: (400, 400)
- Status: Always unlocked
- Button: "PLAY" (200×60px green)
  - Position: (400, 480)
  - Click: Start TournamentNameScene with 'qualifiers' mode

### CHAMPIONS CUP CARD
- Position: (880, 350) - **UNDER "TOURNAMENT MODE" title**
- Container: 350×400px card
- Background: Gold/red gradient (#cc6600)
- **Trophy icon: Use actual champions-trophie.png image (scale 0.3)**
- Icon position: (880, 250) - top of card
- Title: "CHAMPIONS CUP" (32px bold white)
- Title position: (880, 340)
- Description: "Round of 32" (20px gray)
- Description position: (880, 370)
- Difficulty: "⭐⭐⭐⭐ Very Hard" (18px yellow)
- Difficulty position: (880, 400)
- Status: Locked until Qualifiers Cup won
- **If Locked:**
  - Overlay: Semi-transparent black (alpha 0.6) over entire card
  - Lock icon: 🔒 (60px) centered at (880, 350)
  - Text: "Win Qualifiers Cup to unlock" (18px red) at (880, 420)
  - Button: Disabled/grayed out
- **If Unlocked:**
  - Button: "PLAY" (200×60px gold)
  - Position: (880, 480)
  - Click: Start TournamentNameScene with 'champions' mode

**Card Layout Summary:**
```
TOURNAMENT MODE (title at y=100)

[QUALIFIERS CUP CARD]    [CHAMPIONS CUP CARD]
     (x=400, y=350)           (x=880, y=350)
     
Each card contains:
- Trophy image at top (y=250)
- Title (y=340)
- Description (y=370) 
- Difficulty (y=400)
- PLAY button (y=480)
```

**Bottom Left - Infinite Mode Button:**
- Position: (150, 650)
- Size: 250×70px
- Background: Green (#00aa00)
- Border: Bright green (#00ff00)
- Text: "INFINITE MODE" (28px white)
- Icon: ♾️ infinity symbol
- Click: Trigger ball transition, then start GameScene (normal mode)

**Bottom Right - Back Button:**
- Position: (1130, 650)
- Size: 200×60px
- Background: Gray (#666666)
- Text: "BACK" (28px white)
- Click: Return to MenuScene

**Data Check on Scene Start:**
```javascript
// Check if Qualifiers Cup has been won
const qualifiersWon = localStorage.getItem('tournamentQualifiersWon') === 'true';
const championsWon = localStorage.getItem('tournamentChampionsWon') === 'true';

// Unlock Champions Cup if Qualifiers won
if (qualifiersWon) {
  championsCup.unlock();
}
```

---

## 🎬 SCENE 2: TROPHY ROOM

### Scene: TrophyRoomScene

**Visual:**
- Dark background (stadium background with dark overlay, alpha 0.9)
- Title at top: "TROPHIES: X / 2" at (640, 60)
  - 48px gold font with glow effect
  - X = number of trophies won (0, 1, or 2)

**Shelf Display:**
- Wooden shelf images displayed horizontally
- Two shelves for two trophies
- Shelf positions:
  - **Left Shelf:** (400, 400) - for Qualifiers Trophy
  - **Right Shelf:** (880, 400) - for Champions Trophy
- Shelf size: ~300px wide
- Shelf image: Use rectangle or load shelf asset if available

**Trophy Display:**

### Qualifiers Cup Trophy (Left)
- Position: (400, 320) - above left shelf
- Image: **assets/qualifiers-trophie.png**
- Scale: 0.4 (or adjust to fit nicely)
- Status:
  - **If Won:** Full color, normal alpha (1.0), subtle glow effect
  - **If Not Won:** Grayscale filter, dim (alpha 0.3), no glow
- Label below shelf: "QUALIFIERS CUP" (24px white)
- Date won (if won): "Won: MM/DD/YYYY" (16px gray) at (400, 480)

### Champions Cup Trophy (Right)
- Position: (880, 320) - above right shelf
- Image: **assets/champions-trophie.png**
- Scale: 0.4 (or adjust to fit nicely)
- Status:
  - **If Won:** Full color, normal alpha (1.0), golden glow effect, sparkle particles
  - **If Not Won:** Grayscale filter, dim (alpha 0.3), no effects
- Label below shelf: "CHAMPIONS CUP" (24px white)
- Date won (if won): "Won: MM/DD/YYYY" (16px gray) at (880, 480)

**Trophy Stats (When Hovering or Below):**
- Display stats below each trophy (if won)
- Position: Below date
- Font: 14px white
- Stats:
  - "Total Deflects: X"
  - "Money Earned: $X"

**Back Button:**
- Position: (640, 650)
- Size: 200×60px
- Background: Gray (#666666)
- Text: "BACK" (32px white)
- Click: Return to TournamentMenuScene

**Assets to Load:**
```javascript
// In BootScene.js preload()
this.load.image('qualifiers-trophy', 'assets/qualifiers-trophie.png');
this.load.image('champions-trophy', 'assets/champions-trophie.png');
```

**Data Storage:**
```javascript
// Trophy data
'tournamentQualifiersWon' // Boolean
'tournamentQualifiersDate' // Date string
'tournamentQualifiersStats' // JSON: { deflects, money }
'tournamentChampionsWon' // Boolean
'tournamentChampionsDate' // Date string
'tournamentChampionsStats' // JSON: { deflects, money }
```

---

## 🎬 SCENE 3: TEAM NAME INPUT

### Scene: TournamentNameScene

**Receives Parameter:** tournamentMode ('qualifiers' or 'champions')

**Visual:**
- Same background
- Title: "ENTER YOUR TEAM NAME" at (640, 200)
  - 48px white font with black stroke
- Text input box at (640, 360)
  - 500×80px white rectangle with black border (4px)
  - Placeholder text: "Your Team Name..." in gray
  - Max length: 20 characters
  - Font: 32px black

**Implementation:**
- Use HTML input element overlaid on canvas
- Position: absolute, centered
- Style to match game aesthetic
- Focus on scene start

**Tournament Mode Display:**
- Show which tournament: "QUALIFIERS CUP" or "CHAMPIONS CUP" at (640, 150)
- 32px font, color based on tournament (silver/gold)

**Buttons:**
- **START TOURNAMENT** button at (640, 480)
  - 300×70px green rectangle
  - 42px white text
  - Only enabled when name length > 0
  - Click: Save team name, start TournamentBracketScene with mode
  
- **BACK** button at (640, 570)
  - 200×60px gray rectangle
  - 32px white text
  - Click: Return to TournamentMenuScene

**Data Storage:**
- Save team name: `localStorage.setItem('tournamentTeamName', name)`
- Save mode: `localStorage.setItem('tournamentMode', mode)` // 'qualifiers' or 'champions'

---

## 🎬 SCENE 4: TOURNAMENT BRACKET

### Scene: TournamentBracketScene

**Receives Parameter:** tournamentMode ('qualifiers' or 'champions')

**Visual Layout:**
- Background: stadium with darker overlay (alpha 0.8)
- Tournament title at top: "QUALIFIERS CUP" or "CHAMPIONS CUP" at (640, 30)
  - 48px font, color based on mode (silver/gold)
- Current round below: "ROUND OF 16" or "ROUND OF 32" at (640, 80)
  - 40px yellow font with black stroke

**Bracket Display:**

### QUALIFIERS CUP (Round of 16)
- Show 16 teams
- 4 columns: R16 → QF → SF → F
- 8 matches in R16, 4 in QF, 2 in SF, 1 in F

### CHAMPIONS CUP (Round of 32)
- Show 32 teams
- 5 columns: R32 → R16 → QF → SF → F
- 16 matches in R32, 8 in R16, 4 in QF, 2 in SF, 1 in F
- Smaller text/spacing to fit all teams

**Match Display:**
- Each match shown as:
  ```
  Team A
  vs
  Team B
  ```
- Player's team highlighted in gold/yellow
- Completed matches show winner in green
- Current match highlighted with pulsing border
- Future matches grayed out

**Team Name Generation:**
- 100 unique team names in array
- **Qualifiers Cup:** Randomly select 15 names (player is 16th)
- **Champions Cup:** Randomly select 31 names (player is 32nd)
- No duplicates allowed
- Shuffle and assign to bracket positions

**Team Names Array (100 names):**
```javascript
const teamNames = [
  "Thunder Strikers", "Golden Eagles", "Fire Dragons", "Ice Wolves",
  "Storm Chasers", "Lightning Bolts", "Shadow Hunters", "Crimson Tide",
  "Blue Sharks", "Green Hornets", "Silver Bullets", "Black Panthers",
  "Red Devils", "White Knights", "Purple Reign", "Orange Crush",
  "Mighty Ducks", "Wild Cats", "Brave Lions", "Swift Falcons",
  "Iron Giants", "Steel Warriors", "Bronze Titans", "Copper Kings",
  "Diamond Aces", "Platinum Stars", "Gold Rush", "Silver Lining",
  "Neon Ninjas", "Cyber Samurai", "Pixel Pirates", "Digital Demons",
  "Quantum Quakes", "Atomic Atoms", "Nuclear Knights", "Fusion Force",
  "Velocity Vipers", "Turbo Tigers", "Nitro Nomads", "Rocket Rangers",
  "Blaze Brigade", "Inferno Icons", "Flame Fighters", "Heat Hawks",
  "Frost Foxes", "Glacier Guardians", "Arctic Avengers", "Polar Predators",
  "Ocean Outlaws", "Wave Warriors", "Tide Turners", "Sea Serpents",
  "Mountain Mavericks", "Peak Performers", "Summit Seekers", "Valley Victors",
  "Desert Drifters", "Dune Defenders", "Sand Storms", "Oasis Owls",
  "Forest Phantoms", "Jungle Jaguars", "Tree Titans", "Leaf Legends",
  "Urban Uprising", "City Slickers", "Metro Maniacs", "Town Terrors",
  "Cosmic Crusaders", "Galaxy Gladiators", "Star Strikers", "Nebula Knights",
  "Mystic Magicians", "Wizard Warriors", "Sorcerer Squad", "Enchanted Elite",
  "Royal Raptors", "Imperial Icons", "Dynasty Defenders", "Kingdom Keepers",
  "Rebel Renegades", "Outlaw Owls", "Rogue Raiders", "Bandit Brigade",
  "Phoenix Rising", "Dragon Dynasty", "Griffin Guards", "Pegasus Power",
  "Venom Vipers", "Cobra Crew", "Python Pack", "Anaconda Army",
  "Hawk Heroes", "Eagle Empire", "Falcon Force", "Owl Order",
  "Wolf Warriors", "Bear Battalion", "Tiger Troops", "Lion Legion",
  "Shark Squadron", "Dolphin Defenders", "Whale Warriors", "Octopus Order",
  "Scorpion Strike", "Spider Squad", "Mantis Militia", "Beetle Brigade"
];
```

**Bracket Structure:**

### Qualifiers Cup (16 teams):
```javascript
const qualifiersBracket = {
  roundOf16: [
    { team1: "Player Team", team2: "Thunder Strikers", winner: null },
    // ... 7 more matches (8 total)
  ],
  quarterFinals: [
    { team1: null, team2: null, winner: null },
    // ... 3 more matches (4 total)
  ],
  semiFinals: [
    { team1: null, team2: null, winner: null },
    { team1: null, team2: null, winner: null }
  ],
  finals: {
    team1: null, team2: null, winner: null
  }
};
```

### Champions Cup (32 teams):
```javascript
const championsBracket = {
  roundOf32: [
    { team1: "Player Team", team2: "Thunder Strikers", winner: null },
    // ... 15 more matches (16 total)
  ],
  roundOf16: [
    { team1: null, team2: null, winner: null },
    // ... 7 more matches (8 total)
  ],
  quarterFinals: [
    { team1: null, team2: null, winner: null },
    // ... 3 more matches (4 total)
  ],
  semiFinals: [
    { team1: null, team2: null, winner: null },
    { team1: null, team2: null, winner: null }
  ],
  finals: {
    team1: null, team2: null, winner: null
  }
};
```

**PLAY Button:**
- Bottom center (640, 650)
- 280×70px green rectangle
- "PLAY MATCH" in 42px white font
- Only enabled when it's player's turn
- Click: Start TournamentGameScene with current opponent

**Data Storage:**
- `localStorage.setItem('tournamentBracket', JSON.stringify(bracket))`
- `localStorage.setItem('tournamentMode', mode)` // 'qualifiers' or 'champions'
- `localStorage.setItem('tournamentRound', round)` // 'roundOf32', 'roundOf16', 'quarterFinals', 'semiFinals', 'finals'
- `localStorage.setItem('tournamentProgress', JSON.stringify(progress))`

---

## 🎬 SCENE 5: TOURNAMENT GAME

### Scene: TournamentGameScene

**Receives Parameters:** 
- tournamentMode ('qualifiers' or 'champions')
- currentRound (string)
- opponentName (string)

**Game Setup:**
- **TWO GOALS:** Left (yours) and Right (opponent's - flipped horizontally)
- **NO AI OPPONENT:** Just you vs the ball
- **NO WALLS:** Only goals on each side
- Ball deflects in front of right goal (20px before entering)
- Keep deflecting until you reach required SCORE
- Once score reached, ball can enter right goal = WIN
- If you miss, ball enters your left goal = LOSE

**Visual Layout:**
- Background: stadium, ground, grass (same as normal game)
- **Left Goal (Yours):** At (80, groundY)
  - Normal goal sprite
  - If ball enters = YOU LOSE
- **Right Goal (Opponent's):** At (1200, groundY)
  - Flipped horizontally (mirrored)
  - Ball deflects 20px in front until score reached
  - Once score reached, ball can enter = YOU WIN
- **NO WALLS** - only goals

**Ball Mechanics:**
- Starts at center (640, 400)
- Initial direction: random (left or right)
- Speed: 300 px/s (same as normal game)
- Gravity: 500 px/s²
- Bounces off ground
- **Invisible barrier 20px in front of right goal:**
  - Ball deflects back when hitting this barrier
  - Barrier only active UNTIL score requirement met
  - Once score reached, barrier removed, ball can enter goal
- **No barrier on left goal:**
  - Ball can always enter left goal (your goal)
  - If it enters = you lose

**Scoring System:**

### QUALIFIERS CUP (Score needed to WIN match):
- **Round of 16:** Need 20 score to win
- **Quarter Finals:** Need 30 score to win
- **Semi Finals:** Need 40 score to win
- **Finals:** Need 50 score to win

### CHAMPIONS CUP (Harder - Score needed to WIN match):
- **Round of 32:** Need 30 score to win
- **Round of 16:** Need 40 score to win
- **Quarter Finals:** Need 50 score to win
- **Semi Finals:** Need 60 score to win
- **Finals:** Need 70 score to win

**Score Counter:**
- Tracks your score (increases with each deflect)
- Display: "Score: X / Y" (Y = required to win)
- When score reaches required amount:
  - Invisible barrier in front of right goal is REMOVED
  - Ball can now enter right goal
  - When ball enters right goal = VICTORY!
  - Advance to next round

**Hitbox System:**
- Same as normal game
- Starts at 120px radius
- Shrinks 15px every 20 seconds
- Minimum: ball radius
- Countdown display: "Hitbox shrinks in: Xs"

**Speed Boost:**
- Same as normal game
- Display: "Speed Boost: X%"
- Increases with each deflect
- Max 300%

**Player Controls:**
- Click ball when:
  - Ball is within hitbox radius
  - Ball is clickable (same rules as normal game)
- On successful click:
  - Ball deflects (reverses direction)
  - Score increases by 1
  - Speed increases
  - Continue until reaching required score
- **If you miss:**
  - Ball continues toward your goal (left)
  - Ball enters your goal = YOU LOSE

**NO AI OPPONENT:**
- No opponent trying to deflect
- Ball has invisible barrier 20px in front of right goal
- Barrier deflects ball back until score requirement met
- You keep playing until you reach required score
- Once score reached, barrier removed, ball can enter right goal to win

**Win Condition:**
1. Reach required SCORE for current round (e.g., 20 for Round of 16)
2. Invisible barrier in front of right goal is removed
3. Ball enters right goal (opponent's goal)
4. Victory animation plays
5. Advance to next round

**Lose Condition:**
- Ball enters YOUR goal (left goal) at any time
- Game over, tournament ends
- If Champions Cup: locks again

**UI Elements:**
- **Top Left:**
  - Speed boost: "Speed Boost: X%"
  - Hitbox countdown: "Hitbox shrinks in: Xs"
  
- **Top Center:**
  - Round name: "ROUND OF 16" (or current round)
  - Team name: "YOUR TEAM NAME"
  
- **Top Right:**
  - **Score counter: "Score: X / Y"** (Y = required to win)
  - Mute button below score

**Victory Animation:**
- Ball enters right goal (opponent's goal)
- Screen shake (500ms, 0.01 intensity)
- Confetti particles (50 particles, gold/yellow)
- "MATCH WON!" text appears (72px gold font)
- Score display: "Score: X / Y ✓"
- Money earned display: "+$X"
- Fade to black after 2 seconds
- Return to TournamentBracketScene
- Update bracket with win

**Defeat Animation:**
- Ball enters left goal (your goal)
- Explosion at left goal
- "DEFEATED!" text (72px red font)
- Tournament ends
- Show final placement (which round you lost in)
- **If Champions Cup:** Lock it again (set 'tournamentChampionsWon' to false)
- Return to TournamentMenuScene

---

## 🎬 SCENE 6: TOURNAMENT VICTORY

### Scene: TournamentVictoryScene

**Triggered When:** Player wins Finals

**Receives Parameter:** tournamentMode ('qualifiers' or 'champions')

**Visual:**
- Background: stadium with bright overlay
- Giant trophy icon/image at center
- Fireworks/confetti particles
- "TOURNAMENT CHAMPION!" at (640, 150)
  - 80px gold font with glow effect
  - Pulsing animation

**Stats Display:**
- Tournament won: "QUALIFIERS CUP" or "CHAMPIONS CUP"
- Team name: "YOUR TEAM NAME"
- Total deflects: X
- Total money earned: $X
- Tournament bonus: Based on mode

**Rewards:**

### QUALIFIERS CUP:
- Base money: Score from all matches
- Tournament bonus: $500
- **Unlock Champions Cup**
- Save: `localStorage.setItem('tournamentQualifiersWon', 'true')`

### CHAMPIONS CUP:
- Base money: Score from all matches
- Tournament bonus: $1000
- Special achievement unlocked
- Save: `localStorage.setItem('tournamentChampionsWon', 'true')`

**Trophy Data Saved:**
```javascript
const trophyData = {
  date: new Date().toLocaleDateString(),
  deflects: totalDeflects,
  money: totalMoney,
  time: totalTime
};

if (mode === 'qualifiers') {
  localStorage.setItem('tournamentQualifiersDate', trophyData.date);
  localStorage.setItem('tournamentQualifiersStats', JSON.stringify(trophyData));
} else {
  localStorage.setItem('tournamentChampionsDate', trophyData.date);
  localStorage.setItem('tournamentChampionsStats', JSON.stringify(trophyData));
}
```

**Buttons:**
- **VIEW TROPHIES** (640, 500)
  - Opens TrophyRoomScene
- **TOURNAMENT MENU** (640, 590)
  - Return to TournamentMenuScene
- **HOME** (640, 680)
  - Return to MenuScene

---

## 💾 DATA PERSISTENCE

### LocalStorage Keys:

```javascript
// Tournament data
'tournamentTeamName' // String: player's team name
'tournamentMode' // String: 'qualifiers' or 'champions'
'tournamentBracket' // JSON: full bracket structure
'tournamentRound' // String: 'roundOf32', 'roundOf16', 'quarterFinals', 'semiFinals', 'finals'
'tournamentProgress' // JSON: { matchesWon: 0, totalDeflects: 0, moneyEarned: 0 }
'tournamentActive' // Boolean: is tournament in progress

// Trophy data
'tournamentQualifiersWon' // Boolean: has player won Qualifiers Cup
'tournamentQualifiersDate' // String: date won
'tournamentQualifiersStats' // JSON: { deflects, money, time }
'tournamentChampionsWon' // Boolean: has player won Champions Cup
'tournamentChampionsDate' // String: date won
'tournamentChampionsStats' // JSON: { deflects, money, time }

// Existing data
'goalDefenderMoney' // Updated with tournament earnings
'goalDefenderHighScore' // Can be updated during tournament
'goalDefenderEquippedBall' // Used in tournament matches
'goalDefenderOwnedBalls' // Available for purchase
'goalDefenderMuted' // Sound setting
```

---

## 🎨 ASSETS NEEDED

### New Assets:
- **trophy.png** or use emoji 🏆 - Trophy/cup icon for tournament button
- **lock.png** or emoji 🔒 - Lock icon for locked tournament
- **infinity.png** or emoji ♾️ - Infinity mode icon
- **shelf.png** (optional) - Wooden shelf for trophy room, or use rectangle

### Existing Assets Used:
- **qualifiers-trophie.png** - Qualifiers Cup trophy image
- **champions-trophie.png** - Champions Cup trophy image
- ball.png - For transition animation
- background.png, ground.png, grass.png - All scenes
- goal.png - Player's goal (left side), flipped for right goal
- wall.png - Not used in tournament (no walls)
- All ball skins - Available in tournament
- volume icons - Mute button

---

## 📝 IMPLEMENTATION CHECKLIST

### Phase 1: Menu Integration
- [x] Reposition PLAY, SHOP, TOURNAMENT buttons (vertical PLAY/SHOP, circular TOURNAMENT next to)
- [x] Add TOURNAMENT button with SVG cup icon (not emoji)
- [x] Implement button hover/click effects
- [x] Link to TournamentMenuScene

### Phase 2: Tournament Menu Scene
- [x] Create TournamentMenuScene
- [x] Add "TOURNAMENT MODE" title at (640, 100)
- [x] Create Qualifiers Cup card at (400, 350) - UNDER title
- [x] Use qualifiers-trophie.png image (not emoji) at top of card
- [x] Create Champions Cup card at (880, 350) - UNDER title  
- [x] Use champions-trophie.png image (not emoji) at top of card
- [x] Add lock overlay and unlock logic for Champions Cup
- [x] Add TROPHIES button (top right)
- [x] Add INFINITE MODE button (bottom center, styled nicely)
- [x] Remove BACK button (INFINITE MODE goes to MenuScene)
- [x] Implement unlock check on scene start

### Phase 3: Trophy Room Scene
- [x] Create TrophyRoomScene
- [x] Load trophy images (qualifiers-trophie.png, champions-trophie.png)
- [x] Display "TROPHIES: X / 2" title at top
- [x] Create two shelf displays (left and right)
- [x] Display Qualifiers trophy on left shelf
- [x] Display Champions trophy on right shelf
- [x] Implement grayscale filter for unwon trophies (alpha 0.3)
- [x] Add glow effect for won trophies
- [x] Add sparkle particles for Champions trophy (if won)
- [x] Show trophy labels below shelves
- [x] Show date won (if won)
- [x] Show trophy stats (deflects, money)
- [x] Add BACK button
- [x] Load trophy data from localStorage

### Phase 4: Team Name Input
- [x] Create TournamentNameScene
- [x] Add HTML input element overlay
- [x] Style input to match game
- [x] Implement START TOURNAMENT button
- [x] Implement BACK button
- [x] Save team name to localStorage
- [x] Link to TournamentBracketScene

- [x] Pass tournament mode to scene
- [x] Display tournament mode name
- [x] Link to TournamentBracketScene with mode

### Phase 5: Bracket Generation
- [x] Create TournamentBracketScene
- [x] Create 100 team names array
- [x] Implement random team selection (no duplicates)
- [x] Generate bracket structure (16 teams)
- [x] Display bracket visually (4 columns) (initial renderer)
- [x] Highlight player's team (basic)
- [x] Show current round name
- [x] Implement PLAY button (starts match)
- [x] Save bracket to localStorage

- [x] Handle both 16-team and 32-team brackets (basic)
- [x] Adjust layout for Champions Cup (5 columns) (fallback renderer)
- [x] Display tournament mode name

### Phase 6: Ball Transition Animation
- [x] Create ball rolling transition (left to right)
- [x] Ball scale 0.5, rotation 720°, 2 seconds
- [x] Trigger before entering Infinite Mode (can be reused)
- [x] Trigger before entering Tournament Game
- [x] Smooth fade in to next scene (basic)

### Phase 7: Tournament Game
- [x] Create TournamentGameScene
- [x] Add TWO goals (left and right)
- [x] Flip right goal horizontally (mirror it)
- [x] NO WALLS - only goals
- [x] Create invisible barrier 20px in front of right goal
- [x] Barrier deflects ball back (like wall collision)
- [x] Add score counter system (top right)
- [x] Display "Score: X / Y" where Y = required to win
- [x] Set required scores per round:
  - [x] Qualifiers: 20/30/40/50
  - [x] Champions: 30/40/50/60/70
- [x] When score reaches requirement:
  - [x] Remove invisible barrier
  - [x] Allow ball to enter right goal
- [x] Implement victory condition (ball enters right goal after score reached)
- [x] Implement defeat condition (ball enters left goal at any time)
- [x] Add victory animation (basic flow + victory scene)
- [x] Add defeat animation (basic flow: end tournament and return to menu)
- [x] Update bracket after match (basic advancement)
- [x] Return to TournamentBracketScene
- [x] Handle Round of 32 for Champions Cup
- [x] Lock Champions Cup on defeat

### Phase 7.1: Tournament Game - Missing Features (CRITICAL FIXES NEEDED)
**PROBLEM: Tournament game is missing core infinite mode features!**

#### Missing Features That Must Be Added:
- [ ] **Sound Effects:**
  - [ ] Click sound when deflecting ball (playClickSound())
  - [ ] Bounce sound when ball hits ground/barrier (playBounceSound())
  - [ ] Explosion sound when ball enters goal (playExplosionSound())
- [ ] **Ball Physics & Behavior:**
  - [ ] Ball trail particles (same as infinite mode)
  - [ ] Screen shake on deflect (100ms, 0.005 intensity)
  - [ ] Ball height restriction (can't go above goal height)
  - [ ] Ground collision and bouncing
  - [ ] Proper ball gravity (500 px/s²)
- [ ] **Hitbox System:**
  - [ ] Visible hitbox circle around ball
  - [ ] Hitbox shrinking every 20 seconds
  - [ ] Hitbox countdown timer display
  - [ ] Middle line (ball only clickable left of x=640)
- [ ] **Speed System:**
  - [ ] Speed boost display ("Speed Boost: X%")
  - [ ] Speed increases 4% per deflect (0-100%), then 2% (100-300%)
  - [ ] Ball speed affects trail visibility
- [ ] **Visual Effects:**
  - [ ] Score text scaling animation on increment
  - [ ] Particle explosion when ball enters goal
  - [ ] Proper victory/defeat animations with effects
- [ ] **Ball Abilities:**
  - [ ] Load equipped ball from localStorage
  - [ ] Apply ball ability modifiers (speed, hitbox, score)
- [ ] **Barrier Position Fix:**
  - [ ] Barrier should be 20px LEFT of right goal (x=1180)
  - [ ] NOT 20px from right side of window

#### Tournament game should feel IDENTICAL to infinite mode with only:
1. Two goals instead of goal + wall
2. Score requirement system
3. Barrier removal when score reached
4. Tournament-specific UI

### Phase 8: Tournament Victory
- [x] Create TournamentVictoryScene
- [x] Add trophy display
- [x] Add fireworks/confetti (if particle texture exists)
- [x] Show tournament stats
- [x] Calculate and award bonus money (saved progress)
- [x] Implement PLAY AGAIN / CONTINUE button (returns to menu)
- [x] Implement HOME button (available via menu)
- [x] Clear tournament data on completion (marks inactive and saves stats)

### Phase 7: Data Management
- [x] Implement tournament save/load system (localStorage)
- [x] Handle tournament interruption (basic: tournamentActive flag saved)
- [x] Clear tournament data on exit (tournamentActive=false on end)
- [x] Update money after each match
- [x] Track tournament progress (matchesWon, totalDeflects, moneyEarned)

### Phase 9: Polish
- [ ] Add sound effects for tournament events
- [ ] Add transition animations between scenes
- [ ] Test all rounds (R16, QF, SF, F)
- [ ] Test AI difficulty scaling
- [ ] Test bracket progression
- [ ] Test edge cases (lose first match, win tournament)
- [ ] Optimize performance

---

## 🎯 TOURNAMENT COMPARISON

| Feature              | QUALIFIERS CUP        | CHAMPIONS CUP           |
|----------------------|-----------------------|-------------------------|
| **Starting Round**   | Round of 16 (16 teams)| Round of 32 (32 teams)  |
| **Unlock Status**    | Always unlocked       | Locked until Qualifiers won |
| **Difficulty**       | ⭐⭐ Medium           | ⭐⭐⭐⭐ Very Hard      |
| **Victory Bonus**    | $500                  | $1000                   |
| **Lock on Defeat**   | No                    | Yes (must win Qualifiers again) |

## 🎯 ROUND REQUIREMENTS

### QUALIFIERS CUP:
| Round           | Score Needed to Win |
|-----------------|---------------------|
| Round of 16     | 20                  |
| Quarter Finals  | 30                  |
| Semi Finals     | 40                  |
| Finals          | 50                  |
| **Victory Bonus** | **+$500**         |

### CHAMPIONS CUP (Harder):
| Round           | Score Needed to Win |
|-----------------|---------------------|
| Round of 32     | 30                  |
| Round of 16     | 40                  |
| Quarter Finals  | 50                  |
| Semi Finals     | 60                  |
| Finals          | 70                  |
| **Victory Bonus** | **+$1000**        |

---

## 🔧 TECHNICAL NOTES

### Ball Deflection Logic:
```javascript
// Player clicks ball
if (clickWithinHitbox && ballMovingLeft) {
  // Deflect toward RIGHT goal (opponent's)
  ball.setVelocity(ballSpeed, upwardSpeed);
  deflectCounter++;
  
  // Check if goal reached
  if (deflectCounter >= requiredDeflects) {
    allowGoal = true; // Ball can now enter opponent's goal
  }
}

// AI deflection check
if (ball.x > 900 && ballMovingRight) {
  const aiDeflectChance = getAIDifficulty(currentRound);
  if (Math.random() < aiDeflectChance) {
    // AI deflects back toward player
    ball.setVelocity(-ballSpeed, randomUpwardSpeed);
    // deflectCounter does NOT increase
  }
}

// Goal detection
if (ball.x > 1200 && allowGoal) {
  // Player scores! Victory!
  triggerVictory();
} else if (ball.x < 80) {
  // Player's goal scored on - Defeat!
  triggerDefeat();
}
```

### Bracket Progression:
```javascript
// After winning a match
function advanceBracket(playerTeam, opponentTeam) {
  // Mark winner in current round
  currentMatch.winner = playerTeam;
  
  // Move to next round
  if (currentRound === 'roundOf16') {
    // Add to quarter finals
    nextRound = 'quarterFinals';
    nextOpponent = getNextOpponent(bracket.quarterFinals);
  } else if (currentRound === 'quarterFinals') {
    nextRound = 'semiFinals';
    nextOpponent = getNextOpponent(bracket.semiFinals);
  } else if (currentRound === 'semiFinals') {
    nextRound = 'finals';
    nextOpponent = getNextOpponent(bracket.finals);
  } else if (currentRound === 'finals') {
    // Tournament won!
    triggerTournamentVictory();
  }
  
  // Save progress
  localStorage.setItem('tournamentRound', nextRound);
  localStorage.setItem('tournamentBracket', JSON.stringify(bracket));
}
```

---

**END OF TOURNAMENT MODE SPECIFICATION**
