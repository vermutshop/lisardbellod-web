"""Build a local, noindex preview from the public lisard.es WordPress inventory."""

from __future__ import annotations

import html
import json
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from blog_layout import article_navigation, footer
from blog_links import BlogLinks

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "data/blog/inventory.json"
OUTPUT = ROOT / "blog-preview"
SAMPLE_IDS = [8561, 8556, 8549, 7887, 6752, 6844, 11]

ALLOWED_TAGS = {
    "p", "br", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "strong", "b",
    "em", "i", "a", "img", "figure", "figcaption", "div", "span", "hr", "pre", "code",
}
VOID_TAGS = {"br", "img", "hr"}
SKIP_TAGS = {"script", "style", "form", "button", "svg"}
VOID_SKIPPED_TAGS = {"input", "param"}


def youtube_id(raw: str) -> str | None:
    url = html.unescape(raw).strip()
    parsed = urlparse(url)
    host = (parsed.hostname or "").casefold()
    parts = [part for part in parsed.path.split("/") if part]
    candidate = None
    if host in {"youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"}:
        if len(parts) >= 2 and parts[0] in {"embed", "v", "shorts", "live"}:
            candidate = parts[1].split("&", 1)[0]
        elif parts == ["watch"]:
            candidate = parse_qs(parsed.query).get("v", [None])[0]
    elif host in {"youtu.be", "www.youtu.be"} and parts:
        candidate = parts[0]
    return candidate if candidate and re.fullmatch(r"[A-Za-z0-9_-]{11}", candidate) else None


def youtube_player(video_id: str, title: str = "Vídeo de YouTube") -> str:
    safe_title = html.escape(title or "Vídeo de YouTube", quote=True)
    return (f'<div class="blog-video"><iframe src="https://www.youtube-nocookie.com/embed/{video_id}" '
            f'title="{safe_title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" '
            f'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" '
            f'allowfullscreen></iframe><a href="https://www.youtube.com/watch?v={video_id}" '
            f'target="_blank" rel="noopener noreferrer">Ver vídeo en YouTube ↗</a></div>')


def safe_url(raw: str) -> str:
    value = html.unescape(raw).strip()
    parsed = urlparse(value)
    if parsed.scheme in {"https", "http"}:
        return value
    if not parsed.scheme and not value.startswith(("//", "\\", "#")):
        return value
    if value.startswith("#"):
        return value
    return ""


class ArticleSanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip_depth = 0
        self.iframe_depth = 0
        self.object_depth = 0
        self.object_video = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if self.iframe_depth:
            if tag == "iframe":
                self.iframe_depth += 1
            return
        if self.object_depth:
            if tag == "object":
                self.object_depth += 1
            elif tag in {"param", "embed"} and not self.object_video:
                self.object_video = youtube_id(attributes.get("value") or attributes.get("src") or "")
            return
        if self.skip_depth:
            if tag in SKIP_TAGS:
                self.skip_depth += 1
            return
        if tag in SKIP_TAGS:
            self.skip_depth = 1
            return
        if tag in VOID_SKIPPED_TAGS:
            return
        if tag == "iframe":
            video_id = youtube_id(attributes.get("data-src") or attributes.get("data-lazy-src") or attributes.get("src") or "")
            if video_id:
                self.parts.append(youtube_player(video_id, attributes.get("title", "")))
            self.iframe_depth = 1
            return
        if tag == "object":
            self.object_depth = 1
            self.object_video = youtube_id(attributes.get("data") or "")
            return
        if tag == "embed":
            video_id = youtube_id(attributes.get("src") or "")
            if video_id:
                self.parts.append(youtube_player(video_id))
            return
        if tag not in ALLOWED_TAGS:
            return
        clean = []
        if tag == "a":
            href = safe_url(attributes.get("href", ""))
            if href:
                clean.append(f' href="{html.escape(href, quote=True)}"')
                if href.startswith(("http://", "https://")):
                    clean.append(' rel="noopener noreferrer"')
        elif tag == "img":
            src = safe_url(attributes.get("data-src") or attributes.get("data-lazy-src") or attributes.get("src", ""))
            if not src:
                return
            clean.append(f' src="{html.escape(src, quote=True)}"')
            clean.append(f' alt="{html.escape(attributes.get("alt", ""), quote=True)}"')
            clean.append(' loading="lazy"')
        self.parts.append(f"<{tag}{''.join(clean)}>")

    def handle_endtag(self, tag):
        if self.iframe_depth:
            if tag == "iframe":
                self.iframe_depth -= 1
            return
        if self.object_depth:
            if tag == "object":
                self.object_depth -= 1
                if not self.object_depth and self.object_video:
                    self.parts.append(youtube_player(self.object_video))
                    self.object_video = None
            return
        if self.skip_depth:
            if tag in SKIP_TAGS:
                self.skip_depth -= 1
            return
        if tag in ALLOWED_TAGS and tag not in VOID_TAGS:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data):
        if not (self.skip_depth or self.iframe_depth or self.object_depth):
            self.parts.append(html.escape(data))


def clean_article(markup: str) -> str:
    parser = ArticleSanitizer()
    parser.feed(markup)
    return "".join(parser.parts)


def text_only(markup: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", markup))).strip()


def excerpt(markup: str, limit=190) -> str:
    value = text_only(markup)
    return value[:limit].rsplit(" ", 1)[0] + "…" if len(value) > limit else value


def date_label(value: str) -> str:
    months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    date = datetime.fromisoformat(value)
    return f"{date.day} de {months[date.month - 1]} de {date.year}"


def page(content: str, title: str) -> str:
    up = "../"
    return f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>{html.escape(title)} | Vista previa del blog | Lisard Bellod</title>
  <link rel="stylesheet" href="{up}styles/main.css">
  <link rel="stylesheet" href="{up}styles/blog.css">
</head>
<body>
  <header class="site-header"><div class="container nav"><a class="brand" href="{up}index.html">Lisard Bellod</a><a class="preview-back" href="{up}blog-preview/index.html">Vista previa del blog</a></div></header>
  <main>{content}</main>
  {footer()}
</body>
</html>"""


def category_names(post, categories):
    selected = [categories[id]["name"] for id in post["categories"] if id in categories and id != 1]
    return selected or [categories[id]["name"] for id in post["categories"] if id in categories]


inventory = json.loads(INVENTORY.read_text())
posts = {post["id"]: post for post in inventory["posts"]}
ordered_posts = sorted(posts.values(), key=lambda item: (item["published"], item["id"]), reverse=True)
post_positions = {post["id"]: index for index, post in enumerate(ordered_posts)}
categories = {category["id"]: category for category in inventory["categories"]}
media = {record["id"]: record["thumbnailUrl"] for record in inventory["media"]}
links = BlogLinks(posts.values(), categories.values())

OUTPUT.mkdir(exist_ok=True)
cards = []
for post_id in SAMPLE_IDS:
    post = posts[post_id]
    position = post_positions[post_id]
    title = html.unescape(post["title"])
    escaped_title = html.escape(title)
    link = f"{post['slug']}.html"
    labels = category_names(post, categories)
    category = html.escape(labels[0] if labels else "Archivo")
    published = date_label(post["published"])
    image_url = media.get(post["featuredMediaId"])
    image = (
        f'<img src="{html.escape(image_url, quote=True)}" alt="" loading="lazy">'
        if image_url else f'<div class="blog-no-image"><span>{html.escape(str(datetime.fromisoformat(post["published"]).year))}</span></div>'
    )
    cards.append(f"""<a class="blog-card" href="{link}">
      <div class="blog-card-image">{image}</div>
      <div class="blog-card-body"><p class="blog-card-meta">{category} · <time datetime="{post['published']}">{published}</time></p>
      <h2>{escaped_title}</h2><p>{html.escape(excerpt(post['excerptHtml'] or post['contentHtml']))}</p></div>
    </a>""")
    article = f"""<section class="container blog-article-shell">
      <p class="eyebrow"><a href="./index.html">Archivo del blog</a> / {category}</p>
      <h1>{escaped_title}</h1>
      <p class="blog-article-date">Lisard Bellod · <time datetime="{post['published']}">{published}</time></p>
      {f'<div class="blog-article-image">{image}</div>' if image_url else ''}
      <div class="blog-article-content">{links.rewrite(clean_article(post['contentHtml']), post['url'])}</div>
      {article_navigation(ordered_posts[position - 1] if position else None,
                          ordered_posts[position + 1] if position + 1 < len(ordered_posts) else None,
                          lambda item: f"/blog-draft/{item['slug']}/")}
    </section>"""
    (OUTPUT / link).write_text(page(article, title))

landing = f"""<section class="container blog-preview-hero"><p class="eyebrow">Archivo personal</p>
  <h1>Mis historias, desde 2006.</h1>
  <p class="lead">Una muestra de {len(SAMPLE_IDS)} publicaciones entre las {inventory['expected']:,} que forman mi archivo personal. Las fechas y categorías proceden del blog original.</p>
  <p class="blog-preview-note">Vista previa local · Falta revisar medios, enlaces y metadatos antes de publicar el archivo completo.</p>
</section>
<section class="container blog-preview-list"><div class="blog-preview-heading"><h2>De ayer a hoy</h2><p>Artículos con imagen y sin ella, tal como aparecen en el archivo.</p></div>
<div class="blog-grid">{''.join(cards)}</div></section>"""
(OUTPUT / "index.html").write_text(page(landing, "Archivo del blog"))
print(f"Built {len(cards)} article previews in {OUTPUT}")
