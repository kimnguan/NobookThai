package com.ycngmn.nobook

import com.microsoft.playwright.Page
import com.microsoft.playwright.Playwright
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

class HideAiContentTest {
    @Test
    fun hidesExactAiBadgesAcrossFeedAndVideoContent() {
        Playwright.create().use { playwright ->
            playwright.chromium().launch().use { browser ->
                val page = browser.newPage()
                page.setContent("""
                  <main>
                    <article id="feed"><span>เนื้อหาที่สร้างโดย AI</span><img><footer></footer></article>
                    <article id="normal"><span>โพสต์นี้พูดถึง เนื้อหาที่สร้างโดย AI เท่านั้น</span><img><footer></footer></article>
                    <div id="reel" data-tracking-duration-id="1"><video></video><span>เนื้อหาที่สร้างโดย AI</span></div>
                    <div id="next-reel"></div>
                  </main>
                """.trimIndent())
                page.evaluate(File("src/main/res/raw/hide_ai_content.js").readText())
                page.waitForTimeout(100.0)

                assertEquals("none", display(page, "feed"))
                assertEquals("none", display(page, "reel"))
                assertEquals("", display(page, "normal"))

                page.locator("main").evaluate("""
                  element => element.insertAdjacentHTML('beforeend',
                    '<article id="dynamic"><span>Made with AI</span><img><footer></footer></article>')
                """.trimIndent())
                page.waitForTimeout(100.0)
                assertEquals("none", display(page, "dynamic"))
            }
        }
    }

    private fun display(page: Page, id: String): Any? =
        page.locator("#$id").evaluate("element => element.style.display")
}
