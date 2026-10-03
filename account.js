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

/* Fingerprint of the account document this client last wrote, used to detect
 * an edit made from outside the game. Empty until the first sign-in or push. */
var lastPushedSignature = '';

/* Guards against overlapping pulls: a slow network must not stack requests. */
var pulling = false;

/* How often to look for an outside edit. Ten seconds is quick enough to feel
 * instant and slow enough to be invisible - one small document read. */
var CLOUD_WATCH_MS = 10000;

var cloudWatchTimer = 0;
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
        'gdPlayerName',
        /* Tournament state. Without these, signing in on a second device threw
         * away an in-progress bracket: tournamentRound and tournamentActive
         * decide which match the player is in, so a player who signed in on
         * their phone mid-Champions run came back to the tournament menu with no
         * place in the cup. tournamentChampionsWon matters too - it is the flag
         * that keeps the Champions Cup unlocked, so leaving it off re-locked a
         * cup the player had already earned. */
        'tournamentMode',
        'tournamentRound',
        'tournamentActive',
        'tournamentBracket',
        'tournamentTeamName',
        'tournamentChampionsWon',
        'tournamentProgress',
        'tournamentQualifiersWon',
        'tournamentQualifiersDate',
        'tournamentChampionsDate',
        /* The tutorial award is once-only, so it has to travel or a player who
         * finished it on one device gets the achievement again on another. */
        'gdTutorialDone',
        /* Best SINGLE run figures. These are records, not totals: the "deflect
         * 100 in one run" ladder reads the first, and "10 perfect hits in one
         * run" the second. Synced because a record is exactly the thing a
         * player expects to keep when they move device. Without these a phone
         * would silently forget the player's best run. */
        'goalDefenderBestRunDeflections',
        'goalDefenderBestRunPerfects',
        'goalDefenderPerfectHits',
        /* Consecutive cup wins. Travels with the account so a streak survives a
         * device change - otherwise "3 back to back" would be unachievable for
         * anyone who did not finish three cups on one device. */
        'goalDefenderTournamentStreak',
        /* "Completed a run on a phone". Personal, not progress - it cannot be
         * granted on another device, and it is also not something the account
         * should hand out. Kept local deliberately. */
        /* gdPlayedOnMobile is NOT synced: it is a "has this player ever" flag
         * about the DEVICE, and syncing it would award the achievement to
         * someone who has never played on a phone at all. */
        /* gdAccountNameChangedAt is deliberately NOT synced: the rename
         * cooldown is per-device, so changing device does not reset it. Syncing
         * it would let a player dodge the wait by switching phones. */
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
        'tournamentChampionsWinCount',
        /* Best SINGLE run figures. These are records, and a record only ever
         * goes up, so taking the larger of the two is always correct: a phone
         * cannot talk the account out of the best run it already had. */
        'goalDefenderBestRunDeflections',
        'goalDefenderBestRunPerfects',
        'goalDefenderPerfectHits'
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

    /* localListOf() and unionLists() were only ever used to UNION the owned-ball
     * list. Ball ownership now comes from the account outright (see mergeSave),
     * because a union never removes - signing into a second account inherited
     * every ball the first one owned. Both helpers are dead and removed. */

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

    function mergeSave(cloud) {
        if (!cloud) return;

        MONOTONE_NUMBERS.forEach(function (k) {
            if (cloud[k] === undefined) return;
            var remote = parseInt(cloud[k], 10);
            if (!isFinite(remote) || remote < 0) return;      // ignore junk
            if (remote > numOf(k)) localStorage.setItem(k, String(remote));
        });

        /* Tournament state is not a "maximum", it is a snapshot of where the
         * player was. Taking the newer side wholesale is the right call, with
         * one exception: a device mid-tournament is more current than a cloud
         * copy that says the tournament already finished, so an active local
         * run always wins.
         *
         * Merged before the numeric pass so a stale cloud "tournamentActive:
         * false" cannot cancel a run in progress here. */
        var TOURNAMENT_SNAPSHOT = [
            'tournamentMode', 'tournamentRound', 'tournamentBracket',
            'tournamentTeamName', 'tournamentChampionsWon', 'tournamentProgress',
            'tournamentQualifiersWon', 'tournamentQualifiersDate',
            'tournamentChampionsDate'
        ];
        var localActive = localStorage.getItem('tournamentActive') === 'true';
        TOURNAMENT_SNAPSHOT.forEach(function (k) {
            if (cloud[k] === undefined || cloud[k] === null) return;
            if (localActive && k !== 'tournamentActive') return;  // keep local run
            localStorage.setItem(k, String(cloud[k]));
        });
        if (cloud['tournamentActive'] !== undefined && cloud['tournamentActive'] !== null) {
            // Only the cloud may end a run, never start one the player is in.
            if (!localActive) localStorage.setItem('tournamentActive', String(cloud['tournamentActive']));
        }

        /* gdTutorialDone is a flag, not a total: once true it stays true. */
        if (cloud['gdTutorialDone'] === 'true') {
            localStorage.setItem('gdTutorialDone', 'true');
        }

        /* Ball ownership comes FROM the account, so the account wins outright.
         *
         * This used to be a union, like achievements. Union is right for
         * achievements - unlocking one can only ever add - but it is wrong for
         * purchases. Someone who signs out of their account and into a
         * different one kept every ball the first account owned, because the
         * union never removes. Free balls, on somebody else's account.
         *
         * The account's list replaces local storage, so signing in on a new
         * phone restores exactly the balls that account bought - which is what
         * the player expects - and switching accounts cannot leak purchases.
         *
         * An empty or missing cloud list is IGNORED rather than applied. A save
         * that has not synced yet must never wipe the balls actually on the
         * device; only a real list replaces anything.
         */
        if (cloud['goalDefenderOwnedBalls'] !== undefined && cloud['goalDefenderOwnedBalls'] !== null) {
            var remoteBalls = cloud['goalDefenderOwnedBalls'];
            // The cloud may hand back a parsed array or the raw JSON string,
            // depending on how the document was written. Accept both.
            if (typeof remoteBalls === 'string') {
                try { remoteBalls = JSON.parse(remoteBalls); } catch (e) { remoteBalls = null; }
            }
            if (Array.isArray(remoteBalls) && remoteBalls.length) {
                var list = remoteBalls.filter(function (id) { return typeof id === 'string' && id; });
                /* 'default' is never bought - it is what every save starts with.
                 * Keep it present so a save can never end up with no ball at all. */
                if (list.indexOf('default') === -1) list.unshift('default');
                localStorage.setItem('goalDefenderOwnedBalls', JSON.stringify(list));

                /* An equipped ball the account does not own would render as a
                 * ball the player never bought, so drop it back to default. */
                var equipped = localStorage.getItem('goalDefenderEquippedBall');
                if (equipped && list.indexOf(equipped) === -1) {
                    localStorage.setItem('goalDefenderEquippedBall', 'default');
                }
            }
        }

        UNIONS.forEach(function (k) {
            if (cloud[k] === undefined) return;
            if (k === 'goalDefenderOwnedBalls') return;   // handled above, authoritatively
            var remoteObj = cloud[k];
            if (typeof remoteObj === 'string') {
                try { remoteObj = JSON.parse(remoteObj); } catch (e) { remoteObj = {}; }
            }
            var merged = unionObjects(jsonOf(k), remoteObj);
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

            /* Firestore's own codes are NOT auth codes, and the account flow
             * does plenty of Firestore work: reading the stored account,
             * writing the save, pushing a score. Every one of those used to
             * fall through to the default branch below and show the player
             * the raw machine string - "unavailable", "deadline-exceeded",
             * "internal" - which means nothing to them.
             *
             * Most of these are transient: the same tap a moment later works.
             * The wording says so rather than blaming the player. */
            case 'unavailable':
            case 'deadline-exceeded':
            case 'aborted':
            case 'cancelled':
                return 'No connection right now. Nothing was changed - try again in a moment.';
            case 'resource-exhausted':
            case 'internal':
            case 'unknown':
                return 'The account service had a problem. Nothing was changed - try again in a moment.';
            case 'unauthenticated':
                return 'Your session expired. Sign in again.';

            case 'permission-denied':
            case 'missing-or-insufficient-permissions':
                return 'Signed in, but cloud save is not available yet.';

            default:
                /* Anything still unrecognised is not worth showing verbatim -
                 * Firebase internals can contain request paths and field names
                 * that mean nothing to a player. A generic message is more
                 * honest than a leaked one. */
                return 'Something went wrong. Nothing was changed.';
        }
    }

    /* Subscribe to account changes. Returns an unsubscribe function.
     *
     * It used to return nothing, so a listener could only be added and never
     * removed. A view that registers on open has no way to clean up, and every
     * visit to that view leaks another listener - after a dozen visits a single
     * sign-in runs a dozen stale callbacks against long-dead scenes. Returning
     * the unsubscribe lets callers tie the listener to their lifetime. Existing
     * callers that ignore the return value behave exactly as before. */
    function onChange(fn) {
        listeners.push(fn);
        return function off() {
            var i = listeners.indexOf(fn);
            if (i > -1) listeners.splice(i, 1);
        };
    }

    /* Iterate a COPY. A listener may unsubscribe itself from inside the
     * callback - which is exactly what a view does when it tears down while a
     * change is being delivered - and splicing the live array mid-loop would
     * skip the next listener. */
    function emit() {
        listeners.slice().forEach(function (fn) {
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

        /* Never write without a real account loaded.
         *
         * currentAccount is null whenever the sign-in could not read the stored
         * document. Writing then would push a guessed username and this
         * browser's save over the player's real progress - the bug that made a
         * failed read destroy an account. Refusing is always safe: the next
         * successful sync picks up where this left off. */
        if (!currentAccount) {
            return Promise.resolve({ ok: false, skipped: 'no-account-loaded' });
        }

        var save = readSave();
        return P.firestore().collection(ACCOUNT_COLLECTION).doc(currentUser.uid)
            .set({
                username: currentAccount.username,
                email: currentUser.email || '',
                save: save,
                updatedAt: ts()
            }, { merge: true })
            .then(function () {
                /* Remember exactly what this client wrote.
                 *
                 * This is how a change made OUTSIDE the game is detected. The
                 * player used to have to sign out before an edit in the
                 * Firebase console would stick, because the running game held
                 * its own copy of the save in localStorage and pushed it back
                 * over the edit on the next sync. Comparing the document we
                 * just wrote against the one we later find lets us tell our
                 * own write apart from someone else's. */
                lastPushedSignature = signatureOf(currentAccount.username, save);
                return { ok: true };
            })
            .catch(err);
    }

    /* A stable fingerprint of an account document.
     *
     * Keys are sorted and every value stringified, so the comparison cannot be
     * upset by key ordering or by a number arriving as a string - Firestore
     * hands back whatever type was written, and the console can produce a
     * different one than the game did for the same value. */
    function signatureOf(username, save) {
        var norm = {};
        Object.keys(save || {}).sort().forEach(function (k) {
            norm[k] = String(save[k]);
        });
        return JSON.stringify({ u: username || '', s: norm });
    }

    /* Apply a cloud save OVER local storage, because the cloud is the newer
     * copy and something outside this game changed it.
     *
     * Unlike mergeSave() this does not keep the larger of two numbers. That is
     * the whole point: an owner lowering a score from 69 to 10 in the console
     * expects 10, and a "take the maximum" merge would silently restore 69.
     *
     * Only keys the cloud actually has are touched. A partial document must
     * never blank out progress the cloud has no opinion about. */
    function applyCloudSaveAuthoritative(save) {
        if (!save) return false;

        var touched = false;
        Object.keys(save).forEach(function (k) {
            if (SAVE_KEYS.indexOf(k) === -1) return;   // never trust unknown keys
            if (save[k] === null || save[k] === undefined) return;
            localStorage.setItem(k, String(save[k]));
            touched = true;
        });
        if (!touched) return false;

        /* An equipped ball the owner just removed would still be equipped, and
         * the game would render a ball the player no longer owns. Fall back to
         * the default rather than showing it. */
        var balls;
        try { balls = JSON.parse(localStorage.getItem('goalDefenderOwnedBalls') || '["default"]'); }
        catch (e) { balls = ['default']; }
        if (!Array.isArray(balls) || !balls.length) balls = ['default'];
        if (balls.indexOf('default') === -1) balls.unshift('default');
        localStorage.setItem('goalDefenderOwnedBalls', JSON.stringify(balls));

        var equipped = localStorage.getItem('goalDefenderEquippedBall');
        if (equipped && balls.indexOf(equipped) === -1) {
            localStorage.setItem('goalDefenderEquippedBall', 'default');
            /* The owner removed the equipped ball but not the equippedBall
             * field, so the cloud is left claiming a ball that is no longer
             * owned. Push the correction so the document is self-consistent for
             * anyone reading it - and so a second device does not have to wait
             * for its own login to fix it. Safe to do once: the signature was
             * already recorded, so this push cannot re-trigger an adopt. */
            return true;
        }
        return true;
    }

    /* Look for a change made outside this game and adopt it.
     *
     * Runs on a timer and whenever the tab comes back to the foreground, so an
     * edit lands within seconds without the player signing out, refreshing, or
     * doing anything at all. */
    function pullFromCloud() {
        if (!currentUser || !currentAccount) return Promise.resolve();
        if (pulling) return Promise.resolve();
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            return Promise.resolve();      // do not touch storage while backgrounded
        }

        pulling = true;
        return P.firestore().collection(ACCOUNT_COLLECTION).doc(currentUser.uid).get()
            .then(function (snap) {
                if (!snap.exists) return;
                var data = snap.data() || {};
                var sig = signatureOf(data.username, data.save);
                if (sig === lastPushedSignature) return;      // our own write, or no change

                /* Someone edited this account from outside the game. Adopt it,
                 * and record the new signature so this is a one-time change
                 * rather than a loop. */
                applyAccount(snap);
                var applied = applyCloudSaveAuthoritative(data.save);
                lastPushedSignature = sig;
                if (applied) {
                    emit();
                    /* Write back the one thing the cloud cannot be trusted to
                     * keep consistent on its own: an equipped ball that is no
                     * longer in the owned list. */
                    scheduleSync();
                }
            })
            .catch(function () { /* offline, or rules not published - stay quiet */ })
            .then(function () { pulling = false; });
    }

    /** Keep pulling so outside edits land on their own. */
    function installCloudWatch() {
        if (typeof window.setInterval !== 'function') return;
        if (cloudWatchTimer) return;
        cloudWatchTimer = window.setInterval(pullFromCloud, CLOUD_WATCH_MS);

        // Returning to the tab is the moment a player is most likely to be
        // about to look at something the owner just changed.
        var wake = function () {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            pullFromCloud();
        };
        window.addEventListener('focus', wake);
        if (window.document) {
            window.document.addEventListener('visibilitychange', wake);
        }
    }

    function stopCloudWatch() {
        if (cloudWatchTimer) {
            window.clearInterval(cloudWatchTimer);
            cloudWatchTimer = 0;
        }
    }

    /* Retire the anonymous identity this device was using before sign-in.
     *
     * Before accounts, the leaderboard gave every visitor an anonymous id and
     * published a row under it. Signing in creates a SECOND identity - the
     * account - so the same person ended up with two rows, the old one stuck
     * under the name they played with ("HAMZA") and the new one under the
     * account username. Nothing ever removed the first, so the board slowly
     * filled with ghosts of people who had since made an account.
     *
     * The old row's stats are carried onto the account first, so nothing is
     * lost, and only then is the old row deleted. The account is the only
     * identity that survives.
     *
     * Failure here is not important enough to interrupt a sign-in: the player
     * is already signed in, and a leftover row is a cosmetic problem, not a
     * lost save. */
    function retireAnonymousIdentity() {
        if (!window.GDPlayer || typeof window.GDPlayer.retireAnonymousRow !== 'function') {
            return Promise.resolve();
        }
        return window.GDPlayer.retireAnonymousRow(currentUser.uid)
            .catch(function () { return { ok: false }; });
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
        return pushToCloud().then(function (r) {
            /* Announce a completed sync.
             *
             * Without this the only changes that reached a listener were
             * sign-in, sign-out and rename. A plain save - play a run, bank the
             * money, walk the 1.5s debounce down - pushed the new numbers to
             * the cloud and told nobody, so any view showing progress stayed
             * frozen on whatever it read when it opened. That was the common
             * case, not the rare one.
             *
             * Only on success: an unchanged or failed sync has nothing new to
             * show, and re-rendering on failure would be noise. */
            if (r && r.ok) emit();
            return r;
        });
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

    function afterAuth(user, typedUsername, signedInAs) {
        currentUser = user;
        if (!user) {
            currentAccount = null;
            return Promise.resolve({ ok: true, signedOut: true });
        }

        /* An ANONYMOUS session is not an account.
         *
         * restore() hands whatever user auth is holding to this function, and
         * on a first visit that user is anonymous. Without this guard the
         * "brand new account" branch below created a real document in the
         * accounts collection for every anonymous visitor - one junk document
         * per visitor, each carrying a copy of their whole local save, and a
         * matching row on the public leaderboard. restore() now filters these
         * out too; this is the second line of defence. */
        if (user.isAnonymous) {
            currentAccount = null;
            return Promise.resolve({ ok: true, anonymous: true });
        }

        /* Only sign-ups may create an account. A login that finds no document
         * means something is wrong (a typo'd uid, a half-published write), and
         * creating one would attach a stranger's browser save to an account
         * that is not theirs. */
        var creating = !!typedUsername;

        return P.firestore().collection(ACCOUNT_COLLECTION).doc(user.uid).get()
            .then(function (snap) {
                if (snap.exists) {
                    // Returning player. The account is the source of truth for
                    // the name, but the SAVE is merged rather than applied
                    // wholesale - see mergeSave(). Overwriting meant progress
                    // made since the last sync silently disappeared.
                    applyAccount(snap);
                    mergeSave(currentAccount.save);
                    /* Seed the fingerprint from what we just read, so the
                     * watcher does not mistake this sign-in for an outside
                     * edit and "restore" the values it already applied. */
                    lastPushedSignature = signatureOf(currentAccount.username, currentAccount.save);
                    return P.firestore().collection(ACCOUNT_COLLECTION).doc(user.uid)
                        .set({ lastLogin: ts() },
                            { merge: true })
                        .then(function () {
                            installCloudWatch();
                            return retireAnonymousIdentity();
                        })
                        .then(function () {
                            emit();
                            return { ok: true, isNew: false, username: currentAccount.username };
                        });
                }

                if (!creating) {
                    /* No document, and this was a LOGIN rather than a sign-up.
                     *
                     * The old code fell through to the create branch with
                     * typedUsername undefined, so the name came from the local
                     * settings and became "player" or "PLAYER". That reported a
                     * successful sign-in for an account the player never made,
                     * and the stub it built was then written back over the real
                     * document by the next sync. Refuse instead.
                     *
                     * If the player just signed up moments ago and their write
                     * has not landed yet, name the account they just used so
                     * they are not told the wrong thing. */
                    currentAccount = null;
                    return {
                        ok: false,
                        error: signedInAs
                            ? 'No saved progress for "' + signedInAs + '" yet. Try again in a moment.'
                            : 'No saved progress for that account. Try signing up instead.'
                    };
                }

                // Brand new account: upload this browser's save as its progress.
                // The username TYPED is the account's name.
                var name = typedUsername;
                currentAccount = { uid: user.uid, username: name, createdAt: null };

                /* The account name becomes the player's name immediately.
                 *
                 * A sign-up adopts this device's save, but the save carries the
                 * old local player name, and nothing was rewriting it. The
                 * result was two players on one device: an account called
                 * "hamza" still displaying, and still publishing, as whatever
                 * name they had picked before ("HAMZA"). The account is the
                 * authority on who this is, so it wins from the moment it
                 * exists - the old name is replaced, not left alongside. */
                localStorage.setItem('gdPlayerName', name);
                return P.firestore().collection(ACCOUNT_COLLECTION).doc(user.uid)
                    .set({
                        username: name,
                        email: user.email || '',
                        save: readSave(),
                        createdAt: ts(),
                        updatedAt: ts()
                    })
                    .then(function () {
                        lastPushedSignature = signatureOf(name, readSave());
                        installCloudWatch();
                        /* A brand new account has just adopted this device's
                         * progress, so the old anonymous identity on the board
                         * is now a duplicate of it and must go. */
                        return retireAnonymousIdentity();
                    })
                    .then(function () {
                        emit();
                        return { ok: true, isNew: true, username: name };
                    });
            })
            .catch(function (e) {
                /* The read failed, so we know NOTHING about the stored account:
                 * not its name, not its save.
                 *
                 * This path used to invent a placeholder account and report
                 * success. pushToCloud() then wrote that placeholder over the
                 * real document - overwriting the username with "player" and
                 * the save with whatever this browser happened to hold. A
                 * transient network error destroyed the player's cloud progress
                 * permanently, and they were told the sign-in worked.
                 *
                 * Nothing is written back on failure. currentAccount stays null,
                 * which also makes pushToCloud() refuse (see the guard there),
                 * so the real document is left exactly as it was.
                 */
                currentAccount = null;
                if (missingRules(e)) {
                    return {
                        ok: false,
                        syncOff: true,
                        error: 'Signed in, but progress could not be loaded. Nothing has been changed - try again in a moment.'
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
            /* The username is passed as the CREATE-ONLY marker, not as the
             * account's name. afterAuth only uses it when there is no stored
             * document, and only a sign-up may create one - so passing it here
             * cannot invent an account. It exists so that a returning player
             * who typed their name in a different case still gets the right
             * answer when the stored document is briefly unreadable. */
            return auth.signInWithEmailAndPassword(fakeEmail(u), password)
                .then(function (cred) { return afterAuth(cred.user, null, u); });
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
                stopCloudWatch();
                currentUser = null;
                currentAccount = null;
                lastPushedSignature = '';
                emit();
                return { ok: true };
            })
            .catch(function () {
                // Never trap someone in a signed-in state because a write failed.
                stopCloudWatch();
                currentUser = null;
                currentAccount = null;
                lastPushedSignature = '';
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

        /* Refuse before touching anything if the sign-in never loaded a real
         * account. Renaming a stub would write the new name over a document we
         * know nothing about. */
        if (!currentAccount) {
            return Promise.resolve({
                ok: false,
                error: 'Not connected to your account yet. Try again in a moment.'
            });
        }

        if (!canChangeUsername()) {
            var mins = Math.ceil(msUntilNameChange() / 60000);
            var when = mins > 90 ? Math.ceil(mins / 1440) + ' day(s)' : Math.round(mins) + ' minutes';
            return Promise.resolve({ ok: false, error: 'You can change your name again in ' + when + '.' });
        }
        var name = P.sanitize(raw);
        if (!name) return Promise.resolve({ ok: false, error: 'Enter a name.' });
        if (name === currentAccount.username) {
            return Promise.resolve({ ok: false, error: 'That is already your name.' });
        }

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
            createdAt: previous.createdAt,
            lastLogin: previous.lastLogin,
            save: previous.save
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
                P.setName(previous.username);
                /* A rename that could not be saved has NOT happened, so it must
                 * not start the cooldown. The old shared error text also told
                 * the player their cloud save was unavailable, which is both
                 * untrue here and confusing - they are signed in fine, it was
                 * the name change that failed. */
                return {
                    ok: false,
                    error: missingRules(e)
                        ? 'Could not save your new name. Your name is unchanged - try again in a moment.'
                        : friendlyError(e)
                };
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
            /* Anonymous sessions are the leaderboard's identity, not an
             * account. Handing one to afterAuth() created a real accounts
             * document for every visitor who simply loaded the page - junk
             * documents nobody can list or delete, plus a leaderboard row each.
             * A player who has not signed up has no account, full stop. */
            if (user.isAnonymous) {
                currentUser = null;
                currentAccount = null;
                return { ok: true, anonymous: true };
            }
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