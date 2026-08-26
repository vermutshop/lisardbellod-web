# Lisard Bellod Static Site

Web estática orientada a autoridad y rendimiento, alimentada por un único archivo `data/data.json`.

## Qué incluye

- `index.html`: home con métricas agregadas y últimos vídeos por canal.
- `videos.html`: videoteca completa con filtros rápidos y buscador.
- `data/data.json`: fuente central de datos para la web.
- `data/social-metrics.json`: métricas manuales para Instagram, TikTok y horas de YouTube, fáciles de editar desde GitHub.
- `data/metric-overrides.json`: correcciones manuales de views y suscriptores que prevalecen sobre la sincronización automática.
- `scripts/fetch-youtube.mjs`: script Node.js para regenerar el dataset desde la API de YouTube.
- `.github/workflows/update-data.yml`: automatización diaria en GitHub Actions.
- `api/telegram-metrics.js`: bot privado para actualizar o corregir métricas desde Telegram.

## Cómo adaptarlo a tus canales

1. Cambia los IDs de `CHANNELS` en `scripts/fetch-youtube.mjs`.
2. Ajusta los seguidores de Instagram y TikTok en `SOCIALS`.
3. Crea un archivo `.env.local` a partir de `.env.local.example` y guarda ahí tu clave de YouTube Data API v3.
4. Publica el repositorio en Vercel o Netlify como sitio estático.

## Flujo recomendado

1. GitHub Actions ejecuta `node ./scripts/fetch-youtube.mjs` cada día.
2. El script actualiza `data/data.json`.
3. El commit automático dispara el despliegue en Vercel o Netlify.
4. La web servida sigue siendo estática, rápida y simple de mantener.

## Notas

- La home y la videoteca leen el JSON en cliente, así que no requieren backend en producción.
- Si quieres actualizar Instagram, TikTok o las horas manuales de YouTube, basta con editar `data/social-metrics.json` y hacer push.
- Las horas de YouTube se introducen manualmente desde YouTube Studio; no son una estimación pública.
- Si prefieres Astro más adelante, esta estructura ya te deja claro el modelo de datos y la automatización.

## Bot privado de Telegram

El bot permite cambiar seguidores de Instagram y TikTok, horas de YouTube, views del último año, suscriptores y views totales de cada canal. Siempre muestra el valor actual y pide confirmación antes de publicar el cambio. Telegram avisa a Vercel en el momento, y Vercel actualiza el repositorio de GitHub.

Las correcciones de views y suscriptores se guardan en `data/metric-overrides.json` para que una actualización automática posterior de YouTube no las sobrescriba.

### Activación

1. Crea un bot privado desde `@BotFather` y guarda su token.
2. Obtén el ID numérico de tu chat de Telegram.
3. En las variables de entorno de Vercel añade las siguientes variables, solo para producción:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_WEBHOOK_SECRET` con una cadena larga y aleatoria
   - `TELEGRAM_ALLOWED_CHAT_ID`
   - `TELEGRAM_GITHUB_TOKEN`, un fine-grained token de GitHub con permiso `Contents: Read and write` exclusivamente para `vermutshop/lisardbellod-web`
   - `TELEGRAM_GITHUB_REPOSITORY=vermutshop/lisardbellod-web`
4. Mantén las variables de KV ya usadas por `api/calculator-counter.js`; el bot las reutiliza para guardar la conversación durante 30 minutos.
5. Tras desplegar, configura el webhook de Telegram apuntando a `https://www.lisardbellod.com/api/telegram-metrics` y usando el mismo `TELEGRAM_WEBHOOK_SECRET`.
6. Abre el bot y escribe `/actualizar`.

El endpoint ignora cualquier mensaje cuyo chat no coincida con `TELEGRAM_ALLOWED_CHAT_ID`.
