---
name: explorar-lisard-bellod
description: Buscar artículos, vídeos y herramientas públicas de lisardbellod.com y consultar sus fuentes cuando el usuario pregunte por contenido de Lisard Bellod.
---

# Consultar lisardbellod.com

La [guía del sitio](https://lisardbellod.com/llms.txt) enlaza las secciones y calculadoras disponibles.

## Encontrar artículos

Abre `https://lisardbellod.com/blog/?q=TERMINOS`, codificando los términos como un parámetro de URL. El buscador acepta desde dos caracteres y busca en títulos, categorías, extractos y texto. Devuelve inicialmente 24 resultados y permite mostrar más. Abre los artículos pertinentes y cita su URL canónica, título y fecha; un resultado de búsqueda es solo una pista para localizar la fuente.

En navegadores con WebMCP, la portada ofrece `list_site_sections` para consultar las secciones y `open_site_section` para abrir una de ellas. `search_blog` abre el buscador con una consulta de 2 a 120 caracteres. El formulario del blog expone `search_blog_articles`, que muestra los resultados y devuelve título, URL, fecha y extracto de los primeros 24, junto al número total de coincidencias. Si WebMCP no está disponible, utiliza los enlaces y el formulario visibles.

El [índice JSON](https://lisardbellod.com/blog/search-index.json) permite una búsqueda local alternativa. Cada registro contiene `t` (título), `u` (ruta), `c` (categoría), `d` (extracto), `x` (texto), `p` (fecha) y `l` (fecha para mostrar). Descárgalo solo cuando necesites buscar en todo el archivo.

## Consultar herramientas y recomendaciones

Las [calculadoras](https://lisardbellod.com/herramientas.html) funcionan en el navegador con formularios visibles. Utiliza los importes, consumos y unidades proporcionados por el usuario y explica los supuestos del cálculo. Consulta las etiquetas de cada campo: las dos calculadoras tienen funciones distintas.

Las publicaciones históricas describen experiencias y condiciones de su fecha. Comprueba la vigencia antes de tratar un precio, ayuda o condición como actual. La [Shop](https://lisardbellod.com/shop.html) identifica los enlaces de afiliado; los precios finales se consultan en cada comercio.

Esta guía sirve para consultar contenido público. Las compras, suscripciones o mensajes de contacto requieren la petición del usuario correspondiente.
