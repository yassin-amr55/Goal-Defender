/* Verify the WebView's start URL actually resolves to a file in the APK.
 *
 * Why this exists: the first packaged build shipped a blank screen on device,
 *
 *   https://appassets.androidplatform.net/assets/www/index.html
 *   net::ERR_INVALID_RESPONSE
 *
 * because START_URL asked for /assets/www/index.html while the staging task
 * copies the game into the APK's assets/ root with no www/ directory. The asset
 * loader found no file, returned null, and WebView fell through to a real
 * network request for a domain that does not resolve publicly.
 *
 * Every other check in this repo passed while that was broken. They verified
 * that assets/index.html was PRESENT in the APK. Nothing checked that the app
 * pointed AT it. Presence is not reachability, and a static-content check cannot
 * tell the difference.
 *
 * So this resolves the URL the way WebViewAssetLoader does:
 *   1. read ORIGIN and START_URL out of MainActivity.java
 *   2. read the prefix registered by addPathHandler
 *   3. strip origin, then strip that prefix, and the remainder is the path the
 *      loader will look for inside the APK's assets/ directory
 *   4. assert that file is actually in the APK
 * It then walks index.html and asserts every relative subresource resolves too,
 * since a wrong entry point is rarely the only wrong path.
 *
 * Usage: node tools/verify-entry-point.js <apk>
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/* --print-start-url prints just the resolved URL and nothing else, so other
 * tools can assert against the PARSED value. Grepping the source file for
 * strings is not the same thing - MainActivity documents the old broken URL and
 * the ?noleaderboard flag in its own comments, so a naive text search finds them
 * and reports a correct build as broken.
 *
 * console is silenced up front rather than trying to skip each report, because
 * the two sanity checks below the parse run before this branch would otherwise
 * pollute stdout and a caller parsing it would read the wrong line. The URL
 * itself goes to process.stdout directly, bypassing the silenced console. */
const QUIET = process.argv.includes('--print-start-url');
if (QUIET) { console.log = () => {}; console.error = () => {}; }

const REPO = path.join(__dirname, '..');
/* Overridable so tools/test-entry-point-catches-the-bug.js can point it at a
 * deliberately broken copy and prove the check actually fails. */
const ACTIVITY = process.env.GD_ACTIVITY ||
    path.join(REPO, 'android', 'app', 'src', 'main', 'java', 'com',
        'dailyapps', 'goaldefender', 'MainActivity.java');

let fail = 0;
const ok = (n, c, d) => { if (!c) fail++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + n + (d ? '  [' + d + ']' : '')); };

/* ---- read MainActivity, with comments stripped --------------------------------
 *
 * Comments are stripped before any parsing, because a regex over commented-out
 * source will happily match text that is not code.
 *
 * It has to be a real scanner, not a regex. The obvious
 *
 *     src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ')
 *
 * looks fine and is wrong: the `//` in `https://appassets.androidplatform.net`
 * is inside a string literal, but the regex cannot tell, so it deletes the rest
 * of the line - including the closing quote. That leaves an odd number of
 * quotes in the file, and every subsequent string-literal match pairs up across
 * unrelated lines. It produced a START_URL that ran from `"https:` all the way
 * to the end of the next declaration. So: a scanner that tracks string state,
 * plus a quote-balance assertion below, because a silently mis-parsed source
 * file is how you end up "verifying" nonsense. */
function stripComments(s) {
    let out = '';
    let i = 0, inStr = false, inChar = false;
    while (i < s.length) {
        const c = s[i], d = s[i + 1];
        if (inStr || inChar) {
            out += c;
            if (c === '\\') { out += (d === undefined ? '' : d); i += 2; continue; }
            if (inStr && c === '"') inStr = false;
            if (inChar && c === "'") inChar = false;
            i++; continue;
        }
        if (c === '"') { inStr = true; out += c; i++; continue; }
        if (c === "'") { inChar = true; out += c; i++; continue; }
        if (c === '/' && d === '*') {
            const end = s.indexOf('*/', i + 2);
            i = end < 0 ? s.length : end + 2;
            out += ' ';
            continue;
        }
        if (c === '/' && d === '/') {
            const end = s.indexOf('\n', i);
            i = end < 0 ? s.length : end;
            out += ' ';
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

/* The scanner itself, on a fixture that contains every trap. If this regresses,
 * the check below silently starts "verifying" the wrong file. */
const FIXTURE = 'String A = "https://example.com/x"; // gone\n' +
    'String B = "/* not a comment */";\n' +
    "char q = '/';\n" +
    '/* block "comment" with quotes */\n';
const strippedFixture = stripComments(FIXTURE);
const fixtureOk = strippedFixture.includes('"https://example.com/x"') &&
    strippedFixture.includes('"/* not a comment */"') &&
    strippedFixture.includes("char q = '/';") &&
    !strippedFixture.includes('gone') &&
    !strippedFixture.includes('block "comment"');

let src = stripComments(fs.readFileSync(ACTIVITY, 'utf8'));

const quoteCount = (src.match(/"/g) || []).length;
ok('the comment stripper survives https:// and quoted comments', fixtureOk);
ok('quotes are balanced after stripping comments', quoteCount % 2 === 0,
    quoteCount + ' double quotes' + (quoteCount % 2 === 0 ? '' : ' - the parser cannot be trusted'));

/* Pull the body of `private static final String NAME = <expr>;` by index
 * arithmetic rather than one big regex, so an expression spanning lines still
 * parses and a missing declaration fails loudly instead of matching nothing. */
function decl(name) {
    const at = src.indexOf('String ' + name + ' ');
    if (at < 0) return null;
    const end = src.indexOf(';', at);
    if (end < 0) return null;
    return src.slice(at, end + 1);
}
function stringsIn(expr) {
    const out = [];
    const re = /"([^"]*)"/g;
    let m;
    while ((m = re.exec(expr)) !== null) out.push(m[1]);
    return out;
}

const originDecl = decl('ORIGIN');
const startDecl = decl('START_URL');
const origin = originDecl ? stringsIn(originDecl)[0] : null;

/* START_URL is written as ORIGIN + "/assets/index.html", so the literals in the
 * declaration are only the path; the origin is a bare identifier. */
let startUrl = null;
if (startDecl) {
    const lits = stringsIn(startDecl);
    startUrl = (/\bORIGIN\b/.test(startDecl) && origin ? origin : '') + lits.join('');
}

const handlerMatch = src.match(/addPathHandler\(\s*"([^"]*)"/);
const prefix = handlerMatch ? handlerMatch[1] : null;

if (QUIET) {
    if (!startUrl) { process.stderr.write('could not parse START_URL from ' + ACTIVITY + '\n'); process.exit(1); }
    process.stdout.write(startUrl + '\n');
    process.exit(0);
}

console.log('=== what the wrapper asks for ===');
ok('ORIGIN found in MainActivity', !!origin, origin);
ok('START_URL found in MainActivity', !!startUrl, startUrl);
ok('an asset path handler is registered', !!prefix, 'prefix ' + prefix);

if (!startUrl || !prefix || !origin) {
    console.log('');
    console.log('could not parse MainActivity - fix the script, do not assume the app is fine');
    process.exit(1);
}

/* ---- resolve the URL the way WebViewAssetLoader does ------------------------ */
const withoutOrigin = startUrl.startsWith(origin) ? startUrl.slice(origin.length) : startUrl;
const queryAt = withoutOrigin.indexOf('?');
const pathPart = queryAt < 0 ? withoutOrigin : withoutOrigin.slice(0, queryAt);
const query = queryAt < 0 ? '' : withoutOrigin.slice(queryAt);
const inAssets = pathPart.startsWith(prefix) ? pathPart.slice(prefix.length) : null;

console.log('');
console.log('=== resolution ===');
ok('START_URL is on the ORIGIN the loader serves', startUrl.startsWith(origin),
    startUrl.startsWith(origin) ? origin : '*** expected it to start with ' + origin + ' ***');
ok('START_URL sits under the registered path prefix', inAssets !== null,
    inAssets === null ? '*** ' + pathPart + ' does not start with ' + prefix + ' ***' : 'maps to ' + prefix + inAssets);
ok('no query string on the release start URL', query === '',
    query === '' ? 'clean' : '*** ' + query + ' - a QA flag shipped to players ***');

/* ?noleaderboard gates leaderboard WRITES. Shipping it in the release URL means
 * no Android player can ever appear on the leaderboard. */
ok('does not ship the ?noleaderboard QA flag', !/\?noleaderboard\b/.test(startUrl),
    'a Play release must be able to submit scores');

if (inAssets === null) {
    console.log('');
    console.log('FAILED: the start URL cannot be resolved inside the APK');
    process.exit(1);
}

/* ---- does the target file exist in the APK? --------------------------------- */
const apk = process.argv[2] ||
    path.join(REPO, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
let entries = null;
if (fs.existsSync(apk)) {
    entries = new Set(execFileSync('tar', ['-tf', apk], { encoding: 'utf8', maxBuffer: 1 << 28 })
        .split('\n').map(s => s.trim()).filter(Boolean));
} else {
    console.log('');
    console.log('note  APK not built yet at ' + apk + ' - only checking the source');
}

console.log('');
console.log('=== the file it points at is really in the APK ===');
if (entries) {
    const entry = 'assets/' + inAssets;
    ok(entry + ' exists', entries.has(entry),
        entries.has(entry) ? 'found' : '*** MISSING - this is the blank screen bug ***');
    ok('the entry point is index.html', inAssets === 'index.html', inAssets);

    /* Walk index.html's own references. They are relative, so they resolve
     * against the directory the entry point sits in. That directory is
     * `prefix` minus its leading slash, i.e. assets/ inside the APK - so a ref of
     * "scenes/BootScene.js" becomes "assets/scenes/BootScene.js". Do NOT prepend
     * `prefix` as well: it already contains that segment and doing both yields
     * "assets//assets/scenes/...".
     *
     * Guarded by the existence check, because `tar -xOf` on a missing entry
     * throws. Letting it throw would still exit non-zero, but it buries the
     * actual diagnostic under a stack trace - and the diagnostic is the point. */
    if (!entries.has(entry)) {
        ok('cannot walk subresources of a file that is not there', false,
            'skipped: ' + entry + ' does not exist');
    } else {
        const html = execFileSync('tar', ['-xOf', apk, entry], { maxBuffer: 1 << 28 }).toString('utf8');
        const refs = [];
        const re = /(?:src|href)\s*=\s*"([^"]+)"/g;
        let m;
        while ((m = re.exec(html)) !== null) {
            const v = m[1];
            if (/^(https?:)?\/\//.test(v) || v.startsWith('data:') || v.startsWith('#')) continue;
            refs.push(v);
        }
        const missing = refs.filter(r => !entries.has('assets/' + r));
        ok('every relative subresource of index.html resolves (' + refs.length + ' refs)',
            missing.length === 0, missing.length ? 'missing: ' + missing.join(', ') : 'all present');

        const remote = [...new Set((html.match(/https?:\/\/[^"'\s)]+/g) || [])
            .filter(u => /unpkg|jsdelivr|cdn/.test(u)))];
        console.log('  note  ' + (remote.length ? 'loaded from the network at runtime: ' + remote.join(', ')
            : 'no CDN dependencies'));
        if (remote.length) {
            console.log('        the app will show a blank screen with no connection until these are vendored');
        }
    }
} else {
    console.log('  skip  no APK to check against');
}

console.log('');
console.log(fail === 0 ? 'ENTRY POINT RESOLVES' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);