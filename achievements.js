/* achievements.js - the achievement system.
 *
 * Every achievement reads from a live stat, so progress is always derived from
 * real save data rather than a separate counter that can drift out of sync.
 * Rewards are paid automatically the moment an achievement unlocks, and the
 * unlock is recorded with a timestamp so it can never be paid twice.
 */
(function () {
    'use strict';

    var UNLOCK_KEY = 'gdAchievements';
    var CLAIM_KEY = 'gdAchievementsClaimed';

    /* ---------------- stat sources ---------------- */

    function num(key) {
        var v = parseInt(localStorage.getItem(key) || '0', 10);
        return isNaN(v) ? 0 : v;
    }

    function ownedBalls() {
        try {
            var list = JSON.parse(localStorage.getItem('goalDefenderOwnedBalls') || '["default"]');
            return Array.isArray(list) ? list.length : 1;
        } catch (e) {
            return 1;
        }
    }

    var METRICS = {
        deflections: function () { return num('goalDefenderDeflections'); },
        /* Best deflections in a SINGLE run, not the lifetime total.
         *
         * A separate key rather than reusing the lifetime total, because
         * "100 deflections in one run" and "100 deflections ever" are different
         * achievements and conflating them makes the harder one unreachable. */
        bestRunDeflections: function () { return num('goalDefenderBestRunDeflections'); },
        bestRunPerfects: function () { return num('goalDefenderBestRunPerfects'); },
        maxSpeed: function () { return num('goalDefenderMaxSpeedBoost'); },
        tournamentWins: function () { return num('goalDefenderTournamentWins'); },
        qualifiersWins: function () { return num('goalDefenderQualifiersWins'); },
        championsWins: function () { return num('goalDefenderChampionsWins'); },
        tournamentsPlayed: function () { return num('goalDefenderTournamentsPlayed'); },
        /* Cups won back to back. Reset by any defeat or any tournament played,
         * so it cannot be farmed by winning two far apart. */
        tournamentStreak: function () { return num('goalDefenderTournamentStreak'); },
        ballsOwned: function () { return ownedBalls(); },
        money: function () { return num('goalDefenderMoney'); },
        tutorialDone: function () { return localStorage.getItem('gdTutorialDone') === 'true' ? 1 : 0; },
        playedOnMobile: function () { return localStorage.getItem('gdPlayedOnMobile') === 'true' ? 1 : 0; },
        /* Progress toward Hacker, for the achievements page to display.
         *
         * Returns 1 only when EVERY other achievement is unlocked. It reads the
         * live unlock map rather than a snapshot, because the unlock map is what
         * hackerProgress actually depends on - a value captured before this
         * run's unlocks would always be one step behind. */
        hackerProgress: function () {
            var others = LIST.filter(function (a) { return a.id !== HACKER_ID; });
            if (!others.length) return 0;
            var done = 0;
            others.forEach(function (a) { if (isUnlocked(a.id)) done++; });
            return done === others.length ? 1 : 0;
        }
    };

    function current(metric) {
        var fn = METRICS[metric];
        return fn ? fn() : 0;
    }

    // Read every metric once. evaluate() runs on every deflect, so re-reading
    // localStorage per achievement would be needlessly expensive.
    function snapshot() {
        var snap = {};
        Object.keys(METRICS).forEach(function (key) { snap[key] = METRICS[key](); });
        return snap;
    }

    /* ---------------- the list ----------------
     * Rewards are scaled to how long an achievement realistically takes. */

    /* How many balls the shop sells.
     *
     * `balls_all` counts owned balls against this, and it was left at 13 while
     * the shop sold 14 - so the achievement could never be claimed and nobody
     * noticed for a whole version. It is a constant here rather than being read
     * from the shop because LIST is built at load time, long before any scene
     * exists. ShopScene asserts its own count matches this at startup, so the
     * two cannot drift apart silently again. */
    var BALL_COUNT = 20;

    /* The capstone achievement. Tested explicitly and last - see evaluate(). */
    var HACKER_ID = 'hacker';

    var LIST = [
        /* --- Deflections --- */
        { id: 'defl_50', cat: 'Deflections', name: 'Warmed Up', desc: 'Deflect 50 balls in total', metric: 'deflections', goal: 50, reward: 50 },
        { id: 'defl_100', cat: 'Deflections', name: 'Steady Hands', desc: 'Deflect 100 balls in total', metric: 'deflections', goal: 100, reward: 100 },
        { id: 'defl_200', cat: 'Deflections', name: 'Double Century', desc: 'Deflect 200 balls in total', metric: 'deflections', goal: 200, reward: 300 },
        { id: 'defl_500', cat: 'Deflections', name: 'Five Hundred Club', desc: 'Deflect 500 balls in total', metric: 'deflections', goal: 500, reward: 600 },
        { id: 'defl_1000', cat: 'Deflections', name: 'Four Figures', desc: 'Deflect 1,000 balls in total', metric: 'deflections', goal: 1000, reward: 3000 },
        { id: 'defl_10000', cat: 'Deflections', name: 'Five Figures', desc: 'Deflect 10,000 balls in total', metric: 'deflections', goal: 10000, reward: 100000 },
        { id: 'defl_50000', cat: 'Deflections', name: 'Fifty Thousand', desc: 'Deflect 50,000 balls in total', metric: 'deflections', goal: 50000, reward: 500000 },
        { id: 'defl_100000', cat: 'Deflections', name: 'Six Figures', desc: 'Deflect 100,000 balls in total', metric: 'deflections', goal: 100000, reward: 1500000 },
        { id: 'defl_1000000', cat: 'Deflections', name: 'Million Deflections', desc: 'Deflect 1,000,000 balls in total', metric: 'deflections', goal: 1000000, reward: 10000000 },

        /* --- Speed boost --- */
        { id: 'spd_25', cat: 'Speed', name: 'Bit of a Pace', desc: 'Reach a 25% speed boost', metric: 'maxSpeed', goal: 25, reward: 20 },
        { id: 'spd_50', cat: 'Speed', name: 'Picking Up', desc: 'Reach a 50% speed boost', metric: 'maxSpeed', goal: 50, reward: 75 },
        { id: 'spd_100', cat: 'Speed', name: 'Double Speed', desc: 'Reach a 100% speed boost', metric: 'maxSpeed', goal: 100, reward: 150 },
        { id: 'spd_200', cat: 'Speed', name: 'Double Again', desc: 'Reach a 200% speed boost', metric: 'maxSpeed', goal: 200, reward: 1200 },
        { id: 'spd_210', cat: 'Speed', name: 'Spark Ceiling', desc: 'Reach 210% - the Spark Ball limit', metric: 'maxSpeed', goal: 210, reward: 6000 },
        { id: 'spd_300', cat: 'Speed', name: 'Terminal Velocity', desc: 'Reach the 300% speed boost cap', metric: 'maxSpeed', goal: 300, reward: 15000 },

        /* --- Single run deflections ---
         *
         * These were SCORE achievements and are now DEFLECTION achievements,
         * keeping the same single-run framing. Score was the wrong number: it
         * moves whenever a ball's score multiplier changes, so "score 250 in
         * one run" silently became easier or harder depending on what the
         * player happened to equip. A deflect is one deflect on every ball.
         *
         * Metric is bestRunDeflections - the best single run - not the
         * lifetime total, so they stay a "in one run" ladder.
         *
         * The ids keep the old score_* names so any player who already earned
         * them is not silently re-paid and not re-locked. The reward is raised
         * at 100 and 250 because the ladder now competes with the lifetime
         * deflection tiers for the same milestone. */
        { id: 'score_10', cat: 'Deflections', name: 'First Ten', desc: 'Deflect 10 balls in a single run', metric: 'bestRunDeflections', goal: 10, reward: 50 },
        { id: 'score_25', cat: 'Deflections', name: 'Getting Serious', desc: 'Deflect 25 balls in a single run', metric: 'bestRunDeflections', goal: 25, reward: 100 },
        { id: 'score_50', cat: 'Deflections', name: 'High Fifty', desc: 'Deflect 50 balls in a single run', metric: 'bestRunDeflections', goal: 50, reward: 300 },
        { id: 'score_100', cat: 'Deflections', name: 'Century', desc: 'Deflect 100 balls in a single run', metric: 'bestRunDeflections', goal: 100, reward: 15000 },
        { id: 'score_250', cat: 'Deflections', name: 'Unstoppable', desc: 'Deflect 250 balls in a single run', metric: 'bestRunDeflections', goal: 250, reward: 100000 },

        /* --- Tournament --- */
        { id: 'tourn_played', cat: 'Tournament', name: 'Entering the Cup', desc: 'Start your first tournament', metric: 'tournamentsPlayed', goal: 1, reward: 50 },
        // tourn_qual / tourn_champ are FIRST-win-only (goal: 1).
        // Winning a cup ALSO pays a per-win trophy prize from
        // TournamentVictoryScene ($500 Qualifiers / $10,000 Champions), so these
        // sit below the repeat prize rather than replacing it.
        { id: 'tourn_qual', cat: 'Tournament', name: 'Qualifiers Champion', desc: 'Win the Qualifiers Cup', metric: 'qualifiersWins', goal: 1, reward: 300 },
        { id: 'tourn_champ', cat: 'Tournament', name: 'Champions of Champions', desc: 'Win the Champions Cup', metric: 'championsWins', goal: 1, reward: 20000 },
        { id: 'tourn_3', cat: 'Tournament', name: 'Hat Trick', desc: 'Win 3 tournaments', metric: 'tournamentWins', goal: 3, reward: 3000 },
        { id: 'tourn_10', cat: 'Tournament', name: 'Tournament Machine', desc: 'Win 10 tournaments', metric: 'tournamentWins', goal: 10, reward: 60000 },
        // Back to BACK, not just three wins in a career. The streak counter is
        // cleared by a defeat and by starting a new tournament, so this cannot
        // be earned by winning one cup, losing, and waiting a month.
        { id: 'tourn_streak3', cat: 'Tournament', name: 'The Real Hat Trick', desc: 'Win 3 tournaments back to back', metric: 'tournamentStreak', goal: 3, reward: 8000 },
        { id: 'tourn_played10', cat: 'Tournament', name: 'Regular', desc: 'Play 10 tournaments', metric: 'tournamentsPlayed', goal: 10, reward: 5000 },

        /* --- Collection --- */
        { id: 'balls_2', cat: 'Collection', name: 'Ball Collector', desc: 'Own 2 different balls', metric: 'ballsOwned', goal: 2, reward: 50 },
        { id: 'balls_5', cat: 'Collection', name: 'Novice Collector', desc: 'Own 5 different balls', metric: 'ballsOwned', goal: 5, reward: 250 },
        { id: 'balls_10', cat: 'Collection', name: 'Serious Collector', desc: 'Own 10 different balls', metric: 'ballsOwned', goal: 10, reward: 2500 },
        /* Goal is the shop's ball count. It sat at 13 while the shop sold 14,
         * which made this impossible to claim; it is now 20 and the comment
         * below is the thing that stops it drifting again. */
        { id: 'balls_all', cat: 'Collection', name: 'Full Rack', desc: 'Own every ball in the shop', metric: 'ballsOwned', goal: BALL_COUNT, reward: 500000 },

        /* --- General --- */
        { id: 'first_ever', cat: 'General', name: 'First Ever', desc: 'Deflect your first ball', metric: 'deflections', goal: 1, reward: 10 },
        { id: 'tutorial', cat: 'General', name: 'Graduate', desc: 'Finish the Learn to Play lesson', metric: 'tutorialDone', goal: 1, reward: 25 },
        { id: 'money_1000', cat: 'General', name: 'Pocket Change', desc: 'Hold $1,000 at once', metric: 'money', goal: 1000, reward: 100 },
        { id: 'money_100000', cat: 'General', name: 'Tycoon', desc: 'Hold $100,000 at once', metric: 'money', goal: 100000, reward: 10000 },
        { id: 'defl_2500', cat: 'Deflections', name: 'Twenty-Five Hundred', desc: 'Deflect 2,500 balls in total', metric: 'deflections', goal: 2500, reward: 5000 },
        { id: 'on_the_go', cat: 'General', name: 'On the Go', desc: 'Complete a run on a phone', metric: 'playedOnMobile', goal: 1, reward: 150 },
        { id: 'reflex10', cat: 'Deflections', name: 'Reflex', desc: '10 perfect hits in a single run', metric: 'bestRunPerfects', goal: 10, reward: 1000 },

        /* --- Hacker ---
         *
         * MUST BE THE LAST ENTRY.
         *
         * It unlocks when every other achievement is unlocked, so its own
         * unlock changes the very condition it tests. If it were not last, the
         * unlock sweep would stop one short and the achievement would be
         * unreachable by construction. Achievements.check() walks LIST in
         * order and settles, so putting it at the end means the sweep reaches
         * it only after everything else is already in the map.
         *
         * A billion dollars is deliberate and absurd. It is the joke. */
        { id: 'hacker', cat: 'General', name: 'Hacker', desc: 'Unlock every other achievement', metric: 'hackerProgress', goal: 1, reward: 1000000000 }
    ];

    /* ---------------- unlock state ---------------- */

    function loadKey(key) {
        try {
            var raw = JSON.parse(localStorage.getItem(key) || '{}');
            return (raw && typeof raw === 'object') ? raw : {};
        } catch (e) {
            return {};
        }
    }

    var unlocked = loadKey(UNLOCK_KEY);
    var claimed = loadKey(CLAIM_KEY);

    function save() {
        localStorage.setItem(UNLOCK_KEY, JSON.stringify(unlocked));
    }

    function saveClaimed() {
        localStorage.setItem(CLAIM_KEY, JSON.stringify(claimed));
    }

    /* Re-read the unlocked and claimed sets from storage, discarding the
     * in-memory copies.
     *
     * unlocked and claimed are module-level and isUnlocked()/isClaimed() read
     * the OBJECT, not localStorage. Nothing reloads the page on sign-in or
     * sign-out, so those objects were loaded once when the script first ran and
     * then described whichever account was signed in at that moment, for the
     * rest of the session. Sign out of one account and into another without
     * refreshing, and the second account opened showing the first one's
     * achievements - unlocked, unclaimed, ready to claim the rewards.
     *
     * This is deliberately NOT reset(). reset() empties both objects and then
     * WRITES that empty state back to storage, which is correct for wiping an
     * account and exactly wrong here: by the time an account switch calls this,
     * mergeSave() has already restored the incoming account's achievements from
     * the cloud, so writing {} back would destroy them.
     *
     * Call this after the save has been merged, never before. */
    function hydrate() {
        unlocked = loadKey(UNLOCK_KEY);
        claimed = loadKey(CLAIM_KEY);
        /* An unlock toast queued for the previous account must not surface over
         * the new one's menu. */
        toastQueue = [];
        toastActive = false;
    }

    function isUnlocked(id) {
        return !!unlocked[id];
    }

    function isClaimed(id) {
        return !!claimed[id];
    }

    /** Unlocked but not yet paid out. */
    function isClaimable(id) {
        return isUnlocked(id) && !isClaimed(id);
    }

    function unlockedCount() {
        return Object.keys(unlocked).length;
    }

    function unclaimed() {
        return LIST.filter(function (a) { return isClaimable(a.id); });
    }

    function unclaimedTotal() {
        return unclaimed().reduce(function (s, a) { return s + a.reward; }, 0);
    }

    function claimedTotal() {
        return LIST
            .filter(function (a) { return isClaimed(a.id); })
            .reduce(function (s, a) { return s + a.reward; }, 0);
    }

    /** Pay out one achievement. Returns the amount, or 0 if not claimable. */
    function claim(id) {
        if (!isClaimable(id)) return 0;
        var ach = LIST.filter(function (a) { return a.id === id; })[0];
        if (!ach) return 0;

        claimed[id] = Date.now();
        saveClaimed();
        addMoney(ach.reward);
        return ach.reward;
    }

    /** Pay out everything pending. Returns the total paid. */
    function claimAll() {
        var total = 0;
        unclaimed().forEach(function (a) { total += claim(a.id); });
        return total;
    }

    function progress(ach) {
        var cur = current(ach.metric);
        return {
            current: cur,
            goal: ach.goal,
            pct: ach.goal > 0 ? Math.max(0, Math.min(1, cur / ach.goal)) : 0
        };
    }

    /* ---------------- money helpers ---------------- */

    function fmt(n) {
        return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function addMoney(amount) {
        var total = num('goalDefenderMoney') + amount;
        localStorage.setItem('goalDefenderMoney', total);
        return total;
    }

    /* ---------------- evaluation ---------------- */

    /**
     * Unlocks everything the player now qualifies for. Rewards are NOT paid
     * here - the player claims them from the achievements page.
     * Returns the array of achievements that unlocked on this call.
     */
    function evaluate() {
        var newly = [];
        var snap = snapshot();

        LIST.forEach(function (ach) {
            // Hacker is skipped here and handled below, because it depends on
            // the unlock map this loop is still building.
            if (ach.id === HACKER_ID) return;
            if (isUnlocked(ach.id)) return;
            if ((snap[ach.metric] || 0) < ach.goal) return;

            unlocked[ach.id] = Date.now();
            newly.push(ach);
        });

        /* Hacker, tested once everything else is in.
         *
         * This cannot go through the loop above. `snap` is taken once, before
         * any unlock in this pass, so a snapshot-based Hacker would always be
         * one unlocks behind and could never fire on the final achievement -
         * it would need a second sweep to notice, and nothing triggered one.
         * Reading the live map after the loop makes it fire on the same deflect
         * that completes the collection. */
        if (!isUnlocked(HACKER_ID) && METRICS.hackerProgress() >= 1) {
            for (var i = 0; i < LIST.length; i++) {
                if (LIST[i].id === HACKER_ID) {
                    unlocked[HACKER_ID] = Date.now();
                    newly.push(LIST[i]);
                    break;
                }
            }
        }

        if (newly.length) save();
        return newly;
    }

    /** Evaluate, then queue a toast for each new unlock. */
    function check() {
        var newly = evaluate();
        newly.forEach(function (ach) { notify(ach); });
        return newly;
    }

    /* ---------------- recording hooks ---------------- */

    function setMaxSpeed(pct) {
        var rounded = Math.floor(pct);
        if (rounded > num('goalDefenderMaxSpeedBoost')) {
            localStorage.setItem('goalDefenderMaxSpeedBoost', rounded);
        }
    }

    function addTournamentWin(mode) {
        localStorage.setItem('goalDefenderTournamentWins', num('goalDefenderTournamentWins') + 1);
        var key = (mode === 'champions') ? 'goalDefenderChampionsWins' : 'goalDefenderQualifiersWins';
        localStorage.setItem(key, num(key) + 1);
    }

    function addTournamentPlayed() {
        localStorage.setItem('goalDefenderTournamentsPlayed', num('goalDefenderTournamentsPlayed') + 1);
    }

    function markTutorialDone() {
        localStorage.setItem('gdTutorialDone', 'true');
    }

    /* ---------------- toast queue ----------------
     * Only one toast is ever on screen. Extra unlocks wait in a queue and are
     * shown on whichever scene is running by the time its turn comes, so a
     * queued toast survives the player changing scenes. */

    var toastQueue = [];
    var toastActive = false;

    function activeScene() {
        if (!window.game || !window.game.scene) return null;
        var scenes = window.game.scene.scenes;
        var found = null;
        for (var i = 0; i < scenes.length; i++) {
            var s = scenes[i];
            if (!s.sys || !s.sys.settings) continue;
            // RUNNING (5) and actually visible - a scene can be running but
            // hidden behind another, and a toast on it would be invisible.
            if (s.sys.settings.status === 5 && s.sys.settings.visible) {
                found = s;   // keep the last match: the most recently started
            }
        }
        return found;
    }

    function notify(ach) {
        toastQueue.push(ach);
        pumpQueue();
    }

    function pumpQueue() {
        if (toastActive || !toastQueue.length) return;

        var scene = activeScene();
        if (!scene || !scene.add || !scene.tweens) return;   // try again later

        var ach = toastQueue.shift();
        toastActive = true;

        var parts = [];
        var panel = UI.panel(scene, {
            x: 640, y: 100, w: 660, h: 104, radius: 20,
            fillTop: 0x1f2c3d, fillBottom: 0x121c28,
            border: 0xffd45e, borderWidth: 3, depth: 300
        });

        var title = scene.add.text(640, 74, 'ACHIEVEMENT UNLOCKED', {
            fontSize: '18px', color: '#ffd45e', fontStyle: '900'
        }).setOrigin(0.5).setDepth(301);

        var name = scene.add.text(640, 112, ach.name, {
            fontSize: '26px', color: '#ffffff', fontStyle: '900'
        }).setOrigin(0.5).setDepth(301);

        // Achievement names vary a lot in length, so shrink until it fits.
        var maxW = 620;
        var px = 26;
        var guard = 0;
        while (name.width > maxW && px > 10 && guard < 120) {
            px -= 1;
            name.setFontSize(px);
            guard++;
        }

        var sub = scene.add.text(640, 138, 'Claim $' + fmt(ach.reward) + ' in Achievements', {
            fontSize: '16px', color: '#3ddc6b', fontStyle: '800'
        }).setOrigin(0.5).setDepth(301);

        parts.push(panel, title, name, sub);

        scene.tweens.add({
            targets: parts,
            alpha: 0,
            delay: 2600,
            duration: 450,
            onComplete: function () {
                parts.forEach(function (p) { p.destroy(); });
                toastActive = false;
                pumpQueue();          // next one only after this one is gone
            }
        });
    }

    /* ---------------- test / debug helper ---------------- */

    function reset() {
        unlocked = {};
        claimed = {};
        toastQueue = [];
        toastActive = false;
        save();
        saveClaimed();
    }

    window.Achievements = {
        /* The shop's ball count, so ShopScene can assert its own list matches.
         * Full Rack is unreachable if the two drift apart. */
        ballCount: function () { return BALL_COUNT; },
        total: function () { return LIST.length; },
        LIST: LIST,
        METRICS: METRICS,
        current: current,
        progress: progress,
        isUnlocked: isUnlocked,
        isClaimed: isClaimed,
        isClaimable: isClaimable,
        unlockedCount: unlockedCount,
        unclaimed: unclaimed,
        unclaimedTotal: unclaimedTotal,
        claimedTotal: claimedTotal,
        claim: claim,
        claimAll: claimAll,
        evaluate: evaluate,
        check: check,
        notify: notify,
        setMaxSpeed: setMaxSpeed,
        addTournamentWin: addTournamentWin,
        addTournamentPlayed: addTournamentPlayed,
        markTutorialDone: markTutorialDone,
        addMoney: addMoney,
        fmt: fmt,
        reset: reset,
        /* Re-read unlocks from storage. Called on an account switch so the
         * in-memory set cannot outlive the account that filled it. */
        hydrate: hydrate
    };
})();
