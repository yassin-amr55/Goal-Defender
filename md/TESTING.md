# TESTING

14 suites. They live in `%TEMP%\opencode\`, **not** in the repo — they are
developer tooling, and the itch build allow-list excludes them anyway.

```powershell
Start-Process node "C:\Users\yassi\AppData\Local\Temp\opencode\gd-server.js" -WindowStyle Hidden
# http://127.0.0.1:8099/index.html?noleaderboard
```

Run everything:

```powershell
$fail = 0
foreach ($f in @("test-account","test-sync","test-deflections","layout-check",
  "static-check","audit-cross","audit-sim","audit-economy","audit-static",
  "audit-layout","audit-layout2","audit-radix","audit-abilities","audit-ball-assets")) {
  node "C:\Users\yassi\AppData\Local\Temp\opencode\$f.js"
  if ($LASTEXITCODE -ne 0) { $fail++ }
}
"failing: $fail"
```

Syntax-check everything:

```powershell
Get-ChildItem -Recurse -Filter *.js |
  Where-Object { $_.FullName -notmatch 'node_modules|\.git\' } |
  ForEach-Object { node --check $_.FullName }
```

---

## The suites

| Suite | Proves |
|---|---|
| `test-account.js` | Auth round-trip, save sync, identity retirement (39) |
| `test-sync.js` | Cloud reconciliation, console authority (36) |
| `test-deflections.js` | Deflection accounting adds up exactly |
| `layout-check.js` | Panel geometry contains every control, both auth states |
| `static-check.js` | Source invariants — see below |
| `audit-cross.js` | 57 cross-module consistency checks |
| `audit-sim.js` | 29 simulation checks |
| `audit-economy.js` | 18 economy checks (2 warnings, known) |
| `audit-static.js` | Every save key is read somewhere |
| `audit-layout.js` | Geometry invariants |
| `audit-layout2.js` | Second-pass geometry |
| `audit-radix.js` | Number formatting |
| `audit-abilities.js` | 0 dead fields, 0 unwired, tournament parity |
| `audit-ball-assets.js` | Every texture exists, loads, and matches a shop ball |

---

## Invariants worth preserving

These are the valuable part. If the scripts are lost, rebuild them from this
list — they are what stopped real bugs.

1. Shop ball count **==** `BALL_COUNT` in `achievements.js`. Otherwise Full
   Rack is unreachable.
2. `SAVE_KEYS.length ≤ rules cap − 5`.
3. No unused entries in `METRICS`.
4. Every purchasable ball has a `case` in `loadBallAbilities()`.
5. Every `this.load.image` path **resolves on disk**.
6. Ball texture paths use **hyphens**; texture **keys** use underscores.
7. No orphaned ball art in `assets/balls/`.
8. All three `getBallTexture()` maps cover every ball.
9. Panel geometry contains every control in both sign-in states.
10. `TournamentGameScene` neutralises every ability field.
11. Settings viewport sits inside the canvas and clears the title.
12. `content.y` does not add `viewTop` to already-absolute coordinates.

---

## In-browser input testing

**Read `IMPORTANT.md` §6 before writing any of this.** The short version:

```js
window.__S = function (n) {
  for (var i = 0; i < n; i++) {
    window.__t = (window.__t || 0) + 16.67;
    window.game.step(window.__t, 16.67);
  }
};

window.__MT = function (wx, wy, type, buttons) {
  var cv = window.game.canvas, r = cv.getBoundingClientRect();
  var x = r.left + (wx / 1280) * r.width;
  var y = r.top + (wy / 720) * r.height;
  cv.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
    clientX: x, clientY: y, button: 0, buttons: buttons }));
};

window.__click = function (wx, wy) {
  window.__MT(wx, wy, 'mousemove', 0); window.__S(1);
  window.__MT(wx, wy, 'mousedown', 1); window.__S(2);
  window.__MT(wx, wy, 'mouseup', 0);   window.__S(6);
};

window.__wheel = function (wx, wy, dy) {
  var cv = window.game.canvas, r = cv.getBoundingClientRect();
  var x = r.left + (wx / 1280) * r.width;
  var y = r.top + (wy / 720) * r.height;
  cv.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true,
    clientX: x, clientY: y, deltaY: dy }));
  window.__S(4);
};
```

**Get world coordinates from the live scene, never from the source.** Assuming
coordinates is exactly what hid the 203px bug:

```js
var sc = game.scene.getScene('SettingsScene');
var ys = sc.rows.map(r => r.y + sc.content.y);   // rendered, not authored
```

Phaser uses `MouseEvent`, not `PointerEvent`. Wheel needs a real `WheelEvent`.

---

## Screenshots

`browser.screenshot` needs a visible desktop window. Don't depend on it — read
the canvas and download it (`IMPORTANT.md` §7):

```js
window.__shot = function (key) {
  var g = window.game;
  g.scene.getScenes(true).forEach(s => g.scene.stop(s.scene.key));
  g.scene.start(key); window.__S(90);
  g.step((window.__t = (window.__t || 0) + 16.67), 16.67);
  return g.canvas.toDataURL('image/png');
};
window.__dl = name => { /* anchor click */ };
```

Files land in `%TEMP%\opencode-browser-client-*\file_*\`, **not** Downloads:

```powershell
Get-ChildItem "$env:TEMP\opencode-browser-client-*" -Filter "*.png" -Recurse |
  Select-Object -First 1 | Copy-Item -Destination "$env:TEMP\opencode\shots\out.png"
```

---

## Live browser session

Useful helpers, re-installed after every reload:

```js
window.__S       // step the game loop by hand
window.__walk    // collect visible Text objects with position + font size
window.__grab    // start a scene, step, collect its text
window.__grab2   // same, plus colour (for contrast checks)
window.__shot    // render a scene to a PNG data URL
window.__dl      // download that data URL
```

---

## Smoke checklist before shipping

- [ ] All 14 suites exit 0
- [ ] Every `.js` parses
- [ ] All 17 scenes boot with zero console errors
- [ ] All 20 balls equip, render their **own** texture, and deflect
- [ ] All 5 settings toggles round-trip
- [ ] Achievements claim and persist
- [ ] Sign-in carries stats and deletes the anonymous row
- [ ] Console edit is adopted over local state
- [ ] Settings: every control clickable, drag does not toggle, overflow scrolls
- [ ] 32-team Champions bracket fits
- [ ] Rebuild the itch zip **from a clean tree**, verify entry count and size
