"""Build the complete local blog draft from the public WordPress inventory.

The draft is intentionally noindex and keeps source media URLs until those files
are copied and verified. It is not ready to deploy as the final /blog/ archive.
"""

from __future__ import annotations

import html
import json
import math
import re
import runpy
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime
from pathlib import Path
from blog_layout import article_navigation, footer
from blog_links import BlogLinks
from blog_seo import SITE, head
from blog_assets import BlogAssets

ROOT = Path(__file__).resolve().parents[1]
PRODUCTION = "--production" in sys.argv
BASE = "/blog/" if PRODUCTION else "/blog-draft/"
OUT = ROOT / ("blog" if PRODUCTION else "blog-draft")
PAGE_SIZE = 24
helpers = runpy.run_path(str(ROOT / "scripts/build-blog-preview.py"))
clean_article = helpers["clean_article"]
excerpt = helpers["excerpt"]
date_label = helpers["date_label"]
category_names = helpers["category_names"]

inventory = json.loads((ROOT / "data/blog/inventory.json").read_text())
posts = sorted(inventory["posts"], key=lambda post: (post["published"], post["id"]), reverse=True)
title_counts = Counter(html.unescape(post["title"]).casefold() for post in posts)
categories = {category["id"]: category for category in inventory["categories"]}
media = {item["id"]: item for item in inventory["media"]}
links = BlogLinks(posts, categories.values(), BASE)
assets = BlogAssets(ROOT)


def write(relative: str, content: str):
    destination = OUT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text("\n".join(line.rstrip() for line in content.splitlines()) + "\n")


def page(content: str, title: str, description: str, canonical_path: str, post=None, image_url=None):
    full_title = f"{title} | Lisard Bellod"
    return f"""<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(full_title)}</title>
{head(full_title, description, canonical_path, draft=not PRODUCTION, post=post, image_url=image_url)}
<link rel="stylesheet" href="/styles/main.css"><link rel="stylesheet" href="/styles/blog.css">
</head><body>
<header class="site-header"><div class="container nav"><a class="brand" href="/index.html">Lisard Bellod</a><a class="preview-back" href="{BASE}">Archivo del blog</a></div></header>
<main>{content}</main>
{footer()}
<script defer src="/scripts/blog-image-fallback.js"></script>
</body></html>"""


def label(post):
    return html.unescape(category_names(post, categories)[0] if post["categories"] else "Archivo")


def category_for(post):
    return next((categories[id] for id in post["categories"] if id in categories and id != 1),
                next((categories[id] for id in post["categories"] if id in categories), None))


def card(post):
    title = html.unescape(post["title"])
    alt = html.escape(title, quote=True)
    item = media.get(post["featuredMediaId"])
    image_url = item["thumbnailUrl"] if item else None
    if not image_url:
        match = re.search(r'<img\b[^>]*\bsrc=["\']([^"\']+)', post["contentHtml"], re.I)
        image_url = match.group(1) if match else None
    if image_url:
        local = assets.local(image_url)
        image_url = local or (None if PRODUCTION and assets.old_site(image_url) else image_url)
    image = (
        f'<img src="{html.escape(image_url, quote=True)}" alt="{alt}" loading="lazy">'
        if image_url else f'<div class="blog-no-image"><span>{post["published"][:4]}</span></div>'
    )
    return f"""<a class="blog-card" href="{BASE}{html.escape(post['slug'], quote=True)}/">
<div class="blog-card-image">{image}</div><div class="blog-card-body">
<p class="blog-card-meta">{html.escape(label(post))} · <time datetime="{post['published']}">{date_label(post['published'])}</time></p>
<h2>{html.escape(title)}</h2><p>{html.escape(excerpt(post['excerptHtml'] or post['contentHtml']))}</p>
</div></a>"""


def article(post, index):
    title = html.unescape(post["title"])
    category = html.escape(label(post))
    category_record = category_for(post)
    breadcrumb_category = (
        f'<a href="{BASE}categoria/{html.escape(category_record["slug"], quote=True)}/">{category}</a>'
        if category_record else category
    )
    image = media.get(post["featuredMediaId"])
    cover = ""
    social_image = None
    if image:
        image_alt = image["alt"] or title
        cover_url = assets.local(image["sourceUrl"])
        if cover_url:
            social_image = SITE + cover_url
        elif not PRODUCTION:
            cover_url = image["sourceUrl"]
        if cover_url:
            cover = f'<div class="blog-article-image"><img src="{html.escape(cover_url, quote=True)}" alt="{html.escape(image_alt, quote=True)}"></div>'
    body = assets.rewrite(clean_article(post["contentHtml"]), replace_missing=PRODUCTION)
    body = links.rewrite(body, post["url"], remove_unresolved=PRODUCTION)
    content = f"""<section class="container blog-article-shell">
<p class="eyebrow"><a href="{BASE}">Archivo del blog</a> / {breadcrumb_category}</p>
<h1>{html.escape(title)}</h1>
<p class="blog-article-date">Lisard Bellod · <time datetime="{post['published']}">{date_label(post['published'])}</time></p>
{cover}<div class="blog-article-content">{body}</div>
{article_navigation(posts[index - 1] if index else None,
                    posts[index + 1] if index + 1 < len(posts) else None,
                    lambda item: f"{BASE}{item['slug']}/")}
</section>"""
    description = excerpt(post["excerptHtml"] or post["contentHtml"], 155) or f"{title}, una publicación de Lisard Bellod."
    seo_title = title if title_counts[title.casefold()] == 1 else f"{title} — {date_label(post['published'])}"
    return page(content, seo_title, description, f"/blog/{post['slug']}/", post, social_image)


def listing(title: str, subtitle: str, selected: list, base: str, page_number: int):
    start = (page_number - 1) * PAGE_SIZE
    subset = selected[start:start + PAGE_SIZE]
    total_pages = math.ceil(len(selected) / PAGE_SIZE)
    nav = []
    if page_number > 1:
        before = base if page_number == 2 else f"{base}pagina/{page_number - 1}/"
        nav.append(f'<a class="button secondary" href="{before}">← Anterior</a>')
    if page_number < total_pages:
        nav.append(f'<a class="button secondary" href="{base}pagina/{page_number + 1}/">Siguiente →</a>')
    body = f"""<section class="container blog-preview-hero"><p class="eyebrow">Archivo personal</p>
<h1>{html.escape(title)}</h1><p class="lead">{html.escape(subtitle)}</p>
{'' if PRODUCTION else '<p class="blog-preview-note">Borrador local · Imágenes y enlaces pendientes de revisión final.</p>'}</section>
<section class="container blog-preview-list"><div class="blog-grid">{''.join(map(card, subset))}</div>
<nav class="blog-pagination" aria-label="Páginas del archivo">{''.join(nav)}<span>Página {page_number} de {total_pages}</span></nav></section>"""
    relative = base.removeprefix(BASE)
    relative += "index.html" if page_number == 1 else f"pagina/{page_number}/index.html"
    canonical_path = base.replace(BASE, "/blog/", 1)
    if page_number > 1:
        canonical_path += f"pagina/{page_number}/"
    page_title = title if page_number == 1 else f"{title} — página {page_number}"
    write(relative, page(body, page_title, subtitle, canonical_path))


for index, post in enumerate(posts):
    write(f"{post['slug']}/index.html", article(post, index))

years = Counter(post["published"][:4] for post in posts)
category_counts = Counter(id for post in posts for id in post["categories"])
category_links = "".join(
    f'<a class="button secondary" href="{BASE}categoria/{html.escape(category["slug"], quote=True)}/">{html.escape(html.unescape(category["name"]))} ({category_counts[category["id"]]})</a>'
    for category in sorted(categories.values(), key=lambda item: (-category_counts[item["id"]], item["name"]))
    if category_counts[category["id"]]
)
year_links = "".join(
    f'<a class="button secondary" href="{BASE}ano/{year}/">{year} ({count})</a>'
    for year, count in sorted(years.items(), reverse=True)
)

for number in range(1, math.ceil(len(posts) / PAGE_SIZE) + 1):
    listing("Mis historias, desde 2006.", f"{len(posts):,} artículos de mi archivo personal.", posts, BASE, number)

index_path = OUT / "index.html"
index_html = index_path.read_text()
index_html = index_html.replace('<section class="container blog-preview-list">',
    f'<section class="container blog-preview-list"><div class="blog-filters">'
    f'<details><summary>Categorías ({len(categories)})</summary><div class="blog-filter-links">{category_links}</div></details>'
    f'<details><summary>Publicaciones por año</summary><div class="blog-filter-links">{year_links}</div></details>'
    f'</div><h2 class="blog-list-title">Últimas publicaciones</h2>')
index_path.write_text(index_html)

for category in categories.values():
    selected = [post for post in posts if category["id"] in post["categories"]]
    if not selected:
        continue
    base = f'{BASE}categoria/{category["slug"]}/'
    for number in range(1, math.ceil(len(selected) / PAGE_SIZE) + 1):
        listing(html.unescape(category["name"]), f"{len(selected)} artículos en esta categoría.", selected, base, number)

for year, count in years.items():
    selected = [post for post in posts if post["published"].startswith(year)]
    base = f"{BASE}ano/{year}/"
    for number in range(1, math.ceil(count / PAGE_SIZE) + 1):
        listing(f"Publicaciones de {year}", f"{count} artículos publicados en {year}.", selected, base, number)

print(json.dumps({
    "articles": len(posts),
    "categories": len(categories),
    "years": len(years),
    "pages": len(list(OUT.rglob("index.html"))),
    "output": str(OUT),
}, ensure_ascii=False))
