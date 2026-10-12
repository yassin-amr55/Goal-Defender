/* Regression test for the offline detection in player.js.
 *
 * This exists because the first offline build told a player on working wifi that
 * they were offline. The cause was netProbe(): it fired during page load (the
 * document's first visibilitychange), fetched one third-party host, and treated
 * that host being unreachable as CERTAIN proof of no internet. One host is not
 * evidence about the player's connection.
 *
 * The logic is extracted and run against a fake navigator so the rules are
 * pinned without a browser. The rules that matter:
 *
 *   - a probe failure changes nothing
 *   - one backend failure changes nothing
 *   - two consecutive failures do mark offline
 *   - navigator.onLine === false plus one failure marks offline immediately
 *   - a success always recovers
 *
 * Run: node tools/test-offline-detection.js
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'player.js'), 'utf8');

/* Take the offline block verbatim. Bounded by its first declaration and the
 * netInit() call that closes it, so editing player.js outside this section does
 * not silently break the test, and editing it INSIDE cannot avoid the test. */
const start = src.indexOf('var netListeners = [];');
const end = src.indexOf('netInit();', start);
if (start < 0 || end < 0) {
    console.error('FAIL  could not find the offline block in player.js');
    console.error('      the markers this test slices on have been renamed or removed');
    process.exit(1);
}
const block = src.slice(start, end + 'netInit();'.length);

let fail = 0;
const ok = (n, c, d) => { if (!c) fail++; console.log('  ' + (c ? 'ok  ' : 'FAIL') + '  ' + n + (d !== undefined ? '  [' + JSON.stringify(d) + ']' : '')); };

/* Build GDNet fresh for each scenario, with a fake navigator. */
function build(onLine) {
    const sandbox = {
        window: { addEventListener() {} },
        document: { addEventListener() {}, visibilityState: 'visible' },
        navigator: { onLine: onLine },
        fetch: () => Promise.reject(new TypeError('Failed to fetch')),
        console: console
    };
    sandbox.window.GDNetHolder = sandbox;
    /* The block assigns window.GDNet and then calls netInit(). */
    new Function('window', 'document', 'navigator', 'fetch', block)(
        sandbox.window, sandbox.document, sandbox.navigator, sandbox.fetch);
    return sandbox.window.GDNet;
}

console.log('=== the bug that shipped: a probe failure must not mean offline ===');
{
    const N = build(true);                       // on wifi, browser agrees
    ok('starts online', N.isOnline() === true, N.isOnline());
    N.probe();                                    // host unreachable - inconclusive
    ok('a failed probe does NOT mark the player offline', N.isOnline() === true, N.isOnline());
    N.noteFailure();                              // one backend failure
    ok('one failure alone does NOT mark the player offline', N.isOnline() === true, N.isOnline());
    N.noteFailure();                              // two in a row - real evidence
    ok('two consecutive failures DO mark the player offline', N.isOnline() === false, N.isOnline());
    N.noteSuccess();
    ok('a success recovers', N.isOnline() === true, N.isOnline());
}

console.log('');
console.log('=== a real outage is still detected ===');
{
    const N = build(true);
    N.noteFailure();
    N.noteFailure();
    ok('offline after two failures', N.isOnline() === false);
    N.noteSuccess();
    ok('back online after a success', N.isOnline() === true);
}
{
    /* No network interface at all: the browser is certain, so one failure and a
     * corroborating onLine === false is enough. Without this the badge would lag
     * a genuine outage by an extra failed request. */
    const N = build(false);
    N.noteSuccess();
    N.noteFailure();
    ok('offline immediately when the browser reports no interface', N.isOnline() === false);
}

console.log('');
console.log('=== a success resets the failure streak ===');
{
    const N = build(true);
    N.noteFailure();
    N.noteSuccess();                              // streak cleared
    N.noteFailure();                              // this is failure #1 again, not #2
    ok('failures separated by a success need two in a row', N.isOnline() === true, N.isOnline());
}

console.log('');
console.log('=== isDefinitelyOffline is a different, stricter question ===');
{
    /* isOnline() is deliberately optimistic at boot, which is right for the
     * badge but wrong for "should I make this request?". A cold boot with no
     * network must be able to say "definitely offline" without first failing two
     * requests - otherwise the game waits out three DNS timeouts. */
    const N = build(false);
    ok('definitely offline when the browser reports no interface',
        N.isDefinitelyOffline() === true, N.isDefinitelyOffline());
    ok('isOnline is still optimistic at that moment (needs real evidence)',
        N.isOnline() === true, N.isOnline());
}
{
    const N = build(true);
    ok('not definitely offline when an interface is reported',
        N.isDefinitelyOffline() === false, N.isDefinitelyOffline());
    N.noteFailure();
    N.noteFailure();
    ok('and it stays false even after requests start failing',
        N.isDefinitelyOffline() === false,
        'a flaky request must not be mistaken for no interface - that would skip requests');
}

console.log('');
console.log('=== listeners fire only on an actual change ===');
{
    const N = build(true);
    let calls = 0;
    N.onChange(() => calls++);
    N.noteSuccess();                              // already online: no change
    ok('no event when nothing changed', calls === 0, calls);
    N.noteFailure();
    N.noteFailure();                              // now offline: one change
    ok('exactly one event on the change', calls === 1, calls);
}

console.log('');
console.log(fail === 0 ? 'OFFLINE DETECTION IS CORRECT' : fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);