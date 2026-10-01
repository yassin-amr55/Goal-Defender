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
        maxSpeed: function () { return num('goalDefenderMaxSpeedBoost'); },
        highScore: function () { return num('goalDefenderHighScore'); },
        tournamentWins: function () { return num('goalDefenderTournamentWins'); },
        qualifiersWins: function () { return num('goalDefenderQualifiersWins'); },
        championsWins: function () { return num('goalDefenderChampionsWins'); },
        tournamentsPlayed: function () { return num('goalDefenderTournamentsPlayed'); },
        ballsOwned: function () { return ownedBalls(); },
        money: function () { return num('goalDefenderMoney'); },
        tutorialDone: function () { return localStorage.getItem('gdTutorialDone') === 'true' ? 1 : 0; }
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

        /* --- Single run score --- */
        { id: 'score_10', cat: 'Score', name: 'First Ten', desc: 'Score 10 in a single run', metric: 'highScore', goal: 10, reward: 50 },
        { id: 'score_25', cat: 'Score', name: 'Getting Serious', desc: 'Score 25 in a single run', metric: 'highScore', goal: 25, reward: 100 },
        { id: 'score_50', cat: 'Score', name: 'High Fifty', desc: 'Score 50 in a single run', metric: 'highScore', goal: 50, reward: 250 },
        { id: 'score_100', cat: 'Score', name: 'Century', desc: 'Score 100 in a single run', metric: 'highScore', goal: 100, reward: 4000 },
        { id: 'score_250', cat: 'Score', name: 'Unstoppable', desc: 'Score 250 in a single run', metric: 'highScore', goal: 250, reward: 50000 },

        /* --- Tournament --- */
        { id: 'tourn_played', cat: 'Tournament', name: 'Entering the Cup', desc: 'Start your first tournament', metric: 'tournamentsPlayed', goal: 1, reward: 50 },
        // tourn_qual / tourn_champ are FIRST-win-only (goal: 1).
        // Winning a cup ALSO pays a per-win trophy prize from
        // TournamentVictoryScene ($500 Qualifiers / $10,000 Champions), so these
        // sit below the repeat prize rather than replacing it.
        { id: 'tourn_qual', cat: 'Tournament', name: 'Qualifiers Champion', desc: 'Win the Qualifiers Cup', metric: 'qualifiersWins', goal: 1, reward: 300 },
        { id: 'tourn_champ', cat: 'Tournament', name: 'Champions of Champions', desc: 'Win the Champions Cup', metric: 'championsWins', goal: 1, reward: 5000 },
        { id: 'tourn_3', cat: 'Tournament', name: 'Hat Trick', desc: 'Win 3 tournaments', metric: 'tournamentWins', goal: 3, reward: 3000 },
        { id: 'tourn_10', cat: 'Tournament', name: 'Tournament Machine', desc: 'Win 10 tournaments', metric: 'tournamentWins', goal: 10, reward: 60000 },

        /* --- Collection --- */
        { id: 'balls_2', cat: 'Collection', name: 'Ball Collector', desc: 'Own 2 different balls', metric: 'ballsOwned', goal: 2, reward: 50 },
        { id: 'balls_all', cat: 'Collection', name: 'Full Rack', desc: 'Own every ball in the shop', metric: 'ballsOwned', goal: 13, reward: 6000 },

        /* --- General --- */
        { id: 'tutorial', cat: 'General', name: 'Graduate', desc: 'Finish the Learn to Play lesson', metric: 'tutorialDone', goal: 1, reward: 25 },
        { id: 'money_1000', cat: 'General', name: 'Pocket Change', desc: 'Hold $1,000 at once', metric: 'money', goal: 1000, reward: 100 },
        { id: 'money_100000', cat: 'General', name: 'Tycoon', desc: 'Hold $100,000 at once', metric: 'money', goal: 100000, reward: 10000 }
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
            if (isUnlocked(ach.id)) return;
            if ((snap[ach.metric] || 0) < ach.goal) return;

            unlocked[ach.id] = Date.now();
            newly.push(ach);
        });

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
        reset: reset
    };
})();
