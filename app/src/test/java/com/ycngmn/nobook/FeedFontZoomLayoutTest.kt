package com.ycngmn.nobook

import com.microsoft.playwright.Browser
import com.microsoft.playwright.Playwright
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class FeedFontZoomLayoutTest {
    @Test
    fun keepsHundredPercentLayoutAndReflowsZoomedFeed() {
        Playwright.create().use { playwright ->
            playwright.chromium().launch().use { browser ->
                listOf(412, 776).forEach { viewport ->
                    listOf(100, 115, 130, 145).forEach { zoom ->
                        assertLayout(browser, viewport, zoom)
                    }
                }
            }
        }
    }

    @Test
    fun reflowsMildZoomActionRowWithoutWaitingForTextOverflow() {
        Playwright.create().use { playwright ->
            playwright.chromium().launch().use { browser ->
                val viewport = 412
                val zoom = 115
                val page = browser.newPage()
                page.setViewportSize(viewport, 1600)
                page.setContent(fixture(viewport))
                page.evaluate(ZOOM_JS, zoom)
                val before = report(page)
                assertTrue(
                    "115% action row should overflow before compat: " +
                        "shareRight=${before.shareRight} rowScroll=${before.actionsRowScrollWidth}",
                    before.shareRight > viewport + 1 || before.actionsRowScrollWidth > viewport + 1
                )
                assertTrue(
                    "115% short body should still fit its box before compat",
                    before.actionsBodyScrollHeight <= before.actionsBodyClientHeight + 1
                )

                page.evaluate("window.__nobookFontZoom = $zoom")
                page.evaluate(File("src/main/res/raw/wordcut.js").readText())
                page.evaluate(File("src/main/res/raw/scripts.js").readText())
                val after = report(page)
                page.close()

                assertTrue("marked body at mild zoom", after.markedBodies > 0)
                assertTrue("share stays in viewport", after.shareRight <= viewport + 1)
                assertTrue("like stays in viewport", after.likeRight <= viewport + 1)
                assertTrue("comment stays in viewport", after.commentActionRight <= viewport + 1)
                assertTrue("action row stays in viewport", after.actionsRowRight <= viewport + 1)
                assertTrue(
                    "action row scroll fits",
                    after.actionsRowScrollWidth <= after.actionsRowClientWidth + 1
                )
            }
        }
    }

    private fun assertLayout(browser: Browser, viewport: Int, zoom: Int) {
        val page = browser.newPage()
        page.setViewportSize(viewport, 1600)
        page.setContent(fixture(viewport))
        val before = report(page)
        if (zoom != 100) page.evaluate(ZOOM_JS, zoom)
        val zoomed = report(page)
        page.evaluate("window.__nobookFontZoom = $zoom")
        page.evaluate(File("src/main/res/raw/wordcut.js").readText())
        page.evaluate(File("src/main/res/raw/scripts.js").readText())
        val after = report(page)
        page.close()

        val where = "viewport=$viewport zoom=$zoom"
        if (zoom == 100) {
            assertEquals(where, 0, after.markedBodies)
            assertEquals(where, "absolute", after.thaiPosition)
            assertEquals(where, before.thaiImageTop, after.thaiImageTop)
            assertEquals(where, before.galleryATop, after.galleryATop)
            assertEquals(where, before.galleryBTop, after.galleryBTop)
            assertTrue(where, after.marketImageLeft >= after.marketBodyRight - 2)
            return
        }

        if (zoom >= 130) {
            assertTrue(
                "$where before fix text stayed in a frozen box: " +
                    "scrollHeight=${zoomed.thaiScrollHeight} clientHeight=${zoomed.thaiClientHeight} " +
                    "fontSize=${zoomed.thaiFontSize}",
                zoomed.thaiScrollHeight > zoomed.thaiClientHeight + 1
            )
        }
        assertTrue("$where always reflows bodies", after.markedBodies > 0)
        assertFits(where, "thai", after.thaiScrollWidth, after.thaiClientWidth, after.thaiScrollHeight, after.thaiClientHeight, after.thaiRight, viewport)
        assertFits(where, "english", after.englishScrollWidth, after.englishClientWidth, after.englishScrollHeight, after.englishClientHeight, after.englishRight, viewport)
        assertFits(where, "comment", after.commentScrollWidth, after.commentClientWidth, after.commentScrollHeight, after.commentClientHeight, after.commentRight, viewport)
        assertEquals("$where thai overlap", 0, after.thaiOverlap)
        assertEquals("$where english overlap", 0, after.englishOverlap)
        assertEquals("$where market overlap", 0, after.marketOverlap)
        assertTrue("$where image below text", after.thaiImageTop >= after.thaiBottom - 1)
        assertTrue("$where english image below text", after.englishImageTop >= after.englishBottom - 1)
        assertTrue("$where marketplace image stays beside text", after.marketImageLeft >= after.marketBodyRight - 2)
        assertTrue("$where marketplace stays in viewport", after.marketImageRight <= viewport + 1)
        assertTrue("$where gallery stays on one row", kotlin.math.abs(after.galleryATop - after.galleryBTop) <= 2)
        assertTrue("$where gallery stays in viewport", after.galleryBRight <= viewport + 1)
        assertTrue("$where share stays in viewport", after.shareRight <= viewport + 1)
        assertTrue("$where action row stays in viewport", after.actionsRowRight <= viewport + 1)
        assertTrue("$where cta hittable", after.buttonHit)
        assertEquals(where, "normal", after.thaiWordBreak)
        assertEquals("$where thai word boundary", zoom > 100, after.thaiWordBoundary)
        if (zoomed.thaiScrollHeight > zoomed.thaiClientHeight + 1) {
            assertTrue(where, after.thaiOverflowWrap == "break-word" || after.thaiOverflowWrap == "anywhere")
        }
    }

    private fun assertFits(
        where: String,
        name: String,
        scrollWidth: Int,
        clientWidth: Int,
        scrollHeight: Int,
        clientHeight: Int,
        right: Int,
        viewport: Int
    ) {
        assertTrue("$where $name scrollWidth", scrollWidth <= clientWidth + 1)
        assertTrue("$where $name scrollHeight", scrollHeight <= clientHeight + 1)
        assertTrue("$where $name right", right <= viewport + 1)
    }

    private fun report(page: com.microsoft.playwright.Page): Metrics {
        val json = page.evaluate(REPORT_JS) as String
        val values = json.removePrefix("{").removeSuffix("}").split(",").associate {
            val (key, value) = it.split(":", limit = 2)
            key.trim().trim('"') to value.trim().trim('"')
        }
        return Metrics(
            markedBodies = values.getValue("markedBodies").toInt(),
            thaiPosition = values.getValue("thaiPosition"),
            thaiWordBreak = values.getValue("thaiWordBreak"),
            thaiWordBoundary = values.getValue("thaiWordBoundary") == "true",
            thaiOverflowWrap = values.getValue("thaiOverflowWrap"),
            thaiFontSize = values.getValue("thaiFontSize"),
            thaiScrollWidth = values.getValue("thaiScrollWidth").toInt(),
            thaiClientWidth = values.getValue("thaiClientWidth").toInt(),
            thaiScrollHeight = values.getValue("thaiScrollHeight").toInt(),
            thaiClientHeight = values.getValue("thaiClientHeight").toInt(),
            thaiRight = values.getValue("thaiRight").toInt(),
            thaiBottom = values.getValue("thaiBottom").toInt(),
            thaiImageTop = values.getValue("thaiImageTop").toInt(),
            englishScrollWidth = values.getValue("englishScrollWidth").toInt(),
            englishClientWidth = values.getValue("englishClientWidth").toInt(),
            englishScrollHeight = values.getValue("englishScrollHeight").toInt(),
            englishClientHeight = values.getValue("englishClientHeight").toInt(),
            englishRight = values.getValue("englishRight").toInt(),
            englishBottom = values.getValue("englishBottom").toInt(),
            englishImageTop = values.getValue("englishImageTop").toInt(),
            marketBodyRight = values.getValue("marketBodyRight").toInt(),
            marketImageLeft = values.getValue("marketImageLeft").toInt(),
            marketImageRight = values.getValue("marketImageRight").toInt(),
            galleryATop = values.getValue("galleryATop").toInt(),
            galleryBTop = values.getValue("galleryBTop").toInt(),
            galleryBRight = values.getValue("galleryBRight").toInt(),
            commentScrollWidth = values.getValue("commentScrollWidth").toInt(),
            commentClientWidth = values.getValue("commentClientWidth").toInt(),
            commentScrollHeight = values.getValue("commentScrollHeight").toInt(),
            commentClientHeight = values.getValue("commentClientHeight").toInt(),
            commentRight = values.getValue("commentRight").toInt(),
            actionsBodyScrollHeight = values.getValue("actionsBodyScrollHeight").toInt(),
            actionsBodyClientHeight = values.getValue("actionsBodyClientHeight").toInt(),
            actionsRowScrollWidth = values.getValue("actionsRowScrollWidth").toInt(),
            actionsRowClientWidth = values.getValue("actionsRowClientWidth").toInt(),
            actionsRowRight = values.getValue("actionsRowRight").toInt(),
            likeRight = values.getValue("likeRight").toInt(),
            commentActionRight = values.getValue("commentActionRight").toInt(),
            shareRight = values.getValue("shareRight").toInt(),
            thaiOverlap = values.getValue("thaiOverlap").toInt(),
            englishOverlap = values.getValue("englishOverlap").toInt(),
            marketOverlap = values.getValue("marketOverlap").toInt(),
            buttonHit = values.getValue("buttonHit") == "true"
        )
    }

    private fun fixture(viewport: Int): String {
        val thai = "วันนี้อยากเล่าประสบการณ์การใช้แอปนี้บนหน้าจอพับของโทรศัพท์เพราะข้อความภาษาไทยยาวมากและไม่มีช่องว่างระหว่างคำทุกคำทำให้บรรทัดไม่พอดีกับกล่องที่คำนวณไว้ก่อนขยายตัวอักษรแล้วรูปภาพเลยกินทับข้อความแทนที่จะดันลงไปด้านล่าง"
        val english = "Today I want to describe a long English feed post about using this app on a folded phone, because the sentence is long enough to wrap several times at the normal font size and should stay inside the viewport."
        return """
            <!doctype html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { margin: 0; width: ${viewport}px; font-family: sans-serif; }
                article { margin-bottom: 24px; }
                img { background: #ccc; display: block; }
              </style>
            </head>
            <body data-nobook-test-feed="true">
              <article id="thai-fixed">
                <div id="thai-body" data-mcomponent="TextArea" data-type="text">$thai</div>
                <img id="thai-image" alt="">
                <button id="thai-cta" type="button">ส่งข้อความ</button>
              </article>
              <article id="english-fixed">
                <div id="english-body" data-mcomponent="TextArea" data-type="text">$english</div>
                <img id="english-image" alt="">
              </article>
              <article id="market">
                <div id="market-row">
                  <div id="market-body" data-mcomponent="TextArea" data-type="text">$thai</div>
                  <img id="market-image" alt="">
                </div>
                <button id="market-cta" type="button">ส่งข้อความ</button>
              </article>
              <article id="gallery">
                <div id="gallery-body" data-mcomponent="TextArea" data-type="text">$english</div>
                <div id="gallery-row">
                  <img id="gallery-a" alt="">
                  <img id="gallery-b" alt="">
                </div>
              </article>
              <article id="comment-post">
                <div id="comment-body" data-mcomponent="TextArea" data-type="text">$thai</div>
                <article id="comment">
                  <div id="comment-text" data-mcomponent="TextArea" data-type="text">$thai</div>
                </article>
              </article>
              <article id="actions-post">
                <div id="actions-body" data-mcomponent="TextArea" data-type="text">โพสต์สั้น</div>
                <div id="actions-row">
                  <button id="action-like" type="button">ถูกใจ 4.1 พัน คน</button>
                  <button id="action-comment" type="button">ความคิดเห็น 780 รายการ</button>
                  <button id="action-share" type="button">แชร์ไปยังแอปอื่น 6000</button>
                </div>
              </article>
              <script>
                const viewport = $viewport;
                const textStyle = 'font-size:15px;line-height:20px;white-space:normal;word-break:normal;overflow-wrap:normal;display:block;box-sizing:border-box;';
                function freezeStacked(articleId, bodyId, imageId, buttonId) {
                  const body = document.getElementById(bodyId);
                  body.setAttribute('style', textStyle + 'position:relative;width:' + (viewport - 24) + 'px;margin:8px 12px;height:auto;');
                  const height = body.scrollHeight;
                  body.style.position = 'absolute';
                  body.style.height = height + 'px';
                  body.style.top = '8px';
                  body.style.left = '12px';
                  body.style.margin = '0';
                  let cursor = 8 + height + 8;
                  const image = imageId ? document.getElementById(imageId) : null;
                  if (image) {
                    image.setAttribute('style', 'position:absolute;left:0;top:' + cursor + 'px;width:' + viewport + 'px;height:160px;');
                    cursor += 168;
                  }
                  const button = buttonId ? document.getElementById(buttonId) : null;
                  if (button) {
                    button.setAttribute('style', 'position:absolute;left:12px;top:' + cursor + 'px;height:36px;');
                    cursor += 44;
                  }
                  document.getElementById(articleId).setAttribute('style',
                    'position:relative;width:' + viewport + 'px;height:' + cursor + 'px;overflow:visible;min-width:' + viewport + 'px;');
                }
                freezeStacked('thai-fixed', 'thai-body', 'thai-image', 'thai-cta');
                freezeStacked('english-fixed', 'english-body', 'english-image', null);
                document.getElementById('market-row').setAttribute('style', 'display:flex;width:' + viewport + 'px;min-width:min-content;');
                document.getElementById('market-body').setAttribute('style', textStyle + 'flex:1 1 auto;min-width:auto;white-space:normal;');
                document.getElementById('market-image').setAttribute('style', 'width:96px;height:96px;flex:0 0 96px;');
                document.getElementById('market-cta').setAttribute('style', 'display:block;margin:8px 12px;height:36px;');
                document.getElementById('gallery-body').setAttribute('style', textStyle + 'width:' + (viewport - 24) + 'px;margin:8px 12px;');
                document.getElementById('gallery-row').setAttribute('style', 'display:flex;width:' + viewport + 'px;');
                document.getElementById('gallery-a').setAttribute('style', 'width:50%;height:120px;');
                document.getElementById('gallery-b').setAttribute('style', 'width:50%;height:120px;');
                document.getElementById('comment-body').setAttribute('style', textStyle + 'width:' + (viewport - 24) + 'px;');
                document.getElementById('comment-text').setAttribute('style', textStyle + 'position:absolute;width:' + (viewport - 48) + 'px;height:20px;white-space:nowrap;overflow-wrap:normal;');
                const comment = document.getElementById('comment');
                comment.setAttribute('style', 'position:relative;width:' + viewport + 'px;height:28px;');
                document.getElementById('actions-post').setAttribute('style',
                  'position:relative;width:' + viewport + 'px;min-width:' + viewport + 'px;overflow:hidden;box-sizing:border-box;');
                document.getElementById('actions-body').setAttribute('style',
                  textStyle + 'width:' + (viewport - 24) + 'px;margin:8px 12px;height:auto;');
                document.getElementById('actions-row').setAttribute('style',
                  'display:flex;flex-wrap:nowrap;width:' + viewport + 'px;gap:8px;padding:0 8px;box-sizing:border-box;');
                ['action-like', 'action-comment', 'action-share'].forEach(id => {
                  document.getElementById(id).setAttribute('style',
                    'flex:0 0 auto;white-space:nowrap;font-size:16px;padding:10px 14px;' +
                    'min-width:max-content;box-sizing:border-box;');
                });
              </script>
            </body>
            </html>
        """.trimIndent()
    }

    private data class Metrics(
        val markedBodies: Int,
        val thaiPosition: String,
        val thaiWordBreak: String,
        val thaiWordBoundary: Boolean,
        val thaiOverflowWrap: String,
        val thaiFontSize: String,
        val thaiScrollWidth: Int,
        val thaiClientWidth: Int,
        val thaiScrollHeight: Int,
        val thaiClientHeight: Int,
        val thaiRight: Int,
        val thaiBottom: Int,
        val thaiImageTop: Int,
        val englishScrollWidth: Int,
        val englishClientWidth: Int,
        val englishScrollHeight: Int,
        val englishClientHeight: Int,
        val englishRight: Int,
        val englishBottom: Int,
        val englishImageTop: Int,
        val marketBodyRight: Int,
        val marketImageLeft: Int,
        val marketImageRight: Int,
        val galleryATop: Int,
        val galleryBTop: Int,
        val galleryBRight: Int,
        val commentScrollWidth: Int,
        val commentClientWidth: Int,
        val commentScrollHeight: Int,
        val commentClientHeight: Int,
        val commentRight: Int,
        val actionsBodyScrollHeight: Int,
        val actionsBodyClientHeight: Int,
        val actionsRowScrollWidth: Int,
        val actionsRowClientWidth: Int,
        val actionsRowRight: Int,
        val likeRight: Int,
        val commentActionRight: Int,
        val shareRight: Int,
        val thaiOverlap: Int,
        val englishOverlap: Int,
        val marketOverlap: Int,
        val buttonHit: Boolean
    )

    companion object {
        private val REPORT_JS = """
            () => {
              const box = id => {
                const el = document.getElementById(id);
                const rect = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                return {
                  scrollWidth: el.scrollWidth,
                  clientWidth: el.clientWidth,
                  scrollHeight: el.scrollHeight,
                  clientHeight: el.clientHeight,
                  right: Math.round(rect.right),
                  bottom: Math.round(rect.bottom),
                  top: Math.round(rect.top),
                  left: Math.round(rect.left),
                  position: cs.position,
                  wordBreak: cs.wordBreak,
                  overflowWrap: cs.overflowWrap,
                  fontSize: cs.fontSize
                };
              };
              const area = (a, b) => {
                const ra = document.getElementById(a).getBoundingClientRect();
                const rb = document.getElementById(b).getBoundingClientRect();
                const width = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
                const height = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
                return width > 1 && height > 1 ? Math.round(width * height) : 0;
              };
              const thai = box('thai-body');
              const thaiImage = box('thai-image');
              const english = box('english-body');
              const englishImage = box('english-image');
              const marketBody = box('market-body');
              const marketImage = box('market-image');
              const galleryA = box('gallery-a');
              const galleryB = box('gallery-b');
              const comment = box('comment-text');
              const actionsBody = box('actions-body');
              const actionsRow = box('actions-row');
              const like = box('action-like');
              const commentAction = box('action-comment');
              const share = box('action-share');
              const button = document.getElementById('thai-cta').getBoundingClientRect();
              const hit = document.elementFromPoint(Math.min(button.left + 4, window.innerWidth - 2), button.top + 4);
              return JSON.stringify({
                markedBodies: document.querySelectorAll('.nobook-font-zoom-body').length,
                thaiPosition: thai.position,
                thaiWordBreak: thai.wordBreak,
                thaiWordBoundary: document.getElementById('thai-body').textContent.split('\u200b').includes('ประสบการณ์'),
                thaiOverflowWrap: thai.overflowWrap,
                thaiFontSize: thai.fontSize,
                thaiScrollWidth: thai.scrollWidth,
                thaiClientWidth: thai.clientWidth,
                thaiScrollHeight: thai.scrollHeight,
                thaiClientHeight: thai.clientHeight,
                thaiRight: thai.right,
                thaiBottom: thai.bottom,
                thaiImageTop: thaiImage.top,
                englishScrollWidth: english.scrollWidth,
                englishClientWidth: english.clientWidth,
                englishScrollHeight: english.scrollHeight,
                englishClientHeight: english.clientHeight,
                englishRight: english.right,
                englishBottom: english.bottom,
                englishImageTop: englishImage.top,
                marketBodyRight: marketBody.right,
                marketImageLeft: marketImage.left,
                marketImageRight: marketImage.right,
                galleryATop: galleryA.top,
                galleryBTop: galleryB.top,
                galleryBRight: galleryB.right,
                commentScrollWidth: comment.scrollWidth,
                commentClientWidth: comment.clientWidth,
                commentScrollHeight: comment.scrollHeight,
                commentClientHeight: comment.clientHeight,
                commentRight: comment.right,
                actionsBodyScrollHeight: actionsBody.scrollHeight,
                actionsBodyClientHeight: actionsBody.clientHeight,
                actionsRowScrollWidth: actionsRow.scrollWidth,
                actionsRowClientWidth: actionsRow.clientWidth,
                actionsRowRight: actionsRow.right,
                likeRight: like.right,
                commentActionRight: commentAction.right,
                shareRight: share.right,
                thaiOverlap: area('thai-body', 'thai-image'),
                englishOverlap: area('english-body', 'english-image'),
                marketOverlap: area('market-body', 'market-image'),
                buttonHit: Boolean(hit && (hit.id === 'thai-cta' || hit.closest('#thai-cta')))
              });
            }
        """.trimIndent()

        private val ZOOM_JS = """
            (percent) => {
              const factor = percent / 100;
              const nodes = [...document.querySelectorAll('body *')];
              const bases = nodes.map(el => parseFloat(getComputedStyle(el).fontSize));
              nodes.forEach((el, index) => {
                el.style.fontSize = (bases[index] * factor) + 'px';
              });
            }
        """.trimIndent()
    }
}
