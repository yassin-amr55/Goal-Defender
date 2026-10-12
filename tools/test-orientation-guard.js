/* Negative test: the orientation guard must reject a manifest that hard-locks
 * orientation, which is what cost 13 devices from the Play listing.
 *
 * A guard that has never been shown a failing case is an assumption wearing a
 * green tick - and this particular failure is invisible locally, because the
 * build succeeds and only Play complains, after a release has been cut.
 *
 * Run: node tools/test-orientation-guard.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const MANIFEST = path.join(REPO, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const APK = path.join(REPO, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

let fail = 0;
const ok = (n, c, d) => { if (!c) fail++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + n + (d !== undefined ? '  [' + d + ']' : '')); };

const real = fs.readFileSync(MANIFEST, 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-orient-'));
const fakeRepo = path.join(tmp, 'repo');
fs.mkdirSync(path.join(fakeRepo, 'android', 'app', 'src', 'main'), { recursive: true });

/* Only the MANIFEST varies between cases. MainActivity is pointed at the real one
 * on purpose: if the fake repo also lacks MainActivity.java then every run exits
 * non-zero with ENOENT, and the "rejects" cases would pass for the wrong reason -
 * a crash, not the guard. That is the exact failure this suite exists to avoid,
 * and it would have looked green. */
const REAL_ACTIVITY = path.join(REPO, 'android', 'app', 'src', 'main', 'java', 'com',
    'dailyapps', 'goaldefender', 'MainActivity.java');

function run(mutatedManifest) {
    const mPath = path.join(fakeRepo, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
    fs.writeFileSync(mPath, mutatedManifest);
    try {
        execFileSync('node', [path.join(__dirname, 'verify-entry-point.js'), APK],
            {
                encoding: 'utf8', cwd: fakeRepo, maxBuffer: 1 << 28,
                env: Object.assign({}, process.env, {
                    GD_REPO: fakeRepo,
                    GD_ACTIVITY: REAL_ACTIVITY
                })
            });
        return { passed: true, out: '' };
    } catch (e) {
        return { passed: false, out: (e.stdout || '') + (e.stderr || '') };
    }
}

/* Mutate the ATTRIBUTE, not the example quoted inside the comment above it.
 *
 * A regex over the raw file hits the comment first, so the original version of
 * this rewrote the documentation and left the real attribute untouched - every
 * "must reject" case then passed through as a genuine accept. Stripping comments
 * first is the same lesson the guard itself learned. */
const CLEAN = real.replace(/<!--[\s\S]*?-->/g, ' ');
const withOrientation = (o) => CLEAN.replace(/android:screenOrientation\s*=\s*"[^"]*"/,
    'android:screenOrientation="' + o + '"');

console.log('=== the guard rejects every orientation that costs devices ===');
for (const o of ['landscape', 'portrait', 'sensorPortrait', 'reverseLandscape']) {
    const r = run(withOrientation(o));
    /* Assert on the REASON, not just the exit code. A crash also exits non-zero,
     * and a rejection for the wrong reason is not a passing test. */
    const reported = /THIS COSTS DEVICES/.test(r.out);
    ok('rejects screenOrientation="' + o + '"', r.passed === false && reported,
        reported ? '' : (r.out.match(/FAIL[^\n]*/) || ['no guard message'])[0].trim());
}

console.log('');
console.log('=== and accepts the ones that keep every device listed ===');
for (const o of ['fullUser', 'user', 'unspecified']) {
    const r = run(withOrientation(o));
    ok('accepts screenOrientation="' + o + '"', r.passed === true,
        r.passed ? '' : (r.out.match(/FAIL[^\n]*/) || ['no detail'])[0].trim());
}

console.log('');
console.log('=== the committed manifest is correct ===');
ok('the real manifest does not hard-lock', run(real).passed === true);
ok('it declares fullUser', /android:screenOrientation="fullUser"/.test(real));

fs.rmSync(tmp, { recursive: true, force: true });

console.log('');
console.log(fail === 0 ? 'THE ORIENTATION GUARD IS REAL' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);