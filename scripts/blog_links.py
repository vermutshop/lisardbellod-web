"""Resolve links from the former WordPress blog to pages in the local draft.

Only return a destination when it exists in the generated archive. Uploads and
historic pages without a verified equivalent remain in the link audit.
"""

from __future__ import annotations

import html
import re
from urllib.parse import parse_qs, unquote, urljoin, urlparse

SOURCE_HOSTS = {"lisard.es", "www.lisard.es"}
HREF = re.compile(r'href="([^"]*)"')


class BlogLinks:
    def __init__(self, posts, categories, base="/blog-draft/"):
        self.base = base.rstrip("/") + "/"
        self.by_id = {str(post["id"]): post for post in posts}
        self.by_slug = {unquote(post["slug"]).casefold(): post for post in posts}
        self.by_path = {
            unquote(urlparse(post["url"]).path).rstrip("/").casefold(): post
            for post in posts
        }
        self.categories = {category["slug"].casefold() for category in categories}
        self.years = {post["published"][:4] for post in posts}

    def resolve(self, raw, source_url=None):
        """Return (new URL, reason) for a known old-site link, else (None, reason)."""
        url = html.unescape(raw).strip()
        parsed = urlparse(url)
        if source_url and not parsed.scheme and not parsed.netloc and url.startswith("../"):
            parsed = urlparse(urljoin(source_url, url))
        if parsed.hostname and parsed.hostname.casefold() not in SOURCE_HOSTS:
            return None, "external"
        if not parsed.hostname and not url.startswith(("/", "?")):
            return None, "relative_or_fragment"
        path = unquote(parsed.path).rstrip("/").strip().casefold()
        if path.startswith("/wp-content/"):
            return None, "upload_pending"

        post = self.by_path.get(path)
        query = parse_qs(parsed.query)
        if not post and path in {"", "/"}:
            post = self.by_id.get(query.get("p", [""])[0])
        if not post:
            parts = [part for part in path.split("/") if part]
            if parts and (
                len(parts) == 1
                or (len(parts) == 2 and re.fullmatch(r"20\d\d", parts[0]))
                or (len(parts) == 3 and parts[0] == "blog" and re.fullmatch(r"20\d\d", parts[1]))
            ):
                post = self.by_slug.get(parts[-1])
            if not post and len(parts) >= 2 and parts[-2] in self.by_slug:
                post = self.by_slug[parts[-2]]
        if post:
            target = f"{self.base}{post['slug']}/"
            if parsed.fragment:
                target += f"#{parsed.fragment}"
            return target, "post"

        if path in {"", "/", "/blog"} and not query:
            return self.base, "blog_home"
        if path == "/contacto":
            return "/contacto.html", "site_page"
        parts = [part for part in path.split("/") if part]
        if len(parts) == 2 and parts[0] == "category" and parts[1] in self.categories:
            return f"{self.base}categoria/{parts[1]}/", "category"
        if len(parts) == 1 and parts[0] in self.years:
            return f"{self.base}ano/{parts[0]}/", "year"
        return None, "unresolved_internal"

    def rewrite(self, markup, source_url=None, remove_unresolved=False):
        def replace(match):
            target, reason = self.resolve(match.group(1), source_url)
            if target:
                return f'href="{html.escape(target, quote=True)}"'
            if remove_unresolved and reason in {"upload_pending", "unresolved_internal"}:
                return 'data-missing-link="true" title="Enlace antiguo sin destino disponible"'
            return match.group(0)

        return HREF.sub(replace, markup)
