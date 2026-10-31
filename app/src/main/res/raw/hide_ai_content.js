(() => {
  if (window.__nobookHideAiContent) return;
  window.__nobookHideAiContent = true;

  const LABELS = new Set([
    'เนื้อหาที่สร้างโดย ai',
    'content created by ai',
    'made with ai',
    'ai info'
  ]);
  const processed = new WeakSet();
  const normalize = text => (text || '').normalize('NFKC')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\s+/g, ' ').trim().toLocaleLowerCase();

  const isExactBadge = element => {
    const text = normalize(element.textContent);
    return LABELS.has(text) && !Array.from(element.children)
      .some(child => LABELS.has(normalize(child.textContent)));
  };
  const hasControls = element =>
    element.querySelectorAll('button, [role="button"]').length >= 2 ||
    Boolean(element.querySelector('footer, [role="toolbar"]'));

  const findFeedPost = badge => {
    const article = badge.closest('[role="article"]');
    if (article) return article;
    for (let node = badge.parentElement, depth = 0;
      node && depth < 10 && !node.matches('body, main, [role="main"], [role="feed"]');
      node = node.parentElement, depth++) {
      const hasMedia = Boolean(node.querySelector('img, picture, video, [role="img"]'));
      if (hasMedia && hasControls(node)) return node;
    }
    return null;
  };

  const findVideoContent = badge => {
    for (let node = badge.parentElement, depth = 0; node && depth < 12;
      node = node.parentElement, depth++) {
      if (node.querySelector('video') && (
        node.hasAttribute('data-tracking-duration-id') ||
        node.matches('.vertically-snappable, [data-reel-container], [data-story-container]')
      )) return node;
    }
    return null;
  };

  const hideBadgeContent = badge => {
    if (processed.has(badge)) return;
    processed.add(badge);
    const path = location.pathname.toLocaleLowerCase();
    const videoContent = findVideoContent(badge);
    const type = path.includes('/stories/') ? 'STORY' : videoContent ? 'REEL' : 'FEED';
    const container = videoContent || findFeedPost(badge);
    if (!container || container.dataset.nobookAiHidden === 'true') return;
    container.dataset.nobookAiHidden = 'true';
    const next = type === 'REEL' || type === 'STORY' ? container.nextElementSibling : null;
    container.style.display = 'none';
    next?.scrollIntoView?.({ block: 'center' });
    console.log(`[NobookAI] type=${type} action=hidden`);
  };

  const process = root => {
    const candidates = [];
    if (root instanceof Element && root.matches('span, div, a, button')) candidates.push(root);
    root.querySelectorAll?.('span, div, a, button').forEach(element => candidates.push(element));
    candidates.filter(isExactBadge).forEach(hideBadgeContent);
  };

  process(document.body);
  new MutationObserver(mutations => mutations.forEach(mutation =>
    mutation.addedNodes.forEach(node => {
      if (node instanceof Element) process(node);
    })
  )).observe(document.body, { childList: true, subtree: true });
})();
