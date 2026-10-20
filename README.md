# Lisard Bellod Static Site

Web estática orientada a autoridad y rendimiento, alimentada por un único archivo `data/data.json`.

## Qué incluye

- `index.html`: home con métricas agregadas y últimos vídeos por canal.
- `videos.html`: videoteca completa con filtros rápidos y buscador.
- `shop.html`: recomendaciones personales con imágenes de producto, enlaces directos y aviso de afiliación, sin precios.
- `data/shop.json`: catálogo de productos recomendados, independiente de la sincronización de YouTube.
- `data/data.json`: fuente central de datos para la web.
- `data/home.json`: resumen generado para la portada, con las mismas métricas y tres vídeos por canal.
- `data/social-metrics.json`: métricas manuales para Instagram, TikTok y horas de YouTube, fáciles de editar desde GitHub.
- `data/metric-overrides.json`: correcciones manuales de views y suscriptores que prevalecen sobre la sincronización automática.
- `scripts/fetch-youtube.mjs`: script Node.js para regenerar el dataset desde la API de YouTube.
- `.github/workflows/update-data.yml`: automatización diaria en GitHub Actions.
- `api/telegram-metrics.js`: bot privado para actualizar o corregir métricas desde Telegram.

## Cómo adaptarlo a tus canales

1. Cambia los IDs de `CHANNELS` en `scripts/fetch-youtube.mjs`.
2. Ajusta los seguidores de Instagram y TikTok en `SOCIALS`.
3. Crea un archivo `.env.local` a partir de `.env.local.example` y guarda ahí tu clave de YouTube Data API v3.
4. Publica los cambios en `main`: GitHub Actions los despliega en el servidor. Consulta `deploy/README.md`.

## Flujo recomendado

1. GitHub Actions ejecuta `node ./scripts/fetch-youtube.mjs` cada día.
2. El script actualiza `data/data.json` y `npm run build` regenera el resumen de la portada, sus estilos y el sitemap.
3. GitHub Actions construye y publica en el servidor `54.36.182.119`, también después de las actualizaciones automáticas.
4. La web servida sigue siendo estática, rápida y simple de mantener.

## Notas

- La home lee `data/home.json` y la videoteca lee `data/data.json` en cliente; ambas siguen aplicando las métricas manuales y correcciones vigentes.
- El bloque `home-styles` de `index.html` se genera desde `styles/main.css` y `styles/home.css` para evitar descargas que bloqueen el primer pintado. Edita los archivos CSS y ejecuta `npm run build`; no edites el bloque generado.
- La portada usa imágenes WebP adaptadas a su tamaño visible. Google Analytics y Metricool se cargan después de la carga inicial, sin exigir interacción para registrar una visita.
- Si quieres actualizar Instagram, TikTok o las horas manuales de YouTube, basta con editar `data/social-metrics.json` y hacer push.
- Las horas de YouTube se introducen manualmente desde YouTube Studio; no son una estimación pública.
- Si prefieres Astro más adelante, esta estructura ya te deja claro el modelo de datos y la automatización.

## Archivo del blog

`blog/` contiene los artículos históricos y nuevos publicados como HTML estático.
Es la fuente actual para el buscador y el sitemap; no reconstruyas producción
desde el inventario antiguo de WordPress porque excluiría las entradas nuevas.
`python3 scripts/build-blog-search-index.py` actualiza el buscador y
`npm run build` genera un único `sitemap.xml` para toda la web y
`data/sitemap-state.json` desde las páginas indexables. GitHub Actions ejecuta el build
en cada despliegue y `.github/workflows/sync-sitemaps.yml` versiona estos
archivos y el índice de búsqueda tras cada publicación.

El inventario original se recupera con `node scripts/blog-inventory.mjs`.
`node scripts/blog-media.mjs` copia los medios del antiguo WordPress y
`node scripts/build-blog-assets.mjs` genera las versiones optimizadas que se
sirven desde `blog-assets/`. Estos archivos de trabajo no se despliegan.
Las redirecciones 301 del dominio antiguo se configuran en el WordPress de
`lisard.es`; `data/blog/redirects-redirection-import.csv` está listo para
importarse en el plugin Redirection. Publicar la nueva web no activa esos 301.

## Añadir recomendaciones a Shop

Añade cada producto al array `products` de `data/shop.json` con estos campos:

- `name`: nombre del producto.
- `store`: nombre de la tienda (Vermut.shop, Amazon, AliExpress u otra).
- `url`: enlace completo de compra, conservando el código de afiliado si lo tiene.
- `image`: URL de la imagen original de la tienda.
- `note`: comentario personal opcional, basado en la experiencia de Lisard.
- `affiliate`: `true` si el enlace contiene un código de afiliado; `false` en caso contrario.
- `kind`: `"collection"` para un enlace a una búsqueda general de accesorios; muestra la etiqueta «Búsqueda general» y el botón «Explorar accesorios».
- `kind`: `"service"` para una instalación con contacto telefónico; `url` usa `tel:+34…`, `phone` muestra el número y `videoUrl` enlaza el vídeo desde la miniatura.
- `imageCrop`: encuadre opcional para mostrar solo la foto del producto de una captura original, con `x`, `y`, `width`, `height`, `sourceWidth` y `sourceHeight` en píxeles. La interfaz oculta el resto de la captura.

Las fichas no muestran precios. Los enlaces de afiliado se identifican en la ficha y llevan `rel="sponsored"`. Un catálogo vacío muestra un aviso de próximas recomendaciones.

## Bot privado de Telegram

Nombre: **countlisard**. Usuario: [@counterlisardbot](https://t.me/counterlisardbot).
Abre ese chat y envía `/actualizar` para mostrar el menú de métricas.

El bot permite cambiar seguidores de Instagram y TikTok, horas de YouTube, views del último año, suscriptores y views totales de cada canal. Siempre muestra el valor actual y pide confirmación antes de publicar el cambio. Telegram avisa al servidor en el momento, y el bot actualiza el repositorio de GitHub. GitHub Actions publica el cambio en la web.

Las correcciones se guardan en `data/metric-overrides.json`. Los datos públicos de cada canal vuelven a tomar el valor de la API tras la siguiente sincronización; las visualizaciones anuales de Studio siguen siendo manuales.

### Activación

1. Crea un bot privado desde `@BotFather` y guarda su token.
2. Obtén el ID numérico de tu chat de Telegram.
3. En `/home/lisardbellod/apps/shared/telegram.env` añade las siguientes variables (archivo privado, permisos 600):
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET` con una cadena larga y aleatoria
   - `TELEGRAM_ALLOWED_CHAT_ID`
   - `TELEGRAM_GITHUB_TOKEN`, un fine-grained token de GitHub con permiso `Contents: Read and write` exclusivamente para `vermutshop/lisardbellod-web`
   - `TELEGRAM_GITHUB_REPOSITORY=vermutshop/lisardbellod-web`
4. Mantén las variables de KV ya usadas por `api/calculator-counter.js`; el bot las reutiliza para guardar la conversación durante 30 minutos.
5. Reinicia `lisardbellod-api.service` y ejecuta `deploy/register-telegram.mjs` con ese archivo de entorno, según `deploy/README.md`.
6. Abre el bot y escribe `/actualizar`.

El endpoint ignora cualquier mensaje cuyo chat no coincida con `TELEGRAM_ALLOWED_CHAT_ID`.

El antiguo `/blog-sitemap.xml` redirige con 301 al sitemap principal. En Search Console se envía únicamente `https://lisardbellod.com/sitemap.xml`.

Las correcciones de suscriptores y visualizaciones totales desde Telegram caducan al sincronizar de nuevo YouTube. Instagram, TikTok, horas y las visualizaciones anuales de Studio se mantienen hasta su siguiente actualización manual. Sin un dato anual de Studio, la web muestra las visitas acumuladas de los vídeos publicados en los últimos 365 días, que no equivalen a las visitas recibidas durante ese periodo.

## Dominio principal

La web pública usa `https://lisardbellod.com`. Los canónicos, metadatos sociales,
datos estructurados y sitemap deben usar siempre este dominio. Las páginas de
`www` redirigen con 308 conservando ruta y parámetros.

En Vercel, ambos dominios deben estar conectados a Production; la redirección
se gestiona en `vercel.json`, no con una redirección global del dominio.
La única excepción es `/api/telegram-metrics`, que mantiene su dirección técnica
anterior para no interrumpir el webhook privado de Telegram. No es una página
indexable ni aparece en el sitemap. No activar un redirect global de `www` sin
actualizar antes el webhook autenticado de Telegram.

## Acceso para agentes de IA

- `llms.txt` resume el contenido público y enlaza las fuentes principales. No cambia `robots.txt` ni las condiciones de uso.
- `/.well-known/ai-catalog.json` publica la guía `ai/explorar-lisard-bellod/SKILL.md` en el formato ARD `specVersion: 1.0` validado por Lighthouse. La guía es un recurso Markdown, no un servidor MCP remoto.
- `scripts/webmcp.js` registra en la portada las herramientas `list_site_sections`, `open_site_section` y `search_blog` cuando el navegador ofrece `document.modelContext` o la interfaz anterior `navigator.modelContext`. No carga catálogos de datos al registrar las herramientas.
- El buscador `/blog/?q=...` conserva los resultados visibles y su formulario expone `search_blog_articles` mediante la API declarativa. El índice solo se descarga al buscar y se reutiliza en búsquedas siguientes.
- Vercel publica cabeceras `Link` para descubrir la guía y el catálogo desde cualquier página. WebMCP es experimental: los enlaces y el buscador siguen funcionando en navegadores sin esta API. No requiere un SDK externo.

Al cambiar secciones o capacidades, actualizar el registro WebMCP, `llms.txt` y la guía pública. Las comprobaciones de WebMCP requieren un navegador compatible; un «No aplicable» en cobertura de formularios es normal en la portada, que no tiene formularios.

## Migración al servidor propio

La publicación automática en Apache y el contador están preparados en el servidor
`54.36.182.119`. El cambio de DNS lo realiza Lisard después de las comprobaciones.
El bot de Telegram también se ejecuta en el servidor, con un webhook dirigido a
su IP fija. Vercel sigue siendo el puente de la web mientras el DNS apunte allí.
Configuración, recuperación y estado en [`deploy/README.md`](deploy/README.md).
