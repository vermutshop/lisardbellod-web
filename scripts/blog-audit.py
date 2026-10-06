"""Summarize migration coverage and write a one-to-one redirect map."""

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import csv
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/blog/inventory.json"
REPORT = ROOT / "data/blog/audit.md"
MAP = ROOT / "data/blog/redirect-map.csv"


class Images(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        if tag == "img":
            attrs = dict(attrs)
            url = attrs.get("data-src") or attrs.get("data-lazy-src") or attrs.get("src")
            if url:
                self.urls.append(url)


inventory = json.loads(SOURCE.read_text())
posts = inventory["posts"]
media_ids = {item["id"] for item in inventory["media"]}
images = Images()
for post in posts:
    images.feed(post["contentHtml"])
unique_images = set(images.urls)
hosts = Counter(urlparse(url).hostname or "relative" for url in unique_images)
categories = sorted(inventory["categories"], key=lambda item: -item["count"])
dates = sorted(post["published"] for post in posts)
without_featured = sum(not post["featuredMediaId"] for post in posts)
without_any = sum(not post["featuredMediaId"] and not post["hasInlineImage"] for post in posts)
missing_featured = [post for post in posts if post["featuredMediaId"] and post["featuredMediaId"] not in media_ids]

with MAP.open("w", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(["old_url", "new_url", "post_id", "published"])
    for post in posts:
        writer.writerow([post["url"], f"https://www.lisardbellod.com/blog/{post['slug']}/", post["id"], post["published"]])

REPORT.write_text(f"""# Inventario para migrar lisard.es

- Artículos públicos recuperados: **{len(posts)}** de {inventory['expected']} declarados por WordPress.
- Fechas originales: **{dates[0][:10]}** a **{dates[-1][:10]}**.
- Categorías: **{len(categories)}**.
- Imágenes destacadas: **{len(posts) - without_featured}**; las {len(posts) - without_featured - len(missing_featured)} imágenes necesarias están localizadas en la biblioteca pública.
- Sin imagen destacada: **{without_featured}**. De ellos, **{without_any}** tampoco contienen una imagen dentro del artículo.
- Biblioteca multimedia pública: **{len(inventory['media'])}** registros recibidos de {inventory['expectedMedia']} declarados; faltan {inventory['expectedMedia'] - len(inventory['media'])} registros en la paginación de la API.
- Imágenes insertadas en artículos: **{len(images.urls)}** referencias, **{len(unique_images)}** URL únicas. De ellas, **{hosts['lisard.es']}** están alojadas en lisard.es y las demás dependen de otros sitios o usan rutas relativas.
- Mapa de redirecciones: **{len(posts)}** pares de URL en `redirect-map.csv`.

## Categorías más grandes

{chr(10).join(f'- {item["name"]}: {item["count"]}' for item in categories[:12])}

## Antes de publicar el archivo

1. Copiar y revisar fotografías originales y recursos insertados, incluidos los alojados en otros sitios que aún funcionen. El borrador local enlaza temporalmente a las URL originales.
2. Recuperar la exportación completa de WordPress y la carpeta `wp-content/uploads` para verificar metadatos SEO, comentarios, adjuntos y publicaciones que la API pública no revele.
3. Revisar una muestra de artículos con bloques antiguos y enlaces, además de los que no tienen ninguna imagen.
4. Instalar y comprobar las redirecciones permanentes una por una en el alojamiento de lisard.es cuando el archivo nuevo esté publicado.

Las páginas de `blog-draft/` son locales y llevan `noindex`; este borrador no se ha publicado.
""")
print(REPORT)
print(MAP)
