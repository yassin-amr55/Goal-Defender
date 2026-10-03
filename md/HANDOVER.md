# HANDOVER

If you are picking up this project cold, read in this order:

1. **`IMPORTANT.md`** — the rules that have already cost real time
2. **`STATE.md`** — what is committed, what is dirty, what must not be pushed
3. **`DESCRIPTION.md`** — what the game actually is
4. **`ARCHITECTURE.md`** — how the code fits together
5. **`TESTING.md`** — how to verify anything you change

---

## What this project is

**Goal Defender** is a one-tap reflex game built in Phaser 3. You are a
goalkeeper. The ball falls toward your goal. You tap it. Every tap deflects it,
and the ball speeds up. Tap accurately enough and it goes forever. Tap sloppily
and it goes in.

There is no drag, no aim, no movement. One input: tap. The entire game is
holding a shrinking hitbox against an accelerating ball.

Live at https://yassin-amr55.itch.io/goal-defender.

**The interesting engineering is not the game.** It is that the whole thing is
vanilla JS with no build step, runs from a folder of files, and syncs to
Firebase with an offline-first model where the console is authoritative.

---

## The five things that will trip you up

### 1. The working tree is dirty and must not be pushed

See `STATE.md`. This is intentional. Ask before pushing.

### 2. Most "passing" input tests prove nothing

Any test that calls `.emit()` on a game object bypasses hit-testing and will
report a dead control as working. This hid a 203px layout bug for a full round
of testing. See `IMPORTANT.md` §6.

### 3. Container children use local coordinates

Adding to a container reinterprets `x`/`y` as local. If children were authored
in absolute scene coordinates, the container offset must be only the scroll
delta. See `IMPORTANT.md` §9.

### 4. Adding a ball touches six places

Shop data, ability case, three texture maps, the asset, the BootScene load, and
`BALL_COUNT`. See `IMPORTANT.md` §13. Two audits enforce it — run them.

### 5. Tournaments deliberately disable every ball ability

`TournamentGameScene` neutralises all 15 ability fields and forces
`jumpMultiplier = 1`. This is **correct**, not a bug. A tournament must be
winnable with the default ball or it is not a competition. Do not "fix" it.

---

## The two design problems worth fixing first

From the measured audit in `DESIGN.md`:

1. **`AchievementsScene` uses three font sizes inside a single list row** —
   10px, 11px and 13px. Ten items at each. That is not a type scale, and the
   10px floors at 5px on a small Android (F-13).
2. **There is no type scale anywhere.** 26 distinct font sizes across the app:
   10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 27, 30, 34, 36,
   40, 44, 46, 54, 58, 70, 82. A 6-step scale would fix the inconsistency and
   make "make this bigger" a safe operation instead of a guess.

---

## Working rhythm

```powershell
# 1. serve the game
Start-Process node "C:\Users\yassi\AppData\Local\Temp\opencode\gd-server.js" -WindowStyle Hidden

# 2. run every suite
foreach ($f in @("test-account","test-sync","test-deflections","layout-check",
  "static-check","audit-cross","audit-sim","audit-economy","audit-static",
  "audit-layout","audit-layout2","audit-radix","audit-abilities","audit-ball-assets")) {
  node "C:\Users\yassi\AppData\Local\Temp\opencode\$f.js"
}

# 3. syntax-check everything
Get-ChildItem -Recurse -Filter *.js |
  Where-Object { $_.FullName -notmatch 'node_modules|\.git\' } |
  ForEach-Object { node --check $_.FullName }
```

Open `http://127.0.0.1:8099/index.html?noleaderboard`.

**Always append `?noleaderboard`.** See `IMPORTANT.md` §3.

---

## Where the test scripts live

Not in the repo — in `%TEMP%\opencode\`. They are deliberately untracked, because
they are developer tooling, not product. They will not ship to itch; the build
allow-list in `build-itch-zip.js` excludes them.

If they are ever lost, they are the cheap part to rewrite. The
**invariants** they encode are the valuable part, and those are written down in
`TESTING.md` so they can be rebuilt even if the scripts are gone.
