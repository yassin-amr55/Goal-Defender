/* Verify an upload before it ships.
 *
 *   node tools/verify-upload.js            # verify the itch zip
 *   node tools/verify-upload.js --apk      # also verify the release APK
 *
 * WHY THIS IS IN THE REPO RATHER THAN %TEMP%
 *
 * Every previous version of this check lived in the temp directory and was
 * destroyed by a temp cleanup mid-session, which is how a verification step can
 * silently stop existing. Tests and checkers that guard a release artifact belong
 * next to the code they check.
 *
 * It does NOT ship: build-itch-zip.js uses an explicit allow-list of FILES, so
 * tools/ is unreachable from it, and this script asserts that.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ZIP = 'D:\\Desktop\\goal-defender-itch.zip';
const APK = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const WANT_APK = process.argv.includes('--apk');
const MAXBUF = 128 * 1024 * 1024;

let fail = 0;
const ok = (n, c, d) => { if (!c) fail++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + n + (d ? '  [' + d + ']' : '')); };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

/* Comments carry apostrophes, so /'([^']+)'/g pairs them wrongly and swallows
 * real entries - it reported 29 save keys when there were 30. Strip first. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const listOf = (src, decl) => {
    const i = src.indexOf(decl);
    if (i === -1) return [];
    return (strip(src).slice(i, strip(src).indexOf('];', i)).match(/'([^']+)'/g) || [])
        .map(x => x.replace(/'/g, ''));
};

/* ---- 1. package shape ---- */
console.log('=== itch zip ===');
ok('zip exists', fs.existsSync(ZIP), ZIP);
const names = execFileSync('tar', ['-tf', ZIP], { encoding: 'utf8', maxBuffer: MAXBUF })
    .split('\n').map(s => s.trim()).filter(Boolean);

ok('no backslash entry names', !names.some(n => n.includes('\\')));
ok('no markdown shipped', !names.some(n => /\.md$/i.test(n)));
ok('nothing from tools/, android/ or playstore/ shipped',
    !names.some(n => /^(tools|android|playstore|md)\//.test(n)),
    'a glob would drag these in');
ok('no keystore shipped', !names.some(n => /\.jks$|keystore/i.test(n)));
const tops = [...new Set(names.map(n => n.split('/')[0]))].sort();
ok('flat at root: loose code + assets/ + scenes/',
    tops.length === 10 && ['account.js', 'achievements.js', 'assets', 'index.html',
        'layout.js', 'main.js', 'player.js', 'scenes', 'settings.js', 'ui.js']
        .every(t => tops.includes(t)), tops.join(' '));

/* ---- 2. byte-identical to the working tree ---- */
const mismatched = [];
let checked = 0;
for (const n of names) {
    const disk = path.join(ROOT, n.replace(/\//g, path.sep));
    if (!fs.existsSync(disk)) { mismatched.push(n + ' (not on disk)'); continue; }
    if (sha(execFileSync('tar', ['-xOf', ZIP, n], { maxBuffer: MAXBUF })) !== sha(fs.readFileSync(disk))) {
        mismatched.push(n);
    }
    checked++;
}
ok('every entry is byte-identical to the working tree',
    mismatched.length === 0, `${checked} files` +
    (mismatched.length ? `, differing: ${mismatched.slice(0, 6).join(', ')}` : ''));

/* ---- 3. this session's fixes, in the shipped bytes ---- */
console.log('');
console.log('=== fixes present in the shipped bytes ===');
const inZip = e => execFileSync('tar', ['-xOf', ZIP, e], { maxBuffer: MAXBUF }).toString();
const game = inZip('scenes/GameScene.js');
const shop = inZip('scenes/ShopScene.js');
const auth = inZip('account.js');
const ach = inZip('achievements.js');
const ui = inZip('ui.js');
const brk = inZip('scenes/TournamentBracketScene.js');
const tour = inZip('scenes/TournamentGameScene.js');
const tut = inZip('scenes/TutorialScene.js');
const acctUI = inZip('scenes/AccountScene.js');

/* account.js and AccountScene.js are different files with confusingly similar
 * names. Reading the scene for both makes negative assertions pass vacuously,
 * because a check that something is ABSENT is always true of the wrong file. */
ok('auth module and account UI are distinct files', auth !== acctUI,
    `${auth.length} vs ${acctUI.length} bytes`);

ok('Inverted hitbox is a fraction of the ball', /this\.fixedHitboxPct = 1\.5/.test(game));
ok('no pinned pixel hitbox survives',
    !/fixedHitbox(?!Pct)/.test(strip(game)), 'that made it 293% of the ball');
ok('Anchor does not halve base speed',
    !/case 'anchor':[\s\S]{0,700}?this\.speedMultiplier\s*=/.test(game));
ok('Anchor boost is +2%', /this\.boostStepMain = 1\.02/.test(game));
ok('Anchor is $20,000', /id: 'anchor'[^}]*price: 20000/.test(shop));
ok('Steel boost is +3.6%', /this\.boostStepMain = 1\.036/.test(game));
ok('Void has no undisclosed speed nerf',
    !/case 'void':[\s\S]{0,700}?this\.boostStepMain/.test(game));
ok('tournament winners advance positionally',
    /placeAdvancer\(bracket, nextRound/.test(tour) && !/nextMatch\.team1 === 'TBD'/.test(tour));
ok('bracket field is inset inside the panel', /X_LT = 108/.test(brk) && /X_RT = 1172/.test(brk));
ok('account-switch guard ships', /var SAVE_OWNER_KEY = 'gdSaveOwnerUid'/.test(auth));
ok('caches invalidated on a switch',
    /window\.Achievements\.hydrate\(\)/.test(auth) && /window\.GDPlayer\.forgetSubmitted\(\)/.test(auth));
ok('account-scoped local keys wiped',
    /tournamentQualifiersStats/.test(auth) && /gdAnonLeaderboardUid/.test(auth));

/* Containment against the real span: an unbounded [\s\S]*? between two literals
 * runs past the array and finds the key elsewhere in the file. */
const skStart = strip(auth).indexOf('var SAVE_KEYS = [');
const skSpan = strip(auth).slice(skStart, strip(auth).indexOf('];', skStart) + 2);
ok('the save-owner key is never synced', !skSpan.includes('gdSaveOwnerUid'),
    'syncing it would overwrite the other device');

ok('tutorial SKIP is gone', !/SKIP|skipLesson/.test(tut));
ok('account UI opens on LOG IN', /this\.tab = 'login'/.test(acctUI));
ok('HUD scrim is gone', !/hudScrim/.test(game));
ok('close X inside the panel', /var CLOSE_X = 1220;/.test(ui));
ok('version stamp', /var VERSION = 'V2\.2'/.test(ui));

/* ---- 4. the Android APK, if asked for ---- */
if (WANT_APK) {
    console.log('');
    console.log('=== release APK ===');
    if (!fs.existsSync(APK)) {
        ok('release APK exists', false, 'run ./gradlew assembleRelease first');
    } else {
        const apkNames = execFileSync('tar', ['-tf', APK], { encoding: 'utf8', maxBuffer: MAXBUF })
            .split('\n').map(s => s.trim()).filter(Boolean);
        const apkGame = apkNames.filter(n => n.startsWith('assets/'));
        const apkJs = apkGame.filter(n => n.endsWith('.js')).length;
        /* 25 staged code FILES is 24 .js plus index.html - counting only .js and
         * then asserting 25 flagged a correct APK as short by one. */
        ok('APK has the game code', apkJs >= 24 && apkNames.includes('assets/index.html'),
            `${apkJs} js + index.html`);
        ok('APK has every scene', apkGame.filter(n => n.startsWith('assets/scenes/')).length === 17,
            apkGame.filter(n => n.startsWith('assets/scenes/')).length + ' of 17');
        ok('APK has the ball textures',
            apkNames.filter(n => n.startsWith('assets/assets/balls/')).length >= 19,
            apkNames.filter(n => n.startsWith('assets/assets/balls/')).length + ' of 19');
        ok('APK has the stadium and ball',
            apkNames.includes('assets/assets/background.png') && apkNames.includes('assets/assets/ball.png'));
        ok('APK ships no dev files',
            !apkNames.some(n => /\.md$|tools\//.test(n)));

        let same = 0; const diff = [];
        for (const e of apkGame) {
            const rel = e.slice('assets/'.length);
            const disk = path.join(ROOT, rel.replace(/\//g, path.sep));
            if (!fs.existsSync(disk)) continue;
            if (sha(execFileSync('tar', ['-xOf', APK, e], { maxBuffer: MAXBUF })) === sha(fs.readFileSync(disk))) same++;
            else diff.push(rel);
        }
        ok('APK ships the same game as the working tree', diff.length === 0,
            `${same} files identical` + (diff.length ? `, differing: ${diff.slice(0, 6).join(', ')}` : ''));
    }
}

console.log('');
console.log('size: ' + (fs.statSync(ZIP).size / 1048576).toFixed(2) + ' MB');
console.log(fail === 0 ? 'UPLOAD VERIFIED' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);