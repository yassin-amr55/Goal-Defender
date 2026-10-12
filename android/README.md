# Goal Defender - Android wrapper

A WebView shell around the existing HTML5 game. There is no Cordova or Capacito
dependency: the wrapper is four small files, which keeps the APK small and keeps
the build reproducible.

## The one decision that matters: WebViewAssetLoader, not file://

The obvious way to load a bundled web game is:

```java
webView.loadUrl("file:///android_asset/www/index.html");
```

**That does not work for this game.** `file://` gives the page an opaque origin,
and an opaque origin has no `localStorage` and is not an authorised Firebase
Auth domain. The game would come up with an empty save that never persists, and
sign-in would fail on a network error that looks like bad credentials.

So assets are served over a real https origin instead:

```
https://appassets.androidplatform.net/assets/index.html
```

Note there is **no `www/`**. The `stageGame` Gradle task copies the game's files
into the APK's `assets/` root, so `index.html` lands at `assets/index.html`. The
`addPathHandler("/assets/", ...)` prefix and the URL path are two halves of the
same lookup: whatever follows `/assets/` is the path inside the APK.

An earlier build asked for `/assets/www/index.html`. That file does not exist,
so the path handler returned `null`, and WebView fell back to a real network
request for a domain that does not resolve publicly. On a device that is a blank
page reading:

```
https://appassets.androidplatform.net/assets/www/index.html
net::ERR_INVALID_RESPONSE
```

`tools/verify-entry-point.js` now resolves the URL against the files actually in
the APK, so this fails the check instead of shipping.
`tools/test-entry-point-catches-the-bug.js` proves the check rejects the real
broken variants.

`WebViewAssetLoader` (androidx.webkit) intercepts those requests and streams them
from the APK's assets. The page gets a genuine secure origin, `localStorage`
persists, and Firebase Auth has a domain it can be told to trust.

### You must do this in the Firebase console

Once the app exists, add this to **Authentication > Settings > Authorized
domains**:

```
appassets.androidplatform.net
```

Without it, signing in on the packaged app fails. The web build at
`yassin-amr55.itch.io` is unaffected - it uses its own real domain.

## Building

```
cd android
./gradlew assembleRelease
```

The output is `app/build/outputs/apk/release/app-release.apk`, signed with the
keystore described in `keystore.md`.

`gradlew` needs the wrapper JAR. If it is missing, install Gradle 8.7+ once and
run `gradle wrapper`, or copy the JAR from a local Gradle cache.

## What is gitignored, and why

`keystore.properties` and `*.jks` are gitignored. A keystore in a repository is
a leaked signing key: anyone with a clone can ship an update that Play accepts
as yours. `keystore.md` explains how to regenerate it.