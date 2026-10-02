/* account.js — optional accounts (Part 8).
 *
 * Accounts are OPTIONAL. The game is fully playable signed out, and nothing
 * here may ever block play. Every path returns a resolved value; failures are
 * reported as { ok:false, error } rather than thrown.
 *
 * What signing in does to your progress:
 *   - FIRST time on an account: the current local save is uploaded and becomes
 *     that account's progress.
 *   - Returning to an account: the account's progress overwrites local.
 *   - While signed in: local changes are pushed to the account (debounced).
 *
 * Firebase config lives in player.js; the SDK is shared with the leaderboard,
 * so nothing is injected twice.
 */
(function () {
    'use strict';

    var P = window.GDPlayer;

    var ACCOUNT_COLLECTION = 'accounts';
    var SYNC_DEBOUNCE_MS = 1500;
    var USERNAME_CHANGE_COOLDOWN_DAYS = 7;
    var MIN_PASSWORD = 6;
    var MAX_USERNAME = 14;

    var currentUser = null;        // Firebase user or null
    var currentAccount = null;     // { uid, username, createdAt, stats }
    var syncTimer = 0;
    var listeners = [];

    /* localStorage keys that make up a save. Order matters for readability
     * only; the whole object is written under one cloud document. */
    var SAVE_KEYS = [
        'goalDefenderMoney',
        'goalDefenderHighScore',
        'goalDefenderDeflections',
        'goalDefenderMaxSpeedBoost',
        'goalDefenderOwnedBalls',
        'goalDefenderEquippedBall',
        'goalDefenderTournamentWins',
        'goalDefenderQualifiersWins',
        'goalDefenderChampionsWins',
        'goalDefenderTournamentsPlayed',
        'tournamentQualifiersWinCount',
        'tournamentChampionsWinCount',
        'gdAchievements',
        'gdAchievementsClaimed',
        'gdPlayerName'
    ];

    function readSave() {
        var out = {};
        SAVE_KEYS.forEach(function (k) {
            var v = localStorage.getItem(k);
            if (v !== null) out[k] = v;
        });
        return out;
    }

    /** Overwrite local with the account's save. Keys absent from the account
     *  are left alone so a partial save cannot wipe unrelated progress. */
    function writeSave(stats) {
        if (!stats) return;
        Object.keys(stats).forEach(function (k) {
            if (SAVE_KEYS.indexOf(k) === -1) return;   // never trust the cloud
            localStorage.setItem(k, stats[k]);
        });
    }

    /* Merge a cloud save into local storage instead of overwriting it.
     *
     * The cloud copy used to be applied wholesale, which silently destroyed
     * progress: play a run, close the tab before the 1.5s debounce fires, come
     * back later, and the reload replaced your newer local save with the older
     * cloud one. Your money and best score went backwards with no warning.
     *
     * Every cumulative stat here only ever goes UP, and the two list-shaped
     * keys are sets that only ever grow, so taking the better of each is
     * always correct and can never invent progress:
     *
     *   - money, deflections, speed boost, wins, high score -> the larger value
     *   - owned balls, unlocked/claimed achievements    -> the union
     *   - equipped ball                                   -> whichever device
     *   - player name                                     -> the account name
     */
    var MONOTONE_NUMBERS = [
        'goalDefenderMoney',
        'goalDefenderHighScore',
        'goalDefenderDeflections',
        'goalDefenderMaxSpeedBoost',
        'goalDefenderTournamentWins',
        'goalDefenderQualifiersWins',
        'goalDefenderChampionsWins',
        'goalDefenderTournamentsPlayed',
        'tournamentQualifiersWinCount',
        'tournamentChampionsWinCount'
    ];

    var UNIONS = [
        'goalDefenderOwnedBalls',
        'gdAchievements',
        'gdAchievementsClaimed'
    ];

    function numOf(key) {
        var v = parseInt(localStorage.getItem(key) || '', 10);
        return isFinite(v) && v >= 0 ? v : 0;
    }

    function jsonOf(key) {
        try { return JSON.parse(localStorage.getItem(key) || '{}'); }
        catch (e) { return {}; }
    }

    function localListOf(key) {
        try {
            var v = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(v) ? v : [];
        } catch (e) { return []; }
    }

    /* Union of two JSON objects. Achievement entries are timestamps, so the
     * later one wins - either way the achievement stays unlocked. */
    function unionObjects(a, b) {
        var out = {};
        Object.keys(a || {}).forEach(function (k) { out[k] = a[k]; });
        Object.keys(b || {}).forEach(function (k) {
            if (out[k] === undefined) { out[k] = b[k]; return; }
            var x = parseInt(out[k], 10), y = parseInt(b[k], 10);
            if (isFinite(x) && isFinite(y)) out[k] = String(Math.max(x, y));
            else if (out[k] === null) out[k] = b[k];
        });
        return out;
    }

    function unionLists(a, b) {
        var seen = {};
        var out = [];
        [].concat(a || [], b || []).forEach(function (v) {
            var k = String(v);
            if (!seen[k]) { seen[k] = true; out.push(v); }
        });
        return out;
    }

    function mergeSave(cloud) {
        if (!cloud) return;

        MONOTONE_NUMBERS.forEach(function (k) {
            if (cloud[k] === undefined) return;
            var remote = parseInt(cloud[k], 10);
            if (!isFinite(remote) || remote < 0) return;      // ignore junk
            if (remote > numOf(k)) localStorage.setItem(k, String(remote));
        });

        UNIONS.forEach(function (k) {
            if (cloud[k] === undefined) return;
            var merged;
            if (k === 'goalDefenderOwnedBalls') {
                /* The cloud may hand back either a parsed array or the raw JSON
                 * string, depending on how the document was written. Accept
                 * both, or the union silently produces garbage. */
                var localList = localListOf(k);
                var remoteList = cloud[k];
                if (typeof remoteList === 'string') {
                    try { remoteList = JSON.parse(remoteList); } catch (e) { remoteList = []; }
                }
                merged = unionLists(localList, remoteList);
            } else {
                var remoteObj = cloud[k];
                if (typeof remoteObj === 'string') {
                    try { remoteObj = JSON.parse(remoteObj); } catch (e) { remoteObj = {}; }
                }
                merged = unionObjects(jsonOf(k), remoteObj);
            }
            if (merged && Object.keys(merged).length) localStorage.setItem(k, JSON.stringify(merged));
        });

        // Preference, not a total: whatever this device had equipped stands.
        if (cloud['goalDefenderEquippedBall'] && !localStorage.getItem('goalDefenderEquippedBall')) {
            localStorage.setItem('goalDefenderEquippedBall', cloud['goalDefenderEquippedBall']);
        }
        // The account name is authoritative.
        if (currentAccount && currentAccount.username) {
            localStorage.setItem('gdPlayerName', currentAccount.username);
        }
    }

    function err(e) {
        return { ok: false, error: friendlyError(e) };
    }

    /** serverTimestamp() with a graceful fallback.
     *  Firestore.FieldValue is not present on every build of the compat SDK,
     *  and an undefined property here would throw *during* sign-up - exactly
     *  when the player least wants a failure. */
    function ts() {
        try {
            if (window.firebase && window.firebase.firestore &&
                window.firebase.firestore.FieldValue &&
                window.firebase.firestore.FieldValue.serverTimestamp) {
                return window.firebase.firestore.FieldValue.serverTimestamp();
            }
        } catch (e) { /* fall through */ }
        return new Date();
    }

    // Firebase error codes are machine strings; players need English.
    function friendlyError(e) {
        var code = (e && e.code) || '';
        switch (code) {
            case 'auth/email-already-in-use':
                return 'That username is already taken.';
            case 'auth/invalid-email':
                return 'That username is not valid.';
            case 'auth/missing-password':
                return 'Enter a password.';
            case 'auth/weak-password':
                return 'Password must be at least ' + MIN_PASSWORD + ' characters.';
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                return 'Wrong username or password.';
            case 'auth/user-not-found':
                return 'No account with that username.';
            case 'auth/too-many-requests':
                return 'Too many attempts. Wait a minute and try again.';
            case 'auth/network-request-failed':
                return 'No connection. Check your network.';
            case 'permission-denied':
            case 'missing-or-insufficient-permissions':
                return 'Signed in, but cloud save is not available yet.';
            default:
                return (e && e.message) ? String(e.message) : 'Something went wrong.';
        }
    }

    function onChange(fn) { listeners.push(fn); }

    function emit() {
        listeners.forEach(function (fn) {
            try { fn(); } catch (e) { /* a listener must not break auth */ }
        });
    }

    /* ---------------- username rules ---------------- */

    function cleanUsername(raw) {
        // Accounts are keyed by the username in this build, so it is treated as
        // an identifier: lowercase, no spaces, limited length.
        var s = String(raw == null ? '' : raw);
        s = s.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase();
        if (s.length > MAX_USERNAME) s = s.slice(0, MAX_USERNAME);
        return s;
    }

    function usernameError(raw, password, confirm) {
        var u = cleanUsername(raw);
        if (u.length < 3) return 'Username needs at least 3 characters (letters, numbers, _ or .).';
        if (!password || password.length < MIN_PASSWORD) {
            return 'Password must be at least ' + MIN_PASSWORD + ' characters.';
        }
        if (confirm !== undefined && password !== confirm) return 'Passwords do not match.';
        return null;
    }

    /* ---------------- cooldown ---------------- */

    function msSinceChange() {
        var last = parseInt(localStorage.getItem('gdAccountNameChangedAt') || '0', 10);
        if (!isFinite(last) || last <= 0) return Infinity;
        return Date.now() - last;
    }

    function canChangeUsername() {
        return msSinceChange() > USERNAME_CHANGE_COOLDOWN_DAYS * 86400000;
    }

    function msUntilNameChange() {
        if (canChangeUsername()) return 0;
        return USERNAME_CHANGE_COOLDOWN_DAYS * 86400000 - msSinceChange();
    }

    /* ---------------- sync ---------------- */

    function pushToCloud() {
        if (!currentUser) return Promise.resolve({ ok: true, skipped: 'signed-out' });
        return P.firestore().collection(ACCOUNT_COLLECTION).doc(currentUser.uid)
            .set({
                username: currentAccount ? currentAccount.username : (P.getName() || 'player'),
                email: currentUser.email || '',
                save: readSave(),
                updatedAt: ts()
            }, { merge: true })
            .then(function () { return { ok: true }; })
            .catch(err);
    }

    /** Coalesce rapid local changes into one write. */
    function scheduleSync() {
        if (!currentUser) return;
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(function () {
            syncTimer = 0;
            pushToCloud();
        }, SYNC_DEBOUNCE_MS);
    }

    /** Force an immediate push, e.g. on scene change or page hide. */
    function flush() {
        if (!currentUser) return Promise.resolve();
        if (syncTimer) { clearTimeout(syncTimer); syncTimer = 0; }
        return pushToCloud();
    }

    /* ---------------- auth actions ---------------- */

    function applyAccount(doc) {
        if (!doc) return;
        var data = doc.data() || {};
        currentAccount = {
            uid: doc.id,
            username: data.username || 'player',
            createdAt: data.createdAt || null,
            lastLogin: data.lastLogin || null,
            // The save MUST be carried here. Without it the caller had nothing
            // to write back, and logging in silently kept local progress.
            save: data.save || null
        };
    }

    /* Who is signed in, if anyone?
     *
     * The old code called auth.getCurrentUser(), which does NOT exist in the
     * Firebase compat SDK v10 that player.js loads. It threw
     *
     *   TypeError: auth.getCurrentUser is not a function
     *
     * inside restore(), whose .catch() then reported "signed out". So even once
     * restore() was wired up it silently failed, and the player was logged out
     * on every single refresh - the exact symptom being reported.
     *
     * auth.currentUser is the synchronous, supported equivalent. getCurrentUser
     * is kept only as a fallback for an older SDK, and only if it is a function.
     */
    function currentFirebaseUser() {
        var auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
        if (!auth) return null;
        if (auth.currentUser) return Promise.resolve(auth.currentUser);
        if (typeof auth.getCurrentUser === 'function') {
            try { return Promise.resolve(auth.getCurrentUser()); }
            catch (e) { return Promise.resolve(null); }
        }
        return Promise.resolve(null);
    }

    /* Wait until Firebase has finished restoring any persisted session before
     * deciding whether anyone is signed in.
     *
     * auth.currentUser is null for a short window after page load even when a
     * session exists on disk. Reading it immediately made the game conclude
     * "signed out" on every single refresh. onAuthStateChanged fires exactly
     * once with the settled answer, so that is the signal to wait for. The
     * timeout means a player offline or blocked by an ad blocker still reaches
     * the menu - they just appear signed out, which is honest.
     */
    function waitForAuthSettled() {
        var auth = window.firebase && window.firebase.auth ? window.firebase.auth() : null;
        if (!auth) return Promise.resolve(null);
        if (auth.currentUser) return Promise.resolve(auth.currentUser);

        return new Promise(function (resolve) {
            var done = false;
            function finish(user) {
                if (done) return;
                done = true;
                resolve(user || null);
            }
            try {
                var unsub = auth.onAuthStateChanged(function (user) {
                    try { if (typeof unsub === 'function') unsub(); } catch (e) { }
                    finish(user);
                });
            } catch (e) {
                finish(null);
            }
            setTimeout(function () { finish(null); }, 6000);
        });
    }

    /* Did the Firestore read fail because the security rules have not been
     * published yet? Authentication is a separate service, so the sign-in
     * genuinely succeeded - this must never be reported as a failed login. */
    function missingRules(e) {
        var code = (e && e.code) || '';
        if (code === 'permission-denied' || code === 'missing-or-insufficient-permissions') return true;
        return /permission|insufficient/i.test(String((e && e.message) || e));
    }

function afterAuth(user, typedUsername) {
        currentUser = user;
        if (!user) {
            currentAccount = null;
            return Promise.resolve({ ok: true, signedOut: true });
        }
        return P.firestore().collection(ACCOUNT_COLLECTION).doc(user.uid).get()
            .then(function (snap) {
                if (snap.exists) {
                    // Returning player. The account is the source of truth for
                    // the name, but the SAVE is merged rather than applied
                    // wholesale - see mergeSave(). Overwriting meant progress
                    // made since the last sync silently disappeared.
                    applyAccount(snap);
                    mergeSave(currentAccount.save);
                    return P.firestore().collection(ACCOUNT_COLLECTION).doc(user.uid)
                        .set({ lastLogin: ts() },
                            { merge: true })
                        .then(function () {
                            emit();
                            return { ok: true, isNew: false, username: currentAccount.username };
                        });
                }
                // Brand new account: upload this browser's save as its progress.
                // The username TYPED is the account's name. Using the local
                // player name here would save every new account as "PLAYER".
                var name = typedUsername || P.getName() || 'player';
                currentAccount = { uid: user.uid, username: name, createdAt: null };
                return P.firestore().collection(ACCOUNT_COLLECTION).doc(user.uid)
                    .set({
                        username: name,
                        email: user.email || '',
                        save: readSave(),
                        createdAt: ts(),
                        updatedAt: ts()
                    })
                    .then(function () {
                        emit();
                        return { ok: true, isNew: true, username: name };
                    });
            })
            .catch(function (e) {
                // Auth succeeded; only the cloud save failed. Say so, but do
                // NOT tell the player the login failed.
                if (missingRules(e)) {
                    currentAccount = currentAccount || {
                        uid: user.uid,
                        username: typedUsername || P.getName() || 'player',
                        createdAt: null,
                        save: null
                    };
                    emit();
                    return {
                        ok: true,
                        syncOff: true,
                        isNew: true,
                        username: currentAccount.username
                    };
                }
                return err(e);
            });
    }

    /** Firebase wants an email; the player typed a username. Deriving a
     *  throwaway address keeps one field in the UI. */
    function fakeEmail(username) {
        return username + '@goaldefender.player';
    }

    /* The Firebase SDK is injected by script tag, so window.firebase does not
     * exist until loadSdk() resolves. Calling P.auth() straight away threw
     *
     *   TypeError: Cannot read properties of undefined (reading 'auth')
     *
     * for anyone who tapped SIGN UP before the SDK finished arriving - most
     * likely on a slow mobile connection, on a first visit. Every auth entry
     * point routes through here so the wait is handled once and a load failure
     * becomes an English message rather than a console stack trace. */
    function withAuth(fn) {
        if (!P.isConfigured()) {
            return Promise.resolve({
                ok: false,
                error: 'Accounts are not available in this build.'
            });
        }
        return P.loadSdk().then(function () {
            var auth = P.auth();
            if (!auth) {
                // SDK loaded but exposed no auth handle. Treat it the same as a
                // failed load rather than surfacing a raw internal string.
                return {
                    ok: false,
                    error: 'Could not reach the account service. Check your connection.'
                };
            }
            return fn(auth);
        }).catch(function (e) {
            // loadSdk() records why it failed; translate that into English.
            var st = P.status();
            if (st === 'sdk-failed' || st === 'init-failed' || st === 'not-configured') {
                return {
                    ok: false,
                    error: 'Could not reach the account service. Check your connection.'
                };
            }
            return err(e);
        });
    }

    function signUp(rawUsername, password, confirm) {
        var bad = usernameError(rawUsername, password, confirm);
        if (bad) return Promise.resolve({ ok: false, error: bad });
        var u = cleanUsername(rawUsername);
        return withAuth(function (auth) {
            return auth.createUserWithEmailAndPassword(fakeEmail(u), password)
                .then(function (cred) { return afterAuth(cred.user, u); });
        });
    }

    function signIn(rawUsername, password) {
        var u = cleanUsername(rawUsername);
        if (u.length < 3) return Promise.resolve({ ok: false, error: 'Enter your username.' });
        if (!password) return Promise.resolve({ ok: false, error: 'Enter a password.' });
        return withAuth(function (auth) {
            return auth.signInWithEmailAndPassword(fakeEmail(u), password)
                .then(function (cred) { return afterAuth(cred.user, u); });
        });
    }

    function signOut() {
        // Deliberately NOT flushing here. Anything played while signed out
        // belongs to the device, not the account - and on the next sign-in the
        // account's progress is MERGED in (see mergeSave), which is the whole
        // point. Flushing on sign-out would let local scribbles overwrite the
        // account. Progress made while signed in is pushed on a debounce and on
        // page hide (see the listener installed below).
        return Promise.resolve()
            .then(function () {
                if (window.firebase && window.firebase.auth) {
                    return window.firebase.auth().signOut();
                }
            })
            .then(function () {
                currentUser = null;
                currentAccount = null;
                emit();
                return { ok: true };
            })
            .catch(function () {
                // Never trap someone in a signed-in state because a write failed.
                currentUser = null;
                currentAccount = null;
                emit();
                return { ok: true };
            });
    }

    /* Last-chance push. A debounced write can still be pending when the tab is
     * closed or backgrounded on a phone, which would lose the final run. */
    function installLifecycleFlush() {
        if (typeof window.addEventListener !== 'function') return;
        var lastFlush = 0;
        var onHide = function () {
            if (!currentUser) return;
            // Throttle: iOS fires visibilitychange repeatedly.
            var now = Date.now();
            if (now - lastFlush < 1500) return;
            lastFlush = now;
            flush();
        };
        window.addEventListener('pagehide', onHide);
        window.addEventListener('beforeunload', onHide);
        if (window.document) {
            window.document.addEventListener('visibilitychange', function () {
                if (window.document.visibilityState === 'hidden') onHide();
            });
        }
    }

    /** Change the display name, at most once a week. */
    function changeUsername(raw) {
        if (!currentUser) return Promise.resolve({ ok: false, error: 'Not signed in.' });
        if (!canChangeUsername()) {
            var mins = Math.ceil(msUntilNameChange() / 60000);
            var when = mins > 90 ? Math.ceil(mins / 1440) + ' day(s)' : Math.round(mins) + ' minutes';
            return Promise.resolve({ ok: false, error: 'You can change your name again in ' + when + '.' });
        }
        var name = P.sanitize(raw);
        if (!name) return Promise.resolve({ ok: false, error: 'Enter a name.' });

        /* currentAccount can legitimately be null here: the sign-in succeeded
         * but reading the account document failed (offline, or the rules were
         * not published yet). The old code did
         *
         *     currentAccount.username = name;
         *
         * which threw "Cannot set properties of null (setting 'username')" and
         * left the rename half-applied - the cooldown timer was already set, so
         * the player was then locked out of renaming for a week having changed
         * nothing. Build the object instead of mutating one that may not exist,
         * and only start the cooldown once the write has actually succeeded.
         */
        var previous = currentAccount;
        currentAccount = {
            uid: currentUser.uid,
            username: name,
            createdAt: previous ? previous.createdAt : null,
            lastLogin: previous ? previous.lastLogin : null,
            save: previous ? previous.save : null
        };
        P.setName(name);

        return P.firestore().collection(ACCOUNT_COLLECTION).doc(currentUser.uid)
            .set({ username: name, updatedAt: ts() }, { merge: true })
            .then(function () {
                // Only now does the rename count.
                localStorage.setItem('gdAccountNameChangedAt', String(Date.now()));
                // Push the rest of the save too, so the board and the account
                // agree immediately rather than on the next debounce.
                return flush();
            })
            .then(function () {
                emit();
                return { ok: true, username: name };
            })
            .catch(function (e) {
                // Roll the local name back so the UI matches the cloud.
                currentAccount = previous;
                if (previous) P.setName(previous.username);
                return err(e);
            });
    }

    /* ---------------- stats for the account page ---------------- */

    function localStats() {
        var stats = P.currentStats();
        stats.money = parseInt(localStorage.getItem('goalDefenderMoney') || '0', 10) || 0;
        stats.ownedBalls = JSON.parse(localStorage.getItem('goalDefenderOwnedBalls') || '[]');
        stats.equippedBall = localStorage.getItem('goalDefenderEquippedBall') || 'default';
        var ach = {};
        var claimed = {};
        try { ach = JSON.parse(localStorage.getItem('gdAchievements') || '{}'); } catch (e) {}
        try { claimed = JSON.parse(localStorage.getItem('gdAchievementsClaimed') || '{}'); } catch (e) {}
        stats.achievementsUnlocked = Object.keys(ach).length;
        stats.achievementsClaimed = Object.keys(claimed).length;
        stats.tournamentsWon = parseInt(localStorage.getItem('goalDefenderTournamentWins') || '0', 10) || 0;
        return stats;
    }

    /* Restore a session on load so a returning player is not asked to sign in
     * again. Never blocks the menu: failures resolve silently. */
    function restore() {
        installLifecycleFlush();
        if (!P.isConfigured()) return Promise.resolve({ ok: true, skipped: 'not-configured' });
        return P.loadSdk().then(function () {
            if (!window.firebase || !window.firebase.auth) return null;
            return waitForAuthSettled();
        }).then(function (user) {
            if (!user) return { ok: true, signedOut: true };
            return afterAuth(user);
        }).catch(function () {
            return { ok: true, signedOut: true };
        });
    }

    window.GDAccount = {
        isSignedIn: function () { return !!currentUser; },
        currentUser: function () { return currentUser; },
        current: function () { return currentAccount; },
        username: function () { return currentAccount ? currentAccount.username : null; },

        signUp: signUp,
        signIn: signIn,
        signOut: signOut,
        changeUsername: changeUsername,
        restore: restore,
        flush: flush,
        scheduleSync: scheduleSync,
        onChange: onChange,

        cleanUsername: cleanUsername,
        usernameError: usernameError,
        canChangeUsername: canChangeUsername,
        msUntilNameChange: msUntilNameChange,
        localStats: localStats,
        MIN_PASSWORD: MIN_PASSWORD,
        MAX_USERNAME: MAX_USERNAME,
        USERNAME_CHANGE_COOLDOWN_DAYS: USERNAME_CHANGE_COOLDOWN_DAYS
    };
})();