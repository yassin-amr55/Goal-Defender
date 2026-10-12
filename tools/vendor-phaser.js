/* Vendor Phaser into the repo so the game works offline.
 *
 * index.html loaded Phaser from unpkg.com at runtime. That is a hard blocker
 * for offline play: no connection means no Phaser means a blank screen, which is
 * exactly the failure mode the offline requirement is trying to eliminate.
 *
 * Run once: node tools/vendor-phaser.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const URL_ = 'https://unpkg.com/phaser@3.70.0/dist/phaser.min.js';
const OUT = path.join(__dirname, '..', 'assets', 'phaser.min.js');

function get(url, redirects) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                if (redirects > 5) return reject(new Error('too many redirects'));
                res.resume();
                return resolve(get(res.headers.location, redirects + 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

(async () => {
    try {
        console.log('fetching ' + URL_);
        const buf = await get(URL_, 0);
        const sha = crypto.createHash('sha256').update(buf).digest('hex');
        fs.mkdirSync(path.dirname(OUT), { recursive: true });
        fs.writeFileSync(OUT, buf);

        console.log('  wrote ' + OUT);
        console.log('  size ' + (buf.length / 1024).toFixed(0) + ' KB');
        console.log('  sha256 ' + sha);

        const text = buf.toString('utf8');

        /* Completeness first. A truncated Phaser is worse than none: the file
         * exists, the page loads it, and the game dies at runtime with some
         * missing constructor rather than an obvious 404. The minified bundle is
         * a single line wrapped in a UMD IIFE, so it must start with "!function"
         * and end with the matching call. */
        const complete = text.trimStart().startsWith('!function(') && /\)\s*\)*\s*\)*;?\s*$/.test(text.trimEnd());
        if (!complete || buf.length < 1000000) {
            console.error('  *** the download is TRUNCATED - starts with '
                + JSON.stringify(text.slice(0, 20)) + ', ends with '
                + JSON.stringify(text.slice(-20)));
            process.exit(1);
        }

        /* The version is stored as a bare "3.70.0" literal. An earlier regex
         * looked for VERSION = "..." which does not exist in the minified build,
         * so it reported "unknown" on a perfectly good file. */
        const version = (text.match(/["'](\d+\.\d+\.\d+)["']/) || [])[1];
        console.log('  detected Phaser version ' + version);
        if (!/Phaser/.test(text)) {
            console.error('  *** this does not contain the string "Phaser"');
            process.exit(1);
        }
        if (version !== '3.70.0') {
            console.error('  *** expected 3.70.0 but found ' + version + ' - index.html is pinned to 3.70.0');
            process.exit(1);
        }
        console.log('  complete UMD bundle, version matches index.html');
        console.log('  OK');
    } catch (e) {
        console.error('FAILED: ' + e.message);
        console.error('The CDN download needs internet. Once phaser.min.js is on disk,');
        console.error('nothing else is required - it is committed to the repo.');
        process.exit(1);
    }
})();