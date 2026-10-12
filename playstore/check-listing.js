/* Enforce the Play Store's hard character limits on the listing copy.
 *
 * Google truncates rather than rejects, so a too-long description does not fail
 * a build - it silently loses the tail, which is usually where the useful part is.
 * A silent truncation is worth catching before upload.
 *
 * Limits: app name 30, short description 80, full description 4000.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'listing.md');
const text = fs.readFileSync(FILE, 'utf8');

let fail = 0;
const ok = (n, c, d) => { if (!c) fail++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + n + (d ? '  [' + d + ']' : '')); };

/* Pull the fenced block that follows a heading. */
function blockAfter(heading) {
    const at = text.indexOf(heading);
    if (at === -1) return null;
    const after = text.slice(at + heading.length);
    const m = after.match(/```\r?\n([\s\S]*?)\r?\n```/);
    return m ? m[1] : null;
}

/* Pull the fenced block that follows a heading, stopping at the NEXT heading.
 * Slicing to end-of-file grabbed the full description as a third "short"
 * option and reported it as 2032 characters. */
function sectionAfter(heading) {
    const at = text.indexOf(heading);
    if (at === -1) return '';
    const after = text.slice(at + heading.length);
    const next = after.search(/\n##\s/);
    return next === -1 ? after : after.slice(0, next);
}

console.log('=== Play Store listing ===');

const name = blockAfter('## App name');
ok('app name is 30 characters or fewer', name && name.length <= 30,
    name ? `${name.length} chars: "${name}"` : 'not found');

/* Two short-description options are offered; both must fit. */
const shorts = [...sectionAfter('## Short description')
    .matchAll(/```\r?\n([\s\S]*?)\r?\n```/g)].map(m => m[1]);
ok('at least one short description is present', shorts.length > 0, `${shorts.length} option(s)`);
shorts.forEach((s, i) => ok(`short option ${i + 1} is 80 characters or fewer`, s.length <= 80,
    `${s.length} chars`));

const full = sectionAfter('## Full description').match(/```\r?\n([\s\S]*?)\r?\n```/);
ok('full description is 4000 characters or fewer', full && full[1].length <= 4000,
    full ? `${full[1].length} chars` : 'not found');

/* Content checks that matter more than length: Play rejects these outright. */
if (full) {
    const body = full[1];
    ok('no emoji in the listing', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(body),
        'the project bans emoji in product copy');

    /* Keyword-stuffing check. Heading lines are exempt: "20 BALLS, EACH ONE A
     * DIFFERENT TRADE" is deliberate styling in caps, and flagging it is noise
     * that trains you to ignore the checker. Only prose lines are examined. */
    const prose = body.split('\n')
        .filter(l => l.trim() && !/^[A-Z0-9 ,.'\-!&()/:]+$/.test(l.trim()))
        .join('\n');
    const shouting = prose.match(/\b[A-Z]{5,}\b/g) || [];
    ok('no all-caps words in prose', shouting.length === 0,
        shouting.length ? shouting.join(', ') : 'headings excluded');

    const paras = body.split(/\n\s*\n/).filter(p => p.trim());
    ok('description is broken into readable paragraphs', paras.length >= 5,
        `${paras.length} paragraphs`);
}

/* The screenshots referenced must exist on disk. */
const shots = path.join(__dirname, 'screenshots');
const pngs = fs.existsSync(shots) ? fs.readdirSync(shots).filter(f => f.endsWith('.png')) : [];
ok('8 phone screenshots are present', pngs.length === 8, String(pngs.length));

console.log('');
console.log(fail === 0 ? 'all listing checks pass' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);