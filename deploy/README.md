# Publicación en el servidor

Destino: `54.36.182.119`, SSH `42422`, usuario `lisardbellod`.
GitHub `main` continúa siendo la fuente de la web. El workflow
`Deploy website to server` construye y publica automáticamente. También se
ejecuta al completar las actualizaciones de YouTube y de índices, incluidos
los commits creados por `GITHUB_TOKEN`, que no disparan otro evento push.

El paquete se genera con `node deploy/package.mjs` después de las pruebas,
el índice del blog y `npm run build`. `dist-server/public` contiene únicamente
los recursos públicos; las API y los scripts de mantenimiento quedan fuera
del directorio servido por Apache.

## Servidor

- `/home/lisardbellod/apps/releases/<commit>`: versiones publicadas.
- `/home/lisardbellod/apps/current`: enlace a la versión activa.
- `/home/lisardbellod/apps/shared/api.env`: configuración privada del contador.
- `/home/lisardbellod/apps/activate.sh`: activación y comprobación del contador.
- `lisardbellod-api.service`: API Node.js en `127.0.0.1:3002`.
- `/etc/apache2/lisardbellod-site.inc`: reglas exclusivas de este dominio.
- `/home/lisardbellod/public_html/.well-known/acme-challenge/`: validación HTTPS.

La clave de despliegue y la clave pública verificada del servidor se guardan
como secretos `LISARDBELLOD_DEPLOY_KEY` y `LISARDBELLOD_KNOWN_HOSTS` en GitHub.
No guardar credenciales en este repositorio. El usuario de publicación solo
tiene permiso sudo para reiniciar su propio servicio.

La activación conserva las versiones anteriores y comprueba el contador antes
de dar el despliegue por bueno. Si falla la comprobación, restaura la versión
anterior. Para una recuperación manual, cambiar `current` a una release
anterior y reiniciar únicamente `lisardbellod-api.service`.

## Telegram durante la transición

La ruta `/api/telegram-metrics` se reenvía mediante HTTPS verificado a
`lisardbellod-web.vercel.app`, también desde `www`. El contador se ejecuta
en el nuevo servidor y conserva los datos existentes de Redis.

Vercel no permite exportar los valores sensibles `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_ALLOWED_CHAT_ID`, `TELEGRAM_GITHUB_TOKEN` y
`TELEGRAM_WEBHOOK_SECRET`. Para retirar Vercel por completo, configurar esos
valores en `apps/shared/api.env`, cambiar el proxy de Telegram a
`http://127.0.0.1:3002/api/telegram-metrics`, reiniciar el servicio y comprobar
una actualización autorizada del bot. No eliminar el proyecto de Vercel
mientras esta ruta siga dependiendo de él.

## Cambio DNS

Cambiar el registro A de la raíz a `54.36.182.119`. `www` debe resolver al
mismo servidor (A o CNAME a la raíz). Revisar los registros AAAA existentes
para evitar que IPv6 continúe enviando visitantes a otro origen. Conservar
correo y los demás subdominios. La configuración DNS no se modifica desde
este workflow.
