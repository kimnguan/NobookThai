package com.ycngmn.nobook.utils.jsBridge

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import com.ycngmn.nobook.R
import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

private val allowedShareQueryParameters =
    setOf("story_fbid", "id", "fbid", "set", "type", "v")

private val postPath = Regex(
    "/(?:posts|permalink|story\\.php|photo(?:s)?|videos?|reel|watch|share/[pvr])\\b",
    RegexOption.IGNORE_CASE
)

internal fun sanitizeFacebookShareUrl(value: String?): String? {
    if (value.isNullOrBlank()) return null
    return runCatching {
        val uri = URI(value.trim())
        val host = uri.host?.lowercase() ?: return null
        if (uri.scheme?.lowercase() != "https" || uri.rawUserInfo != null ||
            (uri.port != -1 && uri.port != 443) ||
            (host != "facebook.com" && !host.endsWith(".facebook.com")) ||
            host == "l.facebook.com" || host == "lm.facebook.com" ||
            !postPath.containsMatchIn(uri.rawPath ?: uri.path ?: "")
        ) return null

        val query = uri.rawQuery
            ?.split('&')
            ?.mapNotNull { part ->
                val pieces = part.split('=', limit = 2)
                val name = URLDecoder.decode(pieces[0], StandardCharsets.UTF_8)
                if (name !in allowedShareQueryParameters) return@mapNotNull null
                val valuePart = pieces.getOrNull(1)?.let {
                    URLEncoder.encode(
                        URLDecoder.decode(it, StandardCharsets.UTF_8),
                        StandardCharsets.UTF_8
                    ).replace("+", "%20")
                }
                URLEncoder.encode(name, StandardCharsets.UTF_8) +
                    (valuePart?.let { "=$it" } ?: "")
            }
            ?.joinToString("&")
            ?.ifBlank { null }

        URI("https", null, host, -1, uri.path.ifBlank { "/" }, query, null).toASCIIString()
    }.getOrNull()
}

class ShareBridge(
    private val context: Context,
    private val onFeedShareOffer: (String?) -> Unit = {}
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun report(line: String?) {
        val text = line?.take(300) ?: return
        if (!text.startsWith("[NoBookShare] ") || text.contains("http", ignoreCase = true)) return
        Log.d("NobookShare", text)
    }

    @JavascriptInterface
    fun setFeedShare(value: String?) {
        val url = sanitizeFacebookShareUrl(value)
        mainHandler.post { onFeedShareOffer(url) }
    }

    @JavascriptInterface
    fun hideFeedShare() {
        mainHandler.post { onFeedShareOffer(null) }
    }

    @JavascriptInterface
    fun shareUrl(value: String?) {
        val url = sanitizeFacebookShareUrl(value)
        if (url == null) {
            Log.w("NobookShare", "Rejected invalid or untrusted share URL")
            return
        }
        Log.d("NobookShare", "ShareBridge invoked")
        mainHandler.post { openChooser(url) }
    }

    private fun openChooser(url: String) {
        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, url)
        }
        val chooser = Intent.createChooser(
            sendIntent,
            context.getString(R.string.share_to_other_apps)
        )
        if (context !is Activity) chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching {
            context.startActivity(chooser)
            Log.d("NobookShare", "Android chooser opened")
        }.onFailure {
            Log.w("NobookShare", "Unable to open Android chooser")
        }
    }
}
