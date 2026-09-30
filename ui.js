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

        // Drop shadow underneath for depth
        g.fillStyle(0x000000, 0.28);
        g.fillRoundedRect(left, top + 5, w, h, radius);

        // Body
        g.fillStyle(fillBottom, 1);
        g.fillRoundedRect(left, top, w, h, radius);
        g.fillStyle(fillTop, 1);
        g.fillRoundedRect(left, top, w, h, radius);

        // Top sheen
        if (gloss > 0) {
            g.fillStyle(0xffffff, gloss);
            g.fillRoundedRect(left + radius * 0.7, top + 3, w - radius * 1.4, h * 0.34, radius * 0.6);
        }

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
            g.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, radius);
            g.fillStyle(bottom, 1);
            g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
            g.fillStyle(top, 1);
            g.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
            if (sheen > 0) {
                g.fillStyle(0xffffff, sheen);
                g.fillRoundedRect(-w / 2 + radius * 0.7, -h / 2 + 3, w - radius * 1.4, h * 0.34, radius * 0.6);
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

        var zone = scene.add.zone(0, 0, r * 2, r * 2).setOrigin(0.5);
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
        var x = o.x || 1236;
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

    window.UI = {
        FAMILY: FAMILY,
        installFont: installFont,
        shade: shade,
        drawPanel: drawPanel,
        button: button,
        iconButton: iconButton,
        panel: panel,
        topRight: topRight
    };
})();
