/* Ability-field audit: which ball abilities are declared but never used?
 *
 * A ball ability is a field assigned in loadBallAbilities(). If nothing ever
 * READS that field outside the loader, the ball costs money and does nothing.
 *
 * The earlier version of this file sliced the loader with a regex for its
 * closing brace, which matched an inner `}` of the switch and made every field
 * look unread. The boundary is found by counting braces instead.
 */
const fs = require('fs');

const R = f => fs.readFileSync(f, 'utf8');
const game = R('scenes/GameScene.js');
const tour = R('scenes/TournamentGameScene.js');
const shop = R('scenes/ShopScene.js');

let fail = 0;
function ok(name, cond) {
    if (!cond) fail++;
    console.log((cond ? '  ok   ' : '  FAIL ') + name);
}

/* Return the body of a function whose signature starts at `sig`, by counting
 * braces from the opening one. */
function functionBody(src, sig) {
    const at = src.indexOf(sig);
    if (at === -1) return null;
    const open = src.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
    }
    return null;
}

const loader = functionBody(game, 'loadBallAbilities() {');
if (!loader) { console.log('could not locate loadBallAbilities()'); process.exit(1); }

/* Everything outside the loader: the loader's own span removed. */
const loaderAt = game.indexOf('loadBallAbilities() {');
const outside = game.slice(0, loaderAt) + game.slice(loaderAt + loader.length + 2);

const FIELDS = [
    'speedMultiplier', 'hitboxShrinkMultiplier', 'scoreMultiplier',
    'minHitboxMultiplier', 'maxSpeedBoost', 'jumpMultiplier',
    'boostStepMain', 'boostStepLate', 'startHitboxMin',
    'fixedHitboxPct',
    'scoreRate', 'revivesLeft'
];

const countReads = (src, field) =>
    [...src.matchAll(new RegExp('this\\.' + field + '\\b(?!\\s*=(?!=))', 'g'))].length;
const countAssigns = (src, field) =>
    [...src.matchAll(new RegExp('this\\.' + field + '\\s*=(?!=)', 'g'))].length;

console.log('=== BALL ABILITY AUDIT (endless mode: GameScene) ===\n');
console.log('field                      assigned  read  where read');

const table = [];
for (const f of FIELDS) {
    const assigned = countAssigns(loader, f) > 0;
    const reads = countReads(outside, f);
    table.push({ field: f, assigned, reads, dead: assigned && reads === 0 });

    // Show the actual read sites so the count is auditable, not just asserted.
    const where = [];
    const re = new RegExp('this\\.' + f + '\\b(?!\\s*=(?!=))', 'g');
    let m;
    while ((m = re.exec(outside)) && where.length < 3) {
        const line = outside.slice(0, m.index).split('\n').length;
        where.push('L' + line);
    }
    console.log(
        '  ' + f.padEnd(24) +
        String(assigned).padEnd(9) +
        String(reads).padEnd(6) +
        (where.join(', ') || '-')
    );
}

const dead = table.filter(r => r.dead);
console.log('\nDEAD abilities: ' + dead.length + (dead.length ? ' -> ' + dead.map(d => d.field).join(', ') : ''));

/* ---- shop description vs a field that is genuinely read ---- */
console.log('\n--- shop description vs live field ---');
const byId = {};
const ballRe = /\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*price:\s*(\d+),\s*ability:\s*'([^']*)'/g;
let m;
while ((m = ballRe.exec(shop))) byId[m[1]] = { name: m[2], price: +m[3], ability: m[4] };

/* Which field each description is claiming, matched by the ability TEXT so the
 * mapping is derived rather than hand-listed. */
const CLAIMS = [
    { re: /shrinks (\d+)% slower/, field: 'hitboxShrinkMultiplier' },
    { re: /moves (\d+)% slower/, field: 'speedMultiplier' },
    { re: /bounces (\d+)% higher/, field: 'jumpMultiplier' },
    { re: /Min hitbox (\d+)%/, field: 'minHitboxMultiplier' },
    { re: /max speed (\d+)%/, field: 'maxSpeedBoost' },
    { re: /Speed boost \+([\d.]+)% per hit/, field: 'boostStepMain' },
    { re: /Hitbox stays (\d+)%/, field: 'fixedHitboxPct' },
    { re: /\+(\d+) score per deflect/, field: 'scoreMultiplier' },
    { re: /earns \$(\d+) per score/, field: 'scoreRate' },
    { re: /Saves you once/, field: 'revivesLeft' },
    { re: /Hitbox starts min/, field: 'startHitboxMin' }
];

const unwired = [];
for (const id of Object.keys(byId)) {
    const b = byId[id];
    if (b.ability === 'None') { console.log('  ' + b.name.padEnd(14) + '$' + String(b.price).padEnd(9) + 'no ability'); continue; }
    const claims = CLAIMS.filter(c => c.re.test(b.ability));
    if (!claims.length) {
        console.log('  ' + b.name.padEnd(14) + '$' + String(b.price).padEnd(9) + '*** description not parsed - check by hand ***');
        unwired.push(b.name + ' (unparsed)');
        continue;
    }
    const live = claims.filter(c => !table.find(r => r.field === c.field).dead);
    const status = live.length
        ? 'wired via ' + live.map(c => c.field).join(',')
        : '*** PROMISES ' + claims.map(c => c.field).join(',') + ' - NOT WIRED ***';
    console.log('  ' + b.name.padEnd(14) + '$' + String(b.price).padEnd(9) + status);
    if (!live.length) unwired.push(b.name);
}
console.log('\nballs promising an unwired effect: ' + (unwired.length ? unwired.join(', ') : 'none'));

/* ---- the number in the shop copy must equal the number in the code ----
 *
 * Above only proves a ball's copy names a field that is genuinely read. It never
 * compared the VALUE, so a ball could advertise "+2% per hit" while the loader
 * set 1.04 and nothing would notice. That is exactly the failure that shipped on
 * Anchor and Steel: both genuinely halve or nearly-halve the per-hit boost, but
 * the cards read "Speed increases 50% slower" and "Speed increases 10% slower",
 * which are statements about BASE speed and say nothing about the boost at all.
 *
 * For every ball whose copy states a per-hit boost, read the real
 * boostStepMain out of loadBallAbilities() and compare. */
console.log('\n--- advertised boost vs boostStepMain ---');

/* boostStepMain for one ball: its own case block, else the default. */
function boostStepFor(id) {
    return fieldFor(id, 'boostStepMain', 1.04);
}

/* One field's value for one ball: its own case block, else the given default. */
function fieldFor(id, field, fallback) {
    const at = loader.indexOf("case '" + id + "':");
    if (at === -1) return fallback;
    const next = loader.indexOf("case '", at + 1);
    const block = loader.slice(at, next === -1 ? loader.length : next);
    const m = block.match(new RegExp('this\\.' + field + '\\s*=\\s*([\\d.]+)'));
    return m ? parseFloat(m[1]) : fallback;
}

/* Two shapes, two conversions. A boost step of 1.036 is "+3.6%", because it is
 * a growth multiplier applied to 1. A fixedHitboxPct of 1.5 is "150%", because
 * it IS the fraction. Reading either with the other's formula is how a value
 * ends up looking correct in a comment and wrong on screen. */
const asPct = {
    boostStepMain: v => Math.round((v - 1) * 1000) / 10,
    fixedHitboxPct: v => Math.round(v * 1000) / 10
};
const defaults = { boostStepMain: 1.04, fixedHitboxPct: 0 };

const mismatched = [];

for (const id of Object.keys(byId)) {
    const claims = [
        { re: /Speed boost \+([\d.]+)% per hit/, field: 'boostStepMain' },
        { re: /Hitbox stays (\d+)%/, field: 'fixedHitboxPct' }
    ];
    for (const c of claims) {
        const m = byId[id].ability.match(c.re);
        if (!m) continue;
        const advertised = parseFloat(m[1]);
        const actual = asPct[c.field](fieldFor(id, c.field, defaults[c.field]));
        const good = Math.abs(advertised - actual) < 0.001;
        console.log('  ' + byId[id].name.padEnd(14) +
            c.field.padEnd(15) +
            (advertised + '%').padEnd(8) +
            'code ' + actual + '%   ' + (good ? 'match' : '*** MISMATCH ***'));
        if (!good) mismatched.push(byId[id].name + '/' + c.field);
    }
}

console.log('\ncopy/code boost mismatches: ' + (mismatched.length ? mismatched.join(', ') : 'none'));

/* The two balls this started from must both advertise the boost outright rather
 * than describing base speed with a double negative. */
ok('Anchor advertises its boost per hit, not "N% slower"',
    /id: 'anchor'[^}]*ability: 'Speed boost \+2% per hit/.test(shop));
ok('Steel advertises its boost per hit, not "N% slower"',
    /id: 'steel'[^}]*ability: 'Speed boost \+3\.6% per hit/.test(shop));
ok('Anchor costs $20,000',
    /id: 'anchor'[^}]*price: 20000/.test(shop));

/* Two shape bugs that both shipped, found by playing rather than by reading.
 * Neither is a value the copy can catch, so both need pinning here. */
function caseBlock(id) {
    const at = loader.indexOf("case '" + id + "':");
    if (at === -1) return '';
    const next = loader.indexOf("case '", at + 1);
    return loader.slice(at, next === -1 ? loader.length : next);
}

ok('Anchor does NOT halve the ball actual speed',
    !/this\.speedMultiplier\s*=/.test(caseBlock('anchor')),
    'speedMultiplier 0.5 made the ball crawl; only the boost rate is halved');
ok('Anchor copy makes no base-speed claim',
    !/id: 'anchor'[^}]*ability: '[^']*base speed/.test(shop),
    'the ball has a normal base speed, so claiming otherwise is a lie');
ok('a pinned hitbox is a FRACTION of the ball, not a pixel count',
    /this\.fixedHitboxPct = 1\.5/.test(loader) && !/this\.fixedHitbox\s*=/.test(loader),
    'fixedHitbox = 150 was read as pixels: 150px on a 51.2px ball is 293%, not the advertised 150%');
/* Strip comments before any "this identifier must not appear" test. The
 * GameScene comments deliberately quote the old buggy code (`fixedHitbox = 150`)
 * to explain what was wrong, so a raw text search finds the explanation and
 * reports it as a live reference. */
function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
const gameCode = stripComments(game);

ok('the pinned hitbox is applied after the ball exists',
    /this\.minHitboxRadius = \(this\.ball\.displayWidth \/ 2\)[\s\S]{0,600}?if \(this\.fixedHitboxPct\)/.test(gameCode),
    'the timer block runs before the ball sprite, so it has no size to scale against');
ok('every live reference to the pinned hitbox uses the percentage field',
    !/fixedHitbox(?!Pct)/.test(gameCode),
    'a stray fixedHitbox reference would silently pin the hitbox to nothing');
ok('the pinned hitbox is scaled from the ball, not a literal radius',
    /this\.hitboxRadius = \(this\.ball\.displayWidth \/ 2\) \* this\.fixedHitboxPct/.test(gameCode));

if (fail || mismatched.length) {
    console.log('\n' + (fail + mismatched.length) + ' FAILED');
    process.exitCode = 1;
}

/* ---- tournament parity ---- */
console.log('\n--- tournament parity ---');
const tloader = functionBody(tour, 'loadBallAbilities() {');
const hasSwitch = /switch\s*\(/.test(tloader);
const allNeutral = FIELDS.every(f => new RegExp('this\\.' + f + '\\s*=\\s*(1|1\\.0|300|300\\.0|false|0)\\s*;').test(tloader));
console.log('  no ability switch in tournaments: ' + !hasSwitch);
console.log('  every field reset to its neutral value: ' + allNeutral);
console.log('  -> ' + ((!hasSwitch && allNeutral)
    ? 'intentional: identical footing for every entrant'
    : '*** abilities leak into tournaments ***'));