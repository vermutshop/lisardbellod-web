import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = String(process.env.TELEGRAM_ALLOWED_CHAT_ID || "");
const STATE_PATH = path.join(ROOT, ".github", "telegram-metrics-state.json");
const SOCIAL_PATH = path.join(ROOT, "data", "social-metrics.json");
const OVERRIDES_PATH = path.join(ROOT, "data", "metric-overrides.json");
const DATA_PATH = path.join(ROOT, "data", "data.json");

const CHANNELS = {
  principal: { id: "UCUaJJERaZmu5_lfJPxT4X8A", name: "Lisard Bellod" },
  world: { id: "UCuHu9H9TimiFbUbtoi-EDCg", name: "Lisard World" },
  valls: { id: "UCPX8H24n-SzE4TKFbG3B2-g", name: "Valls al mon" },
};

const METRICS = {
  instagram: { label: "seguidores de Instagram", target: "social", field: "instagramFollowers", integer: true },
  tiktok: { label: "seguidores de TikTok", target: "social", field: "tiktokFollowers", integer: true },
  horas: { label: "horas vistas de YouTube", target: "social", field: "youtubeHoursManual", integer: false },
  views365: { label: "views de YouTube de los últimos 365 días", target: "metricOverride", field: "viewsLast365Days", integer: true },
  suscriptores: { label: "suscriptores de YouTube", target: "channelOverride", field: "subscribers", integer: true },
  views: { label: "views totales de YouTube", target: "channelOverride", field: "views", integer: true },
};

function assertConfig() {
  if (!TOKEN) throw new Error("Falta TELEGRAM_BOT_TOKEN.");
  if (!ALLOWED_CHAT_ID) throw new Error("Falta TELEGRAM_ALLOWED_CHAT_ID.");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function telegram(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Telegram respondió ${response.status} en ${method}.`);
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

function formatValue(value) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(value);
}

function parseValue(text, integer) {
  const normalized = text.trim().replace(/\s/g, "");
  if (!normalized) return null;

  const commas = [...normalized.matchAll(/,/g)].map((match) => match.index);
  const dots = [...normalized.matchAll(/\./g)].map((match) => match.index);
  const lastComma = commas.at(-1) ?? -1;
  const lastDot = dots.at(-1) ?? -1;
  let numeric = normalized;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalIndex = Math.max(lastComma, lastDot);
    numeric = normalized.replace(/[,.]/g, (character, index) => (index === decimalIndex ? "." : ""));
  } else if (lastComma >= 0 || lastDot >= 0) {
    const separator = lastComma >= 0 ? "," : ".";
    const positions = lastComma >= 0 ? commas : dots;
    const decimals = normalized.length - positions.at(-1) - 1;
    numeric = positions.length === 1 && decimals > 0 && decimals <= 2 && !integer
      ? normalized.replace(separator, ".")
      : normalized.replaceAll(separator, "");
  }

  if (!/^\d+(?:\.\d+)?$/.test(numeric)) return null;
  const value = Number(numeric);
  if (!Number.isFinite(value) || value < 0) return null;
  return integer ? Math.round(value) : value;
}

function mainMenu() {
  return {
    inline_keyboard: [
      [{ text: "Instagram", callback_data: "help:instagram" }, { text: "TikTok", callback_data: "help:tiktok" }],
      [{ text: "Horas YouTube", callback_data: "help:horas" }, { text: "Views último año", callback_data: "help:views365" }],
      [{ text: "Suscriptores YouTube", callback_data: "help:suscriptores" }, { text: "Views totales YouTube", callback_data: "help:views" }],
    ],
  };
}

function usage(metricKey) {
  const metric = METRICS[metricKey];
  if (metric.target === "channelOverride") {
    return `Escribe, por ejemplo:\n/${metricKey} principal 6160\n\nCanales: principal, world o valls.`;
  }
  return `Escribe, por ejemplo:\n/${metricKey} ${metric.integer ? "1234" : "57304,4"}`;
}

async function currentValue(metricKey, channelKey) {
  const metric = METRICS[metricKey];
  if (metric.target === "social") {
    const social = await readJson(SOCIAL_PATH);
    return Number(social[metric.field]) || 0;
  }

  const overrides = await readJson(OVERRIDES_PATH);
  if (metric.target === "metricOverride") {
    return Number(overrides.metrics?.[metric.field]?.value) || 0;
  }

  const channel = CHANNELS[channelKey];
  const overridden = Number(overrides.channels?.[channel.id]?.[metric.field]?.value);
  if (Number.isFinite(overridden)) return overridden;
  const data = await readJson(DATA_PATH);
  return Number(data.channels?.find((item) => item.id === channel.id)?.[metric.field]) || 0;
}

async function saveMetric(metricKey, value, channelKey) {
  const metric = METRICS[metricKey];
  if (metric.target === "social") {
    const social = await readJson(SOCIAL_PATH);
    social[metric.field] = value;
    await writeJson(SOCIAL_PATH, social);
    return;
  }

  const overrides = await readJson(OVERRIDES_PATH);
  const entry = { value, updatedAt: new Date().toISOString(), source: "telegram" };
  overrides.updatedAt = entry.updatedAt;
  overrides.metrics ||= {};
  overrides.channels ||= {};

  if (metric.target === "metricOverride") {
    overrides.metrics[metric.field] = entry;
  } else {
    const channel = CHANNELS[channelKey];
    overrides.channels[channel.id] ||= {};
    overrides.channels[channel.id][metric.field] = entry;
  }
  await writeJson(OVERRIDES_PATH, overrides);
}

async function requestConfirmation(chatId, metricKey, value, channelKey) {
  const metric = METRICS[metricKey];
  const current = await currentValue(metricKey, channelKey);
  const channel = channelKey ? CHANNELS[channelKey] : null;
  const label = channel ? `${metric.label} de ${channel.name}` : metric.label;
  const callbackData = `save:${metricKey}:${channelKey || "-"}:${value}`;
  await sendMessage(
    chatId,
    `Vas a cambiar ${label} de ${formatValue(current)} a ${formatValue(value)}. ¿Lo guardo?`,
    {
      inline_keyboard: [[
        { text: "Confirmar", callback_data: callbackData },
        { text: "Cancelar", callback_data: "cancel" },
      ]],
    }
  );
}

async function handleMessage(chatId, text) {
  const [rawCommand, ...args] = text.trim().split(/\s+/);
  const command = rawCommand.toLowerCase().split("@")[0];

  if (command === "/start" || command === "/actualizar" || command === "/ayuda") {
    await sendMessage(chatId, "¿Qué dato quieres actualizar? Elige una opción o escribe /ayuda.", mainMenu());
    return;
  }

  const metricKey = command.slice(1);
  const metric = METRICS[metricKey];
  if (!metric) {
    await sendMessage(chatId, "Usa /actualizar para elegir un dato.");
    return;
  }

  const channelKey = metric.target === "channelOverride" ? args.shift()?.toLowerCase() : null;
  if (metric.target === "channelOverride" && !CHANNELS[channelKey]) {
    await sendMessage(chatId, usage(metricKey));
    return;
  }
  const value = parseValue(args.join(" "), metric.integer);
  if (value === null) {
    await sendMessage(chatId, usage(metricKey));
    return;
  }
  await requestConfirmation(chatId, metricKey, value, channelKey);
}

async function handleCallback(chatId, callback) {
  await answerCallback(callback.id);
  const data = callback.data || "";
  if (data === "cancel") {
    await sendMessage(chatId, "Actualización cancelada.");
    return;
  }
  if (data.startsWith("help:")) {
    const metricKey = data.slice("help:".length);
    if (METRICS[metricKey]) await sendMessage(chatId, usage(metricKey));
    return;
  }
  if (!data.startsWith("save:")) return;

  const [, metricKey, channelKey, rawValue] = data.split(":");
  const metric = METRICS[metricKey];
  const value = parseValue(rawValue, metric?.integer);
  if (!metric || value === null || (metric.target === "channelOverride" && !CHANNELS[channelKey])) {
    await sendMessage(chatId, "No se ha podido validar esa actualización. Vuelve a usar /actualizar.");
    return;
  }

  await saveMetric(metricKey, value, channelKey === "-" ? null : channelKey);
  const channel = channelKey && channelKey !== "-" ? CHANNELS[channelKey] : null;
  const label = channel ? `${metric.label} de ${channel.name}` : metric.label;
  await sendMessage(chatId, `Guardado: ${label} = ${formatValue(value)}. La web se actualizará al terminar este proceso.`);
}

async function main() {
  assertConfig();
  const state = await readJson(STATE_PATH);
  const updatesUrl = new URL(`https://api.telegram.org/bot${TOKEN}/getUpdates`);
  updatesUrl.searchParams.set("offset", String((state.lastUpdateId || 0) + 1));
  updatesUrl.searchParams.set("allowed_updates", JSON.stringify(["message", "callback_query"]));
  const response = await fetch(updatesUrl);
  if (!response.ok) throw new Error(`Telegram respondió ${response.status} al leer actualizaciones.`);
  const payload = await response.json();

  for (const update of payload.result || []) {
    const callback = update.callback_query;
    const message = update.message;
    const chatId = String(callback?.message?.chat?.id || message?.chat?.id || "");
    if (chatId === ALLOWED_CHAT_ID) {
      if (callback) await handleCallback(chatId, callback);
      if (message?.text) await handleMessage(chatId, message.text);
    }
    state.lastUpdateId = update.update_id;
  }

  await writeJson(STATE_PATH, state);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
