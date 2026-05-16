document.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.matches('input, textarea, select, [contenteditable]')) return;
  const inactive = document.querySelector(
    '.format-switch__option:not(.is-active)',
  );
  if (inactive instanceof HTMLAnchorElement) {
    e.preventDefault();
    inactive.click();
  }
});
