import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiServer } from "../deploy/api-server.mjs";

test("standalone API rejects malformed requests and protects the webhook", async () => {
  const keys = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_ALLOWED_CHAT_ID", "TELEGRAM_WEBHOOK_SECRET"];
  const previous = keys.map(key => process.env[key]);
  for (const key of keys) process.env[key] = "test-only";
  const server = createApiServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    assert.equal((await fetch(`${base}/api/calculator-counter`, { method: "POST", body: "{" })).status, 400);
    assert.equal((await fetch(`${base}/api/calculator-counter`, { method: "POST", body: JSON.stringify({ counter: "invalid" }) })).status, 400);
    assert.equal((await fetch(`${base}/api/calculator-counter`, { method: "POST", body: "x".repeat(70000) })).status, 413);
    assert.equal((await fetch(`${base}/api/telegram-metrics`, { method: "POST", body: "{}" })).status, 401);
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
