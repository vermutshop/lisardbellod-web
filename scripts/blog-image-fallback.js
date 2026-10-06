// Old third-party hosts can disappear; keep the archive readable when they do.
for (const image of document.querySelectorAll('.blog-card-image img, .blog-article-content img, .blog-article-image img')) {
  const replace = () => {
    const cardImage = image.closest('.blog-card-image');
    if (cardImage) {
      const year = image.closest('.blog-card')?.querySelector('time')?.dateTime?.slice(0, 4) || '—';
      const placeholder = document.createElement('div');
      placeholder.className = 'blog-no-image';
      const label = document.createElement('span');
      label.textContent = year;
      placeholder.append(label);
      cardImage.replaceChildren(placeholder);
      return;
    }
    const cover = image.closest('.blog-article-image');
    if (cover) {
      cover.remove();
      return;
    }
    const placeholder = document.createElement('span');
    placeholder.className = 'blog-image-unavailable';
    placeholder.textContent = 'Imagen original no disponible';
    image.replaceWith(placeholder);
  };
  image.addEventListener('error', replace, { once: true });
  if (image.complete && image.naturalWidth === 0) replace();
}
