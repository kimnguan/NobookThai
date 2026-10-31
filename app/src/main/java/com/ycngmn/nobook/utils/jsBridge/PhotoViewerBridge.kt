package com.ycngmn.nobook.utils.jsBridge

import android.webkit.JavascriptInterface

class PhotoViewerBridge(
    private val onVisibility: (Boolean) -> Unit,
) {
    @JavascriptInterface
    fun onVisibility(open: Boolean) {
        onVisibility(open)
    }
}
