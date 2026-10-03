/* player.js â player identity + optional cloud leaderboard.
 *
 * Two independent jobs:
 *
 *   1. Player name (Part 5). Stored in localStorage under 'gdPlayerName',
 *      prompted on first launch, editable from Settings.
 *
 *   2. Leaderboard (Part 6). Firestore-backed, with anonymous auth so there
 *      is no login wall. Degrades to an empty board when Firebase is not
 *      configured, so the game NEVER blocks on the network.
 *
 * WHY IT DEGRADES INSTEAD OF WAITING
 * A leaderboard that can hang the menu is worse than no leaderboard. Every
 * path here has a timeout, and a failure leaves the board empty rather than
 * leaving the player staring at a spinner.
 *
 * CONFIG: fill in GD_FIREBASE below, or leave it empty and the board stays
 * empty until you do. See update-plan.md Part 6 for the console steps.
 */
(function () {
    'use strict';

    var NAME_KEY = 'gdPlayerName';
    var DEFAULT_NAME = 'PLAYER';
    var MAX_NAME = 14;

    /* ---------------------------------------------------------------- *
     * Firebase config â paste from console.firebase.google.com >
     * Project settings > Your apps > Web app > SDK setup and configuration
     * Leave null to run fully offline (leaderboard disabled).
     * ---------------------------------------------------------------- */
    var GD_FIREBASE = {
        apiKey: 'AIzaSyCkvlWTfOPi9P7RbZNWlTwbjk0ohzMgNRI',
        authDomain: 'goal-defender.firebaseapp.com',
        projectId: 'goal-defender',
        storageBucket: 'goal-defender.firebasestorage.app',
        messagingSenderId: '212672441886',
        appId: '1:212672441886:web:de3c6cb794adfc65eb080f'
    };

    /* Collection layout. See update-plan.md for the required rules. */
    var COLLECTION = 'players';

/* The anonymous leaderboard id this device used before signing in.
 *
 * Local-only on purpose - it is not progress, just a pointer to the row that
 * needs retiring once an account exists. */
var ANON_UID_KEY = 'gdAnonLeaderboardUid';
    var NETWORK_TIMEOUT_MS = 6000;

    var MAX_TROPHIES_PER_CUP = 999;

    function hasConfig() {
        return !!(GD_FIREBASE && GD_FIREBASE.apiKey && GD_FIREBASE.projectId && GD_FIREBASE.appId);
    }

    /* ---------------- name ---------------- */

    function sanitize(raw) {
        // Strip control characters and angle brackets, collapse whitespace,
        // and cap the length. Keeps Firestore keys and the DOM safe.
        var s = String(raw == null ? '' : raw);
        s = s.replace(/[\u0000-\u001f<>]/g, '');
        s = s.replace(/\s+/g, ' ').trim();
        if (s.length > MAX_NAME) s = s.slice(0, MAX_NAME);
        return s;
    }

    function hasName() {
        try {
            return !!sanitize(localStorage.getItem(NAME_KEY));
        } catch (e) {
            return false;
        }
    }

    function getName() {
        try {
            return sanitize(localStorage.getItem(NAME_KEY)) || DEFAULT_NAME;
        } catch (e) {
            return DEFAULT_NAME;
        }
    }

    function setName(raw) {
        var clean = sanitize(raw);
        if (!clean) return false;
        try {
            localStorage.setItem(NAME_KEY, clean);
        } catch (e) {
            return false;
        }
        // Reflect the new name on the board without waiting for the next run.
        submit({ force: false });
        return true;
    }

    /* ---------------- stats to publish ---------------- */

    function num(key, fallback) {
        var v = parseInt(localStorage.getItem(key) || '', 10);
        return isFinite(v) && v >= 0 ? v : (fallback || 0);
    }

    function trophies() {
        var q = Math.min(num('tournamentQualifiersWinCount'), MAX_TROPHIES_PER_CUP);
        var c = Math.min(num('tournamentChampionsWinCount'), MAX_TROPHIES_PER_CUP);
        return q + c;
    }

    /* Which name should the board show?
     *
     * When an account is signed in, the ACCOUNT username is the player's real
     * name, so that is what the board must show. The board used to read
     * gdPlayerName only, which is a separate setting - so the two disagreed,
     * and a rename never reached the board.
     */
    function boardName() {
        try {
            if (window.GDAccount && window.GDAccount.isSignedIn()) {
                var clean = sanitize(window.GDAccount.username());
                if (clean) return clean;
            }
        } catch (e) { /* fall through to the local name */ }
        return getName();
    }

    function currentStats() {
        return {
            name: boardName(),
            highScore: num('goalDefenderHighScore'),
            deflections: num('goalDefenderDeflections'),
            trophies: trophies()
        };
    }

    /* ---------------- Firestore plumbing ---------------- */

    var sdkPromise = null;
    var firestore = null;
    var authedUser = null;
    var unavailableReason = hasConfig() ? null : 'not-configured';

    function loadSdk() {
        if (sdkPromise) return sdkPromise;
        if (!hasConfig()) {
            unavailableReason = 'not-configured';
            return Promise.reject(new Error('Firebase not configured'));
        }
        sdkPromise = new Promise(function (resolve, reject) {
            var base = 'https://www.gstatic.com/firebasejs/10.12.2';
            var needed = 3;
            var done = false;
            function fail(e) {
                if (done) return;
                done = true;
                unavailableReason = 'sdk-failed';
                reject(e);
            }
            function maybe() {
                needed--;
                if (needed <= 0 && !done) {
                    done = true;
                    try {
                        // eslint-disable-next-line no-undef
                        window.firebase.initializeApp(GD_FIREBASE);
                        firestore = window.firebase.firestore();
                        resolve(firestore);
                    } catch (e) {
                        unavailableReason = 'init-failed';
                        reject(e);
                    }
                }
            }
            function inject(url) {
                var s = document.createElement('script');
                s.src = url;
                s.onload = maybe;
                s.onerror = function () { fail(new Error('failed to load ' + url)); };
                document.head.appendChild(s);
            }
            inject(base + '/firebase-app-compat.js');
            inject(base + '/firebase-firestore-compat.js');
            inject(base + '/firebase-auth-compat.js');

            setTimeout(function () { fail(new Error('sdk timeout')); }, NETWORK_TIMEOUT_MS);
        });
        return sdkPromise;
    }

    /* ONE identity, and never destroy an existing session.
     *
     * Two faults lived here.
     *
     * 1. It always called signInAnonymously(), so a signed-in player had TWO
     *    identities at once: an anonymous uid for the leaderboard and an email
     *    uid for the account. Two documents, one person. That is what made the
     *    board and the account disagree on a name, and what left the same name
     *    on two rows.
     *
     * 2. THE ONE THAT LOGGED EVERYBODY OUT. Firebase restores a persisted
     *    session asynchronously, so for a moment after page load
     *    auth.currentUser is null even though a signed-in session exists. The
     *    menu publishes within that window, sees null, and calls
     *    signInAnonymously() - which SILENTLY REPLACES the stored session with
     *    a new anonymous one. The account session is destroyed by the act of
     *    checking it, so every refresh logged the player out.
     *
     * Now: wait for auth to actually settle before deciding, then reuse
     * whatever session exists. Only a genuinely signed-out player gets an
     * anonymous identity.
     */
    var authReadyPromise = null;

    function waitForAuthReady() {
        if (authReadyPromise) return authReadyPromise;
        authReadyPromise = new Promise(function (resolve) {
            var settled = false;
            function finish() {
                if (settled) return;
                settled = true;
                resolve();
            }
            var auth = window.firebase.auth();
            // If a user is already present, nothing to wait for.
            if (auth.currentUser) return finish();
            try {
                // onAuthStateChanged fires once with the restored session (or
                // with null when there genuinely is none), which is exactly the
                // signal we need.
                var unsub = auth.onAuthStateChanged(function (user) {
                    if (user) { authedUser = user; }
                    try { if (typeof unsub === 'function') unsub(); } catch (e) { }
                    finish();
                });
            } catch (e) {
                finish();
            }
            // Never hang the game on auth. A player with no network still gets
            // to play; they just publish anonymously or not at all.
            setTimeout(finish, NETWORK_TIMEOUT_MS);
        });
        return authReadyPromise;
    }

    function ensureSignedIn() {
        return loadSdk()
            .then(waitForAuthReady)
            .then(function () {
                var auth = window.firebase.auth();
                if (auth.currentUser) {
                    authedUser = auth.currentUser;
                    return authedUser;
                }
                return auth.signInAnonymously().then(function (cred) {
                    authedUser = cred.user;
                    /* Remember the anonymous id. Once an account signs in,
                     * auth.currentUser becomes the ACCOUNT and this id is gone
                     * from the session - so it has to be written down for the
                     * old leaderboard row to be found and cleaned up later. */
                    try {
                        if (cred.user && cred.user.uid) {
                            localStorage.setItem(ANON_UID_KEY, cred.user.uid);
                        }
                    } catch (e) { /* private mode - nothing to do */ }
                    return authedUser;
                });
            });
    }

    /* Fold this device's anonymous leaderboard row into the account, then
     * delete it.
     *
     * Called after a successful sign-in or sign-up. One person was two rows:
     * the anonymous id they played under before having an account, and the
     * account afterwards. The anonymous row was never removed, so the board
     * kept a ghost of every player who had since made an account - often with
     * a different capitalisation, so "HAMZA" sat next to "hamza" and neither
     * row could be identified as the same person.
     *
     * The stats are copied across first, keeping whichever is better, so no
     * score is lost. Only then is the old row deleted, leaving the account as
     * the single identity. */
    function retireAnonymousRow(accountUid) {
        if (!accountUid || !hasConfig()) return Promise.resolve({ ok: false, skipped: 'no-uid' });

        var anonUid = '';
        try { anonUid = localStorage.getItem(ANON_UID_KEY) || ''; } catch (e) { anonUid = ''; }

        function forget() {
            try { localStorage.removeItem(ANON_UID_KEY); } catch (e) { /* ignore */ }
        }

        if (!anonUid) return Promise.resolve({ ok: false, skipped: 'no-anon-row' });
        // The signed-in account IS the anonymous session (signed out and back
        // in on the same identity): there is no second row to clean up.
        if (anonUid === accountUid) { forget(); return Promise.resolve({ ok: true, skipped: 'same-identity' }); }

        return loadSdk()
            .then(function () {
                return firestore.collection(COLLECTION).doc(anonUid).get();
            })
            .then(function (snap) {
                if (!snap.exists) { forget(); return { ok: true, skipped: 'nothing-to-retire' }; }
                var old = snap.data() || {};
                var carried = {
                    highScore: num0(old.highScore),
                    deflections: num0(old.deflections),
                    trophies: num0(old.trophies)
                };
                return firestore.collection(COLLECTION).doc(accountUid).get()
                    .then(function (mine) {
                        var cur = mine.exists ? (mine.data() || {}) : {};
                        var best = {
                            highScore: Math.max(num0(cur.highScore), carried.highScore),
                            deflections: Math.max(num0(cur.deflections), carried.deflections),
                            trophies: Math.max(num0(cur.trophies), carried.trophies)
                        };
                        if (mine.exists &&
                            best.highScore === num0(cur.highScore) &&
                            best.deflections === num0(cur.deflections) &&
                            best.trophies === num0(cur.trophies)) {
                            /* The account already holds everything the old row
                             * did, so there is nothing to copy - go straight to
                             * deleting the duplicate. */
                            return null;
                        }
                        return firestore.collection(COLLECTION).doc(accountUid)
                            .set({
                                name: cur.name || getName(),
                                highScore: best.highScore,
                                deflections: best.deflections,
                                trophies: best.trophies,
                                updatedAt: new Date().toISOString()
                            }, { merge: true });
                    })
                    .then(function () {
                        return firestore.collection(COLLECTION).doc(anonUid).delete();
                    })
                    .then(function () {
                        forget();
                        return { ok: true, carried: carried };
                    });
            })
            .catch(function () {
                /* Delete is denied until the rules allow an owner to remove
                 * their own row, and an offline device cannot reach the server.
                 * Neither is worth failing a sign-in over. */
                return { ok: false, error: 'retire-failed' };
            });
    }

    /* ---------------- anti-abuse ---------------- */

    var lastSubmitted = null;
    var submissionsThisSession = 0;

    /* A page reload used to reset the counter, but the cap was low enough that
     * an ordinary session hit it: play a few runs, improve your score, and the
     * write was silently dropped as "rate-limited" - the player saw a new best
     * on the results screen that never reached the board, with no error
     * anywhere. isImprovement() is the real brake (a replay cannot beat your
     * own best), so this cap only needs to stop a genuine flood. */
    var MAX_SUBMISSIONS_PER_SESSION = 40;

    function looksCheaty(stats) {
        // These ceilings MUST match firestore.rules, otherwise a legitimate
        // value gets written here and then rejected server-side. The rules are
        // the real check; this just saves a pointless round trip.
        var MAX_SCORE = 1000000;
        var MAX_DEFLECTS = 100000000;
        var MAX_TROPHIES = 9999;
        if (stats.highScore > MAX_SCORE) return true;
        if (stats.deflections > MAX_DEFLECTS) return true;
        if (stats.trophies > MAX_TROPHIES) return true;
        return false;
    }

    function isImprovement(stats) {
        /* Only write when something actually got better. This is the real brake
         * on spam: a replay cannot beat your own best, so replays write nothing.
         *
         * Previously this compared only against what had been written THIS page
         * load. After a refresh lastSubmitted was null again, so the first write
         * of every visit went out even when the score was worse than the board
         * already showed - which is how a worse score could overwrite a better
         * one. Comparing against the best of this session AND the value already
         * on the board closes that.
         */
        if (!lastSubmitted) return true;
        return stats.highScore > lastSubmitted.highScore
            || stats.trophies > lastSubmitted.trophies;
    }

    function submit(opts) {
        opts = opts || {};
        if (!hasConfig()) return Promise.resolve({ skipped: 'not-configured' });
        if (submissionsThisSession >= MAX_SUBMISSIONS_PER_SESSION) {
            return Promise.resolve({ skipped: 'rate-limited' });
        }

        var stats = currentStats();
        if (looksCheaty(stats)) return Promise.resolve({ skipped: 'implausible' });
        if (!opts.force && !isImprovement(stats)) {
            return Promise.resolve({ skipped: 'not-an-improvement' });
        }

        submissionsThisSession++;

        return ensureSignedIn().then(function (user) {
            var payload = {
                name: stats.name,
                highScore: stats.highScore,
                deflections: stats.deflections,
                trophies: stats.trophies,
                updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            };
            /* Mark rows written while signed in ANONYMOUSLY.
             *
             * Once the player makes an account they are no longer the owner of
             * the anonymous row, so the security rules refuse to let them delete
             * it - which left a permanent ghost on the board under the name they
             * used before having an account. This flag is what lets a signed-in
             * player retire exactly those rows, and only those.
             *
             * A signed-in account writes no flag, so an account row can never be
             * deleted by anyone but its owner. */
            if (user && user.isAnonymous) payload.anon = true;
            // merge:true keeps any other fields a future version writes, and
            // never clears the document if one write is lost.
            return firestore.collection(COLLECTION)
                .doc(user.uid)
                .set(payload, { merge: true })
                .then(function () {
                    lastSubmitted = stats;
                    return { ok: true, uid: user.uid, stats: stats };
                });
        }).catch(function (e) {
            // Never surface this to the player: a board is not worth an error.
            return { skipped: 'error', error: String(e && e.message || e) };
        });
    }

    /* ---------------- reads ---------------- */

    function fetchBoard(field) {
        if (!hasConfig()) return Promise.resolve([]);
        if (field !== 'highScore' && field !== 'trophies') {
            return Promise.resolve([]);
        }
        return loadSdk().then(function () {
            return firestore.collection(COLLECTION)
                .orderBy(field, 'desc')
                .limit(50)
                .get();
        }).then(function (snap) {
            var rows = [];
            snap.forEach(function (doc) {
                var d = doc.data() || {};
                rows.push({
                    name: sanitize(d.name) || DEFAULT_NAME,
                    highScore: num0(d.highScore),
                    deflections: num0(d.deflections),
                    trophies: num0(d.trophies)
                });
            });
            return rows;
        }).catch(function () {
            return [];
        });
    }

    function num0(v) {
        var n = parseInt(v || 0, 10);
        return isFinite(n) && n >= 0 ? n : 0;
    }

    window.GDPlayer = {
        NAME_KEY: NAME_KEY,
        DEFAULT_NAME: DEFAULT_NAME,
        MAX_NAME: MAX_NAME,

        hasName: hasName,
        getName: getName,
        setName: setName,
        sanitize: sanitize,

        currentStats: currentStats,
        trophies: trophies,

submit: submit,
        fetchBoard: fetchBoard,
        retireAnonymousRow: retireAnonymousRow,

        isConfigured: hasConfig,
        // Lets Settings show the board link only when it can work.
        status: function () { return unavailableReason || 'ready'; },

        /* Shared with account.js (Part 8) so the Firebase SDK is only ever
         * injected once. Both resolve the same promise. */
        loadSdk: loadSdk,
        firestore: function () { return firestore; },
        auth: function () { return window.firebase.auth(); },

        /* Drop the cached "already published" baseline.
         *
         * lastSubmitted is the highest score this browser has pushed, and
         * isImprovement() compares against it, so it only ever ratchets upward.
         * After an account switch the incoming account's first score was being
         * judged against the PREVIOUS account's best: a second account scoring
         * 120 could be told "not an improvement" against a first account's 900
         * and never reach the board at all, which is how a player ends up
         * invisible on the leaderboard.
         *
         * Called by account.js on a switch. Deliberately does not touch
         * submissionsThisSession - that is a rate limit against a hostile
         * client, not per-account state, and resetting it would be a freebie. */
        forgetSubmitted: function () { lastSubmitted = null; }
    };
})();