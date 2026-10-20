# Included only inside the lisardbellod.com HTTP and HTTPS VirtualHosts.
DocumentRoot /home/lisardbellod/apps/current/public
<Directory /home/lisardbellod/apps/>
    Options -Indexes +FollowSymLinks
    AllowOverride None
    Require all granted
    DirectoryIndex index.html
</Directory>
Alias /.well-known/acme-challenge/ /home/lisardbellod/public_html/.well-known/acme-challenge/
ErrorDocument 404 /404.html
AddType application/manifest+json .webmanifest
AddType text/markdown .md
Header always set Link "</llms.txt>; rel=\"describedby\", </.well-known/ai-catalog.json>; rel=\"ai-catalog\""

RewriteEngine On
RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://lisardbellod.com%{REQUEST_URI} [R=308,L,NE]
RewriteCond %{HTTP_HOST} ^www\.lisardbellod\.com$ [NC]
RewriteCond %{REQUEST_URI} !^/api/telegram-metrics/?$
RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
RewriteRule ^ https://lisardbellod.com%{REQUEST_URI} [R=308,L,NE]
RedirectMatch 301 ^/blog-sitemap\.xml$ /sitemap.xml
RedirectMatch 301 ^/calcotadas(?:/.*)?$ /blog/calcotadas/
RedirectMatch 301 ^/calcotades(?:/.*)?$ /blog/calcotades/
RedirectMatch 301 ^/que-es-esto(?:/.*)?$ /blog/que-es-esto/
RedirectMatch 301 ^/top-pinscher(?:/.*)?$ /blog/top-pinscher/
RedirectMatch 301 ^/carcasas(?:/.*)?$ /blog/carcasas/
RedirectMatch 308 ^/blog/paginas(?:/.*)?$ /blog/

ProxyPreserveHost Off
ProxyTimeout 30
ProxyPass /api/calculator-counter http://127.0.0.1:3002/api/calculator-counter
ProxyPassReverse /api/calculator-counter http://127.0.0.1:3002/api/calculator-counter

# Transitional bridge: four Telegram secrets are not exportable from Vercel.
# Remove this proxy only after configuring and checking the local webhook.
SSLProxyEngine On
SSLProxyVerify require
SSLProxyVerifyDepth 5
SSLProxyCheckPeerName On
SSLProxyCACertificateFile /etc/ssl/certs/ca-certificates.crt
ProxyPass /api/telegram-metrics https://lisardbellod-web.vercel.app/api/telegram-metrics
ProxyPassReverse /api/telegram-metrics https://lisardbellod-web.vercel.app/api/telegram-metrics
<Location /api/>
    LimitRequestBody 65536
</Location>
