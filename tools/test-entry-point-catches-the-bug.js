/* Prove tools/verify-entry-point.js actually catches the bugs it was written for.
 *
 * This exists because of how the blank-screen bug shipped in the first place:
 * the check said PASS on a build that showed the player a WebView error page.
 * Every other verifier passed too - they confirmed assets/index.html was present
 * in the APK, which it was. Nothing checked that the app pointed AT it.
 *
 * A verifier that has never been shown a failing case is an assumption wearing a
 * green tick. So here are the real broken versions, the ones that actually
 * shipped, and the checker has to reject every one of them.
 *
 * Run: node tools/test-entry-point-catches-the-bug.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const REAL = path.join(REPO, 'android', 'app', 'src', 'main', 'java', 'com',
    'dailyapps', 'goaldefender', 'MainActivity.java');
const APK = path.join(REPO, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

let fail = 0;
const ok = (n, c, d) => { if (!c) fail++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + n + (d ? '  [' + d + ']' : '')); };

const real = fs.readFileSync(REAL, 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-entry-'));

/* Run the real checker against a mutated copy of MainActivity. */
function run(mutated) {
    const f = path.join(tmp, 'MainActivity' + (mutated.n || '') + '.java');
    fs.writeFileSync(f, mutated.src);
    try {
        const out = execFileSync('node',
            [path.join(__dirname, 'verify-entry-point.js'), APK],
            { encoding: 'utf8', env: Object.assign({}, process.env, { GD_ACTIVITY: f }), maxBuffer: 1 << 28 });
        return { passed: true, out };
    } catch (e) {
        return { passed: false, out: (e.stdout || '') + (e.stderr || '') };
    }
}

/* Every mutation below is a bug that could actually reach a device. */
const cases = [
    {
        n: 'wwwPrefix',
        why: 'the bug that shipped: /assets/www/index.html, which does not exist',
        expect: 'fails',
        src: real.replace('ORIGIN + "/assets/index.html"', 'ORIGIN + "/assets/www/index.html"')
    },
    {
        n: 'qaFlag',
        why: 'the ?noleaderboard QA flag shipped to players, so Android could never submit a score',
        expect: 'fails',
        src: real.replace('ORIGIN + "/assets/index.html"', 'ORIGIN + "/assets/index.html?noleaderboard"')
    },
    {
        n: 'wrongDir',
        why: 'entry point in the wrong directory',
        expect: 'fails',
        src: real.replace('ORIGIN + "/assets/index.html"', 'ORIGIN + "/game/index.html"')
    },
    {
        n: 'wrongDomain',
        why: 'URL off the domain the asset loader serves, so every request 404s',
        expect: 'fails',
        src: real.replace('ORIGIN + "/assets/index.html"', '"https://appassets.example.com" + "/assets/index.html"')
    },
    {
        n: 'assetRoot',
        why: 'handler mounted at the root instead of /assets/, so the path no longer matches',
        expect: 'fails',
        src: real.replace('addPathHandler("/assets/"', 'addPathHandler("/"')
    },
    {
        n: 'correct',
        why: 'the real, fixed source - must PASS, or the check is broken',
        expect: 'passes',
        src: real
    }
];

console.log('=== the checker rejects every bug that could reach a device ===');
for (const c of cases) {
    const r = run(c);
    const wantPass = c.expect === 'passes';
    const good = r.passed === wantPass;
    if (!good) fail++;
    console.log('  ' + (good ? 'ok  ' : 'FAIL') + '  ' + c.n + ' -> checker ' + (r.passed ? 'PASSED' : 'failed') +
        '  (want ' + (wantPass ? 'passed' : 'failed') + ')');
    if (!good) console.log('        ' + c.why);
    if (!r.passed && r.out) {
        const line = (r.out.split('\n').find(l => /FAIL/.test(l)) || '').trim();
        if (line) console.log('        reported: ' + line.replace(/\s+/g, ' ').slice(0, 150));
    }
}

console.log('');
console.log('=== and the real source is genuinely correct ===');
const realRun = run({ src: real, n: 'Real' });
ok('the committed MainActivity passes its own check', realRun.passed,
    realRun.passed ? 'START_URL resolves to a file in the APK' : '*** the committed source is broken ***');

/* Assert on the URL the checker PARSES, not on the raw file text. MainActivity's
 * comments deliberately mention "/assets/www/index.html" and "?noleaderboard" to
 * document why they were removed, so a text search over the file finds them and
 * condemns a correct build. */
const parsed = execFileSync('node', [path.join(__dirname, 'verify-entry-point.js'), '--print-start-url'],
    { encoding: 'utf8' }).trim();
ok('the parsed start URL has no www/ segment', !/assets\/www\//.test(parsed), parsed);
ok('the parsed start URL has no QA query flag', !/\?/.test(parsed), parsed);
ok('the parsed start URL points at index.html', /\/assets\/index\.html$/.test(parsed), parsed);
ok('the parsed start URL is on the reserved asset origin',
    parsed.startsWith('https://appassets.androidplatform.net'), parsed);

fs.rmSync(tmp, { recursive: true, force: true });

console.log('');
console.log(fail === 0 ? 'THE CHECKER REALLY CATCHES IT' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);