"""Shared article navigation and footer for the whole migrated blog.

Edit social links or footer copy here, then rebuild the archive to update every page.
"""

import html

YOUTUBE_URL = "https://www.youtube.com/@LisardBellod"
INSTAGRAM_URL = "https://www.instagram.com/lisardbellod/"


def footer() -> str:
    return f"""<footer class="site-footer blog-shared-footer">
      <div class="container blog-footer-inner">
        <div><p class="eyebrow">Sigue la historia</p><h2>Nos vemos también fuera del blog.</h2>
          <p>Vídeos, pruebas y lo que voy aprendiendo por el camino.</p></div>
        <div class="blog-footer-actions">
          <a class="button primary" href="{YOUTUBE_URL}" target="_blank" rel="noopener noreferrer">YouTube</a>
          <a class="button secondary" href="{INSTAGRAM_URL}" target="_blank" rel="noopener noreferrer">Instagram</a>
        </div>
      </div>
    </footer>"""


def article_navigation(previous, following, link_for) -> str:
    links = []
    if previous:
        links.append(f'<a href="{html.escape(link_for(previous), quote=True)}"><span>← Anterior</span><strong>{html.escape(html.unescape(previous["title"]))}</strong></a>')
    if following:
        links.append(f'<a href="{html.escape(link_for(following), quote=True)}"><span>Siguiente →</span><strong>{html.escape(html.unescape(following["title"]))}</strong></a>')
    return f'<nav class="blog-article-navigation" aria-label="Otros artículos">{"".join(links)}</nav>'
