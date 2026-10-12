# PLAY STORE — packaging status

Prepared 2026-10-12. One thing needs your action before this can be uploaded.

## What is done

| Item | State |
|---|---|
| Android wrapper project | `android/` — builds |
| Package name | `com.dailyapps.goaldefender` ✓ |
| Release keystore | generated, **gitignored** |
| **Signed release APK** | `android/app/build/outputs/apk/release/app-release.apk`, 6.67 MB |
| App icon (512×512 opaque) | `playstore/icon-512.png` |
| Feature graphic (1024×500) | `playstore/feature-graphic-1024x500.png` |
| Adaptive launcher icon | all 5 densities, art inside the 66dp safe zone |
| 8 phone screenshots | `playstore/screenshots/`, 1280×720, 24-bit RGB |
| Short + full description | `playstore/listing.md` |
| AAB for Play upload | **not built — see below** |

### The built APK

```
package      com.dailyapps.goaldefender
versionCode  1
versionName  2.2
minSdk       24          (Android 7.0)
targetSdk    35          (Android 15)
size         6.67 MB
signer SHA-256  35a1ef7714eef93c3ec7beea8a351aa27bf80852598edc8cbc31b6c66ccf5565
```

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

Play uploads an **AAB**, not an APK:

```
cd android
./gradlew bundleRelease
```

Not run here because it was not needed to prove the packaging works, and an AAB
is only worth producing once the keystore has been rotated (step 2).

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

`targetSdk 35` satisfies Play's requirement to target within a year of the
latest release. Google will require 36 at some point; that is a one-line change
in `app/build.gradle` plus an SDK install.

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