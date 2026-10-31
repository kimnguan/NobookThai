(function() {
  if (window.__nobookAdblockInitialized) return;
  window.__nobookAdblockInitialized = true;

  const normalizeText = text => (text || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();

  const MARKERS = [
    'Sponsored', 'ที่ได้รับการสนับสนุน', 'ได้รับการสนับสนุน',
    'Ad', 'Gesponsert', 'Sponsorlu', 'Sponsorowane', 'Publicidad',
    'Sponsorisée', 'Sponsorisé', 'Sponsorizzato', 'Gesponsord',
    'Patrocinado', 'Sponsorizat', 'Sponsoreret', 'Sponsoroitu',
    'Sponsrat', 'Được tài trợ', 'Χορηγούμενη', 'Спонсорирано',
    'Спонзорирано', 'Реклама', 'Спонзорисано', 'במימון', 'سپانسرڈ',
    'प्रायोजित', 'স্পনসর্ড', 'ਪ੍ਰਯੋਜਿਤ', 'પ્રાયોજિત', 'ପ୍ରାୟୋଜିତ',
    '광고', '贊助', '赞助内容', '広告', 'Anzeige', 'Peye', 'Oglas'
  ].map(normalizeText);
  const CTAS = [
    'Shop Now', 'สั่งซื้อตอนนี้', 'ดูเพิ่มเติม', 'Send Message', 'ส่งข้อความ'
  ].map(normalizeText);
  const REGION_SELECTOR =
    'header, [data-ad-rendering-role="profile_name"], ' +
    '[data-ad-rendering-role="metadata"], [data-ad-rendering-role="ad"], ' +
    '[data-reel-metadata], [data-sponsored-overlay], ' +
    'div[data-mcomponent*="TextArea"]';
  const REEL_SELECTOR =
    'div.vertically-snappable, [data-pagelet*="Reel"], ' +
    '[data-reel-container]';

  const hidden = new WeakSet();
  const signatures = new WeakMap();
  const loggedMarkerRegions = new WeakSet();
  const observedReels = new WeakSet();
  const visibleReels = new WeakMap();
  const skippedReels = new WeakMap();

  const findMarker = text => {
    const normalized = normalizeText(text);
    const compact = normalized.replace(/\s/g, '');
    return MARKERS.find(marker => {
      const markerCompact = marker.replace(/\s/g, '');
      return normalized === marker || compact.includes(markerCompact);
    });
  };

  const hasCta = container => Array.from(container.querySelectorAll(
    '[role="button"], a, button'
  )).some(element => CTAS.includes(normalizeText(element.textContent)));

  const describeElement = element => {
    if (!element) return 'none';
    const dataKeys = Array.from(element.attributes)
      .filter(attribute => attribute.name.startsWith('data-'))
      .map(attribute => attribute.name)
      .slice(0, 8);
    const ariaKeys = Array.from(element.attributes)
      .filter(attribute => attribute.name.startsWith('aria-'))
      .map(attribute => attribute.name)
      .slice(0, 8);
    const stable = {};
    ['data-mcomponent', 'data-pagelet', 'data-type', 'data-ad-rendering-role']
      .forEach(name => {
        if (element.hasAttribute(name)) stable[name] = element.getAttribute(name);
      });
    return JSON.stringify({
      tag: element.tagName,
      role: element.getAttribute('role'),
      ariaKeys,
      dataKeys,
      stable
    });
  };

  const logDecision = (route, marker, container, score, action) => {
    console.log(
      `[NobookAdblock] route=${route} markerFound=${Boolean(marker)} ` +
      `markerText=${marker || ''} candidateContainer=${describeElement(container)} ` +
      `score=${score} action=${action}`
    );
  };

  const logMarkerAncestry = (region, marker) => {
    if (loggedMarkerRegions.has(region)) return;
    loggedMarkerRegions.add(region);
    const ancestry = [];
    for (let node = region, depth = 0; node && depth < 6; node = node.parentElement, depth++) {
      ancestry.push(describeElement(node));
    }
    console.log(
      `[NobookAdblock] markerFound=true markerText=${marker} ancestry=${JSON.stringify(ancestry)}`
    );
  };

  const markerRegions = root => {
    const regions = new Set();
    if (root instanceof Element) {
      const closest = root.closest(REGION_SELECTOR);
      if (closest) regions.add(closest);
      if (root.matches(REGION_SELECTOR)) regions.add(root);
    }
    root.querySelectorAll?.(REGION_SELECTOR).forEach(region => regions.add(region));
    return Array.from(regions).map(region => {
      const marker = findMarker(region.textContent);
      if (marker) logMarkerAncestry(region, marker);
      return { region, marker };
    });
  };

  const metadataIndex = (container, region) => {
    if (region.matches('header, [data-ad-rendering-role], [data-reel-metadata]')) return 0;
    return Array.from(container.querySelectorAll('div[data-mcomponent*="TextArea"]'))
      .indexOf(region);
  };

  const unchanged = (container, signature) => {
    if (hidden.has(container) || signatures.get(container) === signature) return true;
    signatures.set(container, signature);
    return false;
  };

  const hide = (container, route, marker, score) => {
    hidden.add(container);
    container.dataset.nobookAdType = route;
    container.style.display = 'none';
    logDecision(route, marker, container, score, 'hidden');
  };

  const feedSignals = (candidate, region) => {
    const hasHeader = candidate.contains(region) && region.matches(REGION_SELECTOR) ||
      candidate.matches('header, [data-ad-rendering-role="metadata"]') ||
      Boolean(candidate.querySelector(
        'header, [data-ad-rendering-role="profile_name"], ' +
        '[data-ad-rendering-role="metadata"]'
      ));
    const mediaCount = candidate.querySelectorAll(
      'img, picture, video, canvas, [role="img"], [data-ad-rendering-role="media"]'
    ).length;
    const hasMedia = mediaCount > 0;
    const controlCount = candidate.querySelectorAll('button, [role="button"]').length;
    const hasControls = Boolean(candidate.querySelector(
      'footer, [role="toolbar"], [data-ad-rendering-role="engagement"], ' +
      '[data-visualcompletion="ignore-dynamic"]'
    )) || controlCount >= 2;
    const hasCtaPanel = hasCta(candidate) || Boolean(candidate.querySelector(
      '[data-ad-rendering-role="cta"], [data-mcomponent*="Messenger"], ' +
      '[data-testid*="messenger"]'
    ));
    const article = candidate.getAttribute('role') === 'article';
    const metadataOnly = candidate === region || candidate.matches(
      'header, [data-ad-rendering-role="profile_name"], ' +
      '[data-ad-rendering-role="metadata"]'
    );
    const nestedArticles = candidate.querySelectorAll('[role="article"]').length;
    const pageRoot = candidate.matches(
      'html, body, main, [role="main"], [role="feed"], ' +
      '[data-type="vscroller"], [data-mcomponent="MScreen"], ' +
      '[data-pagelet="FeedUnit_0"]'
    );
    const completenessScore = Math.min(controlCount, 4) + Math.min(mediaCount, 2) +
      (candidate.children.length >= 4 ? 2 : 0) +
      (candidate.hasAttribute('data-tracking-duration-id') ? 2 : 0);
    const score = 3 + (article ? 4 : 0) + (hasHeader ? 2 : 0) +
      (hasMedia ? 2 : 0) + (hasControls ? 2 : 0) + (hasCtaPanel ? 1 : 0) -
      (metadataOnly ? 5 : 0) + completenessScore;
    const complete = article
      ? hasHeader && (hasMedia || hasControls || hasCtaPanel)
      : hasHeader && hasControls && (hasMedia || hasCtaPanel);
    const accepted = !pageRoot && nestedArticles <= (article ? 1 : 0) && complete;
    const reason = pageRoot ? 'page-root' :
      nestedArticles > (article ? 1 : 0) ? 'contains-neighbouring-posts' :
      metadataOnly ? 'metadata-only' :
      !hasHeader ? 'missing-header' :
      !hasControls ? 'missing-engagement-controls' :
      !hasMedia && !hasCtaPanel ? 'missing-content-or-cta' :
      accepted ? 'complete-post' : 'incomplete-post';
    return {
      article, hasHeader, hasMedia, mediaCount, hasControls, controlCount, hasCtaPanel,
      score, accepted, reason
    };
  };

  const describeFeedAncestor = (candidate, signals) => ({
    element: JSON.parse(describeElement(candidate)),
    hasAuthorHeader: signals.hasHeader,
    hasMedia: signals.hasMedia,
    mediaCount: signals.mediaCount,
    hasReactionCommentShareControls: signals.hasControls,
    controlCount: signals.controlCount,
    hasCtaMessengerPanel: signals.hasCtaPanel,
    score: signals.score,
    accepted: signals.accepted,
    reason: signals.reason
  });

  const findFeedPostContainer = (region, marker) => {
    const ancestors = [];
    const accepted = [];
    let node = region;
    for (let depth = 0; node && depth < 10; node = node.parentElement, depth++) {
      const signals = feedSignals(node, region);
      ancestors.push(describeFeedAncestor(node, signals));
      if (signals.accepted) accepted.push({ node, signals, depth });
      if (signals.reason === 'page-root') break;
    }

    const article = accepted.find(candidate => candidate.signals.article);
    const selected = article || accepted
      .filter(candidate => !candidate.signals.article)
      .sort((left, right) => right.signals.score - left.signals.score ||
        left.depth - right.depth)[0] || null;
    console.log(
      `[NobookAdblock] route=FEED markerFound=true markerText=${marker} ` +
      `matchedElement=${describeElement(region)} ancestors=${JSON.stringify(ancestors)} ` +
      `selected=${describeElement(selected?.node)} ` +
      `selectionReason=${selected?.signals.reason || 'no-complete-post-candidate'}`
    );
    return selected;
  };

  const isFeedMetadataRegion = region => {
    if (region.matches('header, [data-ad-rendering-role]')) return true;
    if (!region.matches('div[data-mcomponent*="TextArea"]')) return false;
    let node = region.parentElement;
    for (let depth = 0; node && depth < 2; node = node.parentElement, depth++) {
      if (node.matches('[data-focusable="true"][data-mcomponent="MContainer"]')) return true;
    }
    return false;
  };

  const FeedAds = {
    process(root) {
      markerRegions(root).forEach(({ region, marker }) => {
        if (!marker) return;
        if (!isFeedMetadataRegion(region)) {
          logDecision('FEED', marker, null, 0, 'ignored-non-metadata');
          return;
        }
        const candidate = findFeedPostContainer(region, marker);
        const post = candidate?.node || null;
        const index = post ? metadataIndex(post, region) : -1;
        const score = candidate?.signals.score || 0;
        if (!post || index < 0 || index > 3) {
          logDecision('FEED', marker, post, score, 'ignored');
          return;
        }
        if (!unchanged(post, `feed:${marker}:${index}`)) hide(post, 'FEED', marker, score);
      });
    }
  };

  const findReels = root => {
    const reels = new Set();
    if (root instanceof Element) {
      const closest = root.closest(REEL_SELECTOR);
      if (closest) reels.add(closest);
      if (root.matches(REEL_SELECTOR)) reels.add(root);
    }
    root.querySelectorAll?.(REEL_SELECTOR).forEach(reel => reels.add(reel));
    root.querySelectorAll?.('video').forEach(video => {
      const reel = video.closest(
        `${REEL_SELECTOR}, [role="presentation"], [role="dialog"]`
      );
      if (reel) reels.add(reel);
    });
    const onReelRoute = location.pathname.startsWith('/reel/') ||
      document.body.dataset.nobookTestReelRoute === 'true';
    if (onReelRoute) {
      const liveSelector = '[data-type="vscroller"] > [data-tracking-duration-id]';
      if (root instanceof Element) {
        const closest = root.closest(liveSelector);
        if (closest) reels.add(closest);
        if (root.matches(liveSelector)) reels.add(root);
      }
      root.querySelectorAll?.(liveSelector).forEach(reel => reels.add(reel));
    }
    return reels;
  };

  const findOverlayContainer = (region, reel) => {
    const explicit = region.closest('[data-sponsored-overlay], [data-ad-rendering-role="ad"]');
    if (explicit && explicit !== reel) return explicit;

    let node = region.parentElement;
    for (let depth = 0; node && node !== reel && depth < 6; node = node.parentElement, depth++) {
      if (
        hasCta(node) &&
        node.matches('a, [role="button"], [role="link"], [data-mcomponent="MContainer"]')
      ) return node;
    }
    return null;
  };

  let ReelAds;
  const reelVisibilityObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      visibleReels.set(entry.target, entry.isIntersecting && entry.intersectionRatio > 0);
      if (entry.isIntersecting) ReelAds.evaluate(entry.target);
    });
  });

  ReelAds = {
    isActive(reel) {
      if (reel.dataset.nobookTestVisible === 'true') return true;
      if (reel.getAttribute('aria-hidden') === 'true') return false;
      if (visibleReels.get(reel) === true) return true;
      const rect = reel.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.bottom > 0 &&
        rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
    },
    skip(reel, marker, score) {
      const now = Date.now();
      if (now - (skippedReels.get(reel) || 0) < 1500) return;
      skippedReels.set(reel, now);
      const reelRect = reel.getBoundingClientRect();
      const below = Array.from(reel.parentElement?.children || [])
        .filter(candidate => candidate !== reel && candidate instanceof Element)
        .map(candidate => ({ candidate, rect: candidate.getBoundingClientRect() }))
        .filter(item => item.rect.width > 0 && item.rect.height > 0 &&
          item.rect.top >= reelRect.bottom - 2)
        .sort((left, right) => left.rect.top - right.rect.top)[0]?.candidate || null;
      const next = below || (reel.dataset.nobookTestVisible === 'true'
        ? reel.nextElementSibling : null);
      reel.dataset.nobookAdType = 'REEL';
      reel.style.setProperty('visibility', 'hidden', 'important');
      reel.style.setProperty('pointer-events', 'none', 'important');
      logDecision('REEL', marker, reel, score, 'skipped');
      if (next) {
        next.scrollIntoView?.({ block: 'center', behavior: 'auto' });
      } else {
        const distance = Math.max(reelRect.height, innerHeight * 0.8);
        const scroller = reel.parentElement;
        if (scroller && scroller.scrollHeight > scroller.clientHeight) {
          scroller.scrollBy?.({ top: distance, behavior: 'auto' });
        } else {
          window.scrollBy?.({ top: distance, behavior: 'auto' });
        }
      }
      setTimeout(() => {
        reel.style.removeProperty('visibility');
        reel.style.removeProperty('pointer-events');
      }, 800);
      if (next) requestAnimationFrame(() => this.evaluate(next));
    },
    evaluate(reel) {
      if (!this.isActive(reel)) return;
      const regions = markerRegions(reel).filter(result => result.marker);

      for (const { region, marker } of regions) {
        const explicitOverlay = region.closest(
          '[data-sponsored-overlay], [data-ad-rendering-role="ad"]'
        );
        const liveReelItem = reel.matches('[data-tracking-duration-id]') &&
          reel.parentElement?.matches('[data-type="vscroller"]');
        const overlay = explicitOverlay && explicitOverlay !== reel
          ? explicitOverlay
          : liveReelItem ? null : findOverlayContainer(region, reel);
        if (overlay) {
          const score = 3 + 3 + (hasCta(overlay) ? 1 : 0);
          if (!unchanged(overlay, `overlay:${marker}:${score}`)) {
            hide(overlay, 'REEL', marker, score);
          }
          continue;
        }

        if (liveReelItem) {
          const score = 7 + (hasCta(reel) ? 1 : 0);
          if (!unchanged(reel, `reel-live:${marker}:${score}`)) {
            this.skip(reel, marker, score);
          }
          return;
        }

        const index = metadataIndex(reel, region);
        const score = 3 + (index >= 0 && index <= 2 ? 3 : 0) + (hasCta(reel) ? 1 : 0);
        if (index < 0 || index > 2) {
          logDecision('REEL', marker, reel, score, 'ignored');
          continue;
        }
        if (!unchanged(reel, `reel:${marker}:${index}`)) this.skip(reel, marker, score);
        return;
      }

      if (!regions.length) logDecision('REEL', null, reel, 3, 'ignored');
    },
    process(root) {
      findReels(root).forEach(reel => {
        if (!observedReels.has(reel)) {
          observedReels.add(reel);
          reelVisibilityObserver.observe(reel);
        }
        this.evaluate(reel);
      });
    }
  };

  const MarketplaceAds = {
    selector:
      '[data-pagelet*="Marketplace"] [role="article"], ' +
      '[data-pagelet*="Marketplace"] [role="listitem"], ' +
      '[aria-label*="Marketplace"] [role="article"]',
    process(root) {
      const listings = new Set(root.querySelectorAll?.(this.selector) || []);
      if (root instanceof Element) {
        const listing = root.closest(this.selector);
        if (listing) listings.add(listing);
      }
      listings.forEach(listing => {
        const result = markerRegions(listing).find(({ region, marker }) =>
          marker && metadataIndex(listing, region) >= 0 && metadataIndex(listing, region) <= 2
        );
        const score = 3 + (result ? 3 : 0) + (hasCta(listing) ? 1 : 0);
        if (!result) {
          logDecision('MARKETPLACE', null, listing, score, 'ignored');
          return;
        }
        if (!unchanged(listing, `marketplace:${result.marker}`)) {
          hide(listing, 'MARKETPLACE', result.marker, score);
        }
      });
    }
  };

  const modules = [FeedAds, ReelAds, MarketplaceAds];
  const processRoot = root => modules.forEach(module => module.process(root));

  console.log(`[NobookAdblock] initialized href=${location.origin}${location.pathname}`);
  const initialMarkers = markerRegions(document).filter(result => result.marker);
  console.log(`[NobookAdblock] matchingSponsoredMarkers=${initialMarkers.length}`);

  if (isDesktopMode()) {
    const selector = 'div.sponsored_ad, article[data-ft*="sponsored_ad"]';
    const processDesktop = root => {
      if (root instanceof Element && root.matches(selector)) root.remove();
      root.querySelectorAll?.(selector).forEach(element => element.remove());
    };
    processDesktop(document);
    new MutationObserver(mutations => mutations.forEach(mutation =>
      mutation.addedNodes.forEach(node => {
        if (node instanceof Element) processDesktop(node);
      })
    )).observe(document.body, { childList: true, subtree: true });
    return;
  }

  processRoot(document);

  const pending = new Set();
  let scheduled = false;
  const schedule = root => {
    pending.add(root);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      pending.forEach(processRoot);
      pending.clear();
    });
  };

  new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      const target = mutation.target instanceof Element
        ? mutation.target
        : mutation.target.parentElement;
      if (target) schedule(target);
      mutation.addedNodes.forEach(node => {
        if (node instanceof Element) schedule(node);
      });
    });
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-hidden', 'class']
  });
})();
