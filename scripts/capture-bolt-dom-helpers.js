export function collectStructuredToolbarCandidates(documentRef, url) {
  const root = documentRef ?? document;
  const pageUrl = url ?? window.location.href;
  const classNameFor = (el) => el?.className?.toString?.() ?? '';
  const collect = (selector) =>
    Array.from(root.querySelectorAll(selector)).map((el) => ({
      tag: el.tagName,
      id: el.id,
      classes: classNameFor(el),
      ariaControls: el.getAttribute('aria-controls'),
      ariaHaspopup: el.getAttribute('aria-haspopup'),
      ariaLabel: el.getAttribute('aria-label'),
      dataState: el.getAttribute('data-state'),
      text: (el.textContent ?? '').trim().slice(0, 120),
      outerHtmlPreview: el.outerHTML.slice(0, 600),
    }));

  const publishCandidates = Array.from(root.querySelectorAll('button')).filter(
    (button) =>
      /publish|deploy|share/i.test(button.textContent ?? '') ||
      /publish|deploy/i.test(button.getAttribute('aria-controls') ?? '') ||
      /publish|deploy/i.test(button.getAttribute('aria-label') ?? '')
  );

  return {
    url: pageUrl,
    mlAutoContainers: collect('div.ml-auto, [class*="ml-auto"]'),
    gapContainers: collect('div.flex.gap-1, div.flex.gap-2, div.flex.gap-3'),
    publishButtonByAriaControls: collect('button[aria-controls="publish-menu"]'),
    publishCandidates: publishCandidates.map((button) => ({
      text: (button.textContent ?? '').trim().slice(0, 120),
      ariaControls: button.getAttribute('aria-controls'),
      ariaHaspopup: button.getAttribute('aria-haspopup'),
      ariaLabel: button.getAttribute('aria-label'),
      classes: classNameFor(button),
      outerHtml: button.outerHTML.slice(0, 1500),
      parentClasses: classNameFor(button.parentElement),
      grandparentClasses: classNameFor(button.parentElement?.parentElement),
    })),
    existingGitHubButton: collect('[data-github-upload]'),
  };
}

export function extractToolbarHtml(documentRef) {
  const root = documentRef ?? document;
  const publishOrShareButton =
    root.querySelector('button[aria-controls="publish-menu"]') ??
    Array.from(root.querySelectorAll('button')).find((button) =>
      /^(publish|deploy|share)$/i.test((button.textContent ?? '').trim())
    );

  const candidates = [
    publishOrShareButton?.closest('div.flex.gap-2, div.flex.gap-3'),
    root.querySelector('div.ml-auto > div.flex.gap-2'),
    root.querySelector('div.ml-auto > div.flex.gap-3'),
    root.querySelector('div.ml-auto'),
  ].filter(Boolean);
  if (candidates.length === 0) return null;

  const container =
    candidates[0].closest('header, nav, [class*="toolbar"]') ?? candidates[0].parentElement;
  return container?.outerHTML?.slice(0, 12000) ?? candidates[0].outerHTML.slice(0, 12000);
}
