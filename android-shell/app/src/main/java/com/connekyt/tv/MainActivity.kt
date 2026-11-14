package com.connekyt.tv

import android.annotation.SuppressLint
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.app.Activity

/**
 * Connekyt TV for Android TV: a full-screen shell around the TV web app at https://tv.connekyt.com, the same screens that run
 * on Tizen and webOS. Everything the viewer sees (login, pairing, home, the player, Send to TV, Continue on phone) is the web
 * app, so a change there reaches every TV by deploying the web build, with no new Play upload.
 *
 * The shell only does what a browser tab cannot: it keeps the screen on, maps the remote's Back to the keys the app already
 * handles, lets the player go full screen, and shows a plain "no connection" screen with automatic retry instead of a blank page.
 */
class MainActivity : Activity() {

    private lateinit var root: FrameLayout
    private lateinit var web: WebView
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null
    private var showingOffline = false
    private var lastBackAt = 0L
    private val handler = Handler(Looper.getMainLooper())
    private val retry = object : Runnable {
        override fun run() {
            if (showingOffline) {
                if (isOnline()) loadApp() else handler.postDelayed(this, RETRY_MS)
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        root = FrameLayout(this)
        setContentView(root)

        web = WebView(this).apply {
            setBackgroundColor(0xFF0A1220.toInt())
            isFocusable = true
            isFocusableInTouchMode = true
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                allowFileAccess = false
                allowContentAccess = false
                setSupportMultipleWindows(false)
                userAgentString = "$userAgentString ConnekytTV/${BuildConfig_VERSION} AndroidTV"
            }
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    !isAllowed(request.url)

                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                    // Only a failed page load matters; a missing image or script is the page's own business.
                    if (request.isForMainFrame) showOffline()
                }

                override fun onPageFinished(view: WebView, url: String?) {
                    if (url != null && url.startsWith(APP_URL)) showingOffline = false
                }
            }
            webChromeClient = object : WebChromeClient() {
                // No camera or microphone is needed on the TV, so those requests are refused.
                override fun onPermissionRequest(request: PermissionRequest) = request.deny()

                override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                    fullscreenView?.let { onHideCustomView() }
                    fullscreenView = view
                    fullscreenCallback = callback
                    root.addView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
                    web.visibility = View.GONE
                }

                override fun onHideCustomView() {
                    fullscreenView?.let { root.removeView(it) }
                    fullscreenView = null
                    fullscreenCallback?.onCustomViewHidden()
                    fullscreenCallback = null
                    web.visibility = View.VISIBLE
                    web.requestFocus()
                }
            }
        }
        root.addView(web, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        web.requestFocus()

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else loadApp()
    }

    private fun loadApp() {
        showingOffline = false
        web.loadUrl(APP_URL)
    }

    /** Only the TV app and the Connekyt API may load inside the shell; anything else (a stray link) is ignored. */
    private fun isAllowed(uri: Uri): Boolean {
        if (uri.scheme == "about" || uri.scheme == "data") return true
        return uri.scheme == "https" && (uri.host == APP_HOST || uri.host == "backend.connekyt.com" || uri.host == "connekyt.com")
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(CONNECTIVITY_SERVICE) as ConnectivityManager
        return cm.activeNetwork != null
    }

    private fun showOffline() {
        if (showingOffline) return
        showingOffline = true
        val html = """
            <html><body style="margin:0;background:#0A1220;color:#EAF0FA;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
            <div><div style="font-size:42px;font-weight:700">Can't reach Connekyt</div>
            <div style="margin-top:16px;font-size:26px;color:#93A3BE">Check your TV's internet connection. We'll try again by ourselves,<br>or press OK to try now.</div></div>
            </body></html>
        """.trimIndent()
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
        handler.removeCallbacks(retry)
        handler.postDelayed(retry, RETRY_MS)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (showingOffline && (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER)) {
            loadApp()
            return true
        }
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (fullscreenView != null) {
                fullscreenCallback?.onCustomViewHidden()
                web.webChromeClient?.onHideCustomView()
                return true
            }
            if (showingOffline) {
                finish()
                return true
            }
            // On the first screens, pressing Back twice quickly leaves the app. Elsewhere the web app handles Back itself,
            // exactly as it does on Tizen and webOS, so it is sent the key it listens for.
            val now = System.currentTimeMillis()
            val path = Uri.parse(web.url ?: APP_URL).path ?: "/"
            if (path in ROOT_PATHS) {
                if (now - lastBackAt < 2000) {
                    finish()
                    return true
                }
                lastBackAt = now
            }
            web.evaluateJavascript(
                "(function(){var t=document.activeElement||document.body;" +
                    "['keydown','keyup'].forEach(function(n){t.dispatchEvent(new KeyboardEvent(n,{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true}));});})();",
                null,
            )
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        root.removeAllViews()
        web.destroy()
        super.onDestroy()
    }

    companion object {
        const val APP_HOST = "tv.connekyt.com"
        const val APP_URL = "https://tv.connekyt.com/"
        const val BuildConfig_VERSION = "0.3.0"
        const val RETRY_MS = 10_000L
        val ROOT_PATHS = setOf("/", "/home", "/login", "/splash", "/profiles", "/onboarding")
    }
}
