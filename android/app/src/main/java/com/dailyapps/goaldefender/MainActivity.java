/* MainActivity - the entire Android shell.
 *
 * A WebView that serves the bundled game over a real https origin via
 * WebViewAssetLoader, rather than file://. See README.md for why file:// is not
 * an option here: it has an opaque origin, so localStorage does not persist and
 * Firebase Auth has no authorised domain to match.
 */
package com.dailyapps.goaldefender;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {

    /* Logcat tag. If the app ever misbehaves on a device again, this is how the
     * cause is found instead of guessing:
     *   adb logcat -s GoalDefender:V
     * Every decision point in this file logs, so the last thing printed before
     * the app dies is visible. A crash that cannot be diagnosed is a crash that
     * gets "fixed" by changing something unrelated. */
    private static final String TAG = "GoalDefender";

    /* appassets.androidplatform.net is a domain Android reserves for exactly
     * this. It must also be added to the Firebase console's authorised domains
     * or sign-in fails on the packaged build. */
    private static final String ORIGIN = "https://appassets.androidplatform.net";

    /* "/assets/index.html" - NOT "/assets/www/index.html".
     *
     * The stageGame Gradle task copies the game's files into the APK's assets/
     * root, so index.html lands at assets/index.html with no www/ directory in
     * between. The earlier "/assets/www/index.html" 404'd inside the app: the
     * AssetsPathHandler looked for assets/www/index.html, found nothing, and
     * returned null, so WebView fell through to a real network request for a
     * domain that does not resolve publicly. On a device that surfaced as a
     * blank page reading
     *     https://appassets.androidplatform.net/assets/www/index.html
     *     net::ERR_INVALID_RESPONSE
     *
     * tools/verify-entry-point.js resolves this URL against the files actually
     * in the APK, so a wrong path fails the build instead of shipping.
     *
     * No ?noleaderboard query string either. That flag gates leaderboard WRITES
     * (MenuScene.submit), and it belongs to the QA capture flow only. Leaving it
     * on meant no Android player could ever appear on the leaderboard - the one
     * thing a Play release most needs to get right. */
    private static final String START_URL = ORIGIN + "/assets/index.html";

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        /* Log the crash, then let it happen normally so Play still receives it.
         *
         * The reported symptom was "the app closes and I have to open it again",
         * which is what an uncaught exception looks like from the outside. With
         * nothing logged, the only way to find it was to guess at the cause and
         * change unrelated code until it stopped - which is how the singleTask /
         * double-back fixes below were chosen, and they are hardening, not proof.
         * This makes the next occurrence a one-command diagnosis:
         *   adb logcat -s GoalDefender:V AndroidRuntime:E
         */
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            Log.e(TAG, "UNCAUGHT on " + t.getName(), e);
            /* Kill the process, which is what Android's own default handler
             * does. A lambda cannot rethrow a checked Throwable, and swallowing
             * it would leave a half-dead process running - worse than a clean
             * crash, because the app looks alive but does nothing. */
            android.os.Process.killProcess(android.os.Process.myPid());
            System.exit(10);
        });

        super.onCreate(savedInstanceState);

        setContentView(R.layout.activity_main);
        web = findViewById(R.id.webview);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        /* The save is entirely localStorage. Without DOM storage the game starts
         * empty on every launch and forgets every purchase. */
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);

        /* Mixed content is not needed - the Firebase SDK is https - but the
         * default is stricter than the web build and costs nothing to match. */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        web.setBackgroundColor(Color.parseColor("#0b1220"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        /* Long-press selection and the text handles that come with it are a
         * gesture the game never wants. */
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);

        /* The soft keyboard. The game draws its own text field and focuses a real
         * hidden DOM <input> behind it, which is the only way to raise a mobile
         * keyboard reliably. That input cannot receive focus unless the WebView
         * itself holds it - and a WebView will not hold focus in touch mode
         * unless it is told it can. Without these two calls the tap focuses the
         * input, focus() reports success, and no keyboard ever appears, so the
         * field looks broken rather than disabled.
         *
         * The XML sets the same attributes; both are needed, because the XML
         * form is what the layout inflater reads and these are what the runtime
         * actually consults once a parent has taken focus. */
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.requestFocus();

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                WebResourceResponse res = loader.shouldInterceptRequest(req.getUrl());
                if (res == null) {
                    /* Returning null tells the WebView "I cannot serve this, carry
                     * on as if there were no interception at all" - so it makes a
                     * REAL network request for appassets.androidplatform.net,
                     * which resolves nowhere, and the player gets
                     * net::ERR_INVALID_RESPONSE with no explanation. That is
                     * exactly how the first on-device build failed, and it was
                     * invisible from here because the response was still "handled
                     * successfully". Logging it makes the next one obvious. */
                    Log.w(TAG, "asset loader could not serve " + req.getUrl()
                            + " - the app will show a WebView error page");
                }
                return res;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req,
                                        WebResourceError error) {
                if (req.isForMainFrame()) {
                    Log.e(TAG, "main frame failed to load: " + req.getUrl()
                            + " (" + error.getDescription() + " / " + error.getErrorCode() + ")");
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                /* The game is entirely self-contained. Anything trying to navigate
                 * away is either a bug or a phishing attempt inside the shell, and
                 * an app that will not leave its own WebView is one less thing to
                 * review. */
                return !req.getUrl().toString().startsWith(ORIGIN);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                Log.i(TAG, "loaded " + url);
            }
        });

        /* Full screen. The game is 1280x720 and draws its own stadium; letting the
         * status bar sit on top of it wastes the top of the canvas. */
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        web.loadUrl(START_URL);

        /* Back, in one place only.
         *
         * This used to be handled TWICE - once by onKeyDown and once by the
         * OnBackPressedDispatcher. Both receive KEYCODE_BACK, so a single press
         * could call web.goBack() and then immediately finish the activity: the
         * game navigated back and the app closed at the same time. On a screen
         * with nowhere left to go back to, that reads as the app closing itself.
         *
         * The dispatcher is the supported path, so onKeyDown is gone. The
         * keyboard is dismissed first, because while the name field has focus
         * back should close the keyboard rather than leave the screen. */
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (hideKeyboard()) return;
                if (web.canGoBack()) {
                    web.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }

    /** @return true if a soft keyboard was showing and has now been dismissed. */
    private boolean hideKeyboard() {
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm == null) return false;
        View focused = getCurrentFocus();
        if (focused == null) return false;
        if (!imm.isAcceptingText()) return false;
        imm.hideSoftInputFromWindow(focused.getWindowToken(), 0);
        focused.clearFocus();
        web.requestFocus();
        return true;
    }

    @Override
    protected void onPause() {
        super.onPause();
        /* The game pushes progress to the cloud on page hide and on a debounce.
         * Pausing is the Android equivalent of a page hide, so this is where that
         * flush has to happen or the last few seconds of a run are lost. */
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
        }
        super.onDestroy();
    }
}