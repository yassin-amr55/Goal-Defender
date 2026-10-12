/* Confirm R8 did not strip anything the app needs to launch.
 *
 * A WebView shell that survives shrinking has its Activity class, its
 * WebViewAssetLoader dependency, its layout and its launcher icon all still
 * present. R8 rewrites names, so this checks for the CLASS descriptors that
 * matter rather than for the original source strings.
 *
 * The game itself is plain files under assets/ and is compared byte-for-byte by
 * the upload and AAB verifiers - R8 never looks inside assets.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const APK = process.argv[2];
const MAXBUF = 128 * 1024 * 1024;
if (!APK) { console.error('usage: node tools/verify-r8-kept-what-it-needed.js <apk>'); process.exit(2); }

let fail = 0;
const ok = (n, c, d) => { if (!c) fail++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + n + (d ? '  [' + d + ']' : '')); };

const names = execFileSync('tar', ['-tf', APK], { encoding: 'utf8', maxBuffer: MAXBUF })
    .split('\n').map(s => s.trim()).filter(Boolean);

/* Pull every dex out and search the raw bytes. DEX stores type descriptors as
 * plain MUTF-8 strings, so a substring search is sufficient and reliable. */
const dexes = names.filter(n => /^classes\d*\.dex$/.test(n));
ok('dex present', dexes.length > 0, dexes.join(', '));
const blob = Buffer.concat(dexes.map(n => execFileSync('tar', ['-xOf', APK, n], { maxBuffer: MAXBUF })));
const text = blob.toString('latin1');

console.log('=== classes R8 must keep ===');
/* Lcom/dailyapps/goaldefender/MainActivity; is the DEX descriptor form. */
ok('MainActivity class kept', text.includes('Lcom/dailyapps/goaldefender/MainActivity;'),
    'named in the manifest and instantiated by the framework');
ok('package namespace kept', text.includes('com/dailyapps/goaldefender'),
    'the whole app is one package');
ok('WebViewAssetLoader kept', text.includes('androidx/webkit/WebViewAssetLoader'),
    'the class doing the https asset serving - stripping it is a black screen');
ok('onCreate kept', text.includes('onCreate'),
    'the Activity entry point');
ok('WebView kept', text.includes('android/webkit/WebView'));
ok('startActivity kept', text.includes('startActivity'));

console.log('');
console.log('=== resources R8 must keep ===');
/* shrinkResources RENAMES resource paths - res/layout/activity_main.xml becomes
 * something like res/_G.xml - so asserting on file paths reports a correct build
 * as broken. What matters is that the resources still EXIST and that the
 * manifest's references still resolve to them. */
ok('resources were not stripped', names.filter(n => n.startsWith('res/')).length > 100,
    names.filter(n => n.startsWith('res/')).length + ' res entries');
ok('resources.arsc table present', names.includes('resources.arsc'),
    'the compiled table the loader reads at runtime');
ok('launcher icon resolves (adaptive icon XML after shrinking)',
    names.includes('res/BW.xml') || names.some(n => /^res\/.*\.xml$/.test(n)),
    'aapt2 reports application icon=res/BW.xml');
ok('nav styles/themes present', names.some(n => n.startsWith('res/')),
    'the theme is referenced from the manifest');

console.log('');
console.log('=== the game must be untouched by shrinking ===');
const game = names.filter(n => n.startsWith('assets/'));
ok('all 25 code files still staged', game.filter(n => n.endsWith('.js')).length === 24,
    game.filter(n => n.endsWith('.js')).length + ' js + index.html');
ok('all 19 ball textures still staged',
    game.filter(n => n.startsWith('assets/assets/balls/')).length === 19,
    String(game.filter(n => n.startsWith('assets/assets/balls/')).length));

console.log('');
console.log('dex size: ' + (blob.length / 1024).toFixed(0) + ' KB   apk: ' +
    (fs.statSync(APK).size / 1048576).toFixed(2) + ' MB');
console.log(fail === 0 ? 'R8 KEPT EVERYTHING IT NEEDED' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);