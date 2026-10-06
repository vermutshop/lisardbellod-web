"""Add the current Shop promotion to every published blog article.

Run after editing data/shop.json. The script only changes article pages and is
safe to run again: its marked block is replaced rather than duplicated.
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
BLOG = ROOT / "blog"
START = "<!-- blog-shop-start -->"
END = "<!-- blog-shop-end -->"
BLOCK = re.compile(rf"{re.escape(START)}.*?{re.escape(END)}\n", re.S)
HEADING = re.compile(r"<h1>(.*?)</h1>", re.S)
NAV = '<nav class="blog-article-navigation"'


def catalog() -> dict[str, dict]:
    products = json.loads((ROOT / "data/shop.json").read_text())["products"]
    affiliate = {}
    for product in products:
        if not product.get("affiliate"):
            continue
        url = product.get("url", "")
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError(f"URL de afiliado no válida: {url}")
        affiliate[product["name"]] = product
    return affiliate


def pick(title: str, products: dict[str, dict]) -> dict:
    """Use a relevant product when the headline makes the match clear."""
    title = html.unescape(re.sub(r"<[^>]+>", "", title)).casefold()
    if re.search(r"kia\s+ev3|\bev3\b", title):
        key = "Alfombrillas 3W para Kia EV3 · 2024–2026"
    elif re.search(r"limpi|lavar|llantas|parabrisas|detailing", title):
        key = "Paños de limpieza para coche · 30 × 30 cm"
    elif re.search(r"cargad|cargar|recarg|schuko|enchufe|wallbox", title) and not re.search(r"12\s*v|auxiliar|arranc", title):
        key = "Cargador portátil dé Schuko 3,7 kW con app · 7 m"
    else:
        # General site promotion: no claim that this accessory relates to the article.
        key = "Soporte magnético de móvil MSXTTLY Vmag S3 para coche"
    return products[key]


def promotion(product: dict) -> str:
    name = html.escape(product["name"])
    store = html.escape(product["store"])
    url = html.escape(product["url"], quote=True)
    return f"""{START}
<aside class="blog-shop-promo" aria-label="Recomendación de Shop">
  <p class="eyebrow">En Shop</p>
  <h2>Un producto de mi selección</h2>
  <p class="blog-shop-product">{name} <span>· {store}</span></p>
  <div class="blog-shop-actions">
    <a class="button secondary" href="{url}" target="_blank" rel="sponsored noopener noreferrer">Ver producto ↗</a>
    <a class="button primary" href="/shop.html#recomendaciones">Descubre mis recomendaciones y ofertas para tu coche →</a>
  </div>
  <p class="blog-shop-disclosure">Este artículo contiene un enlace de afiliado. Si compras a través de él, puedo recibir una comisión.</p>
</aside>
{END}
"""


def main() -> None:
    products = catalog()
    changed = total = 0
    for path in sorted(BLOG.rglob("index.html")):
        source = path.read_text()
        if 'class="blog-article-content"' not in source:
            continue
        total += 1
        match = HEADING.search(source)
        if not match or NAV not in source:
            raise ValueError(f"Estructura de artículo inesperada: {path}")
        block = promotion(pick(match.group(1), products))
        if START in source:
            updated, count = BLOCK.subn(lambda _: block, source, count=1)
            if count != 1:
                raise ValueError(f"Bloque Shop incompleto: {path}")
        else:
            updated = source.replace(NAV, block + NAV, 1)
        if updated != source:
            path.write_text(updated)
            changed += 1
    print(f"Artículos: {total}; actualizados: {changed}")


if __name__ == "__main__":
    main()
