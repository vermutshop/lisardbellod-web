# Publicación programada: Toyota C-HR+ — 10 de diciembre de 2026

Lisard ha pedido publicar la entrada de este vídeo el 10 de diciembre. Hora elegida: 09:00 Europe/Madrid (08:00 UTC). No publicar antes de `2026-12-10T08:00:00Z`.

El artículo final y la portada elegida por Lisard están en esta carpeta. La transcripción completa se ha leído para redactarlo; no se conserva en el repositorio. No hace falta recuperar archivos del Mac. El vídeo exacto es https://youtu.be/r9MrD_a3Jxs.

## Integración el día de publicación

- Obtener `main` actualizado y leer su AGENTS.md. Recuperar solo esta carpeta de la rama `codex/toyota-chr-plus-10-diciembre`; no fusionar toda la rama, que puede estar desactualizada.
- Comprobar duplicados por ID y slug. Si ya se publicó, verificar la URL y detener la programación sin duplicar.
- Usar article.html como contenido final. Tiene `noindex,nofollow` para su estado de borrador, no aparece en listados, buscador ni sitemap. Copiarlo a `blog/toyota-chr-plus-lo-que-me-gusta/index.html`, y portada.webp a `blog-assets/toyota-chr-plus-lo-que-me-gusta/portada.webp`.
- Cambiar robots a `index,follow,max-image-preview:large`, confirmar canonical, metadatos y fechas efectivas de publicación. Usar la fecha real si la ejecución se retrasa; respetar el límite mínimo indicado.
- Revisar el vídeo, los enlaces internos y el catálogo data/shop.json vigente. El enlace afiliado elegido es el cepillo de llantas SEAMETAL. No inventar características, precios ni que se usó en el Toyota.
- Revisar los datos que dependan del equipamiento vigente en la fuente oficial. Las impresiones describen la unidad probada; no añadir una versión o acabado no confirmado. Se ha corregido CarPlay frente a los errores AirPlay/corplay de la transcripción. La intervención de frenado es una observación concreta y la estanqueidad del puerto no se ensayó.
- Actualizar blog, categoría Coche Eléctrico y año, paginación de 24 sin pérdidas ni duplicados, conteos, filtros y vecinos anterior/siguiente según la convención actual. Los datos de extracto y portada figuran en publication.json.
- Generar buscador y sitemap con los scripts vigentes, validar HTML/JSON-LD/enlaces/portada/listados/XML, revisar móvil y escritorio, ejecutar las comprobaciones necesarias y limitar el diff a la publicación.
- Publicar en main mediante el flujo permitido, sin otra aprobación editorial. Comprobar el despliegue en el servidor y la página pública completa, portada, vídeo y sitemap. No modificar YouTube.
- Tras verificar la publicación, detener la programación y comunicar el enlace. Si faltan permisos o hay otro impedimento real, conservar el borrador y explicar el paso pendiente.

## Fuentes y revisión

Fuente principal: transcripción aportada por Lisard, leída íntegramente. Imagen: portada aportada por Lisard, optimizada a WebP 1600 × 900 sin recortes. Fuente técnica: https://www.toyota.es/coches/toyota-c-hr-plus/caracteristicas (consultada el 20 de octubre de 2026). Enlaces internos revisados: repaso interior/exterior y prueba de carga rápida del C-HR+.
