"""Record old-site links that were rewritten and those needing manual migration."""

import csv
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

from blog_links import BlogLinks, SOURCE_HOSTS

ROOT = Path(__file__).resolve().parents[1]
inventory = json.loads((ROOT / "data/blog/inventory.json").read_text())
links = BlogLinks(inventory["posts"], inventory["categories"])


class ArticleAnchors(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.hrefs.append(href)


rows = []
counts = Counter()
for post in inventory["posts"]:
    parser = ArticleAnchors()
    parser.feed(post["contentHtml"])
    for href in parser.hrefs:
        parsed = urlparse(href)
        if parsed.hostname not in SOURCE_HOSTS and not href.startswith(("/", "?", "../")):
            continue
        target, status = links.resolve(href, post["url"])
        counts[status] += 1
        rows.append([post["id"], post["slug"], href, target or "", status])

out = ROOT / "data/blog/link-audit.csv"
with out.open("w", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(["post_id", "post_slug", "old_link", "new_link", "status"])
    writer.writerows(rows)

report = ROOT / "data/blog/link-audit.md"
report.write_text(f"""# Enlaces internos del blog antiguo

- Enlaces internos encontrados: **{len(rows)}**.
- Artículos convertidos: **{counts['post']}**.
- Categorías convertidas: **{counts['category']}**.
- Portada y años convertidos: **{counts['blog_home'] + counts['year']}**.
- Página de contacto convertida: **{counts['site_page']}**.
- Descargas o imágenes enlazadas pendientes de copiar: **{counts['upload_pending']}**.
- Enlaces antiguos sin destino verificado: **{counts['unresolved_internal']}**.

Cada enlace y su resultado figura en `link-audit.csv`. Los enlaces pendientes mantienen
su destino antiguo en el borrador para no crear páginas rotas. Antes de activar las
redirecciones del dominio, hay que copiar los archivos multimedia y resolver o retirar
los destinos restantes.
""")
print(dict(counts))
print(report)
