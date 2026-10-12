/* Verify the AAB ships the same game as the itch zip and the working tree.
 *
 * Usage: node tools/verify-aab.js <aab> <extracted-zip-dir> <repo-root>
 *
 * An AAB stores assets under base/assets/ and its AndroidManifest inside a
 * protobuf rather than as plain XML, so the entry names differ from the APK even
 * though the payload is the same. The game files are still plain bytes at
 * base/assets/<path>, which is what this compares.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const AAB = process.argv[2];
const ZIPDIR = process.argv[3];
const REPO = process.argv[4];
const MAXBUF = 128 * 1024 * 1024;

if (!AAB || !ZIPDIR || !REPO) {
    console.error('usage: node tools/verify-aab.js <aab> <extracted-zip-dir> <repo-root>');
    process.exit(2);
}

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const list = f => execFileSync('tar', ['-tf', f], { encoding: 'utf8', maxBuffer: MAXBUF })
    .split('\n').map(s => s.trim()).filter(Boolean);

let fail = 0;
const ok = (n, c, d) => { if (!c) fail++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + n + (d ? '  [' + d + ']' : '')); };

const names = list(AAB);

console.log('=== AAB structure ===');
ok('BundleConfig.pb present (marks it as an App Bundle, not a renamed APK)',
    names.includes('BundleConfig.pb'));
ok('signed with JAR signing', names.some(n => /^META-INF\/.*\.RSA$/.test(n)),
    names.filter(n => /^META-INF\//.test(n)).join(', '));
ok('manifest is compiled protobuf, as bundles require',
    names.includes('base/manifest/AndroidManifest.xml') && fs.statSync(AAB).size > 0);
ok('dex is bundled', names.some(n => /^base\/dex\/classes.*\.dex$/.test(n)));

console.log('');
console.log('=== game payload ===');
const game = names.filter(n => n.startsWith('base/assets/'));
ok('25 code files staged (24 js + index.html)',
    game.filter(n => n.endsWith('.js')).length === 24 && game.includes('base/assets/index.html'),
    `${game.filter(n => n.endsWith('.js')).length} js + index.html`);
ok('17 of 17 scenes present', game.filter(n => n.startsWith('base/assets/scenes/')).length === 17,
    String(game.filter(n => n.startsWith('base/assets/scenes/')).length));
ok('19 of 19 ball textures present', game.filter(n => n.startsWith('base/assets/assets/balls/')).length === 19,
    String(game.filter(n => n.startsWith('base/assets/assets/balls/')).length));
ok('stadium background and Default Ball texture present',
    game.includes('base/assets/assets/background.png') && game.includes('base/assets/assets/ball.png'));
ok('no dev files in the bundle',
    !names.some(n => /\.md$/.test(n) || /^base\/assets\/(tools|android|playstore|md)\//.test(n)));

console.log('');
console.log('=== byte-identical to the working tree and the itch zip ===');
let vsDisk = 0, vsZip = 0;
const dDiff = [], zDiff = [];
for (const e of game) {
    const rel = e.slice('base/assets/'.length);
    if (!rel || rel === 'google-services.json') continue;
    const bytes = execFileSync('tar', ['-xOf', AAB, e], { maxBuffer: MAXBUF });

    const disk = path.join(REPO, rel.replace(/\//g, path.sep));
    if (fs.existsSync(disk)) {
        if (sha(bytes) === sha(fs.readFileSync(disk))) vsDisk++; else dDiff.push(rel);
    }
    const zip = path.join(ZIPDIR, rel.replace(/\//g, path.sep));
    if (fs.existsSync(zip)) {
        if (sha(bytes) === sha(fs.readFileSync(zip))) vsZip++; else zDiff.push(rel);
    }
}
ok('every game file matches the working tree', dDiff.length === 0,
    `${vsDisk} files` + (dDiff.length ? `, differing: ${dDiff.slice(0, 6).join(', ')}` : ''));
ok('every game file matches the itch zip', zDiff.length === 0,
    `${vsZip} files` + (zDiff.length ? `, differing: ${zDiff.slice(0, 6).join(', ')}` : ''));

console.log('');
console.log('size: ' + (fs.statSync(AAB).size / 1048576).toFixed(2) + ' MB');
console.log(fail === 0 ? 'AAB VERIFIED' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);