package com.ycngmn.nobook

import com.microsoft.playwright.Page
import com.microsoft.playwright.Playwright
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class FeedTextSelectionTest {
    @Test
    fun enablesSelectionForFeedPostAndCommentBodies() {
        Playwright.create().use { playwright ->
            playwright.chromium().launch().use { browser ->
                val page = browser.newPage()
                page.setContent("""
                  <style>
                    html.unselectable, html.unselectable * {
                      -webkit-user-select: none;
                      user-select: none;
                    }
                  </style>
                  <main>
                    <article id="thai-post">
                      <a id="thai-profile">ชื่อผู้ใช้</a>
                      <div id="thai-body" data-mcomponent="TextArea" data-type="text">
                        ย่อหน้าแรกของโพสต์ภาษาไทย<br><br>ย่อหน้าที่สองสำหรับทดสอบการเลือกข้อความ
                      </div>
                      <button id="thai-reaction">ถูกใจ 10</button>
                    </article>
                    <article id="english-post">
                      <div id="english-body" data-mcomponent="TextArea" data-type="text">A long English post body.</div>
                    </article>
                    <article id="link-post">
                      <div id="link-body" data-mcomponent="TextArea" data-type="text">
                        Text before <a id="body-link" href="#target">a link</a> text after.
                      </div>
                    </article>
                    <article id="more-post">
                      <div id="more-body" data-mcomponent="TextArea" data-type="text">
                        Long collapsed post <button id="see-more">ดูเพิ่มเติม</button>
                      </div>
                    </article>
                    <article id="sponsored-post">
                      <header><div id="sponsored-label" data-mcomponent="TextArea" data-type="text">Sponsored</div></header>
                      <div id="sponsored-body" data-mcomponent="TextArea" data-type="text">Sponsored post body</div>
                    </article>
                    <article id="post-with-comment">
                      <div id="outer-body" data-mcomponent="TextArea" data-type="text">Post body</div>
                      <article id="comment"><div id="comment-text" data-mcomponent="TextArea" data-type="text">Comment text</div></article>
                    </article>
                    <div class="vertically-snappable">
                      <div id="reel-caption" data-mcomponent="TextArea" data-type="text">Reel caption</div>
                    </div>
                    <article id="wrapped-post">
                      <div role="button">
                        <div id="wrapped-body" data-mcomponent="TextArea" data-type="text">
                          <div id="wrapped-native" class="native-text"><span id="wrapped-span">Wrapped post body</span></div>
                        </div>
                      </div>
                      <header>
                        <div data-focusable="true" data-mcomponent="MContainer">
                          <div id="author-name" data-mcomponent="TextArea" data-type="text">
                            <div class="native-text"><span>Author Name</span></div>
                          </div>
                        </div>
                      </header>
                      <div data-focusable="true" data-mcomponent="MContainer">
                        <div id="focusable-body" data-mcomponent="TextArea" data-type="text">
                          Real mobile post body wrapped like Facebook
                        </div>
                      </div>
                    </article>
                  </main>
                """.trimIndent())
                page.locator("html").evaluate("element => element.classList.add('unselectable')")
                page.locator("body").evaluate(
                    "element => element.dataset.nobookTestFeed = 'true'"
                )
                page.evaluate(File("src/main/res/raw/scripts.js").readText())
                page.waitForTimeout(100.0)

                listOf(
                    "thai-body", "english-body", "link-body", "more-body",
                    "sponsored-body", "outer-body", "comment-text",
                    "wrapped-body", "wrapped-native", "wrapped-span", "focusable-body"
                ).forEach { assertTrue(it, isSelectable(page, it)) }
                listOf("thai-profile", "thai-reaction", "sponsored-label", "reel-caption", "author-name")
                    .forEach { assertFalse(it, isSelectable(page, it)) }

                assertEquals("text", style(page, "thai-body", "userSelect"))
                assertEquals("text", style(page, "thai-body", "webkitUserSelect"))
                assertEquals("auto", style(page, "thai-body", "pointerEvents"))
                assertEquals("text", style(page, "comment-text", "webkitUserSelect"))
                assertEquals("text", style(page, "wrapped-span", "webkitUserSelect"))
                assertEquals("none", style(page, "body-link", "webkitUserSelect"))
                assertEquals("none", style(page, "see-more", "webkitUserSelect"))
            }
        }
    }

    private fun isSelectable(page: Page, id: String): Boolean =
        page.locator("#$id").evaluate(
            "element => element.classList.contains('nobook-feed-text-selectable')"
        ) as Boolean

    private fun style(page: Page, id: String, property: String): Any? =
        page.locator("#$id").evaluate("(element, property) => getComputedStyle(element)[property]", property)
}
