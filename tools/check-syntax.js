/* Syntax-check every shipped JS file with the real parser, not a regex.
 *
 * Run: node tools/check-syntax.js
 * Exits non-zero if anything fails to parse.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
const files = [
    'index.html',
    'layout.js', 'main.js', 'ui.js', 'settings.js',
    'achievements.js', 'player.js', 'account.js'
].filter((f) => f.endsWith('.js')).concat(
    fs.readdirSync(path.join(REPO, 'scenes')).filter((f) => f.endsWith('.js')).map((f) => 'scenes/' + f)
);

let fail = 0;
for (const rel of files) {
    const full = path.join(REPO, rel);
    const src = fs.readFileSync(full, 'utf8');
    try {
        /* new vm.Script parses without running, and reports the offending line.
         * Wrapping is unnecessary: these are all plain scripts. */
        new vm.Script(src, { filename: rel });
        console.log('  ok    ' + rel);
    } catch (e) {
        fail++;
        console.log('  FAIL  ' + rel);
        console.log('        ' + String(e.message).split('\n')[0]);
    }
}

console.log('');
console.log(fail === 0 ? files.length + ' FILES PARSE' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);