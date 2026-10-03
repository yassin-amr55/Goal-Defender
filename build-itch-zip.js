/* Build the itch.io upload zip.
 *
 * Mirrors the previous build exactly: same allow-list of shipped files, no dev
 * files, forward-slash entry names (itch rejects backslashes), and the zip holds
 * the files at the root rather than inside a containing folder.
 *
 * Run from the repo root:  node build-itch-zip.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const OUT = 'D:\\Desktop\\goal-defender-itch.zip';

/* What actually ships. Anything not listed here stays out of the upload:
 * node_modules, .git, the markdown planning docs, firestore.rules (a Firebase
 * config the game never reads), and the netlify/vercel deploy descriptors. */
const FILES = [
    'index.html',
    'layout.js',
    'main.js',
    'ui.js',
    'settings.js',
    'achievements.js',
    'player.js',
    'account.js',
    'scenes/BootScene.js',
    'scenes/MenuScene.js',
    'scenes/ShopScene.js',
    'scenes/GameScene.js',
    'scenes/GameOverScene.js',
    'scenes/TutorialScene.js',
    'scenes/TournamentMenuScene.js',
    'scenes/TrophyRoomScene.js',
    'scenes/TournamentNameScene.js',
    'scenes/TournamentBracketScene.js',
    'scenes/TournamentGameScene.js',
    'scenes/TournamentVictoryScene.js',
    'scenes/SettingsScene.js',
    'scenes/AchievementsScene.js',
    'scenes/NamePromptScene.js',
    'scenes/LeaderboardScene.js',
    'scenes/AccountScene.js'
];

/* Everything under assets/ ships. Collected from disk rather than listed by
 * hand so a newly added ball or background cannot be silently left behind.
 *
 * Markdown is skipped: assets/README.md is authoring notes for whoever replaces
 * the placeholder art, not something the game loads. */
function collectAssets(dir, rel) {
    const out = [];
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const r = rel ? rel + '/' + name : name;
        if (fs.statSync(full).isDirectory()) out.push(...collectAssets(full, r));
        else if (!/\.md$/i.test(name)) out.push('assets/' + r);
    }
    return out;
}

const entries = FILES.concat(collectAssets(path.join(ROOT, 'assets'), ''));

/* Development documentation must never ship.
 *
 * The allow-list above already keeps every top-level .js out by omission, and
 * md/ sits at the repo root so collectAssets() cannot reach it. This asserts
 * that rather than trusting it: all project documentation now lives in md/, so
 * if a future edit ever globs the repo instead of assets/, this fails the build
 * instead of quietly uploading the planning docs to itch. */

/* ---- refuse to build a broken upload ---- */
var problems = 0;
for (const e of entries) {
    if (/^md\//.test(e) ||
        /(^|\/)(update-plan|TEST-RESULTS|TOURNAMENT|To-Do|BETTER|GAME_DISCRIPTION|v2\.1)\.md$/i.test(e)) {
        console.log('DEV DOC WOULD SHIP: ' + e);
        problems++;
    }
}
for (const f of FILES) {
    if (!fs.existsSync(path.join(ROOT, f))) {
        console.log('MISSING  ' + f);
        problems++;
    }
}
if (problems) {
    console.log('\naborting: ' + problems + ' listed file(s) missing');
    process.exit(1);
}

/* ---- every local path index.html references must be in the zip ---- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const referenced = new Set();
const re = /(?:src|href)="([^"]+)"/g;
let m;
while ((m = re.exec(html))) {
    const ref = m[1];
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:') || ref.startsWith('#')) continue;
    referenced.add(ref);
}
const shipped = new Set(entries);
for (const ref of referenced) {
    if (!shipped.has(ref)) {
        console.log('index.html references ' + ref + ' but it is NOT in the zip');
        problems++;
    }
}

if (problems) {
    console.log('\naborting: ' + problems + ' problem(s)');
    process.exit(1);
}

/* ---- write it ---- */
if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

// Powershell's Compress-Archive writes backslash separators on some systems,
// which itch.io treats as literal filename characters. Build the archive entry
// list explicitly and add each file by its forward-slash path instead.
const staging = path.join(require('os').tmpdir(), 'gd-itch-staging');
if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

for (const e of entries) {
    const dest = path.join(staging, e);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(ROOT, e), dest);
}

execFileSync('tar', [
    '-a', '-c', '-f', OUT,
    '-C', staging,
    '--format=zip'
].concat(entries), { stdio: 'inherit' });

fs.rmSync(staging, { recursive: true, force: true });

console.log('\nwrote ' + OUT);
console.log('entries: ' + entries.length +
    '  (' + FILES.length + ' code, ' + (entries.length - FILES.length) + ' assets)');
