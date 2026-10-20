import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { originRequest } from '../api/server-proxy.js';
import { readFileSync } from 'node:fs';
const req = (path, extra = {}) => ({url:'/?q=Canad%C3%A1&__origin_path=ignored',method:'GET',headers:{},query:{__origin_path:path},...extra});
test('proxy pins the server IP while validating the domain TLS certificate and preserving path/query',()=>{
 const options=originRequest(req('blog/canada-osoyoos-spotted-lake/'));
 assert.equal(options.hostname,'54.36.182.119');assert.equal(options.servername,'lisardbellod.com');
 assert.equal(options.headers.host,'lisardbellod.com');assert.equal(options.path,'/blog/canada-osoyoos-spotted-lake/?q=Canad%C3%A1');
 assert.notEqual(options.rejectUnauthorized,false);
 assert.equal(originRequest(req('')).path,'/?q=Canad%C3%A1');
});
test('proxy rejects Telegram loops, path traversal, ambiguous paths and writes outside the counter',()=>{
 for(const path of ['api/telegram-metrics','api/%74elegram-metrics','api/server-proxy','../.env','blog/%2e%2e/.env','x%0d%0aHost:evil','a%5cb']) assert.throws(()=>originRequest(req(path)));
 assert.throws(()=>originRequest(req(['blog/','api/telegram-metrics'])));
 assert.throws(()=>originRequest(req('blog/',{method:'POST'})));
 assert.equal(originRequest(req('api/calculator-counter',{method:'POST'})).method,'POST');
});
test('proxy preserves historical Unicode slugs whether the rewrite parameter is decoded or escaped',()=>{
 for (const path of ['blog/pepitu-caido-10-horas…/','blog/pepitu-caido-10-horas%e2%80%a6/']) {
  assert.equal(originRequest(req(path)).path, '/blog/pepitu-caido-10-horas%E2%80%A6/?q=Canad%C3%A1');
 }
 assert.equal(originRequest(req('blog/¿por-que-quiero-la-ps3/')).path, '/blog/%C2%BFpor-que-quiero-la-ps3/?q=Canad%C3%A1');
 assert.equal(originRequest(req('image/a b#c?d.png')).path, '/image/a%20b%23c%3Fd.png?q=Canad%C3%A1');
});
test('proxy forwards cache/range and content headers without sending credentials or attacker Host',()=>{
 const o=originRequest(req('image/a.webp',{headers:{host:'evil.example',authorization:'private',cookie:'private',range:'bytes=0-99','if-none-match':'"abc"','x-telegram-bot-api-secret-token':'private'}}));
 assert.equal(o.headers.range,'bytes=0-99');assert.equal(o.headers['if-none-match'],'"abc"');
 assert.equal(o.headers.host,'lisardbellod.com');assert.equal(o.headers.cookie,undefined);assert.equal(o.headers.authorization,undefined);assert.equal(o.headers['x-telegram-bot-api-secret-token'],undefined);
});
test('routing leaves Telegram local and sends article and static files through the bridge',()=>{
 const c=JSON.parse(readFileSync('vercel.json','utf8'));const rule=c.routes[0];
 const match=new RegExp('^'+rule.src+'$');
 for(const path of ['/','/blog/canada-osoyoos-spotted-lake/','/sitemap.xml','/api/calculator-counter','/blog-assets/a.webp']) assert.ok(match.test(path));
 for(const path of ['/api/telegram-metrics','/api/telegram-metrics/','/api/server-proxy']) assert.ok(!match.test(path));
});

test('www redirects to the canonical domain preserving the full path and query',async()=>{
 const headers={};let ended=false;const res={setHeader:(k,v)=>{headers[k]=v},end:()=>{ended=true}};
 await handler(req('blog/',{headers:{host:'www.lisardbellod.com'}}),res);
 assert.equal(res.statusCode,308);assert.equal(headers.Location,'https://lisardbellod.com/blog/?q=Canad%C3%A1');assert.ok(ended);
});
