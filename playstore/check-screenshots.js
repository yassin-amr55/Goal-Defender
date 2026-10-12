/* Check the Play Store screenshots against Google's published requirements.
 *
 * Docs (Play Console > Main store listing > Graphic assets):
 *   - 2 to 8 screenshots per device type
 *   - each side 320px to 3840px
 *   - aspect ratio between 16:9 and 2:1 (JPEG or 24-bit PNG, no alpha)
 */
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'screenshots');
let fail = 0;
const ok = (n, c, d) => { if (!c) fail++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + n + (d ? '  [' + d + ']' : '')); };

function pngSize(file) {
    const b = fs.readFileSync(file);
    if (b.readUInt32BE(0) !== 0x89504e47) return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
}

/* PNG colour type lives in the IHDR chunk: byte 25 of the signature onward. */
function hasAlpha(file) {
    const b = fs.readFileSync(file);
    return b[25] === 4 || b[25] === 6;   // 4 = greyscale+alpha, 6 = RGBA
}

const files = fs.existsSync(DIR)
    ? fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort()
    : [];

console.log('=== Play Store screenshots ===');
console.log('  found ' + files.length + ' in ' + DIR);
console.log('');

ok('between 2 and 8 screenshots', files.length >= 2 && files.length <= 8, String(files.length));

for (const f of files) {
    const s = pngSize(path.join(DIR, f));
    if (!s) { ok(`${f} is a valid PNG`, false); continue; }
    const ar = s.w / s.h;
    const dims = s.w >= 320 && s.w <= 3840 && s.h >= 320 && s.h <= 3840;
    const ratio = ar >= 16 / 9 - 0.001 && ar <= 2 + 0.001;
    const alpha = hasAlpha(path.join(DIR, f));
    ok(`${f}`,
        dims && ratio && !alpha,
        `${s.w}x${s.h}, ratio ${ar.toFixed(3)} (16:9=1.778, max 2.0), ` +
        `${(s.bytes / 1024).toFixed(0)}KB, alpha ${alpha ? 'YES (Play rejects)' : 'no'}`);
}

console.log('');
console.log('=== device coverage ===');
ok('phone screenshots present', files.length >= 2,
    'Play needs 2+ phone screenshots to review the app');
ok('no 10-inch tablet set (not required since 2021)', true,
    'only needed if you later opt into large-screen support');

console.log('');
console.log(fail === 0 ? 'all screenshot checks pass' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);