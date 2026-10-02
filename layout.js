/* layout.js — responsive scaling + orientation handling for Goal Defender
 *
 * The game is designed at a fixed 1280x720 (16:9). On a phone held upright that
 * aspect ratio only fills about 26% of the screen.
 *
 * This keeps the 1280x720 game coordinates untouched and instead presents the
 * canvas rotated 90 degrees when the device is upright. The player sees the
 * full-width game running sideways and turns their phone to play it.
 *
 * It also fixes the scaling bugs in index.html:
 *   - phone landscape was being stretched to fill the screen
 *   - tablets (>=768px wide) missed the media query and were stretched badly
 *
 * Touch input is remapped by overriding ScaleManager.transformX/transformY,
 * because Phaser's built-in mapping assumes an axis-aligned (unrotated) canvas.
 */

/* ------------------------------------------------------------------ *
 * Shared audio context
 *
 * Each scene used to create its own AudioContext. iOS/Safari only allows a
 * handful of concurrent contexts, and scenes recreate theirs on every restart,
 * so sound would eventually stop working after a few runs. One shared context,
 * resumed on the first user gesture (mobile browsers block audio otherwise).
 * ------------------------------------------------------------------ */
function getAudioContext() {
    if (!window.__gdAudioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        window.__gdAudioCtx = new AC();
    }
    var ctx = window.__gdAudioCtx;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
}

(function () {
    'use strict';

    var GAME_W = 1280;
    var GAME_H = 720;

    var game = null;
    var canvas = null;
    var hintEl = null;
    var loadingEl = document.getElementById('loading-screen');
    var lastW = -1, lastH = -1;
    var rafId = 0;

    // Rotate hint: shown once, briefly, then never again.
    var HINT_KEY = 'gdRotateHintSeen';
    var HINT_MS = 4000;
    var hintTimer = 0;
    var hintFinished = false;

    // Current presentation of the canvas.
    var state = {
        rotated: false,
        left: 0, top: 0,
        width: GAME_W, height: GAME_H,
        centerX: 0, centerY: 0
    };

    function viewport() {
        var w = window.innerWidth || document.documentElement.clientWidth || GAME_W;
        var h = window.innerHeight || document.documentElement.clientHeight || GAME_H;
        return { w: w, h: h };
    }

    // Read the notch / home-indicator insets so UI is never hidden behind them.
    var safeProbe = null;
    function safeArea() {
        if (!safeProbe) {
            safeProbe = document.createElement('div');
            safeProbe.style.cssText =
                'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
                'padding-top:env(safe-area-inset-top,0px);' +
                'padding-right:env(safe-area-inset-right,0px);' +
                'padding-bottom:env(safe-area-inset-bottom,0px);' +
                'padding-left:env(safe-area-inset-left,0px);';
            document.body.appendChild(safeProbe);
        }
        var cs = getComputedStyle(safeProbe);
        return {
            t: parseFloat(cs.paddingTop) || 0,
            r: parseFloat(cs.paddingRight) || 0,
            b: parseFloat(cs.paddingBottom) || 0,
            l: parseFloat(cs.paddingLeft) || 0
        };
    }

    // Rotate only on touch devices that are being held upright.
    // A mouse-driven desktop window is never rotated.
    function shouldRotate(vw, vh) {
        if (vw >= vh) return false;
        var coarse = false;
        if (window.matchMedia) coarse = window.matchMedia('(pointer: coarse)').matches;
        if (!coarse) coarse = (navigator.maxTouchPoints || 0) > 0;
        return coarse;
    }

    function compute() {
        var vp = viewport();
        var sa = safeArea();

        var areaX = sa.l;
        var areaY = sa.t;
        var areaW = Math.max(1, vp.w - sa.l - sa.r);
        var areaH = Math.max(1, vp.h - sa.t - sa.b);

        var rot = shouldRotate(vp.w, vp.h);

        // In rotated mode the canvas is laid out unrotated, so swap the
        // available width/height to work out how big it can be.
        var availW = rot ? areaH : areaW;
        var availH = rot ? areaW : areaH;

        var scale = Math.min(availW / GAME_W, availH / GAME_H);
        var w = Math.max(1, Math.floor(GAME_W * scale));
        var h = Math.max(1, Math.floor(GAME_H * scale));

        state.rotated = rot;
        state.width = w;
        state.height = h;
        state.centerX = areaX + areaW / 2;
        state.centerY = areaY + areaH / 2;
        state.left = Math.round(state.centerX - w / 2);
        state.top = Math.round(state.centerY - h / 2);
    }

    function apply() {
        if (!canvas) return;
        var s = canvas.style;
        s.width = state.width + 'px';
        s.height = state.height + 'px';
        s.left = state.left + 'px';
        s.top = state.top + 'px';
        s.transform = state.rotated ? 'rotate(90deg)' : 'none';

        // Any HTML input locked to the canvas has to follow it.
        placeAllOverlays();

        placeLoading();

        // The hint is a one-time nudge, not a permanent overlay. It shows for a
        // few seconds the first time someone holds a phone upright, then hides
        // and never comes back.
        if (hintEl) {
            if (state.rotated) {
                if (!hintFinished && !hintSeen()) {
                    hintEl.classList.add('visible');
                    if (!hintTimer) hintTimer = window.setTimeout(dismissHint, HINT_MS);
                }
            } else {
                if (hintTimer) { window.clearTimeout(hintTimer); hintTimer = 0; }
                hintEl.classList.remove('visible');
            }
        }
    }

    function hintSeen() {
        try { return localStorage.getItem(HINT_KEY) === 'true'; } catch (e) { return false; }
    }

    /* ------------------------------------------------------------------ *
     * DOM overlays that must line up with the canvas
     *
     * The canvas is a normal element rotated with a CSS transform, but an HTML
     * <input> appended to <body> is not. Centring one with left:50%/top:50%
     * centres it on the VIEWPORT, so on an upright phone - where the canvas is
     * turned 90 degrees and the player is looking at the game sideways - the
     * textbox stayed upright and sat perpendicular to everything around it.
     * It read as a different app pasted over the game.
     *
     * registerOverlay() takes a rectangle in GAME coordinates and keeps the
     * element locked to it: same size, same scale, and the same rotation as
     * the canvas. It re-places itself whenever the canvas is re-laid-out, so a
     * player who rotates their phone mid-form sees the field follow rather
     * than jump to the wrong edge.
     * ------------------------------------------------------------------ */
    var overlays = [];

    function placeOverlay(o) {
        var el = o.el;
        if (!el || !el.style) return;
        if (!state.width || !state.height) return;

        // Size in the canvas' own unrotated pixel space.
        var ew = (o.gw / GAME_W) * state.width;
        var eh = (o.gh / GAME_H) * state.height;

        // Offset of this element's centre from the canvas centre, in canvas px.
        var px = ((o.gx + o.gw / 2) - GAME_W / 2) / GAME_W * state.width;
        var py = ((o.gy + o.gh / 2) - GAME_H / 2) / GAME_H * state.height;

        var cx = state.left + state.width / 2;
        var cy = state.top + state.height / 2;
        var sx, sy;

        if (state.rotated) {
            /* CSS rotate(90deg) is clockwise on screen: a point offset
             * (dx, dy) from the centre lands at (-dy, dx). */
            sx = cx - py;
            sy = cy + px;
        } else {
            sx = cx + px;
            sy = cy + py;
        }

        el.style.width = Math.round(ew) + 'px';
        el.style.height = Math.round(eh) + 'px';
        el.style.left = Math.round(sx - ew / 2) + 'px';
        el.style.top = Math.round(sy - eh / 2) + 'px';
        el.style.transform = state.rotated ? 'rotate(90deg)' : 'none';

        /* Scale the font with the canvas. A DOM font size is in screen px, so
         * a 30px input drawn over 1280px of game width has to shrink with the
         * canvas or the text overflows the box it is meant to fill. */
        if (o.fontPx) {
            var k = state.rotated ? state.width / GAME_W : state.width / GAME_W;
            el.style.fontSize = Math.max(11, Math.round(o.fontPx * k)) + 'px';
            if (o.padY !== undefined) el.style.padding = Math.max(2, Math.round(o.padY * k)) + 'px';
            if (o.radius !== undefined) el.style.borderRadius = Math.max(3, Math.round(o.radius * k)) + 'px';
            if (o.borderW !== undefined) el.style.border = Math.max(1, Math.round(o.borderW * k)) + 'px solid ' + (o.borderColor || '#f0b429');
        }
    }

    function placeAllOverlays() {
        overlays.forEach(placeOverlay);
    }

    /** Lock a DOM element to a rectangle in game coordinates.
     *  Returns a function that unregisters it. Call that when the element is
     *  removed, otherwise a destroyed input stays in the overlay list and keeps
     *  being written to on every resize. */
    function registerOverlay(el, o) {
        var entry = {
            el: el,
            gx: o.x, gy: o.y, gw: o.w, gh: o.h,
            fontPx: o.fontPx || 0,
            padY: o.padY,
            radius: o.radius,
            borderW: o.borderW,
            borderColor: o.borderColor
        };
        overlays.push(entry);
        placeOverlay(entry);
        return function unregister() {
            var i = overlays.indexOf(entry);
            if (i > -1) overlays.splice(i, 1);
        };
    }

    function dismissHint() {
        hintTimer = 0;
        hintFinished = true;
        if (hintEl) hintEl.classList.remove('visible');
        try { localStorage.setItem(HINT_KEY, 'true'); } catch (e) {}
    }

    function relayout(force) {
        var vp = viewport();
        if (!force && Math.abs(vp.w - lastW) < 2 && Math.abs(vp.h - lastH) < 2) return;
        lastW = vp.w;
        lastH = vp.h;
        compute();
        apply();
    }

    function schedule() {
        if (rafId) return;
        rafId = window.requestAnimationFrame(function () {
            rafId = 0;
            relayout(false);
        });
    }

    // Convert a viewport (page) coordinate into game coordinates, undoing the
    // 90 degree rotation when one is applied.
    //
    // A 90 degree rotation swaps the axes, so gameX depends on pageY and gameY
    // depends on pageX. That rules out ScaleManager.transformX/transformY,
    // which Phaser calls with ONE argument each. InputManager.transformPointer
    // is the hook that receives both, so that is what gets replaced.
    //
    // rotate(90deg) maps a local vector (a, b) to the visual vector (-b, a),
    // giving:
    //     lx = (pageY - centerY) + width/2
    //     ly = (centerX + height/2) - pageX
    function toLocal(pageX, pageY) {
        var s = state;
        var lx, ly;
        if (s.rotated) {
            lx = (pageY - s.centerY) + s.width / 2;
            ly = (s.centerX + s.height / 2) - pageX;
        } else {
            lx = pageX - s.left;
            ly = pageY - s.top;
        }
        return {
            x: lx * (GAME_W / s.width),
            y: ly * (GAME_H / s.height)
        };
    }

    // In Phaser 3.70 `game.input` IS the InputManager. Older/other builds
    // nest it as game.input.manager, so support both.
    function getInputManager() {
        if (!game || !game.input) return null;
        if (game.input.transformPointer) return game.input;
        if (game.input.manager && game.input.manager.transformPointer) return game.input.manager;
        return null;
    }

    function installPointerMapping() {
        var manager = getInputManager();
        if (!manager) return false;

        manager.transformPointer = function (pointer, pageX, pageY, wasMove) {
            var pos = pointer.position;
            var prev = pointer.prevPosition;
            prev.x = pos.x;
            prev.y = pos.y;

            var p = toLocal(pageX, pageY);
            var smooth = pointer.smoothFactor;

            if (wasMove && smooth !== 0) {
                pos.x = p.x * smooth + prev.x * (1 - smooth);
                pos.y = p.y * smooth + prev.y * (1 - smooth);
            } else {
                pos.x = p.x;
                pos.y = p.y;
            }
        };

        return true;
    }

    /** Move the loading overlay so it exactly covers the presented canvas,
     *  rotation included. Without this it stayed axis-aligned to the window
     *  while the game turned 90 degrees on a phone, so the spinner appeared
     *  sideways outside the play area.
     *
     *  Deliberately does NOT require the canvas: it also runs at script load
     *  time (see initLoading) so the overlay is already the right shape on the
     *  first paint. Waiting for the canvas made it appear unadjusted and then
     *  snap into place once the game booted. */
    function placeLoading() {
        if (!loadingEl) return;
        var anchor = hintEl || (canvas && canvas.parentNode) || document.body;
        if (anchor && loadingEl.parentNode !== anchor.parentNode) {
            anchor.parentNode.insertBefore(loadingEl, anchor);
        }
        var s = loadingEl.style;
        s.width = state.width + 'px';
        s.height = state.height + 'px';
        s.left = state.left + 'px';
        s.top = state.top + 'px';
        s.transform = state.rotated ? 'rotate(90deg)' : 'none';
        s.transformOrigin = '50% 50%';
        s.maxWidth = 'none';
        s.maxHeight = 'none';
        s.visibility = 'visible';
        loadingEl.classList.add('placed');
    }

    /** Position the overlay before the game exists so the very first frame is
     *  already correct. Needs no canvas - only the viewport. */
    function initLoading() {
        if (!loadingEl) return;
        compute();
        placeLoading();
    }

    function attach() {
        canvas = game.canvas;
        if (!canvas) return false;

        var parent = canvas.parentNode;
        if (parent) {
            parent.style.position = 'fixed';
            parent.style.top = '0';
            parent.style.left = '0';
            parent.style.width = '100%';
            parent.style.height = '100%';
            parent.style.overflow = 'hidden';
        }

        // Clear the stylesheet's stretched sizing; layout.js owns these now.
        canvas.style.position = 'absolute';
        canvas.style.margin = '0';
        canvas.style.transformOrigin = '50% 50%';
        canvas.style.imageRendering = 'auto';

        hintEl = document.getElementById('rotate-hint');

        relayout(true);

        // The input manager may not exist yet on the very first call.
        if (!installPointerMapping()) {
            var attempts = 0;
            var iv = window.setInterval(function () {
                attempts++;
                if (installPointerMapping() || attempts > 60) window.clearInterval(iv);
            }, 100);
        }

        return true;
    }

    window.setupResponsiveLayout = function (g) {
        game = g;
        if (!attach()) {
            game.events.once('ready', attach);
        }

        window.addEventListener('resize', schedule, { passive: true });
        window.addEventListener('orientationchange', function () {
            // Safari reports the old size immediately; re-measure next frame.
            schedule();
            window.setTimeout(function () { relayout(true); }, 120);
            window.setTimeout(function () { relayout(true); }, 400);
        }, { passive: true });

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', schedule, { passive: true });
        }

        // First tap anywhere unlocks audio on mobile browsers, and dismisses
        // the rotate hint early rather than making the player wait it out.
        document.addEventListener('pointerdown', function () {
            getAudioContext();
            if (!hintFinished) dismissHint();
        }, { capture: true, passive: true });

        // Stop iOS Safari from bouncing / zooming the page under the game.
        //
        // NOTE: a global non-passive `touchmove` preventDefault used to sit
        // here. It is redundant - `touch-action: none` in index.html already
        // stops scrolling and pinch - and a non-passive listener forces the
        // browser to wait for JS on every touch move, which blocked the main
        // thread during play and added input lag on phones. Left out on purpose.
        document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
        var lastTouch = 0;
        document.addEventListener('touchend', function (e) {
            var now = Date.now();
            if (now - lastTouch < 320) e.preventDefault();
            lastTouch = now;
        }, { passive: false });
    };

    window.GDLayout = {
        state: state,
        toLocal: toLocal,
        registerOverlay: registerOverlay,
        /* How much the canvas is scaled relative to game pixels. A DOM overlay
         * needs this to size its font to match the game text beside it. */
        scale: function () {
            return state.width ? state.width / GAME_W : 1;
        },
        rotated: function () { return state.rotated; },
        relayout: function () { relayout(true); }
    };

    // Size the loading overlay immediately, before Phaser has loaded. This is
    // what removes the unadjusted-then-snapping flash: the overlay is hidden
    // by CSS until this runs, and this runs before the first paint.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLoading);
    } else {
        initLoading();
    }
})();
