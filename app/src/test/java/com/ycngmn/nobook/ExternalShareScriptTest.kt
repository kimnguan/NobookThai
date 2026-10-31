package com.ycngmn.nobook

import com.microsoft.playwright.Page
import com.microsoft.playwright.Playwright
import com.microsoft.playwright.Route
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ExternalShareScriptTest {
    @Test
    fun addsThaiFeedShareRowWithoutReplacingFacebookOptions() {
        withPage("""
          <html lang="th"><head></head><body>
            <article>
              <a href="https://www.facebook.com/example/posts/123?fbclid=tracking">timestamp</a>
              <button id="share" aria-label="แชร์">แชร์</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, """
              <div role="dialog" id="share-sheet">
                <div><button>Messenger</button></div>
                <div><button>WhatsApp</button></div>
                <div id="copy-row" role="button">
                  <div role="button"><span>คัดลอกลิงก์</span></div>
                </div>
              </div>
            """.trimIndent())

            assertEquals(1, page.locator("[data-nobook-external-share]").count())
            assertEquals(
                "share-sheet",
                page.locator("[data-nobook-external-share]").evaluate("element => element.parentElement.id")
            )
            assertEquals(1, page.locator("#share-sheet").locator("text=Messenger").count())
            assertEquals(1, page.locator("#share-sheet").locator("text=WhatsApp").count())
            assertEquals(1, page.locator("#share-sheet").locator("text=คัดลอกลิงก์").count())
            assertEquals(0, page.locator("[data-nobook-share-forward]").count())

            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/123", sharedUrl(page))
            assertEquals("visible", page.locator("#share-sheet").evaluate("element => getComputedStyle(element).visibility"))
            assertTrue(logs(page).any { it.contains("context=FEED") && it.contains("permalinkSource=feed-post") && it.contains("permalinkFound=true") })
            assertTrue(logs(page).none { it.contains("https://") || it.contains("fbclid") })
        }
    }

    @Test
    fun sharesVideoPermalinkFromWatchUrl() {
        withPage("""
          <html lang="en"><head></head><body>
            <article>
              <a href="https://www.facebook.com/watch/?v=99&amp;fbclid=tracking">1h</a>
              <button id="share" aria-label="Share">Share</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, """
              <div role="dialog" id="share-sheet">
                <div role="button"><span>Messenger</span></div>
                <div id="copy-row" role="button"><span>Copy link</span></div>
              </div>
            """.trimIndent())
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/watch/?v=99", sharedUrl(page))
        }
    }

    @Test
    fun remembersPermalinkFromShareCountControl() {
        withPage("""
          <html lang="th"><head></head><body>
            <article>
              <a href="https://www.facebook.com/example/posts/123?fbclid=tracking">1h</a>
              <div role="button" id="share-count">261share</div>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share-count").click()
            openSheet(page, """
              <div role="dialog" id="share-sheet">
                <div role="button"><span>คัดลอกลิงก์</span></div>
              </div>
            """.trimIndent())
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/123", sharedUrl(page))
        }
    }

    @Test
    fun usesPermalinkCapturedFromTheTappedFeedPost() {
        withPage("""
          <html lang="th"><head></head><body>
            <article id="first">
              <a href="https://www.facebook.com/example/posts/111">1 ชม.</a>
              <button id="share-first" aria-label="แชร์">แชร์</button>
            </article>
            <article id="second">
              <a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.facebook.com%2Fexample%2Fposts%2F222">2 ชม.</a>
              <button id="share-second" aria-label="แชร์">แชร์</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share-second").click()
            openSheet(page, """
              <div role="dialog" id="share-sheet" style="margin-top:240px">
                <div role="button"><span>ส่งเป็นข้อความ</span></div>
                <div role="button"><span>ส่งใน WhatsApp</span></div>
                <div role="button"><span>คัดลอกลิงก์</span></div>
              </div>
            """.trimIndent())
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/222", sharedUrl(page))
        }
    }

    @Test
    fun prefersTheFeedPostPermalinkOverPhotoLinks() {
        withPage("""
          <html lang="en"><head></head><body>
            <article>
              <a href="https://www.facebook.com/photo.php?fbid=1&amp;type=3">photo</a>
              <a href="https://www.facebook.com/photo.php?fbid=2&amp;type=3">photo</a>
              <a href="https://www.facebook.com/example/posts/777?fbclid=tracking">3h</a>
              <button id="share" aria-label="Share">Share</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, SHARE_SHEET)
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/777", sharedUrl(page))
        }
    }

    @Test
    fun sharesGroupPageAndVideoFeedPermalinks() {
        withPage("""
          <html lang="th"><head></head><body>
            <article id="group">
              <a href="https://www.facebook.com/groups/10/posts/20?ref=share">1 ชม.</a>
              <button id="share-group" aria-label="แชร์">แชร์</button>
            </article>
            <article id="page">
              <a href="https://www.facebook.com/PageName/videos/321?fbclid=tracking">2 ชม.</a>
              <button id="share-page" aria-label="แชร์">แชร์</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share-group").click()
            openSheet(page, SHARE_SHEET)
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/groups/10/posts/20", sharedUrl(page))

            page.evaluate("window.sharedUrl = null")
            page.locator("#share-sheet").evaluate("element => element.remove()")
            page.locator("#share-page").click()
            openSheet(page, SHARE_SHEET)
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/PageName/videos/321", sharedUrl(page))
        }
    }

    @Test
    fun keepsTheExternalPostLinkWhenASharedLinkIsAlsoPresent() {
        withPage("""
          <html lang="en"><head></head><body>
            <article>
              <a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com%2Fstory">article</a>
              <a href="https://www.facebook.com/example/posts/888?fbclid=secret">5m</a>
              <button id="share" aria-label="Share">Share</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, SHARE_SHEET)
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/888", sharedUrl(page))
        }
    }

    @Test
    fun sharesTheFeedPostWhenThePermalinkSitsAboveTheShareButton() {
        withPage("""
          <html lang="th"><head></head><body>
            <div id="feed">
              <a href="https://www.facebook.com/example/posts/55?fbclid=tracking">1 ชม.</a>
              <div role="article">
                <button id="share" aria-label="แชร์">แชร์</button>
              </div>
              <a href="https://www.facebook.com/example/posts/66">2 ชม.</a>
              <div role="article">
                <button aria-label="แชร์">แชร์</button>
              </div>
            </div>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, SHARE_SHEET)
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/55", sharedUrl(page))
        }
    }

    @Test
    fun doesNotShareTheHomepageOrANeighborWhenTheTappedPostHasNoPermalink() {
        withPage("""
          <html lang="th"><head>
            <link rel="canonical" href="https://www.facebook.com/">
          </head><body>
            <article id="neighbor">
              <a href="https://www.facebook.com/example/posts/111">1 ชม.</a>
            </article>
            <article id="current">
              <a href="https://www.facebook.com/someone">name</a>
              <button id="share" aria-label="แชร์">แชร์</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, SHARE_SHEET)
            Unit
            assertNull(sharedUrl(page))
            assertTrue(logs(page).any { it.contains("context=FEED") && it.contains("permalinkSource=none") && it.contains("bridgeInvoked=false") })
        }
    }

    @Test
    fun usesTheCopyRowPermalinkWhenTheFeedCardDoesNotHaveOne() {
        withPage("""
          <html lang="th"><head></head><body>
            <article>
              <button id="share" aria-label="แชร์">แชร์</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, """
              <div role="dialog" id="share-sheet">
                <div id="copy-row" role="button" data-href="https://www.facebook.com/example/posts/44?fbclid=secret">
                  <span>คัดลอกลิงก์</span>
                </div>
              </div>
            """.trimIndent())
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/44", sharedUrl(page))
            assertTrue(logs(page).any { it.contains("permalinkSource=sheet-link") && it.contains("permalinkFound=true") })
        }
    }

    @Test
    fun insertsOnlyOneFeedShareRowWhenTheSheetMutates() {
        withPage("""
          <html lang="en"><head></head><body>
            <article>
              <a href="https://www.facebook.com/example/posts/123">1h</a>
              <button id="share" aria-label="Share">Share</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, """
              <div role="dialog" id="share-sheet"><div role="button"><span>Copy link</span></div></div>
            """.trimIndent())
            page.locator("#share-sheet").evaluate("element => element.insertAdjacentHTML('beforeend', '<span>extra</span>')")
            page.waitForTimeout(50.0)
            assertEquals(1, page.locator("[data-nobook-external-share]").count())
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/123", sharedUrl(page))
        }
    }

    @Test
    fun capturesPermalinkFromADescriptiveShareLabel() {
        withPage("""
          <html lang="th"><head></head><body>
            <article>
              <div data-lynx-uri="https://www.facebook.com/example/posts/515?fbclid=tracking">5 นาที</div>
              <div tabindex="0" id="share" aria-label="แชร์โพสต์นี้">แชร์</div>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, SHARE_SHEET)
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/515", sharedUrl(page))
        }
    }

    @Test
    fun usesTheOnlyPostLinkInsideTheShareSheet() {
        withPage("""
          <html lang="en"><head></head><body>
            <article>
              <button id="share" aria-label="Share this post">Share</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, """
              <div role="dialog" id="share-sheet">
                <a href="https://www.facebook.com/share/p/AbC123?fbclid=tracking">hidden</a>
                <div role="button"><span>Copy link</span></div>
              </div>
            """.trimIndent())
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/share/p/AbC123", sharedUrl(page))
            assertTrue(logs(page).any { it.contains("permalinkSource=sheet-link") && it.contains("permalinkFound=true") })
        }
    }

    @Test
    fun readsAPostUrlStoredOutsideTheAnchor() {
        withPage("""
          <html lang="th"><head></head><body>
            <article id="post" data-extra="https://www.facebook.com/example/posts/909?fbclid=tracking">
              <button id="share" aria-label="แชร์">แชร์</button>
            </article>
            <div role="dialog" id="comments" style="height:700px">
              <button>โพสต์</button><button>กลุ่ม</button>
            </div>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, """
              <div role="dialog" id="share-sheet" style="margin-top:640px">
                <div role="button"><span>ส่งใน Messenger</span></div>
                <div id="copy-row" role="button"><span>คัดลอกลิงก์</span></div>
              </div>
            """.trimIndent())
            assertEquals(1, page.locator("#share-sheet [data-nobook-external-share]").count())
            assertEquals(0, page.locator("#comments [data-nobook-external-share]").count())
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/909", sharedUrl(page))
        }
    }

    @Test
    fun findsPermalinkWhenThePostHasMoreThanOneShareControl() {
        withPage("""
          <html lang="th"><head></head><body>
            <article>
              <a href="https://www.facebook.com/example/posts/303?fbclid=tracking">1 ชม.</a>
              <div role="button" id="share" aria-label="แชร์">แชร์</div>
              <div role="button">2 แชร์</div>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, SHARE_SHEET)
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/303", sharedUrl(page))
        }
    }

    @Test
    fun hidesTheFloatingShareButtonWhenTheSheetCloses() {
        withPage("""
          <html lang="th"><head></head><body>
            <article>
              <a href="https://www.facebook.com/example/posts/44">1 ชม.</a>
              <button id="share" aria-label="แชร์">แชร์</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, """
              <div role="dialog" id="share-sheet">
                <div role="button"><span>แชร์ลิงก์</span></div>
              </div>
            """.trimIndent())
            assertEquals(1, page.locator("#share-sheet [data-nobook-external-share]").count())
            assertNull(sharedUrl(page))
            page.locator("article a").evaluate("element => element.removeAttribute('href')")
            page.locator("article a").click()
            page.waitForTimeout(50.0)
            assertEquals(0, page.locator("[data-nobook-external-share]").count())
            openSheet(page, """
              <div role="dialog" id="share-sheet-again">
                <div role="button"><span>แชร์ลิงก์</span></div>
              </div>
            """.trimIndent())
            page.locator("#share-sheet").evaluate("element => element.setAttribute('aria-hidden', 'true')")
            page.locator("#share-sheet-again").evaluate("element => element.setAttribute('aria-hidden', 'true')")
            page.waitForTimeout(400.0)
            assertEquals(0, page.locator("[data-nobook-external-share]").count())
            assertNull(sharedUrl(page))
        }
    }

    @Test
    fun findsPermalinkWhenShareControlIsOutsideTheTrackedPost() {
        withPage("""
          <html lang="th"><head></head><body>
            <div id="card">
              <div data-tracking-duration-id>
                <a href="https://www.facebook.com/example/posts/44?fbclid=tracking">1 ชม.</a>
              </div>
              <div data-tracking-duration-id>
                <button id="share" aria-label="แชร์">แชร์</button>
              </div>
            </div>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, SHARE_SHEET)
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/44", sharedUrl(page))
        }
    }

    @Test
    fun keepsFacebookRowsInTheOriginalSheet() {
        withPage("""
          <html lang="th"><head></head><body>
            <article>
              <button id="share" aria-label="แชร์">แชร์</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            val icon = "\uE001"
            openSheet(page, """
              <div role="dialog" id="share-sheet">
                <div role="button" id="whatsapp" aria-label="ส่งใน WhatsApp"><span>$icon</span><span>ส่งใน WhatsApp</span></div>
                <div id="copy-row" role="button"><span>แชร์ลิงก์</span></div>
              </div>
            """.trimIndent())
            assertEquals(0, page.locator("[data-nobook-share-menu]").count())
            assertEquals(0, page.locator("[data-nobook-share-forward]").count())
            assertTrue(page.locator("#whatsapp").textContent().orEmpty().contains("ส่งใน WhatsApp"))
            assertEquals("visible", page.locator("#share-sheet").evaluate("element => getComputedStyle(element).visibility"))
            assertEquals("", page.locator("#copy-row").evaluate("element => element.style.transform"))
            page.locator("#copy-row").click()
            assertEquals(null, sharedUrl(page))
        }
    }

    @Test
    fun leavesTheFacebookSheetOpenForItsOwnActions() {
        withPage("""
          <html lang="th"><head></head><body>
            <article>
              <button id="share" aria-label="แชร์">แชร์</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, """
              <div role="dialog" id="share-sheet">
                <div role="button"><span>แชร์ลิงก์</span></div>
              </div>
            """.trimIndent())
            assertEquals(0, page.locator("[data-nobook-external-share]").count())
            assertEquals(0, page.locator("[data-nobook-share-menu]").count())
            assertEquals("visible", page.locator("#share-sheet").evaluate("element => getComputedStyle(element).visibility"))
            assertEquals("block", page.locator("#share-sheet").evaluate("element => getComputedStyle(element).display"))
        }
    }

    @Test
    fun placesExternalShareBeforeShareLinkWithoutCoveringIt() {
        withPage("""
          <html lang="th"><head></head><body>
            <article>
              <button id="share" aria-label="แชร์">แชร์</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, """
              <div role="dialog" id="share-sheet" style="margin-top:420px">
                <div id="copy-row" role="button" data-href="https://www.facebook.com/example/posts/44?fbclid=secret">
                  <span>แชร์ลิงก์</span>
                </div>
              </div>
            """.trimIndent())
            assertEquals(1, page.locator("[data-nobook-external-share]").count())
            assertEquals(
                "copy-row",
                page.locator("[data-nobook-external-share]").evaluate("element => element.nextElementSibling.id")
            )
            assertEquals("", page.locator("#copy-row").evaluate("element => element.style.transform"))
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/44", sharedUrl(page))
        }
    }

    @Test
    fun sharesWhenTheFeedSheetSitsUnderAHiddenPage() {
        withPage("""
          <html lang="th"><head></head><body>
            <div aria-hidden="true">
              <article>
                <a href="https://www.facebook.com/example/posts/77">1 ชม.</a>
                <button id="share" aria-label="แชร์">แชร์</button>
              </article>
            </div>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, """
              <div aria-hidden="true">
                <div role="dialog" id="share-sheet">
                  <div role="button"><span>แชร์ลิงก์</span></div>
                </div>
              </div>
            """.trimIndent())
            page.waitForTimeout(300.0)
            assertEquals(0, page.locator("[data-nobook-external-share]").count())
            assertNull(sharedUrl(page))
            assertTrue(logs(page).any { it.contains("bridgeInvoked=false") && it.contains("permalinkFound=true") })
        }
    }

    @Test
    fun feedShareUsesTheOpenPostUrlTheSameWayAsAReel() {
        Playwright.create().use { playwright ->
            playwright.chromium().launch().use { browser ->
                val page = browser.newPage()
                page.route("https://www.facebook.com/example/posts/77") { route ->
                    route.fulfill(
                        Route.FulfillOptions()
                            .setContentType("text/html")
                            .setBody("""
                              <html lang="th"><head><meta charset="utf-8"></head><body>
                                <button id="share" aria-label="แชร์">แชร์</button>
                                <main id="dialogs"></main>
                              </body></html>
                            """.trimIndent())
                    )
                }
                page.navigate("https://www.facebook.com/example/posts/77")
                installScript(page)
                page.locator("#share").click()
                openSheet(page, """
                  <div role="dialog" id="share-sheet">
                    <div role="button"><span>แชร์ลิงก์</span></div>
                  </div>
                """.trimIndent())
                clickFeedShare(page)
                assertEquals("https://www.facebook.com/example/posts/77", sharedUrl(page))
                assertTrue(logs(page).any { it.contains("context=FEED") && it.contains("permalinkSource=post-location") && it.contains("permalinkFound=true") })
            }
        }
    }

    @Test
    fun detectsUnlabelledMobileShareSheetFromItsActions() {
        withPage("""
          <html lang="en"><body>
            <article>
              <a href="https://www.facebook.com/example/posts/909">1 hr</a>
              <button id="share" aria-label="Share">Share</button>
            </article>
            <main id="dialogs"></main>
          </body></html>
        """.trimIndent()) { page ->
            page.locator("#share").click()
            openSheet(page, """
              <section id="share-sheet">
                <div role="button"><span>Messenger</span></div>
                <div role="button"><span>Copy link</span></div>
              </section>
            """.trimIndent())

            assertEquals(1, page.locator("#share-sheet [data-nobook-external-share]").count())
            clickFeedShare(page)
            assertEquals("https://www.facebook.com/example/posts/909", sharedUrl(page))
        }
    }

    @Test
    fun reelShareStillUsesTheOpenReelUrl() {
        Playwright.create().use { playwright ->
            playwright.chromium().launch().use { browser ->
                val page = browser.newPage()
                page.route("https://www.facebook.com/reel/55") { route ->
                    route.fulfill(
                        Route.FulfillOptions()
                            .setContentType("text/html")
                            .setBody("""
                              <html lang="th"><head></head><body>
                                <main id="dialogs"></main>
                              </body></html>
                            """.trimIndent())
                    )
                }
                page.navigate("https://www.facebook.com/reel/55")
                installScript(page)
                openSheet(page, """
                  <div role="dialog" id="share-sheet">
                    <div role="button"><span>คัดลอกลิงก์</span></div>
                    <div role="button"><span>WhatsApp</span></div>
                  </div>
                """.trimIndent())
                val item = page.locator("[data-nobook-external-share]")
                assertEquals("body", item.evaluate("element => element.parentElement.tagName.toLowerCase()"))
                item.click()
                assertEquals("https://www.facebook.com/reel/55", sharedUrl(page))
                assertTrue(logs(page).any { it.contains("context=REEL") && it.contains("permalinkSource=reel-location") && it.contains("bridgeInvoked=true") })
            }
        }
    }

    private fun withPage(html: String, check: (Page) -> Unit) {
        Playwright.create().use { playwright ->
            playwright.chromium().launch().use { browser ->
                val page = browser.newPage()
                page.setContent(html)
                installScript(page)
                check(page)
            }
        }
    }

    private fun installScript(page: Page) {
        page.evaluate(
            """
            window.sharedUrl = null;
            window.feedShareUrl = null;
            window.shareLogs = [];
            console.log = (...args) => window.shareLogs.push(args.join(' '));
            window.ShareBridge = {
              shareUrl: url => window.sharedUrl = url,
              shareClipboardUrl: () => { window.clipboardShareRequested = true; },
              setFeedShare: url => {
                window.feedShareUrl = url;
                window.sharedUrl = url;
              },
              hideFeedShare: () => { window.feedShareUrl = null; }
            };
            window.isDesktopMode = () => false;
            """.trimIndent()
        )
        page.evaluate(File("src/main/res/raw/scripts.js").readText())
    }

    private fun openSheet(page: Page, sheet: String) {
        page.locator("#dialogs").evaluate(
            "(element, html) => element.insertAdjacentHTML('beforeend', html)",
            sheet
        )
        page.waitForTimeout(100.0)
    }

    private fun sharedUrl(page: Page): String? = page.evaluate("window.sharedUrl") as String?

    private fun clickFeedShare(page: Page) {
        val item = page.locator("[data-nobook-external-share]")
        assertEquals(1, item.count())
        item.click()
    }

    @Suppress("UNCHECKED_CAST")
    private fun logs(page: Page): List<String> =
        (page.evaluate("window.shareLogs") as List<String>)

    companion object {
        private const val SHARE_SHEET = """
          <div role="dialog" id="share-sheet">
            <div role="button"><span>Copy link</span></div>
          </div>
        """
    }
}
