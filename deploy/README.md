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

Certificado inicial de Let's Encrypt emitido el 20 de octubre de 2026, válido
hasta el 18 de enero de 2027, para la raíz y `www`. Apache utiliza los archivos
de `/etc/letsencrypt/live/lisardbellod.com/`. La unidad
`lisardbellod-certificate.timer` comprueba diariamente su renovación mediante
HTTP y recarga Apache únicamente al renovarlo. Tras cambiar el DNS, comprobar
la renovación con `sudo certbot renew --cert-name lisardbellod.com --dry-run`.
La prueba de renovación necesita que ambos nombres apunten al nuevo servidor.
No habilitar el temporizador global de Certbot: los demás dominios tienen su
propia gestión.

La clave de despliegue y la clave pública verificada del servidor se guardan
como secretos `LISARDBELLOD_DEPLOY_KEY` y `LISARDBELLOD_KNOWN_HOSTS` en GitHub.
No guardar credenciales en este repositorio. El usuario de publicación solo
tiene permiso sudo para reiniciar su propio servicio.

La activación conserva las versiones anteriores y comprueba el contador antes
de dar el despliegue por bueno. Si falla la comprobación, restaura la versión
anterior. Para una recuperación manual, cambiar `current` a una release
anterior y reiniciar únicamente `lisardbellod-api.service`.

## Telegram en el servidor

El bot `@counterlisardbot` se ejecuta en la API local. Sus credenciales están en
`/home/lisardbellod/apps/shared/telegram.env`, propiedad de `lisardbellod` y modo
600. El servicio carga este archivo además de `api.env`, que conserva Redis.
Nunca guardar estos archivos en Git ni dentro del directorio público.

Después de cambiar las credenciales, reiniciar y registrar el webhook:

```sh
sudo systemctl restart lisardbellod-api.service
sudo -u lisardbellod node --env-file=/home/lisardbellod/apps/shared/telegram.env /home/lisardbellod/apps/current/deploy/register-telegram.mjs
```

El registro comprueba la identidad del bot, el chat privado y la lectura del
repositorio antes de cambiar el webhook. El token de GitHub necesita además
`Contents: Read and write` para guardar cambios confirmados de métricas.
El webhook usa `https://lisardbellod.com/api/telegram-metrics` y fija la IP
`54.36.182.119`, por lo que Telegram llega directamente al servidor incluso
antes del cambio DNS. Conserva las actualizaciones pendientes.

Una copia local de configuración no se sincroniza automáticamente: hay que
actualizar el archivo privado del servidor antes de ejecutar esos comandos.

## Cambio DNS

Cambiar el registro A de la raíz a `54.36.182.119`. `www` debe resolver al
mismo servidor (A o CNAME a la raíz). Revisar los registros AAAA existentes
para evitar que IPv6 continúe enviando visitantes a otro origen. Conservar
correo y los demás subdominios. La configuración DNS no se modifica desde
este workflow.

## Verificación previa al cambio DNS

El 20 de octubre de 2026 pasaron las 31 pruebas del proyecto y se compararon
por HTTPS 94 páginas y recursos del servidor con sus archivos de publicación:
contenido idéntico, sitemap con 2.015 URLs y buscador con 1.749 artículos.
Se verificaron certificado, redirecciones, respuestas 404 para archivos
privados, contador existente y rechazo de peticiones sin el secreto del bot.
No se enviaron mensajes ni se incrementaron contadores durante las pruebas.
Los despliegues de GitHub Actions terminaron correctamente.

## Puente temporal mientras el DNS apunta a Vercel

`api/server-proxy.js` recibe las rutas públicas mediante una ruta anterior a los archivos estáticos de
`vercel.json` y las solicita por HTTPS a `54.36.182.119`, con SNI y Host
`lisardbellod.com` y validación normal del certificado. No consulta el DNS
público del dominio, por lo que no vuelve al propio Vercel. La respuesta
lleva `X-Lisard-Origin: server` y `Cache-Control: no-store`: los cambios de
la versión activa en Apache se sirven sin depender del despliegue estático
de Vercel.

La ruta de Telegram queda excluida del puente: su webhook ya apunta
directamente al servidor mediante una IP fija. El contador sí
se consulta en el servidor. El puente no reenvía cookies ni autorización
a las páginas públicas y solo permite escrituras en el contador.

Es una transición, no la retirada de Vercel. Sus límites de funciones
siguen aplicándose (incluido el máximo de respuesta de 4,5 MB). Los recursos
públicos actuales están por debajo de ese límite. La ruta `/.well-known`
está reservada por Vercel, de modo que la renovación HTTP del certificado
del servidor requiere completar el cambio DNS descrito arriba.

Al apuntar raíz y `www` al servidor, el tráfico ya no pasa por este puente.
Comprobar HTTPS y renovar el certificado; retirar después la configuración
del puente y la dependencia de Vercel.
