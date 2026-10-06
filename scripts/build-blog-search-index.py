"""Build the lazy-loaded search index from the published blog HTML.

Run after publishing or editing articles. The tracked HTML, not the ignored
WordPress migration inventory, is the source of truth.
"""

from __future__ import annotations

import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BLOG = ROOT / "blog"


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "iframe"}:
            self.skip += 1
        elif tag in {"p", "div", "h2", "h3", "h4", "li", "br", "tr", "td"}:
            self.parts.append(" ")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "iframe"}:
            self.skip = max(0, self.skip - 1)
        elif tag in {"p", "div", "h2", "h3", "h4", "li", "tr", "td"}:
            self.parts.append(" ")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)

    def text(self) -> str:
        return " ".join("".join(self.parts).split())


def plain(markup: str) -> str:
    parser = PlainText()
    parser.feed(markup)
    return parser.text()


def match(pattern: str, source: str, path: Path) -> str:
    found = re.search(pattern, source, re.S | re.I)
    if not found:
        raise ValueError(f"Falta un dato para el buscador: {path} ({pattern})")
    return found.group(1)


def article(path: Path):
    source = path.read_text()
    if 'class="blog-article-content"' not in source:
        return None
    title = plain(match(r"<h1>(.*?)</h1>", source, path))
    description = html.unescape(match(r'<meta name="description" content="([^"]*)"', source, path))
    date = match(r'<time datetime="([^"]+)"', source, path)
    date_label = plain(match(r'<time datetime="[^"]+">(.*?)</time>', source, path))
    category_markup = match(r'<p class="eyebrow">(.*?)</p>', source, path)
    category = plain(category_markup).rsplit(" / ", 1)[-1]
    start = source.index('<div class="blog-article-content">')
    end = source.find('<!-- blog-shop-start -->', start)
    if end < 0:
        end = source.find('<nav class="blog-article-navigation"', start)
    if end < 0:
        raise ValueError(f"No se encuentra el final del artículo: {path}")
    body = plain(source[start:end])
    slug = path.parent.name
    return {"u": f"/blog/{slug}/", "t": title, "d": description,
            "c": category, "p": date, "l": date_label, "x": body}


def main() -> None:
    entries = [item for path in BLOG.rglob("index.html") if (item := article(path))]
    entries.sort(key=lambda item: item["p"], reverse=True)
    urls = [item["u"] for item in entries]
    if len(urls) != len(set(urls)):
        raise ValueError("El índice contiene URLs duplicadas")
    destination = BLOG / "search-index.json"
    destination.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Índice: {len(entries)} artículos, {destination.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
