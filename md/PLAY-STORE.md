# PLAY STORE — packaging status

Prepared 2026-10-12. One thing needs your action before this can be uploaded.

## What is done

| Item | State |
|---|---|
| Android wrapper project | `android/` — builds |
| Package name | `com.dailyapps.goaldefender` ✓ |
| Release keystore | generated, **gitignored** |
| **Signed release APK** | `android/app/build/outputs/apk/release/app-release.apk`, 4.78 MB |
| **Signed release AAB** | `android/app/build/outputs/bundle/release/app-release.aab`, 5.10 MB — **upload this** |
| App icon (512×512 opaque) | `playstore/icon-512.png` |
| Feature graphic (1024×500) | `playstore/feature-graphic-1024x500.png` |
| Adaptive launcher icon | all 5 densities, art inside the 66dp safe zone |
| 8 phone screenshots | `playstore/screenshots/`, 1280×720, 24-bit RGB |
| Short + full description | `playstore/listing.md` |

### The built APK / AAB

```
package      com.dailyapps.goaldefender
versionCode  2
versionName  2.2
minSdk       24          (Android 7.0)
targetSdk    36          (Android 16)
size         4.78 MB APK / 5.10 MB AAB
signer SHA-256  35a1ef7714eef93c3ec7beea8a351aa27bf80852598edc8cbc31b6c66ccf5565
```

Upload the **AAB**. Play splits it per device; the APK is for local install.

### ⚠️ versionCode must be bumped on EVERY upload

Play burns a version code **permanently the moment it sees it** — even if a later
validation step rejects the release.

| code | what happened to it |
|---|---|
| 1 | rejected for targeting API 35 — but still burned |
| 2 | installed on a device, showed the blank-screen bug below |
| 3 | published to Play |
| 4 | keyboard, offline play, login-time choice |
| 5 | **rejected — "no longer supports 13 devices"** (see below) |
| **7** | **current build** — startup 3.2s faster, offline boot fixed |

## Verified on a real Android runtime

Everything else here was verified statically. This build was additionally
installed and exercised on an **API 34 emulator with Chrome WebView 113**:

```
app launches landscape, renders, no crash across repeated cold starts
soft keyboard opens on tap and typed text reaches the game   (mInputShown false -> true)
RANKS and SIGN IN refuse to open offline, explaining why
OFFLINE badge appears with no network, disappears when it returns
Firebase is never requested at all when offline (was 3 hanging DNS lookups)
```

### Cold start, measured

```
before   4648  3518  3089  2814  2674  ms
after    1414  1207  1450  1195  1129  1112 ms
```

`loadUrl` used to run inside `onCreate`, so the window was not presented until
the WebView had spawned Chromium's renderer and loaded the page. It is now posted
to the next frame, so the window draws first and the game paints over it. About
3.2 seconds faster, and comfortably inside the 5-second ANR window — which is the
most plausible reading of "it crashes a couple of times before it opens": a stall
crossing into an ANR, not a crash.

### One optimisation was tried and reverted

`WebViewCompat.startUpWebView()` (androidx.webkit 1.14.0) promises to spawn the
renderer off the critical path. It **crashes**:

```
FATAL EXCEPTION: main
java.lang.NullPointerException: ... ArrayList.size() ...
    at androidx.webkit.a.run(SourceFile:27)
    at android.os.Handler.handleCallback
```

on WebView 113, with `setShouldRunUiThreadStartUpTasks` both true and false, and
it is **not catchable** — the exception is thrown on a Runnable the library posts
to the main Looper long after the call returns, so the `try/catch` guards
nothing. Plenty of real devices still run 2023-era WebViews, so it is out. The
dependency is pinned back to 1.12.1 with the reason recorded.

### Reproducing this

```
node tools/get-cmdline-tools.js                       # sdkmanager, needed for a system image
sdkmanager "system-images;android-34;google_apis;x86_64"
avdmanager create avd -n gdtest -k system-images;android-34;google_apis;x86_64
emulator -avd gdtest -no-window -gpu swiftshader_indirect
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -W -n com.dailyapps.goaldefender/.MainActivity
adb logcat -s GoalDefender:V AndroidRuntime:E
```

`google_apis` is the right image, not ATD: it ships a real Chrome WebView, and
the whole app is a WebView.

For the offline path: `adb shell svc wifi disable && adb shell svc data disable`.

Before every upload, increment `versionCode` in `android/app/build.gradle`. Leave
`versionName` at `2.2` — that is the human-facing label, and bumping it would
falsely claim this is a different version of the game than the working tree
actually holds.

### ⚠️ Never hard-lock orientation in the manifest

Code 5 declared `android:screenOrientation="landscape"` to fix a portrait
launch, and Play rejected it:

> This release no longer supports 13 devices that were supported in your
> previous release. If you proceed, your app will not be available to new users
> on these unsupported devices, and updates will not be available to users who
> already have your app installed on these devices.

For an app targeting **API 31+**, Play removes from the supported-device
catalogue every device that cannot honour a fixed orientation — all tablets and
foldables, since Android 12+ may ignore orientation on displays of 600dp and up.
A manifest lock doesn't just rotate the phone, it **deletes devices from the
store listing**, which costs far more than the problem it solves.

The fix keeps both requirements:

| | where | why |
|---|---|---|
| `screenOrientation="fullUser"` | manifest | Play counts every device as supported |
| `setRequestedOrientation(LANDSCAPE)` | `MainActivity.onCreate` | the app still opens landscape on phones |

Play computes device support from the merged manifest and never sees the runtime
call. On a tablet that ignores the request the game runs at whatever orientation
the player chooses — correct, since it is 1280×720 and reflows to any aspect
ratio.

`tools/verify-entry-point.js` fails the build if a fixed orientation ever returns
to the manifest, because this failure is invisible locally — the build stays
green and only Play complains, after a release has been cut.
`tools/test-orientation-guard.js` proves that guard rejects `landscape`,
`portrait`, `sensorPortrait` and `reverseLandscape`.

## The game works offline

Everything is bundled. Phaser used to be fetched from `unpkg.com` at runtime,
which meant no connection meant a blank screen — the exact failure offline play is
supposed to prevent. It is now vendored:

```
node tools/vendor-phaser.js      # refreshes assets/phaser.min.js
```

Verified by booting the game with all cross-origin requests blocked: **38
textures loaded, menu up, zero external requests** except the Firebase session
lookup, which fails silently and correctly.

- `window.GDNet` reports connectivity. It trusts `navigator.onLine === false` but
  does not treat `true` as proof, because a captive portal is "online" and can
  reach nothing. Real request outcomes are recorded as the tiebreaker.
- Accounts and the leaderboard **say why** they cannot open instead of
  disappearing — hiding them reads as the content having been removed.
- An OFFLINE pill appears bottom-centre in the menu.
- Progress stays in `localStorage` throughout; nothing is lost going offline.

### Signing in asks which progress is real

Signing in used to merge silently, taking the larger of every number. That is
right when both sides are the same player's progress and wrong when they are not
— hand someone else's account, or share a device, and the merge invents a save
belonging to neither, with no way to tell.

Every deliberate sign-in to an existing account now stops and asks:

| | effect |
|---|---|
| **USE ACCOUNT STATS** | the account overwrites this device |
| **USE THIS DEVICE** | this device overwrites the account |

Both are explicit overwrites, and the dialog says so. It is **not** asked on cold
start — `restore()` runs the same code path every launch, and a returning player
whose save has synced is not standing in front of a conflict. That path uses the
existing merge, which can only ever combine one account's own progress.

It is also skipped when either side is empty: a fresh install has nothing to
lose, and auto-answering "use this device" there would **erase the account**.

### ⚠️ the first on-device build was a blank screen

Version code 2 installed, but showed:

```
https://appassets.androidplatform.net/assets/www/index.html
net::ERR_INVALID_RESPONSE
```

`START_URL` asked for `/assets/www/index.html`. The staging task copies the game
into the APK's `assets/` **root**, so `index.html` is at `assets/index.html` with
no `www/` directory. The path handler found no file, returned `null`, and WebView
fell through to a real network request for a domain that does not resolve
publicly.

It also shipped `?noleaderboard` — a QA flag that gates leaderboard **writes**, so
no Android player could ever have submitted a score. Both are fixed.

**Why every other check passed while the app was broken:** they verified
`assets/index.html` was *present* in the APK. Nothing checked the app pointed
*at* it. Presence is not reachability.

```
node tools/verify-entry-point.js <apk>              # resolves START_URL against the APK
node tools/test-entry-point-catches-the-bug.js       # proves the check rejects real bugs
```

### Play Console rejected the first upload — all three issues are now fixed

| Console said | Cause | Fix |
|---|---|---|
| **Error:** "must target at least API level 36" | `targetSdk 35` | bumped to 36 |
| **Warning:** "no deobfuscation file" | `minifyEnabled false`, so AGP emitted no mapping | R8 enabled, mapping now bundled |
| **Error:** "Version code 1 has already been used" | code 1 burned by the rejected build | bumped to 2 |

The target-SDK error was a hard block and the version-code error is too; the
deobfuscation warning was advisory, but the fix is also correct, so all three were
done.

`minifyEnabled true` + `shrinkResources true` also **shrank the APK from 6.67 MB
to 4.78 MB** and the AAB to 5.10 MB. See `android/app/proguard-rules.pro` for why
this is safe: the app is one Activity with no reflection, so R8 has almost
nothing it cannot see referenced.

⚠️ `shrinkResources` **renames resource paths** — `res/layout/activity_main.xml`
becomes something like `res/_G.xml`. That is normal and not a bug, but it means
you cannot verify the APK by looking for resource filenames. Use the tools:

```
node tools/verify-aab.js <aab> <extracted-zip-dir> <repo-root>
node tools/verify-r8-kept-what-it-needed.js <apk>
node tools/test-verify-aab-targetsdk.js
```

The last one is a **negative test**: it proves the targetSdk assertion actually
rejects 35 and 34, rather than passing vacuously.

Save that fingerprint. Play shows it on the public listing, and it is how you
prove a build is yours.

**Verified the APK ships the same game as the itch zip**: all 61 game files are
SHA-256 identical across the APK, the zip, and the working tree, and every fix
from this session is present in the APK's actual bytes.

---

## What you must do before uploading

### 1. Add the WebView domain to Firebase — this is the one that will bite

The app serves the game from `https://appassets.androidplatform.net`. Firebase
Auth rejects any origin not on its authorised list, so **sign-in will fail on the
packaged app** until you add it.

```
Firebase console > Authentication > Settings > Authorised domains
  add: appassets.androidplatform.net
```

The itch build is unaffected — it uses its own real domain.

### 2. Play App Signing, and rotate the password

The keystore password was shared in a chat transcript, so treat it as compromised.
Generate a fresh **upload** keystore, keep the new passwords in a password
manager, and never in this repo. Enable Play App Signing so the key Google holds
is the real app-signing key.

### 3. Privacy policy URL and the Data safety form

Play requires a privacy policy URL because Firebase anonymous auth creates a
persistent device identifier. Both are form-filling, not code, and neither is
optional. `listing.md` has what to declare.

### 4. Build the upload bundle

Play uploads an **AAB**, not an APK. Both are already built and verified:

```
cd android
./gradlew bundleRelease     # -> app/build/outputs/bundle/release/app-release.aab
```

Build output is gitignored, so if you lose it this one command rebuilds it.

### 5. Verify before you upload

Do not eyeball the artifacts — run the checkers. All three take seconds:

```
node tools/verify-upload.js --apk
node tools/verify-aab.js android/app/build/outputs/bundle/release/app-release.aab <extracted-itch-zip> .
node tools/verify-r8-kept-what-it-needed.js android/app/build/outputs/apk/release/app-release.apk
node tools/verify-entry-point.js android/app/build/outputs/apk/release/app-release.apk
node tools/test-entry-point-catches-the-bug.js
node tools/test-verify-aab-targetsdk.js
```

The last two are **negative tests**: each proves its check actually rejects the
bugs it was written for, rather than passing vacuously.

### ⚠️ Phaser is loaded from a CDN at runtime

`index.html` pulls Phaser from `https://unpkg.com/phaser@3.70.0`. The app will
show a blank screen with no internet connection until that is vendored into
`assets/`. Worth fixing before launch — a Play reviewer testing on a plane will
see a white screen and reject it.

---

## Two things about this app you should know before you submit

### It is a WebView wrapper, and that is a policy risk

Google's policy on "Webviews and Affiliate Spam" rejects apps whose primary
purpose is to drive a WebView at a website. Goal Defender is a game that happens
to be built as one, and it is a genuine game with genuine native packaging — but
this is the most likely reason a reviewer rejects it, and you cannot fix it in
code. If it comes back, the appeal is that the WebView hosts a bundled, offline,
full-screen game with no address bar and no navigation away from the app.

### Target API level

`targetSdk 36` satisfies Play's requirement to target within a year of the latest
release. Google will require 37 at some point; that is a one-line change in
`app/build.gradle` plus an SDK install, and `compileSdk` must be raised to match.
`tools/verify-aab.js` fails the build check if the bundle ever drops below 36.

---

## Design notes worth keeping

**Why assets are served over https, not `file://`.** The obvious way to load a
bundled web game is `file:///android_asset/www/index.html`. It does not work here.
`file://` gives the page an opaque origin, which has no `localStorage` and is not
an authorised Firebase domain — so the save would never persist and sign-in would
fail with an error that looks like bad credentials. `WebViewAssetLoader` serves
the same files over `https://appassets.androidplatform.net` instead. See
`android/README.md`.

**The icon is the favicon ball on navy.** You asked for the ball with no
background, but Play requires an **opaque** icon, and the source PNG is
transparent greyscale — uploaded as-is it flattens onto white and is nearly
invisible. It is composited onto the game's own navy (`#0b1220`) at 84% scale by
`make-play-icons.js`. Regenerate rather than hand-editing.

**The adaptive foreground is the ball on transparency**, sized to 66/108 of the
canvas. Two earlier attempts composited navy into the foreground as well, which
covered the whole layer in opaque pixels, hid the background layer, and left the
launcher mask cropping the art. `playstore/check-icons`… `make-play-icons.js`
plus the safe-zone check caught it.

**Screenshots are 1280×720, not 1080p.** That is the game's native render size,
and Play accepts it (320–3840px, 16:9–2:1). Upscaling would add bytes and no
detail. Canvas PNGs carry an alpha channel, which Play rejects, so
`playstore/prepare-screenshots.js` flattens them to 24-bit RGB — it also cut
them roughly in half.

---

## Reproducing

```bash
cd android
./gradlew assembleDebug          # quick, unsigned-by-default fallback
./gradlew assembleRelease        # signed, needs keystore.properties
./gradlew bundleRelease          # AAB for Play upload

cd ..
node make-play-icons.js                       # regenerate launcher + listing art
node playstore/prepare-screenshots.js         # flatten screenshots
node playstore/check-screenshots.js           # spec check
node playstore/check-listing.js               # character limits
```

`keystore.properties` and `*.jks` are gitignored and are not in this repository.
See `android/keystore.md`.

---

## Still open from before

- The itch screenshots in `screenshots/` are pre-fix and contradict the build
- Test accounts still in the live backend: `admintest`, `hamzatest`,
  `realrenamed`, `balltest784`, `plainacct690`, and rows `admintest:999`,
  `hamzatest:1234`, `EXIZT:71`
- `UI.VERSION` still reads `V2.2`, which you decided to keep
- Anchor's price was set to $20,000 as a penalty for a ball that turned out to
  be broken rather than strong — worth revisiting
- **Nothing has been tested on a real device or emulator.** Everything above was
  verified by building and by reading the APK's bytes. The WebView
  behaviour, the Firebase sign-in and the touch input are unverified on hardware.