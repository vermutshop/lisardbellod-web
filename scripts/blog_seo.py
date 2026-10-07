"""SEO metadata shared by the draft and the future published blog.

The local draft is noindex. Its canonical URLs are prepared for /blog/ but are
only emitted as canonical link tags after publication.
"""

from __future__ import annotations

import html
import json
from urllib.parse import quote

SITE = "https://lisardbellod.com"
AUTHOR = {"@type": "Person", "name": "Lisard Bellod", "url": f"{SITE}/"}
SOCIAL_IMAGE = f"{SITE}/image/lisardbellod.png"


def canonical_url(path: str) -> str:
    # WordPress slugs include percent-encoded characters; preserve those URLs.
    return SITE + quote(path, safe="/%#-._~%")


def escape(value: str) -> str:
    return html.escape(value, quote=True)


def json_ld(value: dict) -> str:
    payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    return f'<script type="application/ld+json">{payload}</script>'


def utc(value: str) -> str:
    return value.replace(" ", "T") + ("Z" if value and not value.endswith("Z") else "")


def effective_modified(post: dict) -> str:
    # Some old WordPress records report a modification before publication.
    return max(post["publishedGmt"], post["modifiedGmt"])


def head(title: str, description: str, path: str, *, draft=True, post=None, image_url=None) -> str:
    url = canonical_url(path)
    image = image_url or SOCIAL_IMAGE
    tags = [
        f'<meta name="robots" content="{"noindex,nofollow" if draft else "index,follow,max-image-preview:large"}">',
        f'<meta name="description" content="{escape(description)}">',
        '<meta name="author" content="Lisard Bellod">',
        '<meta property="og:locale" content="es_ES">',
        f'<meta property="og:type" content="{"article" if post else "website"}">',
        '<meta property="og:site_name" content="Lisard Bellod">',
        f'<meta property="og:title" content="{escape(title)}">',
        f'<meta property="og:description" content="{escape(description)}">',
        f'<meta property="og:url" content="{escape(url)}">',
        f'<meta property="og:image" content="{escape(image)}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{escape(title)}">',
        f'<meta name="twitter:description" content="{escape(description)}">',
        f'<meta name="twitter:image" content="{escape(image)}">',
    ]
    if not draft:
        tags.insert(1, f'<link rel="canonical" href="{escape(url)}">')
    if post:
        tags += [
            f'<meta property="article:published_time" content="{escape(utc(post["publishedGmt"]))}">',
            f'<meta property="article:modified_time" content="{escape(utc(effective_modified(post)))}">',
        ]
        article = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "mainEntityOfPage": {"@type": "WebPage", "@id": url},
            "headline": html.unescape(post["title"]),
            "description": description,
            "datePublished": utc(post["publishedGmt"]),
            "dateModified": utc(effective_modified(post)),
            "author": AUTHOR,
            "publisher": AUTHOR,
        }
        if image_url:
            article["image"] = image_url
        tags.append(json_ld(article))
    else:
        tags.append(json_ld({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "description": description,
            "url": url,
            "isPartOf": {"@type": "WebSite", "name": "Lisard Bellod", "url": f"{SITE}/"},
        }))
    return "\n".join(tags)
