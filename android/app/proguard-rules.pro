# R8 / ProGuard rules for the Android shell.
#
# The app is a WebView wrapper: one Activity, no reflection, no dynamically
# loaded classes. R8 can therefore shrink almost everything it cannot see
# referenced, which is why there is very little to keep here.
#
# The GAME is not affected by any of this. It is plain JavaScript in
# assets/, staged by the stageGame Gradle task, and R8 never looks inside
# assets - the 6.5MB of game code and art is untouched by shrinking.

# Keep the Activity: it is named in AndroidManifest.xml and instantiated
# reflectively by the framework, so R8 cannot see the reference.
-keep class com.dailyapps.goaldefender.MainActivity { *; }

# WebViewAssetLoader.AssetsPathHandler is instantiated from the builder in
# MainActivity, which R8 does see, but the loader's own entry points are
# reached from androidx.webkit internals.
-keep class androidx.webkit.WebViewAssetLoader { *; }
-keep class androidx.webkit.WebViewAssetLoader$* { *; }

# WebView methods are called by the framework, not by this code.
-keepclassmembers class * extends android.webkit.WebView {
    public void addJavascriptInterface(java.lang.Object, java.lang.String);
}

# Line numbers make a Play crash report readable. Without this, R8 rewrites the
# stack trace into single-letter names, which is the whole point of shipping a
# deobfuscation file in the first place.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Silence the standard Android warnings rather than reading them every build.
-dontwarn android.webkit.**