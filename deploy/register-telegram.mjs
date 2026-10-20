// Run on the server with --env-file=/home/lisardbellod/apps/shared/telegram.env.
const required = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_CHAT_ID', 'TELEGRAM_GITHUB_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing configuration: ${name}`);
}
if (!/^[0-9]+$/.test(process.env.TELEGRAM_ALLOWED_CHAT_ID)) throw new Error('Invalid private chat ID');
if (!/^[A-Za-z0-9_-]{32,256}$/.test(process.env.TELEGRAM_WEBHOOK_SECRET)) throw new Error('Invalid webhook secret');
async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}), signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(`Telegram ${method} failed (HTTP ${response.status})`);
  return data.result;
}
try {
  const bot = await telegram('getMe');
  if (bot.username !== 'counterlisardbot') throw new Error('Unexpected bot; webhook unchanged');
  const chat = await telegram('getChat', { chat_id: process.env.TELEGRAM_ALLOWED_CHAT_ID });
  if (chat.type !== 'private') throw new Error('Expected a private chat; webhook unchanged');
  const repo = process.env.TELEGRAM_GITHUB_REPOSITORY || 'vermutshop/lisardbellod-web';
  if (repo !== 'vermutshop/lisardbellod-web') throw new Error('Unexpected repository');
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/data/social-metrics.json`, {
    headers: { Authorization: `Bearer ${process.env.TELEGRAM_GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GitHub contents access failed (HTTP ${response.status})`);
  await telegram('setWebhook', {
    url: 'https://lisardbellod.com/api/telegram-metrics', ip_address: '54.36.182.119',
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'],
    max_connections: 2, drop_pending_updates: false,
  });
  const info = await telegram('getWebhookInfo');
  if (info.url !== 'https://lisardbellod.com/api/telegram-metrics' || info.ip_address !== '54.36.182.119') throw new Error('Unexpected webhook destination');
  console.log(JSON.stringify({ bot: bot.username, url: info.url, ip: info.ip_address, pending: info.pending_update_count }));
} catch (error) {
  // Do not print fetch exception details: URLs contain the bot credential.
  console.error(error instanceof TypeError ? 'Network request failed' : error.message);
  process.exitCode = 1;
}
