# DESIGN-RULES — asset, colour and UI conventions

---

## Hard rules

1. **No emoji.** Ever. Text uses words and numbers. Visuals are custom SVG/PNG
   assets or drawn with `Graphics`.
2. **Buttons are rounded.** No square buttons, no pixel-art buttons. Corner
   radius 14–16 for standard buttons, 24 for panels.
3. **No text below 13px**, and prefer 14px for body copy. Currently violated in
   `AchievementsScene` (F-13).
4. **Ball art is 512×512 PNG**, one file per ball, named `ball-<name>.png` with
   **hyphens**.
5. **Texture keys use underscores**: `ball_inverted`. Paths use hyphens:
   `assets/balls/ball-inverted.png`. Mixing these up is what made five balls
   silently render as the default one.

---

## Colour palette

### Panels

| Use | Fill top | Fill bottom | Border |
|---|---|---|---|
| Main panel | `0x1f2c3d` | `0x121c28` | `0x4a6a8a` |
| Row | `0x2a3b52` | `0x1b2836` | `0x3d5a73` |

### Text

| Use | Colour |
|---|---|
| Primary | `#ffffff` |
| Secondary / description | `#93a8bd` |
| Muted / label | `#8fa6bd` |
| Title stroke | `#f0a500` |

### Controls

| State | Colour |
|---|---|
| Toggle on track | `0x17a34a` |
| Toggle on border | `0x3ddc6b` |
| Toggle off track | `0x3a4653` |
| Toggle off border | `0x55636f` |
| Knob | `#ffffff`, 15% black stroke |
| Accent button | `0x4a90c4` → `0x2f6b9c` |
| Neutral button | `0x5a6b7d` → `0x3d4b59` |
| **Close (danger)** | **`0xb3261e`, hover `0xd6332c`, border `0xff5545`/`0xff8a80`, white X** |

Red is reserved. Nothing else in the game uses it, so the close button is the
only red thing on screen and reads instantly.

---

## Title treatment

Every scene title is two text objects:

1. `#000000` at 45% alpha, offset **2px** down
2. `#ffffff` with a `#f0a500` stroke, 6px

This is why scene audits report every title **twice** — the "worst contrast"
result on every page is the intentional shadow layer, not a real contrast
problem. Real body text sits comfortably above 4.5:1.

---

## Spacing

| Context | Value |
|---|---|
| Panel corner radius | 24 |
| Row corner radius | 14 |
| Row height (Settings) | 66 |
| Row spacing (Settings) | 72 |
| Panel side padding | 40 |
| Reserved header band | 72 |

**When adding a Settings toggle:** pick a `y` 72px below the previous row. The
panel is a fixed viewport with scrollable content, so nothing can overflow — but
keep rows inside `VIEW_TOP 200` … `VIEW_BOTTOM 672` or the list will begin to
scroll, and `static-check.js` will fail the fit assertion.

---

## The type scale (proposed — not yet adopted)

There are currently **26 distinct font sizes**. Recommended replacement:

| Step | Size | Use |
|---|---|---|
| micro | 12px | version stamp, legal |
| small | 14px | descriptions, ability copy |
| body | 18px | list rows, secondary buttons |
| lead | 24px | row labels, tabs |
| title | 36px | screen titles |
| hero | 54px | menu title |

The single biggest visual improvement available, and it is a mechanical change.

---

## Scrollable list pattern

Any list that can grow must be a **clipped viewport**, never a panel sized to its
contents:

```js
const mask = this.make.graphics({ x: 0, y: 0 }, false);
mask.fillStyle(0xffffff);
mask.fillRoundedRect(PANEL_X, VIEW_TOP, PANEL_W, viewH, 18);
container.setMask(mask.createGeometryMask());
```

Three things that will bite:

1. **Reserve the header band as panel space.** That is what guarantees a fixed
   header control can never collide with the first row as the list grows.
2. **Container children use local coordinates.** See `ARCHITECTURE.md`.
3. **Do not use a catch-all `Zone` for the drag surface** if the container has
   interactive children — it competes for hit priority. Listen on the
   `InputPlugin` and bounds-check.

---

## Interaction

- Toggle switches act on **`pointerup`**, never `pointerdown`, and bail if the
  pointer travelled more than 6px. A drag over a switch must never flip it.
- Flick inertia sign: velocity is negative travelling up, and travelling up must
  **increase** scroll. `glide = -velocity * 8`.
- Scroll indicator: 6px wide, `#8fa6bd` at 55% alpha, radius 3, inset 16px from
  the panel edge, minimum height 40px. Only drawn when `maxScroll > 0`.
- Centre content when it is shorter than the viewport, so a state with fewer rows
  reads as deliberate padding rather than an empty band.
