"""Map former WordPress upload URLs to optimized files on this site."""

import html
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlparse

SOURCE_HOSTS = {"lisard.es", "www.lisard.es"}
MEDIA_ATTRIBUTE = re.compile(r'\b(src|href)="([^"]*)"')
IMAGE_TAG = re.compile(r'<img\b[^>]*>', re.I)
IMAGE_SOURCE = re.compile(r'\bsrc="([^"]*)"')


class BlogAssets:
    def __init__(self, root: Path):
        source = root / "data/blog/asset-map.json"
        self.map = json.loads(source.read_text()) if source.exists() else {}

    def local(self, raw: str):
        parsed = urlparse(html.unescape(raw))
        if (parsed.hostname or "").casefold() not in SOURCE_HOSTS:
            return None
        return self.map.get(unquote(parsed.path), {}).get("local")

    @staticmethod
    def old_site(raw: str) -> bool:
        return (urlparse(html.unescape(raw)).hostname or "").casefold() in SOURCE_HOSTS

    def rewrite(self, markup: str, replace_missing=False):
        if replace_missing:
            def image_replace(match):
                source = IMAGE_SOURCE.search(match.group(0))
                if source and self.old_site(source.group(1)) and not self.local(source.group(1)):
                    return '<span class="blog-image-unavailable">Imagen original no disponible</span>'
                return match.group(0)

            markup = IMAGE_TAG.sub(image_replace, markup)

        def replace(match):
            target = self.local(match.group(2))
            return f'{match.group(1)}="{html.escape(target, quote=True)}"' if target else match.group(0)

        return MEDIA_ATTRIBUTE.sub(replace, markup)
