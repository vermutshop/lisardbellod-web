# Lisard Bellod Static Site

Web estática orientada a autoridad y rendimiento, alimentada por un único archivo `data/data.json`.

## Qué incluye

- `index.html`: home con métricas agregadas y últimos vídeos por canal.
- `videos.html`: videoteca completa con filtros rápidos y buscador.
- `data/data.json`: fuente central de datos para la web.
- `scripts/fetch-youtube.mjs`: script Node.js para regenerar el dataset desde la API de YouTube.
- `.github/workflows/update-data.yml`: automatización diaria en GitHub Actions.

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
- El script calcula una estimación de horas consumidas a partir de visualizaciones y duración.
- Si prefieres Astro más adelante, esta estructura ya te deja claro el modelo de datos y la automatización.
