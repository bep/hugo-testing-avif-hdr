const gallery = document.querySelector('.gallery');
const lightbox = document.querySelector('.lightbox');
const lightboxImage = lightbox?.querySelector('.lightbox__image');
const lightboxClose = lightbox?.querySelector('.lightbox__close');
const allFormatOptions = Array.from(
  document.querySelectorAll('.format-switch__option'),
);
const lightboxOptions = allFormatOptions.filter((b) =>
  b.closest('.format-switch--lightbox'),
);
const FORMATS = ['hdr', 'sdr'];

let currentSources = null;
let currentFormat = gallery?.dataset.format ?? 'hdr';
let currentAnchor = null;
let lastFocus = null;
let swapGen = 0;

const isLightboxOpen = () => lightbox && !lightbox.hidden;

function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });
}

function loadSourcesFromAnchor(anchor) {
  const sources = {};
  for (const fmt of FORMATS) {
    const src = anchor.dataset[fmt];
    if (src) sources[fmt] = src;
  }
  currentSources = sources;
  for (const btn of lightboxOptions) {
    btn.disabled = !sources[btn.dataset.format];
  }
}

// Apply the format choice to all "chrome" — gallery anchor hrefs + thumb
// img.src, and the is-active state on every .format-switch__option.
function applyFormatToChrome(format) {
  if (!gallery) return;
  gallery.dataset.format = format;
  for (const a of gallery.querySelectorAll('a')) {
    const url = a.dataset[format];
    const thumb = a.dataset[`${format}Thumb`];
    if (url) a.href = url;
    const img = a.querySelector('img');
    if (img && thumb) img.src = thumb;
  }
  for (const btn of allFormatOptions) {
    const isActive = btn.dataset.format === format;
    btn.classList.toggle('is-active', isActive);
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
}

// Swap the lightbox image, crossfading via the View Transitions API.
// `mutate` (optional) runs inside the transition callback so chrome
// updates land in the same snapshot as the image swap.
async function swapImage(src, mutate) {
  const apply = () => {
    if (mutate) mutate();
    lightboxImage.src = src;
  };

  if (!lightboxImage.hasAttribute('src') || !document.startViewTransition) {
    apply();
    return;
  }

  const gen = ++swapGen;
  await preloadImage(src);
  if (gen !== swapGen) return;
  document.startViewTransition(apply);
}

function setFormat(format) {
  if (currentFormat === format) return;
  if (!FORMATS.includes(format)) return;

  if (isLightboxOpen()) {
    if (!currentSources?.[format]) return;
    currentFormat = format;
    swapImage(currentSources[format], () => applyFormatToChrome(format));
  } else {
    currentFormat = format;
    if (document.startViewTransition) {
      document.startViewTransition(() => applyFormatToChrome(format));
    } else {
      applyFormatToChrome(format);
    }
  }
}

function openLightbox(anchor) {
  currentAnchor = anchor;
  loadSourcesFromAnchor(anchor);
  const startFormat = currentSources[currentFormat]
    ? currentFormat
    : Object.keys(currentSources)[0];
  if (!startFormat) return;
  if (startFormat !== currentFormat) {
    currentFormat = startFormat;
    applyFormatToChrome(startFormat);
  }
  lightboxImage.src = currentSources[startFormat];

  lastFocus = document.activeElement;
  lightbox.hidden = false;
  lightbox.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lightbox-open');
  lightboxClose.focus();
}

function closeLightbox() {
  if (!isLightboxOpen()) return;
  lightbox.hidden = true;
  lightbox.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lightbox-open');
  lightboxImage.removeAttribute('src');
  currentSources = null;
  currentAnchor = null;
  if (lastFocus instanceof HTMLElement) lastFocus.focus();
}

function toggleFormat() {
  if (isLightboxOpen()) {
    if (!currentSources) return;
    const idx = FORMATS.indexOf(currentFormat);
    for (let i = 1; i <= FORMATS.length; i++) {
      const next = FORMATS[(idx + i) % FORMATS.length];
      if (currentSources[next]) {
        setFormat(next);
        return;
      }
    }
  } else {
    const idx = FORMATS.indexOf(currentFormat);
    const next = FORMATS[(idx + 1) % FORMATS.length];
    setFormat(next);
  }
}

function gotoImage(delta) {
  if (!currentAnchor || !gallery) return;
  const anchors = Array.from(gallery.querySelectorAll('a'));
  const i = anchors.indexOf(currentAnchor);
  if (i < 0) return;
  const next = anchors[(i + delta + anchors.length) % anchors.length];
  if (next === currentAnchor) return;
  currentAnchor = next;
  loadSourcesFromAnchor(next);
  const preferred = currentSources[currentFormat]
    ? currentFormat
    : Object.keys(currentSources)[0];
  if (!preferred) return;
  if (preferred === currentFormat) {
    swapImage(currentSources[preferred]);
  } else {
    currentFormat = preferred;
    swapImage(currentSources[preferred], () => applyFormatToChrome(preferred));
  }
}

if (gallery && lightbox) {
  gallery.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || !gallery.contains(a)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    openLightbox(a);
  });

  lightboxClose.addEventListener('click', closeLightbox);

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  for (const btn of allFormatOptions) {
    btn.addEventListener('click', () => setFormat(btn.dataset.format));
  }

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartT = 0;
  let touchTracking = false;
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) {
      touchTracking = false;
      return;
    }
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartT = performance.now();
    touchTracking = true;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!touchTracking || e.changedTouches.length !== 1) return;
    touchTracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (performance.now() - touchStartT > 600) return;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < 50) return;
    const isVertical = absY > absX;
    if (isLightboxOpen()) {
      if (isVertical) gotoImage(dy < 0 ? 1 : -1);
      else toggleFormat();
    } else if (!isVertical) {
      toggleFormat();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.matches('input, textarea, select, [contenteditable]')) return;

  if (isLightboxOpen()) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeLightbox();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      gotoImage(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      gotoImage(1);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      toggleFormat();
    }
    return;
  }

  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  toggleFormat();
});
