package com.ycngmn.nobook

import com.microsoft.playwright.Page
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class PhotoViewerLayoutTest {
    @Test
    fun firstCommentPhotoOpenMatchesTheCorrectSecondOpen() {
        com.microsoft.playwright.Playwright.create().use { playwright ->
            playwright.chromium().launch().use { browser ->
                val page = browser.newPage()
                page.setViewportSize(412, 919)
                page.setContent(PAGE)
                page.evaluate(File("src/main/res/raw/photo_viewer_layout.js").readText())

                assertCorrected(page, "portrait first open", 900, 1600, deferDecode = true, keyboard = false)
                val second = open(page, 900, 1600, deferDecode = false, keyboard = false)
                assertEquals("second open ${second["detail"]}", "none", second["action"])
                assertEquals("second open already fit", true, second["fits"])
                assertEquals("second open does not dispatch resize", 0, (second["resizes"] as Number).toInt())
                close(page)

                assertCorrected(page, "different comment image", 800, 1200, deferDecode = true, keyboard = false)
                assertCorrected(page, "portrait", 700, 1400, deferDecode = true, keyboard = false)
                assertCorrected(page, "landscape", 1600, 900, deferDecode = true, keyboard = false)
                assertCorrected(page, "tall image", 800, 3200, deferDecode = true, keyboard = false)

                page.setViewportSize(412, 520)
                val afterKeyboard = open(page, 900, 1600, deferDecode = true, keyboard = true)
                assertEquals("after keyboard ${afterKeyboard["detail"]}", true, afterKeyboard["fits"])
                assertTrue(
                    "after keyboard resizes once the viewport settles: ${afterKeyboard["resizes"]}",
                    (afterKeyboard["resizes"] as Number).toInt() in 1..2
                )
                assertEquals("keyboard inset cleared", 0, (afterKeyboard["imeBottomPx"] as Number).toInt())
                assertEquals("composer blurred", false, afterKeyboard["focused"])
                close(page)

                page.setViewportSize(412, 919)
                assertCorrected(page, "keyboard never shown", 900, 1600, deferDecode = true, keyboard = false)

                page.setViewportSize(412, 919)
                assertCorrected(page, "folded", 900, 1600, deferDecode = true, keyboard = false)
                page.setViewportSize(882, 734)
                assertCorrected(page, "unfolded", 1600, 900, deferDecode = true, keyboard = false)
                page.setViewportSize(412, 919)

                assertEquals("feed viewer stays untouched", false, page.evaluate("() => window.__openFeedPhoto()"))
                assertGalleryAndPinch(page)
                page.close()
            }
        }
    }

    private fun assertCorrected(
        page: Page,
        label: String,
        naturalWidth: Int,
        naturalHeight: Int,
        deferDecode: Boolean,
        keyboard: Boolean,
    ) {
        val result = open(page, naturalWidth, naturalHeight, deferDecode, keyboard)
        val where = "$label ${result["detail"]}"
        assertEquals(where, true, result["fits"])
        assertEquals(where, "resize", result["action"])
        val resizes = (result["resizes"] as Number).toInt()
        assertTrue("$where resizes=$resizes", resizes in 1..2)
        close(page)
    }

    private fun open(
        page: Page,
        naturalWidth: Int,
        naturalHeight: Int,
        deferDecode: Boolean,
        keyboard: Boolean,
    ): Map<String, Any> {
        page.evaluate(
            "([w, h, deferDecode, keyboard]) => window.__openCommentPhoto(w, h, deferDecode, keyboard)",
            listOf(naturalWidth, naturalHeight, deferDecode, keyboard)
        )
        if (keyboard) {
            page.waitForFunction("() => window.__viewerOpen === true")
            page.setViewportSize(412, 919)
            page.evaluate("() => { window.__nobookImeBottomPx = 0; }")
        }
        page.waitForFunction("() => window.__photoCase && window.__nobookPhotoViewerResult && window.__nobookPhotoViewerResult.phase === 'final'")
        @Suppress("UNCHECKED_CAST")
        val result = page.evaluate("() => window.__photoCase") as Map<String, Any>
        val stable = page.evaluate("() => window.__resizeEvents")
        page.waitForTimeout(50.0)
        assertEquals("resize is not repeated", stable, page.evaluate("() => window.__resizeEvents"))
        return result
    }

    private fun close(page: Page) {
        page.evaluate("() => window.__closeViewer()")
    }

    private fun assertGalleryAndPinch(page: Page) {
        page.evaluate("() => window.__openGallery()")
        page.waitForFunction("() => window.__nobookPhotoViewerResult && window.__nobookPhotoViewerResult.phase === 'final'")
        page.evaluate("() => { window.__resizeEvents = 0; window.__swipeGallery(); }")
        page.waitForFunction("() => window.__galleryIndex === 1 && window.__pinched === true")
        assertEquals("swipe does not dispatch another resize", 0, (page.evaluate("() => window.__resizeEvents") as Number).toInt())
        assertEquals("pinch handler still runs", true, page.evaluate("() => window.__pinched"))
        close(page)
    }
}

private const val PAGE = """
<!DOCTYPE html>
<html>
<body>
  <div role="dialog" id="comments">
    <textarea id="composer"></textarea>
    <img id="comment-photo" width="180" height="180" alt="">
  </div>
  <img id="feed-photo" width="300" height="200" alt="">
  <script>
    const imageUrl = (width, height) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').fillRect(0, 0, width, height);
      return canvas.toDataURL();
    };
    const expected = (img, frame) => {
      const scale = Math.min(frame.clientWidth / img.naturalWidth, frame.clientHeight / img.naturalHeight);
      return { width: img.naturalWidth * scale, height: img.naturalHeight * scale };
    };
    const fits = (img, frame) => {
      const box = expected(img, frame);
      return Math.abs(img.clientWidth - box.width) < 2 && Math.abs(img.clientHeight - box.height) < 2;
    };
    window.__nobookImeBottomPx = 0;
    window.__resizeEvents = 0;
    window.__keyboard = false;
    window.__viewerOpen = false;
    window.PhotoViewerBridge = {
      onVisibility(open) {
        window.__viewerOpen = !!open;
        if (!open) window.__keyboard = false;
      }
    };
    window.addEventListener('resize', () => {
      window.__resizeEvents += 1;
      window.__facebookMeasure?.();
    });
    window.__closeViewer = () => {
      document.getElementById('viewer')?.remove();
      window.__facebookMeasure = null;
    };
    const mount = (url, deferDecode) => {
      const viewer = document.createElement('div');
      viewer.id = 'viewer';
      viewer.setAttribute('role', 'dialog');
      viewer.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;background:#000';
      const frame = document.createElement('div');
      frame.id = 'frame';
      frame.style.cssText = 'width:100%;height:100%';
      const img = document.createElement('img');
      img.id = 'viewer-img';
      window.__facebookMeasure = () => {
        const width = frame.clientWidth;
        const height = frame.clientHeight;
        if (!img.naturalWidth || !img.naturalHeight) {
          img.style.width = width + 'px';
          img.style.height = Math.round(height * 0.4) + 'px';
          return;
        }
        const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
        img.style.width = (img.naturalWidth * scale) + 'px';
        img.style.height = (img.naturalHeight * scale) + 'px';
      };
      const publish = () => {
        window.__photoCase = {
          fits: img.naturalWidth > 0 && fits(img, frame),
          resizes: window.__resizeEvents,
          focused: document.activeElement === document.getElementById('composer'),
          imeBottomPx: window.__nobookImeBottomPx,
          action: window.__nobookPhotoViewerResult?.action,
          detail: img.clientWidth + 'x' + img.clientHeight + ' action=' + window.__nobookPhotoViewerResult?.action
        };
      };
      frame.appendChild(img);
      viewer.appendChild(frame);
      document.getElementById('comment-photo').src = url;
      document.getElementById('comment-photo').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      if (!deferDecode) img.src = url;
      document.body.appendChild(viewer);
      window.__facebookMeasure();
      if (deferDecode) requestAnimationFrame(() => requestAnimationFrame(() => { img.src = url; }));
      const finish = () => {
        if (window.__nobookPhotoViewerResult?.phase === 'final') publish();
        else requestAnimationFrame(finish);
      };
      requestAnimationFrame(finish);
    };
    window.__openCommentPhoto = (naturalWidth, naturalHeight, deferDecode, keyboard) => {
      window.__keyboard = keyboard;
      window.__viewerOpen = false;
      window.__nobookImeBottomPx = keyboard ? 420 : 0;
      window.__resizeEvents = 0;
      window.__nobookPhotoViewerResult = null;
      window.__photoCase = null;
      if (keyboard) document.getElementById('composer').focus();
      const url = imageUrl(naturalWidth, naturalHeight);
      if (deferDecode) {
        mount(url, true);
        return;
      }
      const cached = new Image();
      cached.src = url;
      return cached.decode().then(() => mount(url, false));
    };
    window.__openFeedPhoto = () => new Promise((resolve) => {
      const viewer = document.createElement('div');
      viewer.id = 'feed-viewer';
      viewer.setAttribute('role', 'dialog');
      viewer.style.cssText = 'position:fixed;inset:0;background:#000';
      const img = document.createElement('img');
      img.src = imageUrl(400, 300);
      img.style.width = '400px';
      img.style.height = '300px';
      viewer.appendChild(img);
      document.body.appendChild(viewer);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const changed = img.style.width !== '400px' || img.style.height !== '300px' || viewer.dataset.nobookArmed === '1';
        viewer.remove();
        resolve(changed);
      }));
    });
    window.__openGallery = () => {
      window.__resizeEvents = 0;
      window.__pinched = false;
      window.__galleryIndex = 0;
      window.__nobookPhotoViewerResult = null;
      const viewer = document.createElement('div');
      viewer.id = 'viewer';
      viewer.setAttribute('role', 'dialog');
      viewer.style.cssText = 'position:fixed;inset:0;background:#000';
      const frame = document.createElement('div');
      frame.style.cssText = 'width:100%;height:100%';
      const img = document.createElement('img');
      img.addEventListener('pointerdown', () => { window.__pinched = true; });
      window.__facebookMeasure = () => {
        if (!img.naturalWidth) return;
        const scale = Math.min(frame.clientWidth / img.naturalWidth, frame.clientHeight / img.naturalHeight);
        img.style.width = (img.naturalWidth * scale) + 'px';
        img.style.height = (img.naturalHeight * scale) + 'px';
      };
      frame.appendChild(img);
      viewer.appendChild(frame);
      const cached = new Image();
      const url = imageUrl(900, 1600);
      cached.src = url;
      return cached.decode().then(() => {
        document.getElementById('comment-photo').src = url;
        document.getElementById('comment-photo').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        img.src = url;
        document.body.appendChild(viewer);
        window.__facebookMeasure();
      });
    };
    window.__swipeGallery = () => {
      window.__galleryIndex = 1;
      const img = document.querySelector('#viewer img');
      img.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      img.src = imageUrl(700, 700);
    };
  </script>
</body>
</html>
"""
