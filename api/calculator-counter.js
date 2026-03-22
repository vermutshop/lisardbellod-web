const COUNTER_KEYS = ["buy_car", "ev_savings"];

async function kvRequest(command) {
  const baseUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("missing_kv_env");
  }

  const response = await fetch(`${baseUrl}/${command}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`kv_request_failed:${response.status}`);
  }

  return response.json();
}

async function getCount(key) {
  const data = await kvRequest(`get/${encodeURIComponent(`calc:${key}`)}`);
  return Number.parseInt(data?.result ?? "0", 10) || 0;
}

async function incrementCount(key) {
  const data = await kvRequest(`incr/${encodeURIComponent(`calc:${key}`)}`);
  return Number.parseInt(data?.result ?? "0", 10) || 0;
}

async function readAll() {
  const entries = await Promise.all(
    COUNTER_KEYS.map(async (key) => [key, await getCount(key)])
  );

  const counters = Object.fromEntries(entries);
  counters.total = COUNTER_KEYS.reduce((sum, key) => sum + (counters[key] || 0), 0);
  return counters;
}

function sendJson(res, data, status = 200) {
  res.status(status).setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.send(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      sendJson(res, await readAll());
      return;
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const counter = body?.counter;

      if (!COUNTER_KEYS.includes(counter)) {
        sendJson(res, { error: "invalid_counter" }, 400);
        return;
      }

      await incrementCount(counter);
      sendJson(res, await readAll());
      return;
    }

    sendJson(res, { error: "method_not_allowed" }, 405);
  } catch (error) {
    sendJson(res, { error: "counter_unavailable" }, 503);
  }
}
