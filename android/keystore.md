# Keystore and signing

## What was created

```
android/goaldefender-release.jks
  alias      goaldefender
  type       PKCS12
  key        RSA 2048, SHA384withRSA
  valid      2026-10-12 .. 2054-02-27  (10,000 days)
  owner      CN=Goal Defender, OU=Games, O=DailyApps
```

**This file is gitignored and must stay that way.** A signing key in a
repository is a leaked key: anyone with a clone can produce an APK that Play
accepts as yours, forever. The Play listing's signing key cannot be rotated
without a new app listing.

`keystore.properties` is gitignored for the same reason - it holds the passwords
in plaintext.

## Before you can build

Copy this next to `build.gradle` in `android/` and fill in the values. It is
already gitignored:

```properties
storeFile=goaldefender-release.jks
storePassword=<the store password>
keyAlias=goaldefender
keyPassword=<the key password>
```

`app/build.gradle` reads this file and falls back to a debug signing config if it
is absent, so a build without it still produces a working, installable APK - just
not one Play will accept for an update.

## Rotate the password before you ship

The password was shared in a chat transcript and is therefore compromised for
practical purposes. Play enforces **Play App Signing**: you upload an upload
keystore, and Google holds the real app-signing key. That limits the damage, but
only if the upload keystore is not the one you also use for anything else.

Options, best first:

1. **Generate a fresh upload keystore** and keep the new passwords in a password
   manager, never in this repo or a chat. Use the one in this folder only for
   local `assembleRelease` testing.
2. Enable Play App Signing so the key Google holds is the real one.

Do not reuse this password anywhere else.

## Verifying an APK

```bash
$ANDROID_HOME/build-tools/35.0.0/apksigner verify --print-certs app-release.apk
```

That prints the signing certificate fingerprint. Save it - if you ever need to
prove a build is yours, this is the value that matters, and Play shows it on the
app's public page.