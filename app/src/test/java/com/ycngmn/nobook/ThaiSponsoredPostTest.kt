package com.ycngmn.nobook

import com.microsoft.playwright.Page
import com.microsoft.playwright.Playwright
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

class ThaiSponsoredPostTest {

    @Test
    fun resolvesCompleteFeedPostsWithAndWithoutArticleRole() {
        Playwright.create().use { playwright ->
            playwright.chromium().launch().use { browser ->
                val page = browser.newPage()
                page.setContent("<main id=fixtures></main>")
                page.evaluate("window.isDesktopMode = () => false")
                page.evaluate(File("src/main/res/raw/adblock.js").readText())
                addFixture(page, """
                  <section id="article-ad" role="article">
                    <header><span>ที่ได้รับการสนับสนุน</span></header>
                    <img alt=""><footer><button></button><button></button></footer>
                  </section>
                  <section id="mobile-feed-shell">
                    <div id="no-article-ad">
                      <header><span>ที่ได้รับการสนับสนุน</span></header>
                      <picture></picture><footer><button></button><button></button></footer>
                    </div>
                  </section>
                  <section id="gallery-ad">
                    <div data-mcomponent="TextArea">Makato</div>
                    <div data-mcomponent="TextArea">metadata</div>
                    <div data-mcomponent="TextArea">metadata</div>
                    <div data-focusable="true" data-mcomponent="MContainer"><div data-mcomponent="TextArea"><span>ที่ได้รับการสนับสนุน</span></div></div>
                    <div><img alt=""><img alt=""></div>
                    <div data-mcomponent="MessengerPanel"><button>Shop Now</button></div>
                    <footer><button></button><button></button><button></button></footer>
                  </section>
                  <section id="normal-post" role="article">
                    <header><span>ผู้ใช้ทั่วไป</span></header>
                    <div>ที่ได้รับการสนับสนุน</div>
                    <img alt=""><footer><button></button><button></button></footer>
                  </section>
                  <section id="normal-textarea-post">
                    <div data-mcomponent="TextArea">author</div>
                    <div data-mcomponent="TextArea">metadata</div>
                    <div data-mcomponent="TextArea">caption</div>
                    <div data-mcomponent="TextArea">body</div>
                    <div data-mcomponent="TextArea"><span>ที่ได้รับการสนับสนุน</span></div>
                    <img alt=""><footer><button></button><button></button></footer>
                  </section>
                  <section id="english-ad" role="article">
                    <header><span>Sponsored</span></header>
                    <img alt=""><footer><button></button><button></button></footer>
                  </section>
                """.trimIndent())

                page.waitForTimeout(500.0)

                assertEquals("none", display(page, "article-ad"))
                assertEquals("none", display(page, "no-article-ad"))
                assertEquals("none", display(page, "gallery-ad"))
                assertEquals("", display(page, "normal-post"))
                assertEquals("", display(page, "normal-textarea-post"))
                assertEquals("none", display(page, "english-ad"))
                assertEquals("", display(page, "mobile-feed-shell"))
            }
        }
    }

    @Test
    fun detectsStructuralAdsWithoutBodyTextFalsePositives() {
        Playwright.create().use { playwright ->
            playwright.chromium().launch().use { browser ->
                val page = browser.newPage()
                page.setContent("<main id=fixtures></main>")
                page.evaluate("window.isDesktopMode = () => false")
                page.evaluate(File("src/main/res/raw/adblock.js").readText())
                page.locator("body").evaluate(
                    "element => element.dataset.nobookTestReelRoute = 'true'"
                )

                addFixture(page, """
                  <div data-type="vscroller" role="feed">
                    <div id="thai-feed" role="article"><header><span>ที่ได้รับ</span><span>การสนับสนุน</span></header><img alt=""><footer><button></button><button></button></footer></div>
                    <div id="english-feed" role="article"><header><span>Sponsored</span></header><img alt=""><footer><button></button><button></button></footer></div>
                    <div id="normal-feed" role="article"><header><span>ผู้ใช้ทั่วไป</span></header><div>ที่ได้รับการสนับสนุน</div></div>
                  </div>
                  <section>
                    <div data-type="vscroller">
                      <div id="live-sponsored-reel" data-tracking-duration-id="65" data-nobook-test-visible="true">
                        <div data-mcomponent="TextArea"><span>ได้รับการสนับสนุน</span></div>
                        <button>Shop Now</button><button></button>
                      </div>
                      <div id="live-next-reel" data-tracking-duration-id="66" data-nobook-test-visible="true">
                        <div data-mcomponent="TextArea"><span>ได้รับการสนับสนุน</span></div>
                        <button>ส่งข้อความ</button><button></button>
                      </div>
                      <div id="live-normal-reel" data-tracking-duration-id="67"></div>
                    </div>
                    <div id="thai-reel" class="vertically-snappable" data-nobook-test-visible="true">
                      <div data-reel-metadata><span>ได้รับ</span><span>การสนับสนุน</span></div>
                    </div>
                    <div id="english-reel" class="vertically-snappable" data-nobook-test-visible="true">
                      <div data-reel-metadata><span>Sponsored</span></div>
                    </div>
                    <div id="normal-reel" class="vertically-snappable" data-nobook-test-visible="true">
                      <div data-reel-metadata><span>ผู้สร้างทั่วไป</span></div>
                      <div>แคปชันกล่าวถึง ได้รับการสนับสนุน</div>
                    </div>
                    <div id="overlay-reel" class="vertically-snappable" data-nobook-test-visible="true">
                      <div data-reel-metadata><span>ผู้สร้างทั่วไป</span></div>
                      <div id="overlay" data-sponsored-overlay><span>ได้รับการสนับสนุน</span><button>ดูเพิ่มเติม</button></div>
                    </div>
                    <div id="sponsored-overlay-reel" class="vertically-snappable" data-nobook-test-visible="true">
                      <div data-reel-metadata><span>ได้รับการสนับสนุน</span></div>
                      <div id="nested-overlay" data-sponsored-overlay><span>ได้รับการสนับสนุน</span><button>Shop Now</button></div>
                    </div>
                  </section>
                """.trimIndent())
                page.waitForTimeout(500.0)

                assertEquals("none", display(page, "thai-feed"))
                assertEquals("none", display(page, "english-feed"))
                assertEquals("", display(page, "thai-reel"))
                assertEquals("", display(page, "live-sponsored-reel"))
                assertEquals("", display(page, "live-next-reel"))
                assertEquals("", display(page, "live-normal-reel"))
                assertEquals("", display(page, "english-reel"))
                assertEquals("none", display(page, "overlay"))
                assertEquals("", display(page, "sponsored-overlay-reel"))
                assertEquals("REEL", attribute(page, "live-sponsored-reel", "data-nobook-ad-type"))
                assertEquals("", display(page, "normal-feed"))
                assertEquals("", display(page, "normal-reel"))
                assertEquals("", display(page, "overlay-reel"))
            }
        }
    }

    private fun addFixture(page: Page, html: String) {
        page.locator("#fixtures").evaluate(
            "(element, html) => element.insertAdjacentHTML('beforeend', html)",
            html
        )
    }

    private fun display(page: Page, id: String): Any? =
        page.locator("#$id").evaluate("element => element.style.display")

    private fun attribute(page: Page, id: String, name: String): String? =
        page.locator("#$id").getAttribute(name)
}
