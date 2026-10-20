import https from 'node:https';

const ORIGIN_IP = '54.36.182.119';
const ORIGIN_HOST = 'lisardbellod.com';
const REQUEST_HEADERS = ['accept', 'accept-encoding', 'accept-language', 'user-agent',
  'if-none-match', 'if-modified-since', 'range', 'if-range', 'origin', 'referer', 'content-type'];
const RESPONSE_HEADERS = ['content-type', 'content-length', 'content-encoding', 'content-disposition',
  'content-range', 'accept-ranges', 'etag', 'last-modified', 'location', 'vary', 'allow', 'link',
  'access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers'];

// Only the public site's fixed origin is reachable; never resolve its public DNS here.
export function originRequest(req) {
  const url = new URL(req.url, 'https://lisardbellod.com');
  const routed = req.query?.__origin_path ?? url.searchParams.getAll('__origin_path');
  const parts = Array.isArray(routed) ? routed : [routed];
  if (parts.length !== 1 || typeof parts[0] !== 'string') throw new Error('Invalid route');
  const path = '/' + parts[0].replace(/^\/+/, '');
  const decoded = decodeURIComponent(path);
  if (/[\r\n\\]/.test(decoded) || decoded.split('/').some(p => p === '.' || p === '..') ||
      /^\/api\/(?:telegram-metrics|server-proxy)(?:\/|$)/i.test(decoded)) throw new Error('Invalid route');
  const method = req.method || 'GET';
  if (!['GET', 'HEAD'].includes(method) &&
      !(decoded === '/api/calculator-counter' && ['POST', 'OPTIONS'].includes(method))) throw new Error('Invalid method');
  url.searchParams.delete('__origin_path');
  const query = url.searchParams.toString();
  const headers = { host: ORIGIN_HOST };
  for (const key of REQUEST_HEADERS) if (req.headers[key]) headers[key] = req.headers[key];
  return { hostname: ORIGIN_IP, servername: ORIGIN_HOST, port: 443, method,
    path: path + (query ? '?' + query : ''), headers, timeout: 20000 };
}

export default async function handler(req, res) {
  let options;
  try { options = originRequest(req); }
  catch { res.statusCode = 400; res.end('Solicitud no válida'); return; }
  if (req.headers.host?.toLowerCase() === 'www.lisardbellod.com') {
    res.statusCode = 308;
    res.setHeader('Location', 'https://lisardbellod.com' + options.path);
    res.setHeader('Cache-Control', 'no-store');
    res.end();
    return;
  }
  // Vercel has already parsed JSON bodies. Raw Node requests are streamed below.
  let body;
  if (req.body !== undefined && !['GET', 'HEAD'].includes(options.method)) {
    body = Buffer.isBuffer(req.body) || typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(body) > 65536) { res.statusCode = 413; res.end(); return; }
    options.headers['content-length'] = Buffer.byteLength(body);
  }
  await new Promise(resolve => {
    let upstream;
    const fail = () => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('Cache-Control', 'no-store');
        res.end('El servidor no está disponible temporalmente.');
      } else res.destroy();
      resolve();
    };
    const request = https.request(options, response => {
      upstream = response;
      res.statusCode = response.statusCode;
      for (const key of RESPONSE_HEADERS) if (response.headers[key] !== undefined) res.setHeader(key, response.headers[key]);
      // Always consult the active server release, including after automated publications.
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Lisard-Origin', 'server');
      response.on('error', fail);
      response.pipe(res);
    });
    request.on('timeout', () => request.destroy(new Error('Origin timeout')));
    request.on('error', fail);
    res.on('finish', resolve);
    res.on('close', () => { request.destroy(); upstream?.destroy(); resolve(); });
    if (body !== undefined) request.end(body);
    else if (['GET', 'HEAD'].includes(options.method)) request.end();
    else req.pipe(request);
  });
}
