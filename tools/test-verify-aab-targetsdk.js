/* Negative test for the protobuf attribute parser and the targetSdk check in
 * verify-aab.js.
 *
 * A check that cannot fail is worse than no check, because it reports success.
 * This proves the parser actually discriminates: it must read a low value as low
 * (so the >= 36 assertion rejects it) and must return null for a missing key or
 * an implausible length, rather than passing vacuously.
 *
 * It also pins the exact byte shape the real bundle uses, because the previous
 * parser got the right answer for the wrong reason: it matched digits followed
 * by a quote, and that quote was really the next field's tag byte (0x22). It
 * only agreed with the length prefix because the values were numeric. The
 * "2.2. next field tag is 0x28" case below is the one that caught it.
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
const ok = (n, c, d) => { if (!c) fail++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + n + (d ? '  [' + d + ']' : '')); };
/* Strict equality, for assertions about what the parser READ. Aliasing this to
 * ok() would be a disaster: `true === "35"` is false for the right reason, but
 * aliasing it the other way - asserting a boolean through check() - makes
 * check() compare a claim against its own detail text and fail on the wrong
 * thing. Values go through check(), claims go through ok(). */
const check = (name, got, want) => {
    const good = got === want;
    if (!good) fail++;
    console.log('  ' + (good ? 'ok  ' : 'FAIL') + '  ' + name + '  [got ' + JSON.stringify(got) +
        ', want ' + JSON.stringify(want) + ']');
};

/* Build a blob with the real layout: key, 0x1a tag, length byte, that many value
 * bytes, then the next field's tag. nextTag defaults to 0x22, which is what a
 * numeric value happened to be followed by - the coincidence the old parser
 * relied on. */
const synth = (key, value, nextTag) => Buffer.concat([
    Buffer.from(key, 'latin1'),
    Buffer.from([0x1a, String(value).length]),
    Buffer.from(String(value), 'latin1'),
    Buffer.from([nextTag === undefined ? 0x22 : nextTag])
]);
const sdk = n => synth('targetSdkVersion', n);

console.log('=== the parser discriminates ===');
check('reads a synthetic 35 (the level Play rejected)', protoAttrValue(sdk(35), 'targetSdkVersion'), '35');
check('reads a synthetic 36', protoAttrValue(sdk(36), 'targetSdkVersion'), '36');
check('reads a synthetic 24', protoAttrValue(sdk(24), 'targetSdkVersion'), '24');

console.log('');
console.log('=== the shape that broke the old parser ===');
/* value followed by 0x28 instead of 0x22. The old quote-matching parser read
 * "2.2" and then demanded a quote, saw 0x28, and returned null. */
check('reads "2.2" even when the next tag is 0x28, not a quote',
    protoAttrValue(synth('versionName', '2.2', 0x28), 'versionName'), '2.2');
check('reads a single-digit version code', protoAttrValue(synth('versionCode', '1'), 'versionCode'), '1');
check('reads a four-digit value by its length, not by a quote',
    protoAttrValue(synth('someLongKey', '1234'), 'someLongKey'), '1234');

console.log('');
console.log('=== refuses to guess ===');
check('returns null for a missing key, so the check fails loudly',
    protoAttrValue(Buffer.from('nothing relevant here', 'latin1'), 'targetSdkVersion'), null);
check('returns null when the tag byte is wrong (not a string attribute)',
    protoAttrValue(Buffer.concat([Buffer.from('versionCode'), Buffer.from([0x40, 0x02]), Buffer.from('1\x00')]),
        'versionCode'), null);
check('returns null on an implausible length rather than reading garbage',
    protoAttrValue(Buffer.concat([Buffer.from('versionCode'), Buffer.from([0x1a, 0xff]), Buffer.from('1')]),
        'versionCode'), null);

console.log('');
console.log('=== the assertion rejects what Play rejects ===');
for (const [n, wantPass] of [[35, false], [34, false], [36, true], [37, true]]) {
    const v = protoAttrValue(sdk(n), 'targetSdkVersion');
    const passed = v !== null && parseInt(v, 10) >= 36;
    const good = passed === wantPass;
    if (!good) fail++;
    console.log('  ' + (good ? 'ok  ' : 'FAIL') + '  targetSdk ' + n + ' -> ' + (passed ? 'accepted' : 'rejected') +
        '  (want ' + (wantPass ? 'accepted' : 'rejected') + ')');
}

console.log('');
console.log('=== the versionCode gate rejects the spent code 1 ===');
for (const [n, wantPass] of [[1, false], [2, true], [3, true]]) {
    const v = protoAttrValue(synth('versionCode', n), 'versionCode');
    const passed = v !== null && parseInt(v, 10) > 1;
    const good = passed === wantPass;
    if (!good) fail++;
    console.log('  ' + (good ? 'ok  ' : 'FAIL') + '  versionCode ' + n + ' -> ' + (passed ? 'accepted' : 'rejected') +
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
    check('real bundle targetSdkVersion', protoAttrValue(m, 'targetSdkVersion'), '36');
    check('real bundle versionName', protoAttrValue(m, 'versionName'), '2.2');

    /* The versionCode must match what build.gradle declares, not a literal in
     * this file. Play burns every code it sees, so it gets bumped often, and a
     * test that hardcodes it goes stale and fails for the wrong reason - which
     * trains you to ignore it. Read the declaration instead. */
    const gradle = fs.readFileSync(
        path.join(__dirname, '..', 'android', 'app', 'build.gradle'), 'utf8');
    const declared = (gradle.match(/^\s*versionCode\s+(\d+)\s*$/m) || [])[1];
    ok('build.gradle declares a versionCode', !!declared, 'versionCode ' + declared);
    check('the bundle carries the versionCode build.gradle declares',
        protoAttrValue(m, 'versionCode'), declared);
    ok('that versionCode is above the spent code 1',
        parseInt(protoAttrValue(m, 'versionCode'), 10) > 1,
        'versionCode ' + protoAttrValue(m, 'versionCode'));
}

console.log('');
console.log(fail === 0 ? 'PARSER AND CHECKS ARE REAL' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);