package com.ycngmn.nobook.utils.jsBridge

import android.webkit.JavascriptInterface

class VideoPlaybackBridge(
    private val playbackStateCallback: (Boolean) -> Unit,
) {
    @JavascriptInterface
    fun onPlaybackStateChanged(isPlaying: Boolean) {
        playbackStateCallback(isPlaying)
    }
}
