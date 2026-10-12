/* Download and unpack Google's Android command-line tools.
 *
 * Needed because this machine has platform-tools and the emulator but no
 * sdkmanager, and sdkmanager is the only supported way to install a system image
 * - without one there is no AVD and no way to reproduce the crash on a real
 * Android runtime.
 *
 * Usage: node tools/get-cmdline-tools.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SDK = process.env.ANDROID_SDK ||
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const WORK = path.join(process.env.TEMP || '.', 'android-sdk-setup');
const ZIP = path.join(WORK, 'cmdline-tools.zip');
const URL_ = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip';

function download(url, dest, redirects) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        https.get(url, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                if (redirects > 8) return reject(new Error('too many redirects'));
                res.resume();
                return resolve(download(res.headers.location, dest, redirects + 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
            }
            const total = parseInt(res.headers['content-length'] || 0, 10);
            let got = 0, lastPrint = 0;
            const out = fs.createWriteStream(dest);
            res.on('data', c => {
                got += c.length;
                const now = Date.now();
                if (now - lastPrint > 3000) {
                    lastPrint = now;
                    const mb = (got / 1048576).toFixed(1);
                    const pct = total ? ((got / total) * 100).toFixed(0) + '%' : '?';
                    process.stdout.write('\r  ' + mb + ' MB  ' + pct + '   ');
                }
                out.write(c);
            });
            res.on('end', () => {
                process.stdout.write('\r  ' + (got / 1048576).toFixed(1) + ' MB  done in '
                    + ((Date.now() - started) / 1000).toFixed(0) + 's          \n');
                out.end(() => resolve(got));
            });
            res.on('error', e => { out.close(); reject(e); });
        }).on('error', reject);
    });
}

(async () => {
    fs.mkdirSync(WORK, { recursive: true });
    console.log('downloading ' + URL_);
    try {
        await download(URL_, ZIP, 0);
    } catch (e) {
        console.error('FAILED: ' + e.message);
        process.exit(1);
    }

    console.log('size ' + (fs.statSync(ZIP).size / 1048576).toFixed(1) + ' MB');
    console.log('unpacking');
    const unpack = path.join(WORK, 'unpack');
    fs.rmSync(unpack, { recursive: true, force: true });
    fs.mkdirSync(unpack, { recursive: true });
    execFileSync('tar', ['-xf', ZIP, '-C', unpack]);

    /* The zip contains a top-level cmdline-tools/ directory, but sdkmanager
     * refuses to run unless the layout is <sdk>/cmdline-tools/latest/. */
    const src = path.join(unpack, 'cmdline-tools');
    if (!fs.existsSync(src)) {
        console.error('unexpected zip layout: ' + fs.readdirSync(unpack).join(', '));
        process.exit(1);
    }
    const dest = path.join(SDK, 'cmdline-tools', 'latest');
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    console.log('installed to ' + dest);

    const sm = path.join(dest, 'bin', 'sdkmanager.bat');
    console.log(fs.existsSync(sm) ? 'sdkmanager present' : '*** sdkmanager missing ***');
    process.exit(fs.existsSync(sm) ? 0 : 1);
})();