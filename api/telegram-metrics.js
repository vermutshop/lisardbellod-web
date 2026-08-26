const REPOSITORY = process.env.TELEGRAM_GITHUB_REPOSITORY || "vermutshop/lisardbellod-web";
const BRANCH = process.env.TELEGRAM_GITHUB_BRANCH || "main";
const STATE_TTL_SECONDS = 60 * 30;

const CHANNELS = [
  { id: "UCUaJJERaZmu5_lfJPxT4X8A", name: "Lisard Bellod" },
  { id: "UCuHu9H9TimiFbUbtoi-EDCg", name: "Lisard World" },
  { id: "UCPX8H24n-SzE4TKFbG3B2-g", name: "Valls al mon" },
];

const METRICS = {
  instagram: { label: "seguidores de Instagram", file: "social", field: "instagramFollowers", integer: true },
  tiktok: { label: "seguidores de TikTok", file: "social", field: "tiktokFollowers", integer: true },
  youtubeHours: { label: "horas vistas de YouTube", file: "social", field: "youtubeHoursManual", integer: false },
  viewsLast365Days: { label: "views de YouTube de los últimos 365 días", file: "overrides", field: "viewsLast365Days", integer: true },
  channelSubscribers: { label: "suscriptores de YouTube", file: "channels", field: "subscribers", integer: true },
  channelViews: { label: "views totales de YouTube", file: "channels", field: "views", integer: true },
};

function json(res, status, data) {
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

async function telegram(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`telegram_${response.status}`);
  return response.json();
}

async function sendMessage(chatId, text, replyMarkup) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function answerCallback(callbackId) {
  return telegram("answerCallbackQuery", { callback_query_id: callbackId });
}

function kvConfig() {
  const baseUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!baseUrl || !token) throw new Error("missing_kv_env");
  return { baseUrl, token };
}

async function kv(command) {
  const { baseUrl, token } = kvConfig();
  const response = await fetch(`${baseUrl}/${command}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`kv_${response.status}`);
  return response.json();
}

async function getState(chatId) {
  const data = await kv(`get/${encodeURIComponent(`telegram:metrics:${chatId}`)}`);
  if (!data?.result) return null;
  try {
    return JSON.parse(data.result);
  } catch {
    return null;
  }
}

async function setState(chatId, state) {
  const key = encodeURIComponent(`telegram:metrics:${chatId}`);
  const value = encodeURIComponent(JSON.stringify(state));
  await kv(`set/${key}/${value}/EX/${STATE_TTL_SECONDS}`);
}

async function clearState(chatId) {
  await kv(`del/${encodeURIComponent(`telegram:metrics:${chatId}`)}`);
}

function githubHeaders() {
  const token = process.env.TELEGRAM_GITHUB_TOKEN;
  if (!token) throw new Error("missing_github_token");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readRepositoryJson(path) {
  const url = `https://api.github.com/repos/${REPOSITORY}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`github_read_${response.status}`);
  const file = await response.json();
  return {
    sha: file.sha,
    content: JSON.parse(Buffer.from(file.content, "base64").toString("utf8")),
  };
}

async function writeRepositoryJson(path, content, sha, message) {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${path}`, {
    method: "PUT",
    headers: { ...githubHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: Buffer.from(`${JSON.stringify(content, null, 2)}\n`, "utf8").toString("base64"),
      sha,
      branch: BRANCH,
    }),
  });
  if (!response.ok) throw new Error(`github_write_${response.status}`);
}

function parseMetricValue(input, integer) {
  const normalized = input.trim().replace(/\s/g, "");
  if (!normalized) return null;

  const commas = [...normalized.matchAll(/,/g)].map((match) => match.index);
  const dots = [...normalized.matchAll(/\./g)].map((match) => match.index);
  const lastComma = commas.at(-1) ?? -1;
  const lastDot = dots.at(-1) ?? -1;
  let numeric = normalized;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIndex = Math.max(lastComma, lastDot);
    const decimalChar = normalized[decimalIndex];
    numeric = normalized.replace(/[,.]/g, (character, index) =>
      index === decimalIndex ? "." : ""
    );
    if (decimalChar !== "," && decimalChar !== ".") return null;
  } else if (lastComma >= 0 || lastDot >= 0) {
    const separator = lastComma >= 0 ? "," : ".";
    const positions = lastComma >= 0 ? commas : dots;
    const decimals = normalized.length - positions.at(-1) - 1;
    if (positions.length === 1 && decimals > 0 && decimals <= 2 && !integer) {
      numeric = normalized.replace(separator, ".");
    } else {
      numeric = normalized.replaceAll(separator, "");
    }
  }

  if (!/^\d+(?:\.\d+)?$/.test(numeric)) return null;
  const value = Number(numeric);
  if (!Number.isFinite(value) || value < 0) return null;
  return integer ? Math.round(value) : value;
}

function formatMetric(value) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
}

function menu() {
  return {
    inline_keyboard: [
      [{ text: "Instagram", callback_data: "metric:instagram" }, { text: "TikTok", callback_data: "metric:tiktok" }],
      [{ text: "Horas YouTube", callback_data: "metric:youtubeHours" }, { text: "Views último año", callback_data: "metric:viewsLast365Days" }],
      [{ text: "Suscriptores YouTube", callback_data: "metric:channelSubscribers" }, { text: "Views totales YouTube", callback_data: "metric:channelViews" }],
      [{ text: "Cancelar", callback_data: "cancel" }],
    ],
  };
}

async function currentMetricValue(metric, channelId) {
  if (metric.file === "social") {
    const { content } = await readRepositoryJson("data/social-metrics.json");
    return Number(content[metric.field]) || 0;
  }

  const overrides = await readRepositoryJson("data/metric-overrides.json");
  if (metric.file === "overrides") return Number(overrides.content.metrics?.[metric.field]?.value) || 0;

  const overriddenValue = Number(overrides.content.channels?.[channelId]?.[metric.field]?.value);
  if (Number.isFinite(overriddenValue)) return overriddenValue;
  const data = await readRepositoryJson("data/data.json");
  return Number(data.content.channels?.find((channel) => channel.id === channelId)?.[metric.field]) || 0;
}

async function saveMetric(state) {
  const metric = METRICS[state.metric];
  const now = new Date().toISOString();

  if (metric.file === "social") {
    const file = await readRepositoryJson("data/social-metrics.json");
    file.content[metric.field] = state.value;
    await writeRepositoryJson(
      "data/social-metrics.json",
      file.content,
      file.sha,
      `chore: update ${metric.label} from Telegram`
    );
    return;
  }

  const file = await readRepositoryJson("data/metric-overrides.json");
  file.content.updatedAt = now;
  file.content.metrics ||= {};
  file.content.channels ||= {};

  if (metric.file === "overrides") {
    file.content.metrics[metric.field] = { value: state.value, updatedAt: now, source: "telegram" };
  } else {
    file.content.channels[state.channelId] ||= {};
    file.content.channels[state.channelId][metric.field] = {
      value: state.value,
      updatedAt: now,
      source: "telegram",
    };
  }

  await writeRepositoryJson(
    "data/metric-overrides.json",
    file.content,
    file.sha,
    `chore: correct ${metric.label} from Telegram`
  );
}

async function beginMetric(chatId, metricKey, channelId) {
  const metric = METRICS[metricKey];
  if (!metric) return;

  if (metric.file === "channels" && !channelId) {
    await setState(chatId, { stage: "channel", metric: metricKey });
    await sendMessage(chatId, "¿De qué canal quieres actualizar el dato?", {
      inline_keyboard: [
        ...CHANNELS.map((channel) => [{ text: channel.name, callback_data: `channel:${channel.id}` }]),
        [{ text: "Cancelar", callback_data: "cancel" }],
      ],
    });
    return;
  }

  const currentValue = await currentMetricValue(metric, channelId);
  const channel = CHANNELS.find((item) => item.id === channelId);
  const label = channel ? `${metric.label} de ${channel.name}` : metric.label;
  await setState(chatId, { stage: "input", metric: metricKey, channelId, label, currentValue });
  await sendMessage(
    chatId,
    `Ahora figura ${formatMetric(currentValue)} ${label}.\nEscribe la nueva cifra, sin texto.`
  );
}

async function handleText(chatId, text) {
  if (text === "/start" || text === "/ayuda") {
    await clearState(chatId);
    await sendMessage(chatId, "Soy el bot privado de métricas de Lisard Bellod. Usa /actualizar para cambiar o corregir un dato.");
    return;
  }
  if (text === "/cancelar") {
    await clearState(chatId);
    await sendMessage(chatId, "Actualización cancelada.");
    return;
  }
  if (text === "/actualizar") {
    await clearState(chatId);
    await sendMessage(chatId, "¿Qué dato quieres actualizar?", menu());
    return;
  }

  const state = await getState(chatId);
  if (!state || state.stage !== "input") {
    await sendMessage(chatId, "Usa /actualizar para empezar.");
    return;
  }

  const metric = METRICS[state.metric];
  const value = parseMetricValue(text, metric.integer);
  if (value === null) {
    await sendMessage(chatId, "No he entendido esa cifra. Prueba, por ejemplo, con 6150 o 57.304,4.");
    return;
  }

  await setState(chatId, { ...state, stage: "confirm", value });
  await sendMessage(chatId, `Vas a cambiar ${state.label} de ${formatMetric(state.currentValue)} a ${formatMetric(value)}. ¿Lo guardo?`, {
    inline_keyboard: [[
      { text: "Confirmar", callback_data: "confirm" },
      { text: "Corregir", callback_data: "correct" },
      { text: "Cancelar", callback_data: "cancel" },
    ]],
  });
}

async function handleCallback(chatId, data) {
  if (data === "cancel") {
    await clearState(chatId);
    await sendMessage(chatId, "Actualización cancelada.");
    return;
  }

  if (data.startsWith("metric:")) {
    await beginMetric(chatId, data.slice("metric:".length));
    return;
  }

  if (data.startsWith("channel:")) {
    const state = await getState(chatId);
    if (state?.stage === "channel") await beginMetric(chatId, state.metric, data.slice("channel:".length));
    return;
  }

  const state = await getState(chatId);
  if (data === "correct" && state?.stage === "confirm") {
    await setState(chatId, { ...state, stage: "input" });
    await sendMessage(chatId, `Escribe la cifra correcta para ${state.label}.`);
    return;
  }
  if (data === "confirm" && state?.stage === "confirm") {
    await saveMetric(state);
    await clearState(chatId);
    await sendMessage(chatId, `Guardado: ${state.label} = ${formatMetric(state.value)}. La web se actualizará al terminar el despliegue.`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ALLOWED_CHAT_ID) {
    json(res, 503, { error: "telegram_not_configured" });
    return;
  }

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && req.headers["x-telegram-bot-api-secret-token"] !== expectedSecret) {
    json(res, 401, { error: "invalid_webhook_secret" });
    return;
  }

  try {
    const update = await readBody(req);
    const callback = update.callback_query;
    const message = update.message;
    const chatId = String(callback?.message?.chat?.id || message?.chat?.id || "");

    if (!chatId || chatId !== String(process.env.TELEGRAM_ALLOWED_CHAT_ID)) {
      json(res, 200, { ok: true });
      return;
    }

    if (callback) {
      await answerCallback(callback.id);
      await handleCallback(chatId, callback.data || "");
    } else if (message?.text) {
      await handleText(chatId, message.text.trim());
    }

    json(res, 200, { ok: true });
  } catch (error) {
    console.error("telegram_metrics_error", error?.message || error);
    json(res, 500, { error: "telegram_update_failed" });
  }
}
