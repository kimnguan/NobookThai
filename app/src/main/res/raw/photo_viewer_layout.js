// First-open layout correction for a Facebook comment photo overlay.
// Facebook measures the new viewer once, during insertion. On that first
// insertion the comment image may still be undecoded and this WebView may
// still be shortened by IME padding. The same overlay measures correctly
// when it is opened again. This waits until the image has decoded and the
// visual viewport height has stopped changing, then dispatches one resize
// only if that measurement is still wrong.
(() => {
  if (window.__nobookPhotoViewerLayout) return;
  window.__nobookPhotoViewerLayout = true;

  const OVERLAY = '[role="dialog"], [aria-modal="true"], [data-sigil*="photo"]';
  const COMMENT_HOST = '[role="dialog"], [aria-modal="true"], [data-pagelet*="Comment"], [data-pagelet*="comment"]';
  const seen = new WeakSet();
  let expectViewer = false;
  let openCount = 0;

  const heightNow = () => window.visualViewport?.height || window.innerHeight;

  const rectOf = (element) => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return [
      Math.round(rect.x),
      Math.round(rect.y),
      Math.round(rect.width),
      Math.round(rect.height)
    ];
  };

  const report = (phase, viewer, img, inserted, action) => {
    const viewport = window.visualViewport;
    const snapshot = {
      phase,
      inserted,
      action,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      clientWidth: document.documentElement.clientWidth,
      clientHeight: document.documentElement.clientHeight,
      visualWidth: viewport ? Math.round(viewport.width) : null,
      visualHeight: viewport ? Math.round(viewport.height) : null,
      visualOffsetTop: viewport ? Math.round(viewport.offsetTop) : null,
      naturalWidth: img ? img.naturalWidth : 0,
      naturalHeight: img ? img.naturalHeight : 0,
      imageClientWidth: img ? img.clientWidth : 0,
      imageClientHeight: img ? img.clientHeight : 0,
      imageRect: rectOf(img),
      viewerRect: rectOf(viewer),
      complete: img ? img.complete : false,
      imeBottomPx: window.__nobookImeBottomPx || 0
    };
    window.__nobookPhotoViewerResult = snapshot;
    console.log('[NobookPhotoViewer] ' + JSON.stringify(snapshot));
  };

  const setViewerOpen = (open) => {
    openCount += open ? 1 : -1;
    if (openCount < 0) openCount = 0;
    try {
      window.PhotoViewerBridge?.onVisibility?.(openCount > 0);
    } catch (error) {}
  };

  const layoutBroken = (img, viewer) => {
    const viewerRect = viewer.getBoundingClientRect();
    const imageRect = img.getBoundingClientRect();
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    if (!naturalWidth || !naturalHeight || viewerRect.width < 1 || viewerRect.height < 1) return false;
    if (imageRect.width < 1 || imageRect.height < 1) return false;

    const visibleWidth = Math.max(0, Math.min(imageRect.right, viewerRect.right) - Math.max(imageRect.left, viewerRect.left));
    const visibleHeight = Math.max(0, Math.min(imageRect.bottom, viewerRect.bottom) - Math.max(imageRect.top, viewerRect.top));
    const visibleFraction = (visibleWidth * visibleHeight) / (imageRect.width * imageRect.height);
    const fit = getComputedStyle(img).objectFit;
    if ((fit === 'contain' || fit === 'scale-down') &&
        visibleFraction > 0.92 &&
        imageRect.width >= viewerRect.width * 0.9 &&
        imageRect.height >= viewerRect.height * 0.9) {
      return false;
    }

    const frame = img.parentElement && viewer.contains(img.parentElement) ? img.parentElement : viewer;
    const frameRect = frame.getBoundingClientRect();
    const scale = Math.min(frameRect.width / naturalWidth, frameRect.height / naturalHeight);
    if (!scale) return false;
    const expectedWidth = naturalWidth * scale;
    const expectedHeight = naturalHeight * scale;
    const heightGap = Math.abs(imageRect.height - expectedHeight) / expectedHeight;
    const widthGap = Math.abs(imageRect.width - expectedWidth) / expectedWidth;
    const frameShort = frame !== viewer &&
      frameRect.width > viewerRect.width * 0.75 &&
      frameRect.height < viewerRect.height * 0.55 &&
      viewerRect.height > heightNow() * 0.75;
    return heightGap > 0.18 || widthGap > 0.18 || visibleFraction < 0.72 || frameShort;
  };

  const whenDecoded = (img) => new Promise((resolve) => {
    const finish = () => {
      if (!img.decode) {
        resolve();
        return;
      }
      img.decode().then(resolve).catch(resolve);
    };
    if (img.naturalWidth > 0) finish();
    else {
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    }
  });

  const whenStable = (waitForImeClear) => new Promise((resolve) => {
    let last = heightNow();
    let stable = 0;
    let waitingForClear = waitForImeClear && !!window.PhotoViewerBridge;
    const tick = () => {
      const height = heightNow();
      const ime = window.__nobookImeBottomPx || 0;
      if (waitingForClear && ime === 0) {
        waitingForClear = false;
        stable = 0;
      }
      stable = height === last ? stable + 1 : 0;
      last = height;
      if (!waitingForClear && stable >= 2) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const release = (viewer) => {
    if (!viewer.__nobookPhotoViewerOpen) return;
    viewer.__nobookPhotoViewerOpen = false;
    setViewerOpen(false);
  };

  const correct = async (viewer, img) => {
    const imeOpen = (window.__nobookImeBottomPx || 0) > 0;
    report('open', viewer, img, true, 'measure');
    if (imeOpen) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA)$/.test(active.tagName))) {
        active.blur();
      }
    }
    viewer.__nobookPhotoViewerOpen = true;
    setViewerOpen(true);
    await whenDecoded(img);
    await whenStable(imeOpen);
    const broken = layoutBroken(img, viewer);
    report('settled', viewer, img, true, broken ? 'resize' : 'none');
    if (!broken || !viewer.isConnected) {
      report('final', viewer, img, true, 'none');
      return;
    }
    window.dispatchEvent(new Event('resize'));
    await whenStable(false);
    report('final', viewer, img, true, 'resize');
  };

  const imageIn = (viewer) => {
    const images = [...viewer.querySelectorAll('img')]
      .filter((img) => img.getAttribute('width') !== '16' && !img.hidden);
    images.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));
    return images[0] || null;
  };

  const arm = (viewer) => {
    if (seen.has(viewer)) return;
    const start = (img) => {
      if (!img || seen.has(viewer)) return;
      seen.add(viewer);
      viewer.dataset.nobookArmed = '1';
      expectViewer = false;
      correct(viewer, img);
    };
    const existing = imageIn(viewer);
    if (existing) {
      start(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      const img = imageIn(viewer);
      if (!img) return;
      observer.disconnect();
      start(img);
    });
    observer.observe(viewer, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  };

  const addedViewer = (node) => {
    if (!(node instanceof Element)) return null;
    if (node.matches(OVERLAY)) return node;
    return node.querySelector(OVERLAY);
  };

  document.addEventListener('pointerdown', (event) => {
    const target = event.target instanceof Element ? event.target.closest('img') : null;
    const host = target?.closest(COMMENT_HOST);
    const rect = target?.getBoundingClientRect();
    expectViewer = !!(
      target &&
      host &&
      !seen.has(host) &&
      rect &&
      rect.width >= 64 &&
      rect.height >= 64
    );
  }, true);

  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.removedNodes.forEach((node) => {
        if (node instanceof Element && node.__nobookPhotoViewerOpen) release(node);
        node.querySelectorAll?.(OVERLAY).forEach((viewer) => {
          if (viewer.__nobookPhotoViewerOpen) release(viewer);
        });
      });
      if (!expectViewer) continue;
      mutation.addedNodes.forEach((node) => {
        const viewer = addedViewer(node);
        if (viewer) arm(viewer);
      });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
