# IMPORTANT — hard rules

These have each already caused a real problem. Breaking one again costs more
than reading this file costs.

---

## 1. Never filter the leaderboard by minimum score

**The rule:** show *every* row. No `where('score', '>=', X)`, no minimum-score
threshold, ever.

**Why:** it was read once as a request to hide weak entries. That was a
misunderstanding. The intent is that **the developer** must not publish test
accounts with inflated scores — not that the game hides anyone.

**How it actually works:** test accounts get deleted by hand after QA. The
leaderboard renders all rows it is given, including 0.

---

## 2. No test account may hold a score above 10

**The rule:** any throwaway account used for QA must finish with a score ≤ 10.
The row gets deleted afterwards regardless.

---

## 3. Always capture QA with `?noleaderboard`

**The rule:** every screenshot and test capture uses the query flag.
`http://127.0.0.1:8099/index.html?noleaderboard`

Without it a QA session can write to the live board.

---

## 4. `browser.evaluate` does not await promises

**The rule:** never `return somePromise` and expect the result. Kick the work
off, store the answer on a `window.__x` variable, then read it in a second call.

```js
// WRONG - returns [object Promise]
fetch(url).then(r => r.json())

// RIGHT
window.__r = null; fetch(url).then(r => r.json()).then(d => window.__r = d)
// ...later, second evaluate:
window.__r
```

---

## 5. Phaser in a backgrounded tab throttles `requestAnimationFrame`

**The rule:** drive the game loop by hand in tests.

```js
window.__S = function (n) {
  for (var i = 0; i < n; i++) {
    window.__t = (window.__t || 0) + 16.67;
    window.game.step(window.__t, 16.67);
  }
};
```

Driving the scene manager directly instead of calling `create()`? Also call
`game.scene.processQueue()` or the start is deferred and nothing happens.

---

## 6. Emitting events on a game object proves nothing

**This is the single most expensive trap in this project.**

A test that does `zone.emit('pointerup', ...)` will pass whether or not the
control is actually clickable, because it **bypasses hit-testing entirely**. It
proves the handler runs, not that a player can reach it.

**The rule:** input tests must dispatch real DOM events at real screen
coordinates.

```js
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
```

**Two gotchas that cost hours:**

- Phaser uses **`MouseEvent`**, not `PointerEvent`, in this build. Dispatching
  pointer events does nothing and the scene never sees the click.
- Coordinates must be **world** coordinates mapped through the canvas bounding
  rect, because the canvas is CSS-scaled and letterboxed.

This exact trap hid a 203px layout bug for an entire round of testing: the
switches were rendered 203px away from where the test clicked them, hit-testing
found nothing, and the fake-event test reported all five as working.

---

## 7. Screenshots need a visible tab

`browser.screenshot` fails with *"Screenshot needs a visible tab"* unless the
browser's desktop window is focused and visible.

**The rule:** don't rely on it. Read the WebGL canvas directly and download it:

```js
window.__shot = function (key) {
  var g = window.game;
  g.scene.getScenes(true).forEach(s => g.scene.stop(s.scene.key));
  g.scene.start(key); window.__S(90);
  g.step((window.__t = (window.__t || 0) + 16.67), 16.67);
  return g.canvas.toDataURL('image/png');   // works: preserveDrawingBuffer
};
window.__dl = function (name) {             // then click it into a download
  var a = document.createElement('a');
  a.href = window.__PNG; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};
```

The file lands in a temp browser-client folder, not Downloads:
`%TEMP%\opencode-browser-client-*\file_*/`. Find it with `Get-ChildItem -Recurse`.

---

## 8. Phaser never calls scene lifecycle *methods*

Phaser 3 fires the lifecycle **events** (`shutdown`, `destroy`, `stop`). If you
write `shutdown() { this.cleanup() }` on a scene it is never invoked.

**Why this matters here:** a DOM `<input>` overlay in the tournament name screen
was never removed, and eight stacked inputs piled up. The fix was
`GDLayout.registerOverlay()`, which explicitly removes the node.

---

## 9. Container children keep their own coordinates

When you `container.add(child)`, the child's `x`/`y` become **local** and the
container's transform is added on top. If the children were authored in absolute
scene coordinates, the container must be offset **only** by the amount the list
needs to move — never also by the viewport origin.

```js
// WRONG - double counts, pushes everything down by contentTop
this.content.y = this.viewTop + this.baseOffset - this.scroll;

// RIGHT
this.content.y = this.baseOffset - this.scroll;
// with: baseOffset = (viewTop + (viewH - contentHeight) / 2) - contentTop
```

---

## 10. A mask is not input

`setMask()` clips rendering. It has no effect on hit-testing. Conversely, a
catch-all interactive `Zone` over a container **does** compete with the
container's children for hit priority, and depth alone decides the winner.

**The rule:** if a panel needs both a drag surface and interactive children,
listen on the scene's `InputPlugin` and bounds-check, rather than covering the
panel with a Zone.

---

## 11. No emoji anywhere

Text uses words and numbers only. Any visual is a custom SVG/PNG asset or drawn
with `Graphics`. Buttons are rounded, never square or pixelated.

---

## 12. Ball list must stay sorted by price

`scenes/ShopScene.js` orders `ballData` by price ascending. `ShopScene` asserts
this at startup and falls back to sorting if it is ever wrong.

---

## 13. When you change one thing, change everything that depends on it

The standing example — adding a ball requires **all** of:

1. `ballData` entry in `scenes/ShopScene.js` (price-sorted)
2. a `case` in `GameScene.loadBallAbilities()`
3. an entry in all three `getBallTexture()` maps (`GameScene`,
   `TournamentGameScene`, `MenuScene`)
4. a 512×512 `assets/balls/ball-<name>.png`
5. a `this.load.image('ball_<name>', 'assets/balls/ball-<name>.png')` in
   `BootScene` — **hyphens in the path, underscores in the key**
6. `BALL_COUNT` in `achievements.js` if the ball count is part of an achievement

`audit-abilities.js` and `audit-ball-assets.js` enforce all of this. Run both.

---

## 14. Text must never go below 13px

Currently violated in two places (see `KNOWN-ISSUES.md`). A 10px font renders
at **5px** on a small Android device. New text: 14px floor for body, 15px+ for
anything that carries meaning.

---

## 15. The `v2.1` git tag points at a pre-fix commit

Deliberate, at the owner's request. Do not "fix" it, do not move it, do not
delete it.
