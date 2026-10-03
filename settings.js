/* settings.js — persisted player settings
 *
 * All keys are prefixed 'gd' and stored as 'true' / 'false' strings.
 * Defaults are applied when a key is missing, so upgrading the game never
 * leaves a setting undefined.
 */
(function () {
    'use strict';

    var DEFAULTS = {
        gdShake: 'true',          // screen shake when you deflect the ball
        gdParticles: 'true',      // explosion particles on a deflect
        /* The ball trail is separate from particles.
         *
         * Both were behind one toggle, so a player on a slow phone who wanted
         * the trail off had to lose the deflect explosion as well. The trail is
         * the expensive one - it emits a particle every few frames for the whole
         * run - so it is now its own switch. */
        gdBallTrail: 'true',    // the streak that follows the ball
        gdHitboxAlways: 'false',  // always show the clickable hitbox
        gdMuted: 'false'          // sound
    };

    var cache = {};

    function read(key) {
        if (cache[key] !== undefined) return cache[key];
        var v = null;
        try { v = localStorage.getItem(key); } catch (e) { v = null; }
        if (v === null) v = DEFAULTS[key];
        cache[key] = v;
        return v;
    }

    function write(key, value) {
        cache[key] = value;
        try { localStorage.setItem(key, value); } catch (e) {}
    }

    function isOn(key) { return read(key) === 'true'; }

    // Accepts a real boolean OR the strings 'true' / 'false', so a caller
    // passing a raw string can't accidentally write the opposite value.
    function setOn(key, on) {
        var v = (on === true || on === 'true') ? 'true' : 'false';
        write(key, v);
        return v;
    }

    function toggle(key) { setOn(key, !isOn(key)); return isOn(key); }

    window.Settings = {
        DEFAULTS: DEFAULTS,
        isOn: isOn,
        setOn: setOn,
        toggle: toggle,
        read: read,
        // drop the cache so a reload picks up changes from elsewhere
        refresh: function () { cache = {}; }
    };
})();
