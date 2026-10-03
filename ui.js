/* ui.js — shared visual language for Goal Defender
 *
 * Two jobs:
 *  1. Give every Text object a real font. Phaser falls back to "Courier" when
 *     no fontFamily is set, which is why all the text looked like a monospace
 *     slab. We inject the family at the factory level so it applies to every
 *     scene, including any text added later.
 *  2. Provide rounded buttons and panels. Phaser's Rectangle has square corners
 *     by design, so buttons are drawn with Graphics instead.
 */
(function () {
    'use strict';

    var FAMILY = '"Nunito", "Trebuchet MS", "Segoe UI", system-ui, -apple-system, sans-serif';

    /* Single source of truth for the version string.
     *
     * This used to be hardcoded as 'V2.0' in MenuScene and was still saying
     * V2.0 after v2.1 had shipped. Bump it here and every label follows.
     *
     * The only label in the game is the stamp in the bottom-right corner, which
     * reads this constant - so this one line is the whole version bump. */
    var VERSION = 'V2.2';

    /* Centre of the top-right control cluster (the gear and mute icons).
     *
     * Exported so anything that has to line up with that cluster can derive the
     * edge instead of hardcoding it. The account pill on the menu used to sit 17px
     * short of the gear's right edge, which read as a misalignment because both
     * are in the same corner. */
    var TOP_RIGHT_X = 1236;

    /* Where the close X goes on a sub-screen.
     *
     * NOT the top-right corner. MenuScene's settings gear is centred at
     * TOP_RIGHT_X with a radius of 25, so it covers x 1211..1261, y 9..59.
     * The X used to sit at (1240, 40) - inside that circle.
     *
     * The failure was not the overlap itself. Clicking the X started MenuScene,
     * and the SAME pointerup then landed on MenuScene's gear, so Settings
     * opened immediately afterwards. It looked like the X was flaky.
     *
     * y=132 puts it clear below the gear and the mute icon, which end at y=59,
     * and still reads as a corner control.
     *
     * x=1220 puts it INSIDE the panel. Every sub-screen panel spans x 20..1260,
     * and at x=1240 with a radius of 22 the X covered 1218..1262 - hanging 2px
     * past the border, so the red disc visibly cut through the panel edge. At
     * 1220 it covers 1196..1242, which lands on exactly the same 18px inset as
     * the tournament bracket's right-hand column, so the corner control and the
     * content share one margin. */
    var CLOSE_X = 1220;
    var CLOSE_Y = 132;

    /* ---------------- font ---------------- */

    function installFont() {
        if (installFont.done) return;
        var F = Phaser.GameObjects.GameObjectFactory;
        if (!F || !F.prototype.text) return;

        var original = F.prototype.text;

        F.prototype.text = function (x, y, content, style) {
            if (style === undefined || style === null) style = {};
            if (!style.fontFamily) style = Object.assign({ fontFamily: FAMILY }, style);
            return original.call(this, x, y, content, style);
        };

        // Keep the prototype in sync so anything reading it sees the family too
        var TextProto = Phaser.GameObjects.Text.prototype;
        if (TextProto && !TextProto.__gdFontPatched) {
            var defaults = TextProto.style;
            if (defaults) defaults.fontFamily = FAMILY;
            TextProto.__gdFontPatched = true;
        }

        installFont.done = true;
    }

    /* ---------------- colour helpers ---------------- */

    function shade(hex, amount) {
        var r = (hex >> 16) & 0xff;
        var g = (hex >> 8) & 0xff;
        var b = hex & 0xff;
        if (amount > 0) {
            r = Math.round(r + (255 - r) * amount);
            g = Math.round(g + (255 - g) * amount);
            b = Math.round(b + (255 - b) * amount);
        } else {
            r = Math.round(r * (1 + amount));
            g = Math.round(g * (1 + amount));
            b = Math.round(b * (1 + amount));
        }
        return (r << 16) | (g << 8) | b;
    }

    /* Gloss band across the top of a rounded shape.
     *
     * The corner radius MUST be clamped to half the band height. Passing the
     * button's full radius here overflowed: on a pill-shaped chip (radius =
     * height/2 = 31) the band is only ~21px tall, so a radius larger than the
     * band's half-height spilled pale corners outside the button, which read as
     * a semi-transparent shape floating behind the chip.
     *
     * The band is also inset horizontally so it can never cross the border. */
    function sheenRect(g, x, y, w, h, radius, alpha) {
        var bandH = h * 0.34;
        var r = Math.min(radius, bandH / 2);
        var inset = Math.max(r, radius * 0.35);
        g.fillStyle(0xffffff, alpha);
        g.fillRoundedRect(x + inset, y + 3, Math.max(1, w - inset * 2), bandH, r);
    }

    /* ---------------- rounded rect drawing ---------------- */

    // Draws a rounded rectangle with a vertical gradient, a soft top highlight
    // and a border. Returns the Graphics object.
    // `sheen` is the alpha of the white gloss across the top third. Buttons keep
    // it because it makes them read as clickable; panels drop it (0) because a
    // flat surface with a grey band across the top looks like a rendering bug.
    function drawPanel(scene, x, y, w, h, radius, fillTop, fillBottom, borderColor, borderWidth, sheen) {
        var g = scene.add.graphics();
        g.clear();

        var left = x - w / 2;
        var top = y - h / 2;
        var gloss = sheen === undefined ? 0.16 : sheen;

        /* Drop shadow.
         *
         * Inset 2px horizontally as well as offset 5px down. At a full-width
         * offset the shadow's rounded ends sat 5px proud of the body's own
         * rounded ends, which showed as a small notch at the bottom corners of
         * every pill-shaped chip - most visibly on the shop's money pill. */
        /* The shadow's own radius is pulled in by 2px as well as its width.
         * At a pill radius (h/2) an equal-radius shadow offset downward leaves its
         * corner arc 5px proud of the body's, which reads as a notch at the
         * bottom corners - most visible on the shop's money pill. */
        g.fillStyle(0x000000, 0.28);
        g.fillRoundedRect(left + 2, top + 5, w - 4, h, Math.max(2, radius - 2));

        /* Actual vertical gradient.
         *
         * This drew fillBottom as a full rect and then fillTop as a full rect on
         * top of it, so the second completely covered the first and every panel
         * and button in the game was FLAT despite being handed two colours. The
         * darker colour was dead code.
         *
         * fillGradientStyle takes a colour per corner, so the top corners get
         * fillTop and the bottom corners get fillBottom - a real top-to-bottom
         * gradient, which is what gives the panels their sense of a lit surface. */
        g.fillGradientStyle(fillTop, fillTop, fillBottom, fillBottom, 1);
        g.fillRoundedRect(left, top, w, h, radius);

        // Top sheen
        if (gloss > 0) sheenRect(g, left, top, w, h, radius, gloss);

        // Border
        if (borderWidth > 0) {
            g.lineStyle(borderWidth, borderColor, 1);
            g.strokeRoundedRect(left, top, w, h, radius);
        }

        return g;
    }

    /* ---------------- buttons ---------------- */

    /**
     * Rounded button with hover and press states.
     * opts: { x, y, w, h, label, textSize, fillTop, fillBottom, border,
     *         textColor, radius, onClick, depth, shadow }
     */
    function button(scene, opts) {
        var o = opts || {};
        var w = o.w || 240;
        var h = o.h || 72;
        var x = o.x;
        var y = o.y;
        var radius = o.radius !== undefined ? o.radius : Math.min(18, h / 3);
        var fillTop = o.fillTop !== undefined ? o.fillTop : 0x35c759;
        var fillBottom = o.fillBottom !== undefined ? o.fillBottom : 0x1f9c3d;
        var border = o.border !== undefined ? o.border : shade(fillTop, 0.25);
        var textColor = o.textColor !== undefined ? o.textColor : 0xffffff;
        var sheen = o.sheen !== undefined ? o.sheen : 0.16;

        var container = scene.add.container(x, y);

        var g = drawPanel(scene, 0, 0, w, h, radius, fillTop, fillBottom, border, 3, sheen);
        container.add(g);

        var label = null;
        if (o.label) {
            var px = o.textSize || 32;
            label = scene.add.text(0, 0, o.label, {
                fontSize: px + 'px',
                fontFamily: FAMILY,
                fontStyle: 'bold',
                color: '#' + textColor.toString(16).padStart(6, '0')
            }).setOrigin(0.5);

            // Shrink the label until it fits inside the button. Without this a
            // long label on a small button spills past both edges.
            var maxW = o.fitWidth !== undefined ? o.fitWidth : w - 24;
            var maxH = h - 12;
            var guard = 0;
            while ((label.width > maxW || label.height > maxH) && px > 8 && guard < 200) {
                px -= 1;
                label.setFontSize(px);
                guard++;
            }

            if (o.labelY) label.y = o.labelY;
            container.add(label);
        }

        // Invisible hit area (Graphics is not interactive on its own)
        var zone = scene.add.zone(0, 0, w, h).setOrigin(0.5);
        zone.setInteractive({ useHandCursor: true });
        container.add(zone);

        function paint(top, bottom, borderColor) {
            g.clear();
            g.fillStyle(0x000000, 0.28);
            g.fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w - 4, h, Math.max(2, radius - 2));
            g.fillGradientStyle(top, top, bottom, bottom, 1);
            g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
            if (sheen > 0) {
                // sheenRect clamps the radius to half the band height. Passing
                // the button's own radius here made the gloss spill outside a
                // pill-shaped button.
                sheenRect(g, -w / 2, -h / 2, w, h, radius, sheen);
            }
            if (borderColor) {
                g.lineStyle(3, borderColor, 1);
                g.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
            }
        }

        zone.on('pointerover', function () {
            paint(shade(fillTop, 0.16), shade(fillBottom, 0.16), shade(border, 0.2));
            scene.tweens.add({ targets: container, scale: 1.04, duration: 110, ease: 'Quad.easeOut' });
        });

        zone.on('pointerout', function () {
            paint(fillTop, fillBottom, border);
            scene.tweens.add({ targets: container, scale: 1, duration: 110, ease: 'Quad.easeOut' });
        });

        zone.on('pointerdown', function () {
            scene.tweens.add({ targets: container, scale: 0.97, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
        });

        if (o.onClick) zone.on('pointerup', o.onClick);

        if (o.depth !== undefined) container.setDepth(o.depth);

        container.gdSetFill = function (top, bottom, borderColor) {
            fillTop = top; fillBottom = bottom; border = borderColor;
            paint(fillTop, fillBottom, border);
        };
        container.gdSetLabel = function (txt) { if (label) label.setText(txt); };
        container.gdLabel = label;
        container.gdZone = zone;

        return container;
    }

    /**
     * Circular icon button - matches the circular trophy button on the menu.
     * opts: { x, y, radius, icon, iconScale, fillTop, fillBottom, onClick, depth }
     */
    function iconButton(scene, opts) {
        var o = opts || {};
        var r = o.radius || 46;
        var x = o.x;
        var y = o.y;
        var fillTop = o.fillTop !== undefined ? o.fillTop : 0xf0b429;
        var fillBottom = o.fillBottom !== undefined ? o.fillBottom : 0xc98a08;
        var border = o.border !== undefined ? o.border : shade(fillTop, 0.3);

        var container = scene.add.container(x, y);

        var g = scene.add.graphics();
        function paint(top, bottom, borderColor) {
            g.clear();
            g.fillStyle(0x000000, 0.3);
            g.fillCircle(0, 5, r);
            g.fillStyle(bottom, 1);
            g.fillCircle(0, 0, r);
            g.fillStyle(top, 1);
            g.fillCircle(0, 0, r);
            g.fillStyle(0xffffff, 0.22);
            g.fillEllipse(0, -r * 0.42, r * 1.1, r * 0.55);
            g.lineStyle(3, borderColor, 1);
            g.strokeCircle(0, 0, r);
        }
        paint(fillTop, fillBottom, border);
        container.add(g);

        if (o.icon && scene.textures.exists(o.icon)) {
            var icon = scene.add.image(0, 0, o.icon);
            icon.setScale(o.iconScale || 0.3);
            container.add(icon);
        }

        /* Optional caption under the icon.
         *
         * An icon with no label is a target nobody thinks to aim at, and it
         * gives a screen reader nothing to announce. Drawn inside the button's
         * own container so it moves with the hover scale, and given a dark
         * stroke so it stays readable against the stadium art. The hit zone is
         * widened to cover it, so the caption is part of the button rather than
         * a separate target. */
        var caption = null;
        if (o.label) {
            caption = scene.add.text(0, r + 15, o.label, {
                fontSize: (o.labelSize || 15) + 'px',
                color: '#ffffff',
                fontFamily: FAMILY,
                fontStyle: '900',
                stroke: '#0b1220',
                strokeThickness: 4
            }).setOrigin(0.5);
            container.add(caption);
        }

        var zoneH = caption ? r * 2 + 34 : r * 2;
        var zone = scene.add.zone(0, caption ? 12 : 0, r * 2, zoneH).setOrigin(0.5);
        zone.setInteractive({ useHandCursor: true });
        container.add(zone);

        zone.on('pointerover', function () {
            paint(shade(fillTop, 0.16), shade(fillBottom, 0.16), shade(border, 0.2));
            scene.tweens.add({ targets: container, scale: 1.08, duration: 110, ease: 'Quad.easeOut' });
        });
        zone.on('pointerout', function () {
            paint(fillTop, fillBottom, border);
            scene.tweens.add({ targets: container, scale: 1, duration: 110, ease: 'Quad.easeOut' });
        });
        if (o.onClick) zone.on('pointerup', o.onClick);

        if (o.depth !== undefined) container.setDepth(o.depth);
        container.gdZone = zone;
        // Kept for tooling and for anything that needs to read the caption.
        container.gdLabel = caption;
        return container;
    }

    /** Non-interactive rounded panel for grouping content. Flat by default -
     *  the top gloss is reserved for buttons. */
    function panel(scene, opts) {
        var o = opts || {};
        var w = o.w || 400;
        var h = o.h || 200;
        var g = drawPanel(
            scene, o.x, o.y, w, h,
            o.radius !== undefined ? o.radius : 16,
            o.fillTop !== undefined ? o.fillTop : 0x1c2b3a,
            o.fillBottom !== undefined ? o.fillBottom : 0x111c27,
            o.border !== undefined ? o.border : 0x3d5a73,
            o.borderWidth !== undefined ? o.borderWidth : 2,
            o.sheen !== undefined ? o.sheen : 0
        );
        if (o.depth !== undefined) g.setDepth(o.depth);
        return g;
    }

    /**
     * Compact top-right control cluster, laid out right to left:
     *   [pause] [settings] [mute]
     * Each entry is optional except mute. `onPause` adds the pause button,
     * which mobile needs because there is no ESC key to press.
     */
    function topRight(scene, opts) {
        var o = opts || {};
        var y = o.y || 34;
        var x = o.x || TOP_RIGHT_X;
        var r = o.radius || 26;
        var created = [];

        function nextSlot(gap) { x -= (r * 2 + gap); }

        // Rightmost: pause
        if (o.onPause) {
            created.push(iconButton(scene, {
                x: x, y: y, radius: r,
                icon: 'pause-icon', iconScale: r * 0.0075,
                fillTop: 0xf0b429, fillBottom: 0xc98a08,
                onClick: o.onPause,
                depth: 50
            }));
            nextSlot(12);
        }

        // Then settings
        if (o.settingsIcon) {
            created.push(iconButton(scene, {
                x: x, y: y, radius: r,
                icon: o.settingsIcon, iconScale: r * 0.0075,
                fillTop: 0x4a90c4, fillBottom: 0x2f6b9c,
                onClick: o.onSettings,
                depth: 50
            }));
            nextSlot(14);
        }

        // Leftmost: mute
        var mute = scene.add.image(x, y, window.Settings.isOn('gdMuted') ? 'volume-mute' : 'volume-unmute');
        mute.setScale(0.062);
        mute.setDepth(50);
        mute.setInteractive({ useHandCursor: true });
        mute.on('pointerover', function () { mute.setScale(0.075); });
        mute.on('pointerout', function () { mute.setScale(0.062); });
        mute.on('pointerdown', function () {
            window.Settings.toggle('gdMuted');
            if (window.gdSyncSound) window.gdSyncSound();
            mute.setTexture(window.Settings.isOn('gdMuted') ? 'volume-mute' : 'volume-unmute');
        });
        created.push(mute);

        return created;
    }

    /* ---------------- type scale ---------------- */

    /* Twenty-six distinct font sizes were in use across the game, and the
     * achievements page used three different ones inside a single card. That is
     * the underlying cause of most of the "slightly off" feeling on every
     * screen: nothing is anchored to a scale, so every value was a guess.
     *
     * These six steps replace ad-hoc sizes. Nothing below `small` may carry
     * meaning, because a 10px font renders at roughly 5px on a small Android. */
    var TYPE = {
        micro: 12,   // version stamp, tertiary labels
        small: 14,   // descriptions, ability copy, progress labels
        body: 18,    // list rows, button labels
        lead: 24,    // card names, stat values, tab labels
        title: 36,   // screen titles
        hero: 54     // menu title
    };

    /* ---------------- stadium background ---------------- */

    /* The most jarring inconsistency in the game was three screens with no
     * background at all: the bracket, the tournament result screen and the
     * tutorial. They rendered as flat black voids while every other screen was a
     * stadium, so a player moved stadium -> black -> stadium.
     *
     * This is now the only place the stadium is built. Every scene calls it. */
    function stadium(scene, opts) {
        var o = opts || {};
        var groundHeight = o.groundHeight || 100;
        var groundY = o.groundY || 720;
        var groundTopY = groundY - groundHeight;

        if (scene.textures.exists('background')) {
            var bg = scene.add.image(640, 0, 'background');
            bg.setOrigin(0.5, 0);
            bg.setDisplaySize(1280, groundTopY);
            bg.setAlpha(o.alpha !== undefined ? o.alpha : 0.6);
        } else {
            scene.cameras.main.setBackgroundColor(o.fallback || '#1a1a1a');
        }

        if (scene.textures.exists('ground')) {
            var ground = scene.add.image(640, groundY, 'ground');
            ground.setOrigin(0.5, 1);
            ground.setDisplaySize(1280, groundHeight);
            ground.setAlpha(o.groundAlpha !== undefined ? o.groundAlpha : 0.4);
        }

        if (scene.textures.exists('grass')) {
            var grass = scene.add.image(640, groundTopY + 3, 'grass');
            grass.setOrigin(0.5, 1);
            grass.setDisplaySize(1280, grass.height);
            grass.setAlpha(o.grassAlpha !== undefined ? o.grassAlpha : 0.3);
        }

        // Darken so foreground panels and text read clearly against the art.
        if (o.dim !== undefined && o.dim > 0) {
            scene.add.rectangle(640, 360, 1280, 720, 0x000000, o.dim);
        }

        return { groundTopY: groundTopY, groundY: groundY };
    }

    /* ---------------- screen title ---------------- */

    /* Every screen title is the same two-layer treatment: a black copy offset a
     * couple of pixels behind, then white with a gold stroke.
     *
     * Each scene used to rebuild this by hand and several drifted - the
     * tournament result screen ended up as plain red with no stroke or shadow at
     * all, which read as a different game. One function, one look. */
    function title(scene, opts) {
        var o = opts || {};
        var text = o.text || '';
        var x = o.x !== undefined ? o.x : 640;
        var y = o.y !== undefined ? o.y : 82;
        var size = o.size || TYPE.title;
        var fill = o.fill || '#ffffff';
        var stroke = o.stroke || '#f0a500';
        var thickness = o.thickness !== undefined ? o.thickness : 6;
        /* Kept at or below half the stroke so the shadow never escapes from
         * behind the outline. At a 6px stroke an offset of 3 let it peek out
         * around every round letterform. */
        var offset = o.offset !== undefined ? o.offset : Math.max(1, Math.floor(thickness / 2) - 1);

        /* Both layers live in a container and the CONTAINER is returned.
         *
         * Returning only the top text meant every "pulse the title" tween scaled
         * one layer and left the other at its original size, so on a pulsing
         * screen the shadow visibly detached and the word read as doubled and
         * muddy. Handing back the container makes that impossible: a tween on the
         * returned object moves the shadow with the text by construction. */
        var holder = scene.add.container(x, y);

        var shadow = scene.add.text(offset, offset, text, {
            fontSize: size + 'px',
            fontFamily: FAMILY,
            fontStyle: '900',
            color: '#000000',
            alpha: 0.45
        }).setOrigin(0.5);

        var main = scene.add.text(0, 0, text, {
            fontSize: size + 'px',
            fontFamily: FAMILY,
            fontStyle: '900',
            color: fill,
            stroke: stroke,
            strokeThickness: thickness
        }).setOrigin(0.5);

        holder.add([shadow, main]);
        holder.gdMain = main;
        holder.gdShadow = shadow;
        return holder;
    }

    /* ---------------- close button ---------------- */

    /* One close control for the whole game.
     *
     * Four different patterns existed: an X inside the settings panel, BACK at
     * bottom-left on some screens, BACK at bottom-centre on others, and nothing
     * on the rest. The same action in three places in three positions.
     *
     * The settings version was the best of them - red, unambiguous, and inside
     * the panel it belongs to - so it is what every sub-screen now uses. */
    function closeButton(scene, opts) {
        var o = opts || {};
        var cx = o.x !== undefined ? o.x : 1004;
        var cy = o.y !== undefined ? o.y : 164;
        var r = o.r !== undefined ? o.r : 24;
        var onClick = o.onClick || function () { scene.scene.start('MenuScene'); };

        var g = scene.add.graphics();
        g.setDepth(o.depth !== undefined ? o.depth : 60);

        function paint(hover) {
            g.clear();
            g.fillStyle(hover ? 0xd6332c : 0xb3261e, 1);
            g.fillCircle(cx, cy, r);
            g.lineStyle(2, hover ? 0xff8a80 : 0xff5545, 1);
            g.strokeCircle(cx, cy, r);
            var arm = r * 0.44;
            g.lineStyle(3.5, 0xffffff, 1);
            g.beginPath();
            g.moveTo(cx - arm, cy - arm); g.lineTo(cx + arm, cy + arm);
            g.moveTo(cx + arm, cy - arm); g.lineTo(cx - arm, cy + arm);
            g.strokePath();
        }
        paint(false);

        /* The ZONE needs the depth, not just the graphics.
         *
         * Only the graphics was given one. The zone stayed at depth 0 while the
         * mute icon in UI.topRight sits at depth 50, so on AchievementsScene -
         * which draws both - the mute won the hit test over a close button that
         * overlapped it. Hence a close button that worked only sometimes. */
        var hit = scene.add.zone(cx, cy, r * 2 + 8, r * 2 + 8).setOrigin(0.5);
        hit.setDepth(o.depth !== undefined ? o.depth : 60);
        hit.setInteractive({ useHandCursor: true });
        hit.on('pointerover', function () { paint(true); });
        hit.on('pointerout', function () { paint(false); });
        hit.on('pointerdown', onClick);

        return { graphics: g, zone: hit };
    }

    window.UI = {
        FAMILY: FAMILY,
        VERSION: VERSION,
        TOP_RIGHT_X: TOP_RIGHT_X,
        CLOSE_X: CLOSE_X,
        CLOSE_Y: CLOSE_Y,
        TYPE: TYPE,
        installFont: installFont,
        shade: shade,
        drawPanel: drawPanel,
        button: button,
        iconButton: iconButton,
        panel: panel,
        topRight: topRight,
        stadium: stadium,
        title: title,
        closeButton: closeButton
    };
})();
