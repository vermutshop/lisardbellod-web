"""Prepare the blog sitemap without publishing draft URLs to the live sitemap."""

import json
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

from blog_seo import canonical_url, effective_modified

ROOT = Path(__file__).resolve().parents[1]
inventory = json.loads((ROOT / "data/blog/inventory.json").read_text())
posts = inventory["posts"]
namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
ET.register_namespace("", namespace)
urlset = ET.Element(f"{{{namespace}}}urlset")


def add(path, modified):
    node = ET.SubElement(urlset, f"{{{namespace}}}url")
    ET.SubElement(node, f"{{{namespace}}}loc").text = canonical_url(path)
    ET.SubElement(node, f"{{{namespace}}}lastmod").text = modified[:10]


newest = max(effective_modified(post) for post in posts)
add("/blog/", newest)
for post in posts:
    add(f"/blog/{post['slug']}/", effective_modified(post))

by_category = defaultdict(list)
by_year = defaultdict(list)
for post in posts:
    for category_id in post["categories"]:
        by_category[category_id].append(post)
    by_year[post["published"][:4]].append(post)
for category in inventory["categories"]:
    if by_category[category["id"]]:
        add(f"/blog/categoria/{category['slug']}/",
            max(effective_modified(post) for post in by_category[category["id"]]))
for year, selected in by_year.items():
    add(f"/blog/ano/{year}/", max(effective_modified(post) for post in selected))

out = ROOT / "data/blog/blog-sitemap-proposed.xml"
ET.indent(urlset)
ET.ElementTree(urlset).write(out, encoding="utf-8", xml_declaration=True)
print(f"Prepared {len(urlset)} URLs in {out}")
