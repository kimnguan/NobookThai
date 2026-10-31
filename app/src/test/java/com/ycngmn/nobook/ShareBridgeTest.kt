package com.ycngmn.nobook

import com.ycngmn.nobook.utils.jsBridge.sanitizeFacebookShareUrl
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ShareBridgeTest {
    @Test
    fun acceptsTrustedFacebookUrlsAndRemovesTrackingData() {
        assertEquals(
            "https://www.facebook.com/example/posts/123?id=7",
            sanitizeFacebookShareUrl(
                "https://www.facebook.com/example/posts/123?id=7&fbclid=secret#comments"
            )
        )
        assertEquals(
            "https://m.facebook.com/story.php?story_fbid=123&id=456",
            sanitizeFacebookShareUrl(
                "https://m.facebook.com/story.php?story_fbid=123&id=456&mibextid=tracking"
            )
        )
        assertEquals(
            "https://www.facebook.com/watch/?v=99",
            sanitizeFacebookShareUrl("https://www.facebook.com/watch/?v=99&fbclid=tracking")
        )
        assertEquals(
            "https://www.facebook.com/photo.php?fbid=5&set=a.6&type=3",
            sanitizeFacebookShareUrl(
                "https://www.facebook.com/photo.php?fbid=5&set=a.6&type=3&theater=1"
            )
        )
        assertEquals(
            "https://www.facebook.com/reel/55",
            sanitizeFacebookShareUrl("https://www.facebook.com/reel/55")
        )
    }

    @Test
    fun rejectsUntrustedOrUnsafeUrls() {
        assertNull(sanitizeFacebookShareUrl("http://www.facebook.com/posts/1"))
        assertNull(sanitizeFacebookShareUrl("https://facebook.com.evil.test/posts/1"))
        assertNull(sanitizeFacebookShareUrl("https://l.facebook.com/l.php?u=https://evil.test"))
        assertNull(sanitizeFacebookShareUrl("javascript:alert(1)"))
        assertNull(sanitizeFacebookShareUrl("https://www.facebook.com/"))
        assertNull(sanitizeFacebookShareUrl("https://www.facebook.com/messages"))
    }
}
