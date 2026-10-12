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
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {

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

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                /* The game is entirely self-contained. Anything trying to navigate
                 * away is either a bug or a phishing attempt inside the shell, and
                 * an app that will not leave its own WebView is one less thing to
                 * review. */
                return !req.getUrl().toString().startsWith(ORIGIN);
            }
        });

        /* Full screen. The game is 1280x720 and draws its own stadium; letting the
         * status bar sit on top of it wastes the top of the canvas. */
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        web.loadUrl(START_URL);

        /* Back must go back through the game before it leaves the app. */
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web.canGoBack()) {
                    web.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
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