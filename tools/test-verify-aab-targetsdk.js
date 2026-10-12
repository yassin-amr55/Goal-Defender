/* Negative test for the targetSdk check in verify-aab.js.
 *
 * A check that cannot fail is worse than no check, because it reports success.
 * This proves the protobuf parser actually discriminates: it must read a low
 * value as low (so the >= 36 assertion rejects it) and must return null for a
 * missing key (so the check fails loudly rather than passing vacuously).
 *
 * Run: node tools/test-verify-aab-targetsdk.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const src = fs.readFileSync(path.join(__dirname, 'verify-aab.js'), 'utf8');
const body = src.match(/function protoAttrValue[\s\S]*?\n\}/);
if (!body) { console.error('FAIL  could not find protoAttrValue in verify-aab.js'); process.exit(1); }
const protoAttrValue = new Function('return (' + body[0].replace('function protoAttrValue', 'function') + ')')();

let fail = 0;
const check = (name, got, want) => {
    const good = got === want;
    if (!good) fail++;
    console.log('  ' + (good ? 'ok  ' : 'FAIL') + '  ' + name + '  [got ' + JSON.stringify(got) +
        ', want ' + JSON.stringify(want) + ']');
};

/* Build a protobuf-shaped blob the way the real one looks:
 *   ... android:\u0010targetSdkVersion \u001a <len> "36" ...
 * The length prefix must equal the digit count for the value to be valid. */
const synth = n => Buffer.from(
    'android:\u0010targetSdkVersion\u001a' + String.fromCharCode(String(n).length) + String(n) + '"',
    'latin1');

console.log('=== the parser discriminates ===');
check('reads a synthetic 35 (the level Play rejected)', protoAttrValue(synth(35), 'targetSdkVersion'), '35');
check('reads a synthetic 36', protoAttrValue(synth(36), 'targetSdkVersion'), '36');
check('reads a synthetic 24', protoAttrValue(synth(24), 'targetSdkVersion'), '24');
check('returns null for a missing key, so the check fails loudly',
    protoAttrValue(Buffer.from('nothing relevant here', 'latin1'), 'targetSdkVersion'), null);

console.log('');
console.log('=== the assertion rejects what Play rejects ===');
for (const [n, wantPass] of [[35, false], [34, false], [36, true], [37, true]]) {
    const v = protoAttrValue(synth(n), 'targetSdkVersion');
    const passed = v !== null && parseInt(v, 10) >= 36;
    const good = passed === wantPass;
    if (!good) fail++;
    console.log('  ' + (good ? 'ok  ' : 'FAIL') + '  targetSdk ' + n + ' -> ' + (passed ? 'accepted' : 'rejected') +
        '  (want ' + (wantPass ? 'accepted' : 'rejected') + ')');
}

console.log('');
console.log('=== against the real bundle ===');
const aab = process.argv[2] ||
    path.join(__dirname, '..', 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
if (!fs.existsSync(aab)) {
    console.log('  skip  bundle not built yet at ' + aab);
} else {
    const m = execFileSync('tar', ['-xOf', aab, 'base/manifest/AndroidManifest.xml'], { maxBuffer: 1 << 28 });
    check('real bundle minSdkVersion', protoAttrValue(m, 'minSdkVersion'), '24');
    const t = protoAttrValue(m, 'targetSdkVersion');
    check('real bundle targetSdkVersion', t, '36');
    check('real bundle satisfies the >= 36 gate', t !== null && parseInt(t, 10) >= 36, true);
}

console.log('');
console.log(fail === 0 ? 'TARGET SDK CHECK IS REAL' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);