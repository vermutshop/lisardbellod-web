import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/telegram-metrics.js';

test('Telegram menu, correction, confirmation and saving work without external calls', async (t) => {
 const vars = { TELEGRAM_BOT_TOKEN:'test', TELEGRAM_ALLOWED_CHAT_ID:'123', TELEGRAM_WEBHOOK_SECRET:'secret', TELEGRAM_GITHUB_TOKEN:'test', KV_REST_API_URL:'https://kv.test', KV_REST_API_TOKEN:'test' };
 const old = Object.fromEntries(Object.keys(vars).map(k => [k,process.env[k]]));
 Object.assign(process.env,vars);
 t.after(() => { for (const [k,v] of Object.entries(old)) { if(v===undefined) delete process.env[k]; else process.env[k]=v; } });
 let state = null;
 const messages = [], writes = [], calls = [];
 const channelId = 'UCUaJJERaZmu5_lfJPxT4X8A';
 const files = {
  'data/social-metrics.json': { instagramFollowers:211, tiktokFollowers:4833, youtubeHoursManual:64832 },
  'data/metric-overrides.json': { channels: { [channelId]: { subscribers: { value:6168, updatedAt:'2026-08-26T12:00:00Z' } } } },
  'data/data.json': { meta: { lastUpdated:'2026-10-07T11:00:00Z' }, channels:[{id:channelId,subscribers:6780}],metrics:{viewsLast365Days:1468763} }
 };
 t.mock.method(globalThis,'fetch',async (url,options={}) => {
  calls.push(url);
  const parsed = new URL(url); let result;
  if(parsed.hostname==='kv.test') {
   const parts = parsed.pathname.slice(1).split('/').map(decodeURIComponent);
   if(parts[0]==='get') result={result:state===null?null:JSON.stringify(state)};
   else if(parts[0]==='set') {state=JSON.parse(parts[2]); result={result:'OK'};}
   else if(parts[0]==='del') {state=null;result={result:1};}
   else throw Error('Unexpected KV request');
  } else if(parsed.hostname==='api.telegram.org') {
   if(parsed.pathname.endsWith('/sendMessage')) messages.push(JSON.parse(options.body));
   result={ok:true};
  } else if(parsed.hostname==='api.github.com') {
   const file=parsed.pathname.split('/contents/')[1]; assert.ok(file in files);
   if(options.method==='PUT') {const body=JSON.parse(options.body);assert.equal(body.sha,'existing-sha');const content=JSON.parse(Buffer.from(body.content,'base64'));files[file]=content;writes.push({file,content});result={};}
   else result={sha:'existing-sha',content:Buffer.from(JSON.stringify(files[file])).toString('base64')};
  } else throw Error('Unexpected network request');
  return {ok:true,json:async()=>result};
 });
 async function update(body, secret='secret') {
  const res = { status(n){this.code=n;return this;},setHeader(){return this;},send(value){this.payload=JSON.parse(value);} };
  await handler({method:'POST',headers:{'x-telegram-bot-api-secret-token':secret},body},res);return res;
 }
 const message=text=>({message:{chat:{id:123},text}});
 const callback=data=>({callback_query:{id:'cb',message:{chat:{id:123}},data}});
 assert.equal((await update(message('/actualizar'),'wrong')).code,401);assert.equal(calls.length,0);
 assert.equal((await update({message:{chat:{id:999},text:'/actualizar'}})).code,200);assert.equal(calls.length,0);
 assert.equal((await update(message('/actualizar'))).code,200);
 assert.equal(messages.at(-1).reply_markup.inline_keyboard[0][0].callback_data,'metric:instagram');
 await update(callback('metric:channelSubscribers'));
 await update(callback(`channel:${channelId}`));
 assert.equal(state.currentValue,6780);assert.match(messages.at(-1).text,/próxima sincronización/);
 await update(message('1,2'));assert.equal(state.stage,'input');assert.equal(writes.length,0);
 await update(message('6.900'));assert.equal(state.stage,'confirm');assert.equal(writes.length,0);
 await update(callback('confirm'));assert.equal(writes.length,1);assert.equal(state,null);
 assert.equal(writes[0].content.channels[channelId].subscribers.value,6900);
 assert.ok(Date.parse(writes[0].content.channels[channelId].subscribers.updatedAt));
 await update(callback('metric:viewsLast365Days'));assert.equal(state.currentValue,1468763);
 await update(callback('metric:instagram'));await update(message('0'));assert.equal(writes.length,1);
 await update(callback('confirm'));assert.equal(writes[1].content.instagramFollowers,0);assert.ok(Date.parse(writes[1].content.updatedAt));
});
