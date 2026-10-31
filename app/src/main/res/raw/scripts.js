
// desktop mode identifier
(() => {
    window.isDesktopMode = () => {
        return document.querySelector('html[id="facebook"]') !== null;
    }
})();

// Feed identifier
(() => {
    window.isFeed = () => {
        const isHomeUrl = window.location.pathname === '/' &&
            (window.location.hostname === 'm.facebook.com' || window.location.hostname === 'www.facebook.com');

        if (window.isDesktopMode()) return isHomeUrl;

        const hasSpecialButton = Array.from(document.querySelectorAll('[role="button"] span'))
            .some(span => span.textContent === '󱥆');

        return isHomeUrl && hasSpecialButton;
    };
})();





(function() {
    if (!window.isDesktopMode()) return;

    // do not stick the navbar by default
    (() => {
      const waitForBanner = () => new Promise(resolve => {
        const existing = document.querySelector('div[role="banner"]');
        if (existing) return resolve(existing);

        new MutationObserver((mutations, obs) => {
          for (const { addedNodes } of mutations) {
            for (const node of addedNodes) {
              if (node.nodeType === 1 && node.matches('div[role="banner"]')) {
                obs.disconnect();
                return resolve(node);
              }
            }
          }
        }).observe(document.body, { childList: true, subtree: true });
      });

      const forceAbsolute = el => {
        if (el?.classList.contains('xixxii4')) {
          el.style.setProperty('position', 'absolute', 'important');
        }
      };

      waitForBanner().then(banner => {
        const style = document.createElement('style');
        style.textContent = `
          div[role="banner"].xixxii4,
          div[role="banner"] .xixxii4 {
            position: absolute !important;
          }
        `;
        document.head.appendChild(style);

        forceAbsolute(banner);
        banner.querySelectorAll('.xixxii4').forEach(forceAbsolute);

        new MutationObserver(mutations => {
          for (const m of mutations) {
            if (m.type === 'childList') {
              m.addedNodes.forEach(n => {
                forceAbsolute(n);
                n.querySelectorAll?.('.xixxii4')?.forEach(forceAbsolute);
              });
            } else if (m.type === 'attributes' && m.attributeName === 'class') {
              forceAbsolute(m.target);
            }
          }
        }).observe(banner, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      });
    })();


    // remove "send" button to save space
    // remove the third element in the interaction bar if nb is 4
    (function() {
      const parentSelector = '.xbmvrgn.x1diwwjn';
      const childSelector = '.x10b6aqq.x1yrsyyn.xs83m0k';

      function checkAndRemoveThird(parent) {
        const children = parent.querySelectorAll(childSelector);
        if (children.length === 4) children[2].remove();
      }

      document.querySelectorAll(parentSelector).forEach(checkAndRemoveThird);

      const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
              if (node.matches(parentSelector)) {
                checkAndRemoveThird(node);
              }
              node.querySelectorAll(parentSelector).forEach(checkAndRemoveThird);
            }
          });
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    })();
})();


// Scroll to top on back-press at feed.
(() => {
    window.backHandlerNB = () => {

        const dialogs = document.querySelectorAll('div[role="dialog"]');
        const isMenu = document.querySelector('div[role="menu"]')

        function scrollToTop() {
            if (window.scrollY !== 0) {
              // to interrupt any current scroll event.
              document.body.style.overflow = 'hidden';
              setTimeout(() => {
                 document.body.style.overflow = '';
                 window.scrollTo({ top: 0, behavior: 'smooth' });
              }, 30);
              return "scrolling";
           } else return "exit";
        }

        if (window.isDesktopMode()) {
            if (window.isFeed() && !isMenu && dialogs.length === 1)
                return scrollToTop();
            else if (isMenu || dialogs.length > 1) {
                const escapeEvent = new KeyboardEvent('keydown', {
                    key: 'Escape',
                    code: 'Escape',
                    keyCode: 27,
                    which: 27,
                    bubbles: true,
                    cancelable: true
                });
                window.dispatchEvent(escapeEvent);
                return "true";
            } else return "false"
        } else if (window.isFeed() && !isMenu && !dialogs.length) {
            return scrollToTop();
        } else return "false";
    }
})();

// Enable native press-and-hold selection for Feed post body text only.
(() => {
  if (window.__nobookFeedTextSelection) return;
  window.__nobookFeedTextSelection = true;

  const SELECTABLE_CLASS = 'nobook-feed-text-selectable';
  const TEXT_AREA = 'div[data-mcomponent="TextArea"][data-type="text"]';
  const POST = 'article, [role="article"], [data-type="vscroller"] > [data-tracking-duration-id]';
  const NON_FEED = '[role="dialog"], [data-reel-container], [data-story-container], ' +
    '[data-pagelet*="Reel"], [data-pagelet*="Story"], .vertically-snappable';
  const CHROME = 'nav, header, footer, [role="toolbar"], [data-type="transactional"], ' +
    '[data-ad-rendering-role="profile_name"], [data-ad-rendering-role="metadata"]';
  const CONTROL = 'a, button, [role="button"], [role="link"]';
  const LONG_PRESS_MS = 480;
  const MOVE_PX = 10;
  const logged = new WeakSet();
  let press = null;
  let suppressContextMenuUntil = 0;

  const onFacebookSurface = () => document.body?.dataset.nobookTestFeed === 'true' ||
    /(^|\.)facebook\.com$/.test(location.hostname || '');

  // Only treat explicit chrome/metadata roles as non-copyable. Real m.facebook.com
  // post bodies are also wrapped in focusable MContainer, so that heuristic rejects posts.
  const isMetadata = (area) => Boolean(area.closest(CHROME));

  const isNestedArticle = (area) => {
    const post = area.closest(POST);
    return Boolean(
      post?.matches?.('article, [role="article"]') &&
      post.parentElement?.closest('article, [role="article"]')
    );
  };

  const isPostBody = (area) => {
    if (!onFacebookSurface() || area.closest(NON_FEED) || isMetadata(area)) return false;
    if (area.closest('a, [role="link"]')) return false;
    const post = area.closest(POST);
    if (!post) return false;
    if (isNestedArticle(area)) return false;
    return true;
  };

  const isCommentBody = (area) => {
    if (!onFacebookSurface() || area.closest(NON_FEED) || isMetadata(area)) return false;
    if (area.closest('a, [role="link"]')) return false;
    if (!area.closest(POST)) return false;
    return isNestedArticle(area);
  };

  const isCopyableBody = (area) => isPostBody(area) || isCommentBody(area);

  const logState = (element, marked) => {
    if (logged.has(element)) return;
    logged.add(element);
    const computed = getComputedStyle(element);
    console.log(
      `[NobookTextSelection] detected=true marked=${marked} ` +
      `userSelect=${computed.userSelect} webkitUserSelect=${computed.webkitUserSelect} ` +
      `pointerEvents=${computed.pointerEvents}`
    );
  };

  const paint = (element) => {
    element.classList.add(SELECTABLE_CLASS);
    element.style.setProperty('user-select', 'text', 'important');
    element.style.setProperty('-webkit-user-select', 'text', 'important');
    element.style.setProperty('-webkit-touch-callout', 'default', 'important');
    if (getComputedStyle(element).pointerEvents === 'none') {
      element.style.setProperty('pointer-events', 'auto', 'important');
    }
  };

  const textTargets = (area) => {
    const natives = Array.from(area.querySelectorAll('.native-text'));
    const roots = natives.length ? natives : [area];
    const targets = new Set([area, ...roots]);
    roots.forEach(root => {
      root.querySelectorAll('span').forEach(span => {
        const control = span.closest(CONTROL);
        if (control && root.contains(control)) return;
        targets.add(span);
      });
    });
    return targets;
  };

  const makeSelectable = (area) => {
    if (logged.has(area)) return;
    if (!isCopyableBody(area)) {
      logState(area, false);
      return;
    }
    textTargets(area).forEach(paint);
    logState(area.querySelector('.native-text') || area, true);
    logged.add(area);
  };

  const selectionStyle = document.createElement('style');
  selectionStyle.textContent = `
    html .${SELECTABLE_CLASS},
    html .${SELECTABLE_CLASS} .native-text,
    html .${SELECTABLE_CLASS} .native-text span {
      user-select: text !important;
      -webkit-user-select: text !important;
      -webkit-touch-callout: default !important;
    }
    html .${SELECTABLE_CLASS} :is(a, button, [role="button"], [role="link"]),
    html .${SELECTABLE_CLASS} :is(a, button, [role="button"], [role="link"]) * {
      user-select: none !important;
      -webkit-user-select: none !important;
    }
    html .${SELECTABLE_CLASS}::selection,
    html .${SELECTABLE_CLASS} *::selection {
      background: #ccc;
      color: black;
    }
  `;
  (document.head || document.documentElement).appendChild(selectionStyle);

  const extractFeedText = (area) => {
    if (!(area instanceof Element)) return '';
    const clone = area.cloneNode(true);
    clone.querySelectorAll?.(
      'button, [role="button"], script, style, textarea, input, [contenteditable="true"]'
    ).forEach(node => node.remove());
    const raw = (clone.innerText || clone.textContent || '')
      .replace(/\u200b/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return raw;
  };

  const resolveCopyArea = (target) => {
    if (!(target instanceof Element)) return null;
    const area = target.closest(TEXT_AREA);
    if (!area || !isCopyableBody(area)) return null;
    // Ignore See more / links inside the text. Outer FB role=button wrappers are OK.
    const control = target.closest('a, button, [role="button"], [role="link"]');
    if (control && area.contains(control)) return null;
    return area;
  };

  const copyAllText = (area) => {
    const text = extractFeedText(area);
    if (!text) return false;
    if (typeof window.ClipboardBridge?.copyText === 'function') {
      window.ClipboardBridge.copyText(text);
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      return false;
    }
    window.getSelection()?.removeAllRanges?.();
    suppressContextMenuUntil = Date.now() + 800;
    window.__nobookLastCopiedFeedText = text;
    return true;
  };

  const clearPress = () => {
    if (press?.timer) clearTimeout(press.timer);
    press = null;
  };

  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const area = resolveCopyArea(event.target);
    if (!area) return;
    clearPress();
    const pointerId = event.pointerId;
    press = {
      area,
      pointerId,
      x: event.clientX,
      y: event.clientY,
      fired: false,
      timer: setTimeout(() => {
        if (!press || press.pointerId !== pointerId) return;
        press.fired = true;
        copyAllText(press.area);
        clearPress();
      }, LONG_PRESS_MS)
    };
  }, true);

  document.addEventListener('pointermove', event => {
    if (!press || press.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (distance > MOVE_PX) clearPress();
  }, true);

  document.addEventListener('pointerup', clearPress, true);
  document.addEventListener('pointercancel', clearPress, true);
  document.addEventListener('contextmenu', event => {
    if (Date.now() <= suppressContextMenuUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.__nobookExtractFeedText = extractFeedText;
  window.__nobookCopyFeedText = copyAllText;

  const process = (root) => {
    if (root instanceof Element && root.matches(TEXT_AREA)) makeSelectable(root);
    root.querySelectorAll?.(TEXT_AREA).forEach(makeSelectable);
  };

  const watch = () => {
    process(document);
    new MutationObserver(mutations => mutations.forEach(mutation =>
      mutation.addedNodes.forEach(node => {
        if (node instanceof Element) {
          process(node);
          window.__nobookProcessShareRoot?.(node);
        }
      })
    )).observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  if (document.body) watch();
  else document.addEventListener('DOMContentLoaded', watch, { once: true });
})();

// Add Android's native chooser to Facebook's internal share sheet.
(() => {
  if (window.__nobookExternalShare) return;
  window.__nobookExternalShare = true;

  const ITEM_ATTRIBUTE = 'data-nobook-external-share';
  const POST = 'article, [role="article"], [data-tracking-duration-id]';
  const ROW_SELECTOR = 'button, [role="button"], a, [role="link"], [data-focusable="true"], [data-mcomponent="MContainer"]';
  const CONTROL_SELECTOR = `${ROW_SELECTOR}, [tabindex]`;
  const POST_PATH = /\/(?:posts|permalink|story\.php|photo(?:s)?|videos?|reel|watch|share\/[pvr])\b/i;
  const STRONG_PATH = /\/(?:posts\/|permalink|story\.php|share\/[pvr]\b)/i;
  const COPY_LABELS = new Set([
    'copy link', 'share link', 'คัดลอกลิงก์', 'คัดลอกลิ้งค์',
    'แชร์ลิงก์', 'แชร์ลิงค์', 'แชร์ลิ้งก์'
  ]);
  const OPTION_LABELS = new Set([
    ...COPY_LABELS, 'messenger', 'whatsapp', 'share to facebook', 'message',
    'แชร์ไปยัง facebook', 'แชร์ไปยังโปรไฟล์ของเพื่อน', 'แชร์ในกลุ่ม',
    'ส่งเป็นข้อความ', 'ส่งใน whatsapp', 'ส่งใน messenger', 'ข้อความ',
    'โพสต์', 'กลุ่ม', 'โปรไฟล์ของเพื่อน'
  ]);
  let pendingPermalink = null;
  let pendingFeedShare = null;
  let activeFeedSheet = null;
  let activeFeedCopyRow = null;
  let feedSheetActive = false;
  let feedShareInvoked = false;
  let sheetMissingSince = 0;
  let sheetMissingGesture = -1;
  let sheetWatch = 0;
  let surfaceSerial = 0;
  let shareGesture = 0;
  let dismissedGesture = -1;
  let lastFeedLocation = location.href;
  let sharePointer = false;
  const MENU_FONT = '"Noto Sans Thai", "Leelawadee UI", "Sarabun", sans-serif';

  const normalize = text => (text || '').normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ').trim().toLocaleLowerCase();

  const sanitizeFacebookUrl = (value, unwrapping = false) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, location.href);
      const host = url.hostname.toLocaleLowerCase();
      const redirect = url.searchParams.get('u') || url.searchParams.get('next');
      if (!unwrapping && redirect && (
          host === 'l.facebook.com' || host === 'lm.facebook.com' ||
          /\/l\.php$/i.test(url.pathname) || url.pathname.toLocaleLowerCase().startsWith('/login'))) {
        return sanitizeFacebookUrl(redirect, true);
      }
      if (url.protocol !== 'https:' ||
          !(host === 'facebook.com' || host.endsWith('.facebook.com')) ||
          host === 'l.facebook.com' || host === 'lm.facebook.com' ||
          !POST_PATH.test(url.pathname)) return null;
      const allowed = new Set(['story_fbid', 'id', 'fbid', 'set', 'type', 'v']);
      Array.from(url.searchParams.keys()).forEach(key => {
        if (!allowed.has(key)) url.searchParams.delete(key);
      });
      url.hash = '';
      return url.toString();
    } catch (_) {
      return null;
    }
  };

  const urlFromElement = element => {
    if (!element?.getAttribute) return null;
    const values = [
      element.href,
      element.getAttribute('href'),
      element.getAttribute('data-href'),
      element.getAttribute('data-url'),
      element.getAttribute('data-lynx-href')
    ];
    for (const value of values) {
      const direct = sanitizeFacebookUrl(value);
      if (direct) return direct;
    }
    const stored = element.getAttribute('data-ft') || element.getAttribute('data-store');
    if (!stored) return null;
    try {
      const data = JSON.parse(stored);
      const story = data.top_level_post_id || data.story_fbid || data.fbid;
      const owner = data.content_owner_id_new || data.page_id || data.id;
      if (story && owner) {
        return sanitizeFacebookUrl(
          `https://www.facebook.com/permalink.php?story_fbid=${story}&id=${owner}`
        );
      }
    } catch (_) {}
    return null;
  };

  const shareContext = () => /\/reels?(?:\/|$)/i.test(location.pathname) ? 'REEL' : 'FEED';

  const logShare = fields => {
    const line =
      `[NoBookShare] context=${fields.context} shareSheetDetected=${fields.shareSheetDetected} ` +
      `shareSheetVisible=${fields.shareSheetVisible === true} ` +
      `customItemInserted=${fields.customItemInserted} customItemClicked=${fields.customItemClicked === true} ` +
      `pendingTargetPresent=${fields.pendingTargetPresent === true} ` +
      `permalinkFound=${fields.permalinkFound} permalinkSource=${fields.permalinkSource} ` +
      `urlValidated=${fields.urlValidated === true} bridgeAvailable=${fields.bridgeAvailable === true} ` +
      `bridgeInvoked=${fields.bridgeInvoked} action=${fields.action || 'ignore'}`;
    console.log(line);
    window.ShareBridge?.report?.(line);
  };

  const bridgeReady = () => typeof window.ShareBridge?.shareUrl === 'function';
  const clipboardBridgeReady = () =>
    typeof window.ShareBridge?.shareClipboardUrl === 'function';

  const copyLinkThroughFacebook = surface => {
    if (!surface || !clipboardBridgeReady()) return false;
    const copy = labeledNodes(surface).find(item => COPY_LABELS.has(item.label));
    const row = copy ? rowOf(copy.element) : null;
    if (!row) return false;
    row.click();
    setTimeout(() => window.ShareBridge?.shareClipboardUrl?.(), 50);
    return true;
  };

  const labeledNodes = surface => {
    const found = [];
    surface.querySelectorAll('span, div, a, button, [role="button"]').forEach(element => {
      if (element.closest(`[${ITEM_ATTRIBUTE}]`)) return;
      const aria = normalize(element.getAttribute('aria-label'));
      if (aria) found.push({ element, label: aria });
      if (element.childElementCount === 0) {
        const text = normalize(element.textContent);
        if (text) found.push({ element, label: text });
      }
    });
    return found;
  };

  const isOptionLabel = label => OPTION_LABELS.has(label) ||
    label.includes('whatsapp') || label.includes('messenger') || label.startsWith('ส่ง');

  const isAvailable = element => {
    if (!(element instanceof Element) || !element.isConnected) return false;
    if (element.getAttribute('aria-hidden') === 'true' || element.hasAttribute('hidden')) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 40 && rect.height > 16;
  };

  const findShareSurface = root => {
    const surfaces = new Set();
    const selector = '[role="dialog"], [role="menu"], [aria-modal="true"], [data-mcomponent="MScreen"]';
    if (root instanceof Element) {
      if (root.matches(selector)) surfaces.add(root);
      const closest = root.closest(selector);
      if (closest) surfaces.add(closest);
    }
    root.querySelectorAll?.(selector).forEach(surface => surfaces.add(surface));
    // Facebook sometimes ships its mobile share sheet without dialog/menu semantics.
    // Starting from a known share action keeps this fallback scoped to the open sheet.
    if (shareGesture > 0) {
      root.querySelectorAll?.('span, div, a, button, [role="button"]').forEach(element => {
        const label = normalize(element.getAttribute?.('aria-label') ||
          (element.childElementCount === 0 ? element.textContent : ''));
        if (!isOptionLabel(label)) return;
        let candidate = element.parentElement;
        for (let depth = 0; candidate && candidate !== document.body && depth < 8;
            depth += 1, candidate = candidate.parentElement) {
          if (!isAvailable(candidate)) continue;
          const optionCount = labeledNodes(candidate)
            .filter(item => isOptionLabel(item.label)).length;
          if (optionCount >= 2) {
            surfaces.add(candidate);
            break;
          }
        }
      });
    }
    const matches = Array.from(surfaces).filter(surface => {
      if (!isAvailable(surface)) return false;
      const labels = labeledNodes(surface).map(item => item.label);
      return labels.some(label => COPY_LABELS.has(label) ||
        label.includes('whatsapp') || label.includes('messenger') ||
        label.includes('ส่งใน') || label.includes('ส่งเป็นข้อความ') ||
        label.includes('share to facebook') || label.includes('แชร์ไปยัง facebook') ||
        label === 'share to a group' || label === 'แชร์ในกลุ่ม');
    });
    matches.sort((left, right) =>
      left.getBoundingClientRect().top - right.getBoundingClientRect().top
    );
    return matches[matches.length - 1] || null;
  };

  const pickUrl = urls => {
    const unique = Array.from(new Set(urls.filter(Boolean)));
    const strong = unique.filter(url => urlRank(url) > 1);
    return strong.find(url => /\/posts\/|permalink|story\.php|\/share\/[pvr]/i.test(url)) ||
      (strong.length === 1 ? strong[0] : null) ||
      (unique.length === 1 ? unique[0] : null);
  };

  const urlsFromHtml = html => {
    const text = String(html || '').slice(0, 400000).replace(/\\\//g, '/');
    const found = [];
    const add = raw => {
      const url = sanitizeFacebookUrl(raw);
      if (url && !found.includes(url)) found.push(url);
    };
    for (const match of text.matchAll(/https?:\/\/(?:[\w.-]+\.)?facebook\.com\/[^\s"'<>]+/gi)) add(match[0]);
    for (const match of text.matchAll(/\/(?:[\w.-]+\/){0,6}(?:posts|permalink\.php|story\.php|photos?(?:\.php)?|videos?|reel|watch|share\/[pvr])[^\s"'<>]*/gi)) {
      add(match[0]);
    }
    const story = text.match(/story_fbid["'=:\s]+(pfbid[A-Za-z0-9]+|\d+)/i);
    const owner = text.match(/(?:content_owner_id_new|page_id|owner_id)["'=:\s]+(\d{5,})/i);
    if (story && owner) add(`https://www.facebook.com/permalink.php?story_fbid=${story[1]}&id=${owner[1]}`);
    const pfbid = text.match(/pfbid[A-Za-z0-9]{8,}/);
    if (pfbid) add(`https://www.facebook.com/story.php?story_fbid=${pfbid[0]}`);
    return found;
  };

  const urlRank = url => STRONG_PATH.test(new URL(url).pathname) ? 2 : 1;

  const looksLikeTimestamp = text => text.length > 0 && text.length <= 24 &&
    (/\d/.test(text) || /ชม|นาที|วัน|ชั่วโมง/.test(text));

  const LINK_ATTRIBUTES = ['href', 'data-href', 'data-url', 'data-lynx-href', 'data-lynx-uri', 'ajaxify'];

  const urlsIn = root => {
    if (!root?.querySelectorAll) return [];
    const found = [];
    const push = (url, element) => {
      if (!url || found.some(item => item.url === url)) return;
      const text = normalize(element?.textContent);
      found.push({ url, rank: urlRank(url), timestamp: looksLikeTimestamp(text) });
    };
    root.querySelectorAll('a[href], [data-href], [data-url], [data-lynx-href], [data-lynx-uri], [ajaxify], [data-ft], [data-store]')
      .forEach(element => {
        if (element.closest(`[${ITEM_ATTRIBUTE}]`)) return;
        push(urlFromElement(element), element);
        LINK_ATTRIBUTES.forEach(name => {
          const raw = element.getAttribute(name);
          if (!raw) return;
          push(sanitizeFacebookUrl(raw), element);
          push(sanitizeFacebookUrl(raw.replace(/\\\//g, '/')), element);
        });
      });
    return found.sort((left, right) =>
      (right.rank - left.rank) || (Number(right.timestamp) - Number(left.timestamp))
    );
  };

  const singleStrongUrl = root => {
    const found = urlsIn(root);
    const strong = found.filter(item => item.rank > 1);
    if (strong.length === 1) return strong[0].url;
    if (strong.length > 1) return strong.find(item => item.timestamp)?.url || null;
    return found.length === 1 ? found[0].url : null;
  };

  const permalinkFromPost = post => {
    if (!post) return null;
    const reactUrl = urlFromReactNode(post);
    return pickUrl(
      urlsIn(post).map(item => item.url)
        .concat(urlsFromHtml(post.outerHTML))
        .concat(reactUrl || [])
    );
  };

  const urlFromReactNode = root => {
    const keys = ['href', 'url', 'uri', 'permalink', 'shareUrl', 'share_url', 'canonicalUrl', 'story_permalink'];
    const seen = new Set();
    const queue = [];
    const pushNode = value => {
      if (!value || typeof value !== 'object' || seen.has(value) || queue.length > 40) return;
      seen.add(value);
      queue.push(value);
    };
    if (root instanceof Element) {
      Object.keys(root).forEach(name => {
        if (name.startsWith('__reactFiber') || name.startsWith('__reactProps') ||
            name.startsWith('__reactInternalInstance')) pushNode(root[name]);
      });
    }
    const found = [];
    let steps = 0;
    while (queue.length && steps < 40) {
      const node = queue.shift();
      steps += 1;
      const props = node.memoizedProps || node.pendingProps || node;
      keys.forEach(key => {
        const url = sanitizeFacebookUrl(props?.[key]);
        if (url && !found.includes(url)) found.push(url);
      });
      pushNode(node.return);
      pushNode(node.child);
    }
    return pickUrl(found);
  };

  const permalinkFromCopyRow = surface => {
    const copy = labeledNodes(surface).find(item => COPY_LABELS.has(item.label));
    if (!copy) return null;
    let node = copy.element;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      const url = permalinkFromPost(node) || urlFromReactNode(node);
      if (url) return url;
      if (node === surface) break;
    }
    return null;
  };

  const postBehindSheet = surface => {
    const sheetTop = surface.getBoundingClientRect().top;
    let best = null;
    let bestTop = -Infinity;
    document.querySelectorAll(POST).forEach(post => {
      const rect = post.getBoundingClientRect();
      if (rect.height < 40 || rect.bottom < 0 || rect.top > sheetTop) return;
      if (rect.top > bestTop) {
        bestTop = rect.top;
        best = post;
      }
    });
    return best;
  };

  const choosePermalink = surface => {
    if (pendingPermalink?.url) return pendingPermalink;
    if (pendingPermalink?.post) {
      const savedPost = permalinkFromPost(pendingPermalink.post);
      if (savedPost) return { url: savedPost, source: 'feed-post' };
    } else if (shareContext() === 'FEED') {
      const visiblePost = permalinkFromPost(postBehindSheet(surface));
      if (visiblePost) return { url: visiblePost, source: 'feed-post' };
    }
    const sheetUrl = surface ? (permalinkFromCopyRow(surface) || pickUrl(urlsFromHtml(surface.outerHTML))) : null;
    if (sheetUrl) return { url: sheetUrl, source: 'sheet-link' };
    const located = sanitizeFacebookUrl(location.href);
    if (located) return { url: located, source: shareContext() === 'REEL' ? 'reel-location' : 'post-location' };
    return null;
  };

  const opaqueBackground = element => {
    for (let node = element; node; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match || (match[4] !== undefined && Number(match[4]) === 0)) continue;
      const [red, green, blue] = match.slice(1, 4).map(Number);
      return {
        css: color,
        luminance: (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
      };
    }
    return { css: 'rgb(36, 37, 38)', luminance: 0.1 };
  };

  const rowOf = element => {
    let row = element.closest(ROW_SELECTOR);
    while (row?.parentElement?.matches('button, [role="button"], a')) row = row.parentElement;
    return row;
  };

  const isShareControlLabel = label => {
    if (!label || label.length > 80) return false;
    if (label.includes('แอปอื่น') || label.includes('other apps')) return false;
    if (label.includes('แชร์ไปยัง') || label.includes('share to')) return false;
    if (COPY_LABELS.has(label) || label.includes('ลิงก์') || label.includes('ลิงค์') || label.includes('ลิ้งก์')) return false;
    if (label.includes('whatsapp') || label.includes('messenger')) return false;
    if (label === 'share' || label === 'แชร์') return true;
    if (label.startsWith('share') || label.startsWith('แชร์')) return true;
    if (/(^|[\s])(?:share|แชร์)(?:$|[\s])/.test(label)) return true;
    return label.endsWith('share') || label.endsWith('แชร์');
  };

  const enclosingPost = node => {
    const direct = node.closest?.(POST);
    if (direct && permalinkFromPost(direct)) return direct;
    let current = node.parentElement;
    let scoped = null;
    for (let depth = 0; current && current !== document.body && depth < 40; depth += 1, current = current.parentElement) {
      if (current.querySelectorAll('article, [role="article"]').length > 1) break;
      const urls = urlsIn(current).map(item => item.url).concat(urlsFromHtml(current.outerHTML));
      const strong = Array.from(new Set(urls)).filter(url => urlRank(url) > 1);
      if (strong.length > 1) break;
      if (pickUrl(urls)) scoped = current;
    }
    return scoped;
  };

  const urlsInElement = element => urlsIn(element).map(item => item.url).concat(urlsFromHtml(element.outerHTML));

  const permalinkNear = node => {
    const direct = permalinkFromPost(enclosingPost(node));
    if (direct) return direct;
    let card = node;
    for (let depth = 0; card && card !== document.body && depth < 8; depth += 1, card = card.parentElement) {
      const parts = [];
      let sibling = card.previousElementSibling;
      for (let guard = 0; sibling && guard < 6; guard += 1, sibling = sibling.previousElementSibling) {
        if (sibling.matches?.('article, [role="article"]') || sibling.querySelector?.('article, [role="article"]')) break;
        parts.push(sibling);
      }
      const url = pickUrl(parts.flatMap(urlsInElement));
      if (url) return url;
      if (card.parentElement?.querySelectorAll?.('article, [role="article"]').length > 1) break;
    }
    return null;
  };

  const createShareButton = (label, textColor) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute(ITEM_ATTRIBUTE, 'true');
    item.setAttribute('aria-label', label);
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '24');
    icon.setAttribute('height', '24');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z');
    icon.appendChild(path);
    const text = document.createElement('span');
    text.textContent = label;
    item.append(icon, text);
    item.style.setProperty('display', 'flex', 'important');
    item.style.setProperty('align-items', 'center', 'important');
    item.style.setProperty('gap', '12px', 'important');
    item.style.setProperty('box-sizing', 'border-box', 'important');
    item.style.setProperty('min-height', '48px', 'important');
    item.style.setProperty('margin', '0', 'important');
    item.style.setProperty('padding', '12px 16px', 'important');
    item.style.setProperty('border', '0', 'important');
    item.style.setProperty('pointer-events', 'auto', 'important');
    item.style.setProperty('touch-action', 'manipulation', 'important');
    item.style.setProperty('text-align', 'left', 'important');
    paintMenuText(item, textColor);
    paintMenuText(text, textColor);
    item.style.setProperty('cursor', 'pointer', 'important');
    return item;
  };

  const paintMenuText = (element, textColor) => {
    element.style.setProperty('color', textColor, 'important');
    element.style.setProperty('-webkit-text-fill-color', textColor, 'important');
    element.style.setProperty('font-family', MENU_FONT, 'important');
    element.style.setProperty('font-size', '16px', 'important');
    element.style.setProperty('font-weight', '600', 'important');
    element.style.setProperty('font-style', 'normal', 'important');
    element.style.setProperty('line-height', '24px', 'important');
    element.style.setProperty('letter-spacing', 'normal', 'important');
    element.style.setProperty('text-transform', 'none', 'important');
    element.style.setProperty('white-space', 'normal', 'important');
  };

  const dismissShareItem = item => {
    dismissedGesture = shareGesture;
    item.remove();
  };

  const watchShareItem = (surface, item, dismissOnOutsideTap) => {
    const timer = setInterval(() => {
      if (!item.isConnected) {
        clearInterval(timer);
        return;
      }
      if (!isAvailable(surface)) dismissShareItem(item);
    }, 200);
    if (!dismissOnOutsideTap) return;
    const onPointerDown = event => {
      if (!item.isConnected) {
        document.removeEventListener('pointerdown', onPointerDown, true);
        return;
      }
      if (event.target?.closest?.(`[${ITEM_ATTRIBUTE}]`)) return;
      dismissShareItem(item);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
  };

  const watchSheetRemoval = (surface, item) => {
    const parent = surface.parentElement;
    if (!parent) return;
    const removal = new MutationObserver(() => {
      if (surface.isConnected) return;
      item.remove();
      removal.disconnect();
    });
    removal.observe(parent, { childList: true });
  };

  const isShareSheetVisible = surface => {
    if (!isAvailable(surface)) return false;
    for (let node = surface.parentElement; node && node !== document.documentElement; node = node.parentElement) {
      if (node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('hidden')) return false;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
    }
    const rect = surface.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const chooseFeedPermalink = surface => {
    const pendingUrl = sanitizeFacebookUrl(pendingFeedShare?.url);
    if (pendingUrl) return { url: pendingUrl, source: pendingFeedShare?.source || 'feed-post' };
    const sheetUrl = surface ? (permalinkFromCopyRow(surface) || pickUrl(urlsFromHtml(surface.outerHTML))) : null;
    if (sheetUrl) return { url: sheetUrl, source: 'sheet-link' };
    const located = sanitizeFacebookUrl(location.href);
    if (located) return { url: located, source: 'post-location' };
    return null;
  };

  const removeFeedShareItems = () => {
    document.querySelectorAll(`[${ITEM_ATTRIBUTE}][data-nobook-share-context="FEED"]`)
      .forEach(item => item.remove());
  };

  const cleanupExternalShareUI = (reason, clearPending) => {
    const hadUi = feedSheetActive ||
      Boolean(document.querySelector(`[${ITEM_ATTRIBUTE}][data-nobook-share-context="FEED"]`));
    removeFeedShareItems();
    activeFeedSheet = null;
    activeFeedCopyRow = null;
    feedSheetActive = false;
    sheetMissingSince = 0;
    if (clearPending) pendingFeedShare = null;
    if (reason === 'outside' || reason === 'navigation' || reason === 'shared' || reason === 'sheet-hidden') {
      dismissedGesture = shareGesture;
    }
    if (!hadUi && !clearPending) return;
    logShare({
      context: 'FEED',
      shareSheetDetected: false,
      shareSheetVisible: false,
      customItemInserted: false,
      customItemClicked: false,
      pendingTargetPresent: Boolean(pendingFeedShare?.url),
      permalinkFound: false,
      permalinkSource: 'none',
      urlValidated: false,
      bridgeAvailable: bridgeReady(),
      bridgeInvoked: false,
      action: 'cleanup'
    });
  };

  const onFeedShareActivate = event => {
    const item = event.target?.closest?.(`[${ITEM_ATTRIBUTE}][data-nobook-share-context="FEED"]`);
    if (!item) return;
    event.preventDefault();
    event.stopPropagation();
    if (feedShareInvoked) return;
    const choice = chooseFeedPermalink(activeFeedSheet);
    const url = sanitizeFacebookUrl(choice?.url);
    const ready = bridgeReady();
    const clipboardFallback = !url && copyLinkThroughFacebook(activeFeedSheet);
    logShare({
      context: 'FEED',
      shareSheetDetected: true,
      shareSheetVisible: isShareSheetVisible(activeFeedSheet),
      customItemInserted: true,
      customItemClicked: true,
      pendingTargetPresent: Boolean(pendingFeedShare?.url),
      permalinkFound: Boolean(url),
      permalinkSource: choice?.source || 'none',
      urlValidated: Boolean(url),
      bridgeAvailable: ready,
      bridgeInvoked: Boolean((url && ready) || clipboardFallback),
      action: 'click'
    });
    if (clipboardFallback) {
      feedShareInvoked = true;
      cleanupExternalShareUI('shared', true);
      return;
    }
    if (!url || !ready) return;
    feedShareInvoked = true;
    window.ShareBridge.shareUrl(url);
    cleanupExternalShareUI('shared', true);
  };

  const insertFeedShareItem = surface => {
    if (dismissedGesture === shareGesture) return;
    const visible = isShareSheetVisible(surface);
    if (!visible) return;
    const choice = chooseFeedPermalink(surface);
    const validated = sanitizeFacebookUrl(choice?.url);
    const hasCopyFallback = clipboardBridgeReady() &&
      labeledNodes(surface).some(item => COPY_LABELS.has(item.label));
    if (!pendingFeedShare?.url && validated) {
      pendingFeedShare = { url: validated, timestamp: Date.now(), source: choice?.source || 'feed-post' };
    }
    if (!surface.dataset.nobookShareSurface) {
      surfaceSerial += 1;
      surface.dataset.nobookShareSurface = String(surfaceSerial);
    }
    const surfaceId = surface.dataset.nobookShareSurface;
    if (!validated && !hasCopyFallback) {
      removeFeedShareItems();
      activeFeedSheet = null;
      feedSheetActive = false;
      if (surface.dataset.nobookShareRejected !== String(shareGesture)) {
        surface.dataset.nobookShareRejected = String(shareGesture);
        logShare({
          context: 'FEED',
          shareSheetDetected: true,
          shareSheetVisible: true,
          customItemInserted: false,
          customItemClicked: false,
          pendingTargetPresent: false,
          permalinkFound: false,
          permalinkSource: 'none',
          urlValidated: false,
          bridgeAvailable: bridgeReady(),
          bridgeInvoked: false,
          action: 'ignore'
        });
      }
      return;
    }
    const existing = Array.from(
      document.querySelectorAll(`[${ITEM_ATTRIBUTE}][data-nobook-share-context="FEED"]`)
    );
    if (existing.length === 1 &&
        existing[0].getAttribute('data-nobook-share-for') === surfaceId) {
      activeFeedSheet = surface;
      feedSheetActive = true;
      return;
    }
    existing.forEach(item => item.remove());
    const labels = labeledNodes(surface);
    const anchorLabel = labels.find(item => COPY_LABELS.has(item.label)) ||
      labels.find(item => isOptionLabel(item.label));
    if (!anchorLabel) return;
    const anchorRow = rowOf(anchorLabel.element);
    if (!anchorRow?.parentElement || !surface.contains(anchorRow)) return;
    const background = opaqueBackground(anchorRow);
    const textColor = background.luminance < 0.45 ? '#f5f6f7' : '#050505';
    const thai = document.documentElement.lang.toLocaleLowerCase().startsWith('th') ||
      labels.some(item => item.label === 'คัดลอกลิงก์' || item.label === 'คัดลอกลิ้งค์');
    const item = createShareButton(thai ? 'แชร์ไปยังแอปอื่น' : 'Share to other apps', textColor);
    const usesTrustedCopyRow = !validated && hasCopyFallback;
    item.setAttribute('data-nobook-share-context', 'FEED');
    item.setAttribute('data-nobook-share-for', surfaceId);
    item.style.setProperty('position', 'fixed', 'important');
    item.style.setProperty('z-index', '2147483646', 'important');
    item.style.setProperty('background-color', background.css, 'important');
    item.style.setProperty('border-radius', '12px', 'important');
    const place = () => {
      const rect = anchorRow.getBoundingClientRect();
      const desiredTop = usesTrustedCopyRow ? rect.top : rect.top - 56;
      item.style.setProperty('left', `${rect.left}px`, 'important');
      item.style.setProperty(
        'top', `${Math.max(8, Math.min(innerHeight - 56, desiredTop))}px`, 'important'
      );
      item.style.setProperty('width', `${rect.width}px`, 'important');
    };
    if (usesTrustedCopyRow) {
      item.style.setProperty('pointer-events', 'none', 'important');
      activeFeedCopyRow = anchorRow;
    }
    document.body.appendChild(item);
    place();
    requestAnimationFrame(place);
    setTimeout(place, 250);
    watchSheetRemoval(surface, item);
    watchShareItem(surface, item, false);
    activeFeedSheet = surface;
    feedSheetActive = true;
    sheetMissingSince = 0;
    logShare({
      context: 'FEED',
      shareSheetDetected: true,
      shareSheetVisible: true,
      customItemInserted: true,
      customItemClicked: false,
      pendingTargetPresent: Boolean(pendingFeedShare?.url),
      permalinkFound: Boolean(validated),
      permalinkSource: validated ? (pendingFeedShare?.source || choice?.source) : 'facebook-copy-link',
      urlValidated: Boolean(validated),
      bridgeAvailable: bridgeReady(),
      bridgeInvoked: false,
      action: 'insert'
    });
  };

  const insertShareItem = surface => {
    if (shareContext() === 'FEED') {
      insertFeedShareItem(surface);
      return;
    }
    if (dismissedGesture === shareGesture) return;
    if (!surface.dataset.nobookShareSurface) {
      surfaceSerial += 1;
      surface.dataset.nobookShareSurface = String(surfaceSerial);
    }
    const surfaceId = surface.dataset.nobookShareSurface;
    const existing = document.querySelector(`[${ITEM_ATTRIBUTE}]`);
    if (existing?.getAttribute('data-nobook-share-for') === surfaceId) return;
    const previousMenu = existing?.closest('[data-nobook-share-menu]');
    if (previousMenu) previousMenu.remove();
    else existing?.remove();
    const labels = labeledNodes(surface);
    const anchorLabel = labels.find(item => COPY_LABELS.has(item.label)) ||
      labels.find(item => isOptionLabel(item.label));
    if (!anchorLabel) return;
    const anchorRow = rowOf(anchorLabel.element);
    if (!anchorRow) return;
    const context = shareContext();
    const optionRows = Array.from(new Set(labels
      .filter(entry => isOptionLabel(entry.label))
      .map(entry => rowOf(entry.element))
      .filter(Boolean)));
    const background = opaqueBackground(anchorRow);
    const textColor = background.luminance < 0.45 ? '#f5f6f7' : '#050505';
    const thai = document.documentElement.lang.toLocaleLowerCase().startsWith('th') ||
      labels.some(item => item.label === 'คัดลอกลิงก์' || item.label === 'คัดลอกลิ้งค์');
    const label = thai ? 'แชร์ไปยังแอปอื่น' : 'Share to other apps';
    const item = createShareButton(label, textColor);
    item.setAttribute('data-nobook-share-for', surfaceId);
    item.setAttribute('popover', 'manual');
    let invoked = false;
    let savedChoice = null;
    const invoke = event => {
      const rect = item.getBoundingClientRect();
      const targetHit = event.target?.closest?.(`[${ITEM_ATTRIBUTE}]`) ||
        event.composedPath?.().some(node => node === item);
      const inside = rect.width > 20 && rect.height > 20 &&
        event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!targetHit && !inside) return;
      event.preventDefault();
      event.stopPropagation();
      if (invoked) return;
      const choice = choosePermalink(surface) || savedChoice;
      if (!choice) {
        logShare({
          context, shareSheetDetected: true, customItemInserted: true,
          permalinkFound: false, permalinkSource: 'none', bridgeInvoked: false
        });
        return;
      }
      invoked = true;
      logShare({
        context, shareSheetDetected: true, customItemInserted: true,
        permalinkFound: true, permalinkSource: choice.source, bridgeInvoked: true
      });
      window.ShareBridge?.shareUrl?.(choice.url);
    };
    const detachInvoke = () => document.removeEventListener('pointerup', invoke, true);
    document.addEventListener('pointerup', invoke, true);
    item.addEventListener('click', invoke, true);
    item.style.setProperty('position', 'fixed', 'important');
    item.style.setProperty('z-index', '2147483646', 'important');
    item.style.setProperty('border-radius', '12px', 'important');
    item.style.setProperty('background-color', background.css, 'important');
    const place = () => {
      const rects = optionRows
        .map(row => row.getBoundingClientRect())
        .filter(rect => rect.height > 20 && rect.width > 40 && rect.bottom > 0);
      const visible = rects.filter(rect => rect.top > window.innerHeight * 0.25);
      const used = visible.length ? visible : rects;
      if (!used.length) return;
      const top = Math.min(...used.map(rect => rect.top));
      const left = Math.min(...used.map(rect => rect.left));
      const right = Math.max(...used.map(rect => rect.right));
      item.style.setProperty('top', `${Math.max(8, top - 56)}px`, 'important');
      item.style.setProperty('left', `${left}px`, 'important');
      item.style.setProperty('width', `${Math.max(120, right - left)}px`, 'important');
    };
    document.body.appendChild(item);
    item.showPopover?.();
    savedChoice = choosePermalink(surface);
    place();
    requestAnimationFrame(place);
    setTimeout(place, 350);
    watchSheetRemoval(surface, item);
    watchShareItem(surface, item, false);
    const parent = surface.parentElement;
    if (parent) {
      const detach = new MutationObserver(() => {
        if (surface.isConnected) return;
        detachInvoke();
        detach.disconnect();
      });
      detach.observe(parent, { childList: true });
    }
    const choice = choosePermalink(surface);
    logShare({
      context, shareSheetDetected: true, customItemInserted: true,
      permalinkFound: Boolean(choice), permalinkSource: choice?.source || 'none',
      bridgeInvoked: false
    });
  };

  const rememberPostPermalink = event => {
    if (shareContext() === 'FEED') return;
    if (event.target.closest?.(`[${ITEM_ATTRIBUTE}]`)) return;
    let node = event.target;
    let matched = false;
    while (node && node !== document.body) {
      if (node.matches?.('[role="dialog"], [role="menu"]')) return;
      const label = normalize(
        node.getAttribute?.('aria-label') || (node.childElementCount ? '' : node.textContent)
      );
      if (isShareControlLabel(label)) matched = true;
      if (matched && node.matches?.(CONTROL_SELECTOR)) break;
      node = node.parentElement;
    }
    if (!matched || !node || node === document.body) return;
    if (event.type === 'pointerdown') {
      shareGesture += 1;
      feedShareInvoked = false;
      sheetMissingSince = 0;
      sharePointer = true;
    }
    const post = enclosingPost(node);
    const url = permalinkNear(node);
    pendingPermalink = url ? { url, post, source: 'feed-post' } : { post, source: 'feed-post' };
    if (shareContext() === 'FEED') {
      if (url) pendingFeedShare = { url, timestamp: Date.now(), source: 'feed-post' };
      else if (event.type === 'pointerdown') pendingFeedShare = null;
    }
    logShare({
      context: shareContext(),
      shareSheetDetected: false,
      shareSheetVisible: false,
      customItemInserted: false,
      customItemClicked: false,
      pendingTargetPresent: Boolean(url),
      permalinkFound: Boolean(url),
      permalinkSource: url ? 'feed-post' : 'none',
      urlValidated: Boolean(url),
      bridgeAvailable: bridgeReady(),
      bridgeInvoked: false,
      action: 'ignore'
    });
    if (sheetWatch) clearInterval(sheetWatch);
    let tries = 0;
    sheetWatch = setInterval(() => {
      tries += 1;
      processShareRoot(document);
      if (document.querySelector(`[${ITEM_ATTRIBUTE}]`) || tries > 20) {
        clearInterval(sheetWatch);
        sheetWatch = 0;
      }
    }, 150);
  };
  document.addEventListener('pointerdown', rememberPostPermalink, true);
  document.addEventListener('click', rememberPostPermalink, true);
  document.addEventListener('pointerdown', event => {
    if (sharePointer) {
      sharePointer = false;
      return;
    }
    if (shareContext() === 'REEL' || !feedSheetActive) return;
    if (event.target?.closest?.(`[${ITEM_ATTRIBUTE}]`)) return;
    if (activeFeedSheet?.isConnected && activeFeedSheet.contains(event.target)) return;
    cleanupExternalShareUI('outside', true);
  }, true);
  document.addEventListener('pointerup', onFeedShareActivate, true);
  document.addEventListener('click', onFeedShareActivate, true);
  document.addEventListener('click', event => {
    if (feedShareInvoked || !activeFeedCopyRow?.contains?.(event.target)) return;
    feedShareInvoked = true;
    setTimeout(() => window.ShareBridge?.shareClipboardUrl?.(), 100);
  }, true);
  setInterval(() => {
    if (location.href !== lastFeedLocation) {
      lastFeedLocation = location.href;
      cleanupExternalShareUI('navigation', true);
      return;
    }
    if (shareContext() === 'REEL' || !feedSheetActive) {
      sheetMissingSince = 0;
      return;
    }
    const gone = !activeFeedSheet || !activeFeedSheet.isConnected || !isShareSheetVisible(activeFeedSheet);
    if (!gone) {
      sheetMissingSince = 0;
      return;
    }
    if (!sheetMissingSince) {
      sheetMissingSince = Date.now();
      sheetMissingGesture = shareGesture;
    }
    if (Date.now() - sheetMissingSince >= 250 && sheetMissingGesture === shareGesture) {
      cleanupExternalShareUI('sheet-hidden', true);
    }
  }, 200);

  const processShareRoot = root => {
    if (shareContext() === 'FEED') return;
    const surface = findShareSurface(root);
    if (surface) insertShareItem(surface);
  };
  window.__nobookProcessShareRoot = processShareRoot;
  processShareRoot(document);
  new MutationObserver(() => processShareRoot(document)).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['role', 'aria-hidden', 'hidden']
  });
})();

// Enhance Loading Overlay Script
(function() {
    function applyOverlayStyle() {
        const overlays = document.querySelectorAll('.loading-overlay');
        overlays.forEach(overlay => {
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
        });
    }
    applyOverlayStyle();

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length)
                applyOverlayStyle();
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();

// Hide facebook download button at login page.
(function() {
    const element = document.querySelector('div[data-bloks-name="bk.components.Flexbox"].wbloks_1');
    if (element) element.remove();
})();

// Hide annoying bottom banners
const observer = new MutationObserver(() => {

  if (location.pathname === '/'
  && document.querySelector('div[role="button"][aria-label*="Facebook"]') === null) return;

  const element = document.querySelector('.bottom.fixed-container');
  if (
    element &&
    !element.hasAttribute('data-shift-on-keyboard-shown')
  ) {
    const heightAttr = element.getAttribute('data-actual-height');
    if (heightAttr && parseInt(heightAttr, 10) < 80) {
      element.style.display = 'none';
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });


// Hold Effect Script
(function() {
  const style = document.createElement('style');
  style.innerHTML = '* { -webkit-tap-highlight-color: rgba(180, 180, 180, 0.35); }';
  document.head.appendChild(style);
})();


/* The below scripts are specific to com.ycngmn.Nobook application. */

(() => {
  const onReady = (fn) => {
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', fn);
     else fn();
  };

  onReady(() => {
    const BUTTON_ID = 'custom-settings-btn';
    const ICON_SVG = `
      <svg width="28" height="28" fill="%FILL%" viewBox="0 0 24 24">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M9.586 2.586A2 2 0 0 1 11 2h2a2 2 0 0 1 2 2v.089l.473.196.063-.063a2.002 2.002 0 0 1 2.828 0l1.414 1.414a2 2 0 0 1 0 2.827l-.063.064.196.473H20a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-.089l-.196.473.063.063a2.002 2.002 0 0 1 0 2.828l-1.414 1.414a2 2 0 0 1-2.828 0l-.063-.063-.473.196V20a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-.089l-.473-.196-.063.063a2.002 2.002 0 0 1-2.828 0l-1.414-1.414a2 2 0 0 1 0-2.827l.063-.064L4.089 15H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h.09l.195-.473-.063-.063a2 2 0 0 1 0-2.828l1.414-1.414a2 2 0 0 1 2.827 0l.064.063L9 4.089V4a2 2 0 0 1 .586-1.414ZM8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"/>
      </svg>`;

    const getFillColor = () => {
      const color = document.querySelector('meta[name="theme-color"]')?.content?.toLowerCase();
      return color === '#ffffff' ? '#242526' : '#d0d0d0';
    };

    const updateButtonColor = () => {
      const svg = document.querySelector(`#${BUTTON_ID} svg`);
      if (svg) svg.setAttribute('fill', getFillColor());
    };

    const findInsertionPoint = () => {
      const iconSpan = Array.from(document.querySelectorAll('span'))
        .find(span => span.textContent === '󱥊');
      const container = iconSpan?.closest('div[role="button"]')?.parentNode;

      const desktopTarget = document.querySelector(
        '.x6s0dn4.x78zum5.x1s65kcs.x1n2onr6.x1ja2u2z'
      );

      return { container, desktopTarget };
    };

    const createButton = () => {
      const btn = document.createElement('button');
      btn.id = BUTTON_ID;
      btn.setAttribute('style', `
        position: ${findInsertionPoint().desktopTarget === null ? 'fixed' : 'block'};
        top: 8px;
        right: 100px;
        background: transparent;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        pointer-events: auto;
      `);
      btn.innerHTML = ICON_SVG.replace('%FILL%', getFillColor());
      btn.onclick = () => SettingsBridge?.onSettingsToggle?.();
      return btn;
    };

    const insertButton = () => {
      if (document.getElementById(BUTTON_ID)) return;

      const { container, desktopTarget } = findInsertionPoint();
      const button = createButton();

      if (desktopTarget) desktopTarget.insertBefore(button, desktopTarget.firstChild);
      else if (container) container.insertBefore(button, container.firstChild);
    };

    insertButton();

    const observer = new MutationObserver(() => {
      if (!document.getElementById(BUTTON_ID) && isFeed()) {
        insertButton();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Observer for theme-color changes
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      new MutationObserver(updateButtonColor).observe(themeMeta, {
        attributes: true,
        attributeFilter: ['content'],
      });
    }
  });
})();


// Color Extraction Script
(function() {
    const meta = document.querySelector('meta[name="theme-color"]');
    const notify = () => window.ThemeBridge?.onThemeColorChanged?.(meta?.content ?? "null");
    if (meta) {
        notify();
        new MutationObserver(() => notify())
            .observe(meta, { attributes: true, attributeFilter: ['content'] });
    }
})();

// File Download Script
(function() {
    if (window._downloadBridgeInitialized) return;
    window._downloadBridgeInitialized = true;
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function(blob) {
        const reader = new FileReader();
        reader.onloadend = function() {
            if (reader.result)
                DownloadBridge.downloadBase64File(reader.result, blob.type);
        };
        reader.readAsDataURL(blob);
        return originalCreateObjectURL(blob);
    };
})();

// Keep Android awake only while a visible HTML video is actively playing.
(() => {
  if (window._nobookVideoPlaybackObserver) return;
  window._nobookVideoPlaybackObserver = true;

  const videos = new Set();
  const intersections = new Map();
  let lastReported = null;

  const isFullscreen = video => {
    const fullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    return fullscreen === video || fullscreen?.contains?.(video);
  };

  const isVisible = video =>
    intersections.get(video) === true ||
    isFullscreen(video) ||
    document.pictureInPictureElement === video;

  const isActive = video =>
    !video.paused &&
    !video.ended &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    document.visibilityState === 'visible' &&
    isVisible(video);

  const report = () => {
    const videoStates = Array.from(videos).map((video, index) => ({
      index,
      paused: video.paused,
      ended: video.ended,
      readyState: video.readyState,
      intersecting: intersections.get(video) === true,
      documentVisible: document.visibilityState === 'visible',
      fullscreen: isFullscreen(video),
      pictureInPicture: document.pictureInPictureElement === video,
      active: isActive(video)
    }));
    const active = videoStates.some(video => video.active);
    console.log(
      'NobookVideoWake report',
      JSON.stringify({ videoCount: videos.size, videoStates, aggregatePlaying: active })
    );
    if (active === lastReported) return;
    lastReported = active;
    console.log('NobookVideoWake sending to Android', active);
    window.VideoPlaybackBridge?.onPlaybackStateChanged?.(active);
  };

  const intersectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      intersections.set(entry.target, entry.isIntersecting && entry.intersectionRatio > 0);
    });
    report();
  });

  const playbackEvents = ['play', 'playing', 'pause', 'ended', 'emptied'];

  const addVideo = video => {
    if (videos.has(video)) return;
    videos.add(video);
    intersections.set(video, false);
    playbackEvents.forEach(event => video.addEventListener(event, report));
    video.addEventListener('enterpictureinpicture', report);
    video.addEventListener('leavepictureinpicture', report);
    intersectionObserver.observe(video);
  };

  const removeVideo = video => {
    if (!videos.delete(video)) return;
    playbackEvents.forEach(event => video.removeEventListener(event, report));
    video.removeEventListener('enterpictureinpicture', report);
    video.removeEventListener('leavepictureinpicture', report);
    intersectionObserver.unobserve(video);
    intersections.delete(video);
  };

  const visitVideos = (node, callback) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches('video')) callback(node);
    node.querySelectorAll('video').forEach(callback);
  };

  const initialVideos = document.querySelectorAll('video');
  console.log('NobookVideoWake initial video count', initialVideos.length);
  initialVideos.forEach(addVideo);
  new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => visitVideos(node, addVideo));
      mutation.removedNodes.forEach(node => visitVideos(node, removeVideo));
    });
    report();
  }).observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('visibilitychange', report);
  document.addEventListener('fullscreenchange', report);
  document.addEventListener('webkitfullscreenchange', report);
  report();
})();

// Make only editable fields on dark composer surfaces readable.
(() => {
  if (window._nobookDarkComposerObserver) return;
  window._nobookDarkComposerObserver = true;

  const style = document.createElement('style');
  style.textContent = `
    [data-nobook-dark-editor="true"],
    [data-nobook-dark-editor="true"] * {
      color: #f0f2f5 !important;
      caret-color: #f0f2f5 !important;
    }
    [data-nobook-dark-editor="true"]::placeholder,
    [data-nobook-dark-editor="true"]::before,
    [data-nobook-dark-placeholder="true"] {
      color: #b0b3b8 !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(style);

  const backgroundLuminance = element => {
    for (let current = element; current; current = current.parentElement) {
      const color = getComputedStyle(current).backgroundColor;
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!match || (match[4] !== undefined && Number(match[4]) === 0)) continue;
      const [red, green, blue] = match.slice(1, 4).map(Number);
      return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    }
    return 1;
  };

  const updateEditor = editor => {
    const isDark = backgroundLuminance(editor) < 0.45;
    if (isDark) editor.dataset.nobookDarkEditor = 'true';
    else delete editor.dataset.nobookDarkEditor;

    const wrapper = editor.parentElement;
    wrapper?.querySelectorAll('[aria-placeholder], [data-placeholder]').forEach(placeholder => {
      if (isDark) placeholder.dataset.nobookDarkPlaceholder = 'true';
      else delete placeholder.dataset.nobookDarkPlaceholder;
    });
  };

  let updateScheduled = false;
  const updateEditors = () => {
    if (updateScheduled) return;
    updateScheduled = true;
    requestAnimationFrame(() => {
      updateScheduled = false;
      document.querySelectorAll('[contenteditable="true"], textarea, input[type="text"]')
        .forEach(updateEditor);
    });
  };

  updateEditors();
  new MutationObserver(updateEditors).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
})();

// Facebook surface correction for WebView textZoom above 100%.
// Facebook keeps the 100% pixel width, height, and absolute offsets, so zoomed
// text and action chrome paint past the post. Thai has no spaces, so wordcut
// inserts wrap points between words instead of breaking inside a word.
// Applies on any facebook.com page (not only '/'); dialogs/reels/stories stay skipped.
(() => {
  if (window.__nobookFontZoomCompatInit) {
    window.__nobookApplyFontZoomCompat?.(window.__nobookFontZoom || 100);
    return;
  }
  window.__nobookFontZoomCompatInit = true;

  const STYLE_ID = 'nobook-font-zoom-feed';
  const BODY = 'nobook-font-zoom-body';
  const MEDIA = 'nobook-font-zoom-media';
  const CONTROL = 'nobook-font-zoom-control';
  const WRAP = 'nobook-font-zoom-wrap';
  const POST = 'article, [role="article"]';
  const TEXT = '[data-mcomponent="TextArea"][data-type="text"]';
  const MEDIA_SELECTOR = 'img, video, [data-mcomponent="Image"]';
  const SKIP = '[role="dialog"], [data-reel-container], [data-story-container], ' +
    '[data-pagelet*="Reel"], [data-pagelet*="Story"], .vertically-snappable';
  const CHROME = 'nav, header, footer, [role="toolbar"], [data-type="transactional"], ' +
    '[data-ad-rendering-role="profile_name"], [data-ad-rendering-role="metadata"]';

  const onFacebookSurface = () => document.body?.dataset.nobookTestFeed === 'true' ||
    /(^|\.)facebook\.com$/.test(location.hostname || '');

  // Keep this aligned with feed text selection: focusable MContainer wraps real post bodies.
  const isMetadata = area => Boolean(area.closest(CHROME));

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${WRAP} {
      height: auto !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      overflow: visible !important;
    }
    .${BODY} {
      position: relative !important;
      top: auto !important;
      right: auto !important;
      left: auto !important;
      width: auto !important;
      max-width: 100% !important;
      min-width: 0 !important;
      height: auto !important;
      box-sizing: border-box !important;
      white-space: normal !important;
      word-break: normal !important;
      overflow-wrap: break-word !important;
      overflow: visible !important;
      line-height: normal !important;
    }
    .${MEDIA} {
      position: relative !important;
      top: auto !important;
      right: auto !important;
      left: auto !important;
      max-width: 100% !important;
      min-width: 0 !important;
      height: auto !important;
      box-sizing: border-box !important;
    }
    .${CONTROL} {
      position: relative !important;
      top: auto !important;
      right: auto !important;
      left: auto !important;
      flex: 1 1 0 !important;
      max-width: 100% !important;
      min-width: 0 !important;
      height: auto !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
  `;

  const overlaps = (text, other) => {
    const textRect = text.getBoundingClientRect();
    const otherRect = other.getBoundingClientRect();
    const textRight = textRect.left + Math.max(textRect.width, text.scrollWidth);
    const textBottom = textRect.top + Math.max(textRect.height, text.scrollHeight);
    const width = Math.min(textRight, otherRect.right) - Math.max(textRect.left, otherRect.left);
    const height = Math.min(textBottom, otherRect.bottom) - Math.max(textRect.top, otherRect.top);
    return width > 4 && height > 4;
  };

  const rectsOverlap = (first, second) => {
    const firstRect = first.getBoundingClientRect();
    const secondRect = second.getBoundingClientRect();
    const width = Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left);
    const height = Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top);
    return width > 4 && height > 4;
  };

  const exceedsViewport = element => {
    const rect = element.getBoundingClientRect();
    return rect.right > window.innerWidth + 1 ||
      element.scrollWidth > element.clientWidth + 1;
  };

  const relax = element => {
    const post = element.closest(POST);
    let node = element.parentElement;
    while (node) {
      node.classList.add(WRAP);
      if (node === post) break;
      node = node.parentElement;
    }
  };

  const clearMarks = () => {
    document.querySelectorAll(`.${BODY}, .${MEDIA}, .${CONTROL}, .${WRAP}`).forEach(element => {
      element.classList.remove(BODY, MEDIA, CONTROL, WRAP);
    });
  };

  const cutTextNodes = new Set();
  const thaiScript = /[\u0E00-\u0E7F]/;
  const clearThaiBreaks = () => {
    cutTextNodes.forEach(node => {
      if (typeof node.nodeValue === 'string') node.nodeValue = node.nodeValue.replace(/\u200b/g, '');
    });
    cutTextNodes.clear();
  };
  const breakThai = root => {
    const cutter = window.__nobookWordcut;
    if (!cutter?.cut) return;
    cutter.ensure?.();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || parent.closest(
          'textarea, input, [contenteditable="true"], script, style, button, [role="button"]'
        )) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (cutTextNodes.has(node)) return;
      const value = node.nodeValue;
      if (!value || !thaiScript.test(value)) return;
      if (value.includes('\u200b')) {
        cutTextNodes.add(node);
        return;
      }
      const next = cutter.cut(value, '\u200b');
      if (!next || next === value) return;
      node.nodeValue = next;
      cutTextNodes.add(node);
    });
  };

  let scheduled = false;
  const scan = () => {
    if ((window.__nobookFontZoom || 100) <= 100 || !onFacebookSurface()) return;
    document.querySelectorAll(POST).forEach(post => {
      if (post.closest(SKIP)) return;
      breakThai(post);
      post.querySelectorAll(TEXT).forEach(text => {
        if (text.closest('a, button, [role="button"]')) return;
        if (isMetadata(text)) return;
        // Always reflow above 100%: 115% often fits the text box but still clips
        // Like/Comment/Share and other right-edge chrome.
        text.classList.add(BODY);
        relax(text);
      });
      const bodies = [...post.querySelectorAll(`.${BODY}`)];
      if (!bodies.length) return;
      post.classList.add(WRAP);
      post.querySelectorAll(MEDIA_SELECTOR).forEach(media => {
        if (media.closest(SKIP)) return;
        const stacked = getComputedStyle(media).position === 'absolute' ||
          bodies.some(text => !text.contains(media) && overlaps(text, media));
        if (!stacked) return;
        media.classList.add(MEDIA);
        relax(media);
      });
      const postClipped = exceedsViewport(post);
      post.querySelectorAll('button, [role="button"]').forEach(control => {
        if (control.id === 'custom-settings-btn') return;
        if (control.closest(SKIP)) return;
        if (bodies.some(text => text.contains(control))) return;
        const parent = control.parentElement;
        const rowClipped = Boolean(parent && exceedsViewport(parent));
        const stale = getComputedStyle(control).position === 'absolute' ||
          postClipped ||
          rowClipped ||
          exceedsViewport(control) ||
          [...post.querySelectorAll(`.${BODY}, .${MEDIA}`)].some(other => rectsOverlap(other, control));
        if (!stale) return;
        control.classList.add(CONTROL);
        relax(control);
      });
    });
  };

  const scheduleScan = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  };

  let observer = null;
  const stopObserver = () => {
    observer?.disconnect();
    observer = null;
  };

  window.__nobookApplyFontZoomCompat = zoom => {
    window.__nobookFontZoom = zoom;
    if (zoom <= 100 || !document.body) {
      stopObserver();
      clearThaiBreaks();
      clearMarks();
      style.remove();
      return;
    }
    if (!style.isConnected) document.head.appendChild(style);
    scan();
    if (!observer) {
      observer = new MutationObserver(scheduleScan);
      observer.observe(document.body, { childList: true, subtree: true });
    }
  };

  window.__nobookApplyFontZoomCompat(window.__nobookFontZoom || 100);
})();
