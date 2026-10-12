/* Generate Play Store and Android launcher icons from assets/ball.png.
 *
 * The source is a greyscale football on a TRANSPARENT background. Two problems
 * with shipping it as-is:
 *
 *   1. Play Store icons must be opaque. A transparent PNG gets flattened onto
 *      white by the store, and a light-grey ball on white is close to invisible
 *      in a list of apps.
 *   2. The ball fills the frame edge to edge, so an adaptive icon would have its
 *      outer third cropped by whatever mask the launcher applies - circle, squircle
 *      or teardrop all cut the edges off.
 *
 * So the ball is inset on the game's own navy (#0b1220, the colour of its panel
 * borders and stroke) and left as the single foreground layer.
 *
 * Run: node make-play-icons.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'assets', 'ball.png');
const NAVY = '0x0b1220';
const TMP = path.join(process.env.TEMP, 'gd-icons');

if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

function ff(args) {
    /* -frames:v 1 is required whenever a filtergraph writes an image file. Without
     * it ffmpeg treats the output as a sequence and fails with "Cannot write more
     * than one file with the same name". */
    execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', ...args], { stdio: 'pipe' });
}

/* Flatten the transparent ball onto an opaque navy canvas. */
function flattened(size, ballFraction) {
    const out = path.join(TMP, `flat-${size}-${ballFraction}.png`);
    const side = Math.round(size * ballFraction);
    const inset = Math.round((size - side) / 2);
    ff([
        '-i', SRC,
        // scale the ball, pad with navy underneath
        '-filter_complex',
        `[0:v]scale=${side}:${side}[b];` +
        `color=c=${NAVY}:s=${size}x${size}[bg];` +
        `[bg][b]overlay=${inset}:${inset}:format=auto,format=rgb24`,
        '-frames:v', '1',
        '-y', out
    ]);
    return out;
}

/* The ball alone on a fully transparent canvas, sized to fit inside an adaptive
 * icon's safe zone.
 *
 * Needed for the adaptive icon FOREGROUND layer only. The background layer
 * supplies the navy, so compositing navy into the foreground as well covers the
 * whole canvas in opaque pixels: the artwork then measures as filling 100% of the
 * layer, the launcher mask crops its edges, and the flat background never shows
 * through. Reusing flattened() here was that bug.
 *
 * scale + pad, NOT overlay onto a `color` source. The color-source and overlay
 * path silently loses the alpha channel and produced a fully opaque foreground,
 * which measured as the art filling 100% of the canvas at every density. */
function foreground(size) {
    const out = path.join(TMP, `fg-${size}.png`);
    const art = Math.round(size * (66 / 108));   // 66dp of 108dp survives any mask
    ff([
        '-i', SRC,
        '-vf', `scale=${art}:${art},` +
               `pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=black@0.0,format=rgba`,
        '-frames:v', '1',
        '-y', out
    ]);
    return out;
}

function write(dest, srcPng) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(srcPng, dest);
    const kb = fs.statSync(dest).size / 1024;
    console.log(`  ${path.relative(ROOT, dest).padEnd(52)} ${kb.toFixed(1)} KB`);
}

/* ---------- Play Store listing icon ---------- */
console.log('=== Play listing icon ===');
// 512x512 opaque, ball at 84% so it reads clearly in the store grid.
const listing = flattened(512, 0.84);
write(path.join(ROOT, 'playstore', 'icon-512.png'), listing);

/* ---------- Play feature graphic ---------- */
// 1024x500, the banner shown at the top of the listing.
console.log('\n=== Play feature graphic 1024x500 ===');
const featureBall = flattened(420, 1.0);
const feature = path.join(TMP, 'feature.png');
ff([
    '-f', 'lavfi', '-i', `color=c=${NAVY}:s=1024x500`,
    '-i', featureBall,
    '-filter_complex', '[0:v][1:v]overlay=72:40:format=auto,format=rgb24',
    '-frames:v', '1',
    '-y', feature
]);
write(path.join(ROOT, 'playstore', 'feature-graphic-1024x500.png'), feature);

/* ---------- Android launcher icons ---------- */
// Legacy mipmaps. 192/144/96/72/48 = mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi.
console.log('\n=== Android mipmaps (legacy) ===');
const legacy = { 'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192 };
for (const [dpi, size] of Object.entries(legacy)) {
    // Legacy icons are NOT masked, so the ball can use more of the frame.
    write(path.join(ROOT, 'android', 'app', 'src', 'main', 'res', `mipmap-${dpi}`, 'ic_launcher.png'),
        flattened(size, 0.92));
}

/* Round icons are for launchers that ask for them; the same art, circular. */
console.log('\n=== Android round mipmaps ===');
for (const [dpi, size] of Object.entries(legacy)) {
    const out = path.join(TMP, `round-${dpi}.png`);
    const inner = flattened(size, 0.78);
    ff(['-i', inner,
        '-f', 'lavfi', '-i', `color=c=${NAVY}:s=${size}x${size}`,
        '-filter_complex',
        `[1:v][0:v]overlay=0:0:format=auto,format=rgba,` +
        `geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':` +
        `a='if(lte(hypot(X-${size / 2},Y-${size / 2}),${size / 2}),255,0)'`,
        '-frames:v', '1',
        '-y', out]);
    write(path.join(ROOT, 'android', 'app', 'src', 'main', 'res', `mipmap-${dpi}`, 'ic_launcher_round.png'), out);
}

/* ---------- Adaptive icon (Android 8+) ----------
 *
 * The foreground layer is 108dp, of which only the middle 66dp survives any
 * mask. At the 432px density-3xx render that safe zone is 264px, so the ball is
 * scaled to 62% of the canvas and centred. Anything larger gets its edges
 * cropped by the launcher's mask.
 *
 * The foreground is the ball on TRANSPARENCY, not on navy - see ballOnly(). The
 * navy comes from the background layer, so it stays crisp at every density and
 * the launcher can tint or animate it. */
console.log('\n=== Adaptive icon foreground/background ===');
for (const [dpi, size] of Object.entries({ 'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432 })) {
    write(path.join(ROOT, 'android', 'app', 'src', 'main', 'res', `mipmap-${dpi}`, 'ic_launcher_foreground.png'),
        foreground(size));
}

// Background layer is a flat fill; XML so it stays crisp at every density.
const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by make-play-icons.js. The adaptive background is a flat fill, so
     it is XML rather than a bitmap: one file serves every density. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/gd_navy" />
</adaptive-icon>
`;
const mipAny = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'mipmap-anydpi-v26');
fs.mkdirSync(mipAny, { recursive: true });
fs.writeFileSync(path.join(mipAny, 'ic_launcher.xml'), bgXml);
console.log(`  mipmap-anydpi-v26/ic_launcher.xml (background: @color/gd_navy)`);

console.log('\ndone. Verify ic_launcher_foreground stays inside the 66dp safe zone before shipping.');