# Publicación prevista: Toyota C-HR+

Entrada preparada a petición de Lisard a partir de su transcripción completa y su portada. No está publicada.

Almacenamiento autorizado por Lisard: artículo y portada en la rama pública `codex/scheduled-toyota-chr-2026-12-15` de `vermutshop/lisardbellod-web`. Esta autorización permite leer el borrador en GitHub antes de diciembre, pero no publicarlo en la web antes de la fecha prevista. El despliegue automático está desactivado para esa rama y `publication-drafts/` está excluido de Vercel. Usar el material remoto para no depender de archivos del Mac.

- No publicar antes del **15 de diciembre de 2026 a las 09:00 Europe/Madrid**, equivalente a **2026-12-15T08:00:00Z**. Fecha y hora confirmadas expresamente por Lisard.
- Vídeo exacto: https://youtu.be/zkidhdR9t0I
- Título, extracto, descripción, categoría y fecha mínima están en `publication.json`.
- `article.html` contiene el texto final, marcado como borrador y `noindex,nofollow`, con una fecha prevista. `portada.webp` es la portada aportada por Lisard, optimizada sin recortar.
- Programación de Codex: `publicar-toyota-c-hr-15-diciembre`. Requiere el equipo encendido y la app abierta. Es una ejecución única prevista para esa fecha; si queda bloqueada, comunicar el motivo y conservar este material.

## Preparación para publicar en la fecha indicada

1. Comprobar la hora real. No saltarse la fecha mínima aunque la tarea se ejecute manualmente antes.
2. Recuperar `main` remoto actualizado de `vermutshop/lisardbellod-web` y leer su `AGENTS.md`. Buscar el ID y el slug para evitar duplicados. Si ya está publicado, verificarlo y detener la programación.
3. Recuperar solo esta carpeta desde `codex/scheduled-toyota-chr-2026-12-15`. **No fusionar la rama completa**: contiene medidas para evitar el despliegue del borrador y puede estar desactualizada respecto a los listados públicos. No copiar `vercel.json` ni `.vercelignore` a producción.
4. Comprobar la disponibilidad pública del vídeo. No modificar YouTube. Si no se puede confirmar su disponibilidad, mantener el borrador y comunicar el impedimento.
5. Revisar los enlaces internos y `data/shop.json` del momento de publicación. Conservar las URLs exactas, el enlace a Shop, el aviso y `rel=sponsored` correspondientes. No actualizar opiniones ni convertir observaciones de la unidad probada en especificaciones de toda la gama.
6. Crear `blog/toyota-chr-plus-opinion/index.html` con el cuerpo de `article.html` y la estructura vigente del blog. Generar de nuevo el head con canonical único, robots indexables, OG/Twitter y BlogPosting. Usar fecha efectiva de publicación en Europe/Madrid y UTC, sin atribuir la fecha prevista a una publicación que finalmente ocurra más tarde. Quitar la leyenda de borrador y restaurar la miga de blog/categoría.
7. Copiar la portada a `blog-assets/toyota-chr-plus-opinion/portada.webp`, cambiar la URL de la imagen del cuerpo y utilizar URL absoluta en metadatos. Conservar 1672 × 941 y el alt de publication.json. Añadir `/scripts/metricool.js` como en las páginas públicas actuales; el borrador local no lleva tracking.
8. Integrar tarjeta, categorías, archivo anual, paginación de 24 y navegación entre entradas según el estado de `main` en ese momento. No reutilizar listados antiguos de esta rama. La convención vigente al preparar el texto es Anterior = más reciente, Siguiente = más antiguo.
9. Ejecutar `python3 scripts/build-blog-search-index.py`, `npm run build` y las comprobaciones de AGENTS.md, incluidos JSON-LD, fecha/canonical, imagen, enlaces, tarjetas sin pérdidas/duplicados, sitemap y vista móvil/escritorio. Revisar diff y ejecutar `npm test`. Versionar los archivos derivados necesarios.
10. Publicar en `main` mediante el flujo permitido y comprobar el despliegue del commit y el contenido público (portada, vídeo y enlaces). No basta con un 200 o con enviar el commit. Comunicar el enlace verificado y detener la programación. No publicar entradas adicionales.

## Criterios editoriales ya aplicados

Prueba de cuatro días; impresiones personales respecto a su Kia y otros coches. Se agrupan las repeticiones sobre el volante y la batería. No se inventan mediciones de acelerador/habitabilidad, versión exacta, potencias, precios ni conclusiones sobre la futura decisión de compra. El 20 %, 10 % y unos 60 km se cuentan como observaciones de la prueba, sin garantizar umbrales universales ni autonomía. La app podría estar mal configurada. El producto de Shop se enlaza como prueba independiente, sin afirmar que se utilizó en este Toyota. No se incluye la transcripción bruta.
