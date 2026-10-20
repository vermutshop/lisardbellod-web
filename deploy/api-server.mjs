import http from "node:http";
import calculator from "../api/calculator-counter.js";
import telegram from "../api/telegram-metrics.js";

export function createApiServer() {
  return http.createServer(async (req, res) => {
    res.status = (status) => { res.statusCode = status; return res; };
    res.send = (body) => res.end(body);
    const path = new URL(req.url, "http://localhost").pathname.replace(/\/$/, "");
    const handler = { "/api/calculator-counter": calculator, "/api/telegram-metrics": telegram }[path];
    if (!handler) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end('{"error":"not_found"}');
    }
    try {
      let size = 0;
      const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 65536) {
          res.writeHead(413);
          return res.end();
        }
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString("utf8");
      req.body = body ? JSON.parse(body) : {};
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end('{"error":"invalid_json"}');
    }
    try {
      await handler(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end('{"error":"internal_error"}');
    }
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const server = createApiServer();
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.listen(Number(process.env.PORT || 3002), "127.0.0.1");
}
