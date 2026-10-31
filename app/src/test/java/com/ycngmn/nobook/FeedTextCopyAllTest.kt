package com.ycngmn.nobook

import com.microsoft.playwright.Playwright
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class FeedTextCopyAllTest {
    @Test
    fun longPressCopiesPostAndCommentTextUnlessFingerMoves() {
        Playwright.create().use { playwright ->
            playwright.chromium().launch().use { browser ->
                val page = browser.newPage()
                page.setContent(
                    """
                    <main>
                      <article id="post">
                        <div id="post-body" data-mcomponent="TextArea" data-type="text">
                          ย่อหน้าแรก<br><br>ย่อหน้าที่สอง
                          <button id="see-more" type="button">ดูเพิ่มเติม</button>
                        </div>
                        <article id="comment">
                          <div id="comment-text" data-mcomponent="TextArea" data-type="text">ข้อความคอมเมนต์</div>
                        </article>
                      </article>
                    </main>
                    """.trimIndent()
                )
                page.locator("body").evaluate("element => element.dataset.nobookTestFeed = 'true'")
                page.evaluate(
                    """
                    window.__nobookCopied = [];
                    window.ClipboardBridge = {
                      copyText(text) { window.__nobookCopied.push(text); }
                    };
                    """.trimIndent()
                )
                page.evaluate(File("src/main/res/raw/scripts.js").readText())
                page.waitForTimeout(100.0)

                val extracted = page.evaluate(
                    "() => window.__nobookExtractFeedText(document.getElementById('post-body'))"
                ) as String
                assertTrue(extracted, extracted.contains("ย่อหน้าแรก"))
                assertTrue(extracted, extracted.contains("ย่อหน้าที่สอง"))
                assertTrue(extracted, !extracted.contains("ดูเพิ่มเติม"))

                page.evaluate(
                    """
                    () => {
                      const target = document.getElementById('post-body');
                      const down = new PointerEvent('pointerdown', {
                        bubbles: true, cancelable: true, pointerId: 1,
                        pointerType: 'touch', clientX: 40, clientY: 40
                      });
                      target.dispatchEvent(down);
                    }
                    """.trimIndent()
                )
                page.waitForTimeout(550.0)
                val afterLongPress = page.evaluate("() => window.__nobookCopied.slice()") as List<*>
                assertEquals(1, afterLongPress.size)
                assertTrue(afterLongPress[0].toString().contains("ย่อหน้าแรก"))
                assertTrue(afterLongPress[0].toString().contains("ย่อหน้าที่สอง"))
                assertTrue(!afterLongPress[0].toString().contains("ดูเพิ่มเติม"))

                page.evaluate("() => { window.__nobookCopied.length = 0; }")
                page.evaluate(
                    """
                    () => {
                      const target = document.getElementById('comment-text');
                      target.dispatchEvent(new PointerEvent('pointerdown', {
                        bubbles: true, cancelable: true, pointerId: 2,
                        pointerType: 'touch', clientX: 20, clientY: 20
                      }));
                      target.dispatchEvent(new PointerEvent('pointermove', {
                        bubbles: true, cancelable: true, pointerId: 2,
                        pointerType: 'touch', clientX: 60, clientY: 20
                      }));
                    }
                    """.trimIndent()
                )
                page.waitForTimeout(550.0)
                val afterMove = page.evaluate("() => window.__nobookCopied.slice()") as List<*>
                assertTrue("drag should keep partial-select path", afterMove.isEmpty())

                page.evaluate(
                    """
                    () => {
                      const target = document.getElementById('comment-text');
                      target.dispatchEvent(new PointerEvent('pointerdown', {
                        bubbles: true, cancelable: true, pointerId: 3,
                        pointerType: 'touch', clientX: 24, clientY: 24
                      }));
                    }
                    """.trimIndent()
                )
                page.waitForTimeout(550.0)
                val afterComment = page.evaluate("() => window.__nobookCopied.slice()") as List<*>
                assertEquals(listOf("ข้อความคอมเมนต์"), afterComment)

                page.evaluate("() => { window.__nobookCopied.length = 0; }")
                page.evaluate(
                    """
                    () => {
                      document.getElementById('see-more').dispatchEvent(new PointerEvent('pointerdown', {
                        bubbles: true, cancelable: true, pointerId: 4,
                        pointerType: 'touch', clientX: 10, clientY: 10
                      }));
                    }
                    """.trimIndent()
                )
                page.waitForTimeout(550.0)
                val afterButton = page.evaluate("() => window.__nobookCopied.slice()") as List<*>
                assertTrue(afterButton.isEmpty())
            }
        }
    }
}
