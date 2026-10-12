/* Make the captured screenshots upload-ready for the Play Store.
 *
 * The canvas produces RGBA PNGs (toDataURL always writes an alpha channel), and
 * Play accepts only JPEG or 24-bit PNG without alpha. An RGBA screenshot is
 * rejected at upload, so the alpha has to be flattened rather than ignored.
 *
 * The alpha is fully opaque everywhere - the game fills the frame - so dropping
 * the channel loses nothing. It also shrinks the files, since 8 bits per pixel
 * of constant 255 is pure overhead: play-06-game.png went from 1.5MB to under
 * 400KB.
 *
 * Dimensions are already correct and are NOT rescaled: the game renders at
 * 1280x720, which is exactly 16:9 and inside Play's 320-3840px range. Upscaling
 * to 1080p would add bytes and no detail.
 *
 * Run: node playstore/prepare-screenshots.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = path.join(__dirname, 'screenshots');
const MAXBUF = 128 * 1024 * 1024;

if (!fs.existsSync(DIR)) {
    console.error('no screenshots directory at ' + DIR);
    process.exit(1);
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort();
if (!files.length) {
    console.error('no PNGs found in ' + DIR);
    process.exit(1);
}

/* PNG IHDR colour type: byte 25 from the start of the signature. */
function colourType(file) {
    return fs.readFileSync(file)[25];
}

console.log('=== flattening screenshots to 24-bit RGB ===');
for (const f of files) {
    const full = path.join(DIR, f);
    const before = fs.statSync(full).size;
    const ct = colourType(full);
    const hadAlpha = ct === 4 || ct === 6;

    if (hadAlpha) {
        const tmp = full + '.tmp.png';
        execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-i', full,
            '-vf', 'format=rgb24', '-frames:v', '1', '-y', tmp],
            { maxBuffer: MAXBUF });
        fs.renameSync(tmp, full);
    }

    const after = fs.statSync(full).size;
    const nowType = colourType(full);
    const okNow = nowType === 2;   // 2 = truecolour RGB, no alpha
    console.log('  ' + f.padEnd(30) +
        (before / 1024).toFixed(0).padStart(6) + ' KB -> ' +
        (after / 1024).toFixed(0).padStart(6) + ' KB   ' +
        'colourType ' + ct + ' -> ' + nowType +
        (okNow ? '  ok' : '  *** STILL HAS ALPHA ***'));
}

console.log('');
console.log('Upload ' + DIR + ' directly - Play takes up to 8 at 320-3840px, 16:9 to 2:1.');